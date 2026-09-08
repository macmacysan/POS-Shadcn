import { z } from '../zod'

export const backupRestoreRequestSchema = z.object({ id: z.string().trim().min(1).max(100) })
export const portableDatabaseImportRequestSchema = z.object({
  filePath: z.string().trim().min(1).max(32767)
})
export const backupRecordSchema = z.object({
  filePath: z.string().min(1),
  sha256: z.string().length(64)
})
export const onlineBackupRevisionSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string().datetime(),
  sizeBytes: z.number().int().nonnegative(),
  verified: z.boolean()
})
export const onlineBackupRevisionRequestSchema = z.object({
  branch: z.enum(['Goa', 'Tinambac', 'Tigaon', 'Lagonoy'])
})
export const onlineBackupRestoreRequestSchema = z.object({
  id: z.string().trim().min(1).max(100),
  branch: z.enum(['Goa', 'Tinambac', 'Tigaon', 'Lagonoy'])
})
export const backupIpcChannels = {
  create: 'backups:create',
  restore: 'backups:restore',
  exportPortable: 'backups:portable:export',
  importPortable: 'backups:portable:import',
  listOnlineRevisions: 'backups:list-online-revisions',
  restoreOnlineRevision: 'backups:restore-online-revision'
} as const
export type BackupRestoreRequest = z.infer<typeof backupRestoreRequestSchema>
export type PortableDatabaseImportRequest = z.infer<typeof portableDatabaseImportRequestSchema>
export type BackupRecord = z.infer<typeof backupRecordSchema>
export type OnlineBackupRevision = z.infer<typeof onlineBackupRevisionSchema>
export type BackupsApi = {
  backups: {
    create(): Promise<BackupRecord>
    restore(request: BackupRestoreRequest): Promise<string>
    exportPortable(): Promise<{ filePath: string; schemaVersion: number }>
    importPortable(request: PortableDatabaseImportRequest): Promise<void>
    listOnlineRevisions(
      request: z.infer<typeof onlineBackupRevisionRequestSchema>
    ): Promise<OnlineBackupRevision[]>
    restoreOnlineRevision(request: z.infer<typeof onlineBackupRestoreRequestSchema>): Promise<void>
  }
}
