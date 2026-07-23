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

export const reportIpcChannels = {
  getById: 'reports:get-by-id'
} as const

export type ReportsApi = {
  reports: {
    getById(reportId: string): Promise<ReportRecord | null>
  }
}
