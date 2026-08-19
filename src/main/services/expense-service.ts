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
    const user = this.auth.requireSession()
    return this.repository.findPage({
      ...request,
      includeVoided: user.role === 'ADMIN' && request.includeVoided,
      branch: user.role === 'ADMIN' ? request.branch : user.branch
    })
  }

  getById(id: string) {
    const user = this.auth.requireSession()
    const record = this.repository.findById(id)
    if (!record) return null
    if (user.role !== 'ADMIN' && record.branch !== user.branch) {
      throw new AppError('FORBIDDEN', 'You cannot access this expense.')
    }
    return record
  }

  create(input: ExpenseCreateInput) {
    const user = this.auth.requireSession()
    const branchId = this.repository.branchIdForReport(input.reportId)
    if (!branchId) throw new AppError('NOT_FOUND', 'Report was not found.')
    if (user.role !== 'ADMIN' && branchId !== user.branchId) {
      throw new AppError('FORBIDDEN', 'You cannot access another branch report.')
    }
    return this.repository.create(input, user.id)
  }

  update(input: ExpenseUpdateInput) {
    const user = this.auth.requireSession()
    const record = this.repository.findById(input.id)
    if (!record) throw new AppError('NOT_FOUND', 'Expense was not found.')
    if (user.role !== 'ADMIN' && record.branch !== user.branch) {
      throw new AppError('FORBIDDEN', 'You cannot edit this expense.')
    }
    return this.repository.update(input, user.id)
  }

  remove(ids: string[], reason: string): void {
    const user = this.auth.requireSession()
    if (user.role !== 'ADMIN')
      throw new AppError('FORBIDDEN', 'Only administrators can void entries.')
    this.repository.remove(ids, user.id, reason)
  }

  summaryTotals(reportId: string) {
    return this.repository.findSummaryTotals(reportId)
  }
}
