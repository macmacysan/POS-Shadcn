import type { EntryHistoryListRequest } from '../../shared/contracts'
import { AppError } from '../database/errors'
import { AuditRepository } from '../database/audit-repository'
import { DailyReportRepository } from '../database/daily-report-repository'
import { ExpenseRepository } from '../database/expense-repository'
import { AuthService } from './auth-service'

export class EntryHistoryService {
  constructor(
    private readonly audit: AuditRepository,
    private readonly expenses: ExpenseRepository,
    private readonly reports: DailyReportRepository,
    private readonly auth: AuthService
  ) {}

  list(request: EntryHistoryListRequest) {
    const user = this.auth.requireSession()
    const reportId =
      request.entityType === 'EXPENSE'
        ? this.expenses.reportId(request.entityId)
        : request.entityType === 'INCOME'
          ? this.reports.incomeReportId(request.entityId)
          : this.reports.paymentReportId(request.entityId)
    if (!reportId) throw new AppError('NOT_FOUND', 'Entry was not found.')
    const report = this.reports.findById(reportId)
    if (!report) throw new AppError('NOT_FOUND', 'Report was not found.')
    if (user.role !== 'ADMIN' && this.reports.branchIdForReport(reportId) !== user.branchId) {
      throw new AppError('FORBIDDEN', 'You cannot access this entry.')
    }
    return { rows: this.audit.list(request.entityType, request.entityId) }
  }
}
