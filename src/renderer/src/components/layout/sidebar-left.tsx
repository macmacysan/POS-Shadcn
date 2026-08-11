import * as React from 'react'
import {
  BankIcon,
  ChartLineUpIcon,
  ClipboardTextIcon,
  GearSixIcon,
  HouseLineIcon,
  MoonIcon,
  SignOutIcon,
  SquaresFourIcon,
  StorefrontIcon,
  SunIcon
} from '@phosphor-icons/react'

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
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  teams: [{ name: 'Cashiers Report', logo: <StorefrontIcon />, plan: 'Local workspace' }],
  navMain: [
    { title: 'Dashboard', url: '#', icon: <SquaresFourIcon />, isActive: true },
    { title: 'Cashier reports', url: '#', icon: <ClipboardTextIcon /> },
    {
      title: 'Installments',
      section: true as const,
      children: [
        { title: 'Overview', url: '#', icon: <ChartLineUpIcon /> },
        {
          title: 'In-house',
          url: '#',
          icon: <HouseLineIcon />,
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
          icon: <BankIcon />,
          children: [{ title: 'Accounts', url: '#' }]
        }
      ]
    }
  ],
  navSecondary: [
    { title: 'Settings', url: '#', icon: <GearSixIcon /> },
    { title: 'Dark mode', url: '#', icon: <MoonIcon /> },
    { title: 'Log out', url: '#', icon: <SignOutIcon /> }
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
  dueCount,
  unpaidFinanceCount,
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
  dueCount?: number
  unpaidFinanceCount?: number
  onToggleTheme: () => void
  summaryAlwaysDark: boolean
  onSummaryAlwaysDarkChange: (value: boolean) => void
  onLogout: () => void
  isAdmin: boolean
}): React.JSX.Element {
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false)
  const [summaryAlwaysDarkDraft, setSummaryAlwaysDarkDraft] = React.useState(summaryAlwaysDark)
  const [settingsSection, setSettingsSection] = React.useState('workspace')
  const hasUnsavedChanges = summaryAlwaysDarkDraft !== summaryAlwaysDark

  const setSettingsOpen = (open: boolean): void => {
    setIsSettingsOpen(open)
    if (open) {
      setSummaryAlwaysDarkDraft(summaryAlwaysDark)
      setSettingsSection('workspace')
    } else {
      setSummaryAlwaysDarkDraft(summaryAlwaysDark)
    }
  }

  const saveSettings = (): void => {
    onSummaryAlwaysDarkChange(summaryAlwaysDarkDraft)
    setIsSettingsOpen(false)
  }

  return (
    <Sidebar
      {...props}
      collapsible="none"
      className="sidebar-always-dark"
      style={{ '--sidebar-width': '13rem' } as React.CSSProperties}
    >
      <SidebarHeader className="gap-3 border-sidebar-border px-2.5 py-3">
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
                              badge: dueCount,
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
                                  badge: unpaidFinanceCount,
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
      <SidebarContent className="px-1.5 pb-2">
        <NavSecondary
          items={data.navSecondary.map((item) =>
            item.title === 'Settings'
              ? {
                  ...item,
                  onClick: () => setSettingsOpen(true)
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
          className="mt-auto border-t border-sidebar-border pt-2"
        />
      </SidebarContent>
      <Dialog open={isSettingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="h-[min(42rem,calc(100dvh-4rem))] max-h-[calc(100dvh-4rem)] flex flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader className="shrink-0 px-6 py-5 pr-12">
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Manage workspace preferences and operational configuration.
            </DialogDescription>
          </DialogHeader>
          <Tabs
            orientation="vertical"
            value={settingsSection}
            onValueChange={setSettingsSection}
            className="min-h-0 flex-1 gap-0"
          >
            <TabsList
              variant="line"
              className="h-full w-44 shrink-0 items-stretch gap-1 rounded-none border-r bg-muted/20 p-3"
            >
              <TabsTrigger value="workspace" className="h-auto flex-none px-3 py-2 text-left">
                Workspace
              </TabsTrigger>
              {isAdmin && (
                <TabsTrigger
                  value="administration"
                  className="h-auto flex-none px-3 py-2 text-left"
                >
                  Administration
                </TabsTrigger>
              )}
            </TabsList>
            <TabsContent value="workspace" className="min-h-0 overflow-y-auto p-6">
              <section className="flex max-w-xl flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium tracking-tight">Workspace appearance</p>
                  <p className="text-xs leading-5 text-muted-foreground">
                    Personal preferences apply only to this workstation.
                  </p>
                </div>
                <Label className="items-start gap-3 rounded-lg border p-4">
                  <Checkbox
                    checked={summaryAlwaysDarkDraft}
                    onCheckedChange={(checked) => setSummaryAlwaysDarkDraft(checked === true)}
                    aria-label="Sidebar Summary always Dark Mode"
                  />
                  <span className="flex flex-col gap-1">
                    <span>Sidebar Summary always Dark Mode</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      Keep Today&apos;s Summary dark even when the app uses light mode.
                    </span>
                  </span>
                </Label>
              </section>
            </TabsContent>
            {isAdmin && (
              <TabsContent value="administration" className="min-h-0 overflow-y-auto p-6">
                <section className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium tracking-tight">Operational configuration</p>
                    <Badge variant="secondary">Admin only</Badge>
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">
                    Changes take effect immediately for future reports and accounts. Retired values
                    stay on existing records.
                  </p>
                </section>
                <ReceiptNamesSettings />
                <CatalogOptionsSettings />
              </TabsContent>
            )}
          </Tabs>
          <DialogFooter className="mx-0 mb-0 shrink-0 bg-muted/30 px-6 py-4">
            {hasUnsavedChanges && (
              <span className="mr-auto text-xs text-muted-foreground" aria-live="polite">
                Unsaved changes
              </span>
            )}
            <Button type="button" variant="outline" onClick={() => setSettingsOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveSettings} disabled={!hasUnsavedChanges}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sidebar>
  )
}
