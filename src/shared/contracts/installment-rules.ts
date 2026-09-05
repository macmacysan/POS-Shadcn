import { z } from '../zod'

export const installmentFrequencyValues = ['Daily', 'Weekly', 'Semi', 'Monthly'] as const
export const installmentFrequencySchema = z.enum(installmentFrequencyValues)
export type InstallmentFrequency = z.infer<typeof installmentFrequencySchema>

const termSchema = z.number().int().positive().max(365)
const monthlyPlanSchema = z.object({ terms: termSchema, interestRateBps: z.number().int().min(0).max(100000) })
const dailyPlanSchema = z.object({ terms: termSchema, requiredFeePayments: z.number().int().positive().max(100) })

export const installmentRulesSchema = z
  .object({
    standardInterestRateBps: z.number().int().min(0).max(100000),
    requiredDownPaymentRateBps: z.number().int().min(0).max(10000),
    monthlyPlans: z.array(monthlyPlanSchema).min(1).max(24),
    dailyPlans: z.array(dailyPlanSchema).min(1).max(24),
    weeklyTerms: z.array(termSchema).min(1).max(24),
    semiTerms: z.array(termSchema).min(1).max(24)
  })
  .superRefine((value, context) => {
    for (const [key, terms] of [
      ['Monthly', value.monthlyPlans.map((plan) => plan.terms)],
      ['Daily', value.dailyPlans.map((plan) => plan.terms)],
      ['Weekly', value.weeklyTerms],
      ['Semi', value.semiTerms]
    ] as const) {
      if (new Set(terms).size !== terms.length)
        context.addIssue({ code: 'custom', path: [key], message: 'Payment counts must be unique.' })
    }
  })

export type InstallmentRules = z.infer<typeof installmentRulesSchema>
export type InstallmentRulesRecord = InstallmentRules & {
  id: string
  version: number
  createdAt: string
  createdByUserId?: string
}

export const installmentRulesSaveRequestSchema = installmentRulesSchema
export type InstallmentRulesSaveRequest = z.infer<typeof installmentRulesSaveRequestSchema>
export const installmentRulesIpcChannels = {
  getActive: 'installment-rules:get-active',
  list: 'installment-rules:list',
  save: 'installment-rules:save'
} as const

export type InstallmentRulesApi = {
  installmentRules: {
    getActive(): Promise<InstallmentRulesRecord>
    list(): Promise<InstallmentRulesRecord[]>
    save(input: InstallmentRulesSaveRequest): Promise<InstallmentRulesRecord>
  }
}
