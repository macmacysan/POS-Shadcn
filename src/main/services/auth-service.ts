import type { AuthenticatedUser, LoginRequest } from '../../shared/contracts'
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

  confirmAdminPassword(password: string): AuthenticatedUser {
    const user = this.requireSession()
    if (user.role !== 'ADMIN') throw new AppError('FORBIDDEN', 'Only administrators can delete records.')
    this.repository.verifyAdminPassword(user.id, password)
    return user
  }
}
