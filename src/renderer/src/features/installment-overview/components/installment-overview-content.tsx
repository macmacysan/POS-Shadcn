import * as React from 'react'
import {
  addMonths,
  addYears,
  format,
  isValid,
  parseISO,
  startOfMonth,
  startOfYear,
  subDays
} from 'date-fns'
import { ArrowUpRight, CreditCard, RefreshCw, WalletCards } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle
} from '@/../../components/reui/frame'
import { AccountBranchBadge } from '@/features/in-house-accounts/components/account-badges'
import {
  useInstallmentData,
  type PersistedInstallmentRow
} from '@/features/in-house-accounts/installment-data'
import { financeProviderValues, type FinanceAccountRecord } from '@/../../shared/contracts'
import { branchNames, type BranchName } from '@/lib/in-house-accounts'

type Props = {
  readonly onOpenInHouse: (branch?: BranchName, search?: string) => void
  readonly onOpenFinance: (branch?: BranchName, search?: string) => void
}

type BranchSummary = {
  branch: BranchName
  inHouse: number
  finance: number
  overdue: number
  dueToday: number
  providers: Record<(typeof financeProviderValues)[number], number>
  frequencies: Record<'Weekly' | 'Bi-weekly' | 'Monthly', number>
}

const frequencyValues = ['Weekly', 'Bi-weekly', 'Monthly'] as const
const branchValue = (value: string): BranchName =>
  branchNames.find((branch) => branch.toLowerCase() === value.toLowerCase()) ?? 'Lagonoy'

function emptySummary(branch: BranchName): BranchSummary {
  return {
    branch,
    inHouse: 0,
    finance: 0,
    overdue: 0,
    dueToday: 0,
    providers: { 'Home Credit': 0, Salmon: 0, Skyro: 0 },
    frequencies: { Weekly: 0, 'Bi-weekly': 0, Monthly: 0 }
  }
}

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) return String(error.message)
  return 'Installment overview data could not be loaded.'
}

function BranchCard({
  summary,
  onOpenInHouse,
  onOpenFinance
}: {
  readonly summary: BranchSummary
  readonly onOpenInHouse: Props['onOpenInHouse']
  readonly onOpenFinance: Props['onOpenFinance']
}): React.JSX.Element {
  return (
    <Card size="sm" className="flex flex-col gap-0">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AccountBranchBadge branch={summary.branch} />
            {summary.branch}
          </CardTitle>
          <Badge variant={summary.overdue > 0 ? 'destructive' : 'secondary'}>
            {summary.overdue} overdue
          </Badge>
        </div>
        <CardDescription>Active installment portfolio</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-4">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            className="rounded-lg border bg-muted/30 p-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => onOpenInHouse(summary.branch)}
          >
            <p className="text-xs text-muted-foreground">In-house</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{summary.inHouse}</p>
            <p className="mt-1 text-xs text-muted-foreground">{summary.dueToday} due today</p>
          </button>
          <button
            type="button"
            className="rounded-lg border bg-muted/30 p-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => onOpenFinance(summary.branch)}
          >
            <p className="text-xs text-muted-foreground">Finance</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{summary.finance}</p>
            <p className="mt-1 text-xs text-muted-foreground">active accounts</p>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <div className="col-span-2 flex items-center gap-2 font-medium text-muted-foreground">
            <CreditCard aria-hidden className="size-3.5" /> Finance type
          </div>
          {financeProviderValues.map((provider) => (
            <button
              key={provider}
              type="button"
              className="flex items-center justify-between gap-2 rounded px-1 py-0.5 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => onOpenFinance(summary.branch, provider)}
            >
              <span className="truncate">{provider}</span>
              <span className="font-semibold tabular-nums">{summary.providers[provider]}</span>
            </button>
          ))}
          <div className="col-span-2 mt-2 flex items-center gap-2 font-medium text-muted-foreground">
            <WalletCards aria-hidden className="size-3.5" /> In-house frequency
          </div>
          {frequencyValues.map((frequency) => (
            <button
              key={frequency}
              type="button"
              className="flex items-center justify-between gap-2 rounded px-1 py-0.5 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => onOpenInHouse(summary.branch, frequency)}
            >
              <span>{frequency}</span>
              <span className="font-semibold tabular-nums">{summary.frequencies[frequency]}</span>
            </button>
          ))}
        </div>
        {summary.overdue > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenInHouse(summary.branch, 'overdue')}
          >
            Review overdue accounts
            <ArrowUpRight data-icon="inline-end" />
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function OverviewLoading(): React.JSX.Element {
  return (
    <main className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto p-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-52" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {branchNames.map((branch) => (
          <Skeleton key={branch} className="h-[29rem]" />
        ))}
      </div>
    </main>
  )
}

type TrendGranularity = 'day' | 'month' | 'year'
type TrendEvent = { readonly date: Date; readonly kind: 'in-house' | 'finance' }
type TrendPoint = {
  readonly date: Date
  readonly label: string
  readonly inHouse: number
  readonly finance: number
}

function buildTrendPoints(
  inHouseRows: readonly PersistedInstallmentRow[],
  financeRows: readonly FinanceAccountRecord[],
  granularity: TrendGranularity
): readonly TrendPoint[] {
  const events: TrendEvent[] = [
    ...inHouseRows.flatMap((row) => {
      const date = parseISO(row.loan.dateReleased)
      return isValid(date) ? [{ date, kind: 'in-house' as const }] : []
    }),
    ...financeRows.flatMap((account) => {
      const date = parseISO(account.dateReleased)
      return isValid(date) ? [{ date, kind: 'finance' as const }] : []
    })
  ]
  const latest =
    events.reduce<Date | undefined>(
      (current, event) => (!current || event.date > current ? event.date : current),
      undefined
    ) ?? new Date()
  const first =
    events.reduce<Date | undefined>(
      (current, event) => (!current || event.date < current ? event.date : current),
      undefined
    ) ?? latest
  const points: Date[] = []
  if (granularity === 'day') {
    const start = subDays(latest, 29)
    for (let index = 0; index < 30; index += 1)
      points.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + index))
  } else if (granularity === 'month') {
    const start = addMonths(startOfMonth(latest), -11)
    for (let index = 0; index < 12; index += 1) points.push(addMonths(start, index))
  } else {
    const start = startOfYear(first)
    for (let year = start.getFullYear(); year <= latest.getFullYear(); year += 1)
      points.push(addYears(start, year - start.getFullYear()))
  }
  const keyFor = (date: Date): string =>
    granularity === 'day'
      ? format(date, 'yyyy-MM-dd')
      : granularity === 'month'
        ? format(date, 'yyyy-MM')
        : format(date, 'yyyy')
  return points.map((date) => {
    const key = keyFor(date)
    const matching = events.filter((event) => keyFor(event.date) === key)
    return {
      date,
      label:
        granularity === 'day'
          ? format(date, 'MMM d')
          : granularity === 'month'
            ? format(date, 'MMM yy')
            : format(date, 'yyyy'),
      inHouse: matching.filter((event) => event.kind === 'in-house').length,
      finance: matching.filter((event) => event.kind === 'finance').length
    }
  })
}

function InstallmentTrendChart({
  inHouseRows,
  financeRows
}: {
  readonly inHouseRows: readonly PersistedInstallmentRow[]
  readonly financeRows: readonly FinanceAccountRecord[]
}): React.JSX.Element {
  const [granularity, setGranularity] = React.useState<TrendGranularity>('month')
  const points = React.useMemo(
    () => buildTrendPoints(inHouseRows, financeRows, granularity),
    [financeRows, granularity, inHouseRows]
  )
  const maxValue = Math.max(1, ...points.flatMap((point) => [point.inHouse, point.finance]))
  const chartWidth = 760
  const chartHeight = 260
  const padding = { top: 18, right: 18, bottom: 40, left: 38 }
  const plotWidth = chartWidth - padding.left - padding.right
  const plotHeight = chartHeight - padding.top - padding.bottom
  const xFor = (index: number): number =>
    padding.left + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth)
  const yFor = (value: number): number => padding.top + plotHeight - (value / maxValue) * plotHeight
  const linePoints = (kind: 'inHouse' | 'finance'): string =>
    points.map((point, index) => `${xFor(index)},${yFor(point[kind])}`).join(' ')
  const labelIndexes =
    points.length <= 8
      ? points.map((_, index) => index)
      : [0, Math.floor((points.length - 1) / 2), points.length - 1]
  const totalInHouse = points.reduce((total, point) => total + point.inHouse, 0)
  const totalFinance = points.reduce((total, point) => total + point.finance, 0)

  return (
    <Frame variant="inverse" spacing="sm" className="min-w-0">
      <FramePanel>
        <FrameHeader className="flex-row flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <FrameTitle>Installment accounts released</FrameTitle>
            <FrameDescription>Historical account volume across all branches.</FrameDescription>
          </div>
          <div
            className="flex items-center gap-1 rounded-md border bg-muted/40 p-1"
            aria-label="Chart period"
          >
            {(['day', 'month', 'year'] as const).map((option) => (
              <Button
                key={option}
                type="button"
                variant={granularity === option ? 'secondary' : 'ghost'}
                size="xs"
                onClick={() => setGranularity(option)}
              >
                {option === 'day' ? 'Daily' : option === 'month' ? 'Monthly' : 'Yearly'}
              </Button>
            ))}
          </div>
        </FrameHeader>
        <div className="flex flex-col gap-3 px-3 pb-3 sm:px-4 sm:pb-4">
          <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-3" aria-label="Chart legend">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-primary" /> In-house
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-foreground/40" /> Finance
              </span>
            </div>
            <span>{totalInHouse + totalFinance} releases in view</span>
          </div>
          <svg
            viewBox="0 0 760 260"
            className="h-auto w-full overflow-visible"
            role="img"
            aria-label="Line chart of installment accounts released over time"
          >
            {[0, Math.ceil(maxValue / 2), maxValue].map((tick) => (
              <g key={tick}>
                <line
                  x1={padding.left}
                  x2={chartWidth - padding.right}
                  y1={yFor(tick)}
                  y2={yFor(tick)}
                  className="stroke-border"
                  strokeDasharray="3 4"
                />
                <text
                  x={padding.left - 8}
                  y={yFor(tick) + 4}
                  textAnchor="end"
                  className="fill-muted-foreground text-[11px]"
                >
                  {tick}
                </text>
              </g>
            ))}
            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-primary"
              points={linePoints('inHouse')}
            />
            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-foreground/50"
              points={linePoints('finance')}
            />
            {points.map((point, index) => (
              <g key={point.label}>
                <circle
                  cx={xFor(index)}
                  cy={yFor(point.inHouse)}
                  r="4"
                  className="fill-primary stroke-background"
                  strokeWidth="2"
                >
                  <title>{`${point.label}: In-house ${point.inHouse}`}</title>
                </circle>
                <circle
                  cx={xFor(index)}
                  cy={yFor(point.finance)}
                  r="3.5"
                  className="fill-foreground/50 stroke-background"
                  strokeWidth="2"
                >
                  <title>{`${point.label}: Finance ${point.finance}`}</title>
                </circle>
              </g>
            ))}
            {labelIndexes.map((index) => (
              <text
                key={points[index].label}
                x={xFor(index)}
                y={248}
                textAnchor="middle"
                className="fill-muted-foreground text-[11px]"
              >
                {points[index].label}
              </text>
            ))}
          </svg>
          <div className="flex justify-end gap-4 border-t pt-3 text-xs text-muted-foreground">
            <span>
              In-house <strong className="font-semibold text-foreground">{totalInHouse}</strong>
            </span>
            <span>
              Finance <strong className="font-semibold text-foreground">{totalFinance}</strong>
            </span>
          </div>
        </div>
      </FramePanel>
    </Frame>
  )
}

function PortfolioSummary({
  summaries
}: {
  readonly summaries: readonly BranchSummary[]
}): React.JSX.Element {
  const inHouse = summaries.reduce((total, summary) => total + summary.inHouse, 0)
  const finance = summaries.reduce((total, summary) => total + summary.finance, 0)
  const overdue = summaries.reduce((total, summary) => total + summary.overdue, 0)
  return (
    <Frame spacing="sm" className="min-w-0">
      <FramePanel>
        <div className="grid grid-cols-2 divide-x divide-border sm:grid-cols-4">
          <div className="flex flex-col gap-1 px-3 py-2 first:pl-0 sm:px-4">
            <span className="text-xs text-muted-foreground">Active accounts</span>
            <span className="text-xl font-semibold tabular-nums">{inHouse + finance}</span>
          </div>
          <div className="flex flex-col gap-1 px-3 py-2 sm:px-4">
            <span className="text-xs text-muted-foreground">In-house</span>
            <span className="text-xl font-semibold tabular-nums">{inHouse}</span>
          </div>
          <div className="flex flex-col gap-1 border-t px-3 py-2 sm:border-t-0 sm:px-4">
            <span className="text-xs text-muted-foreground">Finance</span>
            <span className="text-xl font-semibold tabular-nums">{finance}</span>
          </div>
          <div className="flex flex-col gap-1 border-t px-3 py-2 sm:border-t-0 sm:px-4">
            <span className="text-xs text-muted-foreground">Needs attention</span>
            <span className="text-xl font-semibold tabular-nums text-destructive">{overdue}</span>
          </div>
        </div>
      </FramePanel>
    </Frame>
  )
}

export function InstallmentOverviewContent({
  onOpenInHouse,
  onOpenFinance
}: Props): React.JSX.Element {
  const {
    rows: inHouseRows,
    isLoading: inHouseLoading,
    error: inHouseError,
    reload: reloadInHouse
  } = useInstallmentData('active')
  const {
    rows: inHouseHistoryRows,
    isLoading: inHouseHistoryLoading,
    error: inHouseHistoryError,
    reload: reloadInHouseHistory
  } = useInstallmentData('records')
  const [financeRows, setFinanceRows] = React.useState<FinanceAccountRecord[]>([])
  const [financeLoading, setFinanceLoading] = React.useState(true)
  const [financeError, setFinanceError] = React.useState<string>()

  const loadFinance = React.useCallback(async (): Promise<void> => {
    setFinanceLoading(true)
    setFinanceError(undefined)
    try {
      const result = await window.api.financeAccounts.list({ search: '' })
      setFinanceRows(result.rows)
    } catch (error) {
      setFinanceError(errorMessage(error))
    } finally {
      setFinanceLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void loadFinance()
  }, [loadFinance])

  const summaries = React.useMemo(() => {
    const next = new Map<BranchName, BranchSummary>(
      branchNames.map((branch) => [branch, emptySummary(branch)])
    )
    inHouseRows.forEach((row) => {
      if (row.accountStatus !== 'ACTIVE' || row.contractStatus !== 'ACTIVE') return
      const summary = next.get(branchValue(row.account.branch))!
      summary.inHouse += 1
      if (row.meta.status === 'overdue' || row.meta.status === 'delayed') summary.overdue += 1
      if (row.meta.status === 'due-today') summary.dueToday += 1
      const frequency = row.loan.paymentFrequency
      summary.frequencies[frequency] += 1
    })
    financeRows.forEach((account) => {
      if (account.balanceCentavos <= 0) return
      const summary = next.get(account.branch)!
      summary.finance += 1
      summary.providers[account.provider] += 1
    })
    return Array.from(next.values())
  }, [financeRows, inHouseRows])

  const isLoading = inHouseLoading || inHouseHistoryLoading || financeLoading
  const error = inHouseError ?? inHouseHistoryError ?? financeError
  if (
    isLoading &&
    inHouseRows.length === 0 &&
    inHouseHistoryRows.length === 0 &&
    financeRows.length === 0
  )
    return <OverviewLoading />

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Installments · Overview</p>
          <h1 className="text-2xl font-semibold tracking-tight">Branch installment overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Active accounts, finance types, and in-house payment frequencies at a glance.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            reloadInHouse()
            reloadInHouseHistory()
            void loadFinance()
          }}
          disabled={isLoading}
        >
          <RefreshCw data-icon="inline-start" className={isLoading ? 'animate-spin' : undefined} />
          {isLoading ? 'Refreshing' : 'Refresh'}
        </Button>
      </header>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <PortfolioSummary summaries={summaries} />
      <InstallmentTrendChart inHouseRows={inHouseHistoryRows} financeRows={financeRows} />
      <section
        className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
        aria-label="Branch installment summaries"
      >
        {summaries.map((summary) => (
          <BranchCard
            key={summary.branch}
            summary={summary}
            onOpenInHouse={onOpenInHouse}
            onOpenFinance={onOpenFinance}
          />
        ))}
      </section>
    </main>
  )
}
