import { ipcMain } from 'electron'

import { entryHistoryIpcChannels, entryHistoryListRequestSchema } from '../../shared/contracts'
import { toIpcError } from '../database/errors'
import { EntryHistoryService } from '../services/entry-history-service'

export function registerEntryHistoryIpc(service: EntryHistoryService): void {
  ipcMain.handle(entryHistoryIpcChannels.list, (_event, input: unknown) => {
    try {
      return service.list(entryHistoryListRequestSchema.parse(input))
    } catch (error) {
      throw toIpcError(error)
    }
  })
}
