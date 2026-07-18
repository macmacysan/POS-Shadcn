import { format } from 'date-fns'

export type InstallmentHistoryAction = 'new' | 'edited' | 'deleted'
export type InstallmentHistorySource = 'in-house' | 'home-credit'

type HistoryBase = {
  id: string
  occurredAt: string
  action: InstallmentHistoryAction
  source: InstallmentHistorySource
  accountId: string
  accountName: string
  reference?: string
  activity: string
  amount?: number
  balance?: number
  performedBy?: string
}

export type HistoryFieldChange = {
  field: string
  previousValue: string
  newValue: string
}

export type PaymentDetails = {
  scheduleNumber?: number
  dueDate?: string
  datePaid?: string
  referenceNumber?: string
  paymentMethod?: string
  lateFee?: number
  amountPaid?: number
  previousBalance?: number
  newBalance?: number
  notes?: string
}

export type InstallmentSnapshot = {
  accountDetails: string
  loanDetails?: string
  terms?: string
  frequency?: string
  startDate?: string
  endDate?: string
  items?: Array<{ name: string; quantity: number; price: number }>
  downpayment?: number
  grandTotal?: number
  initialBalance?: number
  deletedBy?: string
  deletionAt?: string
  deletionReason?: string
}

export type InstallmentHistoryDetails =
  | { kind: 'new'; snapshot: InstallmentSnapshot; payment?: PaymentDetails }
  | { kind: 'edited'; changes: HistoryFieldChange[]; payment?: PaymentDetails }
  | { kind: 'deleted'; snapshot: InstallmentSnapshot; payment?: PaymentDetails }

export type InstallmentHistoryRecord = HistoryBase & {
  details: InstallmentHistoryDetails
}

export const actionLabels: Record<InstallmentHistoryAction, string> = {
  new: 'New',
  edited: 'Edited',
  deleted: 'Deleted'
}

export const sourceLabels: Record<InstallmentHistorySource, string> = {
  'in-house': 'In-house',
  'home-credit': 'Home Credit'
}

export function formatHistoryDateTime(value: string): string {
  return format(new Date(value), 'MMM d, yyyy h:mm a')
}

export function formatHistoryDate(value: string | undefined): string {
  return value ? format(new Date(value), 'MMM d, yyyy') : '—'
}

export function formatHistoryMoney(value: number | undefined): string {
  return value === undefined
    ? '—'
    : `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export const installmentHistoryData: InstallmentHistoryRecord[] = [
  {
    id: 'history-1',
    occurredAt: '2026-07-14T10:42:00+08:00',
    action: 'new',
    source: 'in-house',
    accountId: 'IH-2026-0041',
    accountName: 'Maria Clara Villanueva Santos',
    reference: 'IH-2026-0041',
    activity: 'New installment account created',
    amount: 85000,
    balance: 75000,
    performedBy: 'C. Dela Cruz',
    details: {
      kind: 'new',
      snapshot: {
        accountDetails: 'Maria Clara Villanueva Santos · IH-2026-0041',
        loanDetails: 'In-house installment account',
        terms: '12 months',
        frequency: 'Monthly',
        startDate: '2026-07-14',
        endDate: '2027-07-14',
        items: [
          { name: 'Dining table set', quantity: 1, price: 45000 },
          { name: 'Six-piece dining chair set', quantity: 1, price: 40000 }
        ],
        downpayment: 10000,
        grandTotal: 85000,
        initialBalance: 75000
      }
    }
  },
  {
    id: 'history-2',
    occurredAt: '2026-07-14T09:18:00+08:00',
    action: 'new',
    source: 'home-credit',
    accountId: 'HC-983104',
    accountName: 'Luis Miguel Cruz',
    reference: 'HC-983104',
    activity: 'Payment added for Schedule #5',
    amount: 3200,
    balance: 12800,
    performedBy: 'A. Reyes',
    details: {
      kind: 'new',
      snapshot: { accountDetails: 'Luis Miguel Cruz · HC-983104' },
      payment: {
        scheduleNumber: 5,
        dueDate: '2026-07-14',
        datePaid: '2026-07-14',
        referenceNumber: 'OR-1005',
        paymentMethod: 'GCash',
        amountPaid: 3200,
        previousBalance: 16000,
        newBalance: 12800,
        notes: 'Paid on due date'
      }
    }
  },
  {
    id: 'history-3',
    occurredAt: '2026-07-13T16:05:00+08:00',
    action: 'edited',
    source: 'in-house',
    accountId: 'IH-2026-0037',
    accountName: 'Ana Sofia Santos',
    reference: 'IH-2026-0037',
    activity: 'Loan terms updated',
    balance: 42500,
    performedBy: 'M. Garcia',
    details: {
      kind: 'edited',
      changes: [
        { field: 'Frequency', previousValue: 'Monthly', newValue: 'Bi-weekly' },
        { field: 'End date', previousValue: '2027-06-13', newValue: '2027-01-13' }
      ]
    }
  },
  {
    id: 'history-4',
    occurredAt: '2026-07-13T14:31:00+08:00',
    action: 'edited',
    source: 'home-credit',
    accountId: 'HC-982771',
    accountName: 'Jose Rizal Mercado',
    reference: 'HC-982771',
    activity: 'Payment record edited',
    amount: 2500,
    balance: 9700,
    performedBy: 'C. Dela Cruz',
    details: {
      kind: 'edited',
      changes: [{ field: 'Payment method', previousValue: 'Cash', newValue: 'Bank Transfer' }],
      payment: {
        scheduleNumber: 3,
        dueDate: '2026-07-12',
        datePaid: '2026-07-13',
        referenceNumber: 'BT-1123',
        paymentMethod: 'Bank Transfer',
        lateFee: 150,
        amountPaid: 2500,
        previousBalance: 12200,
        newBalance: 9700
      }
    }
  },
  {
    id: 'history-5',
    occurredAt: '2026-07-12T11:10:00+08:00',
    action: 'deleted',
    source: 'in-house',
    accountId: 'IH-2026-0029',
    accountName: 'Beatriz de los Santos',
    reference: 'IH-2026-0029',
    activity: 'Payment record deleted',
    amount: 1800,
    performedBy: 'M. Garcia',
    details: {
      kind: 'deleted',
      snapshot: {
        accountDetails: 'Beatriz de los Santos · IH-2026-0029',
        loanDetails: 'In-house installment account',
        terms: '12 months',
        frequency: 'Monthly',
        items: [{ name: 'Bedroom cabinet', quantity: 1, price: 54000 }],
        grandTotal: 54000,
        initialBalance: 21600,
        deletedBy: 'M. Garcia',
        deletionAt: '2026-07-12T11:10:00+08:00',
        deletionReason: 'Duplicate payment entry'
      },
      payment: {
        scheduleNumber: 8,
        dueDate: '2026-07-12',
        datePaid: '2026-07-12',
        referenceNumber: 'OR-0981',
        paymentMethod: 'Cash',
        amountPaid: 1800,
        previousBalance: 23400,
        newBalance: 21600
      }
    }
  }
]
