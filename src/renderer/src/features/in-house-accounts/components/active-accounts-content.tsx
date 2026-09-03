import { AccountRecordsWorkspace } from './account-records-workspace'

type Props = {
  readonly initialBranch?: 'Goa' | 'Tinambac' | 'Tigaon' | 'Lagonoy'
  readonly initialSearch?: string
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
  ownBranch,
  onOpenPaymentWorkspace
}: Props): React.JSX.Element {
  return (
    <AccountRecordsWorkspace
      view="active"
      initialBranch={initialBranch}
      initialSearch={initialSearch}
      ownBranch={ownBranch}
      onOpenPaymentWorkspace={onOpenPaymentWorkspace}
    />
  )
}
