import * as React from 'react'
import {
  BarChart3Icon,
  CircleDollarSignIcon,
  CircleHelpIcon,
  ClipboardListIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  Settings2Icon,
  StoreIcon,
  UsersIcon,
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
    { title: 'Receipts', url: '#', icon: <FileTextIcon /> },
    { title: 'Finance', url: '#', icon: <CircleDollarSignIcon /> },
  ],
  navSecondary: [
    { title: 'Reports', url: '#', icon: <BarChart3Icon /> },
    { title: 'Branches', url: '#', icon: <StoreIcon /> },
    { title: 'Cashiers', url: '#', icon: <UsersIcon /> },
    { title: 'Settings', url: '#', icon: <Settings2Icon /> },
    { title: 'Help', url: '#', icon: <CircleHelpIcon /> },
  ],
}

export function SidebarLeft({
  onCashierReports,
  ...props
}: React.ComponentProps<typeof Sidebar> & { onCashierReports?: () => void }): React.JSX.Element {
  return (
    <Sidebar className="border-r-0" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
        <NavMain
          items={data.navMain.map((item) =>
            item.title === 'Cashier reports' ? { ...item, onClick: onCashierReports } : item
          )}
        />
      </SidebarHeader>
      <SidebarContent>
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
