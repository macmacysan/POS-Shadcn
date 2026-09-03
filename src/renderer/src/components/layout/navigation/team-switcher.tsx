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
    name: string
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
        <div className="flex w-full items-center gap-2.5 px-2.5 py-1 group-data-[collapsible=icon]:hidden">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground [&>svg]:size-4">
            {team.logo}
          </div>
          <div className="min-w-0 space-y-1">
            <span className="block text-left text-sm font-semibold leading-tight text-sidebar-foreground">
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
