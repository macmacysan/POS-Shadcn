import { useEffect, useState } from 'react'

import { LoginForm } from '@/components/login-form'
import { CashierReportsContent } from '@/components/cashier-reports-content'
import { InHouseAccountsContent } from '@/components/in-house-accounts-content'
import { SidebarLeft } from '@/components/sidebar-left'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { ThemeToggle } from '@/components/theme-toggle'

const THEME_STORAGE_KEY = 'cashiers-report-theme'

function Workspace(): React.JSX.Element {
  const [activeView, setActiveView] = useState<
    'dashboard' | 'cashier-reports' | 'in-house-accounts'
  >('dashboard')

  return (
    <SidebarProvider className="h-svh min-h-0 overflow-hidden">
      <SidebarLeft
        onCashierReports={() => setActiveView('cashier-reports')}
        onAllAccounts={() => setActiveView('in-house-accounts')}
      />
      <SidebarInset className="flex min-h-0 flex-col overflow-hidden">
        <header
          className="flex h-11 shrink-0 items-center gap-2 border-b px-4"
          style={{ '--app-header-height': '2.75rem' } as React.CSSProperties}
        >
          <SidebarTrigger />
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Cashiers Report</span>
            <span className="text-xs text-muted-foreground">Daily workspace</span>
          </div>
        </header>
        {activeView === 'cashier-reports' ? (
          <CashierReportsContent />
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
                  <p className="mt-2 text-2xl font-semibold">—</p>
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
        <div className="absolute top-3 right-4 z-10">
          <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
        </div>
        <Workspace />
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
