import {
  loginBranchValues,
  type AuthenticatedUser,
  type LoginRequest,
  type UserRole
} from '../../shared/contracts'
import type { AppDatabase } from './database'
import { AppError } from './errors'
import { verifyPassword } from '../security/passwords'
import { hashPassword } from '../security/passwords'
import { randomUUID } from 'node:crypto'
import type { UserProfileCreate, UserProfileRecord, UserProfileUpdate } from '../../shared/contracts'
import type { InitialAdminSetup } from '../../shared/contracts'

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
    if (request.branch === 'All Branch' && user.role !== 'ADMIN') {
      throw new AppError('FORBIDDEN', 'Only administrators can view all branches.')
    }
    if (user.role !== 'ADMIN' && user.branch !== request.branch) {
      throw new AppError('FORBIDDEN', 'This account is not assigned to the selected branch.')
    }
    this.db
      .prepare('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), new Date().toISOString(), user.id)
    const branch =
      request.branch === 'All Branch'
        ? user.branch_id
          ? ({ id: user.branch_id } as { id: string })
          : (this.db
              .prepare('SELECT id FROM branches WHERE is_active = 1 ORDER BY name LIMIT 1')
              .get() as { id: string } | undefined)
        : (this.db
            .prepare('SELECT id FROM branches WHERE name = ? AND is_active = 1')
            .get(request.branch) as { id: string } | undefined)
    if (!branch) throw new AppError('NOT_FOUND', 'Selected branch was not found.')
    if (!loginBranchValues.includes(request.branch)) {
      throw new AppError('VALIDATION_ERROR', 'Selected branch is invalid.')
    }
    return {
      id: user.id,
      displayName: user.display_name,
      role: user.role,
      branchId: user.branch_id ?? branch.id,
      branch: request.branch
    }
  }

  verifyAdminPassword(userId: string, password: string): void {
    const user = this.db
      .prepare('SELECT password_hash, role, is_active FROM users WHERE id = ?')
      .get(userId) as { password_hash: string; role: UserRole; is_active: number } | undefined
    if (!user || !user.is_active || user.role !== 'ADMIN' || !verifyPassword(password, user.password_hash)) {
      throw new AppError('VALIDATION_ERROR', 'Invalid administrator password.')
    }
  }

  needsSetup(): boolean {
    return (this.db.prepare(`SELECT count(*) AS total FROM users WHERE is_active = 1 AND role IN ('ADMIN', 'CASHIER')`).get() as { total: number }).total === 0
  }

  createInitialAdmin(request: InitialAdminSetup): void {
    if (!this.needsSetup()) throw new AppError('CONFLICT', 'An account already exists.')
    const now = new Date().toISOString()
    const branches = [['bootstrap-goa', 'GOA', 'Goa'], ['bootstrap-tinambac', 'TIN', 'Tinambac'], ['bootstrap-tigaon', 'TIG', 'Tigaon'], ['bootstrap-lagonoy', 'LAG', 'Lagonoy']] as const
    this.db.transaction(() => {
      const insertBranch = this.db.prepare(`INSERT OR IGNORE INTO branches (id, code, name, is_active, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)`)
      for (const branch of branches) insertBranch.run(...branch, now, now)
      const branch = this.branchId('Lagonoy')
      this.db.prepare(`INSERT INTO users (id, branch_id, username, password_hash, display_name, role, is_active, must_change_password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'ADMIN', 1, 0, ?, ?)`).run(randomUUID(), branch, request.username, hashPassword(request.password), request.displayName, now, now)
    })()
  }

  listProfiles(): UserProfileRecord[] {
    type ProfileRow = Omit<UserProfileRecord, 'isActive'> & { isActive: number }
    return (this.db.prepare(`SELECT u.id, u.display_name AS displayName, u.username, u.role, b.name AS branch, u.is_active AS isActive, u.last_login_at AS lastLoginAt FROM users u JOIN branches b ON b.id = u.branch_id ORDER BY u.display_name`).all() as ProfileRow[]).map(({ isActive, ...row }) => ({ ...row, isActive: Boolean(isActive) }))
  }

  createProfile(request: UserProfileCreate, actorId: string): UserProfileRecord {
    const branch = this.branchId(request.branch); const now = new Date().toISOString(); const id = randomUUID()
    try { this.db.transaction(() => { this.db.prepare(`INSERT INTO users (id, branch_id, username, password_hash, display_name, role, is_active, must_change_password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`).run(id, branch, request.username, hashPassword(request.password), request.displayName, request.role, request.isActive ? 1 : 0, now, now); this.audit(actorId, id, 'CREATE', 'User profile created') })() } catch { throw new AppError('CONFLICT', 'That username is already in use.') }
    return this.profile(id)
  }

  updateProfile(request: UserProfileUpdate, actorId: string): UserProfileRecord {
    const current = this.profile(request.id); if (current.id === actorId && (current.role !== request.role || current.branch !== request.branch || current.isActive !== request.isActive)) throw new AppError('FORBIDDEN', 'You cannot change your own access.')
    if (current.role === 'ADMIN' && (!request.isActive || request.role !== 'ADMIN') && this.activeAdminCount() < 2) throw new AppError('FORBIDDEN', 'At least one active administrator is required.')
    const now = new Date().toISOString(); this.db.transaction(() => { this.db.prepare(`UPDATE users SET display_name = ?, role = ?, branch_id = ?, is_active = ?, updated_at = ? WHERE id = ?`).run(request.displayName, request.role, this.branchId(request.branch), request.isActive ? 1 : 0, now, request.id); this.audit(actorId, request.id, 'UPDATE', 'User profile updated') })()
    return this.profile(request.id)
  }

  resetPassword(id: string, password: string, actorId: string): void { this.profile(id); const now = new Date().toISOString(); this.db.transaction(() => { this.db.prepare('UPDATE users SET password_hash = ?, must_change_password = 1, updated_at = ? WHERE id = ?').run(hashPassword(password), now, id); this.audit(actorId, id, 'PASSWORD_RESET', 'Temporary password issued') })() }
  listAudit(): Array<{ id: string; actorName: string; targetName: string; action: string; summary: string; createdAt: string }> { return this.db.prepare(`SELECT a.id, COALESCE(actor.display_name, 'System') AS actorName, target.display_name AS targetName, a.action, COALESCE(a.reason, '') AS summary, a.created_at AS createdAt FROM audit_logs a JOIN users target ON target.id = a.entity_id LEFT JOIN users actor ON actor.id = a.actor_user_id WHERE a.entity_type = 'user' ORDER BY a.created_at DESC LIMIT 200`).all() as Array<{ id: string; actorName: string; targetName: string; action: string; summary: string; createdAt: string }> }
  private branchId(branch: string): string { const row = this.db.prepare('SELECT id FROM branches WHERE name = ? AND is_active = 1').get(branch) as { id: string } | undefined; if (!row) throw new AppError('NOT_FOUND', 'Branch was not found.'); return row.id }
  private profile(id: string): UserProfileRecord { const row = this.listProfiles().find((profile) => profile.id === id); if (!row) throw new AppError('NOT_FOUND', 'User was not found.'); return row }
  private activeAdminCount(): number { return (this.db.prepare(`SELECT count(*) AS total FROM users WHERE role = 'ADMIN' AND is_active = 1`).get() as { total: number }).total }
  private audit(actorId: string, targetId: string, action: string, summary: string): void { this.db.prepare(`INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, reason, created_at) VALUES (?, ?, ?, 'user', ?, ?, ?)`).run(randomUUID(), actorId, action, targetId, summary, new Date().toISOString()) }
}
