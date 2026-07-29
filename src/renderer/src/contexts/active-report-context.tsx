import * as React from 'react'
import { format } from 'date-fns'

import type { AuthenticatedUser, DailyReportRecord } from '@/../../shared/contracts'

export type ActiveReportContextValue = DailyReportRecord & { reportId: string }

const ActiveReportContext = React.createContext<ActiveReportContextValue | undefined>(undefined)

export function ActiveReportProvider({
  user,
  children
}: React.PropsWithChildren<{ user: AuthenticatedUser }>): React.JSX.Element {
  const [report, setReport] = React.useState<ActiveReportContextValue | null>(null)
  const [error, setError] = React.useState(false)

  React.useEffect(() => {
    let active = true
    void window.api.dailyReports
      .resolveActive({
        branchId: user.branchId,
        cashierUserId: user.id,
        businessDate: format(new Date(), 'yyyy-MM-dd')
      })
      .then(
      (value) => {
        if (!active) return
        if (value) setReport({ ...value, reportId: value.id })
        else setError(true)
      },
      () => {
        if (active) setError(true)
      }
    )
    return () => {
      active = false
    }
  }, [user.branchId, user.id])

  if (error) {
    return (
      <main className="flex h-full items-center justify-center p-6">
        Unable to load the active report.
      </main>
    )
  }
  if (!report) {
    return (
      <main className="flex h-full items-center justify-center p-6">Loading active report...</main>
    )
  }

  return <ActiveReportContext.Provider value={report}>{children}</ActiveReportContext.Provider>
}

export function useActiveReport(): ActiveReportContextValue {
  const context = React.useContext(ActiveReportContext)
  if (!context) throw new Error('Active report context is not available.')
  return context
}
