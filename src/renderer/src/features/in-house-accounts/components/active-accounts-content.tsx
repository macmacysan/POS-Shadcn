import { AccountRecordsWorkspace } from './account-records-workspace'

type Props = {
  readonly initialBranch?: 'Goa' | 'Tinambac' | 'Tigaon' | 'Lagonoy'
  readonly initialSearch?: string
  readonly initialPaymentStatus?: 'overdue'
  readonly ownBranch?: 'Goa' | 'Tinambac' | 'Tigaon' | 'Lagonoy'
  readonly onOpenPaymentWorkspace?: (
    accountId: string,
    initialTab: 'schedule' | 'ledger',
    origin: 'records' | 'active' | 'closed' | 'blacklisted',
    initialPaymentId?: string,
    openRecordPayment?: boolean
  ) => void
}

export function InHouseActiveAccountsContent({
  initialBranch,
  initialSearch,
  initialPaymentStatus,
  ownBranch,
  onOpenPaymentWorkspace
}: Props): React.JSX.Element {
  return (
    <AccountRecordsWorkspace
      view="active"
      initialBranch={initialBranch}
      initialSearch={initialSearch}
      initialPaymentStatus={initialPaymentStatus}
      ownBranch={ownBranch}
      onOpenPaymentWorkspace={onOpenPaymentWorkspace}
    />
  )
}
