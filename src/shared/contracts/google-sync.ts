import { z } from '../zod'
import type { InstallmentListResult } from './installments'

export const googleSyncBranchValues = ['Goa', 'Tinambac', 'Tigaon', 'Lagonoy'] as const
export const googleSyncRequestSchema = z.object({ branch: z.enum(googleSyncBranchValues) })
export const googleSyncResponseSchema = z.object({
  branch: z.enum(googleSyncBranchValues),
  imported: z.number().int().nonnegative(),
  duplicates: z.number().int().nonnegative(),
  conflicts: z.number().int().nonnegative(),
  invalid: z.number().int().nonnegative(),
  missingTabs: z.array(z.string())
})
export const googleSyncProgressPhaseValues = [
  'downloading',
  'validating',
  'uploading',
  'uploaded',
  'retrying',
  'importing',
  'completed',
  'failed'
] as const
export const googleSyncProgressSchema = z.object({
  branch: z.enum(googleSyncBranchValues),
  sheet: z.string().min(1).max(31),
  phase: z.enum(googleSyncProgressPhaseValues),
  completed: z.number().int().nonnegative(),
  total: z.number().int().positive(),
  rowCount: z.number().int().nonnegative().optional(),
  message: z.string().min(1).max(300).optional()
})
export type GoogleSyncBranch = z.infer<typeof googleSyncRequestSchema>['branch']
export type GoogleSyncResponse = z.infer<typeof googleSyncResponseSchema>
export type GoogleSyncProgress = z.infer<typeof googleSyncProgressSchema>
export const googleSyncIpcChannels = {
  sync: 'google-sync:branch',
  progress: 'google-sync:progress',
  records: 'google-sync:records',
  blacklisted: 'google-sync:blacklisted'
} as const
export type GoogleSyncApi = {
  googleSync: {
    sync(request: { branch: GoogleSyncBranch }): Promise<GoogleSyncResponse>
    onProgress(listener: (progress: GoogleSyncProgress) => void): () => void
    records(): Promise<InstallmentListResult>
    blacklisted(): Promise<InstallmentListResult>
  }
}

const publishCellSchema = z.union([z.string().max(20_000), z.number().finite(), z.null()])
const publishRowSchema = z.record(z.string().max(100), publishCellSchema)
const publishTabSchema = z.object({
  name: z.string().regex(/^[A-Za-z0-9 _-]{1,31}$/),
  rows: z.array(publishRowSchema).max(10_000)
})
export const googlePublishRequestSchema = z.object({
  branch: z.enum(googleSyncBranchValues),
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tabs: z.array(publishTabSchema).min(1).max(12)
})
export const googlePublishResponseSchema = z.object({
  branch: z.enum(googleSyncBranchValues),
  businessDate: z.string(),
  updatedRows: z.number().int().nonnegative(),
  appendedRows: z.number().int().nonnegative()
})
export type GooglePublishRequest = z.infer<typeof googlePublishRequestSchema>
export type GooglePublishResponse = z.infer<typeof googlePublishResponseSchema>
export const googlePublishIpcChannels = { publish: 'google-sync:publish' } as const
