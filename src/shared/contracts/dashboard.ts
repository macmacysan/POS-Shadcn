import { z } from 'zod'

import { financeBranchValues } from './finance-accounts'

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const dashboardGetRequestSchema = z.object({
  businessDate: dateSchema,
  branch: z.enum(financeBranchValues).optional()
})

export type DashboardGetRequest = z.infer<typeof dashboardGetRequestSchema>
type FinanceBranch = (typeof financeBranchValues)[number]
export type DashboardOverview = {
  scopeLabel: string
  businessDate: string
  cashierReportCount: number
  reconciledReportCount: number
  physicalCashCentavos: number
  remittedCashCentavos: number
  cashVarianceCentavos: number
  inHouseCollectionsCentavos: number
  financeCollectionsCentavos: number
  overdueCount: number
  overdueBalanceCentavos: number
  overdueAccounts: Array<{
    accountId: string
    accountName: string
    branch: FinanceBranch
    dueDate: string
    outstandingCentavos: number
    delayedDays: number
  }>
}

export const dashboardIpcChannels = {
  get: 'dashboard:get'
} as const

export type DashboardApi = {
  dashboard: {
    get(request: DashboardGetRequest): Promise<DashboardOverview>
  }
}
