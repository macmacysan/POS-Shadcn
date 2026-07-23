import type {
  InstallmentBootstrapRequest,
  InstallmentListRequest,
  InstallmentTransitionRequest
} from '../../shared/contracts'
import { InstallmentRepository } from '../database/installment-repository'

export class InstallmentService {
  constructor(private readonly repository: InstallmentRepository) {}

  list(request: InstallmentListRequest) {
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
}
