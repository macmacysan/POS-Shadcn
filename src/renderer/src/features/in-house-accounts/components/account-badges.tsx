import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { accountStatusLabel, branchCodeByName } from '@/lib/in-house-account-display'
import { type AccountMonitoringStatus } from '@/lib/in-house-account-monitoring'
import { branchLabels, type BranchName } from '@/lib/in-house-accounts'

export const AccountBranchBadge = React.memo(function AccountBranchBadge({
  branch
}: {
  readonly branch: BranchName
}): React.JSX.Element {
  return (
    <Badge
      variant="outline"
      aria-label={`${branchLabels[branch]} branch`}
      className="min-w-8 justify-center px-1 font-mono tracking-normal text-muted-foreground"
    >
      {branchCodeByName[branch]}
    </Badge>
  )
})

export const AccountStatusBadge = React.memo(function AccountStatusBadge({
  status
}: {
  readonly status?: AccountMonitoringStatus
}): React.JSX.Element {
  if (!status) return <Badge variant="outline">Not provided</Badge>

  return (
    <Badge
      variant={
        status === 'blacklisted'
          ? 'destructive'
          : status === 'overdue' || status === 'delayed' || status === 'due-today'
            ? 'outline'
            : status === 'active' || status === 'due-soon' || status === 'fully-paid'
              ? 'secondary'
              : 'outline'
      }
      className={
        status === 'overdue' || status === 'delayed' || status === 'due-today'
          ? 'border-warning/40 bg-warning/10 text-warning-foreground'
          : undefined
      }
    >
      {accountStatusLabel[status]}
    </Badge>
  )
})
