import type { ReportReconciliationUpsertRequest } from '../../shared/contracts'
import { ReportRepository } from '../database/report-repository'
import { AuthService } from './auth-service'

export class ReportService {
  constructor(
    private readonly repository: ReportRepository,
    private readonly auth: AuthService
  ) {}

  getById(reportId: string) {
    return this.repository.findById(reportId)
  }

  upsertReconciliation(request: ReportReconciliationUpsertRequest): void {
    this.repository.upsertReconciliation(request, this.auth.requireSession())
  }
}
