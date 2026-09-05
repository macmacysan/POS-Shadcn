import { ipcMain } from 'electron'

import {
  financeAccountCreateRequestSchema,
  financeAccountUnvoidRequestSchema,
  financeAccountVoidRequestSchema,
  financeAccountIpcChannels,
  financeAccountListRequestSchema,
  financeAccountUpdateRequestSchema,
  financeAccountTransferRequestSchema
} from '../../shared/contracts'
import { toIpcError } from '../database/errors'
import { FinanceAccountService } from '../services/finance-account-service'
import { AuthService } from '../services/auth-service'

function rethrowIpcError(error: unknown): never {
  const payload = toIpcError(error)
  const ipcError = new Error(payload.message)
  Object.assign(ipcError, { code: payload.code })
  throw ipcError
}

export function registerFinanceAccountIpc(
  service: FinanceAccountService,
  authService: AuthService,
  onCommitted?: () => void
): void {
  ipcMain.handle(financeAccountIpcChannels.list, async (_event, input: unknown) => {
    try {
      return await service.list(financeAccountListRequestSchema.parse(input))
    } catch (error) {
      return rethrowIpcError(error)
    }
  })
  ipcMain.handle(financeAccountIpcChannels.create, async (_event, input: unknown) => {
    try {
      const result = await service.create(financeAccountCreateRequestSchema.parse(input)); onCommitted?.(); return result
    } catch (error) {
      return rethrowIpcError(error)
    }
  })
  ipcMain.handle(financeAccountIpcChannels.update, async (_event, input: unknown) => {
    try {
      const result = await service.update(financeAccountUpdateRequestSchema.parse(input)); onCommitted?.(); return result
    } catch (error) {
      return rethrowIpcError(error)
    }
  })
  ipcMain.handle(financeAccountIpcChannels.void, async (_event, input: unknown) => {
    try {
      const request = financeAccountVoidRequestSchema.parse(input)
      const user = authService.requireSession()
      await service.void(request, user.id); onCommitted?.()
    } catch (error) {
      return rethrowIpcError(error)
    }
  })
  ipcMain.handle(financeAccountIpcChannels.unvoid, async (_event, input: unknown) => {
    try {
      const request = financeAccountUnvoidRequestSchema.parse(input)
      const user = authService.requireAdmin()
      await service.unvoid(request, user.id); onCommitted?.()
    } catch (error) {
      return rethrowIpcError(error)
    }
  })
  ipcMain.handle(financeAccountIpcChannels.transfer, async (_event, input: unknown) => {
    try {
      const result = await service.transfer(financeAccountTransferRequestSchema.parse(input)); onCommitted?.(); return result
    } catch (error) {
      return rethrowIpcError(error)
    }
  })
}
