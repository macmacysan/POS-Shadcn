import { z } from 'zod'

export const installmentViewValues = ['records', 'active', 'closed', 'blacklisted'] as const
export const installmentViewSchema = z.enum(installmentViewValues)
export type InstallmentView = z.infer<typeof installmentViewSchema>

export const installmentListRequestSchema = z.object({
  view: installmentViewSchema,
  search: z.string().trim().max(200).default(''),
  branch: z.string().trim().max(100).optional()
})

const jsonObjectSchema = z.record(z.string(), z.unknown())
export const installmentBootstrapRequestSchema = z.object({
  accounts: z.array(jsonObjectSchema).max(10000),
  loans: z.array(jsonObjectSchema).max(10000)
})

export const installmentTransitionRequestSchema = z.object({
  accountId: z.string().trim().min(1).max(100),
  contractId: z.string().trim().min(1).max(100).optional(),
  remarks: z.string().trim().min(1).max(1000),
  actorUserId: z.string().trim().min(1).max(100).default('development-cashier')
})

export const installmentPaymentWorkspaceRequestSchema = z.object({
  accountId: z.string().trim().min(1).max(100)
})

export const installmentCreatePaymentRequestSchema = z.object({
  accountId: z.string().trim().min(1).max(100),
  contractId: z.string().trim().min(1).max(100),
  submissionId: z.string().trim().min(1).max(100),
  scheduleId: z.string().trim().min(1).max(100).optional(),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amountCentavos: z.number().int().positive(),
  referenceNumber: z.string().trim().max(100).optional(),
  actorUserId: z.string().trim().min(1).max(100).default('development-cashier')
})

export const installmentAdjustPaymentRequestSchema = z.object({
  accountId: z.string().trim().min(1).max(100),
  contractId: z.string().trim().min(1).max(100),
  scheduleId: z.string().trim().min(1).max(100),
  submissionId: z.string().trim().min(1).max(100),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amountCentavos: z.number().int().nonnegative(),
  referenceNumber: z.string().trim().max(100).optional(),
  reason: z.string().trim().min(1).max(1000),
  actorUserId: z.string().trim().min(1).max(100).default('development-cashier')
})

export type InstallmentListRequest = z.infer<typeof installmentListRequestSchema>
export type InstallmentBootstrapRequest = z.infer<typeof installmentBootstrapRequestSchema>
export type InstallmentTransitionRequest = z.infer<typeof installmentTransitionRequestSchema>
export type InstallmentPaymentWorkspaceRequest = z.infer<
  typeof installmentPaymentWorkspaceRequestSchema
>
export type InstallmentCreatePaymentRequest = z.infer<typeof installmentCreatePaymentRequestSchema>
export type InstallmentAdjustPaymentRequest = z.infer<typeof installmentAdjustPaymentRequestSchema>

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
    regionPsgc?: { code: string; name: string }
    barangay: string
    barangayPsgc?: { code: string; name: string }
    cityMunicipality: string
    cityMunicipalityPsgc?: { code: string; name: string }
    province: string
    provincePsgc?: { code: string; name: string }
    occupation?: string
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
    paymentFrequency: 'Weekly' | 'Bi-weekly' | 'Monthly'
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
  status: 'DUE' | 'PARTIALLY_PAID' | 'PAID' | 'WAIVED'
  isAdjusted: boolean
}

export type InHousePaymentRecord = {
  id: string
  paymentDate: string
  amountCentavos: number
  allocatedAmountCentavos: number
  referenceNumber?: string
  status: 'POSTED' | 'VOIDED'
  isAdjustment: boolean
  createdAt: string
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
  closeContract: 'installments:close-contract',
  blacklistAccount: 'installments:blacklist-account',
  paymentWorkspace: 'installments:payment-workspace',
  createPayment: 'installments:create-payment',
  adjustPayment: 'installments:adjust-payment'
} as const

export type InstallmentsApi = {
  installments: {
    list(request: InstallmentListRequest): Promise<InstallmentListResult>
    bootstrap(request: InstallmentBootstrapRequest): Promise<void>
    closeContract(request: InstallmentTransitionRequest): Promise<void>
    blacklistAccount(request: InstallmentTransitionRequest): Promise<void>
    getPaymentWorkspace(
      request: InstallmentPaymentWorkspaceRequest
    ): Promise<InstallmentPaymentWorkspace>
    createPayment(request: InstallmentCreatePaymentRequest): Promise<void>
    adjustPayment(request: InstallmentAdjustPaymentRequest): Promise<void>
  }
}
