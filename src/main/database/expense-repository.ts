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
import { parseAmountToCentavos } from '../../shared/contracts'
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
  created_by_first_name: string
  cashier_user_id: string
  business_date: string
  source: 'local' | 'google-cache'
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
    createdByFirstName: row.created_by_first_name,
    cashierUserId: row.cashier_user_id,
    cashierName: row.created_by_name,
    businessDate: row.business_date,
    source: row.source
  }
}

export class ExpenseRepository {
  constructor(private readonly db: Database.Database) {}

  findPage(request: ExpenseListRequest): { rows: ExpenseRecord[]; totalRows: number } {
    const where = [
      request.includeVoided ? "status IN ('POSTED', 'VOIDED')" : "status = 'POSTED'"
    ]
    const params: Record<string, string | number> = {}

    if (request.reportId) {
      where.push("(source = 'google-cache' OR report_id = @reportId)")
      params.reportId = request.reportId
    }
    if (request.branch && request.branch !== 'All Branch') {
      where.push('branch = @branch')
      params.branch = request.branch
    }
    if (request.dateFrom) {
      where.push('business_date >= @dateFrom')
      params.dateFrom = request.dateFrom
    }
    if (request.dateTo) {
      where.push('business_date <= @dateTo')
      params.dateTo = request.dateTo
    }
    if (request.filters.branch) {
      where.push('branch = @branchFilter')
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
      where.push('LOWER(category) LIKE @category')
      params.category = `%${request.filters.category.toLowerCase()}%`
    }
    if (request.filters.createdByName) {
      where.push('created_by_name = @createdByName')
      params.createdByName = request.filters.createdByName
    }
    if (request.filters.receiptNo) {
      where.push('LOWER(receipt_no) LIKE @receiptNo')
      params.receiptNo = `%${request.filters.receiptNo.toLowerCase()}%`
    }
    if (request.filters.amountMin) {
      where.push('amount_centavos >= @amountMin')
      params.amountMin = parseAmountToCentavos(request.filters.amountMin)
    }
    if (request.filters.amountMax) {
      where.push('amount_centavos <= @amountMax')
      params.amountMax = parseAmountToCentavos(request.filters.amountMax)
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

    const source = `
      WITH all_expenses AS (
        SELECT e.id, e.report_id, b.name AS branch, e.type, e.description, e.category, e.receipt_no, e.vat,
               e.amount_centavos, e.created_at, e.updated_at, e.status, e.voided_at,
               e.voided_by_user_id, e.void_reason, e.created_by_user_id,
               u.display_name AS created_by_name,
               COALESCE(NULLIF(u.first_name, ''), u.display_name) AS created_by_first_name,
               dr.cashier_user_id, dr.business_date, 'local' AS source
          FROM expenses e
          JOIN daily_reports dr ON dr.id = e.report_id
          JOIN branches b ON b.id = dr.branch_id
          LEFT JOIN users u ON u.id = e.created_by_user_id
        UNION ALL
        SELECT json_extract(c.payload_json, '$.id'),
               COALESCE(json_extract(c.payload_json, '$.reportId'), json_extract(c.payload_json, '$.report_id')),
               c.source_branch,
               json_extract(c.payload_json, '$.type'),
               json_extract(c.payload_json, '$.description'),
               json_extract(c.payload_json, '$.category'),
               COALESCE(json_extract(c.payload_json, '$.receiptNo'), json_extract(c.payload_json, '$.receipt_no')),
               json_extract(c.payload_json, '$.vat'),
               CAST(COALESCE(json_extract(c.payload_json, '$.amountCentavos'), json_extract(c.payload_json, '$.amount_centavos')) AS INTEGER),
               COALESCE(json_extract(c.payload_json, '$.createdAt'), json_extract(c.payload_json, '$.created_at')),
               COALESCE(json_extract(c.payload_json, '$.updatedAt'), json_extract(c.payload_json, '$.updated_at')),
               json_extract(c.payload_json, '$.status'),
               NULLIF(COALESCE(json_extract(c.payload_json, '$.voidedAt'), json_extract(c.payload_json, '$.voided_at')), ''),
               NULLIF(COALESCE(json_extract(c.payload_json, '$.voidedByUserId'), json_extract(c.payload_json, '$.voided_by_user_id')), ''),
               NULLIF(COALESCE(json_extract(c.payload_json, '$.voidReason'), json_extract(c.payload_json, '$.void_reason')), ''),
               COALESCE(json_extract(c.payload_json, '$.createdByUserId'), json_extract(c.payload_json, '$.created_by_user_id')),
               COALESCE(json_extract(c.payload_json, '$.createdByName'), json_extract(c.payload_json, '$.created_by_name')),
               COALESCE(json_extract(c.payload_json, '$.createdByFirstName'), json_extract(c.payload_json, '$.created_by_first_name')),
               COALESCE(json_extract(c.payload_json, '$.cashierUserId'), json_extract(c.payload_json, '$.cashier_user_id')),
               COALESCE(json_extract(c.payload_json, '$.businessDate'), json_extract(c.payload_json, '$.business_date')),
               'google-cache' AS source
          FROM google_sheet_branch_cache c
         WHERE c.sheet_name = 'Expenses'
           AND json_extract(c.payload_json, '$.id') IS NOT NULL
           AND COALESCE(json_extract(c.payload_json, '$.reportId'), json_extract(c.payload_json, '$.report_id')) IS NOT NULL
           AND json_extract(c.payload_json, '$.type') IS NOT NULL
           AND json_extract(c.payload_json, '$.description') IS NOT NULL
           AND json_extract(c.payload_json, '$.category') IS NOT NULL
           AND COALESCE(json_extract(c.payload_json, '$.amountCentavos'), json_extract(c.payload_json, '$.amount_centavos')) IS NOT NULL
           AND COALESCE(json_extract(c.payload_json, '$.createdAt'), json_extract(c.payload_json, '$.created_at')) IS NOT NULL
           AND COALESCE(json_extract(c.payload_json, '$.updatedAt'), json_extract(c.payload_json, '$.updated_at')) IS NOT NULL
           AND COALESCE(json_extract(c.payload_json, '$.createdByUserId'), json_extract(c.payload_json, '$.created_by_user_id')) IS NOT NULL
           AND COALESCE(json_extract(c.payload_json, '$.createdByName'), json_extract(c.payload_json, '$.created_by_name')) IS NOT NULL
           AND COALESCE(json_extract(c.payload_json, '$.cashierUserId'), json_extract(c.payload_json, '$.cashier_user_id')) IS NOT NULL
           AND COALESCE(json_extract(c.payload_json, '$.businessDate'), json_extract(c.payload_json, '$.business_date')) IS NOT NULL
           AND c.source_branch <> ''
           AND json_extract(c.payload_json, '$.status') IN ('POSTED', 'VOIDED')
           AND NOT EXISTS (
             SELECT 1 FROM expenses e WHERE e.id = json_extract(c.payload_json, '$.id')
           )
      )`

    const readPage = this.db.transaction(() => {
      const totalRows = (
        this.db
          .prepare(
            `${source}
             SELECT COUNT(*) AS count FROM all_expenses WHERE ${whereSql}`
          )
          .get(params) as {
          count: number
        }
      ).count
      const rows = this.db
        .prepare(
          `${source}
           SELECT * FROM all_expenses
            WHERE ${whereSql}
            ORDER BY ${sortColumn} ${sortDirection}, id ${sortDirection}
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
                u.display_name AS created_by_name, COALESCE(NULLIF(u.first_name, ''), u.display_name) AS created_by_first_name, dr.cashier_user_id AS cashier_user_id,
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
    const report = this.db.prepare('SELECT id FROM daily_reports WHERE id = ?').get(input.reportId)
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

  void(ids: string[], actorUserId: string, reason: string): void {
    const voidMany = this.db.transaction(() => {
      const statement = this.db.prepare(
        `UPDATE expenses
            SET status = 'VOIDED', voided_at = ?, voided_by_user_id = ?, void_reason = ?, updated_at = ?
          WHERE id = ? AND status = 'POSTED'`
      )
      const now = new Date().toISOString()
      for (const id of ids) {
        const before = this.findById(id)
        const result = statement.run(now, actorUserId, reason, now, id)
        if (result.changes === 0) throw new AppError('CONFLICT', 'Expense was already voided.')
        if (before) {
          recordAudit(this.db, {
            actorUserId,
            entityType: 'EXPENSE',
            entityId: id,
            action: 'VOIDED',
            reason,
            changes: [
              { field: 'status', oldValue: before.status, newValue: 'VOIDED' },
              { field: 'voidReason', oldValue: null, newValue: reason }
            ]
          })
          this.db
            .prepare('UPDATE daily_reports SET updated_at = ?, updated_by_user_id = ? WHERE id = ?')
            .run(now, actorUserId, before.reportId)
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

  branchIdForReport(reportId: string): string | null {
    const row = this.db
      .prepare('SELECT branch_id FROM daily_reports WHERE id = ?')
      .get(reportId) as { branch_id: string } | undefined
    return row?.branch_id ?? null
  }

  branchNameForId(branchId: string | null): string | null {
    if (!branchId) return null
    const row = this.db.prepare('SELECT name FROM branches WHERE id = ?').get(branchId) as
      { name: string } | undefined
    return row?.name ?? null
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
