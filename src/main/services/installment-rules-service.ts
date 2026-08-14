import type { AuthenticatedUser, InstallmentRulesSaveRequest } from '../../shared/contracts'
import { AppError } from '../database/errors'
import { InstallmentRulesRepository } from '../database/installment-rules-repository'
import { AuthService } from './auth-service'

export class InstallmentRulesService {
  constructor(private readonly repository: InstallmentRulesRepository, private readonly auth: AuthService) {}
  getActive() { this.auth.requireSession(); return this.repository.getActive() }
  list() { this.requireAdmin(this.auth.requireSession()); return this.repository.list() }
  save(input: InstallmentRulesSaveRequest) { const user = this.auth.requireSession(); this.requireAdmin(user); return this.repository.save(input, user.id) }
  private requireAdmin(user: AuthenticatedUser): void { if (user.role !== 'ADMIN') throw new AppError('FORBIDDEN', 'Only administrators can manage installment rules.') }
}
