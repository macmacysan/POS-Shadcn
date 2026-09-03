import * as React from 'react'
import { format } from 'date-fns'

import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import type { AuthenticatedUser, DailyReportRecord } from '@/../../shared/contracts'

export type ActiveReportContextValue = DailyReportRecord & { reportId: string }

const ActiveReportContext = React.createContext<ActiveReportContextValue | null | undefined>(undefined)

export function ActiveReportProvider({
  user,
  children
}: React.PropsWithChildren<{ user: AuthenticatedUser }>): React.JSX.Element {
  const [report, setReport] = React.useState<ActiveReportContextValue | null>(null)
  const [error, setError] = React.useState(false)
  const [loaded, setLoaded] = React.useState(user.role === 'ADMIN')
  const [reloadKey, setReloadKey] = React.useState(0)

  React.useEffect(() => {
    if (user.role === 'ADMIN') return
    let active = true
    setError(false)
    setReport(null)
    setLoaded(false)
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
          setLoaded(true)
        },
        () => {
          if (active) setError(true)
        }
      )
    return () => {
      active = false
    }
  }, [reloadKey, user.branchId, user.id, user.role])

  if (error) {
    return (
      <main className="flex h-full items-center justify-center p-6">
        <Empty className="max-w-md border-0">
          <EmptyHeader>
            <EmptyTitle>Daily report unavailable</EmptyTitle>
            <EmptyDescription>
              The active daily report could not be loaded. Check your connection and try again.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button type="button" variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
              Retry
            </Button>
          </EmptyContent>
        </Empty>
      </main>
    )
  }
  if (!loaded) {
    return (
      <main
        className="flex h-full items-center justify-center p-6"
        aria-busy="true"
        aria-label="Loading daily report"
      >
        <div className="flex w-full max-w-md flex-col gap-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-4/5" />
        </div>
      </main>
    )
  }

  return <ActiveReportContext.Provider value={report}>{children}</ActiveReportContext.Provider>
}

export function useActiveReport(): ActiveReportContextValue | null {
  const context = React.useContext(ActiveReportContext)
  if (context === undefined) throw new Error('Active report context is not available.')
  return context
}
