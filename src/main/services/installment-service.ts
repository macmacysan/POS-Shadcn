import type {
  InstallmentAdjustPaymentRequest,
  InstallmentBootstrapRequest,
  InstallmentCreatePaymentRequest,
  InstallmentListRequest,
  InstallmentListResult,
  InstallmentPaymentWorkspace,
  InstallmentPaymentWorkspaceRequest,
  InstallmentHistoryRecord,
  InstallmentHistoryRequest,
  InstallmentTransitionRequest
} from '../../shared/contracts'
import { InstallmentRepository } from '../database/installment-repository'

export class InstallmentService {
  constructor(private readonly repository: InstallmentRepository) {}

  list(request: InstallmentListRequest): InstallmentListResult {
    return this.repository.list(request)
  }

  bootstrap(request: InstallmentBootstrapRequest): void {
    this.repository.bootstrap(request)
  }

  closeContract(request: InstallmentTransitionRequest): void {
    this.repository.closeContract(request)
  }

  blacklistAccount(request: InstallmentTransitionRequest): void {
    this.repository.blacklistAccount(request)
  }

  getPaymentWorkspace(request: InstallmentPaymentWorkspaceRequest): InstallmentPaymentWorkspace {
    return this.repository.getPaymentWorkspace(request)
  }

  listHistory(request: InstallmentHistoryRequest): InstallmentHistoryRecord[] {
    return this.repository.listHistory(request)
  }

  createPayment(request: InstallmentCreatePaymentRequest): void {
    this.repository.createPayment(request)
  }

  adjustPayment(request: InstallmentAdjustPaymentRequest): void {
    this.repository.adjustPayment(request)
  }
}
