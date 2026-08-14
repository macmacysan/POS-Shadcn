import type { AuthenticatedUser, InitialAdminSetup, LoginRequest } from '../../shared/contracts'
import { AppError } from '../database/errors'
import { UserRepository } from '../database/user-repository'

export class AuthService {
  private session: AuthenticatedUser | undefined

  constructor(private readonly repository: UserRepository) {}

  login(request: LoginRequest): AuthenticatedUser {
    this.session = this.repository.authenticate(request)
    return this.session
  }

  logout(): void {
    this.session = undefined
  }

  requireSession(): AuthenticatedUser {
    if (!this.session) throw new AppError('FORBIDDEN', 'Sign in is required.')
    return this.session
  }

  needsSetup(): boolean { return this.repository.needsSetup() }
  setupInitialAdmin(request: InitialAdminSetup): AuthenticatedUser {
    this.repository.createInitialAdmin(request)
    return this.login({ branch: 'All Branch', username: request.username, password: request.password })
  }

  requireAdmin(): AuthenticatedUser {
    const user = this.requireSession()
    if (user.role !== 'ADMIN') throw new AppError('FORBIDDEN', 'Only administrators can manage settings.')
    return user
  }

  confirmAdminPassword(password: string): AuthenticatedUser {
    const user = this.requireAdmin()
    this.repository.verifyAdminPassword(user.id, password)
    return user
  }
}
