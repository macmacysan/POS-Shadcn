import { StatusAccountsContent } from './status-accounts-content'

type Props = {
  readonly initialBranch?: 'Goa' | 'Tinambac' | 'Tigaon' | 'Lagonoy'
  readonly initialSearch?: string
  readonly onOpenPaymentWorkspace?: (
    accountId: string,
    initialTab: 'schedule' | 'ledger',
    origin: 'records' | 'active' | 'closed' | 'blacklisted'
  ) => void
}

export function InHouseActiveAccountsContent({
  initialBranch,
  initialSearch,
  onOpenPaymentWorkspace
}: Props): React.JSX.Element {
  return (
    <StatusAccountsContent
      view="active"
      initialBranch={initialBranch}
      initialSearch={initialSearch}
      onOpenPaymentWorkspace={onOpenPaymentWorkspace}
    />
  )
}
