import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { accountStatusLabel, branchCodeByName } from '@/lib/in-house-account-display'
import { type AccountMonitoringStatus } from '@/lib/in-house-account-monitoring'
import { branchLabels, type BranchName } from '@/lib/in-house-accounts'
import { cn } from '@/lib/utils'

const branchBadgeClassName: Record<BranchName, string> = {
  Goa: 'border-branch-goa/30 bg-branch-goa/10 text-branch-goa',
  Tinambac: 'border-branch-tinambac/30 bg-branch-tinambac/10 text-branch-tinambac',
  Tigaon: 'border-branch-tigaon/30 bg-branch-tigaon/10 text-branch-tigaon',
  Lagonoy: 'border-branch-lagonoy/30 bg-branch-lagonoy/10 text-branch-lagonoy'
}

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
        'min-w-8 justify-center px-1 font-mono tracking-normal',
        branchBadgeClassName[branch]
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
        status === 'blacklisted'
          ? 'destructive'
          : status === 'overdue'
            ? 'orange'
            : status === 'fully-paid'
              ? 'emerald'
              : status === 'due-today' || status === 'due-soon'
                ? 'zinc'
                : status === 'delayed'
                  ? 'amber'
                : status === 'active'
                  ? 'secondary'
                  : 'outline'
      }
    >
      {accountStatusLabel[status]}
    </Badge>
  )
})
