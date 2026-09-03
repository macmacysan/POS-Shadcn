import { z } from 'zod'

export const entryEntityTypeSchema = z.enum(['EXPENSE', 'INCOME', 'PAYMENT'])
export const entryHistoryActionSchema = z.enum([
  'CREATED',
  'UPDATED',
  'DUPLICATED',
  'VOIDED',
  'DELETED'
])

export const entryHistoryListRequestSchema = z.object({
  entityType: entryEntityTypeSchema,
  entityId: z.string().trim().min(1).max(100)
})

export const entryHistoryChangeSchema = z.object({
  field: z.string().trim().min(1).max(100),
  oldValue: z.string().nullable(),
  newValue: z.string().nullable()
})

export const entryHistoryRecordSchema = z.object({
  id: z.string().min(1),
  entityType: entryEntityTypeSchema,
  entityId: z.string().min(1),
  action: entryHistoryActionSchema,
  actorUserId: z.string().nullable(),
  actorName: z.string().nullable(),
  reason: z.string().nullable(),
  createdAt: z.string(),
  changes: z.array(entryHistoryChangeSchema)
})

export const entryHistoryListResponseSchema = z.object({
  rows: z.array(entryHistoryRecordSchema)
})

export const entryHistoryIpcChannels = {
  list: 'reports:entry-history:list'
} as const

export type EntryEntityType = z.infer<typeof entryEntityTypeSchema>
export type EntryHistoryAction = z.infer<typeof entryHistoryActionSchema>
export type EntryHistoryListRequest = z.infer<typeof entryHistoryListRequestSchema>
export type EntryHistoryRecord = z.infer<typeof entryHistoryRecordSchema>

export type EntryHistoryApi = {
  entryHistory: {
    list(request: EntryHistoryListRequest): Promise<EntryHistoryListResponse>
  }
}

export type EntryHistoryListResponse = z.infer<typeof entryHistoryListResponseSchema>
