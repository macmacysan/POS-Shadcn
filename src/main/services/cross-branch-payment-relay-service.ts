import type Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { paymentMethodNameSchema, type PaymentMethodName } from '../../shared/contracts'
import type {
  CrossBranchPaymentReceipt,
  GoogleSyncBranch,
  InstallmentAccountRecord,
  InstallmentCreatePaymentRequest,
  InstallmentPaymentWorkspace
} from '../../shared/contracts'
import { AppError } from '../database/errors'
import { recordGcashDrawing } from '../database/gcash-drawings'
import { InstallmentRepository } from '../database/installment-repository'
import { googleSheetSources } from '../config/google-sheets'
import type { GoogleSheetsClient } from './google-sheets-client'
import { AuthService } from './auth-service'
import { buildInHouseSchedule } from './in-house-schedule'

const sheetName = 'RelayData'
const headers = [
  'event_id',
  'version',
  'event_type',
  'owner_branch',
  'collecting_branch',
  'payload_json',
  'created_at'
]
const branches = ['Goa', 'Tinambac', 'Tigaon', 'Lagonoy'] as const
type RelayPayment = Parameters<InstallmentRepository['applyRelayedPayment']>[0]

function isBusinessDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value
}

function isRelayPayment(value: unknown): value is RelayPayment {
  if (!value || typeof value !== 'object') return false
  const event = value as Partial<RelayPayment>
  return (
    typeof event.eventId === 'string' &&
    event.eventId.length > 0 &&
    event.eventId.length <= 100 &&
    typeof event.ownerBranch === 'string' &&
    branches.includes(event.ownerBranch as (typeof branches)[number]) &&
    typeof event.collectingBranch === 'string' &&
    branches.includes(event.collectingBranch as (typeof branches)[number]) &&
    event.ownerBranch !== event.collectingBranch &&
    typeof event.accountId === 'string' &&
    event.accountId.length > 0 &&
    event.accountId.length <= 100 &&
    typeof event.contractId === 'string' &&
    event.contractId.length > 0 &&
    event.contractId.length <= 100 &&
    isBusinessDate(event.paymentDate) &&
    Number.isSafeInteger(event.amountCentavos) &&
    (event.amountCentavos ?? 0) > 0 &&
    Number.isSafeInteger(event.penaltyCentavos) &&
    (event.penaltyCentavos ?? -1) >= 0 &&
    paymentMethodNameSchema.safeParse(event.paymentMethod).success &&
    (event.cashierName === undefined ||
      (typeof event.cashierName === 'string' &&
        event.cashierName.trim().length > 0 &&
        event.cashierName.length <= 200)) &&
    (event.scheduleNumber === undefined ||
      (Number.isSafeInteger(event.scheduleNumber) && (event.scheduleNumber ?? 0) > 0)) &&
    (event.referenceNumber === undefined ||
      (typeof event.referenceNumber === 'string' && event.referenceNumber.length <= 100)) &&
    (event.remarks === undefined ||
      (typeof event.remarks === 'string' && event.remarks.length <= 1000))
  )
}

export class CrossBranchPaymentRelayService {
  constructor(
    private readonly db: Database.Database,
    private readonly sheets: Pick<
      GoogleSheetsClient,
      'ensureTabs' | 'values' | 'updateValues' | 'appendValues'
    >,
    private readonly auth: AuthService,
    private readonly installments: InstallmentRepository,
    private readonly remoteRecords: () => Promise<InstallmentAccountRecord[]>,
    private readonly remotePaymentWorkspace?: (
      branch: GoogleSyncBranch,
      contractId: string
    ) => InstallmentPaymentWorkspace | undefined | Promise<InstallmentPaymentWorkspace | undefined>,
    private readonly onPaymentReceived?: (receipt: CrossBranchPaymentReceipt) => void
  ) {}

  async remoteRecord(
    accountId: string,
    contractId: string
  ): Promise<InstallmentAccountRecord | undefined> {
    const user = this.auth.requireCashierWorkspace()
    return (await this.remoteRecords()).find(
      (record) =>
        record.account.id === accountId &&
        record.contractId === contractId &&
        record.account.branch !== user.branch
    )
  }

  async remoteWorkspace(accountId: string): Promise<InstallmentPaymentWorkspace | undefined> {
    const user = this.auth.requireCashierWorkspace()
    const record = (await this.remoteRecords()).find(
      (item) => item.account.id === accountId && item.account.branch !== user.branch
    )
    if (!record) return undefined
    const collections = this.db
      .prepare(
        `SELECT collection.id, collection.schedule_id, collection.payment_date,
                collection.amount_centavos, collection.penalty_centavos, collection.payment_method,
                collection.reference_number, collection.remarks, collection.status, collection.created_at,
                cashier.display_name AS cashier_name
           FROM cross_branch_collections collection
           LEFT JOIN users cashier ON cashier.id = collection.actor_user_id
          WHERE collection.account_id = ? AND collection.contract_id = ? AND collection.collecting_branch = ?
          ORDER BY collection.created_at DESC`
      )
      .all(record.account.id, record.contractId, user.branch) as Array<{
      id: string
      schedule_id?: string
      payment_date: string
      amount_centavos: number
      penalty_centavos: number
      payment_method: PaymentMethodName
      reference_number?: string
      remarks?: string
      status: string
      created_at: string
      cashier_name?: string
    }>
    const cachedWorkspace = await this.remotePaymentWorkspace?.(
      record.account.branch as GoogleSyncBranch,
      record.contractId
    )
    const generatedSchedules = buildInHouseSchedule(
      record.loan.firstDueDate,
      record.loan.paymentFrequency,
      record.loan.terms,
      Math.round((record.meta.grandTotal ?? record.loan.grandTotal) * 100)
    )
    const fallbackSchedules = generatedSchedules.map((schedule) => ({
      id: `${record.contractId}-schedule-${schedule.installmentNumber}`,
      installmentNumber: schedule.installmentNumber,
      dueDate: schedule.dueDate,
      remainingDueCentavos: schedule.dueAmountCentavos,
      dueAmountCentavos: schedule.dueAmountCentavos,
      paidAmountCentavos: 0,
      balanceCentavos: schedule.dueAmountCentavos,
      penaltyCentavos: 0,
      status: 'DUE' as const,
      isService: false,
      isAdjusted: false
    }))
    const confirmedEvents = new Set(
      cachedWorkspace?.payments.flatMap((payment) => [
        payment.sourceSubmissionId,
        ...payment.paymentIds
      ]) ?? []
    )
    const localCollections = collections.filter((payment) => !confirmedEvents.has(payment.id))
    const installmentNumber = (scheduleId?: string): number | undefined => {
      const match = scheduleId?.match(/-schedule-(\d+)$/)
      return match ? Number(match[1]) : undefined
    }
    const schedules = (cachedWorkspace?.schedules ?? fallbackSchedules).map((schedule) =>
      localCollections.some(
        (payment) =>
          payment.status === 'PENDING' &&
          installmentNumber(payment.schedule_id) === schedule.installmentNumber
      )
        ? { ...schedule, status: 'PENDING' as const }
        : schedule
    )
    const relayPayments = localCollections.map((payment) => {
      const scheduleNumber = installmentNumber(payment.schedule_id)
      const schedule = schedules.find((item) => item.installmentNumber === scheduleNumber)
      return {
        id: payment.id,
        paymentDate: payment.payment_date,
        amountCentavos: payment.amount_centavos,
        paymentMethod: payment.payment_method,
        penaltyCentavos: payment.penalty_centavos,
        allocatedAmountCentavos: 0,
        referenceNumber: payment.reference_number,
        remarks:
          payment.status === 'PENDING'
            ? `${payment.remarks ?? ''} (Awaiting owner branch sync)`.trim()
            : payment.status === 'REVIEW'
              ? `${payment.remarks ?? ''} (Owner branch review required)`.trim()
              : payment.remarks,
        status:
          payment.status === 'PENDING'
            ? ('PENDING' as const)
            : payment.status === 'VOIDED' || payment.status === 'REJECTED'
              ? ('VOIDED' as const)
              : ('POSTED' as const),
        isAdjustment: false,
        createdAt: payment.created_at,
        paymentIds: [payment.id],
        updatedByName: payment.cashier_name,
        scheduleIds: schedule ? [schedule.id] : []
      }
    })
    return {
      ...(cachedWorkspace ?? {
        account: record.account,
        loan: record.loan,
        accountStatus: record.accountStatus,
        contractId: record.contractId,
        contractNumber: record.contractId,
        contractStatus: record.contractStatus,
        paymentFrequency: record.loan.paymentFrequency,
        installmentAmountCentavos: Math.round(record.loan.installmentAmount * 100),
        totalPayableCentavos: Math.round((record.meta.grandTotal ?? record.loan.grandTotal) * 100),
        totalPaidCentavos: Math.round((record.meta.totalPaid ?? 0) * 100),
        outstandingBalanceCentavos: Math.round((record.meta.outstandingBalance ?? 0) * 100)
      }),
      schedules,
      payments: [...(cachedWorkspace?.payments ?? []), ...relayPayments].sort(
        (a, b) =>
          a.paymentDate.localeCompare(b.paymentDate) || a.createdAt.localeCompare(b.createdAt)
      )
    }
  }

  async createCollection(request: InstallmentCreatePaymentRequest): Promise<void> {
    const user = this.auth.requireCashierWorkspace()
    if (
      !Number.isSafeInteger(request.amountCentavos) ||
      !Number.isSafeInteger(request.penaltyCentavos) ||
      !isBusinessDate(request.paymentDate)
    )
      throw new AppError('VALIDATION_ERROR', 'Payment amount is invalid.')
    const record = await this.remoteRecord(request.accountId, request.contractId)
    if (!record || record.contractStatus !== 'ACTIVE' || record.accountStatus !== 'ACTIVE')
      throw new AppError('CONFLICT', 'This account is not available for cross-branch payment.')
    const cachedWorkspace = await this.remotePaymentWorkspace?.(
      record.account.branch as GoogleSyncBranch,
      record.contractId
    )
    const scheduleNumber =
      cachedWorkspace?.schedules.find((item) => item.id === request.scheduleId)
        ?.installmentNumber ??
      buildInHouseSchedule(
        record.loan.firstDueDate,
        record.loan.paymentFrequency,
        record.loan.terms,
        Math.round((record.meta.grandTotal ?? record.loan.grandTotal) * 100)
      ).find(
        (item) => `${record.contractId}-schedule-${item.installmentNumber}` === request.scheduleId
      )?.installmentNumber
    if (request.scheduleId && scheduleNumber === undefined)
      throw new AppError('VALIDATION_ERROR', 'The selected installment could not be verified.')
    const relayScheduleId = scheduleNumber
      ? `${record.contractId}-schedule-${scheduleNumber}`
      : null
    const ownerBranch = record.account.branch
    if (!branches.includes(ownerBranch as (typeof branches)[number]))
      throw new AppError('VALIDATION_ERROR', 'The account branch could not be verified.')
    const eventId = request.submissionId
    const now = new Date().toISOString()
    const insert = this.db.transaction(() => {
      const existing = this.db
        .prepare(
          'SELECT contract_id, schedule_id, amount_centavos, penalty_centavos, payment_date, payment_method FROM cross_branch_collections WHERE id = ?'
        )
        .get(eventId) as
        | {
            contract_id: string
            schedule_id: string | null
            amount_centavos: number
            penalty_centavos: number
            payment_date: string
            payment_method: string
          }
        | undefined
      if (existing) {
        if (
          existing.contract_id !== request.contractId ||
          existing.schedule_id !== relayScheduleId ||
          existing.amount_centavos !== request.amountCentavos ||
          existing.penalty_centavos !== request.penaltyCentavos ||
          existing.payment_date !== request.paymentDate ||
          existing.payment_method !== request.paymentMethod
        )
          throw new AppError('CONFLICT', 'This payment submission was already used.')
        return
      }
      const branch = this.db
        .prepare('SELECT id FROM branches WHERE name = ? COLLATE NOCASE')
        .get(user.branch) as { id: string } | undefined
      if (!branch) throw new AppError('NOT_FOUND', 'Your branch could not be verified.')
      let report = this.db
        .prepare('SELECT id FROM daily_reports WHERE branch_id = ? AND business_date = ?')
        .get(branch.id, request.paymentDate) as { id: string } | undefined
      if (!report) {
        const id = randomUUID()
        this.db
          .prepare(
            `INSERT INTO daily_reports (id, branch_id, cashier_user_id, business_date, opening_cash_centavos, updated_by_user_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, 0, ?, ?, ?)`
          )
          .run(id, branch.id, user.id, request.paymentDate, user.id, now, now)
        this.db
          .prepare(
            `INSERT OR IGNORE INTO reports (id, branch_id, cashier_id, business_date, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'Draft', ?, ?)`
          )
          .run(id, branch.id, user.id, request.paymentDate, now, now)
        report = { id }
      }
      this.db
        .prepare(
          `INSERT OR IGNORE INTO reports
        (id, branch_id, cashier_id, business_date, status, created_at, updated_at)
        SELECT id, branch_id, cashier_user_id, business_date, 'Draft', created_at, updated_at
          FROM daily_reports WHERE id = ?`
        )
        .run(report.id)
      const payload = {
        eventId,
        ownerBranch,
        collectingBranch: user.branch,
        accountId: record.account.id,
        contractId: record.contractId,
        scheduleNumber,
        cashierName: user.displayName,
        paymentDate: request.paymentDate,
        amountCentavos: request.amountCentavos,
        penaltyCentavos: request.penaltyCentavos,
        paymentMethod: request.paymentMethod,
        referenceNumber: request.referenceNumber,
        remarks: request.remarks
      }
      this.db
        .prepare(
          `INSERT INTO cross_branch_collections
        (id, owner_branch, collecting_branch, account_id, account_name, contract_id, daily_report_id, schedule_id, payment_date,
         amount_centavos, penalty_centavos, payment_method, reference_number, remarks, actor_user_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          eventId,
          ownerBranch,
          user.branch,
          record.account.id,
          [
            record.account.firstName,
            record.account.middleName,
            record.account.lastName,
            record.account.suffix
          ]
            .filter(Boolean)
            .join(' '),
          record.contractId,
          report.id,
          relayScheduleId,
          request.paymentDate,
          request.amountCentavos,
          request.penaltyCentavos,
          request.paymentMethod,
          request.referenceNumber || null,
          request.remarks || null,
          user.id,
          now,
          now
        )
      this.db
        .prepare(
          `INSERT INTO cross_branch_relay_outbox (event_id, collection_id, event_type, payload_json, created_at)
        VALUES (?, ?, 'PAYMENT', ?, ?)`
        )
        .run(eventId, eventId, JSON.stringify(payload), now)
      if (request.paymentMethod === 'GCash')
        recordGcashDrawing(this.db, {
          branchId: branch.id,
          businessDate: request.paymentDate,
          amountCentavos: request.amountCentavos + request.penaltyCentavos,
          actorUserId: user.id,
          reference: `cross-branch:${eventId}`,
          description: `GCash-${[record.account.firstName, record.account.middleName, record.account.lastName, record.account.suffix].filter(Boolean).join(' ')}`,
          receiptNo: request.referenceNumber
        })
    })
    insert()
    void this.sync().catch(() => undefined)
  }

  async publishOwnerUpdate(
    paymentId: string,
    type: 'ADJUSTMENT' | 'VOID',
    details: Record<string, unknown>
  ): Promise<void> {
    const user = this.auth.requireCashierWorkspace()
    const source = this.installments.relayInfoForPayment(paymentId)
    if (!source) return
    const eventId = randomUUID()
    const now = new Date().toISOString()
    const payload = {
      ...details,
      sourceEventId: source.eventId,
      ownerBranch: user.branch,
      collectingBranch: source.collectingBranch
    }
    this.db
      .prepare(
        `INSERT INTO cross_branch_relay_outbox
          (event_id, collection_id, event_type, payload_json, created_at)
         VALUES (?, NULL, ?, ?, ?)`
      )
      .run(eventId, type, JSON.stringify(payload), now)
    void this.sync().catch(() => undefined)
  }

  async sync(): Promise<void> {
    const user = this.auth.requireCashierWorkspace()
    const spreadsheetId = googleSheetSources.credentials
    await this.sheets.ensureTabs(spreadsheetId, [sheetName])
    let rows = await this.sheets.values(spreadsheetId, `${sheetName}!A:G`)
    if (!rows.length) {
      await this.sheets.updateValues(spreadsheetId, `${sheetName}!A1:G1`, [headers])
      rows = [headers]
    }
    const known = new Set(
      rows
        .slice(1)
        .map((row) => row[0])
        .filter(Boolean)
    )
    const pending = this.db
      .prepare(
        `SELECT event_id, event_type, payload_json, created_at
      FROM cross_branch_relay_outbox WHERE sent_at IS NULL ORDER BY created_at LIMIT 100`
      )
      .all() as Array<{
      event_id: string
      event_type: string
      payload_json: string
      created_at: string
    }>
    for (const event of pending) {
      const payload = JSON.parse(event.payload_json) as {
        ownerBranch: string
        collectingBranch: string
      }
      if (!known.has(event.event_id))
        await this.sheets.appendValues(spreadsheetId, `${sheetName}!A:G`, [
          [
            event.event_id,
            '1',
            event.event_type,
            payload.ownerBranch,
            payload.collectingBranch,
            event.payload_json,
            event.created_at
          ]
        ])
      this.db
        .prepare(
          'UPDATE cross_branch_relay_outbox SET sent_at = ?, attempts = attempts + 1, last_error = NULL WHERE event_id = ?'
        )
        .run(new Date().toISOString(), event.event_id)
    }
    rows = await this.sheets.values(spreadsheetId, `${sheetName}!A:G`)
    const relayRows = rows.slice(1)
    const acknowledged = new Set(
      relayRows
        .filter((row) => row[2] === 'ACK')
        .map((row) => {
          try {
            return (JSON.parse(row[5] || '{}') as { sourceEventId?: string }).sourceEventId
          } catch {
            return undefined
          }
        })
        .filter(Boolean)
    )
    for (const row of relayRows) {
      if (row[2] !== 'PAYMENT' || row[3] !== user.branch) continue
      let parsed: unknown
      try {
        parsed = JSON.parse(row[5])
      } catch {
        continue
      }
      if (
        !isRelayPayment(parsed) ||
        parsed.eventId !== row[0] ||
        parsed.ownerBranch !== row[3] ||
        parsed.collectingBranch !== row[4]
      )
        continue
      const event = parsed
      const outcome = this.installments.applyRelayedPayment(event)
      if (outcome.receivedNow)
        this.onPaymentReceived?.({
          ...event,
          ownerBranch: event.ownerBranch as GoogleSyncBranch,
          collectingBranch: event.collectingBranch as GoogleSyncBranch,
          accountName: outcome.accountName,
          contractNumber: outcome.contractNumber,
          scheduledDueDate: outcome.scheduledDueDate,
          state: outcome.state,
          message: outcome.message
        })
      if (!acknowledged.has(event.eventId)) {
        const ackId = `ack:${event.eventId}`
        await this.sheets.appendValues(spreadsheetId, `${sheetName}!A:G`, [
          [
            ackId,
            '1',
            'ACK',
            event.ownerBranch,
            event.collectingBranch,
            JSON.stringify({ sourceEventId: event.eventId, ...outcome }),
            new Date().toISOString()
          ]
        ])
        acknowledged.add(event.eventId)
      }
    }
    for (const row of relayRows) {
      if (!['ADJUSTMENT', 'VOID'].includes(row[2]) || row[4] !== user.branch) continue
      let update: Record<string, unknown>
      try {
        update = JSON.parse(row[5]) as Record<string, unknown>
      } catch {
        continue
      }
      if (
        update.ownerBranch !== row[3] ||
        update.collectingBranch !== row[4] ||
        typeof update.sourceEventId !== 'string'
      )
        continue
      const existing = this.db
        .prepare('SELECT event_id FROM cross_branch_relay_received WHERE event_id = ?')
        .get(row[0])
      const now = new Date().toISOString()
      let state: 'APPLIED' | 'REVIEW'
      if (!existing) {
        const applyUpdate = this.db.transaction(() => {
          const collection = this.db
            .prepare(
              'SELECT payment_method, account_name FROM cross_branch_collections WHERE id = ? AND owner_branch = ? AND collecting_branch = ?'
            )
            .get(update.sourceEventId, row[3], user.branch) as
            { payment_method: string; account_name: string } | undefined
          let state: 'APPLIED' | 'REVIEW' = 'REVIEW'
          let message = 'The local collection was not found.'
          if (collection && row[2] === 'VOID') {
            this.db
              .prepare(
                `UPDATE cross_branch_collections SET status = 'VOIDED', updated_at = ? WHERE id = ?`
              )
              .run(now, update.sourceEventId)
            this.db
              .prepare(
                `UPDATE expenses SET status = 'VOIDED', voided_at = ?, void_reason = ?, updated_at = ? WHERE source_reference = ? AND status = 'POSTED'`
              )
              .run(
                now,
                String(update.reason ?? 'Voided at owner branch'),
                now,
                `cross-branch:${update.sourceEventId}`
              )
            state = 'APPLIED'
            message = ''
          } else if (
            collection &&
            row[2] === 'ADJUSTMENT' &&
            Number.isSafeInteger(update.amountCentavos) &&
            Number(update.amountCentavos) > 0 &&
            Number.isSafeInteger(update.penaltyCentavos) &&
            Number(update.penaltyCentavos) >= 0 &&
            isBusinessDate(update.paymentDate) &&
            paymentMethodNameSchema.safeParse(update.paymentMethod).success
          ) {
            const branch = this.db
              .prepare('SELECT id FROM branches WHERE name = ? COLLATE NOCASE')
              .get(user.branch) as { id: string }
            let report = this.db
              .prepare('SELECT id FROM daily_reports WHERE branch_id = ? AND business_date = ?')
              .get(branch.id, update.paymentDate) as { id: string } | undefined
            if (!report) {
              const reportId = randomUUID()
              this.db
                .prepare(
                  `INSERT INTO daily_reports
                (id, branch_id, cashier_user_id, business_date, opening_cash_centavos, updated_by_user_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, 0, ?, ?, ?)`
                )
                .run(reportId, branch.id, user.id, update.paymentDate, user.id, now, now)
              report = { id: reportId }
            }
            this.db
              .prepare(
                `INSERT OR IGNORE INTO reports
              (id, branch_id, cashier_id, business_date, status, created_at, updated_at)
              SELECT id, branch_id, cashier_user_id, business_date, 'Draft', created_at, updated_at
                FROM daily_reports WHERE id = ?`
              )
              .run(report.id)
            this.db
              .prepare(
                `UPDATE cross_branch_collections
              SET daily_report_id = ?, payment_date = ?, amount_centavos = ?, penalty_centavos = ?, payment_method = ?,
                  reference_number = ?, remarks = ?, status = 'APPLIED', updated_at = ?
              WHERE id = ?`
              )
              .run(
                report.id,
                update.paymentDate,
                update.amountCentavos,
                update.penaltyCentavos,
                update.paymentMethod,
                typeof update.referenceNumber === 'string' ? update.referenceNumber : null,
                typeof update.remarks === 'string' ? update.remarks : null,
                now,
                update.sourceEventId
              )
            if (collection.payment_method === 'GCash' && update.paymentMethod !== 'GCash')
              this.db
                .prepare(
                  `UPDATE expenses SET status = 'VOIDED', voided_at = ?, void_reason = 'Payment method changed at owner branch', updated_at = ?
                WHERE source_reference = ? AND status = 'POSTED'`
                )
                .run(now, now, `cross-branch:${update.sourceEventId}`)
            if (update.paymentMethod === 'GCash') {
              recordGcashDrawing(this.db, {
                branchId: branch.id,
                businessDate: String(update.paymentDate),
                amountCentavos: Number(update.amountCentavos) + Number(update.penaltyCentavos),
                actorUserId: user.id,
                reference: `cross-branch:${update.sourceEventId}`,
                description: `GCash-${collection.account_name}`,
                receiptNo:
                  typeof update.referenceNumber === 'string' ? update.referenceNumber : undefined
              })
            }
            state = 'APPLIED'
            message = ''
          }
          this.db
            .prepare(
              `INSERT INTO cross_branch_relay_received
            (event_id, payload_json, state, message, received_at, acknowledged_at)
            VALUES (?, ?, ?, ?, ?, ?)`
            )
            .run(row[0], JSON.stringify(update), state, message || null, now, now)
          return state
        })
        state = applyUpdate()
      } else {
        const received = this.db
          .prepare('SELECT state FROM cross_branch_relay_received WHERE event_id = ?')
          .get(row[0]) as { state: 'APPLIED' | 'REVIEW' }
        state = received.state
      }
      if (!acknowledged.has(row[0])) {
        await this.sheets.appendValues(spreadsheetId, `${sheetName}!A:G`, [
          [
            `ack:${row[0]}`,
            '1',
            'ACK',
            row[3],
            row[4],
            JSON.stringify({ sourceEventId: row[0], state }),
            now
          ]
        ])
        acknowledged.add(row[0])
      }
    }
    for (const row of relayRows) {
      if (row[2] !== 'ACK' || row[4] !== user.branch) continue
      try {
        const ack = JSON.parse(row[5] || '{}') as { sourceEventId?: string; state?: string }
        if (ack.sourceEventId && ['APPLIED', 'REVIEW', 'REJECTED'].includes(ack.state ?? ''))
          this.db
            .prepare('UPDATE cross_branch_collections SET status = ?, updated_at = ? WHERE id = ?')
            .run(ack.state, new Date().toISOString(), ack.sourceEventId)
      } catch {
        /* Ignore malformed relay rows; owner-side validation remains authoritative. */
      }
    }
  }
}
