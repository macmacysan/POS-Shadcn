import * as React from 'react'
import {
  BarChart3Icon,
  ClipboardListIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MoonIcon,
  Settings2Icon,
  StoreIcon,
  SunIcon
} from 'lucide-react'

import { NavMain } from '@/components/layout/navigation/nav-main'
import { NavSecondary } from '@/components/layout/navigation/nav-secondary'
import { TeamSwitcher } from '@/components/layout/navigation/team-switcher'
import { Sidebar, SidebarContent, SidebarHeader } from '@/components/ui/sidebar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ReceiptNamesSettings } from '@/components/layout/receipt-names-settings'
import { CatalogOptionsSettings } from '@/components/layout/catalog-options-settings'

type ActiveView =
  | 'dashboard'
  | 'installment-overview'
  | 'cashier-reports'
  | 'in-house-accounts'
  | 'in-house-active-accounts'
  | 'in-house-closed-accounts'
  | 'in-house-blacklisted-accounts'
  | 'finance-accounts'

const data = {
  teams: [{ name: 'Cashiers Report', logo: <StoreIcon />, plan: 'Local workspace' }],
  navMain: [
    { title: 'Dashboard', url: '#', icon: <LayoutDashboardIcon />, isActive: true },
    { title: 'Cashier reports', url: '#', icon: <ClipboardListIcon /> },
    {
      title: 'Installments',
      section: true as const,
      children: [
        { title: 'Overview', url: '#', icon: <BarChart3Icon /> },
        {
          title: 'In-house',
          url: '#',
          children: [
            { title: 'Records', url: '#' },
            { title: 'Active', url: '#' },
            { title: 'Closed', url: '#' },
            { title: 'Blacklisted', url: '#' }
          ]
        },
        {
          title: 'Finance',
          url: '#',
          children: [{ title: 'Accounts', url: '#' }]
        }
      ]
    }
  ],
  navSecondary: [
    { title: 'Settings', url: '#', icon: <Settings2Icon /> },
    { title: 'Dark mode', url: '#', icon: <MoonIcon /> },
    { title: 'Log out', url: '#', icon: <LogOutIcon /> }
  ]
}

export function SidebarLeft({
  activeView = 'dashboard',
  isDark,
  onDashboard,
  onInstallmentOverview,
  onCashierReports,
  onAllAccounts,
  onActiveAccounts,
  onClosedAccounts,
  onBlacklistedAccounts,
  onFinanceAccounts,
  onToggleTheme,
  summaryAlwaysDark,
  onSummaryAlwaysDarkChange,
  onLogout,
  isAdmin,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  activeView?: ActiveView
  isDark: boolean
  onDashboard?: () => void
  onInstallmentOverview?: () => void
  onCashierReports?: () => void
  onAllAccounts?: () => void
  onActiveAccounts?: () => void
  onClosedAccounts?: () => void
  onBlacklistedAccounts?: () => void
  onFinanceAccounts?: () => void
  onToggleTheme: () => void
  summaryAlwaysDark: boolean
  onSummaryAlwaysDarkChange: (value: boolean) => void
  onLogout: () => void
  isAdmin: boolean
}): React.JSX.Element {
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false)

  return (
    <Sidebar
      {...props}
      collapsible="none"
      className="border-r border-sidebar-border"
      style={{ '--sidebar-width': '13.5rem' } as React.CSSProperties}
    >
      <SidebarHeader className="gap-2 border-sidebar-border">
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
            if (item.title !== 'Installments') return item
            if (!('children' in item) || !item.children) return item
            return {
              ...item,
              children: item.children.map((child) =>
                child.title === 'Overview'
                  ? {
                      ...child,
                      isActive: activeView === 'installment-overview',
                      onClick: onInstallmentOverview
                    }
                  : child.title === 'In-house'
                    ? {
                        ...child,
                        children: child.children?.map((entry) => {
                          if (entry.title === 'Records')
                            return {
                              ...entry,
                              isActive: activeView === 'in-house-accounts',
                              onClick: onAllAccounts
                            }
                          if (entry.title === 'Active')
                            return {
                              ...entry,
                              isActive: activeView === 'in-house-active-accounts',
                              onClick: onActiveAccounts
                            }
                          if (entry.title === 'Closed')
                            return {
                              ...entry,
                              isActive: activeView === 'in-house-closed-accounts',
                              onClick: onClosedAccounts
                            }
                          if (entry.title === 'Blacklisted')
                            return {
                              ...entry,
                              isActive: activeView === 'in-house-blacklisted-accounts',
                              onClick: onBlacklistedAccounts
                            }
                          return entry
                        })
                      }
                    : child.title === 'Finance'
                      ? {
                          ...child,
                          children: child.children?.map((entry) =>
                            entry.title === 'Accounts'
                              ? {
                                  ...entry,
                                  isActive: activeView === 'finance-accounts',
                                  onClick: onFinanceAccounts
                                }
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
        <NavSecondary
          items={data.navSecondary.map((item) =>
            item.title === 'Settings'
              ? {
                  ...item,
                  onClick: () => setIsSettingsOpen(true)
                }
              : item.title === 'Dark mode'
                ? {
                    ...item,
                    icon: isDark ? <SunIcon /> : <MoonIcon />,
                    onClick: onToggleTheme
                  }
                : item.title === 'Log out'
                  ? { ...item, onClick: onLogout }
                  : item
          )}
          className="mt-auto"
        />
      </SidebarContent>
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-h-[calc(100dvh-4rem)] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>Customize the cashier report workspace.</DialogDescription>
          </DialogHeader>
          <Label className="items-start gap-3">
            <Checkbox
              checked={summaryAlwaysDark}
              onCheckedChange={(checked) => onSummaryAlwaysDarkChange(checked === true)}
              aria-label="Sidebar Summary always Dark Mode"
            />
            <span className="flex flex-col gap-1">
              <span>Sidebar Summary always Dark Mode</span>
              <span className="text-xs font-normal text-muted-foreground">
                Keep Today&apos;s Summary dark even when the app uses light mode.
              </span>
            </span>
          </Label>
          {isAdmin && <ReceiptNamesSettings />}
          {isAdmin && <CatalogOptionsSettings />}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsSettingsOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sidebar>
  )
}
