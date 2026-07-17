import { type AccountMonitoringStatus } from '@/lib/in-house-account-monitoring'
import { type BranchName } from '@/lib/in-house-accounts'

export const accountStatusLabel: Record<AccountMonitoringStatus, string> = {
  active: 'Active',
  'due-today': 'Due Today',
  'due-soon': 'Due Soon',
  delayed: 'Delayed',
  overdue: 'Overdue',
  closed: 'Closed',
  blacklisted: 'Blacklisted',
  'fully-paid': 'Fully Paid'
}

export const accountStatusRank: Record<AccountMonitoringStatus, number> = {
  overdue: 0,
  delayed: 1,
  'due-today': 2,
  'due-soon': 3,
  active: 4,
  'fully-paid': 5,
  closed: 6,
  blacklisted: 7
}

export const branchCodeByName: Record<BranchName, string> = {
  Goa: 'GOA',
  Tinambac: 'TIN',
  Tigaon: 'TIG',
  Lagonoy: 'LAG'
}
