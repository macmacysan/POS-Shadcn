import { AccountRecordsWorkspace } from './account-records-workspace'

type Props = {
  readonly userId: string
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
  userId,
  initialBranch,
  initialSearch,
  initialPaymentStatus,
  ownBranch,
  onOpenPaymentWorkspace
}: Props): React.JSX.Element {
  return (
    <AccountRecordsWorkspace
      view="active"
      userId={userId}
      initialBranch={initialBranch}
      initialSearch={initialSearch}
      initialPaymentStatus={initialPaymentStatus}
      ownBranch={ownBranch}
      onOpenPaymentWorkspace={onOpenPaymentWorkspace}
    />
  )
}
