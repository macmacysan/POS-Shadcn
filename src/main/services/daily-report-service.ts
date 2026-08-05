import type {
  AuthenticatedUser,
  DailyReportPaymentCreateRequest,
  DailyReportPaymentListRequest,
  DailyReportPaymentUpdateRequest,
  DailyReportPaymentVoidRequest,
  DailyReportReceiptTypeCreateRequest,
  DailyReportReceiptTypeDeleteRequest,
  DailyReportResolveActiveRequest,
  DailyReportSummaryUpdateRequest,
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

  updateSummary(request: DailyReportSummaryUpdateRequest) {
    this.requireReportAccess(request.dailyReportId, this.auth.requireSession())
    return this.repository.updateSummary(request)
  }

  listIncome(request: IncomeListRequest) {
    const user = this.auth.requireSession()
    if (request.dailyReportId) this.requireReportAccess(request.dailyReportId, user)
    return {
      rows: this.repository.listIncome({
        ...request,
        branch: user.role === 'ADMIN' ? request.branch : user.branch
      })
    }
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
    const user = this.auth.requireSession()
    if (request.dailyReportId) this.requireReportAccess(request.dailyReportId, user)
    return {
      rows: this.repository.listPayments({
        ...request,
        branch: user.role === 'ADMIN' ? request.branch : user.branch
      })
    }
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

  createReceiptType(request: DailyReportReceiptTypeCreateRequest) {
    const user = this.auth.requireSession()
    return this.repository.createReceiptType(request, user.id)
  }

  deleteReceiptType(request: DailyReportReceiptTypeDeleteRequest) {
    this.auth.requireSession()
    return this.repository.deleteReceiptType(request)
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
