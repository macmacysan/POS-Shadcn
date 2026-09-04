import { CircleAlert, Copy, LoaderCircle, Minus, RefreshCw, Square, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { LoginForm } from '@/features/authentication'
import { CashierReportsContent } from '@/features/cashier-report'
import { InHouseActiveAccountsContent, InHouseAccountsContent } from '@/features/in-house-accounts'
import { FinanceAccountsContent } from '@/features/finance-accounts'
import { CalendarWorkspace } from '@/features/calendar'
import { AccountRecordsWorkspace } from '@/features/in-house-accounts/components/account-records-workspace'
import { InstallmentPaymentWorkspace } from '@/features/in-house-payments'
import { DashboardContent } from '@/features/dashboard'
import { InstallmentOverviewContent } from '@/features/installment-overview'
import { SidebarLeft } from '@/components/layout/sidebar-left'
import { NotificationCenter } from '@/components/layout/notification-center'
import { UpdateNotifications } from '@/components/layout/update-notifications'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@/components/ui/breadcrumb'
import { ActiveReportProvider } from '@/contexts/active-report-context'
import { NotificationProvider } from '@/contexts/notification-context'
import { useNotifications } from '@/hooks/use-notifications'
import { Toaster } from '@/components/ui/sonner'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import type {
  AuthenticatedUser,
  GoogleSyncProgress,
  InstallmentAttentionSummary,
  LoginBranch
} from '@/../../shared/contracts'
import { PESO_SIGN_HIDDEN_STORAGE_KEY, setPesoSignHidden } from '@/lib/currency'

const THEME_STORAGE_KEY = 'cashiers-report-theme'
type ActiveView =
  | 'dashboard'
  | 'installment-overview'
  | 'cashier-reports'
  | 'in-house-accounts'
  | 'in-house-active-accounts'
  | 'in-house-closed-accounts'
  | 'in-house-blacklisted-accounts'
  | 'finance-accounts'
  | 'calendar'

type PaymentOrigin = 'records' | 'active' | 'closed' | 'blacklisted' | 'cashier-history'
type PaymentRoute = {
  accountId: string
  initialTab: 'schedule' | 'ledger'
  initialPaymentId?: string
  openRecordPayment: boolean
  origin: PaymentOrigin
}

function googleSyncProgressKey(progress: Pick<GoogleSyncProgress, 'branch' | 'sheet'>): string {
  return `${progress.branch}:${progress.sheet}`
}

function paymentOriginView(origin: PaymentOrigin): ActiveView {
  if (origin === 'cashier-history') return 'cashier-reports'
  return `in-house-${origin === 'records' ? 'accounts' : `${origin}-accounts`}` as ActiveView
}

function paymentBackLabel(origin: PaymentOrigin): string {
  if (origin === 'cashier-history') return 'Back to Activity History'
  if (origin === 'active') return 'Back to Active Accounts'
  if (origin === 'closed') return 'Back to Closed Accounts'
  if (origin === 'blacklisted') return 'Back to Blacklisted Accounts'
  return 'Back to Records'
}

function activeViewLabel(view: ActiveView): string {
  if (view === 'cashier-reports') return 'Cashier reports'
  if (view === 'installment-overview') return 'Installments overview'
  if (view === 'in-house-accounts') return 'In-house records'
  if (view === 'in-house-active-accounts') return 'Active accounts'
  if (view === 'in-house-closed-accounts') return 'Closed accounts'
  if (view === 'in-house-blacklisted-accounts') return 'Blacklisted accounts'
  if (view === 'finance-accounts') return 'Finance accounts'
  if (view === 'calendar') return 'Calendar'
  return 'Dashboard'
}

function readPaymentRoute(): PaymentRoute | undefined {
  const [path, search = ''] = window.location.hash.slice(1).split('?')
  const match = path.match(/^\/installments\/in-house\/accounts\/(.*)\/payments$/)
  if (!match) return undefined
  let accountId = ''
  try {
    accountId = decodeURIComponent(match[1])
  } catch {
    return undefined
  }
  const parameters = new URLSearchParams(search)
  const origin = parameters.get('from')
  return {
    accountId,
    initialTab: parameters.get('tab') === 'ledger' ? 'ledger' : 'schedule',
    initialPaymentId: parameters.get('payment') || undefined,
    openRecordPayment: parameters.get('action') === 'record',
    origin:
      origin === 'records' ||
      origin === 'closed' ||
      origin === 'blacklisted' ||
      origin === 'cashier-history'
        ? origin
        : 'active'
  }
}

function Workspace({
  isDark,
  onToggleTheme,
  hidePesoSign,
  onHidePesoSignChange,
  onLogout,
  onBranchChange,
  selectedBranch,
  isAdmin,
  userId,
  cashierName,
  initialSyncFailures
}: {
  isDark: boolean
  onToggleTheme: () => void
  hidePesoSign: boolean
  onHidePesoSignChange: (value: boolean) => void
  onLogout: () => void
  onBranchChange: (branch: LoginBranch) => void
  selectedBranch: LoginBranch
  isAdmin: boolean
  userId: string
  cashierName: string
  initialSyncFailures: GoogleSyncProgress[]
}): React.JSX.Element {
  const { notify } = useNotifications()
  const initialPaymentRoute = readPaymentRoute()
  const [activeView, setActiveView] = useState<ActiveView>(
    initialPaymentRoute ? paymentOriginView(initialPaymentRoute.origin) : 'dashboard'
  )
  const [paymentRoute, setPaymentRoute] = useState<PaymentRoute | undefined>(initialPaymentRoute)
  const [installmentFilter, setInstallmentFilter] = useState<{
    branch?: 'Goa' | 'Tinambac' | 'Tigaon' | 'Lagonoy'
    search?: string
    paymentStatus?: 'overdue'
    financeAccountId?: string
    returnToHistory?: boolean
  }>({})
  const [cashierReportInitialTab, setCashierReportInitialTab] = useState<
    ('Expenses' | 'Income' | 'Payment' | 'Activity') | undefined
  >(initialPaymentRoute?.origin === 'cashier-history' ? 'Activity' : undefined)
  const [isCashierReportExportRequested, setIsCashierReportExportRequested] = useState(false)
  const [cashierReportExportDate, setCashierReportExportDate] = useState<string>()
  const [navigationCounts, setNavigationCounts] = useState<{
    overdue?: number
    installmentAttention?: InstallmentAttentionSummary
    unpaidFinance?: number
  }>({})
  const [attentionRefreshKey, setAttentionRefreshKey] = useState(0)
  const [syncFailures, setSyncFailures] = useState(initialSyncFailures)
  const [retryingBranch, setRetryingBranch] = useState<string>()

  useEffect(
    () =>
      window.api.googleSync.onProgress((progress) => {
        const key = googleSyncProgressKey(progress)
        if (progress.phase === 'failed') {
          setSyncFailures((current) => [
            ...current.filter((item) => googleSyncProgressKey(item) !== key),
            progress
          ])
          return
        }
        if (progress.phase === 'completed')
          setSyncFailures((current) =>
            current.filter((item) => googleSyncProgressKey(item) !== key)
          )
      }),
    []
  )

  const retryDownload = async (branch: GoogleSyncProgress['branch']): Promise<void> => {
    setRetryingBranch(branch)
    try {
      await window.api.googleSync.sync({ branch })
    } catch {
      setSyncFailures((current) => [
        ...current.filter((item) => item.branch !== branch),
        {
          branch,
          sheet: 'Branch download',
          phase: 'failed',
          completed: 0,
          total: 1,
          message: 'Could not retry this branch download.'
        }
      ])
    } finally {
      setRetryingBranch(undefined)
    }
  }

  useEffect(() => {
    const refreshAttention = (): void => setAttentionRefreshKey((value) => value + 1)
    window.addEventListener('installments:changed', refreshAttention)
    return () => window.removeEventListener('installments:changed', refreshAttention)
  }, [])

  useEffect(() => {
    let cancelled = false
    const loadNavigationCounts = async (): Promise<void> => {
      try {
        const [installmentAttention, financeAccounts] = await Promise.all([
          window.api.installments.getAttentionSummary({
            ...(selectedBranch === 'All Branch' ? {} : { branch: selectedBranch })
          }),
          window.api.financeAccounts.list({ search: '', includeVoided: false })
        ])
        if (cancelled) return
        setNavigationCounts({
          overdue: installmentAttention.overdueCount,
          installmentAttention,
          unpaidFinance: financeAccounts.rows.filter(
            (account) =>
              (selectedBranch === 'All Branch' || account.branch === selectedBranch) &&
              !account.paidDate?.trim()
          ).length
        })
      } catch {
        // Keep the last successful counts visible when data is unavailable.
      }
    }
    void loadNavigationCounts()
    return () => {
      cancelled = true
    }
  }, [activeView, attentionRefreshKey, selectedBranch])

  useEffect(() => {
    const syncRoute = (): void => {
      const route = readPaymentRoute()
      setPaymentRoute(route)
      if (route) setActiveView(paymentOriginView(route.origin))
    }
    window.addEventListener('hashchange', syncRoute)
    return () => window.removeEventListener('hashchange', syncRoute)
  }, [])

  useEffect(
    () =>
      window.api.auth.onAccountSyncCompleted((count) => {
        if (count < 0) {
          notify({
            type: 'error',
            title: 'Accounts could not be downloaded.',
            description: 'Check the Google Drive folder sharing settings and restart the app.'
          })
          return
        }
        notify({
          type: 'success',
          title: 'Accounts downloaded successfully.',
          description: `${count} account${count === 1 ? '' : 's'} synchronized from the configured source.`
        })
      }),
    [notify]
  )

  const openPaymentWorkspace = (
    accountId: string,
    initialTab: PaymentRoute['initialTab'],
    origin: PaymentOrigin,
    initialPaymentId?: string,
    openRecordPayment = false
  ): void => {
    const payment = initialPaymentId ? `&payment=${encodeURIComponent(initialPaymentId)}` : ''
    const action = openRecordPayment ? '&action=record' : ''
    window.location.hash = `/installments/in-house/accounts/${encodeURIComponent(accountId)}/payments?tab=${initialTab}&from=${origin}${payment}${action}`
  }

  const closePaymentWorkspace = (): void => {
    window.location.hash = ''
    setPaymentRoute(undefined)
    if (paymentRoute?.origin === 'cashier-history') setCashierReportInitialTab('Activity')
    setActiveView(paymentOriginView(paymentRoute?.origin ?? 'active'))
  }

  const selectView = (view: ActiveView): void => {
    if (paymentRoute) window.location.hash = ''
    setPaymentRoute(undefined)
    setCashierReportInitialTab(undefined)
    setIsCashierReportExportRequested(false)
    setCashierReportExportDate(undefined)
    setActiveView(view)
  }

  return (
    <SidebarProvider
      defaultOpen={false}
      className="sidebar-always-dark h-full min-h-0 overflow-hidden bg-sidebar"
    >
      <SidebarLeft
        isDark={isDark}
        activeView={activeView}
        cashierName={cashierName}
        selectedBranch={selectedBranch}
        onDashboard={() => selectView('dashboard')}
        onCashierReports={() => selectView('cashier-reports')}
        onAllAccounts={() => selectView('in-house-accounts')}
        onActiveAccounts={() => selectView('in-house-active-accounts')}
        onClosedAccounts={() => selectView('in-house-closed-accounts')}
        onBlacklistedAccounts={() => selectView('in-house-blacklisted-accounts')}
        onFinanceAccounts={() => selectView('finance-accounts')}
        onCalendar={() => selectView('calendar')}
        overdueCount={navigationCounts.overdue}
        unpaidFinanceCount={navigationCounts.unpaidFinance}
        onToggleTheme={onToggleTheme}
        hidePesoSign={hidePesoSign}
        onHidePesoSignChange={onHidePesoSignChange}
        onLogout={onLogout}
        onBranchChange={onBranchChange}
        isAdmin={isAdmin}
        settingsOnly={isAdmin}
        openSettingsOnMount={isAdmin}
      />
      <SidebarInset className="flex min-h-0 flex-col overflow-hidden">
        <div className="flex h-10 shrink-0 items-center gap-2 border-b bg-background px-2 pr-24">
          <SidebarTrigger />
          <span aria-hidden="true" className="h-4 w-px bg-border" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">Workspace</BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>{activeViewLabel(activeView)}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto mr-1">
            <NotificationCenter />
          </div>
        </div>
        {!isAdmin && syncFailures.length ? (
          <Alert variant="destructive" className="m-3 shrink-0">
            <CircleAlert aria-hidden="true" />
            <AlertTitle>Some branch data could not be downloaded.</AlertTitle>
            <AlertDescription>
              {syncFailures.map((failure) => `${failure.branch}: ${failure.sheet}`).join(', ')}. Cached data remains available.
            </AlertDescription>
            <AlertAction>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={Boolean(retryingBranch)}
                onClick={() => void retryDownload(syncFailures[0].branch)}
              >
                {retryingBranch ? (
                  <LoaderCircle data-icon="inline-start" className="animate-spin" />
                ) : (
                  <RefreshCw data-icon="inline-start" />
                )}
                Retry download
              </Button>
            </AlertAction>
          </Alert>
        ) : null}
        {isAdmin ? (
          <main className="flex flex-1 items-center justify-center bg-background p-6">
            <div className="max-w-md text-center">
              <h1 className="text-xl font-semibold">Settings</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Open Settings from your profile menu to manage application configuration.
              </p>
            </div>
          </main>
        ) : activeView === 'cashier-reports' ? (
          <CashierReportsContent
            selectedBranch={selectedBranch}
            cashierName={cashierName}
            isAdmin={isAdmin}
            initialTab={cashierReportInitialTab}
            openExportReports={isCashierReportExportRequested}
            exportDate={cashierReportExportDate}
            onExportReportsOpened={() => setIsCashierReportExportRequested(false)}
            onOpenCollection={(accountId) => openPaymentWorkspace(accountId, 'ledger', 'active')}
            onOpenHistoryPayment={(accountId, paymentId) =>
              openPaymentWorkspace(accountId, 'ledger', 'cashier-history', paymentId)
            }
            onOpenFinance={(financeAccountId, returnToHistory) => {
              setInstallmentFilter({ financeAccountId, returnToHistory })
              selectView('finance-accounts')
            }}
            installmentAttention={navigationCounts.installmentAttention}
            onViewOverdueInstallments={() => {
              setInstallmentFilter({
                branch: selectedBranch === 'All Branch' ? undefined : selectedBranch,
                paymentStatus: 'overdue'
              })
              selectView('in-house-active-accounts')
            }}
            onViewInstallmentAccounts={() => {
              setInstallmentFilter({
                branch: selectedBranch === 'All Branch' ? undefined : selectedBranch
              })
              selectView('in-house-active-accounts')
            }}
            onOpenInstallmentAccount={(accountId) =>
              openPaymentWorkspace(accountId, 'schedule', 'active')
            }
          />
        ) : activeView === 'installment-overview' ? (
          <InstallmentOverviewContent
            onOpenInHouse={(branch, search) => {
              setInstallmentFilter({ branch, search })
              selectView('in-house-active-accounts')
            }}
            onOpenFinance={(branch, search) => {
              setInstallmentFilter({ branch, search })
              selectView('finance-accounts')
            }}
          />
        ) : activeView === 'in-house-active-accounts' ? (
          <InHouseActiveAccountsContent
            initialBranch={installmentFilter.branch}
            initialSearch={installmentFilter.search}
            initialPaymentStatus={installmentFilter.paymentStatus}
            ownBranch={isAdmin || selectedBranch === 'All Branch' ? undefined : selectedBranch}
            onOpenPaymentWorkspace={openPaymentWorkspace}
          />
        ) : activeView === 'in-house-closed-accounts' ? (
          <AccountRecordsWorkspace
            view="closed"
            ownBranch={isAdmin || selectedBranch === 'All Branch' ? undefined : selectedBranch}
            onOpenPaymentWorkspace={openPaymentWorkspace}
          />
        ) : activeView === 'in-house-blacklisted-accounts' ? (
          <AccountRecordsWorkspace
            view="blacklisted"
            ownBranch={isAdmin || selectedBranch === 'All Branch' ? undefined : selectedBranch}
            showAllBranches
            onOpenPaymentWorkspace={openPaymentWorkspace}
          />
        ) : activeView === 'in-house-accounts' ? (
          <InHouseAccountsContent
            ownBranch={isAdmin || selectedBranch === 'All Branch' ? undefined : selectedBranch}
            showAllBranches
            onOpenPaymentWorkspace={openPaymentWorkspace}
          />
        ) : activeView === 'finance-accounts' ? (
          <FinanceAccountsContent
            selectedBranch={selectedBranch}
            initialSearch={installmentFilter.search}
            initialEditId={installmentFilter.financeAccountId}
            onReturnToHistory={
              installmentFilter.returnToHistory
                ? () => {
                    setInstallmentFilter({})
                    selectView('cashier-reports')
                    setCashierReportInitialTab('Activity')
                  }
                : undefined
            }
          />
        ) : activeView === 'calendar' ? (
          <CalendarWorkspace cashierName={cashierName} selectedBranch={selectedBranch} />
        ) : (
          <DashboardContent
            selectedBranch={selectedBranch}
            onOpenCashierReports={() => selectView('cashier-reports')}
            onOpenExportReports={(businessDate) => {
              setCashierReportExportDate(businessDate)
              setIsCashierReportExportRequested(true)
              setActiveView('cashier-reports')
            }}
            onOpenInHouse={() => selectView('in-house-active-accounts')}
            onOpenFinance={() => selectView('finance-accounts')}
            onOpenPaymentWorkspace={(accountId) =>
              openPaymentWorkspace(accountId, 'schedule', 'active')
            }
          />
        )}
        {paymentRoute && (
          <InstallmentPaymentWorkspace
            accountId={paymentRoute.accountId}
            userId={userId}
            initialTab={paymentRoute.initialTab}
            initialPaymentId={paymentRoute.initialPaymentId}
            openRecordPayment={paymentRoute.openRecordPayment}
            backLabel={paymentBackLabel(paymentRoute.origin)}
            onBack={closePaymentWorkspace}
            ownBranch={isAdmin ? undefined : selectedBranch}
          />
        )}
      </SidebarInset>
    </SidebarProvider>
  )
}

function App(): React.JSX.Element {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [authenticatedUser, setAuthenticatedUser] = useState<AuthenticatedUser>()
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'dark'
  })
  const [hidePesoSign, setHidePesoSign] = useState(
    () => localStorage.getItem(PESO_SIGN_HIDDEN_STORAGE_KEY) === 'true'
  )
  const [selectedBranch, setSelectedBranch] = useState<LoginBranch>('Lagonoy')
  const [isMaximized, setIsMaximized] = useState(false)
  const [syncFailures, setSyncFailures] = useState<GoogleSyncProgress[]>([])

  useEffect(() => {
    const controls = window.windowControls
    if (!controls) return
    const documentElement = document.documentElement
    const syncMaximized = (value: boolean): void => {
      setIsMaximized(value)
      documentElement.classList.toggle('window-maximized', value)
    }

    documentElement.classList.add('custom-window-chrome')
    void controls.isMaximized().then(syncMaximized)
    const unsubscribe = controls.onMaximizedChange(syncMaximized)
    return () => {
      unsubscribe()
      documentElement.classList.remove('custom-window-chrome', 'window-maximized')
    }
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light')
  }, [isDark])

  const toggleTheme = (): void => setIsDark((current) => !current)
  const changePesoSignVisibility = (hidden: boolean): void => {
    setPesoSignHidden(hidden)
    setHidePesoSign(hidden)
  }
  const logout = useCallback(async (): Promise<void> => {
    await window.api.auth.logout()
    window.location.hash = ''
    setAuthenticatedUser(undefined)
    setIsLoggedIn(false)
  }, [])

  const toggleMaximize = async (): Promise<void> => {
    const controls = window.windowControls
    if (!controls) return
    await controls.toggleMaximize()
    const value = await controls.isMaximized()
    setIsMaximized(value)
    document.documentElement.classList.toggle('window-maximized', value)
  }

  return (
    <NotificationProvider>
      <div className="app-window-surface relative flex h-full min-h-0 w-full flex-col bg-background text-foreground">
        <div
          aria-label="Window drag area"
          className="window-drag-region absolute inset-x-0 top-0 z-40 h-8"
          onDoubleClick={() => void toggleMaximize()}
        />
        {window.windowControls ? (
          <div className="window-no-drag absolute top-1 right-1 z-50 flex gap-1 p-1">
            <button
              aria-label="Minimize window"
              className="grid size-6 place-items-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => void window.windowControls?.minimize()}
              type="button"
            >
              <Minus aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
            </button>
            <button
              aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
              className="grid size-6 place-items-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => void toggleMaximize()}
              type="button"
            >
              {isMaximized ? (
                <Copy aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
              ) : (
                <Square aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
              )}
            </button>
            <button
              aria-label="Close window"
              className="grid size-6 place-items-center text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => void window.windowControls?.close()}
              type="button"
            >
              <X aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
            </button>
          </div>
        ) : null}
        <div className="relative min-h-0 flex-1">
          <Toaster theme={isDark ? 'dark' : 'light'} />
          <UpdateNotifications />
          {isLoggedIn && authenticatedUser ? (
            <ActiveReportProvider user={authenticatedUser}>
              <div className="h-full w-full">
                <Workspace
                  key={hidePesoSign ? 'peso-hidden' : 'peso-visible'}
                  isDark={isDark}
                  onToggleTheme={toggleTheme}
                  hidePesoSign={hidePesoSign}
                  onHidePesoSignChange={changePesoSignVisibility}
                  onLogout={() => void logout()}
                  onBranchChange={(branch) =>
                    void window.api.auth.switchBranch({ branch }).then((user) => {
                      setAuthenticatedUser(user)
                      setSelectedBranch(user.branch)
                    })
                  }
                  selectedBranch={selectedBranch}
                  isAdmin={authenticatedUser.role === 'ADMIN'}
                  userId={authenticatedUser.id}
                  cashierName={authenticatedUser.displayName}
                  initialSyncFailures={syncFailures}
                />
              </div>
            </ActiveReportProvider>
          ) : (
            <main className="relative flex h-full w-full items-center justify-center bg-background px-6 py-8">
              <LoginForm
                onSuccess={(user, failures) => {
                  setSelectedBranch(user.branch)
                  setAuthenticatedUser(user)
                  setSyncFailures(failures)
                  setIsLoggedIn(true)
                }}
              />
            </main>
          )}
        </div>
      </div>
    </NotificationProvider>
  )
}

export default App
