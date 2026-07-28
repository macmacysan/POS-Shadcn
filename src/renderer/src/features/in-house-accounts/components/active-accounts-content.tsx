import { StatusAccountsContent } from './status-accounts-content'

type Props = {
  readonly onOpenPaymentWorkspace?: (
    accountId: string,
    initialTab: 'schedule' | 'ledger',
    origin: 'records' | 'active' | 'closed' | 'blacklisted'
  ) => void
}

export function InHouseActiveAccountsContent({ onOpenPaymentWorkspace }: Props): React.JSX.Element {
  return <StatusAccountsContent view="active" onOpenPaymentWorkspace={onOpenPaymentWorkspace} />
}
