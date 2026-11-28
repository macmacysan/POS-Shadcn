import * as React from 'react'
import appIcon from '@/assets/app-icon.png'
import { MonitorCogIcon, ShieldCheckIcon } from 'lucide-react'

import { NavMain } from '@/components/layout/navigation/nav-main'
import { NavUser } from '@/components/layout/navigation/nav-user'
import { TeamSwitcher } from '@/components/layout/navigation/team-switcher'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar
} from '@/components/ui/sidebar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Field, FieldContent, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ReceiptNamesSettings } from '@/components/layout/receipt-names-settings'
import { CatalogOptionsSettings } from '@/components/layout/catalog-options-settings'
import { InstallmentRulesSettings } from '@/components/layout/installment-rules-settings'
import { CashierLoginBranchSettings } from '@/components/layout/cashier-login-branch-settings'
import { PortableDatabaseSettings } from '@/components/layout/portable-database-settings'
import type { LoginBranch } from '@/../../shared/contracts'

const teams = [
  {
    name: (
      <>
        Nueva Camsur
        <br />
        Home Furnishing
      </>
    ),
    logo: <img src={appIcon} alt="" className="size-8 rounded-lg object-contain" />
  }
]

export function SidebarLeft({
  isDark,
  activeView,
  cashierName,
  selectedBranch,
  onDashboard,
  onCashierReports,
  onReport,
  onAllAccounts,
  onActiveAccounts,
  onClosedAccounts,
  onBlacklistedAccounts,
  onFinanceAccounts,
  onCalendar,
  overdueCount,
  unpaidFinanceCount,
  onToggleTheme,
  hidePesoSign,
  onHidePesoSignChange,
  onLogout,
  onBranchChange,
  isAdmin,
  settingsOnly = false,
  openSettingsOnMount = false,
  onPointerEnter,
  onPointerLeave,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  isDark: boolean
  activeView: string
  cashierName: string
  selectedBranch: 'All Branch' | 'Goa' | 'Tinambac' | 'Tigaon' | 'Lagonoy'
  onDashboard?: () => void
  onCashierReports?: () => void
  onReport?: () => void
  onAllAccounts?: () => void
  onActiveAccounts?: () => void
  onClosedAccounts?: () => void
  onBlacklistedAccounts?: () => void
  onFinanceAccounts?: () => void
  onCalendar?: () => void
  overdueCount?: number
  unpaidFinanceCount?: number
  onToggleTheme: () => void
  hidePesoSign: boolean
  onHidePesoSignChange: (value: boolean) => void
  onLogout: () => void
  onBranchChange: (branch: LoginBranch) => void
  isAdmin: boolean
  settingsOnly?: boolean
  openSettingsOnMount?: boolean
}): React.JSX.Element {
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false)
  const [hidePesoSignDraft, setHidePesoSignDraft] = React.useState(hidePesoSign)
  const [settingsSection, setSettingsSection] = React.useState('workspace')
  const hasUnsavedChanges = hidePesoSignDraft !== hidePesoSign
  const { isMobile, setHoverOpen } = useSidebar()

  const setSettingsOpen = (open: boolean): void => {
    setIsSettingsOpen(open)
    if (open) {
      setHidePesoSignDraft(hidePesoSign)
      setSettingsSection('workspace')
    } else {
      setHidePesoSignDraft(hidePesoSign)
    }
  }

  const saveSettings = (): void => {
    onHidePesoSignChange(hidePesoSignDraft)
    setIsSettingsOpen(false)
  }

  React.useEffect(() => {
    if (openSettingsOnMount) setSettingsOpen(true)
  }, [openSettingsOnMount])

  return (
    <Sidebar
      {...props}
      variant="sidebar"
      collapsible="icon"
      onPointerEnter={(event) => {
        onPointerEnter?.(event)
        if (!isMobile) setHoverOpen(true)
      }}
      onPointerLeave={(event) => {
        onPointerLeave?.(event)
        if (!isMobile) setHoverOpen(false)
      }}
    >
      <SidebarHeader>
        <TeamSwitcher teams={teams} branch={selectedBranch} />
      </SidebarHeader>
      <SidebarContent>
        {!settingsOnly && (
          <NavMain
            activeView={activeView}
            onDashboard={onDashboard}
            onCashierReports={onCashierReports}
            onReport={onReport}
            onAllAccounts={onAllAccounts}
            onActiveAccounts={onActiveAccounts}
            onClosedAccounts={onClosedAccounts}
            onBlacklistedAccounts={onBlacklistedAccounts}
            onFinanceAccounts={onFinanceAccounts}
            onCalendar={onCalendar}
            overdueCount={overdueCount}
            unpaidFinanceCount={unpaidFinanceCount}
          />
        )}
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{ name: cashierName, role: isAdmin ? 'Admin' : 'Cashier', branch: selectedBranch }}
          isDark={isDark}
          onOpenSettings={() => setSettingsOpen(true)}
          onToggleTheme={onToggleTheme}
          onLogout={onLogout}
          isAdmin={isAdmin}
          settingsOnly={settingsOnly}
          onBranchChange={onBranchChange}
        />
      </SidebarFooter>
      <Dialog open={isSettingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="h-[min(46rem,calc(100dvh-3rem))] max-h-[calc(100dvh-3rem)] flex flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
          <DialogHeader className="shrink-0 px-5 py-4 pr-14">
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription className="text-xs">
              Choose how this workstation looks and how your team operates.
            </DialogDescription>
          </DialogHeader>
          <Separator />
          <Tabs
            orientation="vertical"
            value={settingsSection}
            onValueChange={setSettingsSection}
            className="min-h-0 flex-1 gap-0"
          >
            {isAdmin && (
              <TabsList
                variant="line"
                className="h-full w-44 shrink-0 items-stretch gap-1 rounded-none border-r bg-workspace-subtle px-3 py-4"
              >
                <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">Settings</p>
                <TabsTrigger value="workspace" className="h-auto flex-none px-3 py-2.5 text-left">
                  <MonitorCogIcon data-icon="inline-start" />
                  Workspace
                </TabsTrigger>
                {isAdmin && (
                  <TabsTrigger
                    value="administration"
                    className="h-auto flex-none px-3 py-2.5 text-left"
                  >
                    <ShieldCheckIcon data-icon="inline-start" />
                    Administration
                  </TabsTrigger>
                )}
              </TabsList>
            )}
            <TabsContent value="workspace" className="min-h-0 overflow-y-auto px-6 py-5">
              <section className="flex max-w-2xl flex-col gap-6">
                <div className="flex max-w-xl flex-col gap-1.5">
                  <p className="text-sm font-medium">Workspace appearance</p>
                  <p className="text-sm text-muted-foreground">
                    Personal preferences apply only to this workstation.
                  </p>
                </div>
                <Field orientation="horizontal" className="rounded-md border p-3">
                  <Checkbox
                    checked={hidePesoSignDraft}
                    onCheckedChange={(checked) => setHidePesoSignDraft(checked === true)}
                    aria-label="Hide peso sign"
                  />
                  <FieldContent>
                    <FieldLabel>Hide Peso Sign</FieldLabel>
                    <FieldDescription className="text-xs">
                      Hide the ₱ symbol from monetary values across the workspace.
                    </FieldDescription>
                  </FieldContent>
                </Field>
              </section>
            </TabsContent>
            {isAdmin && (
              <TabsContent value="administration" className="min-h-0 overflow-y-auto px-6 py-5">
                {settingsSection === 'administration' && (
                  <div className="flex max-w-4xl flex-col gap-6">
                    <section className="flex max-w-2xl flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">Operational configuration</p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Changes take effect immediately for future reports and accounts. Retired
                        values stay on existing records.
                      </p>
                    </section>
                    <ReceiptNamesSettings />
                    <CatalogOptionsSettings />
                    <InstallmentRulesSettings />
                    <CashierLoginBranchSettings />
                    <PortableDatabaseSettings />
                  </div>
                )}
              </TabsContent>
            )}
          </Tabs>
          <Separator />
          <DialogFooter className="mx-0 mb-0 shrink-0 bg-workspace-subtle px-5 py-3">
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
