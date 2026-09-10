import { format } from 'date-fns'

import type { LoginPreview } from '../../shared/contracts'
import { DailyReportRepository } from '../database/daily-report-repository'
import { InstallmentRepository } from '../database/installment-repository'
import { UserRepository } from '../database/user-repository'

export class LoginPreviewService {
  constructor(
    private readonly users: UserRepository,
    private readonly dailyReports: DailyReportRepository,
    private readonly installments: InstallmentRepository
  ) {}

  get(): LoginPreview | null {
    const branch = this.users.configuredCashierLoginBranch()
    if (!branch) return null

    const days = this.dailyReports.listCalendar({
      branchId: branch.id,
      cashierUserId: '',
      month: format(new Date(), 'yyyy-MM')
    })
    const activeInstallments = this.installments.list({
      branch: branch.name,
      view: 'active',
      search: ''
    }).rows.length
    const hasCashVariance = (value: number): boolean => Math.abs(value) >= 100

    return {
      branch: branch.name as LoginPreview['branch'],
      month: format(new Date(), 'yyyy-MM'),
      activeInstallments,
      overdueInstallments: this.installments.getAttentionSummary(branch.name).overdueCount,
      cashVarianceDays: days.filter(
        (day) => day.hasData && hasCashVariance(day.cashVarianceCentavos)
      ).length,
      reportsNotSent: days.filter((day) => day.hasData && !day.telegramSubmittedAt).length,
      days: days.map((day) => ({
        businessDate: day.businessDate,
        hasData: day.hasData,
        hasCashVariance: hasCashVariance(day.cashVarianceCentavos),
        telegramSubmitted: Boolean(day.telegramSubmittedAt)
      }))
    }
  }
}
