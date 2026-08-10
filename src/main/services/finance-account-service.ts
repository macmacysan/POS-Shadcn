import type {
  FinanceAccountCreateRequest,
  FinanceAccountListRequest,
  FinanceAccountListResult,
  FinanceAccountRecord,
  FinanceAccountUpdateRequest
} from '../../shared/contracts'
import { FinanceAccountRepository } from '../database/finance-account-repository'

export class FinanceAccountService {
  constructor(private readonly repository: FinanceAccountRepository) {}

  list(request: FinanceAccountListRequest): FinanceAccountListResult {
    return this.repository.list(request)
  }

  create(request: FinanceAccountCreateRequest): FinanceAccountRecord {
    return this.repository.create(request)
  }

  update(request: FinanceAccountUpdateRequest): FinanceAccountRecord {
    return this.repository.update(request)
  }
}
