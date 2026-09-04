import type {
  AuthenticatedUser,
  DailyReportCalendarRequest,
  DailyReportCalendarResponse,
  DailyReportDeliveryUpdateRequest,
  DailyReportPaymentCreateRequest,
  DailyReportPaymentListRequest,
  DailyReportPaymentUpdateRequest,
  DailyReportPaymentVoidRequest,
  DailyReportReceiptTypeCreateRequest,
  DailyReportReceiptTypeDeleteRequest,
  DailyReportResolveActiveRequest,
  DailyReportSummaryUpdateRequest,
  DailyReportNoteUpdateRequest,
  DailyReportRecord,
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
    const user = this.auth.requireCashierWorkspace()
    const branchId = this.readBranchId(request.branchId, user)
    if (!branchId) throw new AppError('FORBIDDEN', 'Your account is not assigned to a branch.')
    return this.repository.resolveActive(
      { ...request, branchId, cashierUserId: user.id },
      user.id,
      user.role !== 'ADMIN'
    )
  }

  listCalendar(request: DailyReportCalendarRequest): DailyReportCalendarResponse {
    const user = this.auth.requireCashierWorkspace()
    const branchId = this.readBranchId(request.branchId, user)
    if (!branchId) throw new AppError('FORBIDDEN', 'Your account is not assigned to a branch.')
    return {
      rows: this.repository.listCalendar({
        ...request,
        branchId
      })
    }
  }

  getSnapshot(request: DailyReportSnapshotRequest) {
    this.requireReportAccess(request.dailyReportId, this.auth.requireCashierWorkspace())
    return this.repository.snapshot(request.dailyReportId)
  }

  updateSummary(request: DailyReportSummaryUpdateRequest) {
    const user = this.auth.requireCashierWorkspace()
    this.requireReportAccess(request.dailyReportId, user)
    this.requireOwnReport(request.dailyReportId, user)
    return this.repository.updateSummary(request, user.id)
  }

  updateNote(request: DailyReportNoteUpdateRequest): DailyReportRecord {
    const user = this.auth.requireCashierWorkspace()
    this.requireReportAccess(request.dailyReportId, user)
    this.requireOwnReport(request.dailyReportId, user)
    return this.repository.updateNote(request.dailyReportId, request.note, user.id)
  }

  markDelivery(request: DailyReportDeliveryUpdateRequest): DailyReportRecord {
    const user = this.auth.requireCashierWorkspace()
    this.requireReportAccess(request.dailyReportId, user)
    this.requireOwnReport(request.dailyReportId, user)
    return this.repository.markDelivery(request.dailyReportId, user.id)
  }

  listIncome(request: IncomeListRequest) {
    const user = this.auth.requireCashierWorkspace()
    if (request.dailyReportId) this.requireReportAccess(request.dailyReportId, user)
    return {
      rows: this.repository.listIncome({
        ...request,
        branch:
          user.role === 'ADMIN'
            ? request.branch
            : (this.repository.branchNameForId(user.branchId) ?? undefined),
        status: request.includeVoided
          ? undefined
          : user.role === 'ADMIN'
            ? request.status
            : 'POSTED'
      })
    }
  }

  createIncome(request: IncomeCreateRequest) {
    const user = this.auth.requireCashierWorkspace()
    this.requireReportAccess(request.dailyReportId, user)
    this.requireOwnReport(request.dailyReportId, user)
    return this.repository.createIncome(request, user.id)
  }

  updateIncome(request: IncomeUpdateRequest) {
    const user = this.auth.requireCashierWorkspace()
    this.requireEntryAccess(this.repository.incomeReportId(request.id), user)
    this.requireOwnReport(this.repository.incomeReportId(request.id), user)
    return this.repository.updateIncome(request, user.id)
  }

  voidIncome(request: IncomeVoidRequest) {
    const user = this.auth.requireCashierWorkspace()
    this.requireEntryAccess(this.repository.incomeReportId(request.id), user)
    this.requireOwnReport(this.repository.incomeReportId(request.id), user)
    return this.repository.voidIncome(request, user.id)
  }

  listPayments(request: DailyReportPaymentListRequest) {
    const user = this.auth.requireCashierWorkspace()
    if (request.dailyReportId) this.requireReportAccess(request.dailyReportId, user)
    return {
      rows: this.repository.listPayments({
        ...request,
        branch:
          user.role === 'ADMIN'
            ? request.branch
            : (this.repository.branchNameForId(user.branchId) ?? undefined),
        status: request.includeVoided
          ? undefined
          : user.role === 'ADMIN'
            ? request.status
            : 'POSTED'
      })
    }
  }

  createPayment(request: DailyReportPaymentCreateRequest) {
    const user = this.auth.requireCashierWorkspace()
    this.requireReportAccess(request.dailyReportId, user)
    this.requireOwnReport(request.dailyReportId, user)
    return this.repository.createPayment(request, user.id)
  }

  updatePayment(request: DailyReportPaymentUpdateRequest) {
    const user = this.auth.requireCashierWorkspace()
    this.requireEntryAccess(this.repository.paymentReportId(request.id), user)
    this.requireOwnReport(this.repository.paymentReportId(request.id), user)
    return this.repository.updatePayment(request, user.id)
  }

  voidPayment(request: DailyReportPaymentVoidRequest) {
    const user = this.auth.requireCashierWorkspace()
    this.requireEntryAccess(this.repository.paymentReportId(request.id), user)
    this.requireOwnReport(this.repository.paymentReportId(request.id), user)
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

  private readBranchId(requestedBranch: string, user: AuthenticatedUser): string {
    if (user.role !== 'ADMIN') return user.branchId
    if (requestedBranch === 'All Branch') return user.branchId
    const branchId = this.repository.branchIdForName(requestedBranch)
    if (!branchId) throw new AppError('NOT_FOUND', 'Selected branch was not found.')
    return branchId
  }

  private requireOwnReport(reportId: string | null, user: AuthenticatedUser): void {
    if (!reportId) throw new AppError('NOT_FOUND', 'Daily report was not found.')
    if (user.role === 'ADMIN')
      throw new AppError('FORBIDDEN', 'Administrators have read-only report access.')
    this.auth.requireOwnBranch(
      this.repository.branchIdForReport(reportId),
      'Administrators have read-only report access.'
    )
    if (this.repository.branchIdForReport(reportId) !== user.branchId)
      throw new AppError('FORBIDDEN', 'You cannot modify another branch report.')
  }
}
