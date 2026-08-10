import * as React from 'react'
import { format } from 'date-fns'
import { useReactTable, getCoreRowModel, type ColumnDef } from '@tanstack/react-table'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis
} from 'recharts'
import {
  ArrowUpRight,
  Banknote,
  CalendarDays,
  CircleAlert,
  HandCoins,
  Landmark,
  ReceiptText,
  RefreshCw,
  TrendingUp,
  WalletCards
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { UniversalDataTable } from '@/components/shared/data-table/universal-data-table'
import { AccountBranchBadge } from '@/features/in-house-accounts/components/account-badges'
import { formatCentavos } from '@/lib/currency'
import type { DashboardOverview, LoginBranch } from '@/../../shared/contracts'

type Props = {
  selectedBranch: LoginBranch
  onOpenCashierReports: () => void
  onOpenInHouse: () => void
  onOpenFinance: () => void
  onOpenPaymentWorkspace: (accountId: string) => void
}

type OverdueRow = DashboardOverview['overdueAccounts'][number]
type TrendPoint = DashboardOverview['collectionTrend'][number]

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
    <div className="min-w-48 rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg">
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        {format(new Date(`${label}T00:00:00`), 'EEEE, MMMM d')}
      </p>
      <div className="flex flex-col gap-1.5 text-xs">
        <span className="flex justify-between gap-4">
          Sales <strong className="font-mono tabular-nums">{money(point.salesCentavos)}</strong>
        </span>
        <span className="flex justify-between gap-4 text-muted-foreground">
          In-house
          <strong className="font-mono font-medium tabular-nums">
            {money(point.inHouseCollectionsCentavos)}
          </strong>
        </span>
        <span className="flex justify-between gap-4 text-muted-foreground">
          Finance
          <strong className="font-mono font-medium tabular-nums">
            {money(point.financeCollectionsCentavos)}
          </strong>
        </span>
      </div>
    </div>
  )
}

function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
  actionLabel,
  onOpen,
  attention = false
}: {
  title: string
  value: string
  detail: string
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  actionLabel: string
  onOpen: () => void
  attention?: boolean
}): React.JSX.Element {
  return (
    <Card size="sm" className="animate-in fade-in slide-in-from-bottom-1 duration-300">
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-xl font-semibold tabular-nums">{value}</CardTitle>
        <CardAction>
          <span className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Icon aria-hidden className="size-4" />
          </span>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className={attention ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
          {detail}
        </p>
      </CardContent>
      <CardFooter>
        <Button variant="ghost" size="xs" onClick={onOpen}>
          {actionLabel}
          <ArrowUpRight data-icon="inline-end" />
        </Button>
      </CardFooter>
    </Card>
  )
}

function DashboardLoading(): React.JSX.Element {
  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-3 w-64" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-38" />
        ))}
      </div>
      <Skeleton className="min-h-80 flex-1" />
    </main>
  )
}

export function DashboardContent({
  selectedBranch,
  onOpenCashierReports,
  onOpenInHouse,
  onOpenFinance,
  onOpenPaymentWorkspace
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
        if (requestVersion !== requestVersionRef.current) return
        setOverview(next)
      } catch (caught) {
        if (requestVersion !== requestVersionRef.current) return
        setError(errorMessage(caught))
      } finally {
        if (requestVersion === requestVersionRef.current) setIsLoading(false)
      }
    },
    [businessDate, rangeDays, selectedBranch]
  )

  React.useEffect(() => {
    void load()
  }, [load])

  const overdueColumns = React.useMemo<ColumnDef<OverdueRow>[]>(
    () => [
      {
        accessorKey: 'accountName',
        header: 'Account',
        cell: ({ row }) => <span className="font-medium">{row.original.accountName}</span>
      },
      {
        accessorKey: 'branch',
        header: 'Branch',
        cell: ({ row }) => <AccountBranchBadge branch={row.original.branch} />,
        size: 92
      },
      { accessorKey: 'dueDate', header: 'Oldest due', size: 116 },
      {
        accessorKey: 'delayedDays',
        header: 'Delayed',
        cell: ({ row }) => (
          <span className="text-destructive">{row.original.delayedDays} days</span>
        ),
        size: 96
      },
      {
        accessorKey: 'outstandingCentavos',
        header: 'Outstanding',
        cell: ({ row }) => (
          <span className="block text-right font-medium tabular-nums">
            {money(row.original.outstandingCentavos)}
          </span>
        ),
        size: 136,
        meta: { cellClassName: 'text-right' }
      }
    ],
    []
  )
  const overdueTable = useReactTable({
    data: overview?.overdueAccounts ?? [],
    columns: overdueColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.accountId
  })

  if (isLoading && !overview) return <DashboardLoading />
  if (error && !overview) {
    return (
      <main className="flex min-h-0 flex-1 items-center justify-center p-6">
        <Card size="sm" className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Dashboard unavailable</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Retry
            </Button>
          </CardFooter>
        </Card>
      </main>
    )
  }

  const variance = overview?.cashVarianceCentavos ?? 0
  const hasVariance = variance !== 0
  const pendingReconciliations =
    (overview?.cashierReportCount ?? 0) - (overview?.reconciledReportCount ?? 0)
  const totalCollections =
    (overview?.inHouseCollectionsCentavos ?? 0) + (overview?.financeCollectionsCentavos ?? 0)
  const previousSales = overview?.collectionTrend.at(-2)?.salesCentavos ?? 0
  const salesChange = previousSales
    ? (((overview?.salesCentavos ?? 0) - previousSales) / previousSales) * 100
    : undefined

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Dashboard · {overview?.scopeLabel ?? `${selectedBranch} Branch`}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Daily sales overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sales performance, collections, and reconciliation exceptions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            aria-label="Business date"
            className="w-38"
            type="date"
            value={businessDate}
            onChange={(event) => setBusinessDate(event.target.value)}
          />
          <Button variant="outline" size="sm" onClick={() => void load(true)} disabled={isLoading}>
            <RefreshCw
              data-icon="inline-start"
              className={isLoading ? 'animate-spin' : undefined}
            />
            {isLoading ? 'Refreshing' : 'Refresh'}
          </Button>
        </div>
      </header>

      {error && (
        <Card size="sm" className="ring-destructive/30">
          <CardContent className="flex items-center justify-between gap-3 text-destructive">
            <span className="flex items-center gap-2">
              <CircleAlert aria-hidden className="size-4" />
              {error}
            </span>
            <Button variant="outline" size="xs" onClick={() => void load(true)}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Daily summary">
        <MetricCard
          title="Recorded sales"
          value={money(overview?.salesCentavos ?? 0)}
          detail={
            salesChange === undefined
              ? 'No prior-day comparison available'
              : `${salesChange >= 0 ? '+' : ''}${salesChange.toFixed(1)}% from previous day`
          }
          icon={TrendingUp}
          actionLabel="Open cashier reports"
          onOpen={onOpenCashierReports}
        />
        <MetricCard
          title="Collections"
          value={money(totalCollections)}
          detail={`${money(overview?.inHouseCollectionsCentavos ?? 0)} in-house · ${money(overview?.financeCollectionsCentavos ?? 0)} finance`}
          icon={HandCoins}
          actionLabel="Open in-house"
          onOpen={onOpenInHouse}
        />
        <MetricCard
          title="Cash variance"
          value={pendingReconciliations > 0 ? `${pendingReconciliations} pending` : money(variance)}
          detail={
            pendingReconciliations > 0
              ? `${pendingReconciliations} cash count${pendingReconciliations === 1 ? '' : 's'} pending`
              : hasVariance
                ? 'Variance requires review'
                : 'Cash is balanced'
          }
          icon={Banknote}
          actionLabel="Review reconciliation"
          onOpen={onOpenCashierReports}
          attention={pendingReconciliations > 0 || hasVariance}
        />
        <MetricCard
          title="Report completion"
          value={`${overview?.reconciledReportCount ?? 0} / ${overview?.cashierReportCount ?? 0}`}
          detail={
            pendingReconciliations > 0
              ? 'Reports still require cash counts'
              : 'All reports reconciled'
          }
          icon={ReceiptText}
          actionLabel="Open reports"
          onOpen={onOpenCashierReports}
          attention={pendingReconciliations > 0}
        />
      </section>

      <section className="grid min-h-80 gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <Card className="min-w-0">
          <CardHeader className="border-b">
            <CardDescription>Performance trend</CardDescription>
            <CardTitle>Recorded sales</CardTitle>
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
          <CardContent className="h-72 pt-5">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={overview?.collectionTrend ?? []} margin={{ left: 4, right: 8 }}>
                <defs>
                  <linearGradient id="sales-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.24} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="businessDate"
                  tickFormatter={shortDate}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={28}
                />
                <YAxis tickFormatter={compactMoney} tickLine={false} axisLine={false} width={68} />
                <ChartTooltip content={<TrendTooltip />} cursor={{ stroke: 'var(--border)' }} />
                <Area
                  type="monotone"
                  dataKey="salesCentavos"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fill="url(#sales-fill)"
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Today at a glance</CardDescription>
            <CardTitle>Cash position</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1 border-b pb-3">
              <span className="text-xs text-muted-foreground">Physical cash</span>
              <strong className="font-mono text-lg font-semibold tabular-nums">
                {money(overview?.physicalCashCentavos ?? 0)}
              </strong>
            </div>
            <div className="flex flex-col gap-1 pb-3">
              <span className="text-xs text-muted-foreground">Cash remitted</span>
              <strong className="font-mono text-lg font-semibold tabular-nums">
                {money(overview?.remittedCashCentavos ?? 0)}
              </strong>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Landmark aria-hidden className="size-4" /> Finance
              </span>
              <strong className="font-mono font-medium tabular-nums">
                {money(overview?.financeCollectionsCentavos ?? 0)}
              </strong>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <WalletCards aria-hidden className="size-4" /> In-house
              </span>
              <strong className="font-mono font-medium tabular-nums">
                {money(overview?.inHouseCollectionsCentavos ?? 0)}
              </strong>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" size="sm" onClick={onOpenFinance}>
              Open finance
              <ArrowUpRight data-icon="inline-end" />
            </Button>
          </CardFooter>
        </Card>
      </section>

      <section className="grid min-h-72 gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <Card className="flex min-h-0 flex-col">
          <CardHeader className="border-b">
            <CardDescription>Exception queue</CardDescription>
            <CardTitle className="flex items-center gap-2">
              Overdue in-house accounts
              <Badge variant={overview?.overdueCount ? 'destructive' : 'secondary'}>
                {overview?.overdueCount ?? 0}
              </Badge>
            </CardTitle>
            <CardAction>
              <Badge variant="secondary">{money(overview?.overdueBalanceCentavos ?? 0)}</Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 pt-0">
            <UniversalDataTable
              className="min-h-0"
              table={overdueTable}
              recordCount={overview?.overdueAccounts.length ?? 0}
              isLoading={isLoading}
              emptyMessage="No overdue accounts for this date."
              showPagination={false}
              onRowClick={(row) => onOpenPaymentWorkspace(row.accountId)}
              tableLayout={{ rowBorder: true, headerSticky: true }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Reconciliation</CardDescription>
            <CardTitle>Cash status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div
              className={
                hasVariance || pendingReconciliations > 0
                  ? 'rounded-lg bg-destructive/10 p-3 text-destructive'
                  : 'rounded-lg bg-muted p-3'
              }
            >
              <p className="text-xs font-medium uppercase tracking-wide">
                {pendingReconciliations > 0
                  ? 'Cash count pending'
                  : hasVariance
                    ? 'Needs review'
                    : 'Balanced'}
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {pendingReconciliations > 0 ? `${pendingReconciliations} pending` : money(variance)}
              </p>
            </div>
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <ReceiptText aria-hidden className="mt-0.5 size-4 shrink-0" />
              Consolidated from saved daily reports and cash counts.
            </div>
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <CalendarDays aria-hidden className="mt-0.5 size-4 shrink-0" />
              Business date: {businessDate}
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" size="sm" onClick={onOpenCashierReports}>
              Open cashier reports
              <ArrowUpRight data-icon="inline-end" />
            </Button>
          </CardFooter>
        </Card>
      </section>
    </main>
  )
}
