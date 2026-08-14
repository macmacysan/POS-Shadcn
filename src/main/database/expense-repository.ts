import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'

import type {
  ExpenseCreateInput,
  ExpenseListRequest,
  ExpenseRecord,
  ExpenseSummaryTotals,
  ExpenseSortField,
  ExpenseUpdateInput
} from '../../shared/contracts'
import { AppError } from './errors'
import { recordAudit } from './audit-repository'

type ExpenseRow = {
  id: string
  report_id: string
  branch: string
  type: ExpenseRecord['type']
  description: string
  category: ExpenseRecord['category']
  receipt_no: string
  vat: ExpenseRecord['vat']
  amount_centavos: number
  created_at: string
  updated_at: string
  status: ExpenseRecord['status']
  voided_at: string | null
  voided_by_user_id: string | null
  void_reason: string | null
  created_by_user_id: string
  created_by_name: string
  cashier_user_id: string
  business_date: string
}

const sortColumns: Record<ExpenseSortField, string> = {
  type: 'type',
  description: 'description',
  category: 'category',
  receiptNo: 'receipt_no',
  vat: 'vat',
  amountCentavos: 'amount_centavos',
  createdAt: 'created_at'
}

function mapExpense(row: ExpenseRow): ExpenseRecord {
  return {
    id: row.id,
    reportId: row.report_id,
    branch: row.branch,
    type: row.type,
    description: row.description,
    category: row.category,
    receiptNo: row.receipt_no,
    vat: row.vat,
    amountCentavos: row.amount_centavos,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
    voidedAt: row.voided_at,
    voidedByUserId: row.voided_by_user_id,
    voidReason: row.void_reason,
    createdByUserId: row.created_by_user_id,
    createdByName: row.created_by_name,
    cashierUserId: row.cashier_user_id,
    cashierName: row.created_by_name,
    businessDate: row.business_date
  }
}

export class ExpenseRepository {
  constructor(private readonly db: Database.Database) {}

  findPage(request: ExpenseListRequest): { rows: ExpenseRecord[]; totalRows: number } {
    const where = [
      request.includeVoided ? "e.status IN ('POSTED', 'VOIDED')" : "e.status = 'POSTED'"
    ]
    const params: Record<string, string | number> = {}

    if (request.reportId) {
      where.push('e.report_id = @reportId')
      params.reportId = request.reportId
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
    if (request.filters.branch) {
      where.push('b.name = @branchFilter')
      params.branchFilter = request.filters.branch
    }

    if (request.search) {
      where.push(`(
        LOWER(type) LIKE @search OR
        LOWER(description) LIKE @search OR
        LOWER(category) LIKE @search OR
        LOWER(receipt_no) LIKE @search OR
        LOWER(vat) LIKE @search
      )`)
      params.search = `%${request.search.toLowerCase()}%`
    }
    if (request.filters.type) {
      where.push('type = @type')
      params.type = request.filters.type
    }
    if (request.filters.category) {
      where.push('category = @category')
      params.category = request.filters.category
    }
    if (request.filters.vat) {
      where.push('vat = @vat')
      params.vat = request.filters.vat
    }

    const whereSql = where.join(' AND ')
    const sorting = request.sorting[0]
    const sortColumn = sorting ? sortColumns[sorting.field] : 'created_at'
    const sortDirection = sorting?.direction === 'asc' ? 'ASC' : 'DESC'
    const offset = request.pageIndex * request.pageSize

    const readPage = this.db.transaction(() => {
      const totalRows = (
        this.db
          .prepare(
            `SELECT COUNT(*) AS count
               FROM expenses e
               JOIN daily_reports dr ON dr.id = e.report_id
               JOIN branches b ON b.id = dr.branch_id
              WHERE ${whereSql}`
          )
          .get(params) as {
          count: number
        }
      ).count
      const rows = this.db
        .prepare(
          `SELECT e.id, e.report_id, b.name AS branch, e.type, e.description, e.category, e.receipt_no, e.vat,
                  e.amount_centavos, e.created_at, e.updated_at, e.status, e.voided_at,
                  e.voided_by_user_id, e.void_reason, e.created_by_user_id,
                  u.display_name AS created_by_name, dr.cashier_user_id AS cashier_user_id,
                  dr.business_date
             FROM expenses e
             JOIN daily_reports dr ON dr.id = e.report_id
             JOIN branches b ON b.id = dr.branch_id
             LEFT JOIN users u ON u.id = e.created_by_user_id
            WHERE ${whereSql}
            ORDER BY e.${sortColumn} ${sortDirection}, e.id ${sortDirection}
            LIMIT @limit OFFSET @offset`
        )
        .all({ ...params, limit: request.pageSize, offset }) as ExpenseRow[]

      return { rows: rows.map(mapExpense), totalRows }
    })

    return readPage()
  }

  findById(id: string): ExpenseRecord | null {
    const row = this.db
      .prepare(
        `SELECT e.id, e.report_id, b.name AS branch, e.type, e.description, e.category, e.receipt_no, e.vat,
                e.amount_centavos, e.created_at, e.updated_at, e.status, e.voided_at,
                e.voided_by_user_id, e.void_reason, e.created_by_user_id,
                u.display_name AS created_by_name, dr.cashier_user_id AS cashier_user_id,
                dr.business_date
           FROM expenses e
           JOIN daily_reports dr ON dr.id = e.report_id
           JOIN branches b ON b.id = dr.branch_id
           LEFT JOIN users u ON u.id = e.created_by_user_id
          WHERE e.id = ?`
      )
      .get(id) as ExpenseRow | undefined
    return row ? mapExpense(row) : null
  }

  create(input: ExpenseCreateInput, actorUserId: string): ExpenseRecord {
    const report = this.db.prepare('SELECT id FROM reports WHERE id = ?').get(input.reportId)
    if (!report) throw new AppError('NOT_FOUND', 'Report was not found.')

    const id = randomUUID()
    const timestamp = new Date().toISOString()
    const create = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO expenses (
          id, report_id, type, description, category, receipt_no, vat,
          amount_centavos, created_by_user_id, created_at, updated_at
        ) VALUES (@id, @reportId, @type, @description, @category, @receiptNo, @vat,
                  @amountCentavos, @createdByUserId, @createdAt, @updatedAt)`
        )
        .run({
          ...input,
          id,
          createdByUserId: actorUserId,
          createdAt: timestamp,
          updatedAt: timestamp
        })
      recordAudit(this.db, {
        actorUserId,
        entityType: 'EXPENSE',
        entityId: id,
        action: input.duplicatedFromId ? 'DUPLICATED' : 'CREATED',
        changes: [
          ['type', null, input.type],
          ['description', null, input.description],
          ['category', null, input.category],
          ['receiptNo', null, input.receiptNo],
          ['vat', null, input.vat],
          ['amountCentavos', null, String(input.amountCentavos)],
          ...(input.duplicatedFromId
            ? [['duplicatedFromId', null, input.duplicatedFromId] as const]
            : [])
        ].map(([field, oldValue, newValue]) => ({ field: String(field), oldValue, newValue }))
      })
    })
    create()

    return this.findById(id) as ExpenseRecord
  }

  update(input: ExpenseUpdateInput, actorUserId: string): ExpenseRecord {
    const before = this.findById(input.id)
    if (!before) throw new AppError('NOT_FOUND', 'Expense was not found.')
    const timestamp = new Date().toISOString()
    const update = this.db.transaction(() => {
      const result = this.db
        .prepare(
          `UPDATE expenses
            SET type = @type,
                description = @description,
                category = @category,
                receipt_no = @receiptNo,
                vat = @vat,
                amount_centavos = @amountCentavos,
                updated_at = @updatedAt
          WHERE id = @id AND status = 'POSTED'`
        )
        .run({ ...input, updatedAt: timestamp })

      if (result.changes === 0) throw new AppError('NOT_FOUND', 'Expense was not found.')
      recordAudit(this.db, {
        actorUserId,
        entityType: 'EXPENSE',
        entityId: input.id,
        action: 'UPDATED',
        changes: [
          ['type', before.type, input.type],
          ['description', before.description, input.description],
          ['category', before.category, input.category],
          ['receiptNo', before.receiptNo, input.receiptNo],
          ['vat', before.vat, input.vat],
          ['amountCentavos', String(before.amountCentavos), String(input.amountCentavos)]
        ].map(([field, oldValue, newValue]) => ({ field, oldValue, newValue }))
      })
    })
    update()
    return this.findById(input.id) as ExpenseRecord
  }

  remove(ids: string[], actorUserId: string, reason: string): void {
    const voidMany = this.db.transaction(() => {
      const now = new Date().toISOString()
      const statement = this.db.prepare(
        `UPDATE expenses SET status = 'VOIDED', voided_at = ?, voided_by_user_id = ?, void_reason = ?
          WHERE id = ? AND status = 'POSTED'`
      )
      for (const id of ids) {
        const before = this.findById(id)
        statement.run(now, actorUserId, reason, id)
        if (before) {
          recordAudit(this.db, {
            actorUserId,
            entityType: 'EXPENSE',
            entityId: id,
            action: 'VOIDED',
            reason,
            changes: [{ field: 'status', oldValue: before.status, newValue: 'VOIDED' }]
          })
        }
      }
    })
    voidMany()
  }

  reportId(id: string): string | null {
    const row = this.db.prepare('SELECT report_id FROM expenses WHERE id = ?').get(id) as
      { report_id: string } | undefined
    return row?.report_id ?? null
  }

  findSummaryTotals(reportId: string): ExpenseSummaryTotals {
    const row = this.db
      .prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN type IN ('Company Expenses', 'Operating')
             THEN amount_centavos ELSE 0 END), 0) AS company_expenses_centavos,
           COALESCE(SUM(CASE WHEN type = 'Drawings'
             THEN amount_centavos ELSE 0 END), 0) AS drawings_centavos,
           COALESCE(SUM(CASE WHEN type IN ('Purchases', 'Supply')
             THEN amount_centavos ELSE 0 END), 0) AS purchases_centavos,
           COALESCE(SUM(CASE WHEN type = 'Receivables'
             THEN amount_centavos ELSE 0 END), 0) AS receivables_centavos
         FROM expenses
         WHERE report_id = ? AND status = 'POSTED'`
      )
      .get(reportId) as {
      company_expenses_centavos: number
      drawings_centavos: number
      purchases_centavos: number
      receivables_centavos: number
    }

    return {
      companyExpensesCentavos: row.company_expenses_centavos,
      drawingsCentavos: row.drawings_centavos,
      purchasesCentavos: row.purchases_centavos,
      receivablesCentavos: row.receivables_centavos
    }
  }
}
