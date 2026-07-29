import type { DashboardGetRequest, DashboardOverview } from '../../shared/contracts'
import { DashboardRepository } from '../database/dashboard-repository'
import { AuthService } from './auth-service'

export class DashboardService {
  constructor(
    private readonly repository: DashboardRepository,
    private readonly auth: AuthService
  ) {}

  getOverview(request: DashboardGetRequest): DashboardOverview {
    const user = this.auth.requireSession()
    const branch = user.role === 'ADMIN' ? request.branch : user.branch
    return this.repository.getOverview(request.businessDate, {
      branch,
      label: branch ? `${branch} Branch` : 'All branches'
    })
  }
}
