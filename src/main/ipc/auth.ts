import { ipcMain } from 'electron'

import { authIpcChannels, loginRequestSchema } from '../../shared/contracts'
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
}
