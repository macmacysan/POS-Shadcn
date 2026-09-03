import * as React from 'react'

import { Calendars, DatePicker } from '@/features/calendar'
import { NavUser } from '@/components/layout/navigation/nav-user'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator
} from '@/components/ui/sidebar'
import { PlusIcon } from 'lucide-react'

// This is sample data.
const data = {
  user: {
    name: 'shadcn',
    role: 'Admin',
    branch: 'All Branch' as const
  },
  calendars: [
    {
      name: 'My Calendars',
      items: ['Personal', 'Work', 'Family']
    },
    {
      name: 'Favorites',
      items: ['Holidays', 'Birthdays']
    },
    {
      name: 'Other',
      items: ['Travel', 'Reminders', 'Deadlines']
    }
  ]
}

export function SidebarRight({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="none" className="sticky top-0 hidden h-svh border-l lg:flex" {...props}>
      <SidebarHeader className="h-16 border-b border-sidebar-border">
        <NavUser
          user={data.user}
          isDark={false}
          onOpenSettings={() => undefined}
          onToggleTheme={() => undefined}
          onLogout={() => undefined}
          isAdmin={false}
          onBranchChange={() => undefined}
        />
      </SidebarHeader>
      <SidebarContent>
        <DatePicker />
        <SidebarSeparator className="mx-0" />
        <Calendars calendars={data.calendars} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton>
              <PlusIcon />
              <span>New Calendar</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
