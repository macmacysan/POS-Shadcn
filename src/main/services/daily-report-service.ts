import type {
  AuthenticatedUser,
  DailyReportCalendarRequest,
  DailyReportCalendarResponse,
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
    const branchId =
      user.role === 'ADMIN' ? request.branchId : this.repository.branchIdForUser(user.id)
    if (!branchId) throw new AppError('FORBIDDEN', 'Your account is not assigned to a branch.')
    return this.repository.resolveActive({ ...request, branchId, cashierUserId: user.id })
  }

  listCalendar(request: DailyReportCalendarRequest): DailyReportCalendarResponse {
    const user = this.auth.requireSession()
    const branchId =
      user.role === 'ADMIN' ? request.branchId : this.repository.branchIdForUser(user.id)
    if (!branchId) throw new AppError('FORBIDDEN', 'Your account is not assigned to a branch.')
    return {
      rows: this.repository.listCalendar({
        ...request,
        branchId,
        cashierUserId: user.id
      })
    }
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
    return this.repository.updateIncome(request, user.id)
  }

  voidIncome(request: IncomeVoidRequest) {
    const user = this.auth.requireSession()
    this.requireAdminVoid(user)
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
    return this.repository.updatePayment(request, user.id)
  }

  voidPayment(request: DailyReportPaymentVoidRequest) {
    const user = this.auth.requireSession()
    this.requireAdminVoid(user)
    this.requireEntryAccess(this.repository.paymentReportId(request.id), user)
    return this.repository.voidPayment(request, user.id)
  }

  createReceiptType(request: DailyReportReceiptTypeCreateRequest) {
    const user = this.auth.requireSession()
    this.requireAdmin(user)
    return this.repository.createReceiptType(request, user.id)
  }

  deleteReceiptType(request: DailyReportReceiptTypeDeleteRequest) {
    this.requireAdmin(this.auth.requireSession())
    return this.repository.deleteReceiptType(request)
  }

  listReceiptTypes() {
    this.requireAdmin(this.auth.requireSession())
    return { rows: this.repository.listReceiptTypes() }
  }

  restoreReceiptType(request: DailyReportReceiptTypeDeleteRequest) {
    this.requireAdmin(this.auth.requireSession())
    return this.repository.restoreReceiptType(request)
  }

  private requireAdmin(user: AuthenticatedUser): void {
    if (user.role !== 'ADMIN')
      throw new AppError('FORBIDDEN', 'Only administrators can manage receipt names.')
  }

  private requireAdminVoid(user: AuthenticatedUser): void {
    if (user.role !== 'ADMIN')
      throw new AppError('FORBIDDEN', 'Only administrators can void entries.')
  }

  private requireEntryAccess(reportId: string | null, user: AuthenticatedUser): void {
    if (!reportId) throw new AppError('NOT_FOUND', 'Daily report entry was not found.')
    this.requireReportAccess(reportId, user)
  }

  private requireReportAccess(reportId: string, user: AuthenticatedUser): void {
    const report = this.repository.findById(reportId)
    if (!report) throw new AppError('NOT_FOUND', 'Daily report was not found.')
    if (user.role !== 'ADMIN' && this.repository.branchIdForReport(reportId) !== user.branchId) {
      throw new AppError('FORBIDDEN', 'You cannot access another branch report.')
    }
  }
}
