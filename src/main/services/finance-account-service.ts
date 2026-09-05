import type {
  FinanceAccountCreateRequest,
  FinanceAccountUnvoidRequest,
  FinanceAccountVoidRequest,
  FinanceAccountListRequest,
  FinanceAccountListResult,
  FinanceAccountRecord,
  FinanceAccountUpdateRequest,
  FinanceAccountTransferRequest
} from '../../shared/contracts'
import { AppError } from '../database/errors'
import { AuthService } from './auth-service'
type FinanceRepository = {
  list(
    request: FinanceAccountListRequest
  ): Promise<FinanceAccountListResult> | FinanceAccountListResult
  create(request: FinanceAccountCreateRequest): Promise<FinanceAccountRecord> | FinanceAccountRecord
  update(request: FinanceAccountUpdateRequest): Promise<FinanceAccountRecord> | FinanceAccountRecord
  void(ids: readonly string[], actorUserId: string, reason: string): Promise<void> | void
  unvoid(ids: readonly string[], actorUserId: string): Promise<void> | void
  transfer(
    id: string,
    branch: FinanceAccountRecord['branch'],
    actorUserId: string,
    reason: string
  ): Promise<FinanceAccountRecord> | FinanceAccountRecord
  listGoogleCache?: () => Promise<FinanceAccountListResult> | FinanceAccountListResult
}

export class FinanceAccountService {
  constructor(
    private readonly repository: FinanceRepository,
    private readonly auth: AuthService
  ) {}

  async list(request: FinanceAccountListRequest): Promise<FinanceAccountListResult> {
    this.auth.requireCashierWorkspace()
    const local = await this.repository.list({
      ...request,
      includeVoided: request.includeVoided
    })
    const cached = (await this.repository.listGoogleCache?.())?.rows ?? []
    const rows = [...new Map([...cached, ...local.rows].map((row) => [row.id, row])).values()].filter(
      (row) =>
        (!request.branch || row.branch === request.branch) &&
        (request.includeVoided || row.status === 'POSTED') &&
        (!request.search || `${row.branch} ${row.provider} ${row.lastName} ${row.firstName}`.toLowerCase().includes(request.search.toLowerCase()))
    )
    return { rows }
  }

  async create(request: FinanceAccountCreateRequest): Promise<FinanceAccountRecord> {
    this.auth.requireBranchName(request.branch, 'Administrators have read-only finance access.')
    return this.repository.create(request)
  }

  async update(request: FinanceAccountUpdateRequest): Promise<FinanceAccountRecord> {
    const current = await this.repository.list({ search: '', branch: undefined })
    const record = current.rows.find((item) => item.id === request.id)
    if (!record) throw new AppError('NOT_FOUND', 'Finance account was not found.')
    this.auth.requireBranchName(record.branch, 'You cannot edit another branch finance account.')
    this.auth.requireBranchName(
      request.branch,
      'You cannot move a finance account between branches.'
    )
    return this.repository.update(request)
  }
  async void(
    request: Pick<FinanceAccountVoidRequest, 'ids' | 'reason'>,
    actorUserId: string
  ): Promise<void> {
    const rows = await this.repository.list({ search: '' })
    for (const id of request.ids) {
      const record = rows.rows.find((item) => item.id === id)
      if (!record) throw new AppError('NOT_FOUND', 'Finance account was not found.')
      this.auth.requireBranchName(record.branch, 'You cannot void another branch finance account.')
    }
    await this.repository.void(request.ids, actorUserId, request.reason)
  }

  async unvoid(request: FinanceAccountUnvoidRequest, actorUserId: string): Promise<void> {
    void request
    void actorUserId
    this.auth.requireCashierWorkspace()
    throw new AppError('FORBIDDEN', 'Restoring finance accounts is unavailable in this app.')
  }

  async transfer(request: FinanceAccountTransferRequest): Promise<FinanceAccountRecord> {
    void request
    this.auth.requireCashierWorkspace()
    throw new AppError('FORBIDDEN', 'Transferring finance accounts is unavailable in this app.')
  }
}
