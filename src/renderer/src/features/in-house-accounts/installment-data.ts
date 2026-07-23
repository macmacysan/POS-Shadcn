import * as React from 'react'

import type { InstallmentAccountRecord, InstallmentView } from '../../../../shared/contracts'
import {
  readInHouseAccounts,
  readInHouseLoans,
  branchNames,
  type InHouseAccount,
  type InHouseLoan
} from '@/lib/in-house-accounts'
import type { AccountMonitoringMeta } from '@/lib/in-house-account-monitoring'

export type PersistedInstallmentRow = {
  readonly account: InHouseAccount
  readonly loan: InHouseLoan
  readonly contractId: string
  readonly accountStatus: InstallmentAccountRecord['accountStatus']
  readonly contractStatus: InstallmentAccountRecord['contractStatus']
  readonly meta: AccountMonitoringMeta
}

function toRow(record: InstallmentAccountRecord): PersistedInstallmentRow {
  const branch = branchNames.find((value) => value.toLowerCase() === record.account.branch.toLowerCase()) ?? 'Lagonoy'
  return {
    account: { ...record.account, branch },
    loan: record.loan,
    contractId: record.contractId,
    accountStatus: record.accountStatus,
    contractStatus: record.contractStatus,
    meta: record.meta
  }
}

export function useInstallmentData(view: InstallmentView): {
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
        const existing = await window.api.installments.list({ view: 'records', search: '' })
        if (existing.rows.length === 0) {
          await window.api.installments.bootstrap({
            accounts: readInHouseAccounts() as unknown as Record<string, unknown>[],
            loans: readInHouseLoans() as unknown as Record<string, unknown>[]
          })
        }
        const result = await window.api.installments.list({ view, search: '' })
        if (!cancelled) setRows(result.rows.map(toRow))
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
  }, [reloadKey, view])

  return {
    rows,
    isLoading,
    error,
    reload: () => setReloadKey((value) => value + 1)
  }
}
