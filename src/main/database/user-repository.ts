import { type AuthenticatedUser, type LoginRequest, type UserRole } from '../../shared/contracts'
import type { AppDatabase } from './database'
import { AppError } from './errors'
import { verifyPassword } from '../security/passwords'
import { hashPassword } from '../security/passwords'
import { randomUUID } from 'node:crypto'
import type {
  UserProfileCreate,
  UserProfileRecord,
  UserProfileUpdate
} from '../../shared/contracts'

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
    const branch = user.role === 'CASHIER' ? this.cashierLoginBranch() : this.activeBranch(user.branch_id)
    if (!branch) throw new AppError('NOT_FOUND', 'Your assigned branch was not found.')
    if (user.role === 'CASHIER') {
      const assigned = this.db
        .prepare(
          'SELECT 1 FROM user_branch_assignments WHERE user_id = ? AND branch_id = ?'
        )
        .get(user.id, branch.id)
      if (!assigned)
        throw new AppError(
          'FORBIDDEN',
          `You are not assigned to the active cashier branch (${branch.name}).`
        )
    }
    this.db
      .prepare('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), new Date().toISOString(), user.id)
    return {
      id: user.id,
      displayName: user.display_name,
      role: user.role,
      branchId: branch.id,
      branch: user.role === 'ADMIN' ? 'All Branch' : (branch.name as AuthenticatedUser['branch'])
    }
  }

  resolveCloudUser(identity: {
    username: string
    displayName: string
    role: UserRole
    branches: string[]
  }): AuthenticatedUser {
    const user = this.db
      .prepare(
        `SELECT u.id, u.display_name, u.role, u.branch_id, b.name AS branch
           FROM users u LEFT JOIN branches b ON b.id = u.branch_id
          WHERE lower(u.username) = lower(?) AND u.is_active = 1`
      )
      .get(identity.username) as UserRow | undefined
    if (!user) throw new AppError('NOT_FOUND', 'The local user profile is not synchronized.')
    const branch =
      identity.role === 'ADMIN' ? this.activeBranch(user.branch_id) : this.cashierLoginBranch()
    if (!branch) throw new AppError('NOT_FOUND', 'Your assigned branch was not found locally.')
    if (identity.role === 'CASHIER') {
      const branchCode = this.db
        .prepare('SELECT code FROM branches WHERE id = ? AND is_active = 1')
        .get(branch.id) as { code: string } | undefined
      if (
        !branchCode ||
        !identity.branches.some((code) => code.toUpperCase() === branchCode.code)
      ) {
        throw new AppError('FORBIDDEN', `Your account does not have access to ${branch.name}.`)
      }
    }
    return {
      id: user.id,
      displayName: identity.displayName || user.display_name,
      role: identity.role,
      branchId: branch.id,
      branch:
        identity.role === 'ADMIN' ? 'All Branch' : (branch.name as AuthenticatedUser['branch'])
    }
  }

  syncSpreadsheetUsers(
    rows: Array<{
      active: boolean
      role: UserRole
      firstName: string
      lastName: string
      username: string
      password?: string
      branches: string[]
    }>
  ): void {
    const now = new Date().toISOString()
    const sync = this.db.transaction(() => {
      const findUser = this.db.prepare(
        'SELECT id, branch_id, password_hash FROM users WHERE lower(username) = lower(?)'
      )
      const upsert = this.db.prepare(`
        INSERT INTO users (id, branch_id, username, password_hash, display_name, first_name, last_name, role, is_active, must_change_password, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        ON CONFLICT(username) DO UPDATE SET display_name = excluded.display_name, first_name = excluded.first_name, last_name = excluded.last_name, password_hash = excluded.password_hash, role = excluded.role,
          is_active = excluded.is_active, updated_at = excluded.updated_at`)
      const clear = this.db.prepare('DELETE FROM user_branch_assignments WHERE user_id = ?')
      const assign = this.db.prepare(
        'INSERT INTO user_branch_assignments (user_id, branch_id) VALUES (?, ?)'
      )
      for (const row of rows) {
        const existing = findUser.get(row.username) as
          { id: string; branch_id: string | null; password_hash: string } | undefined
        const id = existing?.id ?? randomUUID()
        const branchIds = row.branches.map((branch) => this.branchId(branch))
        const defaultBranchId = branchIds[0] ?? existing?.branch_id ?? null
        const active = row.active && (row.role === 'ADMIN' || branchIds.length > 0)
        upsert.run(
          id,
          defaultBranchId,
          row.username,
          row.password
            ? hashPassword(row.password)
            : (existing?.password_hash ?? hashPassword(randomUUID())),
          `${row.firstName} ${row.lastName}`.trim(),
          row.firstName,
          row.lastName,
          row.role,
          active ? 1 : 0,
          now,
          now
        )
        clear.run(id)
        for (const branchId of branchIds) assign.run(id, branchId)
      }
    })
    sync()
  }

  cacheCloudPassword(username: string, password: string): void {
    const result = this.db
      .prepare(
        'UPDATE users SET password_hash = ?, last_login_at = ?, updated_at = ? WHERE lower(username) = lower(?) AND is_active = 1'
      )
      .run(hashPassword(password), new Date().toISOString(), new Date().toISOString(), username)
    if (result.changes === 0)
      throw new AppError('NOT_FOUND', 'The local user profile is not synchronized.')
  }

  createAccount(request: {
    username: string
    password: string
    branch: string
    role: UserRole
  }): void {
    const now = new Date().toISOString()
    const id = randomUUID()
    const branchId = this.branchId(request.branch)
    try {
      this.db.transaction(() => {
        this.db
          .prepare(
            `INSERT INTO users (id, branch_id, username, password_hash, display_name, first_name, last_name, role, is_active, must_change_password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`
          )
          .run(
            id,
            branchId,
            request.username,
            hashPassword(request.password),
            request.username,
            request.username,
            '',
            request.role,
            now,
            now
          )
        this.db
          .prepare('INSERT INTO user_branch_assignments (user_id, branch_id) VALUES (?, ?)')
          .run(id, branchId)
      })()
    } catch {
      throw new AppError('CONFLICT', 'That username is already in use.')
    }
  }

  switchAdminBranch(
    user: AuthenticatedUser,
    branch: AuthenticatedUser['branch']
  ): AuthenticatedUser {
    const selected =
      branch === 'All Branch'
        ? this.activeBranch(user.branchId)
        : (this.db
            .prepare('SELECT id, name FROM branches WHERE name = ? AND is_active = 1')
            .get(branch) as { id: string; name: string } | undefined)
    if (!selected) throw new AppError('NOT_FOUND', 'Selected branch was not found.')
    return { ...user, branchId: selected.id, branch }
  }

  cashierLoginBranch(): { id: string; name: string } | undefined {
    return this.configuredCashierLoginBranch() ?? this.activeBranch(null)
  }

  configuredCashierLoginBranch(): { id: string; name: string } | undefined {
    const setting = this.db
      .prepare("SELECT value FROM app_settings WHERE key = 'cashier_login_branch'")
      .get() as { value: string } | undefined
    return setting
      ? (this.db
          .prepare('SELECT id, name FROM branches WHERE name = ? AND is_active = 1')
          .get(setting.value) as { id: string; name: string } | undefined)
      : undefined
  }

  setCashierLoginBranch(branch: string): string {
    this.branchId(branch)
    this.db
      .prepare(
        `INSERT INTO app_settings (key, value, updated_at) VALUES ('cashier_login_branch', ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
      )
      .run(branch, new Date().toISOString())
    return branch
  }

  private activeBranch(branchId: string | null): { id: string; name: string } | undefined {
    return (
      branchId
        ? this.db
            .prepare('SELECT id, name FROM branches WHERE id = ? AND is_active = 1')
            .get(branchId)
        : this.db
            .prepare('SELECT id, name FROM branches WHERE is_active = 1 ORDER BY name LIMIT 1')
            .get()
    ) as { id: string; name: string } | undefined
  }

  verifyAdminPassword(password: string): AuthenticatedUser {
    const user = this.db
      .prepare(
        `SELECT u.id, u.password_hash, u.display_name, u.role, u.branch_id, b.name AS branch
           FROM users u
           LEFT JOIN branches b ON b.id = u.branch_id
          WHERE u.role = 'ADMIN' AND u.is_active = 1`
      )
      .all() as Array<{
      id: string
      password_hash: string
      display_name: string
      role: UserRole
      branch_id: string | null
      branch: string | null
    }>
    const verified = user.find((candidate) => verifyPassword(password, candidate.password_hash))
    if (!verified) {
      throw new AppError('VALIDATION_ERROR', 'Invalid administrator password.')
    }
    return {
      id: verified.id,
      displayName: verified.display_name,
      role: verified.role,
      branchId: verified.branch_id ?? '',
      branch: (verified.branch ?? 'All Branch') as AuthenticatedUser['branch']
    }
  }

  listProfiles(): UserProfileRecord[] {
    type ProfileRow = Omit<UserProfileRecord, 'isActive' | 'branches'> & { isActive: number }
    const assignments = this.db
      .prepare(
        `SELECT uba.user_id AS userId, b.name AS branch FROM user_branch_assignments uba JOIN branches b ON b.id = uba.branch_id WHERE b.is_active = 1`
      )
      .all() as Array<{ userId: string; branch: string }>
    const assignedByUser = new Map<string, UserProfileRecord['branchAssignments']>()
    for (const assignment of assignments)
      assignedByUser.set(assignment.userId, [
        ...(assignedByUser.get(assignment.userId) ?? []),
        assignment.branch as UserProfileRecord['branchAssignments'][number]
      ])
    return (
      this.db
        .prepare(
          `SELECT u.id, u.first_name AS firstName, u.last_name AS lastName, u.username, u.role, b.name AS branch, u.is_active AS isActive, u.last_login_at AS lastLoginAt FROM users u JOIN branches b ON b.id = u.branch_id ORDER BY u.last_name, u.first_name`
        )
        .all() as ProfileRow[]
    ).map(({ isActive, ...row }) => {
      const branchAssignments = assignedByUser.get(row.id) ?? []
      return {
        ...row,
        isActive: Boolean(isActive),
        branchAssignments,
        branches: branchAssignments
      }
    })
  }

  createProfile(request: UserProfileCreate, actorId: string): UserProfileRecord {
    const branch = this.branchId(request.branch)
    const now = new Date().toISOString()
    const id = randomUUID()
    try {
      this.db.transaction(() => {
        this.db
          .prepare(
            `INSERT INTO users (id, branch_id, username, password_hash, display_name, first_name, last_name, role, is_active, must_change_password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
          )
          .run(
            id,
            branch,
            request.username,
            hashPassword(request.password),
            `${request.firstName} ${request.lastName}`,
            request.firstName,
            request.lastName,
            request.role,
            request.isActive ? 1 : 0,
            now,
            now
          )
        this.db
          .prepare('INSERT INTO user_branch_assignments (user_id, branch_id) VALUES (?, ?)')
          .run(id, branch)
        for (const assignedBranch of request.branches.filter((value) => value !== request.branch)) {
          this.db
            .prepare('INSERT INTO user_branch_assignments (user_id, branch_id) VALUES (?, ?)')
            .run(id, this.branchId(assignedBranch))
        }
        this.audit(actorId, id, 'CREATE', 'User profile created')
      })()
    } catch {
      throw new AppError('CONFLICT', 'That username is already in use.')
    }
    return this.profile(id)
  }

  updateProfile(request: UserProfileUpdate, actorId: string): UserProfileRecord {
    const current = this.profile(request.id)
    if (
      current.id === actorId &&
      (current.role !== request.role ||
        current.branch !== request.branch ||
        current.isActive !== request.isActive)
    )
      throw new AppError('FORBIDDEN', 'You cannot change your own access.')
    if (
      current.role === 'ADMIN' &&
      (!request.isActive || request.role !== 'ADMIN') &&
      this.activeAdminCount() < 2
    )
      throw new AppError('FORBIDDEN', 'At least one active administrator is required.')
    if (!request.branches.includes(request.branch))
      throw new AppError('FORBIDDEN', 'The default branch must be selected.')
    const now = new Date().toISOString()
    try {
      this.db.transaction(() => {
        const passwordUpdate = request.password
          ? ', password_hash = ?, must_change_password = 1'
          : ''
        const values = request.password
          ? [
              `${request.firstName} ${request.lastName}`,
              request.firstName,
              request.lastName,
              request.username,
              request.role,
              this.branchId(request.branch),
              request.isActive ? 1 : 0,
              now,
              hashPassword(request.password),
              request.id
            ]
          : [
              `${request.firstName} ${request.lastName}`,
              request.firstName,
              request.lastName,
              request.username,
              request.role,
              this.branchId(request.branch),
              request.isActive ? 1 : 0,
              now,
              request.id
            ]
        this.db
          .prepare(
            `UPDATE users SET display_name = ?, first_name = ?, last_name = ?, username = ?, role = ?, branch_id = ?, is_active = ?, updated_at = ?${passwordUpdate} WHERE id = ?`
          )
          .run(...values)
        this.db.prepare('DELETE FROM user_branch_assignments WHERE user_id = ?').run(request.id)
        for (const assignedBranch of request.branches) {
          this.db
            .prepare('INSERT INTO user_branch_assignments (user_id, branch_id) VALUES (?, ?)')
            .run(request.id, this.branchId(assignedBranch))
        }
        this.audit(actorId, request.id, 'UPDATE', 'User profile updated')
      })()
    } catch {
      throw new AppError('CONFLICT', 'That username is already in use.')
    }
    return this.profile(request.id)
  }

  deleteProfile(id: string, actorId: string): void {
    const current = this.profile(id)
    if (id === actorId) throw new AppError('FORBIDDEN', 'You cannot delete your own account.')
    if (current.role === 'ADMIN' && current.isActive && this.activeAdminCount() < 2)
      throw new AppError('FORBIDDEN', 'At least one active administrator is required.')
    try {
      this.db.transaction(() => {
        this.db.prepare('DELETE FROM user_branch_assignments WHERE user_id = ?').run(id)
        this.db.prepare('DELETE FROM users WHERE id = ?').run(id)
      })()
    } catch {
      throw new AppError(
        'CONFLICT',
        'This user has linked records. Deactivate the account instead.'
      )
    }
  }

  resetPassword(id: string, password: string, actorId: string): void {
    this.profile(id)
    const now = new Date().toISOString()
    this.db.transaction(() => {
      this.db
        .prepare(
          'UPDATE users SET password_hash = ?, must_change_password = 1, updated_at = ? WHERE id = ?'
        )
        .run(hashPassword(password), now, id)
      this.audit(actorId, id, 'PASSWORD_RESET', 'Temporary password issued')
    })()
  }
  listAudit(): Array<{
    id: string
    actorName: string
    targetName: string
    action: string
    summary: string
    createdAt: string
  }> {
    return this.db
      .prepare(
        `SELECT a.id, COALESCE(actor.display_name, 'System') AS actorName, target.display_name AS targetName, a.action, COALESCE(a.reason, '') AS summary, a.created_at AS createdAt FROM audit_logs a JOIN users target ON target.id = a.entity_id LEFT JOIN users actor ON actor.id = a.actor_user_id WHERE a.entity_type = 'user' ORDER BY a.created_at DESC LIMIT 200`
      )
      .all() as Array<{
      id: string
      actorName: string
      targetName: string
      action: string
      summary: string
      createdAt: string
    }>
  }
  private branchId(branch: string): string {
    const row = this.db
      .prepare('SELECT id FROM branches WHERE name = ? AND is_active = 1')
      .get(branch) as { id: string } | undefined
    if (!row) throw new AppError('NOT_FOUND', 'Branch was not found.')
    return row.id
  }
  private profile(id: string): UserProfileRecord {
    const row = this.listProfiles().find((profile) => profile.id === id)
    if (!row) throw new AppError('NOT_FOUND', 'User was not found.')
    return row
  }
  private activeAdminCount(): number {
    return (
      this.db
        .prepare(`SELECT count(*) AS total FROM users WHERE role = 'ADMIN' AND is_active = 1`)
        .get() as { total: number }
    ).total
  }
  private audit(actorId: string, targetId: string, action: string, summary: string): void {
    this.db
      .prepare(
        `INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, reason, created_at) VALUES (?, ?, ?, 'user', ?, ?, ?)`
      )
      .run(randomUUID(), actorId, action, targetId, summary, new Date().toISOString())
  }
}
