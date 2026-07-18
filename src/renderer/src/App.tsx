import { useEffect, useState } from 'react'

import { LoginForm } from '@/features/authentication'
import { CashierReportsContent } from '@/features/cashier-report'
import { InHouseActiveAccountsContent, InHouseAccountsContent } from '@/features/in-house-accounts'
import { SidebarLeft } from '@/components/layout/sidebar-left'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { ThemeToggle } from '@/components/shared/theme-toggle'

const THEME_STORAGE_KEY = 'cashiers-report-theme'
const SUMMARY_DARK_STORAGE_KEY = 'cashiers-report-summary-dark'
type ActiveView = 'dashboard' | 'cashier-reports' | 'in-house-accounts' | 'in-house-active-accounts'

function Workspace({
  isDark,
  onToggleTheme,
  summaryAlwaysDark,
  onSummaryAlwaysDarkChange
}: {
  isDark: boolean
  onToggleTheme: () => void
  summaryAlwaysDark: boolean
  onSummaryAlwaysDarkChange: (value: boolean) => void
}): React.JSX.Element {
  const [activeView, setActiveView] = useState<ActiveView>('dashboard')

  return (
    <SidebarProvider className="h-svh min-h-0 overflow-hidden">
      <SidebarLeft
        activeView={activeView}
        isDark={isDark}
        onDashboard={() => setActiveView('dashboard')}
        onCashierReports={() => setActiveView('cashier-reports')}
        onAllAccounts={() => setActiveView('in-house-accounts')}
        onActiveAccounts={() => setActiveView('in-house-active-accounts')}
        onToggleTheme={onToggleTheme}
        summaryAlwaysDark={summaryAlwaysDark}
        onSummaryAlwaysDarkChange={onSummaryAlwaysDarkChange}
      />
      <SidebarInset className="flex min-h-0 flex-col overflow-hidden">
        {activeView === 'cashier-reports' ? (
          <CashierReportsContent summaryAlwaysDark={summaryAlwaysDark} />
        ) : activeView === 'in-house-active-accounts' ? (
          <InHouseActiveAccountsContent />
        ) : activeView === 'in-house-accounts' ? (
          <InHouseAccountsContent />
        ) : (
          <main className="flex flex-1 flex-col gap-6 p-6">
            <div>
              <p className="text-sm text-muted-foreground">Branch Selected</p>
              <h1 className="text-2xl font-semibold tracking-tight">Lagonoy Branch</h1>
              <p className="mt-1 text-sm text-muted-foreground">Today&apos;s overview</p>
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
  const [summaryAlwaysDark, setSummaryAlwaysDark] = useState(() => {
    return localStorage.getItem(SUMMARY_DARK_STORAGE_KEY) === 'true'
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light')
  }, [isDark])

  useEffect(() => {
    localStorage.setItem(SUMMARY_DARK_STORAGE_KEY, String(summaryAlwaysDark))
  }, [summaryAlwaysDark])

  const toggleTheme = (): void => setIsDark((current) => !current)

  if (isLoggedIn) {
    return (
      <div className="relative h-full w-full">
        <Workspace
          isDark={isDark}
          onToggleTheme={toggleTheme}
          summaryAlwaysDark={summaryAlwaysDark}
          onSummaryAlwaysDarkChange={setSummaryAlwaysDark}
        />
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
