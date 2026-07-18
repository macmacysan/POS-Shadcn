import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { accountStatusLabel, branchCodeByName } from '@/lib/in-house-account-display'
import { type AccountMonitoringStatus } from '@/lib/in-house-account-monitoring'
import { branchLabels, type BranchName } from '@/lib/in-house-accounts'
import { cn } from '@/lib/utils'

export const AccountBranchBadge = React.memo(function AccountBranchBadge({
  branch
}: {
  readonly branch: BranchName
}): React.JSX.Element {
  return (
    <Badge
      variant="outline"
      aria-label={`${branchLabels[branch]} branch`}
      className={cn(
        'min-w-9 justify-center px-1.5 font-mono text-xs tracking-normal',
        branch === 'Goa' && 'border-primary/40 text-primary',
        branch === 'Tinambac' && 'border-muted-foreground/40 text-muted-foreground',
        branch === 'Tigaon' && 'border-accent-foreground/40 text-accent-foreground',
        branch === 'Lagonoy' && 'border-secondary-foreground/40 text-secondary-foreground'
      )}
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
        status === 'overdue' || status === 'delayed' || status === 'blacklisted'
          ? 'destructive'
          : status === 'due-today'
            ? 'default'
            : status === 'active' || status === 'due-soon' || status === 'fully-paid'
              ? 'secondary'
              : 'outline'
      }
    >
      {accountStatusLabel[status]}
    </Badge>
  )
})
