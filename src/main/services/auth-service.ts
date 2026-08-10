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
}
