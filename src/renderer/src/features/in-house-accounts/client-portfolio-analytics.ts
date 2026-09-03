import { differenceInCalendarDays, format, isSameDay, parseISO } from 'date-fns'

import type { InstallmentHistoryRecord } from '../../../../shared/contracts'
import type { PersistedInstallmentRow } from './installment-data'

export type PortfolioCategory =
  'all' | 'overdue' | 'due-today' | 'due-soon' | 'current' | 'paid' | 'closed-blacklisted'

export type ClosedBlacklistedFilter = 'closed' | 'blacklisted' | 'all'

export type PaymentReliability = {
  readonly onTime: number
  readonly late: number
  readonly total: number
  readonly lateRate: number | undefined
}

export type TardinessPoint = {
  readonly label: string
  readonly daysLate: number
}

export type ClientPortfolio = {
  readonly accountId: string
  readonly rows: readonly PersistedInstallmentRow[]
  readonly outstandingBalance: number
  readonly nextDue?: string
  readonly risk: PersistedInstallmentRow['meta']['status']
}

type HistoryWithPaymentDates = InstallmentHistoryRecord & {
  readonly details?: {
    readonly payment?: { readonly dueDate?: string; readonly datePaid?: string }
  }
  readonly dueDate?: string
  readonly datePaid?: string
}

const riskOrder = [
  'blacklisted',
  'overdue',
  'delayed',
  'due-today',
  'due-soon',
  'active',
  'fully-paid',
  'closed'
]

export function paymentDatePair(
  record: InstallmentHistoryRecord
): { dueDate: string; datePaid: string } | undefined {
  const dated = record as HistoryWithPaymentDates
  const dueDate = dated.details?.payment?.dueDate ?? dated.dueDate
  const datePaid = dated.details?.payment?.datePaid ?? dated.datePaid
  return dueDate && datePaid ? { dueDate, datePaid } : undefined
}

export function paymentReliability(
  records: readonly InstallmentHistoryRecord[]
): PaymentReliability {
  const dated = records
    .map(paymentDatePair)
    .filter((value): value is { dueDate: string; datePaid: string } => Boolean(value))
  const late = dated.filter(
    ({ dueDate, datePaid }) => parseISO(datePaid) > parseISO(dueDate)
  ).length
  return {
    onTime: dated.length - late,
    late,
    total: dated.length,
    lateRate: dated.length ? late / dated.length : undefined
  }
}

export function tardinessSeries(
  records: readonly InstallmentHistoryRecord[]
): readonly TardinessPoint[] {
  return records
    .map(paymentDatePair)
    .filter((value): value is { dueDate: string; datePaid: string } => Boolean(value))
    .sort((a, b) => a.datePaid.localeCompare(b.datePaid))
    .map(({ dueDate, datePaid }) => ({
      label: format(parseISO(datePaid), 'MMM d'),
      daysLate: Math.max(0, differenceInCalendarDays(parseISO(datePaid), parseISO(dueDate)))
    }))
}

export function clientPortfolios(
  rows: readonly PersistedInstallmentRow[]
): readonly ClientPortfolio[] {
  const byAccount = new Map<string, PersistedInstallmentRow[]>()
  rows.forEach((row) =>
    byAccount.set(row.account.id, [...(byAccount.get(row.account.id) ?? []), row])
  )
  return [...byAccount.entries()].map(([accountId, contracts]) => {
    const active = contracts.filter((row) => (row.meta.outstandingBalance ?? 0) > 0)
    const nextDue = active
      .map((row) => row.meta.nextDue)
      .filter((value): value is string => Boolean(value))
      .sort()[0]
    const risk = [...contracts].sort(
      (a, b) => riskOrder.indexOf(a.meta.status) - riskOrder.indexOf(b.meta.status)
    )[0].meta.status
    return {
      accountId,
      rows: contracts,
      outstandingBalance: contracts.reduce(
        (total, row) => total + (row.meta.outstandingBalance ?? 0),
        0
      ),
      nextDue,
      risk
    }
  })
}

export function isInPortfolioCategory(
  portfolio: ClientPortfolio,
  category: PortfolioCategory,
  closedFilter: ClosedBlacklistedFilter,
  today = new Date()
): boolean {
  if (category === 'all') return true
  if (category === 'overdue')
    return portfolio.rows.some(
      (row) => row.meta.status === 'overdue' || row.meta.status === 'delayed'
    )
  if (category === 'due-today')
    return portfolio.rows.some(
      (row) =>
        row.meta.status === 'due-today' ||
        (row.meta.nextDue && isSameDay(parseISO(row.meta.nextDue), today))
    )
  if (category === 'due-soon') return portfolio.rows.some((row) => row.meta.status === 'due-soon')
  if (category === 'current') return portfolio.rows.some((row) => row.meta.status === 'active')
  if (category === 'paid') return portfolio.rows.some((row) => row.meta.status === 'fully-paid')
  return portfolio.rows.some((row) => {
    if (closedFilter === 'closed') return row.contractStatus === 'CLOSED'
    if (closedFilter === 'blacklisted') return row.accountStatus === 'BLACKLISTED'
    return row.contractStatus === 'CLOSED' || row.accountStatus === 'BLACKLISTED'
  })
}

export function paginate<T>(items: readonly T[], page: number, pageSize = 5): readonly T[] {
  return items.slice(page * pageSize, page * pageSize + pageSize)
}
