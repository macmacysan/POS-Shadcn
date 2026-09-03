import { z } from 'zod'

export const installmentViewValues = ['records', 'active', 'closed', 'blacklisted'] as const
export const installmentViewSchema = z.enum(installmentViewValues)
export type InstallmentView = z.infer<typeof installmentViewSchema>

export const installmentListRequestSchema = z.object({
  view: installmentViewSchema,
  search: z.string().trim().max(200).default(''),
  branch: z.string().trim().max(100).optional(),
  includeVoided: z.boolean().default(false)
})

const jsonObjectSchema = z.record(z.string(), z.unknown())
export const installmentBootstrapRequestSchema = z.object({
  accounts: z.array(jsonObjectSchema).max(10000),
  loans: z.array(jsonObjectSchema).max(10000)
})

export const installmentLoanUpdateRequestSchema = z.object({
  accountId: z.string().trim().min(1).max(100),
  contractId: z.string().trim().min(1).max(100),
  dateReleased: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paymentFrequency: z.enum(['Daily', 'Weekly', 'Semi', 'Monthly']),
  terms: z.number().int().positive().max(1000),
  downPaymentCentavos: z.number().int().nonnegative(),
  remarks: z.string().trim().max(1000).optional()
})

export const installmentLoanRestructureRequestSchema = z.object({
  accountId: z.string().trim().min(1).max(100),
  contractId: z.string().trim().min(1).max(100),
  firstDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paymentFrequency: z.enum(['Daily', 'Weekly', 'Semi', 'Monthly']),
  terms: z.number().int().positive().max(1000),
  reason: z.string().trim().min(1).max(1000)
})

export const installmentTransitionRequestSchema = z.object({
  accountId: z.string().trim().min(1).max(100),
  contractId: z.string().trim().min(1).max(100).optional(),
  remarks: z.string().trim().max(1000),
  actorUserId: z.string().trim().min(1).max(100).default('development-cashier')
})

export const installmentRestoreStatusRequestSchema = installmentTransitionRequestSchema.extend({
  status: z.enum(['closed', 'blacklisted'])
})

export const installmentVoidRequestSchema = z.object({
  contractIds: z.array(z.string().trim().min(1).max(100)).min(1).max(100),
  password: z.string().min(1).max(200),
  reason: z.string().trim().min(1).max(1000)
})
export const installmentUnvoidRequestSchema = z.object({
  contractIds: z.array(z.string().trim().min(1).max(100)).min(1).max(100)
})

export const installmentVoidPaymentsRequestSchema = z.object({
  paymentIds: z.array(z.string().trim().min(1).max(100)).min(1).max(100),
  password: z.string().min(1).max(200)
})

export const installmentPaymentWorkspaceRequestSchema = z.object({
  accountId: z.string().trim().min(1).max(100),
  initialPaymentId: z.string().trim().min(1).max(100).optional()
})

export const installmentCreatePaymentRequestSchema = z.object({
  accountId: z.string().trim().min(1).max(100),
  contractId: z.string().trim().min(1).max(100),
  submissionId: z.string().trim().min(1).max(100),
  scheduleId: z.string().trim().min(1).max(100).optional(),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amountCentavos: z.number().int().positive(),
  penaltyCentavos: z.number().int().nonnegative().default(0),
  referenceNumber: z.string().trim().max(100).optional(),
  actorUserId: z.string().trim().min(1).max(100).default('development-cashier')
})

export const installmentAdjustPaymentRequestSchema = z.object({
  accountId: z.string().trim().min(1).max(100),
  contractId: z.string().trim().min(1).max(100),
  paymentId: z.string().trim().min(1).max(100).optional(),
  scheduleId: z.string().trim().min(1).max(100),
  submissionId: z.string().trim().min(1).max(100),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amountCentavos: z.number().int().nonnegative(),
  penaltyCentavos: z.number().int().nonnegative().default(0),
  referenceNumber: z.string().trim().max(100).optional(),
  reason: z.string().trim().min(1).max(1000),
  actorUserId: z.string().trim().min(1).max(100).default('development-cashier')
})

export const installmentHistoryRequestSchema = z.object({
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
})

export type InstallmentListRequest = Omit<
  z.infer<typeof installmentListRequestSchema>,
  'includeVoided'
> & { includeVoided?: boolean }
export type InstallmentBootstrapRequest = z.infer<typeof installmentBootstrapRequestSchema>
export type InstallmentLoanUpdateRequest = z.infer<typeof installmentLoanUpdateRequestSchema>
export type InstallmentLoanRestructureRequest = z.infer<typeof installmentLoanRestructureRequestSchema>
export type InstallmentTransitionRequest = z.infer<typeof installmentTransitionRequestSchema>
export type InstallmentRestoreStatusRequest = z.infer<typeof installmentRestoreStatusRequestSchema>
export type InstallmentVoidRequest = z.infer<typeof installmentVoidRequestSchema>
export type InstallmentUnvoidRequest = z.infer<typeof installmentUnvoidRequestSchema>
export type InstallmentVoidPaymentsRequest = z.infer<typeof installmentVoidPaymentsRequestSchema>
export type InstallmentPaymentWorkspaceRequest = z.infer<
  typeof installmentPaymentWorkspaceRequestSchema
>
export type InstallmentCreatePaymentRequest = z.infer<typeof installmentCreatePaymentRequestSchema>
export type InstallmentAdjustPaymentRequest = z.infer<typeof installmentAdjustPaymentRequestSchema>
export type InstallmentHistoryRequest = z.infer<typeof installmentHistoryRequestSchema>

export type InstallmentAccountStatus = 'ACTIVE' | 'BLACKLISTED'
export type InstallmentContractStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'VOIDED' | 'DEFAULTED'

export type InstallmentAccountRecord = {
  account: {
    id: string
    branch: string
    lastName: string
    firstName: string
    middleName?: string
    suffix?: string
    streetSubdivision?: string
    landmarkRemarks?: string
    latitude?: number
    longitude?: number
    regionPsgc?: { code: string; name: string }
    barangay: string
    barangayPsgc?: { code: string; name: string }
    cityMunicipality: string
    cityMunicipalityPsgc?: { code: string; name: string }
    province: string
    provincePsgc?: { code: string; name: string }
    occupation?: string
    civilStatus?: string
    contacts: Array<{ id: string; kind: 'mobile' | 'telephone'; value: string; isPrimary: boolean }>
    emails: Array<{ id: string; value: string; isPrimary: boolean }>
    agent?: string
    referredBy?: string
    createdAt: string
    updatedAt: string
  }
  loan: {
    id: string
    customerId: string
    dateReleased: string
    startDate: string
    firstDueDate: string
    paymentFrequency: string
    terms: string
    principal: number
    interest: number
    downPayment: number
    fees: number
    installmentAmount: number
    grandTotal: number
    items: Array<{ id: string; name: string; quantity: number; price: number }>
    remarks?: string
    createdAt: string
    updatedAt: string
  }
  accountStatus: InstallmentAccountStatus
  contractStatus: InstallmentContractStatus
  contractId: string
  statusRemarks?: string
  meta: {
    status:
      | 'active'
      | 'due-today'
      | 'due-soon'
      | 'delayed'
      | 'overdue'
      | 'closed'
      | 'blacklisted'
      | 'fully-paid'
    nextDue?: string
    outstandingBalance?: number
    paymentFrequency?: string
    lastPayment?: string
    delayedDays?: number
    terms?: string
    installmentAmount?: number
    missedPayments?: number
    dateReleased?: string
    startDate?: string
    endDate?: string
    requiredFee?: number
    grandTotal?: number
    principal?: number
    interest?: number
    totalInterest?: number
    downPayment?: number
    totalPaid?: number
  }
}

export type InstallmentListResult = { rows: InstallmentAccountRecord[] }

export type InHouseScheduleRecord = {
  id: string
  installmentNumber: number
  dueDate: string
  dueAmountCentavos: number
  paidAmountCentavos: number
  balanceCentavos: number
  penaltyCentavos: number
  status: 'DUE' | 'PARTIALLY_PAID' | 'PAID' | 'WAIVED'
  isAdjusted: boolean
}

export type InHousePaymentRecord = {
  id: string
  paymentDate: string
  amountCentavos: number
  penaltyCentavos: number
  allocatedAmountCentavos: number
  referenceNumber?: string
  status: 'POSTED' | 'VOIDED'
  isAdjustment: boolean
  createdAt: string
  updatedByName?: string
  scheduleIds: string[]
}

export type InstallmentHistoryRecord = {
  id: string
  occurredAt: string
  action: 'new' | 'edited' | 'deleted'
  source: 'in-house' | 'finance'
  activity: string
  amountCentavos?: number
  balanceCentavos?: number
  referenceNumber?: string
  accountId: string
  accountNumber: string
  accountName: string
  branch: string
}

export type InstallmentPaymentWorkspace = {
  account: InstallmentAccountRecord['account']
  accountStatus: InstallmentAccountStatus
  contractId: string
  contractNumber: string
  contractStatus: InstallmentContractStatus
  paymentFrequency: InstallmentAccountRecord['loan']['paymentFrequency']
  installmentAmountCentavos: number
  totalPayableCentavos: number
  totalPaidCentavos: number
  outstandingBalanceCentavos: number
  nextDue?: { dueDate: string; amountCentavos: number; installmentNumber: number }
  schedules: InHouseScheduleRecord[]
  payments: InHousePaymentRecord[]
}

export const installmentIpcChannels = {
  list: 'installments:list',
  bootstrap: 'installments:bootstrap',
  updateLoan: 'installments:update-loan',
  restructureLoan: 'installments:restructure-loan',
  closeContract: 'installments:close-contract',
  blacklistAccount: 'installments:blacklist-account',
  restoreStatus: 'installments:restore-status',
  void: 'installments:void',
  unvoid: 'installments:unvoid',
  voidPayments: 'installments:void-payments',
  paymentWorkspace: 'installments:payment-workspace',
  history: 'installments:history',
  createPayment: 'installments:create-payment',
  adjustPayment: 'installments:adjust-payment'
} as const

export type InstallmentsApi = {
  installments: {
    list(request: InstallmentListRequest): Promise<InstallmentListResult>
    bootstrap(request: InstallmentBootstrapRequest): Promise<void>
    updateLoan(request: InstallmentLoanUpdateRequest): Promise<void>
    restructureLoan(request: InstallmentLoanRestructureRequest): Promise<void>
    closeContract(request: InstallmentTransitionRequest): Promise<void>
    blacklistAccount(request: InstallmentTransitionRequest): Promise<void>
    restoreStatus(request: InstallmentRestoreStatusRequest): Promise<void>
    void(request: InstallmentVoidRequest): Promise<void>
    unvoid(request: InstallmentUnvoidRequest): Promise<void>
    voidPayments(request: InstallmentVoidPaymentsRequest): Promise<void>
    getPaymentWorkspace(
      request: InstallmentPaymentWorkspaceRequest
    ): Promise<InstallmentPaymentWorkspace>
    listHistory(request: InstallmentHistoryRequest): Promise<InstallmentHistoryRecord[]>
    createPayment(request: InstallmentCreatePaymentRequest): Promise<void>
    adjustPayment(request: InstallmentAdjustPaymentRequest): Promise<void>
  }
}
