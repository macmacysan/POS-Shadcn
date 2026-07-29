import * as React from 'react'
import { format } from 'date-fns'
import { useReactTable, getCoreRowModel, type ColumnDef } from '@tanstack/react-table'
import {
  ArrowUpRight,
  Banknote,
  CalendarDays,
  CircleAlert,
  HandCoins,
  Landmark,
  ReceiptText,
  RefreshCw,
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
import type { DashboardOverview } from '@/../../shared/contracts'

type Props = {
  selectedBranch: 'Goa' | 'Tinambac' | 'Tigaon' | 'Lagonoy'
  onOpenCashierReports: () => void
  onOpenInHouse: () => void
  onOpenFinance: () => void
  onOpenPaymentWorkspace: (accountId: string) => void
}

type OverdueRow = DashboardOverview['overdueAccounts'][number]

const money = formatCentavos
const today = (): string => format(new Date(), 'yyyy-MM-dd')

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
      <CardFooter className="justify-between gap-2">
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
    <main className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto p-6">
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
      <Skeleton className="min-h-72 flex-1" />
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
  const [overview, setOverview] = React.useState<DashboardOverview>()
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string>()

  const load = React.useCallback(async (): Promise<void> => {
    setIsLoading(true)
    setError(undefined)
    try {
      setOverview(await window.api.dashboard.get({ businessDate, branch: selectedBranch }))
    } catch {
      setError('Dashboard data could not be loaded.')
    } finally {
      setIsLoading(false)
    }
  }, [businessDate, selectedBranch])

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

  const variance = overview?.cashVarianceCentavos ?? 0
  const hasVariance = variance !== 0
  const pendingReconciliations =
    (overview?.cashierReportCount ?? 0) - (overview?.reconciledReportCount ?? 0)
  return (
    <main className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Dashboard · {overview?.scopeLabel ?? `${selectedBranch} Branch`}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Daily report overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cash, collections, and accounts requiring attention.
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
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={isLoading}>
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
            <Button variant="outline" size="xs" onClick={() => void load()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      <section
        className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
        aria-label="Cash and collection summary"
      >
        <MetricCard
          title="Physical cash"
          value={money(overview?.physicalCashCentavos ?? 0)}
          detail={`${overview?.reconciledReportCount ?? 0} of ${overview?.cashierReportCount ?? 0} reports have saved cash counts`}
          icon={Banknote}
          actionLabel="Open reports"
          onOpen={onOpenCashierReports}
          attention={pendingReconciliations > 0}
        />
        <MetricCard
          title="Cash remitted"
          value={money(overview?.remittedCashCentavos ?? 0)}
          detail={
            pendingReconciliations > 0
              ? `${pendingReconciliations} cash count${pendingReconciliations === 1 ? '' : 's'} pending`
              : hasVariance
                ? `Variance: ${money(variance)}`
                : 'Cash is balanced'
          }
          icon={WalletCards}
          actionLabel="Review cash"
          onOpen={onOpenCashierReports}
          attention={pendingReconciliations > 0 || hasVariance}
        />
        <MetricCard
          title="In-house collections"
          value={money(overview?.inHouseCollectionsCentavos ?? 0)}
          detail="Posted payments for this business date"
          icon={HandCoins}
          actionLabel="Open in-house"
          onOpen={onOpenInHouse}
        />
        <MetricCard
          title="Finance collections"
          value={money(overview?.financeCollectionsCentavos ?? 0)}
          detail="Recorded finance downpayments"
          icon={Landmark}
          actionLabel="Open finance"
          onOpen={onOpenFinance}
        />
      </section>

      <section className="grid min-h-0 gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <Card className="min-h-0">
          <CardHeader className="border-b">
            <CardDescription>Attention queue</CardDescription>
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
              className="min-h-52"
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
        <Card className="animate-in fade-in slide-in-from-right-1 duration-300">
          <CardHeader>
            <CardDescription>Reconciliation</CardDescription>
            <CardTitle>Cash variance</CardTitle>
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
              Cash figures are consolidated from saved daily reports and cash counts.
            </div>
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <CalendarDays aria-hidden className="mt-0.5 size-4 shrink-0" />
              Business date: {businessDate}
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" size="sm" onClick={onOpenCashierReports}>
              Review cashier reports
              <ArrowUpRight data-icon="inline-end" />
            </Button>
          </CardFooter>
        </Card>
      </section>
    </main>
  )
}
