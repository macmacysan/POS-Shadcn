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
        <div className="flex w-full flex-col items-start gap-2 px-2.5 py-2 group-data-[collapsible=icon]:hidden">
          <div className="flex size-10 shrink-0 items-center justify-center">
            {team.logo}
          </div>
          <div className="min-w-0 space-y-1.5">
            <span className="block text-left text-[11px] leading-4 font-semibold uppercase tracking-[0.08em] text-sidebar-foreground">
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
