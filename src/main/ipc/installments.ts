import { ipcMain } from 'electron'

import {
  installmentBootstrapRequestSchema,
  installmentLoanUpdateRequestSchema,
  installmentLoanRestructureRequestSchema,
  installmentAdjustPaymentRequestSchema,
  installmentCreatePaymentRequestSchema,
  installmentUnvoidRequestSchema,
  installmentVoidRequestSchema,
  installmentVoidPaymentsRequestSchema,
  installmentIpcChannels,
  installmentAttentionRequestSchema,
  installmentListRequestSchema,
  installmentPaymentWorkspaceRequestSchema,
  installmentHistoryRequestSchema,
  installmentRestoreStatusRequestSchema,
  installmentTransitionRequestSchema
} from '../../shared/contracts'
import { toIpcError } from '../database/errors'
import { InstallmentService } from '../services/installment-service'
import { AuthService } from '../services/auth-service'

function rethrowIpcError(error: unknown): never {
  const payload = toIpcError(error)
  const ipcError = new Error(payload.message)
  Object.assign(ipcError, { code: payload.code })
  throw ipcError
}

export function registerInstallmentIpc(
  service: InstallmentService,
  authService: AuthService,
  onCommitted?: () => void
): void {
  ipcMain.handle(installmentIpcChannels.list, async (_event, input: unknown) => {
    try {
      return await service.list(installmentListRequestSchema.parse(input))
    } catch (error) {
      return rethrowIpcError(error)
    }
  })

  ipcMain.handle(installmentIpcChannels.attentionSummary, async (_event, input: unknown) => {
    try {
      const request = installmentAttentionRequestSchema.parse(input)
      return await service.getAttentionSummary(request.branch)
    } catch (error) {
      return rethrowIpcError(error)
    }
  })

  ipcMain.handle(installmentIpcChannels.bootstrap, async (_event, input: unknown) => {
    try {
      await service.bootstrap(installmentBootstrapRequestSchema.parse(input)); onCommitted?.()
    } catch (error) {
      return rethrowIpcError(error)
    }
  })

  ipcMain.handle(installmentIpcChannels.updateLoan, async (_event, input: unknown) => {
    try {
      await service.updateLoan(installmentLoanUpdateRequestSchema.parse(input)); onCommitted?.()
    } catch (error) {
      return rethrowIpcError(error)
    }
  })
  ipcMain.handle(installmentIpcChannels.restructureLoan, async (_event, input: unknown) => {
    try {
      await service.restructureLoan(installmentLoanRestructureRequestSchema.parse(input)); onCommitted?.()
    } catch (error) {
      return rethrowIpcError(error)
    }
  })

  ipcMain.handle(installmentIpcChannels.closeContract, async (_event, input: unknown) => {
    try {
      const request = installmentTransitionRequestSchema.parse(input)
      await service.closeContract({ ...request, actorUserId: authService.requireSession().id }); onCommitted?.()
    } catch (error) {
      return rethrowIpcError(error)
    }
  })

  ipcMain.handle(installmentIpcChannels.blacklistAccount, async (_event, input: unknown) => {
    try {
      const request = installmentTransitionRequestSchema.parse(input)
      await service.blacklistAccount({ ...request, actorUserId: authService.requireSession().id }); onCommitted?.()
    } catch (error) {
      return rethrowIpcError(error)
    }
  })
  ipcMain.handle(installmentIpcChannels.restoreStatus, async (_event, input: unknown) => {
    try {
      const request = installmentRestoreStatusRequestSchema.parse(input)
      await service.restoreStatus({ ...request, actorUserId: authService.requireSession().id }); onCommitted?.()
    } catch (error) {
      return rethrowIpcError(error)
    }
  })
  ipcMain.handle(installmentIpcChannels.void, async (_event, input: unknown) => {
    try {
      const request = installmentVoidRequestSchema.parse(input)
      const user = authService.confirmAdminPassword(request.password)
      await service.void(request, user.id); onCommitted?.()
    } catch (error) {
      return rethrowIpcError(error)
    }
  })
  ipcMain.handle(installmentIpcChannels.unvoid, async (_event, input: unknown) => {
    try {
      const request = installmentUnvoidRequestSchema.parse(input)
      const user = authService.requireAdmin()
      await service.unvoid(request, user.id); onCommitted?.()
    } catch (error) {
      return rethrowIpcError(error)
    }
  })
  ipcMain.handle(installmentIpcChannels.voidPayments, async (_event, input: unknown) => {
    try {
      const request = installmentVoidPaymentsRequestSchema.parse(input)
      const user = authService.confirmAdminPassword(request.password)
      await service.voidPayments(request.paymentIds, user.id); onCommitted?.()
    } catch (error) {
      return rethrowIpcError(error)
    }
  })

  ipcMain.handle(installmentIpcChannels.paymentWorkspace, async (_event, input: unknown) => {
    try {
      return await service.getPaymentWorkspace(
        installmentPaymentWorkspaceRequestSchema.parse(input)
      )
    } catch (error) {
      return rethrowIpcError(error)
    }
  })

  ipcMain.handle(installmentIpcChannels.history, async (_event, input: unknown) => {
    try {
      return await service.listHistory(installmentHistoryRequestSchema.parse(input))
    } catch (error) {
      return rethrowIpcError(error)
    }
  })

  ipcMain.handle(installmentIpcChannels.createPayment, async (_event, input: unknown) => {
    try {
      const request = installmentCreatePaymentRequestSchema.parse(input)
      await service.createPayment({ ...request, actorUserId: authService.requireSession().id }); onCommitted?.()
    } catch (error) {
      return rethrowIpcError(error)
    }
  })

  ipcMain.handle(installmentIpcChannels.adjustPayment, async (_event, input: unknown) => {
    try {
      const request = installmentAdjustPaymentRequestSchema.parse(input)
      await service.adjustPayment({ ...request, actorUserId: authService.requireSession().id }); onCommitted?.()
    } catch (error) {
      return rethrowIpcError(error)
    }
  })
}
