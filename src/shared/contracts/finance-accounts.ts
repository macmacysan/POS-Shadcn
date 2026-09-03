import { z } from 'zod'

import { calculateFinanceAmounts } from '../finance-calculations'

export const financeBranchValues = ['Goa', 'Tinambac', 'Tigaon', 'Lagonoy'] as const
export const financeProviderValues = ['Home Credit', 'Salmon', 'Skyro'] as const
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
export const financeItemInputSchema = z.object({
  item: z.string().trim().min(1).max(300),
  serialNo: z.string().trim().max(200).optional(),
  quantity: z.number().int().positive(),
  itemPriceCentavos: z.number().int().positive()
})

export const financeAccountInputSchema = z
  .object({
    branch: z.enum(financeBranchValues),
    provider: z.string().trim().min(1).max(200),
    dateReleased: dateSchema,
    termsMonths: z.number().int().min(1).max(24),
    lastName: z.string().trim().min(1).max(100),
    firstName: z.string().trim().min(1).max(100),
    middleName: z.string().trim().max(100).optional(),
    suffix: z.string().trim().max(30).optional(),
    items: z.array(financeItemInputSchema).min(1).max(100),
    downpaymentCentavos: z.number().int().nonnegative(),
    orNumber: z.string().trim().max(100).optional(),
    orDate: dateSchema.optional(),
    paidDate: dateSchema.optional(),
    remarks: z.string().trim().max(1000).optional()
  })
  .superRefine((value, context) => {
    const amounts = calculateFinanceAmounts(value.items, value.downpaymentCentavos)
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
export const financeAccountVoidRequestSchema = z.object({
  ids: z.array(z.string().trim().min(1).max(200)).min(1).max(100),
  password: z.string().min(1).max(200),
  reason: z.string().trim().min(1).max(1000)
})
export const financeAccountUnvoidRequestSchema = z.object({
  ids: z.array(z.string().trim().min(1).max(200)).min(1).max(100)
})
export const financeAccountTransferRequestSchema = z.object({
  id: z.string().uuid(),
  branch: z.enum(financeBranchValues),
  reason: z.string().trim().min(1).max(1000)
})
export const financeAccountListRequestSchema = z.object({
  search: z.string().trim().max(200).default(''),
  branch: z.enum(financeBranchValues).optional(),
  includeVoided: z.boolean().default(false)
})

export type FinanceAccountInput = z.infer<typeof financeAccountInputSchema>
export type FinanceItemInput = z.infer<typeof financeItemInputSchema>
export type FinanceAccountCreateRequest = z.infer<typeof financeAccountCreateRequestSchema>
export type FinanceAccountUpdateRequest = z.infer<typeof financeAccountUpdateRequestSchema>
export type FinanceAccountVoidRequest = z.infer<typeof financeAccountVoidRequestSchema>
export type FinanceAccountUnvoidRequest = z.infer<typeof financeAccountUnvoidRequestSchema>
export type FinanceAccountTransferRequest = z.infer<typeof financeAccountTransferRequestSchema>
export type FinanceAccountListRequest = Omit<
  z.infer<typeof financeAccountListRequestSchema>,
  'includeVoided'
> & { includeVoided?: boolean }
export type FinanceAccountRecord = Omit<FinanceAccountInput, 'items'> & {
  items: FinanceItemRecord[]
  id: string
  grandTotalCentavos: number
  balanceCentavos: number
  createdAt: string
  updatedAt: string
  status: 'POSTED' | 'VOIDED'
  voidedAt: string | null
  voidedByUserId: string | null
  voidReason: string | null
}
export type FinanceItemRecord = FinanceItemInput & {
  id: string
  totalCentavos: number
}
export type FinanceAccountListResult = { rows: FinanceAccountRecord[] }

export const financeAccountIpcChannels = {
  list: 'finance-accounts:list',
  create: 'finance-accounts:create',
  update: 'finance-accounts:update',
  void: 'finance-accounts:void',
  unvoid: 'finance-accounts:unvoid',
  transfer: 'finance-accounts:transfer'
} as const

export type FinanceAccountsApi = {
  financeAccounts: {
    list(request: FinanceAccountListRequest): Promise<FinanceAccountListResult>
    create(request: FinanceAccountCreateRequest): Promise<FinanceAccountRecord>
    update(request: FinanceAccountUpdateRequest): Promise<FinanceAccountRecord>
    void(request: FinanceAccountVoidRequest): Promise<void>
    unvoid(request: FinanceAccountUnvoidRequest): Promise<void>
    transfer(request: FinanceAccountTransferRequest): Promise<FinanceAccountRecord>
  }
}
