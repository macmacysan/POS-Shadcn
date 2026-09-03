import { randomUUID } from 'node:crypto'

import type {
  CashOutEntryRecord,
  DailyReceiptTotalRecord,
  DailyReportCalendarDay,
  DailyReportCalendarRequest,
  DailyReportCashCountRecord,
  DailyReportDeliveryChannel,
  DailyReportDeductionRecord,
  DailyReportPaymentCreateRequest,
  DailyReportPaymentEntryRecord,
  DailyReportPaymentListRequest,
  DailyReportPaymentUpdateRequest,
  DailyReportPaymentVoidRequest,
  DailyReportRecord,
  DailyReportReceiptTypeCreateRequest,
  DailyReportReceiptTypeDeleteRequest,
  DailyReportReceiptTypeDeleteResponse,
  DailyReportReceiptTypeRecord,
  DailyReportResolveActiveRequest,
  DailyReportSummaryUpdateRequest,
  DailyReportSnapshotResponse,
  IncomeCreateRequest,
  IncomeEntryRecord,
  IncomeListRequest,
  IncomeUpdateRequest,
  IncomeVoidRequest
} from '../../shared/contracts'
import { AppError } from './errors'
import type { AppDatabase } from './database'
import { recordAudit } from './audit-repository'

type DailyReportRow = {
  id: string
  branch_id: string
  cashier_user_id: string
  business_date: string
  opening_cash_centavos: number
  cash_remitted_centavos: number | null
  status: DailyReportRecord['status']
  google_drive_submitted_at: string | null
  telegram_submitted_at: string | null
  submitted_at: string | null
  approved_at: string | null
  approved_by_user_id: string | null
  updated_by_user_id: string | null
  updated_by_name?: string | null
  note?: string | null
  created_at: string
  updated_at: string
}

type IncomeRow = {
  id: string
  daily_report_id: string
  branch: string
  category_id: string
  transaction_date: string
  particular: string
  receipt_number: string | null
  remarks: string | null
  amount_centavos: number
  status: IncomeEntryRecord['status']
  voided_at: string | null
  voided_by_user_id: string | null
  void_reason: string | null
  created_by_user_id: string
  created_by_name: string
  created_by_first_name: string
  created_at: string
  updated_at: string
  source: 'local' | 'google-cache'
}

type PaymentRow = {
  id: string
  daily_report_id: string
  branch: string
  payment_method_id: string
  payment_method_name: string
  transaction_date: string
  amount_centavos: number
  reference_number: string | null
  bank_name: string | null
  payer_name: string | null
  remarks: string | null
  status: DailyReportPaymentEntryRecord['status']
  voided_at: string | null
  voided_by_user_id: string | null
  void_reason: string | null
  created_by_user_id: string
  created_by_name: string
  created_by_first_name: string
  created_at: string
  updated_at: string
  source: 'local' | 'google-cache'
}

type ReceiptTotalRow = {
  id: string
  daily_report_id: string
  receipt_type_id: string
  receipt_name: string
  receipt_short_name: string
  quantity: number
  amount_centavos: number
  created_at: string
  updated_at: string
}

type CashOutRow = {
  id: string
  daily_report_id: string
  transaction_date: string
  description: string
  amount_centavos: number
  status: CashOutEntryRecord['status']
  voided_at: string | null
  voided_by_user_id: string | null
  void_reason: string | null
  created_by_user_id: string
  created_at: string
  updated_at: string
}

type DeductionRow = {
  id: string
  daily_report_id: string
  deduction_type_id: string
  amount_centavos: number
  created_at: string
  updated_at: string
}

type CashCountRow = {
  id: string
  daily_report_id: string
  denomination_id: string
  quantity: number
  created_at: string
  updated_at: string
}

type ReferenceRow = {
  id: string
  name: string
  sort_order: number
}

type ReceiptTypeReferenceRow = ReferenceRow & {
  short_name: string
  is_default_visible: number
  is_system: number
  is_active: number
}

const receiptTypesHiddenByDefault = new Set([
  'SALES INVOICE',
  'SALES INVOICE - TRADING',
  'DELIVERY RECEIPT',
  'BOBS PAWNSHOP'
])

type DeductionTypeRow = Pick<ReferenceRow, 'id' | 'name'>

type CashDenominationReferenceRow = {
  id: string
  value_centavos: number
  sort_order: number
}

function reportRecord(row: DailyReportRow): DailyReportRecord {
  return {
    id: row.id,
    branchId: row.branch_id,
    cashierUserId: row.cashier_user_id,
    businessDate: row.business_date,
    openingCashCentavos: row.opening_cash_centavos,
    cashRemittedCentavos: row.cash_remitted_centavos,
    status: row.status,
    googleDriveSubmittedAt: row.google_drive_submitted_at,
    telegramSubmittedAt: row.telegram_submitted_at,
    submittedAt: row.submitted_at,
    approvedAt: row.approved_at,
    approvedByUserId: row.approved_by_user_id,
    updatedByUserId: row.updated_by_user_id,
    updatedByName: row.updated_by_name ?? null,
    note: row.note ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function incomeRecord(row: IncomeRow): IncomeEntryRecord {
  return {
    id: row.id,
    dailyReportId: row.daily_report_id,
    branch: row.branch ?? 'Unknown',
    categoryId: row.category_id,
    transactionDate: row.transaction_date,
    particular: row.particular,
    receiptNumber: row.receipt_number,
    remarks: row.remarks,
    amountCentavos: row.amount_centavos,
    status: row.status,
    voidedAt: row.voided_at,
    voidedByUserId: row.voided_by_user_id,
    voidReason: row.void_reason,
    createdByUserId: row.created_by_user_id,
    createdByName: row.created_by_name,
    createdByFirstName: row.created_by_first_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    source: row.source
  }
}

function paymentRecord(row: PaymentRow): DailyReportPaymentEntryRecord {
  return {
    id: row.id,
    dailyReportId: row.daily_report_id,
    branch: row.branch ?? 'Unknown',
    paymentMethodId: row.payment_method_id,
    paymentMethodName: row.payment_method_name,
    transactionDate: row.transaction_date,
    amountCentavos: row.amount_centavos,
    referenceNumber: row.reference_number,
    bankName: row.bank_name,
    payerName: row.payer_name,
    remarks: row.remarks,
    status: row.status,
    voidedAt: row.voided_at,
    voidedByUserId: row.voided_by_user_id,
    voidReason: row.void_reason,
    createdByUserId: row.created_by_user_id,
    createdByName: row.created_by_name,
    createdByFirstName: row.created_by_first_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    source: row.source
  }
}

function receiptTotalRecord(row: ReceiptTotalRow): DailyReceiptTotalRecord {
  return {
    id: row.id,
    dailyReportId: row.daily_report_id,
    receiptTypeId: row.receipt_type_id,
    receiptName: row.receipt_name,
    receiptShortName: row.receipt_short_name,
    quantity: row.quantity,
    amountCentavos: row.amount_centavos,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function cashOutRecord(row: CashOutRow): CashOutEntryRecord {
  return {
    id: row.id,
    dailyReportId: row.daily_report_id,
    transactionDate: row.transaction_date,
    description: row.description,
    amountCentavos: row.amount_centavos,
    status: row.status,
    voidedAt: row.voided_at,
    voidedByUserId: row.voided_by_user_id,
    voidReason: row.void_reason,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function deductionRecord(row: DeductionRow): DailyReportDeductionRecord {
  return {
    id: row.id,
    dailyReportId: row.daily_report_id,
    deductionTypeId: row.deduction_type_id,
    amountCentavos: row.amount_centavos,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function cashCountRecord(row: CashCountRow): DailyReportCashCountRecord {
  return {
    id: row.id,
    dailyReportId: row.daily_report_id,
    denominationId: row.denomination_id,
    quantity: row.quantity,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export class DailyReportRepository {
  constructor(private readonly db: AppDatabase) {}

  private touchReport(reportId: string, actorUserId: string, updatedAt: string): void {
    this.db
      .prepare('UPDATE daily_reports SET updated_at = ?, updated_by_user_id = ? WHERE id = ?')
      .run(updatedAt, actorUserId, reportId)
  }

  branchIdForUser(userId: string): string | null {
    const row = this.db.prepare('SELECT branch_id FROM users WHERE id = ?').get(userId) as
      { branch_id: string | null } | undefined
    return row?.branch_id ?? null
  }

  branchIdForName(name: string): string | null {
    const row = this.db
      .prepare('SELECT id FROM branches WHERE id = ? OR name = ? COLLATE NOCASE')
      .get(name, name) as { id: string } | undefined
    return row?.id ?? null
  }

  branchNameForId(branchId: string | null): string | null {
    if (!branchId) return null
    const row = this.db.prepare('SELECT name FROM branches WHERE id = ?').get(branchId) as
      { name: string } | undefined
    return row?.name ?? null
  }

  resolveActive(
    request: DailyReportResolveActiveRequest,
    actorUserId: string,
    allowMutation = true
  ): DailyReportRecord | null {
    const existing = this.findByIdentity(request.branchId, request.businessDate)
    if (existing) {
      if (allowMutation && (existing.status === 'DRAFT' || existing.status === 'REOPENED')) {
        const openingCashCentavos = this.previousEndingCashCentavos(
          request.branchId,
          request.businessDate
        )
        if (existing.openingCashCentavos !== openingCashCentavos) {
          const row = this.db
            .prepare(
              `UPDATE daily_reports
                SET opening_cash_centavos = ?, updated_at = ?, updated_by_user_id = ?
                WHERE id = ?
              RETURNING *`
            )
            .get(
              openingCashCentavos,
              new Date().toISOString(),
              actorUserId,
              existing.id
            ) as DailyReportRow
          return reportRecord(row)
        }
      }
      return existing
    }

    if (!allowMutation) return null

    const openingCashCentavos = this.previousEndingCashCentavos(
      request.branchId,
      request.businessDate
    )
    const now = new Date().toISOString()
    const report = this.db.transaction(() => {
      const id = randomUUID()
      this.db
        .prepare(
          `INSERT OR IGNORE INTO daily_reports (
            id, branch_id, cashier_user_id, business_date, opening_cash_centavos, updated_by_user_id, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          request.branchId,
          request.cashierUserId,
          request.businessDate,
          openingCashCentavos,
          actorUserId,
          now,
          now
        )
      const row = this.db
        .prepare(
          `SELECT * FROM daily_reports
             WHERE branch_id = ? AND business_date = ?
             ORDER BY created_at, id
             LIMIT 1`
        )
        .get(request.branchId, request.businessDate) as DailyReportRow
      // The legacy expenses module remains a compatibility adapter until its documented
      // expense_entries replacement is wired. Keep identity creation atomic across both tables.
      this.db
        .prepare(
          `INSERT OR IGNORE INTO reports (
            id, branch_id, cashier_id, business_date, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, 'Draft', ?, ?)`
        )
        .run(row.id, row.branch_id, row.cashier_user_id, row.business_date, now, now)
      return row
    })()
    return reportRecord(report)
  }

  private previousEndingCashCentavos(branchId: string, businessDate: string): number {
    const row = this.db
      .prepare(
        `SELECT COALESCE(SUM(d.value_centavos * c.quantity), 0) AS ending_cash_centavos
           FROM daily_reports previous
           LEFT JOIN daily_report_cash_counts c ON c.daily_report_id = previous.id
           LEFT JOIN cash_denominations d ON d.id = c.denomination_id
          WHERE previous.branch_id = ?
            AND previous.business_date = date(?, '-1 day')
            AND previous.status <> 'VOIDED'`
      )
      .get(branchId, businessDate) as { ending_cash_centavos: number }
    return row.ending_cash_centavos
  }

  createReceiptType(
    request: DailyReportReceiptTypeCreateRequest,
    createdByUserId: string
  ): DailyReportReceiptTypeRecord {
    const name = request.name.trim()
    const existing = this.db
      .prepare(
        `SELECT id, name, short_name, sort_order, is_default_visible, is_system, is_active
           FROM receipt_types
          WHERE name = ? COLLATE NOCASE`
      )
      .get(name) as (ReceiptTypeReferenceRow & { is_active: number }) | undefined

    if (existing?.is_active === 1) {
      throw new AppError('CONFLICT', 'A receipt type with that name already exists.')
    }

    if (existing) throw new AppError('CONFLICT', 'Restore the retired receipt type instead.')

    const now = new Date().toISOString()
    const row = this.db
      .prepare(
        `INSERT INTO receipt_types (
          id, code, name, short_name, is_system, is_default_visible, is_active, sort_order,
          created_by_user_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 0, 0, 1, ?, ?, ?, ?)
          RETURNING id, name, short_name, sort_order, is_default_visible, is_system, is_active`
      )
      .get(
        randomUUID(),
        `CUSTOM_${randomUUID()}`,
        name,
        request.shortName.trim(),
        this.nextReceiptTypeSortOrder(),
        createdByUserId,
        now,
        now
      ) as ReceiptTypeReferenceRow
    return {
      id: row.id,
      name: row.name,
      shortName: row.short_name,
      sortOrder: row.sort_order,
      isDefaultVisible: row.is_default_visible === 1,
      isSystem: row.is_system === 1,
      isActive: row.is_active === 1
    }
  }

  deleteReceiptType(
    request: DailyReportReceiptTypeDeleteRequest
  ): DailyReportReceiptTypeDeleteResponse {
    const row = this.db
      .prepare(
        `UPDATE receipt_types
            SET is_active = 0, updated_at = ?
          WHERE id = ? AND is_system = 0 AND is_active = 1
        RETURNING id`
      )
      .get(new Date().toISOString(), request.id) as { id: string } | undefined
    if (!row) throw new AppError('NOT_FOUND', 'Custom receipt type was not found.')
    return row
  }

  listReceiptTypes(): DailyReportReceiptTypeRecord[] {
    return (
      this.db
        .prepare(
          `SELECT id, name, short_name, sort_order, is_default_visible, is_system, is_active
           FROM receipt_types
          WHERE is_system = 0
          ORDER BY is_active DESC, sort_order, name`
        )
        .all() as ReceiptTypeReferenceRow[]
    ).map((row) => ({
      id: row.id,
      name: row.name,
      shortName: row.short_name || row.name.slice(0, 7),
      sortOrder: row.sort_order,
      isDefaultVisible: row.is_default_visible === 1,
      isSystem: row.is_system === 1,
      isActive: row.is_active === 1
    }))
  }

  restoreReceiptType(request: DailyReportReceiptTypeDeleteRequest): DailyReportReceiptTypeRecord {
    const row = this.db
      .prepare(
        `UPDATE receipt_types
            SET is_active = 1, updated_at = ?
          WHERE id = ? AND is_system = 0 AND is_active = 0
        RETURNING id, name, short_name, sort_order, is_default_visible, is_system, is_active`
      )
      .get(new Date().toISOString(), request.id) as ReceiptTypeReferenceRow | undefined
    if (!row) throw new AppError('NOT_FOUND', 'Retired receipt type was not found.')
    return {
      id: row.id,
      name: row.name,
      shortName: row.short_name || row.name.slice(0, 7),
      sortOrder: row.sort_order,
      isDefaultVisible: row.is_default_visible === 1,
      isSystem: row.is_system === 1,
      isActive: row.is_active === 1
    }
  }

  private nextReceiptTypeSortOrder(): number {
    const row = this.db
      .prepare('SELECT COALESCE(MAX(sort_order), 0) + 10 AS sort_order FROM receipt_types')
      .get() as { sort_order: number }
    return row.sort_order
  }

  findByIdentity(branchId: string, businessDate: string): DailyReportRecord | null {
    const row = this.db
      .prepare(
        `SELECT * FROM daily_reports
          WHERE branch_id = ? AND business_date = ?
          ORDER BY created_at, id
          LIMIT 1`
      )
      .get(branchId, businessDate) as DailyReportRow | undefined
    return row ? reportRecord(row) : null
  }

  branchIdForReport(reportId: string): string | null {
    const row = this.db
      .prepare('SELECT branch_id FROM daily_reports WHERE id = ?')
      .get(reportId) as { branch_id: string } | undefined
    return row?.branch_id ?? null
  }

  listCalendar(request: DailyReportCalendarRequest): DailyReportCalendarDay[] {
    const monthStart = `${request.month}-01`
    let reports: DailyReportRow[]
    try {
      reports = this.db
        .prepare(
          `SELECT dr.*, u.display_name AS updated_by_name
            FROM daily_reports dr
             LEFT JOIN users u ON u.id = dr.updated_by_user_id
            WHERE dr.branch_id = ?
              AND dr.business_date >= ?
              AND dr.business_date < date(?, '+1 month')
            ORDER BY dr.business_date`
        )
        .all(request.branchId, monthStart, monthStart) as DailyReportRow[]
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('updated_by_user_id')) throw error
      reports = this.db
        .prepare(
          `SELECT * FROM daily_reports
            WHERE branch_id = ?
              AND business_date >= ?
              AND business_date < date(?, '+1 month')
            ORDER BY business_date`
        )
        .all(request.branchId, monthStart, monthStart) as DailyReportRow[]
    }

    return reports.map((row) => {
      const report = reportRecord(row)
      const snapshot = this.snapshot(report.id)
      const hasData =
        report.openingCashCentavos !== 0 ||
        report.cashRemittedCentavos !== null ||
        snapshot.receiptTotals.some(
          ({ amountCentavos, quantity }) => amountCentavos !== 0 || quantity !== 0
        ) ||
        snapshot.incomeEntries.length > 0 ||
        snapshot.paymentEntries.length > 0 ||
        snapshot.cashOutEntries.length > 0 ||
        snapshot.deductions.some(({ amountCentavos }) => amountCentavos !== 0) ||
        snapshot.cashCounts.some(({ quantity }) => quantity !== 0) ||
        snapshot.legacyExpenseCashOutCentavos !== 0 ||
        snapshot.cashCollectionsCentavos !== 0 ||
        snapshot.otherIncomeCentavos !== 0 ||
        snapshot.financeDownCentavos !== 0 ||
        snapshot.financeBalanceCentavos !== 0
      return {
        businessDate: report.businessDate,
        reportId: report.id,
        status: report.status,
        googleDriveSubmittedAt: report.googleDriveSubmittedAt,
        telegramSubmittedAt: report.telegramSubmittedAt,
        hasData,
        cashVarianceCentavos: snapshot.cashVarianceCentavos,
        expectedCashCentavos: snapshot.expectedCashCentavos,
        physicalCashCentavos: snapshot.physicalCashCentavos,
        updatedAt: report.updatedAt,
        updatedByName: report.updatedByName,
        note: report.note
      }
    })
  }

  updateNote(
    dailyReportId: string,
    note: string | null,
    updatedByUserId: string
  ): DailyReportRecord {
    const row = this.db
      .prepare(
        `UPDATE daily_reports
            SET note = ?, updated_at = ?, updated_by_user_id = ?
          WHERE id = ?
        RETURNING *`
      )
      .get(note, new Date().toISOString(), updatedByUserId, dailyReportId) as
      DailyReportRow | undefined
    if (!row) throw new AppError('NOT_FOUND', 'Daily report was not found.')
    return reportRecord(row)
  }

  markDelivery(
    dailyReportId: string,
    channel: DailyReportDeliveryChannel,
    updatedByUserId: string
  ): DailyReportRecord {
    const submittedColumn =
      channel === 'GOOGLE_DRIVE' ? 'google_drive_submitted_at' : 'telegram_submitted_at'
    const now = new Date().toISOString()
    const row = this.db
      .prepare(
        `UPDATE daily_reports
            SET ${submittedColumn} = ?, updated_at = ?, updated_by_user_id = ?
          WHERE id = ?
        RETURNING *`
      )
      .get(now, now, updatedByUserId, dailyReportId) as DailyReportRow | undefined
    if (!row) throw new AppError('NOT_FOUND', 'Daily report was not found.')
    return reportRecord(row)
  }

  findById(id: string): DailyReportRecord | null {
    let row: DailyReportRow | undefined
    try {
      row = this.db
        .prepare(
          `SELECT dr.*, u.display_name AS updated_by_name
             FROM daily_reports dr
             LEFT JOIN users u ON u.id = dr.updated_by_user_id
            WHERE dr.id = ?`
        )
        .get(id) as DailyReportRow | undefined
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('updated_by_user_id')) throw error
      row = this.db.prepare('SELECT * FROM daily_reports WHERE id = ?').get(id) as
        DailyReportRow | undefined
    }
    return row ? reportRecord(row) : null
  }

  listIncome(request: IncomeListRequest): IncomeEntryRecord[] {
    const where = ['1 = 1']
    const params: Record<string, string> = {}
    if (request.dailyReportId) {
      where.push('daily_report_id = @dailyReportId')
      params.dailyReportId = request.dailyReportId
    }
    if (request.branch && request.branch !== 'All Branch') {
      where.push('branch = @branch')
      params.branch = request.branch
    }
    if (request.dateFrom) {
      where.push('transaction_date >= @dateFrom')
      params.dateFrom = request.dateFrom
    }
    if (request.dateTo) {
      where.push('transaction_date <= @dateTo')
      params.dateTo = request.dateTo
    }
    if (request.status) {
      where.push('status = @status')
      params.status = request.status
    }
    return (
      this.db
        .prepare(
          `WITH all_income AS (
             SELECT i.*, b.name AS branch, u.display_name AS created_by_name,
                    COALESCE(NULLIF(u.first_name, ''), u.display_name) AS created_by_first_name,
                    'local' AS source
               FROM income_entries i
               JOIN daily_reports dr ON dr.id = i.daily_report_id
               JOIN branches b ON b.id = dr.branch_id
               LEFT JOIN users u ON u.id = i.created_by_user_id
             UNION ALL
             SELECT json_extract(c.payload_json, '$.id'),
                    COALESCE(json_extract(c.payload_json, '$.dailyReportId'), json_extract(c.payload_json, '$.daily_report_id')),
                    COALESCE(json_extract(c.payload_json, '$.categoryId'), json_extract(c.payload_json, '$.category_id')),
                    COALESCE(json_extract(c.payload_json, '$.transactionDate'), json_extract(c.payload_json, '$.transaction_date')),
                    json_extract(c.payload_json, '$.particular'),
                    COALESCE(json_extract(c.payload_json, '$.receiptNumber'), json_extract(c.payload_json, '$.receipt_number')),
                    json_extract(c.payload_json, '$.remarks'),
                    CAST(COALESCE(json_extract(c.payload_json, '$.amountCentavos'), json_extract(c.payload_json, '$.amount_centavos')) AS INTEGER),
                    json_extract(c.payload_json, '$.status'),
                    NULLIF(COALESCE(json_extract(c.payload_json, '$.voidedAt'), json_extract(c.payload_json, '$.voided_at')), ''),
                    NULLIF(COALESCE(json_extract(c.payload_json, '$.voidedByUserId'), json_extract(c.payload_json, '$.voided_by_user_id')), ''),
                    NULLIF(COALESCE(json_extract(c.payload_json, '$.voidReason'), json_extract(c.payload_json, '$.void_reason')), ''),
                    COALESCE(json_extract(c.payload_json, '$.createdByUserId'), json_extract(c.payload_json, '$.created_by_user_id')),
                    COALESCE(json_extract(c.payload_json, '$.createdAt'), json_extract(c.payload_json, '$.created_at')),
                    COALESCE(json_extract(c.payload_json, '$.updatedAt'), json_extract(c.payload_json, '$.updated_at')),
                    c.source_branch,
                    COALESCE(json_extract(c.payload_json, '$.createdByName'), json_extract(c.payload_json, '$.created_by_name')),
                    COALESCE(json_extract(c.payload_json, '$.createdByFirstName'), json_extract(c.payload_json, '$.created_by_first_name')),
                    'google-cache'
               FROM google_sheet_branch_cache c
              WHERE c.sheet_name = 'Income'
                AND c.source_branch <> ''
                AND json_extract(c.payload_json, '$.id') IS NOT NULL
                AND COALESCE(json_extract(c.payload_json, '$.dailyReportId'), json_extract(c.payload_json, '$.daily_report_id')) IS NOT NULL
                AND COALESCE(json_extract(c.payload_json, '$.categoryId'), json_extract(c.payload_json, '$.category_id')) IS NOT NULL
                AND COALESCE(json_extract(c.payload_json, '$.transactionDate'), json_extract(c.payload_json, '$.transaction_date')) IS NOT NULL
                AND json_extract(c.payload_json, '$.particular') IS NOT NULL
                AND CAST(COALESCE(json_extract(c.payload_json, '$.amountCentavos'), json_extract(c.payload_json, '$.amount_centavos')) AS INTEGER) > 0
                AND json_extract(c.payload_json, '$.status') IN ('POSTED', 'VOIDED')
                AND COALESCE(json_extract(c.payload_json, '$.createdByUserId'), json_extract(c.payload_json, '$.created_by_user_id')) IS NOT NULL
                AND COALESCE(json_extract(c.payload_json, '$.createdAt'), json_extract(c.payload_json, '$.created_at')) IS NOT NULL
                AND COALESCE(json_extract(c.payload_json, '$.updatedAt'), json_extract(c.payload_json, '$.updated_at')) IS NOT NULL
                AND NOT EXISTS (SELECT 1 FROM income_entries i WHERE i.id = json_extract(c.payload_json, '$.id'))
           )
           SELECT * FROM all_income
            WHERE ${where.join(' AND ')}
            ORDER BY transaction_date DESC, created_at DESC, id DESC`
        )
        .all(params) as IncomeRow[]
    ).map(incomeRecord)
  }

  incomeReportId(id: string): string | null {
    const row = this.db
      .prepare('SELECT daily_report_id FROM income_entries WHERE id = ?')
      .get(id) as { daily_report_id: string } | undefined
    return row?.daily_report_id ?? null
  }

  createIncome(request: IncomeCreateRequest, actorUserId: string): IncomeEntryRecord {
    const now = new Date().toISOString()
    const row = this.db
      .prepare(
        `INSERT INTO income_entries (
          id, daily_report_id, category_id, transaction_date, particular, receipt_number, remarks,
          amount_centavos, created_by_user_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
      )
      .get(
        randomUUID(),
        request.dailyReportId,
        request.categoryId,
        request.transactionDate,
        request.particular,
        request.receiptNumber ?? null,
        request.remarks ?? null,
        request.amountCentavos,
        actorUserId,
        now,
        now
      ) as IncomeRow
    recordAudit(this.db, {
      actorUserId,
      entityType: 'INCOME',
      entityId: row.id,
      action: request.duplicatedFromId ? 'DUPLICATED' : 'CREATED',
      changes: [
        { field: 'amountCentavos', oldValue: null, newValue: String(request.amountCentavos) },
        ...(request.duplicatedFromId
          ? [{ field: 'duplicatedFromId', oldValue: null, newValue: request.duplicatedFromId }]
          : [])
      ]
    })
    this.touchReport(row.daily_report_id, actorUserId, now)
    return incomeRecord(row)
  }

  updateIncome(request: IncomeUpdateRequest, actorUserId: string): IncomeEntryRecord {
    const now = new Date().toISOString()
    const row = this.db
      .prepare(
        `UPDATE income_entries SET category_id = ?, transaction_date = ?, particular = ?, receipt_number = ?,
          remarks = ?, amount_centavos = ?, updated_at = ?
         WHERE id = ? AND status = 'POSTED' RETURNING *`
      )
      .get(
        request.categoryId,
        request.transactionDate,
        request.particular,
        request.receiptNumber ?? null,
        request.remarks ?? null,
        request.amountCentavos,
        now,
        request.id
      ) as IncomeRow | undefined
    if (!row) throw new AppError('NOT_FOUND', 'Posted income entry was not found.')
    recordAudit(this.db, {
      actorUserId,
      entityType: 'INCOME',
      entityId: request.id,
      action: 'UPDATED',
      changes: [{ field: 'updatedAt', oldValue: null, newValue: now }]
    })
    this.touchReport(row.daily_report_id, actorUserId, now)
    return incomeRecord(row)
  }

  voidIncome(request: IncomeVoidRequest, actorUserId: string): IncomeEntryRecord {
    const now = new Date().toISOString()
    const voidEntry = this.db.transaction(() => {
      const row = this.db
        .prepare(
          `UPDATE income_entries
              SET status = 'VOIDED', voided_at = ?, voided_by_user_id = ?, void_reason = ?, updated_at = ?
            WHERE id = ? AND status = 'POSTED' RETURNING *`
        )
        .get(now, actorUserId, request.voidReason, now, request.id) as IncomeRow | undefined
      if (!row) throw new AppError('NOT_FOUND', 'Posted income entry was not found.')
      recordAudit(this.db, {
        actorUserId,
        entityType: 'INCOME',
        entityId: request.id,
        action: 'VOIDED',
        reason: request.voidReason,
        changes: [
          { field: 'status', oldValue: 'POSTED', newValue: 'VOIDED' },
          { field: 'voidReason', oldValue: null, newValue: request.voidReason }
        ]
      })
      this.touchReport(row.daily_report_id, actorUserId, now)
      return row
    })
    return incomeRecord(voidEntry())
  }

  listPayments(request: DailyReportPaymentListRequest): DailyReportPaymentEntryRecord[] {
    const where = ['1 = 1']
    const params: Record<string, string> = {}
    if (request.dailyReportId) {
      where.push('daily_report_id = @dailyReportId')
      params.dailyReportId = request.dailyReportId
    }
    if (request.branch && request.branch !== 'All Branch') {
      where.push('branch = @branch')
      params.branch = request.branch
    }
    if (request.dateFrom) {
      where.push('transaction_date >= @dateFrom')
      params.dateFrom = request.dateFrom
    }
    if (request.dateTo) {
      where.push('transaction_date <= @dateTo')
      params.dateTo = request.dateTo
    }
    if (request.status) {
      where.push('status = @status')
      params.status = request.status
    }
    return (
      this.db
        .prepare(
          `WITH all_payments AS (
             SELECT p.*, b.name AS branch, u.display_name AS created_by_name,
                    COALESCE(NULLIF(u.first_name, ''), u.display_name) AS created_by_first_name,
                    'local' AS source
               FROM daily_report_payment_entries p
               JOIN daily_reports dr ON dr.id = p.daily_report_id
               JOIN branches b ON b.id = dr.branch_id
               LEFT JOIN users u ON u.id = p.created_by_user_id
             UNION ALL
             SELECT json_extract(c.payload_json, '$.id'),
                    COALESCE(json_extract(c.payload_json, '$.dailyReportId'), json_extract(c.payload_json, '$.daily_report_id')),
                    COALESCE(json_extract(c.payload_json, '$.paymentMethodId'), json_extract(c.payload_json, '$.payment_method_id')),
                    COALESCE(json_extract(c.payload_json, '$.transactionDate'), json_extract(c.payload_json, '$.transaction_date')),
                    CAST(COALESCE(json_extract(c.payload_json, '$.amountCentavos'), json_extract(c.payload_json, '$.amount_centavos')) AS INTEGER),
                    COALESCE(json_extract(c.payload_json, '$.referenceNumber'), json_extract(c.payload_json, '$.reference_number')),
                    COALESCE(json_extract(c.payload_json, '$.bankName'), json_extract(c.payload_json, '$.bank_name')),
                    COALESCE(json_extract(c.payload_json, '$.payerName'), json_extract(c.payload_json, '$.payer_name')),
                    json_extract(c.payload_json, '$.remarks'), json_extract(c.payload_json, '$.status'),
                    NULLIF(COALESCE(json_extract(c.payload_json, '$.voidedAt'), json_extract(c.payload_json, '$.voided_at')), ''),
                    NULLIF(COALESCE(json_extract(c.payload_json, '$.voidedByUserId'), json_extract(c.payload_json, '$.voided_by_user_id')), ''),
                    NULLIF(COALESCE(json_extract(c.payload_json, '$.voidReason'), json_extract(c.payload_json, '$.void_reason')), ''),
                    COALESCE(json_extract(c.payload_json, '$.createdByUserId'), json_extract(c.payload_json, '$.created_by_user_id')),
                    COALESCE(json_extract(c.payload_json, '$.createdAt'), json_extract(c.payload_json, '$.created_at')),
                    COALESCE(json_extract(c.payload_json, '$.updatedAt'), json_extract(c.payload_json, '$.updated_at')),
                    COALESCE(json_extract(c.payload_json, '$.paymentMethodName'), json_extract(c.payload_json, '$.payment_method_name')),
                    c.source_branch,
                    COALESCE(json_extract(c.payload_json, '$.createdByName'), json_extract(c.payload_json, '$.created_by_name')),
                    COALESCE(json_extract(c.payload_json, '$.createdByFirstName'), json_extract(c.payload_json, '$.created_by_first_name')),
                    'google-cache'
               FROM google_sheet_branch_cache c
              WHERE c.sheet_name IN ('Payment', 'Payments')
                AND c.source_branch <> ''
                AND json_extract(c.payload_json, '$.id') IS NOT NULL
                AND COALESCE(json_extract(c.payload_json, '$.dailyReportId'), json_extract(c.payload_json, '$.daily_report_id')) IS NOT NULL
                AND COALESCE(json_extract(c.payload_json, '$.paymentMethodId'), json_extract(c.payload_json, '$.payment_method_id')) IS NOT NULL
                AND COALESCE(json_extract(c.payload_json, '$.paymentMethodName'), json_extract(c.payload_json, '$.payment_method_name')) IS NOT NULL
                AND COALESCE(json_extract(c.payload_json, '$.transactionDate'), json_extract(c.payload_json, '$.transaction_date')) IS NOT NULL
                AND CAST(COALESCE(json_extract(c.payload_json, '$.amountCentavos'), json_extract(c.payload_json, '$.amount_centavos')) AS INTEGER) > 0
                AND json_extract(c.payload_json, '$.status') IN ('POSTED', 'VOIDED')
                AND COALESCE(json_extract(c.payload_json, '$.createdByUserId'), json_extract(c.payload_json, '$.created_by_user_id')) IS NOT NULL
                AND COALESCE(json_extract(c.payload_json, '$.createdAt'), json_extract(c.payload_json, '$.created_at')) IS NOT NULL
                AND COALESCE(json_extract(c.payload_json, '$.updatedAt'), json_extract(c.payload_json, '$.updated_at')) IS NOT NULL
                AND NOT EXISTS (SELECT 1 FROM daily_report_payment_entries p WHERE p.id = json_extract(c.payload_json, '$.id'))
           )
           SELECT * FROM all_payments
            WHERE ${where.join(' AND ')}
            ORDER BY transaction_date DESC, created_at DESC, id DESC`
        )
        .all(params) as PaymentRow[]
    ).map(paymentRecord)
  }

  paymentReportId(id: string): string | null {
    const row = this.db
      .prepare('SELECT daily_report_id FROM daily_report_payment_entries WHERE id = ?')
      .get(id) as { daily_report_id: string } | undefined
    return row?.daily_report_id ?? null
  }

  createPayment(
    request: DailyReportPaymentCreateRequest,
    actorUserId: string
  ): DailyReportPaymentEntryRecord {
    const now = new Date().toISOString()
    const row = this.db
      .prepare(
        `INSERT INTO daily_report_payment_entries (
          id, daily_report_id, payment_method_id, payment_method_name, transaction_date, amount_centavos, reference_number,
          bank_name, payer_name, remarks, created_by_user_id, created_at, updated_at
        ) VALUES (?, ?, ?, (SELECT name FROM report_payment_methods WHERE id = ?), ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
      )
      .get(
        randomUUID(),
        request.dailyReportId,
        request.paymentMethodId,
        request.paymentMethodId,
        request.transactionDate,
        request.amountCentavos,
        request.referenceNumber ?? null,
        request.bankName ?? null,
        request.payerName ?? null,
        request.remarks ?? null,
        actorUserId,
        now,
        now
      ) as PaymentRow
    recordAudit(this.db, {
      actorUserId,
      entityType: 'PAYMENT',
      entityId: row.id,
      action: request.duplicatedFromId ? 'DUPLICATED' : 'CREATED',
      changes: [
        { field: 'amountCentavos', oldValue: null, newValue: String(request.amountCentavos) },
        ...(request.duplicatedFromId
          ? [{ field: 'duplicatedFromId', oldValue: null, newValue: request.duplicatedFromId }]
          : [])
      ]
    })
    this.touchReport(row.daily_report_id, actorUserId, now)
    return paymentRecord(row)
  }

  updatePayment(
    request: DailyReportPaymentUpdateRequest,
    actorUserId: string
  ): DailyReportPaymentEntryRecord {
    const now = new Date().toISOString()
    const row = this.db
      .prepare(
        `UPDATE daily_report_payment_entries
            SET payment_method_id = ?, payment_method_name = (SELECT name FROM report_payment_methods WHERE id = ?), transaction_date = ?, amount_centavos = ?, reference_number = ?,
                bank_name = ?, payer_name = ?, remarks = ?, updated_at = ?
          WHERE id = ? AND status = 'POSTED' RETURNING *`
      )
      .get(
        request.paymentMethodId,
        request.paymentMethodId,
        request.transactionDate,
        request.amountCentavos,
        request.referenceNumber ?? null,
        request.bankName ?? null,
        request.payerName ?? null,
        request.remarks ?? null,
        now,
        request.id
      ) as PaymentRow | undefined
    if (!row) throw new AppError('NOT_FOUND', 'Posted payment entry was not found.')
    recordAudit(this.db, {
      actorUserId,
      entityType: 'PAYMENT',
      entityId: request.id,
      action: 'UPDATED',
      changes: [{ field: 'updatedAt', oldValue: null, newValue: now }]
    })
    this.touchReport(row.daily_report_id, actorUserId, now)
    return paymentRecord(row)
  }

  voidPayment(
    request: DailyReportPaymentVoidRequest,
    actorUserId: string
  ): DailyReportPaymentEntryRecord {
    const now = new Date().toISOString()
    const voidEntry = this.db.transaction(() => {
      const row = this.db
        .prepare(
          `UPDATE daily_report_payment_entries
              SET status = 'VOIDED', voided_at = ?, voided_by_user_id = ?, void_reason = ?, updated_at = ?
            WHERE id = ? AND status = 'POSTED' RETURNING *`
        )
        .get(now, actorUserId, request.voidReason, now, request.id) as PaymentRow | undefined
      if (!row) throw new AppError('NOT_FOUND', 'Posted payment entry was not found.')
      recordAudit(this.db, {
        actorUserId,
        entityType: 'PAYMENT',
        entityId: request.id,
        action: 'VOIDED',
        reason: request.voidReason,
        changes: [
          { field: 'status', oldValue: 'POSTED', newValue: 'VOIDED' },
          { field: 'voidReason', oldValue: null, newValue: request.voidReason }
        ]
      })
      this.touchReport(row.daily_report_id, actorUserId, now)
      return row
    })
    return paymentRecord(voidEntry())
  }

  updateSummary(
    request: DailyReportSummaryUpdateRequest,
    actorUserId: string
  ): DailyReportSnapshotResponse {
    const update = this.db.transaction(() => {
      const now = new Date().toISOString()
      const report = this.db
        .prepare(
          `UPDATE daily_reports
               SET cash_remitted_centavos = ?, updated_at = ?, updated_by_user_id = ?
            WHERE id = ?
          RETURNING id`
        )
        .get(request.cashRemittedCentavos, now, actorUserId, request.dailyReportId) as
        { id: string } | undefined
      if (!report) throw new AppError('NOT_FOUND', 'Daily report was not found.')

      const upsertReceipt = this.db.prepare(
        `INSERT INTO daily_receipt_totals (
          id, daily_report_id, receipt_type_id, receipt_name, receipt_short_name,
          quantity, amount_centavos, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(daily_report_id, receipt_type_id) DO UPDATE SET
          quantity = excluded.quantity, amount_centavos = excluded.amount_centavos, updated_at = excluded.updated_at`
      )
      const receiptType = this.db.prepare('SELECT name, short_name FROM receipt_types WHERE id = ?')
      for (const item of request.receiptTotals) {
        const type = receiptType.get(item.receiptTypeId) as
          { name: string; short_name: string } | undefined
        if (!type) throw new AppError('NOT_FOUND', 'Receipt type was not found.')
        upsertReceipt.run(
          randomUUID(),
          request.dailyReportId,
          item.receiptTypeId,
          type.name,
          type.short_name || type.name.slice(0, 7),
          item.quantity,
          item.amountCentavos,
          now,
          now
        )
      }

      const upsertDeduction = this.db.prepare(
        `INSERT INTO daily_report_deductions (
          id, daily_report_id, deduction_type_id, amount_centavos, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(daily_report_id, deduction_type_id) DO UPDATE SET
          amount_centavos = excluded.amount_centavos, updated_at = excluded.updated_at`
      )
      for (const item of request.deductions) {
        upsertDeduction.run(
          randomUUID(),
          request.dailyReportId,
          item.deductionTypeId,
          item.amountCentavos,
          now,
          now
        )
      }

      const upsertCashCount = this.db.prepare(
        `INSERT INTO daily_report_cash_counts (
          id, daily_report_id, denomination_id, quantity, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(daily_report_id, denomination_id) DO UPDATE SET
          quantity = excluded.quantity, updated_at = excluded.updated_at`
      )
      for (const item of request.cashCounts) {
        upsertCashCount.run(
          randomUUID(),
          request.dailyReportId,
          item.denominationId,
          item.quantity,
          now,
          now
        )
      }
    })
    update()
    return this.snapshot(request.dailyReportId)
  }

  snapshot(dailyReportId: string): DailyReportSnapshotResponse {
    const report = this.findById(dailyReportId)
    if (!report) throw new AppError('NOT_FOUND', 'Daily report was not found.')
    const incomeEntries = this.listIncome({ dailyReportId }).filter((entry) => entry.source === 'local')
    const paymentEntries = this.listPayments({ dailyReportId }).filter((entry) => entry.source === 'local')
    const receiptTotals = (
      this.db
        .prepare(
          'SELECT * FROM daily_receipt_totals WHERE daily_report_id = ? ORDER BY receipt_type_id'
        )
        .all(dailyReportId) as ReceiptTotalRow[]
    ).map(receiptTotalRecord)
    const cashOutEntries = (
      this.db
        .prepare(
          `SELECT * FROM cash_out_entries WHERE daily_report_id = ?
         ORDER BY transaction_date DESC, created_at DESC, id DESC`
        )
        .all(dailyReportId) as CashOutRow[]
    ).map(cashOutRecord)
    const deductions = (
      this.db
        .prepare(
          'SELECT * FROM daily_report_deductions WHERE daily_report_id = ? ORDER BY deduction_type_id'
        )
        .all(dailyReportId) as DeductionRow[]
    ).map(deductionRecord)
    const cashCounts = (
      this.db
        .prepare(
          `SELECT c.* FROM daily_report_cash_counts c
            JOIN cash_denominations d ON d.id = c.denomination_id
           WHERE c.daily_report_id = ? AND d.value_centavos >= 25
           ORDER BY c.denomination_id`
        )
        .all(dailyReportId) as CashCountRow[]
    ).map(cashCountRecord)
    const receiptTypes = (
      this.db
        .prepare(
          'SELECT id, name, short_name, sort_order, is_default_visible, is_system, is_active FROM receipt_types WHERE is_active = 1 ORDER BY sort_order, name'
        )
        .all() as ReceiptTypeReferenceRow[]
    ).map((row) => ({
      id: row.id,
      name: row.name,
      shortName: row.short_name || row.name.slice(0, 7),
      sortOrder: row.sort_order,
      isDefaultVisible:
        row.is_default_visible === 1 &&
        !receiptTypesHiddenByDefault.has(row.name.trim().toUpperCase()),
      isSystem: row.is_system === 1,
      isActive: row.is_active === 1
    }))
    const deductionTypes = (
      this.db
        .prepare('SELECT id, name FROM deduction_types WHERE is_active = 1 ORDER BY name')
        .all() as DeductionTypeRow[]
    ).map((row, index) => ({
      id: row.id,
      name: row.name,
      sortOrder: index
    }))
    const cashDenominations = (
      this.db
        .prepare(
          'SELECT id, value_centavos, sort_order FROM cash_denominations WHERE is_active = 1 AND value_centavos >= 25 ORDER BY sort_order'
        )
        .all() as CashDenominationReferenceRow[]
    ).map((row) => ({
      id: row.id,
      valueCentavos: row.value_centavos,
      sortOrder: row.sort_order
    }))
    const collectionDetails = this.db
      .prepare(
        `SELECT c.account_id AS id, a.display_name AS name,
                p.amount_centavos + p.penalty_centavos AS amountCentavos
           FROM in_house_payments p
           JOIN installment_contracts c ON c.id = p.contract_id
           JOIN accounts a ON a.id = c.account_id
           WHERE p.status = 'POSTED' AND c.status <> 'VOIDED'
             AND p.payment_date = ? AND c.branch_id = ?
          ORDER BY a.display_name, p.id`
      )
      .all(report.businessDate, report.branchId) as Array<{
      id: string
      name: string
      amountCentavos: number
    }>
    const financeDownDetails = this.db
      .prepare(
        `SELECT f.id, trim(f.first_name || ' ' || f.last_name) AS name,
                f.downpayment_centavos AS amountCentavos
           FROM finance_accounts f
           JOIN branches b ON b.name = f.branch
          WHERE COALESCE(f.paid_date, f.date_released) = ? AND b.id = ?
          ORDER BY name, f.id`
      )
      .all(report.businessDate, report.branchId) as Array<{
      id: string
      name: string
      amountCentavos: number
    }>
    const financeBalanceDetails = this.db
      .prepare(
        `SELECT f.id, trim(f.first_name || ' ' || f.last_name) AS name,
                f.balance_centavos AS amountCentavos
           FROM finance_accounts f
           JOIN branches b ON b.name = f.branch
          WHERE COALESCE(f.paid_date, f.date_released) = ? AND b.id = ?
          ORDER BY name, f.id`
      )
      .all(report.businessDate, report.branchId) as Array<{
      id: string
      name: string
      amountCentavos: number
    }>
    const totals = this.db
      .prepare(
        `SELECT
          COALESCE((SELECT SUM(amount_centavos) FROM daily_receipt_totals WHERE daily_report_id = ?), 0) AS receipt_centavos,
          COALESCE((SELECT SUM(i.amount_centavos) FROM income_entries i WHERE i.daily_report_id = ? AND i.status = 'POSTED'), 0) AS income_centavos,
          COALESCE((SELECT SUM(amount_centavos) FROM daily_report_deductions WHERE daily_report_id = ?), 0) AS deduction_centavos,
          COALESCE((SELECT SUM(amount_centavos) FROM cash_out_entries WHERE daily_report_id = ? AND status = 'POSTED'), 0) AS cash_out_centavos,
          COALESCE((SELECT SUM(amount_centavos) FROM expenses WHERE report_id = ? AND status = 'POSTED'), 0) AS legacy_expense_cash_out_centavos,
          COALESCE((SELECT SUM(p.amount_centavos + p.penalty_centavos)
                      FROM in_house_payments p
                      JOIN installment_contracts c ON c.id = p.contract_id
                      WHERE p.status = 'POSTED' AND c.status <> 'VOIDED'
                       AND p.payment_date = report.business_date
                       AND c.branch_id = report.branch_id), 0) AS recorded_paid_amount_centavos,
          COALESCE((SELECT SUM(i.amount_centavos)
                      FROM income_entries i
                     WHERE i.daily_report_id = ? AND i.status = 'POSTED'), 0) AS other_income_centavos,
          COALESCE((SELECT SUM(f.downpayment_centavos)
                      FROM finance_accounts f
                      JOIN branches finance_branch ON finance_branch.name = f.branch
                     WHERE COALESCE(f.paid_date, f.date_released) = ?
                       AND finance_branch.id = report.branch_id), 0) AS finance_down_centavos,
          COALESCE((SELECT SUM(f.balance_centavos)
                      FROM finance_accounts f
                      JOIN branches finance_branch ON finance_branch.name = f.branch
                     WHERE COALESCE(f.paid_date, f.date_released) = ?
                       AND finance_branch.id = report.branch_id), 0) AS finance_balance_centavos,
          COALESCE((SELECT SUM(d.value_centavos * c.quantity) FROM daily_report_cash_counts c JOIN cash_denominations d ON d.id = c.denomination_id WHERE c.daily_report_id = ? AND d.value_centavos >= 25), 0) AS physical_cash_centavos
          FROM daily_reports report
         WHERE report.id = ?`
      )
      .get(
        dailyReportId,
        dailyReportId,
        dailyReportId,
        dailyReportId,
        dailyReportId,
        dailyReportId,
        report.businessDate,
        report.businessDate,
        dailyReportId,
        dailyReportId
      ) as {
      receipt_centavos: number
      income_centavos: number
      deduction_centavos: number
      cash_out_centavos: number
      legacy_expense_cash_out_centavos: number
      recorded_paid_amount_centavos: number
      other_income_centavos: number
      finance_down_centavos: number
      finance_balance_centavos: number
      physical_cash_centavos: number
    }
    const expectedCashCentavos =
      report.openingCashCentavos +
      totals.receipt_centavos +
      totals.income_centavos -
      totals.deduction_centavos -
      totals.cash_out_centavos -
      totals.legacy_expense_cash_out_centavos
    return {
      report,
      receiptTotals,
      incomeEntries,
      paymentEntries,
      cashOutEntries,
      deductions,
      cashCounts,
      receiptTypes,
      deductionTypes,
      cashDenominations,
      collectionDetails,
      financeDownDetails,
      financeBalanceDetails,
      legacyExpenseCashOutCentavos: totals.legacy_expense_cash_out_centavos,
      cashCollectionsCentavos: totals.recorded_paid_amount_centavos,
      otherIncomeCentavos: totals.other_income_centavos,
      financeDownCentavos: totals.finance_down_centavos,
      financeBalanceCentavos: totals.finance_balance_centavos,
      expectedCashCentavos,
      physicalCashCentavos: totals.physical_cash_centavos,
      cashVarianceCentavos: totals.physical_cash_centavos - expectedCashCentavos
    }
  }
}
