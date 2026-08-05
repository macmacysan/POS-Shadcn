import { randomUUID } from 'node:crypto'

import type {
  CashOutEntryRecord,
  DailyReceiptTotalRecord,
  DailyReportCashCountRecord,
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

type DailyReportRow = {
  id: string
  branch_id: string
  cashier_user_id: string
  business_date: string
  opening_cash_centavos: number
  cash_remitted_centavos: number | null
  status: DailyReportRecord['status']
  submitted_at: string | null
  approved_at: string | null
  approved_by_user_id: string | null
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
  created_at: string
  updated_at: string
}

type PaymentRow = {
  id: string
  daily_report_id: string
  branch: string
  payment_method_id: string
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
  created_at: string
  updated_at: string
}

type ReceiptTotalRow = {
  id: string
  daily_report_id: string
  receipt_type_id: string
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
  is_default_visible: number
  is_system: number
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
    submittedAt: row.submitted_at,
    approvedAt: row.approved_at,
    approvedByUserId: row.approved_by_user_id,
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
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function paymentRecord(row: PaymentRow): DailyReportPaymentEntryRecord {
  return {
    id: row.id,
    dailyReportId: row.daily_report_id,
    branch: row.branch ?? 'Unknown',
    paymentMethodId: row.payment_method_id,
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
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function receiptTotalRecord(row: ReceiptTotalRow): DailyReceiptTotalRecord {
  return {
    id: row.id,
    dailyReportId: row.daily_report_id,
    receiptTypeId: row.receipt_type_id,
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

  branchIdForUser(userId: string): string | null {
    const row = this.db.prepare('SELECT branch_id FROM users WHERE id = ?').get(userId) as
      | { branch_id: string | null }
      | undefined
    return row?.branch_id ?? null
  }

  resolveActive(request: DailyReportResolveActiveRequest): DailyReportRecord {
    const existing = this.findByIdentity(request.branchId, request.cashierUserId, request.businessDate)
    if (existing) {
      if (existing.status === 'DRAFT' || existing.status === 'REOPENED') {
        const openingCashCentavos = this.previousEndingCashCentavos(
          request.branchId,
          request.cashierUserId,
          request.businessDate
        )
        if (existing.openingCashCentavos !== openingCashCentavos) {
          const row = this.db
            .prepare(
              `UPDATE daily_reports
                  SET opening_cash_centavos = ?, updated_at = ?
                WHERE id = ?
              RETURNING *`
            )
            .get(openingCashCentavos, new Date().toISOString(), existing.id) as DailyReportRow
          return reportRecord(row)
        }
      }
      return existing
    }

    const openingCashCentavos = this.previousEndingCashCentavos(
      request.branchId,
      request.cashierUserId,
      request.businessDate
    )
    const now = new Date().toISOString()
    const report = this.db.transaction(() => {
      const row = this.db
        .prepare(
          `INSERT INTO daily_reports (
            id, branch_id, cashier_user_id, business_date, opening_cash_centavos, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          RETURNING *`
        )
        .get(
          randomUUID(),
          request.branchId,
          request.cashierUserId,
          request.businessDate,
          openingCashCentavos,
          now,
          now
        ) as DailyReportRow
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

  private previousEndingCashCentavos(
    branchId: string,
    cashierUserId: string,
    businessDate: string
  ): number {
    const row = this.db
      .prepare(
        `SELECT COALESCE(SUM(d.value_centavos * c.quantity), 0) AS ending_cash_centavos
           FROM daily_reports previous
           LEFT JOIN daily_report_cash_counts c ON c.daily_report_id = previous.id
           LEFT JOIN cash_denominations d ON d.id = c.denomination_id
          WHERE previous.branch_id = ?
            AND previous.cashier_user_id = ?
            AND previous.business_date = date(?, '-1 day')
            AND previous.status <> 'VOIDED'`
      )
      .get(branchId, cashierUserId, businessDate) as { ending_cash_centavos: number }
    return row.ending_cash_centavos
  }

  createReceiptType(
    request: DailyReportReceiptTypeCreateRequest,
    createdByUserId: string
  ): DailyReportReceiptTypeRecord {
    const name = request.name.trim()
    const existing = this.db
      .prepare('SELECT id FROM receipt_types WHERE name = ? COLLATE NOCASE')
      .get(name) as { id: string } | undefined
    if (existing) throw new AppError('CONFLICT', 'A receipt type with that name already exists.')

    const now = new Date().toISOString()
    const row = this.db
      .prepare(
        `INSERT INTO receipt_types (
          id, code, name, is_system, is_default_visible, is_active, sort_order,
          created_by_user_id, created_at, updated_at
        ) VALUES (?, ?, ?, 0, 0, 1, ?, ?, ?, ?)
        RETURNING id, name, sort_order, is_default_visible, is_system`
      )
      .get(
        randomUUID(),
        `CUSTOM_${randomUUID()}`,
        name,
        this.nextReceiptTypeSortOrder(),
        createdByUserId,
        now,
        now
      ) as ReceiptTypeReferenceRow
    return {
      id: row.id,
      name: row.name,
      sortOrder: row.sort_order,
      isDefaultVisible: row.is_default_visible === 1,
      isSystem: row.is_system === 1
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

  private nextReceiptTypeSortOrder(): number {
    const row = this.db
      .prepare('SELECT COALESCE(MAX(sort_order), 0) + 10 AS sort_order FROM receipt_types')
      .get() as { sort_order: number }
    return row.sort_order
  }

  findByIdentity(branchId: string, cashierUserId: string, businessDate: string): DailyReportRecord | null {
    const row = this.db
      .prepare(
        `SELECT * FROM daily_reports
          WHERE branch_id = ? AND cashier_user_id = ? AND business_date = ?`
      )
      .get(branchId, cashierUserId, businessDate) as DailyReportRow | undefined
    return row ? reportRecord(row) : null
  }

  findById(id: string): DailyReportRecord | null {
    const row = this.db.prepare('SELECT * FROM daily_reports WHERE id = ?').get(id) as
      | DailyReportRow
      | undefined
    return row ? reportRecord(row) : null
  }

  listIncome(request: IncomeListRequest): IncomeEntryRecord[] {
    const where = ['1 = 1']
    const params: Record<string, string> = {}
    if (request.dailyReportId) {
      where.push('i.daily_report_id = @dailyReportId')
      params.dailyReportId = request.dailyReportId
    }
    if (request.branch && request.branch !== 'All Branch') {
      where.push('b.name = @branch')
      params.branch = request.branch
    }
    if (request.dateFrom) {
      where.push('dr.business_date >= @dateFrom')
      params.dateFrom = request.dateFrom
    }
    if (request.dateTo) {
      where.push('dr.business_date <= @dateTo')
      params.dateTo = request.dateTo
    }
    if (request.status) {
      where.push('i.status = @status')
      params.status = request.status
    }
    return (this.db
      .prepare(
        `SELECT i.*, b.name AS branch
           FROM income_entries i
           JOIN daily_reports dr ON dr.id = i.daily_report_id
           JOIN branches b ON b.id = dr.branch_id
          WHERE ${where.join(' AND ')}
          ORDER BY i.transaction_date DESC, i.created_at DESC, i.id DESC`
      )
      .all(params) as IncomeRow[]).map(incomeRecord)
  }

  incomeReportId(id: string): string | null {
    const row = this.db.prepare('SELECT daily_report_id FROM income_entries WHERE id = ?').get(id) as
      | { daily_report_id: string }
      | undefined
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
    return incomeRecord(row)
  }

  updateIncome(request: IncomeUpdateRequest): IncomeEntryRecord {
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
    return incomeRecord(row)
  }

  voidIncome(request: IncomeVoidRequest, actorUserId: string): IncomeEntryRecord {
    const now = new Date().toISOString()
    const row = this.db
      .prepare(
        `UPDATE income_entries SET status = 'VOIDED', voided_at = ?, voided_by_user_id = ?,
          void_reason = ?, updated_at = ? WHERE id = ? AND status = 'POSTED' RETURNING *`
      )
      .get(now, actorUserId, request.voidReason, now, request.id) as IncomeRow | undefined
    if (!row) throw new AppError('NOT_FOUND', 'Posted income entry was not found.')
    return incomeRecord(row)
  }

  listPayments(request: DailyReportPaymentListRequest): DailyReportPaymentEntryRecord[] {
    const where = ['1 = 1']
    const params: Record<string, string> = {}
    if (request.dailyReportId) {
      where.push('p.daily_report_id = @dailyReportId')
      params.dailyReportId = request.dailyReportId
    }
    if (request.branch && request.branch !== 'All Branch') {
      where.push('b.name = @branch')
      params.branch = request.branch
    }
    if (request.dateFrom) {
      where.push('dr.business_date >= @dateFrom')
      params.dateFrom = request.dateFrom
    }
    if (request.dateTo) {
      where.push('dr.business_date <= @dateTo')
      params.dateTo = request.dateTo
    }
    if (request.status) {
      where.push('p.status = @status')
      params.status = request.status
    }
    return (this.db
      .prepare(
        `SELECT p.*, b.name AS branch
           FROM daily_report_payment_entries p
           JOIN daily_reports dr ON dr.id = p.daily_report_id
           JOIN branches b ON b.id = dr.branch_id
          WHERE ${where.join(' AND ')}
          ORDER BY p.transaction_date DESC, p.created_at DESC, p.id DESC`
      )
      .all(params) as PaymentRow[]).map(paymentRecord)
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
          id, daily_report_id, payment_method_id, transaction_date, amount_centavos, reference_number,
          bank_name, payer_name, remarks, created_by_user_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
      )
      .get(
        randomUUID(),
        request.dailyReportId,
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
    return paymentRecord(row)
  }

  updatePayment(request: DailyReportPaymentUpdateRequest): DailyReportPaymentEntryRecord {
    const now = new Date().toISOString()
    const row = this.db
      .prepare(
        `UPDATE daily_report_payment_entries
            SET payment_method_id = ?, transaction_date = ?, amount_centavos = ?, reference_number = ?,
                bank_name = ?, payer_name = ?, remarks = ?, updated_at = ?
          WHERE id = ? AND status = 'POSTED' RETURNING *`
      )
      .get(
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
    return paymentRecord(row)
  }

  voidPayment(
    request: DailyReportPaymentVoidRequest,
    actorUserId: string
  ): DailyReportPaymentEntryRecord {
    const now = new Date().toISOString()
    const row = this.db
      .prepare(
        `UPDATE daily_report_payment_entries SET status = 'VOIDED', voided_at = ?, voided_by_user_id = ?,
          void_reason = ?, updated_at = ? WHERE id = ? AND status = 'POSTED' RETURNING *`
      )
      .get(now, actorUserId, request.voidReason, now, request.id) as PaymentRow | undefined
    if (!row) throw new AppError('NOT_FOUND', 'Posted payment entry was not found.')
    return paymentRecord(row)
  }

  updateSummary(request: DailyReportSummaryUpdateRequest): DailyReportSnapshotResponse {
    const update = this.db.transaction(() => {
      const now = new Date().toISOString()
      const report = this.db
        .prepare(
          `UPDATE daily_reports
              SET cash_remitted_centavos = ?, updated_at = ?
            WHERE id = ?
          RETURNING id`
        )
        .get(
          request.cashRemittedCentavos,
          now,
          request.dailyReportId
        ) as { id: string } | undefined
      if (!report) throw new AppError('NOT_FOUND', 'Daily report was not found.')

      const upsertReceipt = this.db.prepare(
        `INSERT INTO daily_receipt_totals (
          id, daily_report_id, receipt_type_id, quantity, amount_centavos, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(daily_report_id, receipt_type_id) DO UPDATE SET
          quantity = excluded.quantity, amount_centavos = excluded.amount_centavos, updated_at = excluded.updated_at`
      )
      for (const item of request.receiptTotals) {
        upsertReceipt.run(
          randomUUID(),
          request.dailyReportId,
          item.receiptTypeId,
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
    const incomeEntries = this.listIncome({ dailyReportId })
    const paymentEntries = this.listPayments({ dailyReportId })
    const receiptTotals = (this.db
      .prepare('SELECT * FROM daily_receipt_totals WHERE daily_report_id = ? ORDER BY receipt_type_id')
      .all(dailyReportId) as ReceiptTotalRow[]).map(receiptTotalRecord)
    const cashOutEntries = (this.db
      .prepare(
        `SELECT * FROM cash_out_entries WHERE daily_report_id = ?
         ORDER BY transaction_date DESC, created_at DESC, id DESC`
      )
      .all(dailyReportId) as CashOutRow[]).map(cashOutRecord)
    const deductions = (this.db
      .prepare('SELECT * FROM daily_report_deductions WHERE daily_report_id = ? ORDER BY deduction_type_id')
      .all(dailyReportId) as DeductionRow[]).map(deductionRecord)
    const cashCounts = (this.db
      .prepare('SELECT * FROM daily_report_cash_counts WHERE daily_report_id = ? ORDER BY denomination_id')
      .all(dailyReportId) as CashCountRow[]).map(cashCountRecord)
    const receiptTypes = (this.db
      .prepare(
        'SELECT id, name, sort_order, is_default_visible FROM receipt_types WHERE is_active = 1 ORDER BY sort_order, name'
      )
      .all() as ReceiptTypeReferenceRow[]).map((row) => ({
      id: row.id,
      name: row.name,
      sortOrder: row.sort_order,
      isDefaultVisible:
        row.is_default_visible === 1 &&
        !receiptTypesHiddenByDefault.has(row.name.trim().toUpperCase()),
      isSystem: row.is_system === 1
    }))
    const deductionTypes = (this.db
      .prepare('SELECT id, name FROM deduction_types WHERE is_active = 1 ORDER BY name')
      .all() as DeductionTypeRow[]).map((row, index) => ({
      id: row.id,
      name: row.name,
      sortOrder: index
    }))
    const cashDenominations = (this.db
      .prepare('SELECT id, value_centavos, sort_order FROM cash_denominations WHERE is_active = 1 ORDER BY sort_order')
      .all() as CashDenominationReferenceRow[]).map((row) => ({
      id: row.id,
      valueCentavos: row.value_centavos,
      sortOrder: row.sort_order
    }))
    const totals = this.db
      .prepare(
        `SELECT
          COALESCE((SELECT SUM(amount_centavos) FROM daily_receipt_totals WHERE daily_report_id = ?), 0) AS receipt_centavos,
          COALESCE((SELECT SUM(i.amount_centavos) FROM income_entries i WHERE i.daily_report_id = ? AND i.status = 'POSTED'), 0) AS income_centavos,
          COALESCE((SELECT SUM(amount_centavos) FROM daily_report_deductions WHERE daily_report_id = ?), 0) AS deduction_centavos,
          COALESCE((SELECT SUM(amount_centavos) FROM cash_out_entries WHERE daily_report_id = ? AND status = 'POSTED'), 0) AS cash_out_centavos,
          COALESCE((SELECT SUM(amount_centavos) FROM expenses WHERE report_id = ? AND status = 'POSTED'), 0) AS legacy_expense_cash_out_centavos,
          COALESCE((SELECT SUM(p.amount_centavos)
                      FROM in_house_payments p
                      JOIN installment_contracts c ON c.id = p.contract_id
                     WHERE p.status = 'POSTED'
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
          COALESCE((SELECT SUM(d.value_centavos * c.quantity) FROM daily_report_cash_counts c JOIN cash_denominations d ON d.id = c.denomination_id WHERE c.daily_report_id = ?), 0) AS physical_cash_centavos
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
