import { ipcMain } from 'electron'

import {
  installmentBootstrapRequestSchema,
  installmentIpcChannels,
  installmentListRequestSchema,
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
}
