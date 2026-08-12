import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'

import type {
  InstallmentAdjustPaymentRequest,
  InstallmentAccountRecord,
  InstallmentAccountStatus,
  InstallmentBootstrapRequest,
  InstallmentCreatePaymentRequest,
  InstallmentListRequest,
  InstallmentPaymentWorkspace,
  InstallmentPaymentWorkspaceRequest,
  InstallmentHistoryRecord,
  InstallmentHistoryRequest,
  InstallmentTransitionRequest
} from '../../shared/contracts'
import { AppError } from './errors'
import { buildInHouseSchedule } from '../services/in-house-schedule'

type ContractRow = {
  account_id: string
  account_number: string
  branch_name: string
  last_name: string
  first_name: string
  middle_name?: string
  suffix?: string
  street_subdivision?: string
  landmark_remarks?: string
  latitude?: number
  longitude?: number
  barangay: string
  city_municipality: string
  province: string
  occupation?: string
  civil_status?: string
  agent?: string
  referred_by?: string
  account_status: 'ACTIVE' | 'BLACKLISTED'
  blacklisted_at?: string
  blacklist_reason?: string
  account_created_at: string
  account_updated_at: string
  contract_id: string
  contract_status: InstallmentAccountRecord['contractStatus']
  contract_date: string
  date_released: string
  start_date: string
  first_due_date: string
  payment_frequency: string
  terms: string
  principal_centavos: number
  interest_centavos: number
  down_payment_centavos: number
  fees_centavos: number
  installment_amount_centavos: number
  total_payable_centavos: number
  remarks?: string
  contract_created_at: string
  contract_updated_at: string
  total_paid_centavos: number
  last_payment_date?: string
}

type ScheduleRow = {
  id: string
  installment_number: number
  due_date: string
  due_amount_centavos: number
  paid_amount_centavos: number
  status: 'DUE' | 'PARTIALLY_PAID' | 'PAID' | 'WAIVED'
  is_adjusted: number
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

function optionalString(value: unknown): string | undefined {
  const result = stringValue(value)
  return result || undefined
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || 0
}

function centavos(value: unknown): number {
  return Math.max(0, Math.round(numberValue(value) * 100))
}

function dateValue(value: unknown, fallback: string): string {
  const result = stringValue(value, fallback)
  return result.length >= 10 ? result.slice(0, 10) : fallback
}

function branchId(branch: string): string {
  return `branch-${branch.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

function branchCode(branch: string): string {
  return branch.slice(0, 3).toUpperCase()
}

function toMeta(row: ContractRow): InstallmentAccountRecord['meta'] {
  const totalPaid = row.total_paid_centavos / 100
  const totalPayable = row.total_payable_centavos / 100
  const outstanding = Math.max(0, totalPayable - totalPaid)
  let status: InstallmentAccountRecord['meta']['status'] = 'active'

  if (row.account_status === 'BLACKLISTED') status = 'blacklisted'
  else if (row.contract_status === 'CLOSED') status = 'closed'
  else if (totalPayable > 0 && outstanding === 0) status = 'fully-paid'
  else if (row.first_due_date) {
    const today = new Date().toISOString().slice(0, 10)
    const due = new Date(`${row.first_due_date}T00:00:00Z`).getTime()
    const now = new Date(`${today}T00:00:00Z`).getTime()
    const days = Math.round((due - now) / 86_400_000)
    if (days < 0) status = 'overdue'
    else if (days === 0) status = 'due-today'
    else if (days <= 7) status = 'due-soon'
  }

  return {
    status,
    nextDue: row.first_due_date || undefined,
    outstandingBalance: outstanding,
    paymentFrequency: row.payment_frequency,
    lastPayment: row.last_payment_date,
    terms: row.terms,
    installmentAmount: row.installment_amount_centavos / 100,
    dateReleased: row.date_released,
    startDate: row.start_date,
    grandTotal: totalPayable,
    principal: row.principal_centavos / 100,
    interest: row.interest_centavos / 100,
    totalInterest: row.interest_centavos / 100,
    downPayment: row.down_payment_centavos / 100,
    requiredFee: row.fees_centavos / 100,
    totalPaid
  }
}

export class InstallmentRepository {
  constructor(private readonly db: Database.Database) {}

  list(request: InstallmentListRequest): { rows: InstallmentAccountRecord[] } {
    const where = ["c.status != 'VOIDED'"]
    const params: Record<string, string> = {}
    if (request.view === 'active') {
      where.push("c.status = 'ACTIVE'", "a.status = 'ACTIVE'")
    } else if (request.view === 'closed') where.push("c.status = 'CLOSED'")
    else if (request.view === 'blacklisted') where.push("a.status = 'BLACKLISTED'")
    if (request.branch) {
      where.push('b.name = @branch')
      params.branch = request.branch
    }
    if (request.search) {
      where.push(
        '(a.account_number LIKE @search OR a.first_name LIKE @search OR a.last_name LIKE @search)'
      )
      params.search = `%${request.search}%`
    }

    const rows = this.db
      .prepare(
        `SELECT a.id AS account_id, a.account_number, b.name AS branch_name,
                a.last_name, a.first_name, a.middle_name, a.suffix, a.street_subdivision, a.landmark_remarks,
                a.latitude, a.longitude, a.barangay, a.city_municipality, a.province, a.occupation, a.civil_status, a.agent,
                a.referred_by, a.status AS account_status, a.blacklisted_at,
                a.blacklist_reason, a.created_at AS account_created_at,
                a.updated_at AS account_updated_at, c.id AS contract_id,
                c.status AS contract_status, c.contract_date, c.date_released,
                c.start_date, c.first_due_date,
                COALESCE(NULLIF(c.schedule_frequency, ''), c.payment_frequency) AS payment_frequency, c.terms,
                c.principal_centavos, c.interest_centavos, c.down_payment_centavos,
                c.fees_centavos, c.installment_amount_centavos, c.total_payable_centavos,
                c.remarks, c.created_at AS contract_created_at,
                c.updated_at AS contract_updated_at,
                COALESCE(SUM(CASE WHEN p.status = 'POSTED' THEN pa.allocated_amount_centavos ELSE 0 END), 0)
                  AS total_paid_centavos,
                MAX(CASE WHEN p.status = 'POSTED' THEN p.payment_date END) AS last_payment_date
           FROM accounts a
           JOIN installment_contracts c ON c.account_id = a.id
           JOIN branches b ON b.id = c.branch_id
           LEFT JOIN in_house_payments p ON p.contract_id = c.id
           LEFT JOIN installment_payment_allocations pa ON pa.payment_id = p.id
          WHERE ${where.join(' AND ')}
          GROUP BY c.id
          ORDER BY a.last_name COLLATE NOCASE, a.first_name COLLATE NOCASE, c.contract_date DESC`
      )
      .all(params) as ContractRow[]

    return { rows: rows.map((row) => this.toRecord(row)) }
  }

  bootstrap(request: InstallmentBootstrapRequest): void {
    const now = new Date().toISOString()
    const bootstrap = this.db.transaction(() => {
      const insertBranch = this.db.prepare(
        `INSERT OR IGNORE INTO branches (id, code, name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      const findBranch = this.db.prepare(
        'SELECT id FROM branches WHERE name = ? COLLATE NOCASE LIMIT 1'
      )
      const insertAccount = this.db.prepare(
        `INSERT OR IGNORE INTO accounts
          (id, account_number, display_name, last_name, first_name, middle_name, suffix,
           street_subdivision, latitude, longitude, landmark_remarks, barangay, city_municipality, province, occupation, civil_status, agent,
           referred_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      const updateAccount = this.db.prepare(
        `UPDATE accounts SET display_name = ?, last_name = ?, first_name = ?, middle_name = ?,
          suffix = ?, street_subdivision = ?, latitude = ?, longitude = ?, landmark_remarks = ?, barangay = ?, city_municipality = ?, province = ?,
          occupation = ?, civil_status = ?, agent = ?, referred_by = ?, updated_at = ? WHERE id = ?`
      )
      const insertContact = this.db.prepare(
        `INSERT OR IGNORE INTO account_contacts
          (id, account_id, contact_type, contact_kind, contact_value, is_primary, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      const deleteContacts = this.db.prepare('DELETE FROM account_contacts WHERE account_id = ?')
      const insertContract = this.db.prepare(
        `INSERT OR IGNORE INTO installment_contracts
          (id, account_id, branch_id, installment_type_id, contract_number, contract_date,
            date_released, start_date, first_due_date, payment_frequency, schedule_frequency, terms,
           principal_centavos, interest_centavos, down_payment_centavos, fees_centavos,
           installment_amount_centavos, financed_amount_centavos, total_payable_centavos,
           remarks, created_at, updated_at)
         VALUES (?, ?, ?, 'installment-type-in-house', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      const insertItem = this.db.prepare(
        `INSERT OR IGNORE INTO installment_items
          (id, contract_id, description, quantity, unit_price_centavos, item_total_centavos, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )

      const loansByCustomer = new Map<string, Record<string, unknown>[]>()
      for (const loan of request.loans) {
        const customerId = stringValue(loan.customerId)
        if (!customerId) continue
        loansByCustomer.set(customerId, [...(loansByCustomer.get(customerId) ?? []), loan])
      }

      for (const account of request.accounts) {
        const id = stringValue(account.id)
        const branch = stringValue(account.branch, 'Lagonoy')
        if (!id) continue
        const accountCreatedAt = stringValue(account.createdAt, now)
        insertBranch.run(branchId(branch), branchCode(branch), branch, accountCreatedAt, now)
        const persistedBranch = findBranch.get(branch) as { id: string } | undefined
        if (!persistedBranch)
          throw new AppError('DATABASE_ERROR', 'Account branch could not be created.')
        const firstName = stringValue(account.firstName)
        const lastName = stringValue(account.lastName)
        const displayName = `${lastName}, ${firstName}`.replace(/^,\s*/, '')
        const values = [
          id,
          id,
          displayName,
          lastName,
          firstName,
          optionalString(account.middleName) ?? null,
          optionalString(account.suffix) ?? null,
          optionalString(account.streetSubdivision) ?? null,
          typeof account.latitude === 'number' ? account.latitude : null,
          typeof account.longitude === 'number' ? account.longitude : null,
          optionalString(account.landmarkRemarks) ?? null,
          stringValue(account.barangay),
          stringValue(account.cityMunicipality),
          stringValue(account.province),
          optionalString(account.occupation) ?? null,
          optionalString(account.civilStatus) ?? null,
          optionalString(account.agent) ?? null,
          optionalString(account.referredBy) ?? null,
          accountCreatedAt,
          now
        ]
        insertAccount.run(...values)
        updateAccount.run(...values.slice(2, 18), now, id)
        deleteContacts.run(id)

        const contacts = Array.isArray(account.contacts) ? account.contacts : []
        for (const contact of contacts) {
          const value = stringValue((contact as Record<string, unknown>).value)
          if (!value) continue
          const kind = stringValue((contact as Record<string, unknown>).kind, 'mobile')
          insertContact.run(
            stringValue((contact as Record<string, unknown>).id, randomUUID()),
            id,
            'PHONE',
            kind,
            value,
            (contact as Record<string, unknown>).isPrimary ? 1 : 0,
            accountCreatedAt,
            now
          )
        }
        const emails = Array.isArray(account.emails) ? account.emails : []
        for (const email of emails) {
          const value = stringValue((email as Record<string, unknown>).value)
          if (!value) continue
          insertContact.run(
            stringValue((email as Record<string, unknown>).id, randomUUID()),
            id,
            'EMAIL',
            'email',
            value,
            (email as Record<string, unknown>).isPrimary ? 1 : 0,
            accountCreatedAt,
            now
          )
        }

        const loans = loansByCustomer.get(id) ?? []
        const sourceLoans = loans.length ? loans : [{ id: `contract-${id}` }]
        for (const loan of sourceLoans) {
          const loanId = stringValue(loan.id, randomUUID())
          const released = dateValue(loan.dateReleased, accountCreatedAt.slice(0, 10))
          const startDate = dateValue(loan.startDate, released)
          const firstDueDate = dateValue(loan.firstDueDate, startDate)
          const paymentFrequency = stringValue(loan.paymentFrequency, 'Monthly')
          const legacyPaymentFrequency =
            paymentFrequency === 'Daily' || paymentFrequency === 'Semi-monthly'
              ? 'Monthly'
              : paymentFrequency
          const terms = stringValue(loan.terms, '1 month')
          const principal = centavos(loan.principal)
          const interest = centavos(loan.interest)
          const downPayment = centavos(loan.downPayment)
          const fees = centavos(loan.fees)
          const installmentAmount = centavos(loan.installmentAmount)
          const grandTotal = centavos(loan.grandTotal)
          insertContract.run(
            loanId,
            id,
            persistedBranch.id,
            loanId,
            released,
            released,
            startDate,
            firstDueDate,
            legacyPaymentFrequency,
            paymentFrequency,
            terms,
            principal,
            interest,
            downPayment,
            fees,
            installmentAmount,
            Math.max(0, grandTotal - downPayment),
            grandTotal,
            optionalString(loan.remarks) ?? null,
            stringValue(loan.createdAt, accountCreatedAt),
            now
          )
          const items = Array.isArray(loan.items) ? loan.items : []
          for (const item of items) {
            const itemRecord = item as Record<string, unknown>
            const quantity = Math.max(1, Math.round(numberValue(itemRecord.quantity)))
            const price = centavos(itemRecord.price)
            insertItem.run(
              stringValue(itemRecord.id, randomUUID()),
              loanId,
              stringValue(itemRecord.name, 'Item'),
              quantity,
              price,
              quantity * price,
              now,
              now
            )
          }
          this.ensureSchedules(
            loanId,
            firstDueDate,
            paymentFrequency,
            terms,
            Math.max(0, grandTotal)
          )
        }
      }
    })
    bootstrap()
  }

  closeContract(request: InstallmentTransitionRequest): void {
    const now = new Date().toISOString()
    const transition = this.db.transaction(() => {
      const contract = this.db
        .prepare(
          `SELECT c.id, c.account_id, c.status, c.total_payable_centavos,
                  COALESCE(SUM(CASE WHEN p.status = 'POSTED' THEN pa.allocated_amount_centavos ELSE 0 END), 0) AS paid
             FROM installment_contracts c
             LEFT JOIN in_house_payments p ON p.contract_id = c.id
             LEFT JOIN installment_payment_allocations pa ON pa.payment_id = p.id
            WHERE c.account_id = ? AND (? IS NULL OR c.id = ?)
            GROUP BY c.id
            ORDER BY c.created_at DESC
            LIMIT 1`
        )
        .get(request.accountId, request.contractId ?? null, request.contractId ?? null) as
        | {
            id: string
            account_id: string
            status: string
            total_payable_centavos: number
            paid: number
          }
        | undefined
      if (!contract) throw new AppError('NOT_FOUND', 'Installment contract was not found.')
      if (contract.status !== 'ACTIVE')
        throw new AppError('CONFLICT', 'Only active contracts can be closed.')
      if (contract.paid < contract.total_payable_centavos)
        throw new AppError('CONFLICT', 'The contract must have a zero balance before closing.')

      this.db
        .prepare(
          `UPDATE installment_contracts
              SET status = 'CLOSED', closed_at = ?, closed_by_user_id = ?, close_reason = ?, updated_at = ?
            WHERE id = ?`
        )
        .run(now, request.actorUserId, request.remarks, now, contract.id)
      this.writeAudit(
        request.actorUserId,
        'installment_contract',
        contract.id,
        request.remarks,
        'ACTIVE',
        'CLOSED',
        now
      )
      this.db
        .prepare(
          `INSERT INTO installment_activity_history
            (id, contract_id, actor_user_id, action, activity, created_at)
           VALUES (?, ?, ?, 'STATUS_CHANGE', 'Contract closed', ?)`
        )
        .run(randomUUID(), contract.id, request.actorUserId, now)
    })
    transition()
  }

  blacklistAccount(request: InstallmentTransitionRequest): void {
    const now = new Date().toISOString()
    const transition = this.db.transaction(() => {
      const account = this.db
        .prepare('SELECT status FROM accounts WHERE id = ?')
        .get(request.accountId) as { status: string } | undefined
      if (!account) throw new AppError('NOT_FOUND', 'Account was not found.')
      if (account.status === 'BLACKLISTED')
        throw new AppError('CONFLICT', 'Account is already blacklisted.')
      this.db
        .prepare(
          `UPDATE accounts
              SET status = 'BLACKLISTED', blacklisted_at = ?, blacklisted_by_user_id = ?,
                  blacklist_reason = ?, updated_at = ?
            WHERE id = ?`
        )
        .run(now, request.actorUserId, request.remarks, now, request.accountId)
      this.writeAudit(
        request.actorUserId,
        'account',
        request.accountId,
        request.remarks,
        'ACTIVE',
        'BLACKLISTED',
        now
      )
    })
    transition()
  }

  voidContracts(contractIds: readonly string[], actorUserId: string): void {
    const now = new Date().toISOString()
    const remove = this.db.transaction(() => {
      const findContract = this.db.prepare('SELECT status FROM installment_contracts WHERE id = ?')
      const voidContract = this.db.prepare(
        `UPDATE installment_contracts
            SET status = 'VOIDED', closed_at = ?, closed_by_user_id = ?,
                close_reason = 'Deleted by administrator', updated_at = ?
          WHERE id = ?`
      )
      for (const contractId of contractIds) {
        const contract = findContract.get(contractId) as { status: string } | undefined
        if (!contract) throw new AppError('NOT_FOUND', 'Installment contract was not found.')
        if (contract.status === 'VOIDED')
          throw new AppError('CONFLICT', 'Installment contract was already deleted.')
        voidContract.run(now, actorUserId, now, contractId)
        this.writeAudit(
          actorUserId,
          'installment_contract',
          contractId,
          'Deleted by administrator',
          contract.status,
          'VOIDED',
          now
        )
      }
    })
    remove()
  }

  getPaymentWorkspace(request: InstallmentPaymentWorkspaceRequest): InstallmentPaymentWorkspace {
    const records = this.list({ view: 'records', search: '' }).rows.filter(
      (record) => record.account.id === request.accountId
    )
    const record = records.find((item) => item.contractStatus === 'ACTIVE') ?? records[0]
    if (!record) throw new AppError('NOT_FOUND', 'Installment account was not found.')

    const contract = this.db
      .prepare(
        `SELECT contract_number, first_due_date,
                COALESCE(NULLIF(schedule_frequency, ''), payment_frequency) AS payment_frequency,
                terms, total_payable_centavos
           FROM installment_contracts WHERE id = ? AND account_id = ?`
      )
      .get(record.contractId, request.accountId) as
      | {
          contract_number: string
          first_due_date: string
          payment_frequency: string
          terms: string
          total_payable_centavos: number
        }
      | undefined
    if (!contract) throw new AppError('NOT_FOUND', 'Installment contract was not found.')

    this.ensureSchedules(
      record.contractId,
      contract.first_due_date,
      contract.payment_frequency,
      contract.terms,
      contract.total_payable_centavos
    )

    const schedules = this.db
      .prepare(
        `SELECT s.id, s.installment_number, s.due_date, s.due_amount_centavos, s.status,
                COALESCE(SUM(CASE WHEN p.status = 'POSTED' THEN pa.allocated_amount_centavos ELSE 0 END), 0)
                  AS paid_amount_centavos,
                MAX(CASE
                      WHEN p.replaces_payment_id IS NOT NULL
                        OR (p.status = 'VOIDED' AND p.void_reason IS NOT NULL)
                      THEN 1
                      ELSE 0
                    END) AS is_adjusted
           FROM in_house_schedules s
           LEFT JOIN installment_payment_allocations pa ON pa.schedule_id = s.id
           LEFT JOIN in_house_payments p ON p.id = pa.payment_id
          WHERE s.contract_id = ?
          GROUP BY s.id
          ORDER BY s.installment_number`
      )
      .all(record.contractId) as ScheduleRow[]
    const payments = this.db
      .prepare(
        `SELECT p.id, p.payment_date, p.amount_centavos, p.reference_number, p.status, p.created_at,
                p.replaces_payment_id IS NOT NULL AS is_adjustment,
                COALESCE(SUM(pa.allocated_amount_centavos), 0) AS allocated_amount_centavos
           FROM in_house_payments p
           LEFT JOIN installment_payment_allocations pa ON pa.payment_id = p.id
          WHERE p.contract_id = ?
          GROUP BY p.id
          ORDER BY p.payment_date DESC, p.created_at DESC`
      )
      .all(record.contractId) as Array<{
      id: string
      payment_date: string
      amount_centavos: number
      allocated_amount_centavos: number
      reference_number?: string
      status: 'POSTED' | 'VOIDED'
      is_adjustment: number
      created_at: string
    }>
    const totalPaidCentavos = schedules.reduce(
      (total, item) => total + item.paid_amount_centavos,
      0
    )
    let runningBalanceCentavos = contract.total_payable_centavos
    const workspaceSchedules = schedules.map((item) => {
      const scheduleRemainingCentavos = Math.max(
        0,
        item.due_amount_centavos - item.paid_amount_centavos
      )
      runningBalanceCentavos = Math.max(0, runningBalanceCentavos - item.paid_amount_centavos)

      return {
        id: item.id,
        installmentNumber: item.installment_number,
        dueDate: item.due_date,
        dueAmountCentavos: item.due_amount_centavos,
        paidAmountCentavos: item.paid_amount_centavos,
        balanceCentavos: runningBalanceCentavos,
        scheduleRemainingCentavos,
        status: item.status,
        isAdjusted: Boolean(item.is_adjusted)
      }
    })
    const next = workspaceSchedules.find(
      (item) =>
        item.status !== 'PAID' && item.status !== 'WAIVED' && item.scheduleRemainingCentavos > 0
    )

    return {
      account: record.account,
      accountStatus: record.accountStatus,
      contractId: record.contractId,
      contractNumber: contract.contract_number,
      contractStatus: record.contractStatus,
      paymentFrequency: record.loan.paymentFrequency,
      installmentAmountCentavos: Math.round((record.meta.installmentAmount ?? 0) * 100),
      totalPayableCentavos: contract.total_payable_centavos,
      totalPaidCentavos,
      outstandingBalanceCentavos: Math.max(0, contract.total_payable_centavos - totalPaidCentavos),
      nextDue: next
        ? {
            dueDate: next.dueDate,
            amountCentavos: next.scheduleRemainingCentavos,
            installmentNumber: next.installmentNumber
          }
        : undefined,
      schedules: workspaceSchedules.map((schedule) => ({
        id: schedule.id,
        installmentNumber: schedule.installmentNumber,
        dueDate: schedule.dueDate,
        dueAmountCentavos: schedule.dueAmountCentavos,
        paidAmountCentavos: schedule.paidAmountCentavos,
        balanceCentavos: schedule.balanceCentavos,
        status: schedule.status,
        isAdjusted: schedule.isAdjusted
      })),
      payments: payments.map((payment) => ({
        id: payment.id,
        paymentDate: payment.payment_date,
        amountCentavos: payment.amount_centavos,
        allocatedAmountCentavos: payment.allocated_amount_centavos,
        referenceNumber: payment.reference_number || undefined,
        status: payment.status,
        isAdjustment: Boolean(payment.is_adjustment),
        createdAt: payment.created_at
      }))
    }
  }

  listHistory(request: InstallmentHistoryRequest): InstallmentHistoryRecord[] {
    const where = [
      request.dateFrom ? 'substr(events.occurred_at, 1, 10) >= @dateFrom' : undefined,
      request.dateTo ? 'substr(events.occurred_at, 1, 10) <= @dateTo' : undefined
    ].filter(Boolean)
    return this.db
      .prepare(
        `WITH events AS (
           SELECT c.id || ':created' AS id, c.created_at AS occurred_at, 'new' AS action,
                  'in-house' AS source, 'Installment record added' AS activity,
                  c.total_payable_centavos AS amount_centavos, c.contract_number AS reference_number,
                  a.id AS account_id, a.account_number, a.display_name AS account_name, b.name AS branch
             FROM installment_contracts c
             JOIN accounts a ON a.id = c.account_id
             JOIN branches b ON b.id = c.branch_id
           UNION ALL
           SELECT p.id, p.payment_date || 'T00:00:00',
                  CASE WHEN p.status = 'VOIDED' THEN 'deleted'
                       WHEN p.replaces_payment_id IS NOT NULL THEN 'edited' ELSE 'new' END,
                  'in-house',
                  CASE WHEN p.status = 'VOIDED' THEN 'Active payment deleted'
                       WHEN p.replaces_payment_id IS NOT NULL THEN 'Active payment edited'
                       ELSE 'Active payment added' END,
                  p.amount_centavos, p.reference_number, a.id, a.account_number,
                  a.display_name, b.name
             FROM in_house_payments p
             JOIN installment_contracts c ON c.id = p.contract_id
             JOIN accounts a ON a.id = c.account_id
             JOIN branches b ON b.id = c.branch_id
           UNION ALL
           SELECT c.id || ':closed', c.closed_at, 'edited', 'in-house',
                  'Installment record closed', c.total_payable_centavos, c.contract_number,
                  a.id, a.account_number, a.display_name, b.name
             FROM installment_contracts c
             JOIN accounts a ON a.id = c.account_id
             JOIN branches b ON b.id = c.branch_id
            WHERE c.closed_at IS NOT NULL
           UNION ALL
           SELECT a.id || ':blacklisted', a.blacklisted_at, 'edited', 'in-house',
                  'Installment record blacklisted', NULL, a.account_number,
                  a.id, a.account_number, a.display_name, b.name
             FROM accounts a
             JOIN installment_contracts c ON c.account_id = a.id
             JOIN branches b ON b.id = c.branch_id
            WHERE a.blacklisted_at IS NOT NULL
           UNION ALL
           SELECT f.id || ':created', f.created_at, 'new', 'finance',
                  'Finance account added', f.grand_total_centavos, COALESCE(f.or_number, f.provider),
                  f.id, f.id, trim(f.first_name || ' ' || f.last_name), f.branch
             FROM finance_accounts f
           UNION ALL
           SELECT f.id || ':updated', f.updated_at, 'edited', 'finance',
                  'Finance account edited', f.grand_total_centavos, COALESCE(f.or_number, f.provider),
                  f.id, f.id, trim(f.first_name || ' ' || f.last_name), f.branch
             FROM finance_accounts f
            WHERE f.updated_at <> f.created_at
         )
         SELECT events.id, events.occurred_at AS occurredAt, events.action, events.source,
                events.activity, events.amount_centavos AS amountCentavos,
                events.reference_number AS referenceNumber, events.account_id AS accountId,
                events.account_number AS accountNumber, events.account_name AS accountName,
                events.branch
           FROM events
          ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
          ORDER BY events.occurred_at DESC, events.id DESC`
      )
      .all(request) as InstallmentHistoryRecord[]
  }

  createPayment(request: InstallmentCreatePaymentRequest): void {
    const now = new Date().toISOString()
    const postPayment = this.db.transaction(() => {
      const existingPayment = this.db
        .prepare(
          `SELECT id FROM in_house_payments
            WHERE contract_id = ? AND submission_id = ?`
        )
        .get(request.contractId, request.submissionId) as { id: string } | undefined
      if (existingPayment) return

      const contract = this.db
        .prepare(
          `SELECT c.id, c.status, c.total_payable_centavos, a.status AS account_status
             FROM installment_contracts c
             JOIN accounts a ON a.id = c.account_id
            WHERE c.id = ? AND c.account_id = ?`
        )
        .get(request.contractId, request.accountId) as
        | {
            id: string
            status: string
            total_payable_centavos: number
            account_status: InstallmentAccountStatus
          }
        | undefined
      if (!contract) throw new AppError('NOT_FOUND', 'Installment contract was not found.')
      if (contract.status !== 'ACTIVE')
        throw new AppError('CONFLICT', 'Payments can only be posted to an active contract.')
      if (contract.account_status !== 'ACTIVE')
        throw new AppError('CONFLICT', 'Payments cannot be posted to a blacklisted account.')

      const schedules = this.db
        .prepare(
          `SELECT s.id, s.due_amount_centavos,
                  COALESCE(SUM(CASE WHEN p.status = 'POSTED' THEN pa.allocated_amount_centavos ELSE 0 END), 0)
                    AS paid_amount_centavos
             FROM in_house_schedules s
             LEFT JOIN installment_payment_allocations pa ON pa.schedule_id = s.id
             LEFT JOIN in_house_payments p ON p.id = pa.payment_id
            WHERE s.contract_id = ? AND s.status != 'WAIVED'
            GROUP BY s.id
            ORDER BY s.due_date, s.installment_number`
        )
        .all(contract.id) as Array<{
        id: string
        due_amount_centavos: number
        paid_amount_centavos: number
      }>
      const targetSchedule = request.scheduleId
        ? schedules.find((schedule) => schedule.id === request.scheduleId)
        : undefined
      if (request.scheduleId && !targetSchedule)
        throw new AppError('NOT_FOUND', 'The selected installment is not available for payment.')
      const available = targetSchedule
        ? Math.max(0, targetSchedule.due_amount_centavos - targetSchedule.paid_amount_centavos)
        : schedules.reduce(
            (total, schedule) =>
              total + Math.max(0, schedule.due_amount_centavos - schedule.paid_amount_centavos),
            0
          )
      if (available <= 0) throw new AppError('CONFLICT', 'This contract has no remaining balance.')
      if (request.amountCentavos > available)
        throw new AppError(
          'VALIDATION_ERROR',
          'Payment amount cannot exceed the remaining balance.'
        )

      const paymentId = randomUUID()
      this.db
        .prepare(
          `INSERT INTO in_house_payments
            (id, contract_id, submission_id, payment_date, amount_centavos, reference_number, received_by_user_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          paymentId,
          contract.id,
          request.submissionId,
          request.paymentDate,
          request.amountCentavos,
          request.referenceNumber || null,
          request.actorUserId,
          now,
          now
        )

      let remaining = request.amountCentavos
      const insertAllocation = this.db.prepare(
        `INSERT INTO installment_payment_allocations
          (id, payment_id, schedule_id, allocated_amount_centavos, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      const updateSchedule = this.db.prepare(
        `UPDATE in_house_schedules SET status = ?, updated_at = ? WHERE id = ?`
      )
      for (const schedule of targetSchedule ? [targetSchedule] : schedules) {
        if (remaining <= 0) break
        const balance = Math.max(0, schedule.due_amount_centavos - schedule.paid_amount_centavos)
        if (balance <= 0) continue
        const allocation = Math.min(balance, remaining)
        insertAllocation.run(randomUUID(), paymentId, schedule.id, allocation, now)
        const settled = schedule.paid_amount_centavos + allocation
        updateSchedule.run(
          settled >= schedule.due_amount_centavos ? 'PAID' : 'PARTIALLY_PAID',
          now,
          schedule.id
        )
        remaining -= allocation
      }
      if (remaining !== 0)
        throw new AppError('DATABASE_ERROR', 'Payment allocation could not be completed.')
      this.db
        .prepare(
          `INSERT INTO installment_activity_history
            (id, contract_id, actor_user_id, action, activity, amount_centavos, created_at)
           VALUES (?, ?, ?, 'PAYMENT_POSTED', 'In-house payment posted', ?, ?)`
        )
        .run(randomUUID(), contract.id, request.actorUserId, request.amountCentavos, now)
    })
    postPayment()
  }

  adjustPayment(request: InstallmentAdjustPaymentRequest): void {
    const now = new Date().toISOString()
    const adjust = this.db.transaction(() => {
      const existingPayment = this.db
        .prepare(
          `SELECT id FROM in_house_payments
            WHERE contract_id = ? AND submission_id = ?`
        )
        .get(request.contractId, request.submissionId) as { id: string } | undefined
      if (existingPayment) return

      const contract = this.db
        .prepare(
          `SELECT c.id, c.status, a.status AS account_status
             FROM installment_contracts c
             JOIN accounts a ON a.id = c.account_id
            WHERE c.id = ? AND c.account_id = ?`
        )
        .get(request.contractId, request.accountId) as
        { id: string; status: string; account_status: InstallmentAccountStatus } | undefined
      if (!contract) throw new AppError('NOT_FOUND', 'Installment contract was not found.')
      if (contract.status !== 'ACTIVE')
        throw new AppError('CONFLICT', 'Payments can only be adjusted on an active contract.')
      if (contract.account_status !== 'ACTIVE')
        throw new AppError('CONFLICT', 'Payments cannot be adjusted on a blacklisted account.')

      const selectedSchedule = this.db
        .prepare(
          `SELECT id, due_amount_centavos
             FROM in_house_schedules
            WHERE id = ? AND contract_id = ? AND status != 'WAIVED'`
        )
        .get(request.scheduleId, contract.id) as
        { id: string; due_amount_centavos: number } | undefined
      if (!selectedSchedule)
        throw new AppError('NOT_FOUND', 'The selected installment is not available for adjustment.')

      const sourcePayments = this.db
        .prepare(
          `SELECT DISTINCT p.id
             FROM in_house_payments p
             JOIN installment_payment_allocations pa ON pa.payment_id = p.id
            WHERE p.contract_id = ? AND pa.schedule_id = ? AND p.status = 'POSTED'
            ORDER BY p.created_at`
        )
        .all(contract.id, selectedSchedule.id) as Array<{ id: string }>
      if (sourcePayments.length === 0)
        throw new AppError('CONFLICT', 'This installment has no posted payment to adjust.')

      const sourcePaymentIds = sourcePayments.map((payment) => payment.id)
      const placeholders = sourcePaymentIds.map(() => '?').join(', ')
      const sourceAllocations = this.db
        .prepare(
          `SELECT p.id AS payment_id, p.payment_date, p.reference_number,
                  pa.schedule_id, pa.allocated_amount_centavos
             FROM in_house_payments p
             JOIN installment_payment_allocations pa ON pa.payment_id = p.id
            WHERE p.id IN (${placeholders})
            ORDER BY p.created_at, pa.created_at`
        )
        .all(...sourcePaymentIds) as Array<{
        payment_id: string
        payment_date: string
        reference_number?: string
        schedule_id: string
        allocated_amount_centavos: number
      }>
      const unaffected = this.db
        .prepare(
          `SELECT COALESCE(SUM(pa.allocated_amount_centavos), 0) AS paid_amount_centavos
             FROM installment_payment_allocations pa
             JOIN in_house_payments p ON p.id = pa.payment_id
            WHERE pa.schedule_id = ? AND p.status = 'POSTED' AND p.id NOT IN (${placeholders})`
        )
        .get(selectedSchedule.id, ...sourcePaymentIds) as { paid_amount_centavos: number }
      const maximum = Math.max(
        0,
        selectedSchedule.due_amount_centavos - unaffected.paid_amount_centavos
      )
      if (request.amountCentavos > maximum)
        throw new AppError(
          'VALIDATION_ERROR',
          'Adjusted payment amount cannot exceed the installment balance.'
        )

      this.db
        .prepare(
          `UPDATE in_house_payments
              SET status = 'VOIDED', voided_at = ?, voided_by_user_id = ?, void_reason = ?, updated_at = ?
            WHERE id IN (${placeholders}) AND status = 'POSTED'`
        )
        .run(now, request.actorUserId, request.reason, now, ...sourcePaymentIds)

      const insertPayment = this.db.prepare(
        `INSERT INTO in_house_payments
          (id, contract_id, submission_id, payment_date, amount_centavos, reference_number,
           received_by_user_id, replaces_payment_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      const insertAllocation = this.db.prepare(
        `INSERT INTO installment_payment_allocations
          (id, payment_id, schedule_id, allocated_amount_centavos, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      let replacementIndex = 0
      const repost = (
        replacesPaymentId: string,
        scheduleId: string,
        amountCentavos: number,
        paymentDate: string,
        referenceNumber?: string
      ): void => {
        if (amountCentavos <= 0) return
        const paymentId = randomUUID()
        replacementIndex += 1
        insertPayment.run(
          paymentId,
          contract.id,
          `${request.submissionId}:${replacementIndex}`,
          paymentDate,
          amountCentavos,
          referenceNumber || null,
          request.actorUserId,
          replacesPaymentId,
          now,
          now
        )
        insertAllocation.run(randomUUID(), paymentId, scheduleId, amountCentavos, now)
      }

      let adjustedRemaining = request.amountCentavos
      for (const allocation of sourceAllocations) {
        if (allocation.schedule_id !== selectedSchedule.id) {
          repost(
            allocation.payment_id,
            allocation.schedule_id,
            allocation.allocated_amount_centavos,
            allocation.payment_date,
            allocation.reference_number
          )
          continue
        }
        const replacementAmount = Math.min(allocation.allocated_amount_centavos, adjustedRemaining)
        repost(
          allocation.payment_id,
          allocation.schedule_id,
          replacementAmount,
          request.paymentDate,
          request.referenceNumber || allocation.reference_number
        )
        adjustedRemaining -= replacementAmount
      }
      if (adjustedRemaining > 0) {
        repost(
          sourcePaymentIds[0],
          selectedSchedule.id,
          adjustedRemaining,
          request.paymentDate,
          request.referenceNumber
        )
      }

      const affectedScheduleIds = [...new Set(sourceAllocations.map((item) => item.schedule_id))]
      const updateSchedule = this.db.prepare(
        `UPDATE in_house_schedules SET status = ?, updated_at = ? WHERE id = ?`
      )
      const paidForSchedule = this.db.prepare(
        `SELECT COALESCE(SUM(CASE WHEN p.id IS NOT NULL THEN pa.allocated_amount_centavos ELSE 0 END), 0) AS paid_amount_centavos,
                s.due_amount_centavos
           FROM in_house_schedules s
           LEFT JOIN installment_payment_allocations pa ON pa.schedule_id = s.id
           LEFT JOIN in_house_payments p ON p.id = pa.payment_id AND p.status = 'POSTED'
          WHERE s.id = ?
          GROUP BY s.id`
      )
      for (const scheduleId of affectedScheduleIds) {
        const paymentState = paidForSchedule.get(scheduleId) as {
          paid_amount_centavos: number
          due_amount_centavos: number
        }
        const status =
          paymentState.paid_amount_centavos <= 0
            ? 'DUE'
            : paymentState.paid_amount_centavos >= paymentState.due_amount_centavos
              ? 'PAID'
              : 'PARTIALLY_PAID'
        updateSchedule.run(status, now, scheduleId)
      }

      this.db
        .prepare(
          `INSERT INTO installment_activity_history
            (id, contract_id, actor_user_id, action, activity, amount_centavos, created_at)
           VALUES (?, ?, ?, 'PAYMENT_ADJUSTED', 'Payment voided and reposted', ?, ?)`
        )
        .run(randomUUID(), contract.id, request.actorUserId, request.amountCentavos, now)
    })
    adjust()
  }

  private ensureSchedules(
    contractId: string,
    firstDueDate: string,
    paymentFrequency: string,
    terms: string,
    totalPayableCentavos: number
  ): void {
    const existing = this.db
      .prepare('SELECT COUNT(*) AS count FROM in_house_schedules WHERE contract_id = ?')
      .get(contractId) as { count: number }
    if (existing.count > 0) return
    const schedules = buildInHouseSchedule(
      firstDueDate,
      paymentFrequency,
      terms,
      totalPayableCentavos
    )
    if (!schedules.length) return
    const now = new Date().toISOString()
    const insert = this.db.prepare(
      `INSERT INTO in_house_schedules
        (id, contract_id, installment_number, due_date, due_amount_centavos, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    for (const schedule of schedules) {
      insert.run(
        randomUUID(),
        contractId,
        schedule.installmentNumber,
        schedule.dueDate,
        schedule.dueAmountCentavos,
        now,
        now
      )
    }
  }

  private writeAudit(
    actorUserId: string,
    entityType: string,
    entityId: string,
    reason: string,
    oldStatus: string,
    newStatus: string,
    now: string
  ): void {
    const auditId = randomUUID()
    this.db
      .prepare(
        `INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, reason, created_at)
         VALUES (?, ?, 'STATUS_CHANGE', ?, ?, ?, ?)`
      )
      .run(auditId, actorUserId, entityType, entityId, reason, now)
    this.db
      .prepare(
        `INSERT INTO audit_log_changes
          (id, audit_log_id, column_name, old_value, new_value)
         VALUES (?, ?, 'status', ?, ?)`
      )
      .run(randomUUID(), auditId, oldStatus, newStatus)
  }

  private toRecord(row: ContractRow): InstallmentAccountRecord {
    const contacts = this.db
      .prepare(
        `SELECT id, contact_kind, contact_value, is_primary
           FROM account_contacts WHERE account_id = ? AND contact_type = 'PHONE'
          ORDER BY is_primary DESC, id`
      )
      .all(row.account_id) as Array<{
      id: string
      contact_kind?: string
      contact_value: string
      is_primary: number
    }>
    const emails = this.db
      .prepare(
        `SELECT id, contact_value, is_primary
           FROM account_contacts WHERE account_id = ? AND contact_type = 'EMAIL'
          ORDER BY is_primary DESC, id`
      )
      .all(row.account_id) as Array<{ id: string; contact_value: string; is_primary: number }>
    const items = this.db
      .prepare(
        `SELECT id, description, quantity, unit_price_centavos
           FROM installment_items WHERE contract_id = ? ORDER BY id`
      )
      .all(row.contract_id) as Array<{
      id: string
      description: string
      quantity: number
      unit_price_centavos: number
    }>

    const account: InstallmentAccountRecord['account'] = {
      id: row.account_id,
      branch: row.branch_name,
      lastName: row.last_name,
      firstName: row.first_name,
      middleName: row.middle_name,
      suffix: row.suffix,
      streetSubdivision: row.street_subdivision,
      landmarkRemarks: row.landmark_remarks,
      latitude: row.latitude,
      longitude: row.longitude,
      barangay: row.barangay,
      cityMunicipality: row.city_municipality,
      province: row.province,
      occupation: row.occupation,
      civilStatus: row.civil_status,
      agent: row.agent,
      referredBy: row.referred_by,
      contacts: contacts.map((contact) => ({
        id: contact.id,
        kind: contact.contact_kind === 'telephone' ? 'telephone' : 'mobile',
        value: contact.contact_value,
        isPrimary: Boolean(contact.is_primary)
      })),
      emails: emails.map((email) => ({
        id: email.id,
        value: email.contact_value,
        isPrimary: Boolean(email.is_primary)
      })),
      createdAt: row.account_created_at,
      updatedAt: row.account_updated_at
    }
    const loan: InstallmentAccountRecord['loan'] = {
      id: row.contract_id,
      customerId: row.account_id,
      dateReleased: row.date_released,
      startDate: row.start_date,
      firstDueDate: row.first_due_date,
      paymentFrequency: row.payment_frequency,
      terms: row.terms,
      principal: row.principal_centavos / 100,
      interest: row.interest_centavos / 100,
      downPayment: row.down_payment_centavos / 100,
      fees: row.fees_centavos / 100,
      installmentAmount: row.installment_amount_centavos / 100,
      grandTotal: row.total_payable_centavos / 100,
      items: items.map((item) => ({
        id: item.id,
        name: item.description,
        quantity: item.quantity,
        price: item.unit_price_centavos / 100
      })),
      remarks: row.remarks,
      createdAt: row.contract_created_at,
      updatedAt: row.contract_updated_at
    }
    return {
      account,
      loan,
      accountStatus: row.account_status,
      contractStatus: row.contract_status,
      contractId: row.contract_id,
      meta: toMeta(row)
    }
  }
}
