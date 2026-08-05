import { z } from 'zod'
import type { ReportsApi } from './reports'

export const developmentReportId = '00000000-0000-4000-8000-000000000001'

export const expenseTypeValues = [
  'Company Expenses',
  'Drawings',
  'Purchases',
  'Receivables',
  'Operating',
  'Supply',
  'Transport'
] as const

export const expenseCategoryValues = [
  'Advertising',
  'Education and training expenses for employees',
  'Licenses and Permits',
  'Bank Fees',
  'Employee Benefit Programs',
  'Office Expenses and Supplies',
  'Business Meals',
  'Food Allowance',
  'Printing',
  'Charitable Contributions',
  'Freight, Postage and Shipping',
  'Rent',
  'Credit and Collection Fees',
  'Insurance',
  'Salaries and Compensation',
  'Dues and Subscriptions',
  'Legal and professional expenses',
  'Telephone/Communication Expense',
  'Transporation Allowance',
  'Utilities',
  'Vehicle Maintenance and Repairs',
  'Others'
] as const

export const expenseVatValues = ['VAT', 'Non-VAT', ''] as const
export const expensePageSizes = [15, 25, 50, 100] as const

const expenseTypeSchema = z.enum(expenseTypeValues)
const expenseCategorySchema = z.enum(expenseCategoryValues)
const expenseVatSchema = z.enum(expenseVatValues)
const uuidSchema = z.string().uuid()
const expenseIdSchemaValue = z.string().trim().min(1).max(100)
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const expenseSortFieldSchema = z.enum([
  'type',
  'description',
  'category',
  'receiptNo',
  'vat',
  'amountCentavos',
  'createdAt'
])

export const expenseListRequestSchema = z.object({
  reportId: uuidSchema.optional(),
  branch: z.string().trim().max(100).optional(),
  dateFrom: dateSchema.optional(),
  dateTo: dateSchema.optional(),
  pageIndex: z.number().int().min(0),
  pageSize: z.union(
    expensePageSizes.map((size) => z.literal(size)) as [
      z.ZodLiteral<number>,
      ...z.ZodLiteral<number>[]
    ]
  ),
  search: z.string().trim().max(200).default(''),
  sorting: z
    .array(
      z.object({
        field: expenseSortFieldSchema,
        direction: z.enum(['asc', 'desc'])
      })
    )
    .max(1)
    .default([]),
  filters: z
    .object({
      branch: z.string().trim().max(100).optional(),
      type: expenseTypeSchema.optional(),
      category: expenseCategorySchema.optional(),
      vat: expenseVatSchema.optional()
    })
    .default({})
})

export const expenseCreateInputSchema = z.object({
  reportId: uuidSchema,
  type: expenseTypeSchema,
  description: z.string().trim().min(1).max(500),
  category: expenseCategorySchema,
  receiptNo: z.string().trim().max(100),
  vat: expenseVatSchema,
  amountCentavos: z.number().int().nonnegative()
})

export const expenseUpdateInputSchema = expenseCreateInputSchema
  .omit({ reportId: true })
  .extend({ id: uuidSchema })

export const expenseIdSchema = z.object({ id: expenseIdSchemaValue })
export const expenseRemoveInputSchema = z.object({ ids: z.array(expenseIdSchemaValue).min(1) })
export const expenseSummaryTotalsRequestSchema = z.object({ reportId: uuidSchema })

export type ExpenseType = z.infer<typeof expenseTypeSchema>
export type ExpenseCategory = z.infer<typeof expenseCategorySchema>
export type ExpenseVat = z.infer<typeof expenseVatSchema>
export type ExpenseSortField = z.infer<typeof expenseSortFieldSchema>
export type ExpenseListRequest = z.infer<typeof expenseListRequestSchema>
export type ExpenseCreateInput = z.infer<typeof expenseCreateInputSchema>
export type ExpenseUpdateInput = z.infer<typeof expenseUpdateInputSchema>

export type ExpenseRecord = {
  id: string
  reportId: string
  branch: string
  type: ExpenseType
  description: string
  category: ExpenseCategory
  receiptNo: string
  vat: ExpenseVat
  amountCentavos: number
  createdAt: string
  updatedAt: string
}

export type ExpensePageResult = {
  rows: ExpenseRecord[]
  totalRows: number
}

export type ExpenseSummaryTotals = {
  companyExpensesCentavos: number
  drawingsCentavos: number
  purchasesCentavos: number
  receivablesCentavos: number
}

export type IpcErrorPayload = {
  code: 'VALIDATION_ERROR' | 'NOT_FOUND' | 'CONFLICT' | 'FORBIDDEN' | 'DATABASE_ERROR'
  message: string
}

export const expenseIpcChannels = {
  list: 'reports:expenses:list',
  getById: 'reports:expenses:get-by-id',
  create: 'reports:expenses:create',
  update: 'reports:expenses:update',
  remove: 'reports:expenses:remove',
  summaryTotals: 'reports:expenses:summary-totals'
} as const

export type ExpensesApi = ReportsApi & {
  reports: {
    expenses: {
      list(request: ExpenseListRequest): Promise<ExpensePageResult>
      getById(id: string): Promise<ExpenseRecord | null>
      create(input: ExpenseCreateInput): Promise<ExpenseRecord>
      update(input: ExpenseUpdateInput): Promise<ExpenseRecord>
      remove(input: { ids: string[] }): Promise<void>
      summaryTotals(reportId: string): Promise<ExpenseSummaryTotals>
    }
  }
}

export function parseAmountToCentavos(value: string): number {
  const normalized = value.trim()
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new Error('Amount must be a non-negative number with up to two decimal places.')
  }

  const [whole, fraction = ''] = normalized.split('.')
  const centavos = Number(`${whole}${fraction.padEnd(2, '0')}`)
  if (!Number.isSafeInteger(centavos)) throw new Error('Amount is too large.')
  return centavos
}

export function amountFromCentavos(amountCentavos: number): number {
  return amountCentavos / 100
}
