import type { AuthenticatedUser, LoginRequest, UserRole } from '../../shared/contracts'
import type { AppDatabase } from './database'
import { AppError } from './errors'
import { verifyPassword } from '../security/passwords'

type UserRow = {
  id: string
  username: string
  password_hash: string
  display_name: string
  role: UserRole
  branch_id: string | null
  branch: string | null
}

export class UserRepository {
  constructor(private readonly db: AppDatabase) {}

  authenticate(request: LoginRequest): AuthenticatedUser {
    const user = this.db
      .prepare(
        `SELECT u.id, u.username, u.password_hash, u.display_name, u.role, u.branch_id, b.name AS branch
           FROM users u
           LEFT JOIN branches b ON b.id = u.branch_id
          WHERE lower(u.username) = lower(?) AND u.is_active = 1`
      )
      .get(request.username) as UserRow | undefined
    if (!user || !verifyPassword(request.password, user.password_hash)) {
      throw new AppError('VALIDATION_ERROR', 'Invalid username or password.')
    }
    if (user.role !== 'ADMIN' && user.role !== 'CASHIER') {
      throw new AppError('FORBIDDEN', 'This account role is not supported.')
    }
    if (user.role !== 'ADMIN' && user.branch !== request.branch) {
      throw new AppError('FORBIDDEN', 'This account is not assigned to the selected branch.')
    }
    this.db
      .prepare('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), new Date().toISOString(), user.id)
    const branch = this.db
      .prepare('SELECT id FROM branches WHERE name = ? AND is_active = 1')
      .get(request.branch) as { id: string } | undefined
    if (!branch) throw new AppError('NOT_FOUND', 'Selected branch was not found.')
    return {
      id: user.id,
      displayName: user.display_name,
      role: user.role,
      branchId: user.branch_id ?? branch.id,
      branch: request.branch
    }
  }
}
