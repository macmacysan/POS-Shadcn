import * as React from 'react'
import {
  BarChart3Icon,
  CircleHelpIcon,
  ClipboardListIcon,
  HouseIcon,
  LandmarkIcon,
  LayoutDashboardIcon,
  Settings2Icon,
  StoreIcon,
  UsersIcon
} from 'lucide-react'

import { NavMain } from '@/components/layout/navigation/nav-main'
import { NavSecondary } from '@/components/layout/navigation/nav-secondary'
import { TeamSwitcher } from '@/components/layout/navigation/team-switcher'
import { ThemeToggle } from '@/components/shared/theme-toggle'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail
} from '@/components/ui/sidebar'

type ActiveView = 'dashboard' | 'cashier-reports' | 'in-house-accounts' | 'in-house-active-accounts'

const data = {
  teams: [{ name: 'Cashiers Report', logo: <StoreIcon />, plan: 'Local workspace' }],
  navMain: [
    { title: 'Dashboard', url: '#', icon: <LayoutDashboardIcon />, isActive: true },
    { title: 'Cashier reports', url: '#', icon: <ClipboardListIcon /> },
    {
      title: 'Finance',
      url: '#',
      icon: <LandmarkIcon />,
      children: [
        { title: 'Overview', url: '#', icon: <BarChart3Icon /> },
        {
          title: 'In-house',
          url: '#',
          icon: <HouseIcon />,
          children: [
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
  activeView = 'dashboard',
  isDark,
  onDashboard,
  onCashierReports,
  onAllAccounts,
  onActiveAccounts,
  onToggleTheme,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  activeView?: ActiveView
  isDark: boolean
  onDashboard?: () => void
  onCashierReports?: () => void
  onAllAccounts?: () => void
  onActiveAccounts?: () => void
  onToggleTheme: () => void
}): React.JSX.Element {
  return (
    <Sidebar collapsible="icon" className="border-r-0" {...props}>
      <SidebarHeader className="gap-3 border-b border-sidebar-border">
        <TeamSwitcher teams={data.teams} />
        <NavMain
          items={data.navMain.map((item) => {
            if (item.title === 'Dashboard')
              return {
                ...item,
                isActive: activeView === 'dashboard',
                onClick: onDashboard
              }
            if (item.title === 'Cashier reports')
              return {
                ...item,
                isActive: activeView === 'cashier-reports',
                onClick: onCashierReports
              }
            if (item.title !== 'Finance') return item
            if (!item.children) return item
            return {
              ...item,
              children: item.children.map((child) =>
                child.title === 'In-house'
                  ? {
                      ...child,
                      children: child.children?.map((entry) => {
                        if (entry.title === 'All Accounts')
                          return {
                            ...entry,
                            isActive: activeView === 'in-house-accounts',
                            onClick: onAllAccounts
                          }
                        if (entry.title === 'Active Accounts')
                          return {
                            ...entry,
                            isActive: activeView === 'in-house-active-accounts',
                            onClick: onActiveAccounts
                          }
                        return entry
                      })
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
      <SidebarFooter className="border-t border-sidebar-border">
        <ThemeToggle isDark={isDark} onToggle={onToggleTheme} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
