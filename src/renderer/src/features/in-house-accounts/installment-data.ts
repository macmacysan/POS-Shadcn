import * as React from 'react'

import type { InstallmentAccountRecord, InstallmentView } from '../../../../shared/contracts'
import { branchNames, type InHouseAccount, type InHouseLoan } from '@/lib/in-house-accounts'
import type { AccountMonitoringMeta } from '@/lib/in-house-account-monitoring'

export type PersistedInstallmentRow = {
  readonly account: InHouseAccount
  readonly loan: InHouseLoan
  readonly contractId: string
  readonly accountStatus: InstallmentAccountRecord['accountStatus']
  readonly contractStatus: InstallmentAccountRecord['contractStatus']
  readonly statusRemarks?: string
  readonly meta: AccountMonitoringMeta
}

function toRow(record: InstallmentAccountRecord): PersistedInstallmentRow {
  const branch =
    branchNames.find((value) => value.toLowerCase() === record.account.branch.toLowerCase()) ??
    'Lagonoy'
  return {
    account: { ...record.account, branch },
    loan: {
      ...record.loan,
      items: record.loan.items.map((item) => ({ ...item, model: '' }))
    },
    contractId: record.contractId,
    accountStatus: record.accountStatus,
    contractStatus: record.contractStatus,
    statusRemarks: record.statusRemarks,
    meta: record.meta
  }
}

export function useInstallmentData(
  view: InstallmentView,
  includeVoided = false,
  includeGoogleRecords = false
): {
  rows: readonly PersistedInstallmentRow[]
  isLoading: boolean
  error?: string
  reload: () => void
} {
  const [rows, setRows] = React.useState<readonly PersistedInstallmentRow[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string>()
  const [reloadKey, setReloadKey] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false
    const load = async (): Promise<void> => {
      setIsLoading(true)
      setError(undefined)
      try {
        const [result, googleRecords] = await Promise.all([
          window.api.installments.list({ view, search: '', includeVoided }),
          includeGoogleRecords || view === 'active' || view === 'closed' || view === 'blacklisted'
            ? view === 'blacklisted'
              ? window.api.googleSync.blacklisted()
              : window.api.googleSync.records()
            : Promise.resolve({ rows: [] })
        ])
        if (!cancelled) {
          const records = includeGoogleRecords || view === 'active' || view === 'closed' || view === 'blacklisted'
            ? [...new Map([...result.rows, ...googleRecords.rows].map((row) => [row.contractId, row])).values()]
            : result.rows
          const visibleRecords = records.filter((record) => {
            if (view === 'active') return record.accountStatus === 'ACTIVE' && record.contractStatus === 'ACTIVE'
            if (view === 'closed') return record.contractStatus === 'CLOSED'
            if (view === 'blacklisted') return record.accountStatus === 'BLACKLISTED'
            return true
          })
          setRows(visibleRecords.map(toRow))
        }
      } catch {
        if (!cancelled) setError('Installment data could not be loaded.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [includeGoogleRecords, includeVoided, reloadKey, view])

  return {
    rows,
    isLoading,
    error,
    reload: () => setReloadKey((value) => value + 1)
  }
}
