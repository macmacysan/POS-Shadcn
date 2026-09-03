import { ipcMain } from 'electron'
import { googleSyncIpcChannels, googleSyncRequestSchema } from '../../shared/contracts'
import { toIpcError } from '../database/errors'
import { GoogleDriveSnapshotService } from '../services/google-drive-snapshot-service'

export function registerGoogleSyncIpc(service: GoogleDriveSnapshotService): void {
  ipcMain.handle(googleSyncIpcChannels.sync, async (_event, input: unknown) => {
    try { return await service.syncBranch(googleSyncRequestSchema.parse(input).branch) } catch (error) { throw toIpcError(error) }
  })
  ipcMain.handle(googleSyncIpcChannels.records, async () => {
    try { return await service.listRecords() } catch (error) { throw toIpcError(error) }
  })
  ipcMain.handle(googleSyncIpcChannels.blacklisted, async () => {
    try { return await service.listBlacklisted() } catch (error) { throw toIpcError(error) }
  })
}
