'use client'

import * as React from 'react'

import { SidebarMenu, SidebarMenuItem } from '@/components/ui/sidebar'
import { Badge } from '@/components/ui/badge'
import { AccountBranchBadge } from '@/features/in-house-accounts/components/account-badges'

export function TeamSwitcher({
  teams,
  branch
}: {
  teams: {
    name: React.ReactNode
    logo: React.ReactNode
  }[]
  branch: 'All Branch' | 'Goa' | 'Tinambac' | 'Tigaon' | 'Lagonoy'
}) {
  const team = teams[0]
  if (!team) {
    return null
  }
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div className="flex min-h-10 w-full items-center gap-2 px-2 py-1">
          <div className="flex size-8 shrink-0 items-center justify-center">{team.logo}</div>
          <div className="min-w-0 space-y-1 group-data-[collapsible=icon]:hidden">
            <span className="block text-left text-xs leading-4 font-semibold text-sidebar-foreground">
              {team.name}
            </span>
            {branch === 'All Branch' ? (
              <Badge variant="outline">All branches</Badge>
            ) : (
              <AccountBranchBadge branch={branch} />
            )}
          </div>
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
