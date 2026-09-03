import type { ReportReconciliationUpsertRequest } from '../../shared/contracts'
import { ReportRepository } from '../database/report-repository'
import { AuthService } from './auth-service'
import { AppError } from '../database/errors'

export class ReportService {
  constructor(
    private readonly repository: ReportRepository,
    private readonly auth: AuthService
  ) {}

  getById(reportId: string) {
    this.auth.requireCashierWorkspace()
    return this.repository.findById(reportId)
  }

  upsertReconciliation(request: ReportReconciliationUpsertRequest): void {
    const user = this.auth.requireCashierWorkspace()
    const report = this.repository.findById(request.reportId)
    if (!report) throw new AppError('NOT_FOUND', 'Cashier report was not found.')
    this.auth.requireOwnBranch(report.branchId, 'Administrators have read-only report access.')
    this.repository.upsertReconciliation(request, user)
  }
}
