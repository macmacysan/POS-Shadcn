import { z } from 'zod'

const reportIdSchema = z.string().uuid()

export const reportGetByIdRequestSchema = z.object({
  reportId: reportIdSchema
})

export const reportStatusValues = ['Draft', 'Submitted', 'Locked'] as const
export const reportStatusSchema = z.enum(reportStatusValues)

export type ReportStatus = z.infer<typeof reportStatusSchema>

export type ReportRecord = {
  reportId: string
  branchId: string
  cashierId: string
  businessDate: string
  status: ReportStatus
}

export const reportReconciliationUpsertRequestSchema = z.object({
  reportId: reportIdSchema,
  physicalCashCentavos: z.number().int(),
  cashRemittedCentavos: z.number().int().nonnegative(),
  cashVarianceCentavos: z.number().int()
})

export type ReportReconciliationUpsertRequest = z.infer<typeof reportReconciliationUpsertRequestSchema>

export const reportIpcChannels = {
  getById: 'reports:get-by-id',
  upsertReconciliation: 'reports:upsert-reconciliation'
} as const

export type ReportsApi = {
  reports: {
    getById(reportId: string): Promise<ReportRecord | null>
    upsertReconciliation(request: ReportReconciliationUpsertRequest): Promise<void>
  }
}
