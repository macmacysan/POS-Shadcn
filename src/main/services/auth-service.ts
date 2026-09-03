import type {
  AuthenticatedUser,
  AuthMode,
  CreateAccountRequest,
  FinanceBranch,
  LoginBranch,
  LoginRequest
} from '../../shared/contracts'
import { AppError } from '../database/errors'
import { UserRepository } from '../database/user-repository'

export class AuthService {
  private session: AuthenticatedUser | undefined

  constructor(private readonly repository: UserRepository) {}

  async login(request: LoginRequest): Promise<AuthenticatedUser> {
    this.session = this.repository.authenticate(request)
    return this.session
  }

  async createAccount(request: CreateAccountRequest): Promise<void> {
    this.repository.createAccount(request)
  }

  getMode(): AuthMode {
    return 'local'
  }

  async logout(): Promise<void> {
    this.session = undefined
  }

  requireSession(): AuthenticatedUser {
    if (!this.session) throw new AppError('FORBIDDEN', 'Sign in is required.')
    return this.session
  }

  requireCashierWorkspace(): AuthenticatedUser {
    const user = this.requireSession()
    if (user.role === 'ADMIN')
      throw new AppError('FORBIDDEN', 'Administrators can only access application settings.')
    return user
  }

  canReadBranch(branchId: string): boolean {
    const user = this.requireSession()
    return user.role === 'ADMIN' || user.branchId === branchId
  }

  requireOwnBranch(
    branchId: string | null | undefined,
    message = 'You cannot modify another branch.'
  ): AuthenticatedUser {
    const user = this.requireSession()
    if (!branchId) throw new AppError('NOT_FOUND', 'The branch was not found.')
    if (user.role === 'ADMIN' || user.branchId !== branchId)
      throw new AppError('FORBIDDEN', message)
    return user
  }

  requireBranchName(
    branch: string | null | undefined,
    message = 'You cannot modify another branch.'
  ): AuthenticatedUser {
    const user = this.requireSession()
    if (!branch) throw new AppError('NOT_FOUND', 'The branch was not found.')
    if (user.role === 'ADMIN' || user.branch !== branch) throw new AppError('FORBIDDEN', message)
    return user
  }

  switchBranch(branch: LoginBranch): AuthenticatedUser {
    const user = this.requireAdmin()
    this.session = this.repository.switchAdminBranch(user, branch)
    return this.session
  }

  cashierLoginBranch(): FinanceBranch | undefined {
    return this.repository.configuredCashierLoginBranch()?.name as FinanceBranch | undefined
  }

  setCashierLoginBranch(branch: FinanceBranch): FinanceBranch {
    this.requireAdmin()
    return this.repository.setCashierLoginBranch(branch) as FinanceBranch
  }

  async updateOwnPassword(password: string): Promise<void> {
    const user = this.requireSession()
    this.repository.resetPassword(user.id, password, user.id)
  }

  requireAdmin(): AuthenticatedUser {
    const user = this.requireSession()
    if (user.role !== 'ADMIN')
      throw new AppError('FORBIDDEN', 'Only administrators can manage settings.')
    return user
  }

  confirmAdminPassword(password: string): AuthenticatedUser {
    this.requireSession()
    return this.repository.verifyAdminPassword(password)
  }
}
