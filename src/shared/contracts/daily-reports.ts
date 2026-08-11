import { z } from 'zod'

// Existing production and development records use opaque TEXT identifiers. New writes use
// UUIDs, but the transition boundary must continue to resolve legacy identifiers safely.
const uuidSchema = z.string().trim().min(1).max(100)
const businessDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const calendarMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)
const isoTimestampSchema = z.string().datetime()
const centavosSchema = z.number().int().safe()
const positiveCentavosSchema = centavosSchema.positive()
const optionalTextSchema = z.string().trim().max(500).nullable()

export const dailyReportStatusValues = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REOPENED',
  'VOIDED'
] as const
export const postedVoidStatusValues = ['POSTED', 'VOIDED'] as const
export const incomeSummaryGroupValues = ['COLLECTION', 'OTHER_INCOME', 'FINANCE'] as const

export const dailyReportStatusSchema = z.enum(dailyReportStatusValues)
export const postedVoidStatusSchema = z.enum(postedVoidStatusValues)
export const incomeSummaryGroupSchema = z.enum(incomeSummaryGroupValues)

export const dailyReportResolveActiveRequestSchema = z.object({
  branchId: uuidSchema,
  cashierUserId: uuidSchema,
  businessDate: businessDateSchema,
  openingCashCentavos: centavosSchema.nonnegative().optional()
})

export const dailyReportCalendarRequestSchema = z.object({
  branchId: uuidSchema,
  cashierUserId: uuidSchema,
  month: calendarMonthSchema
})

export const dailyReportRecordSchema = z.object({
  id: uuidSchema,
  branchId: uuidSchema,
  cashierUserId: uuidSchema,
  businessDate: businessDateSchema,
  openingCashCentavos: centavosSchema.nonnegative(),
  cashRemittedCentavos: centavosSchema.nonnegative().nullable(),
  status: dailyReportStatusSchema,
  submittedAt: isoTimestampSchema.nullable(),
  approvedAt: isoTimestampSchema.nullable(),
  approvedByUserId: uuidSchema.nullable(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema
})
export const dailyReportResolveActiveResponseSchema = dailyReportRecordSchema
export const dailyReportCalendarDaySchema = z.object({
  businessDate: businessDateSchema,
  status: dailyReportStatusSchema,
  cashVarianceCentavos: centavosSchema,
  noteCount: z.number().int().nonnegative()
})
export const dailyReportCalendarResponseSchema = z.object({
  rows: z.array(dailyReportCalendarDaySchema)
})

export const incomeCategoryRecordSchema = z.object({
  id: uuidSchema,
  code: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(200),
  summaryGroup: incomeSummaryGroupSchema,
  isSystem: z.boolean(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema
})

export const incomeEntryRecordSchema = z.object({
  id: uuidSchema,
  dailyReportId: uuidSchema,
  branch: z.string().trim().min(1).max(100),
  categoryId: uuidSchema,
  transactionDate: businessDateSchema,
  particular: z.string().trim().min(1).max(500),
  receiptNumber: optionalTextSchema,
  remarks: optionalTextSchema,
  amountCentavos: positiveCentavosSchema,
  status: postedVoidStatusSchema,
  voidedAt: isoTimestampSchema.nullable(),
  voidedByUserId: uuidSchema.nullable(),
  voidReason: optionalTextSchema,
  createdByUserId: uuidSchema,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema
})
export const incomeListRequestSchema = z.object({
  dailyReportId: uuidSchema.optional(),
  branch: z.string().trim().max(100).optional(),
  dateFrom: businessDateSchema.optional(),
  dateTo: businessDateSchema.optional(),
  status: postedVoidStatusSchema.optional()
})
export const incomeListResponseSchema = z.object({ rows: z.array(incomeEntryRecordSchema) })
export const incomeCreateRequestSchema = z.object({
  dailyReportId: uuidSchema,
  categoryId: uuidSchema,
  transactionDate: businessDateSchema,
  particular: z.string().trim().min(1).max(500),
  receiptNumber: z.string().trim().max(100).nullable().optional(),
  remarks: z.string().trim().max(500).nullable().optional(),
  amountCentavos: positiveCentavosSchema
})
export const incomeCreateResponseSchema = incomeEntryRecordSchema
export const incomeUpdateRequestSchema = incomeCreateRequestSchema
  .omit({ dailyReportId: true })
  .extend({ id: uuidSchema })
export const incomeUpdateResponseSchema = incomeEntryRecordSchema
export const incomeVoidRequestSchema = z.object({
  id: uuidSchema,
  voidReason: z.string().trim().min(1).max(1000)
})
export const incomeVoidResponseSchema = incomeEntryRecordSchema

export const reportPaymentMethodRecordSchema = z.object({
  id: uuidSchema,
  code: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(200),
  isActive: z.boolean(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema
})
export const dailyReportPaymentEntryRecordSchema = z.object({
  id: uuidSchema,
  dailyReportId: uuidSchema,
  branch: z.string().trim().min(1).max(100),
  paymentMethodId: uuidSchema,
  paymentMethodName: z.string().trim().min(1).max(200),
  transactionDate: businessDateSchema,
  amountCentavos: positiveCentavosSchema,
  referenceNumber: z.string().trim().max(100).nullable(),
  bankName: z.string().trim().max(200).nullable(),
  payerName: z.string().trim().max(200).nullable(),
  remarks: optionalTextSchema,
  status: postedVoidStatusSchema,
  voidedAt: isoTimestampSchema.nullable(),
  voidedByUserId: uuidSchema.nullable(),
  voidReason: optionalTextSchema,
  createdByUserId: uuidSchema,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema
})
export const dailyReportPaymentListRequestSchema = z.object({
  dailyReportId: uuidSchema.optional(),
  branch: z.string().trim().max(100).optional(),
  dateFrom: businessDateSchema.optional(),
  dateTo: businessDateSchema.optional(),
  status: postedVoidStatusSchema.optional()
})
export const dailyReportPaymentListResponseSchema = z.object({
  rows: z.array(dailyReportPaymentEntryRecordSchema)
})
export const dailyReportPaymentCreateRequestSchema = z.object({
  dailyReportId: uuidSchema,
  paymentMethodId: uuidSchema,
  transactionDate: businessDateSchema,
  amountCentavos: positiveCentavosSchema,
  referenceNumber: z.string().trim().max(100).nullable().optional(),
  bankName: z.string().trim().max(200).nullable().optional(),
  payerName: z.string().trim().max(200).nullable().optional(),
  remarks: z.string().trim().max(500).nullable().optional()
})
export const dailyReportPaymentCreateResponseSchema = dailyReportPaymentEntryRecordSchema
export const dailyReportPaymentUpdateRequestSchema = dailyReportPaymentCreateRequestSchema
  .omit({ dailyReportId: true })
  .extend({ id: uuidSchema })
export const dailyReportPaymentUpdateResponseSchema = dailyReportPaymentEntryRecordSchema
export const dailyReportPaymentVoidRequestSchema = z.object({
  id: uuidSchema,
  voidReason: z.string().trim().min(1).max(1000)
})
export const dailyReportPaymentVoidResponseSchema = dailyReportPaymentEntryRecordSchema

export const dailyReceiptTotalRecordSchema = z.object({
  id: uuidSchema,
  dailyReportId: uuidSchema,
  receiptTypeId: uuidSchema,
  receiptName: z.string().trim().min(1).max(200),
  receiptShortName: z.string().trim().min(1).max(7),
  quantity: z.number().int().nonnegative(),
  amountCentavos: centavosSchema.nonnegative(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema
})
export const cashOutEntryRecordSchema = z.object({
  id: uuidSchema,
  dailyReportId: uuidSchema,
  transactionDate: businessDateSchema,
  description: z.string().trim().min(1).max(500),
  amountCentavos: positiveCentavosSchema,
  status: postedVoidStatusSchema,
  voidedAt: isoTimestampSchema.nullable(),
  voidedByUserId: uuidSchema.nullable(),
  voidReason: optionalTextSchema,
  createdByUserId: uuidSchema,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema
})
export const dailyReportDeductionRecordSchema = z.object({
  id: uuidSchema,
  dailyReportId: uuidSchema,
  deductionTypeId: uuidSchema,
  amountCentavos: centavosSchema.nonnegative(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema
})
export const dailyReportCashCountRecordSchema = z.object({
  id: uuidSchema,
  dailyReportId: uuidSchema,
  denominationId: uuidSchema,
  quantity: z.number().int().nonnegative(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema
})
export const dailyReportReferenceRecordSchema = z.object({
  id: uuidSchema,
  name: z.string().trim().min(1).max(200),
  sortOrder: z.number().int()
})
export const dailyReportReceiptTypeRecordSchema = dailyReportReferenceRecordSchema.extend({
  shortName: z.string().trim().min(1).max(7),
  isDefaultVisible: z.boolean(),
  isSystem: z.boolean(),
  isActive: z.boolean()
})
export const dailyReportReceiptTypeCreateRequestSchema = z.object({
  name: z.string().trim().min(1).max(200),
  shortName: z.string().trim().min(1).max(7)
})
export const dailyReportReceiptTypeDeleteRequestSchema = z.object({ id: uuidSchema })
export const dailyReportReceiptTypeDeleteResponseSchema = z.object({ id: uuidSchema })
export const dailyReportReceiptTypeListResponseSchema = z.object({
  rows: z.array(dailyReportReceiptTypeRecordSchema)
})
export const dailyReportReceiptTypeRestoreRequestSchema = z.object({ id: uuidSchema })
export const dailyReportReceiptTypeRestoreResponseSchema = dailyReportReceiptTypeRecordSchema
export const cashDenominationRecordSchema = z.object({
  id: uuidSchema,
  valueCentavos: positiveCentavosSchema,
  sortOrder: z.number().int()
})

export const dailyReportSnapshotRequestSchema = z.object({ dailyReportId: uuidSchema })
export const dailyReportSnapshotResponseSchema = z.object({
  report: dailyReportRecordSchema,
  receiptTotals: z.array(dailyReceiptTotalRecordSchema),
  incomeEntries: z.array(incomeEntryRecordSchema),
  paymentEntries: z.array(dailyReportPaymentEntryRecordSchema),
  cashOutEntries: z.array(cashOutEntryRecordSchema),
  deductions: z.array(dailyReportDeductionRecordSchema),
  cashCounts: z.array(dailyReportCashCountRecordSchema),
  receiptTypes: z.array(dailyReportReceiptTypeRecordSchema),
  deductionTypes: z.array(dailyReportReferenceRecordSchema),
  cashDenominations: z.array(cashDenominationRecordSchema),
  legacyExpenseCashOutCentavos: centavosSchema.nonnegative(),
  cashCollectionsCentavos: centavosSchema.nonnegative(),
  otherIncomeCentavos: centavosSchema.nonnegative(),
  financeDownCentavos: centavosSchema.nonnegative(),
  financeBalanceCentavos: centavosSchema.nonnegative(),
  expectedCashCentavos: centavosSchema,
  physicalCashCentavos: centavosSchema.nonnegative(),
  cashVarianceCentavos: centavosSchema
})
export const dailyReportSummaryUpdateRequestSchema = z.object({
  dailyReportId: uuidSchema,
  openingCashCentavos: centavosSchema.nonnegative(),
  cashRemittedCentavos: centavosSchema.nonnegative().nullable(),
  receiptTotals: z.array(
    dailyReceiptTotalRecordSchema.pick({
      receiptTypeId: true,
      quantity: true,
      amountCentavos: true
    })
  ),
  deductions: z.array(
    dailyReportDeductionRecordSchema.pick({ deductionTypeId: true, amountCentavos: true })
  ),
  cashCounts: z.array(
    dailyReportCashCountRecordSchema.pick({ denominationId: true, quantity: true })
  )
})
export const dailyReportSummaryUpdateResponseSchema = dailyReportSnapshotResponseSchema

export type DailyReportStatus = z.infer<typeof dailyReportStatusSchema>
export type PostedVoidStatus = z.infer<typeof postedVoidStatusSchema>
export type IncomeSummaryGroup = z.infer<typeof incomeSummaryGroupSchema>
export type DailyReportResolveActiveRequest = z.infer<typeof dailyReportResolveActiveRequestSchema>
export type DailyReportRecord = z.infer<typeof dailyReportRecordSchema>
export type DailyReportResolveActiveResponse = z.infer<
  typeof dailyReportResolveActiveResponseSchema
>
export type DailyReportCalendarRequest = z.infer<typeof dailyReportCalendarRequestSchema>
export type DailyReportCalendarDay = z.infer<typeof dailyReportCalendarDaySchema>
export type DailyReportCalendarResponse = z.infer<typeof dailyReportCalendarResponseSchema>
export type IncomeCategoryRecord = z.infer<typeof incomeCategoryRecordSchema>
export type IncomeEntryRecord = z.infer<typeof incomeEntryRecordSchema>
export type IncomeListRequest = z.infer<typeof incomeListRequestSchema>
export type IncomeListResponse = z.infer<typeof incomeListResponseSchema>
export type IncomeCreateRequest = z.infer<typeof incomeCreateRequestSchema>
export type IncomeCreateResponse = z.infer<typeof incomeCreateResponseSchema>
export type IncomeUpdateRequest = z.infer<typeof incomeUpdateRequestSchema>
export type IncomeUpdateResponse = z.infer<typeof incomeUpdateResponseSchema>
export type IncomeVoidRequest = z.infer<typeof incomeVoidRequestSchema>
export type IncomeVoidResponse = z.infer<typeof incomeVoidResponseSchema>
export type ReportPaymentMethodRecord = z.infer<typeof reportPaymentMethodRecordSchema>
export type DailyReportPaymentEntryRecord = z.infer<typeof dailyReportPaymentEntryRecordSchema>
export type DailyReportPaymentListRequest = z.infer<typeof dailyReportPaymentListRequestSchema>
export type DailyReportPaymentListResponse = z.infer<typeof dailyReportPaymentListResponseSchema>
export type DailyReportPaymentCreateRequest = z.infer<typeof dailyReportPaymentCreateRequestSchema>
export type DailyReportPaymentCreateResponse = z.infer<
  typeof dailyReportPaymentCreateResponseSchema
>
export type DailyReportPaymentUpdateRequest = z.infer<typeof dailyReportPaymentUpdateRequestSchema>
export type DailyReportPaymentUpdateResponse = z.infer<
  typeof dailyReportPaymentUpdateResponseSchema
>
export type DailyReportPaymentVoidRequest = z.infer<typeof dailyReportPaymentVoidRequestSchema>
export type DailyReportPaymentVoidResponse = z.infer<typeof dailyReportPaymentVoidResponseSchema>
export type DailyReceiptTotalRecord = z.infer<typeof dailyReceiptTotalRecordSchema>
export type CashOutEntryRecord = z.infer<typeof cashOutEntryRecordSchema>
export type DailyReportDeductionRecord = z.infer<typeof dailyReportDeductionRecordSchema>
export type DailyReportReceiptTypeRecord = z.infer<typeof dailyReportReceiptTypeRecordSchema>
export type DailyReportReceiptTypeCreateRequest = z.infer<
  typeof dailyReportReceiptTypeCreateRequestSchema
>
export type DailyReportReceiptTypeDeleteRequest = z.infer<
  typeof dailyReportReceiptTypeDeleteRequestSchema
>
export type DailyReportReceiptTypeDeleteResponse = z.infer<
  typeof dailyReportReceiptTypeDeleteResponseSchema
>
export type DailyReportReceiptTypeListResponse = z.infer<
  typeof dailyReportReceiptTypeListResponseSchema
>
export type DailyReportReceiptTypeRestoreRequest = z.infer<
  typeof dailyReportReceiptTypeRestoreRequestSchema
>
export type DailyReportReceiptTypeRestoreResponse = z.infer<
  typeof dailyReportReceiptTypeRestoreResponseSchema
>
export type DailyReportCashCountRecord = z.infer<typeof dailyReportCashCountRecordSchema>
export type DailyReportSnapshotRequest = z.infer<typeof dailyReportSnapshotRequestSchema>
export type DailyReportSnapshotResponse = z.infer<typeof dailyReportSnapshotResponseSchema>
export type DailyReportSummaryUpdateRequest = z.infer<typeof dailyReportSummaryUpdateRequestSchema>
export type DailyReportSummaryUpdateResponse = z.infer<
  typeof dailyReportSummaryUpdateResponseSchema
>

export const dailyReportIpcChannels = {
  resolveActive: 'daily-reports:resolve-active',
  listCalendar: 'daily-reports:calendar:list',
  getSnapshot: 'daily-reports:get-snapshot',
  updateSummary: 'daily-reports:summary:update',
  listIncome: 'daily-reports:income:list',
  createIncome: 'daily-reports:income:create',
  updateIncome: 'daily-reports:income:update',
  voidIncome: 'daily-reports:income:void',
  listPayments: 'daily-reports:payments:list',
  createPayment: 'daily-reports:payments:create',
  updatePayment: 'daily-reports:payments:update',
  voidPayment: 'daily-reports:payments:void',
  createReceiptType: 'daily-reports:receipt-types:create',
  deleteReceiptType: 'daily-reports:receipt-types:delete',
  listReceiptTypes: 'daily-reports:receipt-types:list',
  restoreReceiptType: 'daily-reports:receipt-types:restore'
} as const

export type DailyReportsApi = {
  dailyReports: {
    resolveActive(
      request: DailyReportResolveActiveRequest
    ): Promise<DailyReportResolveActiveResponse>
    listCalendar(request: DailyReportCalendarRequest): Promise<DailyReportCalendarResponse>
    getSnapshot(request: DailyReportSnapshotRequest): Promise<DailyReportSnapshotResponse>
    updateSummary(
      request: DailyReportSummaryUpdateRequest
    ): Promise<DailyReportSummaryUpdateResponse>
    listIncome(request: IncomeListRequest): Promise<IncomeListResponse>
    createIncome(request: IncomeCreateRequest): Promise<IncomeCreateResponse>
    updateIncome(request: IncomeUpdateRequest): Promise<IncomeUpdateResponse>
    voidIncome(request: IncomeVoidRequest): Promise<IncomeVoidResponse>
    listPayments(request: DailyReportPaymentListRequest): Promise<DailyReportPaymentListResponse>
    createPayment(
      request: DailyReportPaymentCreateRequest
    ): Promise<DailyReportPaymentCreateResponse>
    updatePayment(
      request: DailyReportPaymentUpdateRequest
    ): Promise<DailyReportPaymentUpdateResponse>
    voidPayment(request: DailyReportPaymentVoidRequest): Promise<DailyReportPaymentVoidResponse>
    createReceiptType(
      request: DailyReportReceiptTypeCreateRequest
    ): Promise<DailyReportReceiptTypeRecord>
    deleteReceiptType(
      request: DailyReportReceiptTypeDeleteRequest
    ): Promise<DailyReportReceiptTypeDeleteResponse>
    listReceiptTypes(): Promise<DailyReportReceiptTypeListResponse>
    restoreReceiptType(
      request: DailyReportReceiptTypeRestoreRequest
    ): Promise<DailyReportReceiptTypeRestoreResponse>
  }
}
