import type {
  UserProfileCreate,
  UserProfileRecord,
  UserProfileUpdate
} from '../../shared/contracts'
import { AppError } from '../database/errors'
import { UserRepository } from '../database/user-repository'
import { AuthService } from './auth-service'

export class UserProfilesService {
  constructor(
    private readonly repository: UserRepository,
    private readonly auth: AuthService
  ) {}

  list(): UserProfileRecord[] {
    this.auth.requireAdmin()
    return this.repository.listProfiles()
  }

  async create(request: UserProfileCreate): Promise<UserProfileRecord> {
    const actor = this.auth.requireAdmin()
    if (
      this.repository
        .listProfiles()
        .some((profile) => profile.username.toLowerCase() === request.username.toLowerCase())
    )
      throw new AppError('CONFLICT', 'That username is already in use.')
    return this.repository.createProfile(request, actor.id)
  }

  async update(request: UserProfileUpdate): Promise<UserProfileRecord> {
    const actor = this.auth.requireAdmin()
    const current = this.repository.listProfiles().find((profile) => profile.id === request.id)
    if (!current) throw new AppError('NOT_FOUND', 'User was not found.')
    if (
      this.repository
        .listProfiles()
        .some(
          (profile) =>
            profile.id !== request.id &&
            profile.username.toLowerCase() === request.username.toLowerCase()
        )
    )
      throw new AppError('CONFLICT', 'That username is already in use.')
    if (
      current.id === actor.id &&
      (current.role !== request.role ||
        current.branch !== request.branch ||
        current.isActive !== request.isActive)
    )
      throw new AppError('FORBIDDEN', 'You cannot change your own access.')
    if (
      current.role === 'ADMIN' &&
      current.isActive &&
      (!request.isActive || request.role !== 'ADMIN') &&
      this.activeAdminCount() < 2
    )
      throw new AppError('FORBIDDEN', 'At least one active administrator is required.')
    if (request.password) {
      if (request.id !== actor.id)
        throw new AppError(
          'FORBIDDEN',
          'Online password updates for other users require server-side admin access.'
        )
      await this.auth.updateOwnPassword(request.password)
      return this.repository.updateProfile({ ...request, password: undefined }, actor.id)
    }
    return this.repository.updateProfile(request, actor.id)
  }

  async delete(id: string): Promise<void> {
    const actor = this.auth.requireAdmin()
    const current = this.repository.listProfiles().find((profile) => profile.id === id)
    if (!current) throw new AppError('NOT_FOUND', 'User was not found.')
    if (id === actor.id) throw new AppError('FORBIDDEN', 'You cannot delete your own account.')
    if (current.role === 'ADMIN' && current.isActive && this.activeAdminCount() < 2)
      throw new AppError('FORBIDDEN', 'At least one active administrator is required.')
    this.repository.deleteProfile(id, actor.id)
  }

  async resetPassword(id: string, password: string): Promise<void> {
    const actor = this.auth.requireAdmin()
    const current = this.repository.listProfiles().find((profile) => profile.id === id)
    if (!current) throw new AppError('NOT_FOUND', 'User was not found.')
    this.repository.resetPassword(id, password, actor.id)
  }

  audit(): ReturnType<UserRepository['listAudit']> {
    this.auth.requireAdmin()
    return this.repository.listAudit()
  }

  private activeAdminCount(): number {
    return this.repository
      .listProfiles()
      .filter((profile) => profile.role === 'ADMIN' && profile.isActive).length
  }
}
