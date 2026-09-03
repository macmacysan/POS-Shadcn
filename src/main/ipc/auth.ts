import { ipcMain } from 'electron'

import {
  type AuthenticatedUser,
  authIpcChannels,
  cashierLoginBranchSchema,
  createAccountRequestSchema,
  loginRequestSchema,
  switchBranchRequestSchema
} from '../../shared/contracts'
import { toIpcError } from '../database/errors'
import { AuthService } from '../services/auth-service'

function throwIpcError(error: unknown): never {
  const payload = toIpcError(error)
  const ipcError = new Error(payload.message)
  Object.assign(ipcError, { code: payload.code })
  throw ipcError
}

export function registerAuthIpc(
  service: AuthService,
  onAuthenticated?: (user: AuthenticatedUser) => Promise<void>,
  beforeLogin?: () => Promise<void>,
  initialRecovery?: {
    required(): boolean
    restore(branch: ReturnType<typeof cashierLoginBranchSchema.parse>): Promise<void>
  }
): void {
  ipcMain.handle(authIpcChannels.login, async (_event, input: unknown) => {
    try {
      await beforeLogin?.()
      const user = await service.login(loginRequestSchema.parse(input))
      if (initialRecovery?.required() && user.role !== 'ADMIN') {
        service.logout()
        throw new Error('An administrator must restore the default branch data before cashiers can sign in.')
      }
      await onAuthenticated?.(user)
      return user
    } catch (error) {
      throwIpcError(error)
    }
  })
  ipcMain.handle(authIpcChannels.createAccount, async (_event, input: unknown) => {
    try {
      await service.createAccount(createAccountRequestSchema.parse(input))
    } catch (error) {
      throwIpcError(error)
    }
  })
  ipcMain.handle(authIpcChannels.getMode, () => service.getMode())
  ipcMain.handle(authIpcChannels.switchBranch, (_event, input: unknown) => {
    try {
      return service.switchBranch(switchBranchRequestSchema.parse(input).branch)
    } catch (error) {
      throwIpcError(error)
    }
  })
  ipcMain.handle(authIpcChannels.getCashierLoginBranch, () => {
    try {
      return service.cashierLoginBranch()
    } catch (error) {
      throwIpcError(error)
    }
  })
  ipcMain.handle(authIpcChannels.setCashierLoginBranch, (_event, input: unknown) => {
    try {
      return service.setCashierLoginBranch(cashierLoginBranchSchema.parse(input))
    } catch (error) {
      throwIpcError(error)
    }
  })
  ipcMain.handle(authIpcChannels.getInitialRecoveryStatus, () => ({
    required: initialRecovery?.required() ?? false
  }))
  ipcMain.handle(authIpcChannels.restoreInitialBranchSnapshot, async (_event, input: unknown) => {
    try {
      service.requireAdmin()
      if (!initialRecovery?.required()) throw new Error('Initial recovery is not required.')
      await initialRecovery.restore(cashierLoginBranchSchema.parse(input))
    } catch (error) {
      throwIpcError(error)
    }
  })
  ipcMain.handle(authIpcChannels.logout, () => service.logout())
}
