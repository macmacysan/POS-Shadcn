import * as React from 'react'

import { developmentReportId, type ReportRecord } from '@/../../shared/contracts'

export type ActiveReportContextValue = ReportRecord

const ActiveReportContext = React.createContext<ActiveReportContextValue | undefined>(undefined)

export function DevelopmentActiveReportProvider({
  children
}: React.PropsWithChildren): React.JSX.Element {
  const [report, setReport] = React.useState<ReportRecord | null>(null)
  const [error, setError] = React.useState(false)

  React.useEffect(() => {
    let active = true
    void window.api.reports.getById(developmentReportId).then(
      (value) => {
        if (!active) return
        if (value) setReport(value)
        else setError(true)
      },
      () => {
        if (active) setError(true)
      }
    )
    return () => {
      active = false
    }
  }, [])

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
