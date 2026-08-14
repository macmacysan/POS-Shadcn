import { ipcMain } from 'electron'

import { telegramSettingsIpcChannels, telegramSettingsSaveRequestSchema } from '../../shared/contracts'
import { toIpcError } from '../database/errors'
import { TelegramSettingsService } from '../services/telegram-settings-service'

export function registerTelegramSettingsIpc(service: TelegramSettingsService): void {
  ipcMain.handle(telegramSettingsIpcChannels.get, async () => {
    try {
      return await service.get()
    } catch (error) {
      throw toIpcError(error)
    }
  })
  ipcMain.handle(telegramSettingsIpcChannels.save, async (_event, input: unknown) => {
    try {
      return await service.save(telegramSettingsSaveRequestSchema.parse(input))
    } catch (error) {
      throw toIpcError(error)
    }
  })
}
