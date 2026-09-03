import type {
  ExpenseCreateInput,
  ExpenseListRequest,
  ExpenseUpdateInput
} from '../../shared/contracts'
import { ExpenseRepository } from '../database/expense-repository'
import { AuthService } from './auth-service'
import { AppError } from '../database/errors'

export class ExpenseService {
  constructor(
    private readonly repository: ExpenseRepository,
    private readonly auth: AuthService
  ) {}

  list(request: ExpenseListRequest) {
    const user = this.auth.requireCashierWorkspace()
    return this.repository.findPage({
      ...request,
      includeVoided: request.includeVoided,
      branch:
        user.role === 'ADMIN'
          ? request.branch
          : (this.repository.branchNameForId(user.branchId) ?? undefined)
    })
  }

  getById(id: string) {
    const user = this.auth.requireCashierWorkspace()
    const record = this.repository.findById(id)
    if (!record) return null
    if (user.role !== 'ADMIN' && record.branch !== this.repository.branchNameForId(user.branchId)) {
      throw new AppError('FORBIDDEN', 'You cannot access this expense.')
    }
    return record
  }

  create(input: ExpenseCreateInput) {
    const user = this.auth.requireCashierWorkspace()
    if (user.role === 'ADMIN')
      throw new AppError('FORBIDDEN', 'Administrators have read-only report access.')
    const branchId = this.repository.branchIdForReport(input.reportId)
    if (!branchId) throw new AppError('NOT_FOUND', 'Report was not found.')
    this.auth.requireOwnBranch(branchId)
    return this.repository.create(input, user.id)
  }

  update(input: ExpenseUpdateInput) {
    const user = this.auth.requireCashierWorkspace()
    if (user.role === 'ADMIN')
      throw new AppError('FORBIDDEN', 'Administrators have read-only report access.')
    const record = this.repository.findById(input.id)
    if (!record) throw new AppError('NOT_FOUND', 'Expense was not found.')
    this.auth.requireBranchName(record.branch, 'You cannot edit this expense.')
    return this.repository.update(input, user.id)
  }

  void(ids: string[], reason: string): void {
    const user = this.auth.requireCashierWorkspace()
    if (user.role === 'ADMIN')
      throw new AppError('FORBIDDEN', 'Administrators have read-only report access.')
    for (const id of ids) {
      const reportId = this.repository.reportId(id)
      if (!reportId) throw new AppError('NOT_FOUND', 'Expense was not found.')
      this.auth.requireOwnBranch(this.repository.branchIdForReport(reportId))
    }
    this.repository.void(ids, user.id, reason)
  }

  summaryTotals(reportId: string) {
    const user = this.auth.requireCashierWorkspace()
    if (user.role !== 'ADMIN')
      this.auth.requireOwnBranch(
        this.repository.branchIdForReport(reportId),
        'Cash summaries are branch-exclusive.'
      )
    return this.repository.findSummaryTotals(reportId)
  }
}
