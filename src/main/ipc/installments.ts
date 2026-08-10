import { ipcMain } from 'electron'

import {
  installmentBootstrapRequestSchema,
  installmentAdjustPaymentRequestSchema,
  installmentCreatePaymentRequestSchema,
  installmentIpcChannels,
  installmentListRequestSchema,
  installmentPaymentWorkspaceRequestSchema,
  installmentHistoryRequestSchema,
  installmentTransitionRequestSchema
} from '../../shared/contracts'
import { toIpcError } from '../database/errors'
import { InstallmentService } from '../services/installment-service'

function rethrowIpcError(error: unknown): never {
  throw toIpcError(error)
}

export function registerInstallmentIpc(service: InstallmentService): void {
  ipcMain.handle(installmentIpcChannels.list, (_event, input: unknown) => {
    try {
      return service.list(installmentListRequestSchema.parse(input))
    } catch (error) {
      return rethrowIpcError(error)
    }
  })

  ipcMain.handle(installmentIpcChannels.bootstrap, (_event, input: unknown) => {
    try {
      service.bootstrap(installmentBootstrapRequestSchema.parse(input))
    } catch (error) {
      return rethrowIpcError(error)
    }
  })

  ipcMain.handle(installmentIpcChannels.closeContract, (_event, input: unknown) => {
    try {
      service.closeContract(installmentTransitionRequestSchema.parse(input))
    } catch (error) {
      return rethrowIpcError(error)
    }
  })

  ipcMain.handle(installmentIpcChannels.blacklistAccount, (_event, input: unknown) => {
    try {
      service.blacklistAccount(installmentTransitionRequestSchema.parse(input))
    } catch (error) {
      return rethrowIpcError(error)
    }
  })

  ipcMain.handle(installmentIpcChannels.paymentWorkspace, (_event, input: unknown) => {
    try {
      return service.getPaymentWorkspace(installmentPaymentWorkspaceRequestSchema.parse(input))
    } catch (error) {
      return rethrowIpcError(error)
    }
  })

  ipcMain.handle(installmentIpcChannels.history, (_event, input: unknown) => {
    try {
      return service.listHistory(installmentHistoryRequestSchema.parse(input))
    } catch (error) {
      return rethrowIpcError(error)
    }
  })

  ipcMain.handle(installmentIpcChannels.createPayment, (_event, input: unknown) => {
    try {
      service.createPayment(installmentCreatePaymentRequestSchema.parse(input))
    } catch (error) {
      return rethrowIpcError(error)
    }
  })

  ipcMain.handle(installmentIpcChannels.adjustPayment, (_event, input: unknown) => {
    try {
      service.adjustPayment(installmentAdjustPaymentRequestSchema.parse(input))
    } catch (error) {
      return rethrowIpcError(error)
    }
  })
}
