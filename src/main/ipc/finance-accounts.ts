import { ipcMain } from 'electron'

import {
  financeAccountCreateRequestSchema,
  financeAccountDeleteRequestSchema,
  financeAccountIpcChannels,
  financeAccountListRequestSchema,
  financeAccountUpdateRequestSchema
} from '../../shared/contracts'
import { toIpcError } from '../database/errors'
import { FinanceAccountService } from '../services/finance-account-service'
import { AuthService } from '../services/auth-service'

export function registerFinanceAccountIpc(service: FinanceAccountService, authService: AuthService): void {
  ipcMain.handle(financeAccountIpcChannels.list, (_event, input: unknown) => {
    try {
      return service.list(financeAccountListRequestSchema.parse(input))
    } catch (error) {
      throw toIpcError(error)
    }
  })
  ipcMain.handle(financeAccountIpcChannels.create, (_event, input: unknown) => {
    try {
      return service.create(financeAccountCreateRequestSchema.parse(input))
    } catch (error) {
      throw toIpcError(error)
    }
  })
  ipcMain.handle(financeAccountIpcChannels.update, (_event, input: unknown) => {
    try {
      return service.update(financeAccountUpdateRequestSchema.parse(input))
    } catch (error) {
      throw toIpcError(error)
    }
  })
  ipcMain.handle(financeAccountIpcChannels.delete, (_event, input: unknown) => {
    try {
      const request = financeAccountDeleteRequestSchema.parse(input)
      authService.confirmAdminPassword(request.password)
      service.delete(request)
    } catch (error) {
      throw toIpcError(error)
    }
  })
}
