import { differenceInCalendarDays, parseISO, startOfToday } from 'date-fns'

import {
  installmentHistoryData,
  type InstallmentHistoryRecord,
  type InstallmentSnapshot,
  type PaymentDetails
} from '@/lib/installment-history'

export type AccountMonitoringStatus =
  | 'active'
  | 'due-today'
  | 'due-soon'
  | 'delayed'
  | 'overdue'
  | 'closed'
  | 'blacklisted'
  | 'fully-paid'

export type AccountMonitoringMeta = {
  readonly status: AccountMonitoringStatus
  readonly nextDue?: string
  readonly outstandingBalance?: number
  readonly paymentFrequency?: string
  readonly lastPayment?: string
  readonly delayedDays?: number
  readonly terms?: string
  readonly installmentAmount?: number
  readonly missedPayments?: number
  readonly dateReleased?: string
  readonly startDate?: string
  readonly endDate?: string
  readonly requiredFee?: number
  readonly grandTotal?: number
  readonly principal?: number
  readonly interest?: number
  readonly totalInterest?: number
  readonly downPayment?: number
  readonly totalPaid?: number
}

export type AccountHistoryIndex = ReadonlyMap<string, readonly InstallmentHistoryRecord[]>

function getPayment(record: InstallmentHistoryRecord): PaymentDetails | undefined {
  return record.details.payment
}

function getSnapshot(record: InstallmentHistoryRecord): InstallmentSnapshot | undefined {
  return record.details.kind === 'new' || record.details.kind === 'deleted'
    ? record.details.snapshot
    : undefined
}

function latestChange(
  records: readonly InstallmentHistoryRecord[],
  field: string
): string | undefined {
  return records
    .filter((record) => record.details.kind === 'edited')
    .flatMap((record) => (record.details.kind === 'edited' ? record.details.changes : []))
    .find((change) => change.field.toLowerCase() === field.toLowerCase())?.newValue
}

export function createAccountHistoryIndex(
  records: readonly InstallmentHistoryRecord[] = installmentHistoryData
): AccountHistoryIndex {
  const index = new Map<string, InstallmentHistoryRecord[]>()

  records.forEach((record) => {
    const accountRecords = index.get(record.accountId) ?? []
    accountRecords.push(record)
    index.set(record.accountId, accountRecords)
  })

  index.forEach((accountRecords) =>
    accountRecords.sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
  )

  return index
}

export function buildAccountMonitoringMeta(
  accountId: string,
  historyIndex: AccountHistoryIndex
): AccountMonitoringMeta {
  const records = historyIndex.get(accountId) ?? []
  const snapshots = records
    .map(getSnapshot)
    .filter((value): value is InstallmentSnapshot => !!value)
  const latestBalance = records
    .map((record) => getPayment(record)?.newBalance ?? record.balance)
    .find((balance): balance is number => typeof balance === 'number')
  const paymentFrequency =
    latestChange(records, 'Frequency') ??
    snapshots.map((snapshot) => snapshot.frequency).find((value): value is string => !!value)
  const terms =
    latestChange(records, 'Terms') ??
    snapshots.map((snapshot) => snapshot.terms).find((value): value is string => !!value)
  const lastPayment = records
    .filter((record) => record.action !== 'deleted')
    .map((record) => {
      const payment = getPayment(record)
      return payment?.datePaid ?? (payment ? record.occurredAt : undefined)
    })
    .find((value): value is string => !!value)
  const nextDue = records
    .filter((record) => record.action !== 'deleted')
    .map((record) => getPayment(record)?.dueDate)
    .filter((value): value is string => !!value)
    .sort()[0]
  const snapshotValue = <K extends keyof InstallmentSnapshot>(
    key: K
  ): InstallmentSnapshot[K] | undefined =>
    snapshots.map((snapshot) => snapshot[key]).find((value) => value !== undefined)
  const baseMeta = {
    outstandingBalance: latestBalance,
    paymentFrequency,
    terms,
    lastPayment,
    nextDue,
    startDate: snapshotValue('startDate'),
    endDate: snapshotValue('endDate'),
    grandTotal: snapshotValue('grandTotal'),
    downPayment: snapshotValue('downpayment')
  }

  if (latestBalance === 0) return { ...baseMeta, status: 'fully-paid' }
  if (!nextDue) return { ...baseMeta, status: 'active' }

  const days = differenceInCalendarDays(parseISO(nextDue), startOfToday())
  const status: AccountMonitoringStatus =
    days < 0 ? 'overdue' : days === 0 ? 'due-today' : days <= 7 ? 'due-soon' : 'active'

  return {
    ...baseMeta,
    status,
    delayedDays: days < 0 ? Math.abs(days) : undefined
  }
}
