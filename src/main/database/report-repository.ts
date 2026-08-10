import type Database from 'better-sqlite3'

import type { AuthenticatedUser, ReportReconciliationUpsertRequest, ReportRecord } from '../../shared/contracts'
import { AppError } from './errors'

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

  upsertReconciliation(
    request: ReportReconciliationUpsertRequest,
    user: AuthenticatedUser
  ): void {
    const report = this.findById(request.reportId)
    if (!report) throw new AppError('NOT_FOUND', 'Cashier report was not found.')
    if (user.role !== 'ADMIN' && report.cashierId !== user.id) {
      throw new AppError('FORBIDDEN', 'You cannot reconcile another cashier report.')
    }
    this.db
      .prepare(
        `INSERT INTO report_reconciliations (
          report_id, physical_cash_centavos, cash_remitted_centavos, cash_variance_centavos, updated_at
        ) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(report_id) DO UPDATE SET
          physical_cash_centavos = excluded.physical_cash_centavos,
          cash_remitted_centavos = excluded.cash_remitted_centavos,
          cash_variance_centavos = excluded.cash_variance_centavos,
          updated_at = excluded.updated_at`
      )
      .run(
        request.reportId,
        request.physicalCashCentavos,
        request.cashRemittedCentavos,
        request.cashVarianceCentavos,
        new Date().toISOString()
      )
  }
}
