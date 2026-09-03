import type { DashboardGetRequest, DashboardOverview, PdfReportCharts } from '../../shared/contracts'
import { DashboardRepository } from '../database/dashboard-repository'
import { AuthService } from './auth-service'

export class DashboardService {
  constructor(
    private readonly repository: DashboardRepository,
    private readonly auth: AuthService
  ) {}

  getOverview(request: DashboardGetRequest): DashboardOverview {
    const user = this.auth.requireCashierWorkspace()
    const branch = (user.role === 'ADMIN' ? request.branch : user.branch) ?? null
    return this.repository.getOverview(request.businessDate, request.rangeDays, {
      branch,
      label: branch ? `${branch} Branch` : 'All branches'
    })
  }

  getPdfCharts(request: Omit<DashboardGetRequest, 'rangeDays'>): PdfReportCharts {
    const user = this.auth.requireCashierWorkspace()
    const branch = (user.role === 'ADMIN' ? request.branch : user.branch) ?? null
    return this.repository.getPdfCharts(request.businessDate, { branch, label: '' })
  }
}
