import type Database from 'better-sqlite3'

import type { ReportRecord } from '../../shared/contracts'

type ReportRow = {
  id: string
  branch_id: string
  cashier_id: string
  business_date: string
  status: ReportRecord['status']
}

function mapReport(row: ReportRow): ReportRecord {
  return {
    reportId: row.id,
    branchId: row.branch_id,
    cashierId: row.cashier_id,
    businessDate: row.business_date,
    status: row.status
  }
}

export class ReportRepository {
  constructor(private readonly db: Database.Database) {}

  findById(id: string): ReportRecord | null {
    const row = this.db
      .prepare(
        `SELECT id, branch_id, cashier_id, business_date, status
           FROM reports
          WHERE id = ?`
      )
      .get(id) as ReportRow | undefined

    return row ? mapReport(row) : null
  }
}
