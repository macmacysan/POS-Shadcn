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
    updatedAt: row.updated_at
  }
}

export class ExpenseRepository {
  constructor(private readonly db: Database.Database) {}

  findPage(request: ExpenseListRequest): { rows: ExpenseRecord[]; totalRows: number } {
    const where = ["e.status = 'POSTED'"]
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
                  e.amount_centavos, e.created_at, e.updated_at
             FROM expenses e
             JOIN daily_reports dr ON dr.id = e.report_id
             JOIN branches b ON b.id = dr.branch_id
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
                e.amount_centavos, e.created_at, e.updated_at
           FROM expenses e
           JOIN daily_reports dr ON dr.id = e.report_id
           JOIN branches b ON b.id = dr.branch_id
          WHERE e.id = ?`
      )
      .get(id) as ExpenseRow | undefined
    return row ? mapExpense(row) : null
  }

  create(input: ExpenseCreateInput): ExpenseRecord {
    const report = this.db.prepare('SELECT id FROM reports WHERE id = ?').get(input.reportId)
    if (!report) throw new AppError('NOT_FOUND', 'Report was not found.')

    const id = randomUUID()
    const timestamp = new Date().toISOString()
    this.db
      .prepare(
        `INSERT INTO expenses (
          id, report_id, type, description, category, receipt_no, vat,
          amount_centavos, created_at, updated_at
        ) VALUES (@id, @reportId, @type, @description, @category, @receiptNo, @vat,
                  @amountCentavos, @createdAt, @updatedAt)`
      )
      .run({ ...input, id, createdAt: timestamp, updatedAt: timestamp })

    return this.findById(id) as ExpenseRecord
  }

  update(input: ExpenseUpdateInput): ExpenseRecord {
    const timestamp = new Date().toISOString()
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
    return this.findById(input.id) as ExpenseRecord
  }

  remove(ids: string[], actorUserId: string, reason: string): void {
    const voidMany = this.db.transaction(() => {
      const now = new Date().toISOString()
      const statement = this.db.prepare(
        `UPDATE expenses SET status = 'VOIDED', voided_at = ?, voided_by_user_id = ?, void_reason = ?
          WHERE id = ? AND status = 'POSTED'`
      )
      for (const id of ids) statement.run(now, actorUserId, reason, id)
    })
    voidMany()
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
