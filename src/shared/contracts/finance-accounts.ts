import { z } from 'zod'

import { calculateFinanceAmounts } from '../finance-calculations'

export const financeBranchValues = ['Goa', 'Tinambac', 'Tigaon', 'Lagonoy'] as const
export const financeProviderValues = ['Home Credit', 'Salmon', 'Skyro'] as const
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const financeAccountInputSchema = z
  .object({
    branch: z.enum(financeBranchValues),
    provider: z.enum(financeProviderValues),
    dateReleased: dateSchema,
    termsMonths: z.number().int().min(1).max(12),
    lastName: z.string().trim().min(1).max(100),
    firstName: z.string().trim().min(1).max(100),
    middleName: z.string().trim().max(100).optional(),
    suffix: z.string().trim().max(30).optional(),
    quantity: z.number().int().positive(),
    item: z.string().trim().min(1).max(300),
    serialNo: z.string().trim().max(200).optional(),
    itemPriceCentavos: z.number().int().positive(),
    downpaymentCentavos: z.number().int().nonnegative(),
    orNumber: z.string().trim().max(100).optional(),
    orDate: dateSchema.optional(),
    paidDate: dateSchema.optional(),
    remarks: z.string().trim().max(1000).optional()
  })
  .superRefine((value, context) => {
    const amounts = calculateFinanceAmounts(
      value.quantity,
      value.itemPriceCentavos,
      value.downpaymentCentavos
    )
    if (amounts.balanceCentavos < 0) {
      context.addIssue({
        code: 'custom',
        path: ['downpaymentCentavos'],
        message: 'Downpayment cannot exceed the grand total.'
      })
    }
  })

export const financeAccountCreateRequestSchema = financeAccountInputSchema
export const financeAccountUpdateRequestSchema = financeAccountInputSchema.extend({
  id: z.string().uuid()
})
export const financeAccountListRequestSchema = z.object({
  search: z.string().trim().max(200).default(''),
  branch: z.enum(financeBranchValues).optional()
})

export type FinanceAccountInput = z.infer<typeof financeAccountInputSchema>
export type FinanceAccountCreateRequest = z.infer<typeof financeAccountCreateRequestSchema>
export type FinanceAccountUpdateRequest = z.infer<typeof financeAccountUpdateRequestSchema>
export type FinanceAccountListRequest = z.infer<typeof financeAccountListRequestSchema>
export type FinanceAccountRecord = FinanceAccountInput & {
  id: string
  grandTotalCentavos: number
  balanceCentavos: number
  createdAt: string
  updatedAt: string
}
export type FinanceAccountListResult = { rows: FinanceAccountRecord[] }

export const financeAccountIpcChannels = {
  list: 'finance-accounts:list',
  create: 'finance-accounts:create',
  update: 'finance-accounts:update'
} as const

export type FinanceAccountsApi = {
  financeAccounts: {
    list(request: FinanceAccountListRequest): Promise<FinanceAccountListResult>
    create(request: FinanceAccountCreateRequest): Promise<FinanceAccountRecord>
    update(request: FinanceAccountUpdateRequest): Promise<FinanceAccountRecord>
  }
}
