import type {
  ExpenseCreateInput,
  ExpenseListRequest,
  ExpenseUpdateInput
} from '../../shared/contracts'
import { ExpenseRepository } from '../database/expense-repository'

export class ExpenseService {
  constructor(private readonly repository: ExpenseRepository) {}

  list(request: ExpenseListRequest) {
    return this.repository.findPage(request)
  }

  getById(id: string) {
    return this.repository.findById(id)
  }

  create(input: ExpenseCreateInput) {
    return this.repository.create(input)
  }

  update(input: ExpenseUpdateInput) {
    return this.repository.update(input)
  }

  remove(ids: string[]): void {
    this.repository.remove(ids)
  }

  summaryTotals(reportId: string) {
    return this.repository.findSummaryTotals(reportId)
  }
}
