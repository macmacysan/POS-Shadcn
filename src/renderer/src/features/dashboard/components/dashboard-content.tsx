import * as React from 'react'
import { addDays, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis
} from 'recharts'
import { ArrowUpRight, CircleAlert, FileDown, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { DatePickerInput } from '@/components/ui/date-picker-input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { formatCentavos } from '@/lib/currency'
import { cn } from '@/lib/utils'
import type { DashboardOverview, LoginBranch } from '@/../../shared/contracts'

type Props = {
  selectedBranch: LoginBranch
  onOpenCashierReports: () => void
  onOpenExportReports: (businessDate: string) => void
  onOpenInHouse: () => void
  onOpenFinance: () => void
  onOpenPaymentWorkspace: (accountId: string) => void
}

type TrendPoint = DashboardOverview['collectionTrend'][number]
type ReportCalendar = NonNullable<DashboardOverview['reportCalendar']>
type ReportCalendarDay = ReportCalendar['days'][number]

const money = formatCentavos
const today = (): string => format(new Date(), 'yyyy-MM-dd')

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') return message
  }
  return 'Dashboard data could not be loaded.'
}

function compactMoney(value: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(value / 100)
}

function shortDate(value: string): string {
  return format(new Date(`${value}T00:00:00`), 'MMM d')
}

function TrendTooltip({
  active,
  payload,
  label
}: {
  active?: boolean
  payload?: Array<{ payload: TrendPoint }>
  label?: string
}): React.JSX.Element | null {
  if (!active || !payload?.length || !label) return null
  const point = payload[0].payload
  return (
    <div className="min-w-48 rounded-md border bg-popover p-3 text-popover-foreground shadow-lg">
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        {format(new Date(`${label}T00:00:00`), 'EEEE, MMM d')}
      </p>
      <div className="space-y-1.5 text-xs">
        <p className="flex justify-between gap-4">
          Cashier sales <strong className="font-mono">{money(point.salesCentavos)}</strong>
        </p>
        <p className="flex justify-between gap-4">
          In-house <strong className="font-mono">{money(point.inHouseCollectionsCentavos)}</strong>
        </p>
        <p className="flex justify-between gap-4">
          Finance <strong className="font-mono">{money(point.financeCollectionsCentavos)}</strong>
        </p>
      </div>
    </div>
  )
}

function CashTooltip({
  active,
  payload,
  label
}: {
  active?: boolean
  payload?: Array<{ payload: { expected: number; physical: number } }>
  label?: string
}): React.JSX.Element | null {
  if (!active || !payload?.length || !label) return null
  const point = payload[0].payload
  return (
    <div className="rounded-md border bg-popover p-3 text-xs text-popover-foreground shadow-lg">
      <p className="mb-2 font-medium text-muted-foreground">{label}</p>
      <p className="flex justify-between gap-4">
        Expected <strong className="font-mono">{money(point.expected)}</strong>
      </p>
      <p className="mt-1 flex justify-between gap-4">
        Physical <strong className="font-mono">{money(point.physical)}</strong>
      </p>
    </div>
  )
}

function Metric({
  label,
  value,
  detail,
  actionLabel,
  onOpen,
  tone = 'default'
}: {
  label: string
  value: string
  detail: string
  actionLabel?: string
  onOpen?: () => void
  tone?: 'default' | 'warning' | 'destructive'
}): React.JSX.Element {
  const valueClass =
    tone === 'destructive'
      ? 'text-destructive'
      : tone === 'warning'
        ? 'text-warning-foreground'
        : 'text-foreground'
  return (
    <div className="group relative min-w-0 border-l border-border pl-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          'mt-1 font-mono text-xl font-semibold tracking-tight tabular-nums',
          valueClass
        )}
      >
        {value}
      </p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>
      {onOpen && actionLabel && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="absolute right-0 top-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                  aria-label={actionLabel}
                  onClick={onOpen}
                >
                  <ArrowUpRight />
                </Button>
              }
            />
            <TooltipContent>{actionLabel}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  )
}

function ReportCalendar({ calendar }: { calendar: ReportCalendar | null }): React.JSX.Element {
  if (!calendar)
    return (
      <Card className="flex min-h-0 flex-col">
        <CardHeader className="shrink-0 border-b px-4 py-3">
          <CardDescription>Cashier report health</CardDescription>
          <CardTitle className="text-base">Choose a branch</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 items-center p-4 text-sm leading-relaxed text-muted-foreground">
          Select one branch to view its monthly cashier report coverage, cash counts, and variances.
        </CardContent>
      </Card>
    )
  const month = new Date(`${calendar.month}-01T00:00:00`)
  const first = startOfWeek(startOfMonth(month))
  const last = endOfWeek(endOfMonth(month))
  const days = Array.from(
    { length: Math.round((last.getTime() - first.getTime()) / 86400000) + 1 },
    (_, index) => addDays(first, index)
  )
  const byDate = new Map(calendar.days.map((day) => [day.businessDate, day]))
  const dayClass = (day: ReportCalendarDay | undefined): string => {
    if (!day) return 'bg-muted/50 text-muted-foreground'
    if (day.cashVarianceCentavos !== 0) return 'bg-destructive/15 text-destructive'
    if (!day.hasCashCount) return 'bg-warning/15 text-warning-foreground'
    return 'bg-success/15 text-success-foreground'
  }
  return (
    <Card className="flex min-h-0 flex-col">
      <CardHeader className="shrink-0 border-b px-4 py-3">
        <CardDescription>Cashier report health</CardDescription>
        <CardTitle className="text-base">{format(month, 'MMMM yyyy')}</CardTitle>
        <CardAction>
          <span className="text-[10px] text-muted-foreground">
            green counted · amber pending · red variance
          </span>
        </CardAction>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 p-3">
        <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase text-muted-foreground">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, index) => (
            <span key={`${label}-${index}`}>{label}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((date) => {
            const key = format(date, 'yyyy-MM-dd')
            const report = byDate.get(key)
            const inMonth = date.getMonth() === month.getMonth()
            return (
              <TooltipProvider key={key}>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <span
                        tabIndex={report ? 0 : undefined}
                        className={cn(
                          'flex aspect-square items-center justify-center rounded-sm text-[11px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                          inMonth ? dayClass(report) : 'bg-transparent text-muted-foreground/35'
                        )}
                      >
                        {format(date, 'd')}
                      </span>
                    }
                  />
                  <TooltipContent>
                    {report ? (
                      <span className="space-y-1">
                        <span className="block font-medium">{format(date, 'MMMM d')}</span>
                        <span className="block">
                          {report.hasCashCount ? 'Cash count recorded' : 'Cash count pending'}
                        </span>
                        <span className="block">
                          Variance: {money(report.cashVarianceCentavos)}
                        </span>
                      </span>
                    ) : (
                      'No cashier report'
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function DashboardLoading(): React.JSX.Element {
  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-11 w-64" />
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(19rem,.9fr)_minmax(0,1.4fr)]">
        <Skeleton className="h-38" />
        <Skeleton className="h-38" />
      </div>
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(14rem,.85fr)_minmax(16rem,.9fr)]">
        <Skeleton className="h-full" />
        <Skeleton className="h-full" />
        <Skeleton className="h-full" />
      </div>
    </main>
  )
}

export function DashboardContent({
  selectedBranch,
  onOpenCashierReports,
  onOpenExportReports,
  onOpenInHouse,
  onOpenFinance
}: Props): React.JSX.Element {
  const [businessDate, setBusinessDate] = React.useState(today)
  const [rangeDays, setRangeDays] = React.useState<7 | 14 | 30>(14)
  const [overview, setOverview] = React.useState<DashboardOverview>()
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string>()
  const requestVersionRef = React.useRef(0)
  const load = React.useCallback(
    async (preserveOverview = false): Promise<void> => {
      const requestVersion = ++requestVersionRef.current
      setIsLoading(true)
      setError(undefined)
      if (!preserveOverview) setOverview(undefined)
      try {
        const next = await window.api.dashboard.get({
          businessDate,
          branch: selectedBranch === 'All Branch' ? undefined : selectedBranch,
          rangeDays
        })
        if (requestVersion === requestVersionRef.current) setOverview(next)
      } catch (caught) {
        if (requestVersion === requestVersionRef.current) setError(errorMessage(caught))
      } finally {
        if (requestVersion === requestVersionRef.current) setIsLoading(false)
      }
    },
    [businessDate, rangeDays, selectedBranch]
  )
  React.useEffect(() => {
    void Promise.resolve().then(() => load())
  }, [load])
  if (isLoading && !overview) return <DashboardLoading />
  if (error && !overview)
    return (
      <main className="flex min-h-0 flex-1 items-center justify-center p-6">
        <Card size="sm" className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Dashboard unavailable</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </main>
    )

  const variance = overview?.cashVarianceCentavos ?? 0
  const physicalCash = overview?.physicalCashCentavos ?? 0
  const expectedCash = physicalCash - variance
  const pendingReports = Math.max(
    0,
    (overview?.cashierReportCount ?? 0) - (overview?.reconciledReportCount ?? 0)
  )
  const calendarCashData = (overview?.reportCalendar?.days ?? []).map((day) => ({
    label: shortDate(day.businessDate),
    expected: day.expectedCashCentavos,
    physical: day.physicalCashCentavos
  }))

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {overview?.scopeLabel ?? `${selectedBranch} Branch`} · {businessDate}
          </p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">Cash position</h1>
        </div>
        <div className="flex items-center gap-2">
          <DatePickerInput
            aria-label="Business date"
            className="w-36"
            value={businessDate}
            onValueChange={setBusinessDate}
          />
          <Button variant="outline" size="sm" onClick={() => onOpenExportReports(businessDate)}>
            <FileDown data-icon="inline-start" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load(true)} disabled={isLoading}>
            <RefreshCw
              data-icon="inline-start"
              className={isLoading ? 'animate-spin' : undefined}
            />
            Refresh
          </Button>
        </div>
      </header>
      {error && (
        <div className="flex shrink-0 items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <span className="flex items-center gap-2">
            <CircleAlert aria-hidden className="size-4" />
            {error}
          </span>
          <Button variant="ghost" size="xs" onClick={() => void load(true)}>
            Retry
          </Button>
        </div>
      )}
      <section className="grid shrink-0 gap-4 lg:grid-cols-[minmax(19rem,.9fr)_minmax(0,1.4fr)]">
        <Card
          className={cn('border-l-4', variance === 0 ? 'border-l-success' : 'border-l-destructive')}
        >
          <CardHeader className="gap-1 px-5 py-4">
            <CardDescription>Physical cash counted</CardDescription>
            <CardTitle className="font-mono text-[clamp(2rem,4vw,3.5rem)] leading-none tracking-[-0.06em] tabular-nums">
              {money(physicalCash)}
            </CardTitle>
            <div className="mt-3 grid grid-cols-3 gap-3 border-t pt-3 text-xs">
              <div>
                <p className="text-muted-foreground">Expected</p>
                <p className="mt-1 font-mono font-medium tabular-nums">{money(expectedCash)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Remitted</p>
                <p className="mt-1 font-mono font-medium tabular-nums">
                  {money(overview?.remittedCashCentavos ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Variance</p>
                <p
                  className={cn(
                    'mt-1 font-mono font-medium tabular-nums',
                    variance === 0 ? 'text-success-foreground' : 'text-destructive'
                  )}
                >
                  {money(variance)}
                </p>
              </div>
            </div>
          </CardHeader>
        </Card>
        <div className="grid gap-x-4 gap-y-5 sm:grid-cols-3">
          <Metric
            label="Cashier sales"
            value={money(overview?.salesCentavos ?? 0)}
            detail={`${overview?.cashierReportCount ?? 0} report${overview?.cashierReportCount === 1 ? '' : 's'} today`}
            actionLabel="Open cashier reports"
            onOpen={onOpenCashierReports}
          />
          <Metric
            label="Reports counted"
            value={`${overview?.reconciledReportCount ?? 0}/${overview?.cashierReportCount ?? 0}`}
            detail={
              pendingReports
                ? `${pendingReports} cash count${pendingReports === 1 ? '' : 's'} pending`
                : 'All cash counts complete'
            }
            tone={pendingReports ? 'warning' : 'default'}
            actionLabel="Open cashier reports"
            onOpen={onOpenCashierReports}
          />
          <Metric
            label="In-house"
            value={money(overview?.inHouseCollectionsCentavos ?? 0)}
            detail={`${overview?.overdueCount ?? 0} accounts overdue`}
            actionLabel="Open in-house accounts"
            onOpen={onOpenInHouse}
          />
          <Metric
            label="Finance"
            value={money(overview?.financeCollectionsCentavos ?? 0)}
            detail="Downpayments received"
            actionLabel="Open finance accounts"
            onOpen={onOpenFinance}
          />
          <Metric
            label="Overdue balance"
            value={money(overview?.overdueBalanceCentavos ?? 0)}
            detail="Active in-house receivables"
            tone={(overview?.overdueCount ?? 0) > 0 ? 'destructive' : 'default'}
            actionLabel="Open in-house accounts"
            onOpen={onOpenInHouse}
          />
          <Metric
            label="Cash status"
            value={variance === 0 ? 'Balanced' : 'Review'}
            detail={
              variance === 0
                ? 'Physical count matches expected cash'
                : 'Cash difference requires review'
            }
            tone={variance === 0 ? 'default' : 'destructive'}
          />
        </div>
      </section>
      <section className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(14rem,.85fr)_minmax(16rem,.9fr)]">
        <Card className="flex min-h-0 min-w-0 flex-col">
          <CardHeader className="shrink-0 border-b px-4 py-3">
            <CardDescription>Sales performance</CardDescription>
            <CardTitle className="text-base">Cashier sales and collections</CardTitle>
            <CardAction className="flex items-center gap-1">
              {([7, 14, 30] as const).map((days) => (
                <Button
                  key={days}
                  size="xs"
                  variant={rangeDays === days ? 'secondary' : 'ghost'}
                  aria-pressed={rangeDays === days}
                  onClick={() => setRangeDays(days)}
                >
                  {days}D
                </Button>
              ))}
            </CardAction>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 p-3 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={overview?.collectionTrend ?? []}
                margin={{ top: 8, left: 0, right: 4, bottom: 0 }}
                accessibilityLayer
              >
                <defs>
                  <linearGradient id="dashboard-sales-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--info)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--info)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 4" />
                <XAxis
                  dataKey="businessDate"
                  tickFormatter={shortDate}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={28}
                />
                <YAxis tickFormatter={compactMoney} tickLine={false} axisLine={false} width={62} />
                <ChartTooltip
                  content={<TrendTooltip />}
                  cursor={{ stroke: 'var(--primary)', strokeDasharray: '4 4' }}
                />
                <Area
                  type="monotone"
                  dataKey="salesCentavos"
                  name="Cashier sales"
                  stroke="var(--info)"
                  strokeWidth={2.5}
                  fill="url(#dashboard-sales-fill)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--background)' }}
                />
                <Area
                  type="monotone"
                  dataKey="inHouseCollectionsCentavos"
                  name="In-house"
                  stroke="var(--warning)"
                  strokeWidth={1.75}
                  fill="none"
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="financeCollectionsCentavos"
                  name="Finance"
                  stroke="var(--success)"
                  strokeWidth={1.75}
                  fill="none"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="flex min-h-0 min-w-0 flex-col">
          <CardHeader className="shrink-0 border-b px-4 py-3">
            <CardDescription>Cash controls</CardDescription>
            <CardTitle className="text-base">Expected vs counted</CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 p-3 pt-2">
            {calendarCashData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={calendarCashData}
                  margin={{ top: 8, left: 0, right: 0, bottom: 0 }}
                  accessibilityLayer
                >
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 4" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={20} />
                  <YAxis
                    tickFormatter={compactMoney}
                    tickLine={false}
                    axisLine={false}
                    width={54}
                  />
                  <ChartTooltip content={<CashTooltip />} />
                  <Bar
                    dataKey="expected"
                    name="Expected"
                    fill="var(--chart-2)"
                    radius={[3, 3, 0, 0]}
                  />
                  <Bar
                    dataKey="physical"
                    name="Physical"
                    fill="var(--info)"
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center text-sm text-muted-foreground">
                Select a branch to compare monthly cash counts.
              </div>
            )}
          </CardContent>
        </Card>
        <ReportCalendar calendar={overview?.reportCalendar ?? null} />
      </section>
    </main>
  )
}
