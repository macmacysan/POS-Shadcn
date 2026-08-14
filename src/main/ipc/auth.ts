import { ipcMain } from 'electron'

import { authIpcChannels, initialAdminSetupSchema, loginRequestSchema } from '../../shared/contracts'
import { toIpcError } from '../database/errors'
import { AuthService } from '../services/auth-service'

export function registerAuthIpc(service: AuthService): void {
  ipcMain.handle(authIpcChannels.login, (_event, input: unknown) => {
    try {
      return service.login(loginRequestSchema.parse(input))
    } catch (error) {
      throw toIpcError(error)
    }
  })
  ipcMain.handle(authIpcChannels.logout, () => service.logout())
  ipcMain.handle(authIpcChannels.needsSetup, () => service.needsSetup())
  ipcMain.handle(authIpcChannels.setupInitialAdmin, (_event, input: unknown) => {
    try { return service.setupInitialAdmin(initialAdminSetupSchema.parse(input)) } catch (error) { throw toIpcError(error) }
  })
}
