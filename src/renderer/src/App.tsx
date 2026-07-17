import { useEffect, useState } from 'react'

import { LoginForm } from '@/components/login-form'
import { CashierReportsContent } from '@/components/cashier-reports-content'
import { InHouseActiveAccountsContent } from '@/components/in-house-active-accounts-content'
import { InHouseAccountsContent } from '@/components/in-house-accounts-content'
import { SidebarLeft } from '@/components/sidebar-left'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { ThemeToggle } from '@/components/theme-toggle'
import { Badge } from '@/components/reui/badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@/components/ui/breadcrumb'

const THEME_STORAGE_KEY = 'cashiers-report-theme'
type ActiveView = 'dashboard' | 'cashier-reports' | 'in-house-accounts' | 'in-house-active-accounts'

const viewMeta: Record<
  ActiveView,
  { title: string; description: string; badge: string; breadcrumbs: string[] }
> = {
  dashboard: {
    title: 'Cashiers Report',
    description: 'Daily workspace',
    badge: 'Overview',
    breadcrumbs: ['Workspace', 'Dashboard']
  },
  'cashier-reports': {
    title: 'Cashier Reports',
    description: 'Expenses, income, payment, and installment activity',
    badge: 'Daily report',
    breadcrumbs: ['Workspace', 'Cashier Reports']
  },
  'in-house-accounts': {
    title: 'All Accounts',
    description: 'In-house installment customer accounts',
    badge: 'Finance',
    breadcrumbs: ['Finance', 'In-house', 'All Accounts']
  },
  'in-house-active-accounts': {
    title: 'Active Accounts',
    description: 'In-house installment loan monitoring',
    badge: 'Collections',
    breadcrumbs: ['Finance', 'In-house', 'Active Accounts']
  }
}

function Workspace({
  isDark,
  onToggleTheme
}: {
  isDark: boolean
  onToggleTheme: () => void
}): React.JSX.Element {
  const [activeView, setActiveView] = useState<ActiveView>('dashboard')
  const currentView = viewMeta[activeView]

  return (
    <SidebarProvider className="h-svh min-h-0 overflow-hidden">
      <SidebarLeft
        activeView={activeView}
        onDashboard={() => setActiveView('dashboard')}
        onCashierReports={() => setActiveView('cashier-reports')}
        onAllAccounts={() => setActiveView('in-house-accounts')}
        onActiveAccounts={() => setActiveView('in-house-active-accounts')}
      />
      <SidebarInset className="flex min-h-0 flex-col overflow-hidden">
        <header
          className="flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-4"
          style={{ '--app-header-height': '3.5rem' } as React.CSSProperties}
        >
          <SidebarTrigger />
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <Breadcrumb>
                <BreadcrumbList className="gap-1 text-xs">
                  {currentView.breadcrumbs.map((crumb, index) => {
                    const isLast = index === currentView.breadcrumbs.length - 1

                    return (
                      <BreadcrumbItem key={`${crumb}-${index}`} className="min-w-0">
                        {isLast ? (
                          <BreadcrumbPage className="truncate text-xs font-medium">
                            {crumb}
                          </BreadcrumbPage>
                        ) : (
                          <>
                            <span className="truncate text-muted-foreground">{crumb}</span>
                            <BreadcrumbSeparator />
                          </>
                        )}
                      </BreadcrumbItem>
                    )
                  })}
                </BreadcrumbList>
              </Breadcrumb>
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-semibold leading-none">
                  {currentView.title}
                </span>
                <span className="hidden truncate text-xs text-muted-foreground md:block">/</span>
                <span className="hidden truncate text-xs text-muted-foreground md:block">
                  {currentView.description}
                </span>
              </div>
            </div>
            <Badge variant="primary-light" size="sm" className="hidden shrink-0 sm:inline-flex">
              {currentView.badge}
            </Badge>
          </div>
          <ThemeToggle isDark={isDark} onToggle={onToggleTheme} />
        </header>
        {activeView === 'cashier-reports' ? (
          <CashierReportsContent />
        ) : activeView === 'in-house-active-accounts' ? (
          <InHouseActiveAccountsContent />
        ) : activeView === 'in-house-accounts' ? (
          <InHouseAccountsContent />
        ) : (
          <main className="flex flex-1 flex-col gap-6 p-6">
            <div>
              <p className="text-sm text-muted-foreground">Today&apos;s overview</p>
              <h1 className="text-2xl font-semibold tracking-tight">Welcome to your workspace</h1>
            </div>
            <section
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
              aria-label="Report summary"
            >
              {['Cashier reports', 'Receipts', 'Income', 'Expenses'].map((label) => (
                <div key={label} className="rounded-lg border bg-card p-4">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="mt-2 text-2xl font-semibold">-</p>
                </div>
              ))}
            </section>
          </main>
        )}
      </SidebarInset>
    </SidebarProvider>
  )
}

function App(): React.JSX.Element {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'dark'
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light')
  }, [isDark])

  const toggleTheme = (): void => setIsDark((current) => !current)

  if (isLoggedIn) {
    return (
      <div className="relative h-full w-full">
        <Workspace isDark={isDark} onToggleTheme={toggleTheme} />
      </div>
    )
  }

  return (
    <main className="relative flex min-h-screen w-full items-center justify-center bg-muted/35 px-4 py-8 sm:px-6 lg:px-8">
      <div className="absolute top-4 right-4">
        <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
      </div>
      <LoginForm onSuccess={() => setIsLoggedIn(true)} />
    </main>
  )
}

export default App
