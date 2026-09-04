import type {
  InstallmentAdjustPaymentRequest,
  InstallmentAttentionSummary,
  InstallmentBootstrapRequest,
  InstallmentCreatePaymentRequest,
  InstallmentUnvoidRequest,
  InstallmentVoidRequest,
  InstallmentListRequest,
  InstallmentListResult,
  InstallmentPaymentWorkspace,
  InstallmentPaymentWorkspaceRequest,
  InstallmentRestoreStatusRequest,
  InstallmentHistoryRecord,
  InstallmentHistoryRequest,
  InstallmentLoanUpdateRequest,
  InstallmentLoanRestructureRequest,
  InstallmentTransitionRequest
} from '../../shared/contracts'
import { AppError } from '../database/errors'
import { AuthService } from './auth-service'
type InstallmentRepositoryLike = {
  branchIdForAccount(accountId: string): string | null
  branchIdForContract(contractId: string): string | null
  branchIdForPayment(paymentId: string): string | null
  list(request: InstallmentListRequest): Promise<InstallmentListResult> | InstallmentListResult
  getAttentionSummary(branch?: string): Promise<InstallmentAttentionSummary> | InstallmentAttentionSummary
  bootstrap(request: InstallmentBootstrapRequest): Promise<void> | void
  updateLoan(request: InstallmentLoanUpdateRequest): Promise<void> | void
  restructureLoan(request: InstallmentLoanRestructureRequest & { actorUserId: string }): Promise<void> | void
  closeContract(request: InstallmentTransitionRequest): Promise<void> | void
  blacklistAccount(request: InstallmentTransitionRequest): Promise<void> | void
  restoreStatus(request: InstallmentRestoreStatusRequest): Promise<void> | void
  voidContracts(ids: readonly string[], actorUserId: string, reason: string): Promise<void> | void
  unvoidContracts(ids: readonly string[], actorUserId: string): Promise<void> | void
  voidPayments(ids: readonly string[], actorUserId: string): Promise<void> | void
  getPaymentWorkspace(
    request: InstallmentPaymentWorkspaceRequest
  ): Promise<InstallmentPaymentWorkspace> | InstallmentPaymentWorkspace
  listHistory(
    request: InstallmentHistoryRequest
  ): Promise<InstallmentHistoryRecord[]> | InstallmentHistoryRecord[]
  createPayment(request: InstallmentCreatePaymentRequest): Promise<void> | void
  adjustPayment(request: InstallmentAdjustPaymentRequest): Promise<void> | void
}

export class InstallmentService {
  constructor(
    private readonly repository: InstallmentRepositoryLike,
    private readonly auth: AuthService
  ) {}

  async list(request: InstallmentListRequest): Promise<InstallmentListResult> {
    this.auth.requireCashierWorkspace()
    return await this.repository.list({
      ...request,
      includeVoided: request.includeVoided
    })
  }

  async getAttentionSummary(branch?: string): Promise<InstallmentAttentionSummary> {
    const user = this.auth.requireCashierWorkspace()
    return await this.repository.getAttentionSummary(user.role === 'ADMIN' ? branch : user.branch)
  }

  async bootstrap(request: InstallmentBootstrapRequest): Promise<void> {
    const user = this.auth.requireCashierWorkspace()
    if (user.role === 'ADMIN')
      throw new AppError('FORBIDDEN', 'Administrators have read-only account access.')
    for (const account of request.accounts) {
      const branch = typeof account.branch === 'string' ? account.branch : ''
      this.auth.requireBranchName(branch)
      const existingBranch = this.repository.branchIdForAccount(String(account.id ?? ''))
      if (existingBranch !== null && existingBranch !== user.branchId)
        throw new AppError('FORBIDDEN', 'You cannot modify another branch account.')
    }
    await this.repository.bootstrap(request)
  }

  async updateLoan(request: InstallmentLoanUpdateRequest): Promise<void> {
    this.auth.requireOwnBranch(
      this.repository.branchIdForAccount(request.accountId),
      'You cannot modify another branch account.'
    )
    if (
      this.repository.branchIdForContract(request.contractId) !==
      this.repository.branchIdForAccount(request.accountId)
    )
      throw new AppError('NOT_FOUND', 'Installment contract was not found.')
    await this.repository.updateLoan(request)
  }

  async restructureLoan(request: InstallmentLoanRestructureRequest): Promise<void> {
    const user = this.auth.requireCashierWorkspace()
    this.auth.requireOwnBranch(
      this.repository.branchIdForAccount(request.accountId),
      'You cannot modify another branch account.'
    )
    if (this.repository.branchIdForContract(request.contractId) !== user.branchId)
      throw new AppError('NOT_FOUND', 'Installment contract was not found.')
    await this.repository.restructureLoan({ ...request, actorUserId: user.id })
  }

  async closeContract(request: InstallmentTransitionRequest): Promise<void> {
    this.auth.requireOwnBranch(
      this.repository.branchIdForContract(request.contractId ?? ''),
      'You cannot close another branch account.'
    )
    await this.repository.closeContract(request)
  }

  async blacklistAccount(request: InstallmentTransitionRequest): Promise<void> {
    this.auth.requireOwnBranch(
      this.repository.branchIdForAccount(request.accountId),
      'You cannot blacklist another branch account.'
    )
    await this.repository.blacklistAccount(request)
  }
  async restoreStatus(request: InstallmentRestoreStatusRequest): Promise<void> {
    this.auth.requireOwnBranch(
      request.status === 'closed'
        ? this.repository.branchIdForContract(request.contractId ?? '')
        : this.repository.branchIdForAccount(request.accountId),
      'You cannot restore another branch account.'
    )
    await this.repository.restoreStatus(request)
  }
  async void(
    request: Pick<InstallmentVoidRequest, 'contractIds' | 'reason'>,
    actorUserId: string
  ): Promise<void> {
    for (const id of request.contractIds)
      this.auth.requireOwnBranch(
        this.repository.branchIdForContract(id),
        'You cannot void another branch account.'
      )
    await this.repository.voidContracts(request.contractIds, actorUserId, request.reason)
  }

  async unvoid(request: InstallmentUnvoidRequest, actorUserId: string): Promise<void> {
    void request
    void actorUserId
    this.auth.requireCashierWorkspace()
    throw new AppError('FORBIDDEN', 'Restoring installment contracts is unavailable in this app.')
  }

  async voidPayments(paymentIds: readonly string[], actorUserId: string): Promise<void> {
    for (const id of paymentIds)
      this.auth.requireOwnBranch(
        this.repository.branchIdForPayment(id),
        'You cannot void another branch payment.'
      )
    await this.repository.voidPayments(paymentIds, actorUserId)
  }

  async getPaymentWorkspace(
    request: InstallmentPaymentWorkspaceRequest
  ): Promise<InstallmentPaymentWorkspace> {
    this.auth.requireCashierWorkspace()
    return await this.repository.getPaymentWorkspace(request)
  }

  async listHistory(request: InstallmentHistoryRequest): Promise<InstallmentHistoryRecord[]> {
    this.auth.requireCashierWorkspace()
    return await this.repository.listHistory(request)
  }

  async createPayment(request: InstallmentCreatePaymentRequest): Promise<void> {
    this.auth.requireOwnBranch(
      this.repository.branchIdForContract(request.contractId),
      'You cannot record another branch payment.'
    )
    await this.repository.createPayment(request)
  }

  async adjustPayment(request: InstallmentAdjustPaymentRequest): Promise<void> {
    this.auth.requireOwnBranch(
      this.repository.branchIdForContract(request.contractId),
      'You cannot adjust another branch payment.'
    )
    await this.repository.adjustPayment(request)
  }
}
