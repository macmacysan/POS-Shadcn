import type {
  AuthenticatedUser,
  DailyReportPaymentCreateRequest,
  DailyReportPaymentListRequest,
  DailyReportPaymentUpdateRequest,
  DailyReportPaymentVoidRequest,
  DailyReportResolveActiveRequest,
  DailyReportSnapshotRequest,
  IncomeCreateRequest,
  IncomeListRequest,
  IncomeUpdateRequest,
  IncomeVoidRequest
} from '../../shared/contracts'
import { AppError } from '../database/errors'
import { DailyReportRepository } from '../database/daily-report-repository'
import { AuthService } from './auth-service'

export class DailyReportService {
  constructor(
    private readonly repository: DailyReportRepository,
    private readonly auth: AuthService
  ) {}

  resolveActive(request: DailyReportResolveActiveRequest) {
    const user = this.auth.requireSession()
    const branchId = user.role === 'ADMIN' ? request.branchId : this.repository.branchIdForUser(user.id)
    if (!branchId) throw new AppError('FORBIDDEN', 'Your account is not assigned to a branch.')
    return this.repository.resolveActive({
      ...request,
      branchId,
      cashierUserId: user.role === 'ADMIN' ? request.cashierUserId : user.id
    })
  }

  getSnapshot(request: DailyReportSnapshotRequest) {
    this.requireReportAccess(request.dailyReportId, this.auth.requireSession())
    return this.repository.snapshot(request.dailyReportId)
  }

  listIncome(request: IncomeListRequest) {
    this.requireReportAccess(request.dailyReportId, this.auth.requireSession())
    return { rows: this.repository.listIncome(request) }
  }

  createIncome(request: IncomeCreateRequest) {
    const user = this.auth.requireSession()
    this.requireReportAccess(request.dailyReportId, user)
    return this.repository.createIncome(request, user.id)
  }

  updateIncome(request: IncomeUpdateRequest) {
    const user = this.auth.requireSession()
    this.requireEntryAccess(this.repository.incomeReportId(request.id), user)
    return this.repository.updateIncome(request)
  }

  voidIncome(request: IncomeVoidRequest) {
    const user = this.auth.requireSession()
    this.requireEntryAccess(this.repository.incomeReportId(request.id), user)
    return this.repository.voidIncome(request, user.id)
  }

  listPayments(request: DailyReportPaymentListRequest) {
    this.requireReportAccess(request.dailyReportId, this.auth.requireSession())
    return { rows: this.repository.listPayments(request) }
  }

  createPayment(request: DailyReportPaymentCreateRequest) {
    const user = this.auth.requireSession()
    this.requireReportAccess(request.dailyReportId, user)
    return this.repository.createPayment(request, user.id)
  }

  updatePayment(request: DailyReportPaymentUpdateRequest) {
    const user = this.auth.requireSession()
    this.requireEntryAccess(this.repository.paymentReportId(request.id), user)
    return this.repository.updatePayment(request)
  }

  voidPayment(request: DailyReportPaymentVoidRequest) {
    const user = this.auth.requireSession()
    this.requireEntryAccess(this.repository.paymentReportId(request.id), user)
    return this.repository.voidPayment(request, user.id)
  }

  private requireEntryAccess(reportId: string | null, user: AuthenticatedUser): void {
    if (!reportId) throw new AppError('NOT_FOUND', 'Daily report entry was not found.')
    this.requireReportAccess(reportId, user)
  }

  private requireReportAccess(reportId: string, user: AuthenticatedUser): void {
    const report = this.repository.findById(reportId)
    if (!report) throw new AppError('NOT_FOUND', 'Daily report was not found.')
    if (user.role !== 'ADMIN' && report.cashierUserId !== user.id) {
      throw new AppError('FORBIDDEN', 'You cannot access another cashier report.')
    }
  }
}
