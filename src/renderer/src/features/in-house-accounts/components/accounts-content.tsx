import { AccountRecordsWorkspace } from './account-records-workspace'

type Props = {
  readonly userId: string
  readonly ownBranch?: 'Goa' | 'Tinambac' | 'Tigaon' | 'Lagonoy'
  readonly showAllBranches?: boolean
  readonly onOpenPaymentWorkspace?: (
    accountId: string,
    initialTab: 'schedule' | 'ledger',
    origin: 'records' | 'active' | 'closed' | 'blacklisted',
    initialPaymentId?: string,
    openRecordPayment?: boolean
  ) => void
}

export function InHouseAccountsContent({
  userId,
  ownBranch,
  showAllBranches,
  onOpenPaymentWorkspace
}: Props): React.JSX.Element {
  return (
    <AccountRecordsWorkspace
      view="records"
      userId={userId}
      ownBranch={ownBranch}
      showAllBranches={showAllBranches}
      onOpenPaymentWorkspace={onOpenPaymentWorkspace}
    />
  )
}
