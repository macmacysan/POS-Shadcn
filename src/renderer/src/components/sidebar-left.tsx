import * as React from 'react'
import {
  BarChart3Icon,
  CircleDollarSignIcon,
  CircleHelpIcon,
  ClipboardListIcon,
  HouseIcon,
  LandmarkIcon,
  LayoutDashboardIcon,
  Settings2Icon,
  StoreIcon,
  UsersIcon
} from 'lucide-react'

import { NavMain } from '@/components/nav-main'
import { NavSecondary } from '@/components/nav-secondary'
import { TeamSwitcher } from '@/components/team-switcher'
import { Sidebar, SidebarContent, SidebarHeader, SidebarRail } from '@/components/ui/sidebar'

const data = {
  teams: [{ name: 'Cashiers Report', logo: <StoreIcon />, plan: 'Local workspace' }],
  navMain: [
    { title: 'Dashboard', url: '#', icon: <LayoutDashboardIcon />, isActive: true },
    { title: 'Cashier reports', url: '#', icon: <ClipboardListIcon /> },
    {
      title: 'Finance',
      url: '#',
      icon: <CircleDollarSignIcon />,
      children: [
        { title: 'Overview', url: '#' },
        {
          title: 'In-house',
          url: '#',
          icon: <HouseIcon />,
          children: [
            { title: 'Dashboard', url: '#' },
            { title: 'All Accounts', url: '#' },
            { title: 'Active Accounts', url: '#' },
            { title: 'Closed Accounts', url: '#' },
            { title: 'Blacklisted Accounts', url: '#' }
          ]
        },
        {
          title: 'Finance',
          url: '#',
          icon: <LandmarkIcon />,
          children: [
            { title: 'Dashboard', url: '#' },
            { title: 'Accounts', url: '#' }
          ]
        }
      ]
    }
  ],
  navSecondary: [
    { title: 'Reports', url: '#', icon: <BarChart3Icon /> },
    { title: 'Branches', url: '#', icon: <StoreIcon /> },
    { title: 'Cashiers', url: '#', icon: <UsersIcon /> },
    { title: 'Settings', url: '#', icon: <Settings2Icon /> },
    { title: 'Help', url: '#', icon: <CircleHelpIcon /> }
  ]
}

export function SidebarLeft({
  onCashierReports,
  onAllAccounts,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  onCashierReports?: () => void
  onAllAccounts?: () => void
}): React.JSX.Element {
  return (
    <Sidebar className="border-r-0" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
        <NavMain
          items={data.navMain.map((item) => {
            if (item.title === 'Cashier reports') return { ...item, onClick: onCashierReports }
            if (item.title !== 'Finance') return item
            if (!item.children) return item
            return {
              ...item,
              children: item.children.map((child) =>
                child.title === 'In-house'
                  ? {
                      ...child,
                      children: child.children?.map((entry) =>
                        entry.title === 'All Accounts'
                          ? { ...entry, onClick: onAllAccounts }
                          : entry
                      )
                    }
                  : child
              )
            }
          })}
        />
      </SidebarHeader>
      <SidebarContent>
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
