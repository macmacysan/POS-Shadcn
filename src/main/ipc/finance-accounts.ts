import { ipcMain } from 'electron'

import {
  financeAccountCreateRequestSchema,
  financeAccountIpcChannels,
  financeAccountListRequestSchema,
  financeAccountUpdateRequestSchema
} from '../../shared/contracts'
import { toIpcError } from '../database/errors'
import { FinanceAccountService } from '../services/finance-account-service'

export function registerFinanceAccountIpc(service: FinanceAccountService): void {
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
}
