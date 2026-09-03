import { app, ipcMain } from 'electron'
import { join } from 'node:path'
import {
  backupIpcChannels,
  backupRestoreRequestSchema,
  onlineBackupRestoreRequestSchema,
  onlineBackupRevisionRequestSchema
} from '../../shared/contracts'
import { toIpcError } from '../database/errors'
import { AuthService } from '../services/auth-service'
import { BackupService } from '../services/backup-service'
import { OnlineBackupRevisionService } from '../services/online-backup-revision-service'

export function registerBackupIpc(
  service: BackupService,
  revisions: OnlineBackupRevisionService,
  auth: AuthService,
  installRevision: (stagedPath: string) => void
): void {
  ipcMain.handle(backupIpcChannels.create, async () => {
    try {
      auth.requireAdmin()
      return await service.createManaged(join(app.getPath('userData'), 'backups'))
    } catch (error) {
      throw toIpcError(error)
    }
  })
  ipcMain.handle(backupIpcChannels.restore, async (_event, input: unknown) => {
    try {
      auth.requireAdmin()
      return service.restoreManaged(backupRestoreRequestSchema.parse(input).id)
    } catch (error) {
      throw toIpcError(error)
    }
  })
  ipcMain.handle(backupIpcChannels.listOnlineRevisions, async (_event, input: unknown) => {
    try {
      auth.requireAdmin()
      return await revisions.list(onlineBackupRevisionRequestSchema.parse(input).branch)
    } catch (error) {
      throw toIpcError(error)
    }
  })
  ipcMain.handle(backupIpcChannels.restoreOnlineRevision, async (_event, input: unknown) => {
    try {
      auth.requireAdmin()
      const request = onlineBackupRestoreRequestSchema.parse(input)
      installRevision(await revisions.stageRestore(request.id, request.branch))
    } catch (error) {
      throw toIpcError(error)
    }
  })
}
