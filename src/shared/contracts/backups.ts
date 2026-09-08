import { z } from '../zod'

export const backupRestoreRequestSchema = z.object({ id: z.string().trim().min(1).max(100) })
export const portableDatabaseConfirmationRequestSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{32}$/)
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
  selectPortableImport: 'backups:portable:select',
  cancelPortableImport: 'backups:portable:cancel',
  confirmPortableImport: 'backups:portable:confirm',
  listOnlineRevisions: 'backups:list-online-revisions',
  restoreOnlineRevision: 'backups:restore-online-revision'
} as const
export type BackupRestoreRequest = z.infer<typeof backupRestoreRequestSchema>
export type PortableDatabaseConfirmationRequest = z.infer<
  typeof portableDatabaseConfirmationRequestSchema
>
export type BackupRecord = z.infer<typeof backupRecordSchema>
export type OnlineBackupRevision = z.infer<typeof onlineBackupRevisionSchema>
export type BackupsApi = {
  backups: {
    create(): Promise<BackupRecord>
    restore(request: BackupRestoreRequest): Promise<string>
    exportPortable(): Promise<{ fileName: string; schemaVersion: number } | undefined>
    selectPortableImport(): Promise<
      { token: string; fileName: string; schemaVersion: number } | undefined
    >
    cancelPortableImport(request: PortableDatabaseConfirmationRequest): Promise<void>
    confirmPortableImport(request: PortableDatabaseConfirmationRequest): Promise<void>
    listOnlineRevisions(
      request: z.infer<typeof onlineBackupRevisionRequestSchema>
    ): Promise<OnlineBackupRevision[]>
    restoreOnlineRevision(request: z.infer<typeof onlineBackupRestoreRequestSchema>): Promise<void>
  }
}
