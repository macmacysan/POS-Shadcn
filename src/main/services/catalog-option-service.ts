import type {
  AuthenticatedUser,
  CatalogOptionCreateRequest,
  CatalogOptionIdRequest,
  CatalogOptionListRequest,
  CatalogOptionRenameRequest
} from '../../shared/contracts'
import { AppError } from '../database/errors'
import { CatalogOptionRepository } from '../database/catalog-option-repository'
import { AuthService } from './auth-service'

export class CatalogOptionService {
  constructor(
    private readonly repository: CatalogOptionRepository,
    private readonly auth: AuthService
  ) {}
  list(request: CatalogOptionListRequest) {
    this.auth.requireSession()
    return { rows: this.repository.list(request) }
  }
  create(request: CatalogOptionCreateRequest) {
    this.requireAdmin(this.auth.requireSession())
    return this.repository.create(request)
  }
  rename(request: CatalogOptionRenameRequest) {
    this.requireAdmin(this.auth.requireSession())
    return this.repository.rename(request)
  }
  retire(request: CatalogOptionIdRequest) {
    this.requireAdmin(this.auth.requireSession())
    this.repository.retire(request)
  }
  restore(request: CatalogOptionIdRequest) {
    this.requireAdmin(this.auth.requireSession())
    return this.repository.restore(request)
  }
  private requireAdmin(user: AuthenticatedUser): void {
    if (user.role !== 'ADMIN')
      throw new AppError('FORBIDDEN', 'Only administrators can manage catalog options.')
  }
}
