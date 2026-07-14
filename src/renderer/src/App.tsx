import { useState } from 'react'

import { LoginForm } from '@/components/login-form'
import { CashierReportsContent } from '@/components/cashier-reports-content'
import { SidebarLeft } from '@/components/sidebar-left'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'

function Workspace(): React.JSX.Element {
  const [activeView, setActiveView] = useState<'dashboard' | 'cashier-reports'>('dashboard')

  return (
    <SidebarProvider>
      <SidebarLeft onCashierReports={() => setActiveView('cashier-reports')} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Cashiers Report</span>
            <span className="text-xs text-muted-foreground">Daily workspace</span>
          </div>
        </header>
        {activeView === 'cashier-reports' ? (
          <CashierReportsContent />
        ) : (
          <main className="flex flex-1 flex-col gap-6 p-6">
          <div>
            <p className="text-sm text-muted-foreground">Today&apos;s overview</p>
            <h1 className="text-2xl font-semibold tracking-tight">Welcome to your workspace</h1>
          </div>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Report summary">
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

  if (isLoggedIn) return <Workspace />

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-muted/35 px-4 py-8 sm:px-6 lg:px-8">
      <LoginForm onSuccess={() => setIsLoggedIn(true)} />
    </main>
  )
}

export default App
