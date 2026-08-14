import { Copy, Minus, Square, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { InitialAdminSetup, LoginForm } from '@/features/authentication'
import { CashierReportsContent } from '@/features/cashier-report'
import { InHouseActiveAccountsContent, InHouseAccountsContent } from '@/features/in-house-accounts'
import { FinanceAccountsContent } from '@/features/finance-accounts'
import { StatusAccountsContent } from '@/features/in-house-accounts/components/status-accounts-content'
import { InstallmentPaymentWorkspace } from '@/features/in-house-payments'
import { DashboardContent } from '@/features/dashboard'
import { InstallmentOverviewContent } from '@/features/installment-overview'
import { SidebarLeft } from '@/components/layout/sidebar-left'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { ActiveReportProvider } from '@/contexts/active-report-context'
import { NotificationProvider } from '@/contexts/notification-context'
import { Toaster } from '@/components/ui/sonner'
import type { AuthenticatedUser, LoginBranch } from '@/../../shared/contracts'
import {
  PESO_SIGN_HIDDEN_STORAGE_KEY,
  setPesoSignHidden
} from '@/lib/currency'

const THEME_STORAGE_KEY = 'cashiers-report-theme'
const SUMMARY_DARK_STORAGE_KEY = 'cashiers-report-summary-dark'
type ActiveView =
  | 'dashboard'
  | 'installment-overview'
  | 'cashier-reports'
  | 'in-house-accounts'
  | 'in-house-active-accounts'
  | 'in-house-closed-accounts'
  | 'in-house-blacklisted-accounts'
  | 'finance-accounts'

type PaymentOrigin = 'records' | 'active' | 'closed' | 'blacklisted'
type PaymentRoute = {
  accountId: string
  initialTab: 'schedule' | 'ledger'
  origin: PaymentOrigin
}

function paymentOriginView(origin: PaymentOrigin): ActiveView {
  return `in-house-${origin === 'records' ? 'accounts' : `${origin}-accounts`}` as ActiveView
}

function paymentBackLabel(origin: PaymentOrigin): string {
  if (origin === 'active') return 'Back to Active Accounts'
  if (origin === 'closed') return 'Back to Closed Accounts'
  if (origin === 'blacklisted') return 'Back to Blacklisted Accounts'
  return 'Back to Records'
}

function readPaymentRoute(): PaymentRoute | undefined {
  const [path, search = ''] = window.location.hash.slice(1).split('?')
  const match = path.match(/^\/installments\/in-house\/accounts\/(.*)\/payments$/)
  if (!match) return undefined
  let accountId = ''
  try {
    accountId = decodeURIComponent(match[1])
  } catch {}
  const parameters = new URLSearchParams(search)
  const origin = parameters.get('from')
  return {
    accountId,
    initialTab: parameters.get('tab') === 'ledger' ? 'ledger' : 'schedule',
    origin:
      origin === 'records' || origin === 'closed' || origin === 'blacklisted' ? origin : 'active'
  }
}

function Workspace({
  isDark,
  onToggleTheme,
  summaryAlwaysDark,
  onSummaryAlwaysDarkChange,
  hidePesoSign,
  onHidePesoSignChange,
  onLogout,
  selectedBranch,
  isAdmin,
  cashierName
}: {
  isDark: boolean
  onToggleTheme: () => void
  summaryAlwaysDark: boolean
  onSummaryAlwaysDarkChange: (value: boolean) => void
  hidePesoSign: boolean
  onHidePesoSignChange: (value: boolean) => void
  onLogout: () => void
  selectedBranch: LoginBranch
  isAdmin: boolean
  cashierName: string
}): React.JSX.Element {
  const initialPaymentRoute = readPaymentRoute()
  const [activeView, setActiveView] = useState<ActiveView>(
    initialPaymentRoute ? paymentOriginView(initialPaymentRoute.origin) : 'dashboard'
  )
  const [paymentRoute, setPaymentRoute] = useState<PaymentRoute | undefined>(initialPaymentRoute)
  const [installmentFilter, setInstallmentFilter] = useState<{
    branch?: 'Goa' | 'Tinambac' | 'Tigaon' | 'Lagonoy'
    search?: string
  }>({})
  const [navigationCounts, setNavigationCounts] = useState<{
    due?: number
    unpaidFinance?: number
  }>({})

  useEffect(() => {
    let cancelled = false
    const loadNavigationCounts = async (): Promise<void> => {
      try {
        const [installments, financeAccounts] = await Promise.all([
          window.api.installments.list({ view: 'active', search: '' }),
          window.api.financeAccounts.list({ search: '' })
        ])
        if (cancelled) return
        setNavigationCounts({
          due: installments.rows.filter(
            (row) =>
              (selectedBranch === 'All Branch' || row.account.branch === selectedBranch) &&
              (row.meta.status === 'overdue' ||
                row.meta.status === 'delayed' ||
                row.meta.status === 'due-today')
          ).length,
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
  }, [activeView, selectedBranch])

  useEffect(() => {
    const syncRoute = (): void => {
      const route = readPaymentRoute()
      setPaymentRoute(route)
      if (route) setActiveView(paymentOriginView(route.origin))
    }
    window.addEventListener('hashchange', syncRoute)
    return () => window.removeEventListener('hashchange', syncRoute)
  }, [])

  const openPaymentWorkspace = (
    accountId: string,
    initialTab: PaymentRoute['initialTab'],
    origin: PaymentOrigin
  ): void => {
    window.location.hash = `/installments/in-house/accounts/${encodeURIComponent(accountId)}/payments?tab=${initialTab}&from=${origin}`
  }

  const closePaymentWorkspace = (): void => {
    window.location.hash = ''
    setPaymentRoute(undefined)
    setActiveView(paymentOriginView(paymentRoute?.origin ?? 'active'))
  }

  const selectView = (view: ActiveView): void => {
    if (paymentRoute) window.location.hash = ''
    setPaymentRoute(undefined)
    setActiveView(view)
  }

  const openInstallmentOverview = (): void => {
    setInstallmentFilter({})
    selectView('installment-overview')
  }

  return (
    <SidebarProvider className="h-full min-h-0 overflow-hidden">
      <SidebarLeft
        activeView={activeView}
        isDark={isDark}
        onDashboard={() => selectView('dashboard')}
        onInstallmentOverview={openInstallmentOverview}
        onCashierReports={() => selectView('cashier-reports')}
        onAllAccounts={() => selectView('in-house-accounts')}
        onActiveAccounts={() => selectView('in-house-active-accounts')}
        onClosedAccounts={() => selectView('in-house-closed-accounts')}
        onBlacklistedAccounts={() => selectView('in-house-blacklisted-accounts')}
        onFinanceAccounts={() => selectView('finance-accounts')}
        dueCount={navigationCounts.due}
        unpaidFinanceCount={navigationCounts.unpaidFinance}
        onToggleTheme={onToggleTheme}
        summaryAlwaysDark={summaryAlwaysDark}
        onSummaryAlwaysDarkChange={onSummaryAlwaysDarkChange}
        hidePesoSign={hidePesoSign}
        onHidePesoSignChange={onHidePesoSignChange}
        onLogout={onLogout}
        isAdmin={isAdmin}
      />
      <SidebarInset className="flex min-h-0 flex-col overflow-hidden pt-8">
        {paymentRoute ? (
          <InstallmentPaymentWorkspace
            accountId={paymentRoute.accountId}
            initialTab={paymentRoute.initialTab}
            backLabel={paymentBackLabel(paymentRoute.origin)}
            onBack={closePaymentWorkspace}
          />
        ) : activeView === 'cashier-reports' ? (
          <CashierReportsContent
            summaryAlwaysDark={summaryAlwaysDark}
            selectedBranch={selectedBranch}
            cashierName={cashierName}
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
            initialBranch={
              installmentFilter.branch ??
              (selectedBranch === 'All Branch' ? undefined : selectedBranch)
            }
            initialSearch={installmentFilter.search}
            onOpenPaymentWorkspace={openPaymentWorkspace}
          />
        ) : activeView === 'in-house-closed-accounts' ? (
          <StatusAccountsContent view="closed" onOpenPaymentWorkspace={openPaymentWorkspace} />
        ) : activeView === 'in-house-blacklisted-accounts' ? (
          <StatusAccountsContent view="blacklisted" onOpenPaymentWorkspace={openPaymentWorkspace} />
        ) : activeView === 'in-house-accounts' ? (
          <InHouseAccountsContent onOpenPaymentWorkspace={openPaymentWorkspace} />
        ) : activeView === 'finance-accounts' ? (
          <FinanceAccountsContent
            selectedBranch={installmentFilter.branch ?? selectedBranch}
            initialSearch={installmentFilter.search}
          />
        ) : (
          <DashboardContent
            selectedBranch={selectedBranch}
            onOpenCashierReports={() => selectView('cashier-reports')}
            onOpenInHouse={() => selectView('in-house-active-accounts')}
            onOpenFinance={() => selectView('finance-accounts')}
            onOpenPaymentWorkspace={(accountId) =>
              openPaymentWorkspace(accountId, 'schedule', 'active')
            }
          />
        )}
      </SidebarInset>
    </SidebarProvider>
  )
}

function App(): React.JSX.Element {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [authenticatedUser, setAuthenticatedUser] = useState<AuthenticatedUser>()
  const [needsSetup, setNeedsSetup] = useState<boolean>()
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'dark'
  })
  const [summaryAlwaysDark, setSummaryAlwaysDark] = useState(() => {
    const stored = localStorage.getItem(SUMMARY_DARK_STORAGE_KEY)
    return stored === null || stored === 'true'
  })
  const [hidePesoSign, setHidePesoSign] = useState(
    () => localStorage.getItem(PESO_SIGN_HIDDEN_STORAGE_KEY) === 'true'
  )
  const [selectedBranch, setSelectedBranch] = useState<LoginBranch>('Lagonoy')
  const [isMaximized, setIsMaximized] = useState(false)

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

  useEffect(() => {
    localStorage.setItem(SUMMARY_DARK_STORAGE_KEY, String(summaryAlwaysDark))
  }, [summaryAlwaysDark])

  useEffect(() => { void window.api.auth.needsSetup().then(setNeedsSetup).catch(() => setNeedsSetup(false)) }, [])

  const toggleTheme = (): void => setIsDark((current) => !current)
  const changePesoSignVisibility = (hidden: boolean): void => {
    setPesoSignHidden(hidden)
    setHidePesoSign(hidden)
  }
  const logout = async (): Promise<void> => {
    await window.api.auth.logout()
    window.location.hash = ''
    setAuthenticatedUser(undefined)
    setIsLoggedIn(false)
  }

  return (
    <NotificationProvider>
      <div className="app-window-surface relative flex h-full min-h-0 w-full flex-col">
        <div
          aria-label="Window drag area"
          className="window-drag-region absolute inset-x-0 top-0 z-40 h-8"
          onDoubleClick={() => void window.windowControls?.toggleMaximize()}
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
              onClick={() => void window.windowControls?.toggleMaximize()}
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
          {isLoggedIn && authenticatedUser ? (
            <ActiveReportProvider user={authenticatedUser}>
              <div className="h-full w-full">
                <Workspace
                  key={hidePesoSign ? 'peso-hidden' : 'peso-visible'}
                  isDark={isDark}
                  onToggleTheme={toggleTheme}
                  summaryAlwaysDark={summaryAlwaysDark}
                  onSummaryAlwaysDarkChange={setSummaryAlwaysDark}
                  hidePesoSign={hidePesoSign}
                  onHidePesoSignChange={changePesoSignVisibility}
                  onLogout={() => void logout()}
                  selectedBranch={selectedBranch}
                  isAdmin={authenticatedUser.role === 'ADMIN'}
                  cashierName={authenticatedUser.displayName}
                />
              </div>
            </ActiveReportProvider>
          ) : needsSetup === undefined ? null : (
            <main className="flex h-full w-full items-center justify-center bg-background px-6 py-8">
              {needsSetup ? <InitialAdminSetup onSuccess={(user) => { setSelectedBranch('All Branch'); setAuthenticatedUser(user); setIsLoggedIn(true); setNeedsSetup(false) }} /> : <LoginForm
                onSuccess={(branch, user) => {
                  setSelectedBranch(branch)
                  setAuthenticatedUser(user)
                  setIsLoggedIn(true)
                }}
              />}
            </main>
          )}
        </div>
      </div>
    </NotificationProvider>
  )
}

export default App
