import * as React from 'react'
import { FileSearch, Search, SlidersHorizontal, X } from 'lucide-react'
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type SortingState
} from '@tanstack/react-table'
import { differenceInCalendarDays, format, parseISO, startOfToday } from 'date-fns'

import { AccountBranchBadge, AccountStatusBadge } from '@/components/in-house-account-badges'
import { InHouseAccountInspector } from '@/components/in-house-account-inspector'
import { DataGrid, DataGridContainer } from '@/components/reui/data-grid/data-grid'
import { DataGridColumnHeader } from '@/components/reui/data-grid/data-grid-column-header'
import { DataGridPagination } from '@/components/reui/data-grid/data-grid-pagination'
import { DataGridScrollArea } from '@/components/reui/data-grid/data-grid-scroll-area'
import { DataGridTableVirtual } from '@/components/reui/data-grid/data-grid-table-virtual'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from '@/components/ui/empty'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  buildAccountMonitoringMeta,
  createAccountHistoryIndex,
  type AccountMonitoringMeta,
  type AccountMonitoringStatus
} from '@/lib/in-house-account-monitoring'
import { accountStatusLabel, accountStatusRank } from '@/lib/in-house-account-display'
import {
  branchLabels,
  branchNames,
  formatAccountName,
  inHouseAccountsStorageKey,
  readInHouseAccounts,
  type BranchName,
  type InHouseAccount
} from '@/lib/in-house-accounts'
import { formatHistoryMoney, installmentHistoryData } from '@/lib/installment-history'
import { cn } from '@/lib/utils'

type DueDateFilter = 'all' | 'today' | 'tomorrow' | 'this-week' | 'overdue'
type ActivePaymentStatus = Extract<
  AccountMonitoringStatus,
  'active' | 'due-soon' | 'due-today' | 'delayed' | 'overdue'
>

type ActiveAccountRow = {
  readonly account: InHouseAccount
  readonly name: string
  readonly branch: BranchName
  readonly status: ActivePaymentStatus
  readonly nextDue?: string
  readonly nextDueSort?: number
  readonly lastPaymentSort?: number
  readonly meta: AccountMonitoringMeta
}

const tableMinWidthClass = 'min-w-192'
const sortStorageKey = `${inHouseAccountsStorageKey}-active-sort`
const paginationStorageKey = `${inHouseAccountsStorageKey}-active-pagination`
const defaultSorting: SortingState = [
  { id: 'status', desc: false },
  { id: 'nextDue', desc: false }
]
const defaultPagination: PaginationState = { pageIndex: 0, pageSize: 25 }
const activeStatuses: readonly ActivePaymentStatus[] = [
  'active',
  'due-soon',
  'due-today',
  'delayed',
  'overdue'
]
const branchFilterItems = [
  { label: 'All branches', value: 'all' },
  ...branchNames.map((branch) => ({ label: branchLabels[branch], value: branch }))
]
const statusFilterItems = [
  { label: 'All statuses', value: 'all' },
  ...activeStatuses.map((status) => ({ label: accountStatusLabel[status], value: status }))
]
const frequencyFilterItems = [
  { label: 'All frequencies', value: 'all' },
  { label: 'Weekly', value: 'Weekly' },
  { label: 'Bi-weekly', value: 'Bi-weekly' },
  { label: 'Monthly', value: 'Monthly' }
]
const dueDateFilterItems = [
  { label: 'All due dates', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'Tomorrow', value: 'tomorrow' },
  { label: 'Due this week', value: 'this-week' },
  { label: 'Overdue', value: 'overdue' }
]

function readJson<T>(key: string, fallback: T): T {
  const saved = localStorage.getItem(key)
  if (!saved) return fallback
  try {
    return JSON.parse(saved) as T
  } catch (error) {
    if (error instanceof SyntaxError) return fallback
    throw error
  }
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(false)

  React.useEffect(() => {
    const mediaQuery = window.matchMedia(query)
    const onChange = (): void => setMatches(mediaQuery.matches)
    mediaQuery.addEventListener('change', onChange)
    onChange()
    return () => mediaQuery.removeEventListener('change', onChange)
  }, [query])

  return matches
}

function relativeDate(value: string | undefined, includeTomorrow = false): string {
  if (!value) return '—'
  const date = parseISO(value)
  const days = differenceInCalendarDays(date, startOfToday())
  if (days === 0) return 'Today'
  if (days === -1) return 'Yesterday'
  if (includeTomorrow && days === 1) return 'Tomorrow'
  return format(date, 'MMM d')
}

function formatContractTerms(value: string | undefined): string {
  if (!value) return 'Terms not provided'
  return value
}

function daysUntilDue(nextDue: string | undefined): number | undefined {
  return nextDue ? differenceInCalendarDays(parseISO(nextDue), startOfToday()) : undefined
}

function paidTodayTotal(): number {
  const today = format(startOfToday(), 'yyyy-MM-dd')

  return installmentHistoryData
    .filter((record) => record.source === 'in-house' && record.action !== 'deleted')
    .reduce((total, record) => {
      const payment = record.details.payment
      return payment?.datePaid === today ? total + (payment.amountPaid ?? 0) : total
    }, 0)
}

const TruncatedText = React.memo(function TruncatedText({
  value,
  className
}: {
  readonly value: string
  readonly className?: string
}): React.JSX.Element {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={<span className={cn('block truncate', className)} />}>
          {value || '—'}
        </TooltipTrigger>
        <TooltipContent>{value || '—'}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
})

const AccountCell = React.memo(function AccountCell({
  name,
  accountId
}: {
  readonly name: string
  readonly accountId: string
}): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <TruncatedText value={name} className="font-semibold text-foreground" />
      <TruncatedText value={accountId} className="text-xs text-muted-foreground" />
    </div>
  )
})

const ContractCell = React.memo(function ContractCell({
  frequency,
  terms
}: {
  readonly frequency?: string
  readonly terms?: string
}): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <TruncatedText value={frequency ?? '—'} className="font-medium text-foreground" />
      <TruncatedText value={formatContractTerms(terms)} className="text-xs text-muted-foreground" />
    </div>
  )
})

const MoneyCell = React.memo(function MoneyCell({
  value,
  emphasize = false
}: {
  readonly value?: number
  readonly emphasize?: boolean
}): React.JSX.Element {
  return (
    <span
      className={cn(
        'block text-right tabular-nums',
        emphasize ? 'font-medium text-foreground' : 'text-muted-foreground',
        value !== undefined && value < 0 && 'text-destructive'
      )}
    >
      {formatHistoryMoney(value)}
    </span>
  )
})

function QuickFilterChip({
  active,
  children,
  onClick
}: {
  readonly active: boolean
  readonly children: React.ReactNode
  readonly onClick: () => void
}): React.JSX.Element {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      aria-pressed={active}
      onClick={onClick}
      className={cn('h-7 rounded-full px-2 text-xs', active && 'bg-muted text-foreground')}
    >
      {children}
    </Button>
  )
}

function FilterSelect<TValue extends string>({
  label,
  items,
  value,
  onValueChange
}: {
  readonly label: string
  readonly items: readonly { readonly label: string; readonly value: TValue }[]
  readonly value: TValue
  readonly onValueChange: (value: TValue) => void
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <Select
        items={items}
        value={value}
        onValueChange={(nextValue) => {
          if (nextValue) onValueChange(nextValue)
        }}
      >
        <SelectTrigger className="w-full" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}

function ActiveFilterChip({
  label,
  onRemove
}: {
  readonly label: string
  readonly onRemove: () => void
}): React.JSX.Element {
  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      className="max-w-full rounded-full"
      onClick={onRemove}
    >
      <span className="truncate">{label}</span>
      <X data-icon="inline-end" />
    </Button>
  )
}

export function InHouseActiveAccountsContent(): React.JSX.Element {
  const [accounts] = React.useState<readonly InHouseAccount[]>(readInHouseAccounts)
  const [selectedId, setSelectedId] = React.useState<string | undefined>(accounts[0]?.id)
  const [search, setSearch] = React.useState('')
  const [branch, setBranch] = React.useState<BranchName | 'all'>('all')
  const [paymentStatus, setPaymentStatus] = React.useState<ActivePaymentStatus | 'all'>('all')
  const [frequency, setFrequency] = React.useState('all')
  const [dueDate, setDueDate] = React.useState<DueDateFilter>('all')
  const [isFiltersOpen, setIsFiltersOpen] = React.useState(false)
  const [sorting, setSorting] = React.useState<SortingState>(() =>
    readJson(sortStorageKey, defaultSorting)
  )
  const [pagination, setPagination] = React.useState<PaginationState>(() =>
    readJson(paginationStorageKey, defaultPagination)
  )
  const isInspectorSheet = useMediaQuery('(max-width: 1099px)')
  const historyIndex = React.useMemo(createAccountHistoryIndex, [])
  const baseRows = React.useMemo<readonly ActiveAccountRow[]>(
    () =>
      accounts.flatMap((account) => {
        const meta = buildAccountMonitoringMeta(account.id, historyIndex)
        if (!activeStatuses.includes(meta.status as ActivePaymentStatus)) return []
        return [
          {
            account,
            name: formatAccountName(account),
            branch: account.branch,
            status: meta.status as ActivePaymentStatus,
            nextDue: meta.nextDue,
            nextDueSort: meta.nextDue ? parseISO(meta.nextDue).getTime() : undefined,
            lastPaymentSort: meta.lastPayment ? parseISO(meta.lastPayment).getTime() : undefined,
            meta
          }
        ]
      }),
    [accounts, historyIndex]
  )
  const filteredRows = React.useMemo(() => {
    const query = search.trim().toLowerCase()

    return baseRows.filter((row) => {
      const searchable = [
        row.name,
        row.account.id,
        ...row.account.contacts
          .filter((contact) => contact.kind === 'mobile')
          .map((contact) => contact.value)
      ]
        .join(' ')
        .toLowerCase()
      const dueInDays = daysUntilDue(row.nextDue)
      const matchesDueDate =
        dueDate === 'all' ||
        (dueDate === 'today' && dueInDays === 0) ||
        (dueDate === 'tomorrow' && dueInDays === 1) ||
        (dueDate === 'this-week' && dueInDays !== undefined && dueInDays >= 0 && dueInDays <= 7) ||
        (dueDate === 'overdue' && dueInDays !== undefined && dueInDays < 0)

      return (
        (!query || searchable.includes(query)) &&
        (branch === 'all' || row.branch === branch) &&
        (paymentStatus === 'all' || row.status === paymentStatus) &&
        (frequency === 'all' ||
          row.meta.paymentFrequency?.toLowerCase() === frequency.toLowerCase()) &&
        matchesDueDate
      )
    })
  }, [baseRows, branch, dueDate, frequency, paymentStatus, search])
  const selectedRow = baseRows.find((row) => row.account.id === selectedId)
  const activeAccountsCount = baseRows.length
  const dueTodayCount = baseRows.filter((row) => row.status === 'due-today').length
  const overdueCount = baseRows.filter((row) => row.status === 'overdue').length
  const todaysCollections = React.useMemo(paidTodayTotal, [])
  const activeFilters = React.useMemo(
    () =>
      [
        search.trim() && {
          key: 'search',
          label: `Search: ${search.trim()}`,
          onRemove: () => setSearch('')
        },
        branch !== 'all' && {
          key: 'branch',
          label: branchFilterItems.find((item) => item.value === branch)?.label ?? branch,
          onRemove: () => setBranch('all')
        },
        paymentStatus !== 'all' && {
          key: 'status',
          label:
            statusFilterItems.find((item) => item.value === paymentStatus)?.label ?? paymentStatus,
          onRemove: () => setPaymentStatus('all')
        },
        frequency !== 'all' && {
          key: 'frequency',
          label: frequencyFilterItems.find((item) => item.value === frequency)?.label ?? frequency,
          onRemove: () => setFrequency('all')
        },
        dueDate !== 'all' && {
          key: 'dueDate',
          label: dueDateFilterItems.find((item) => item.value === dueDate)?.label ?? dueDate,
          onRemove: () => setDueDate('all')
        }
      ].filter(Boolean) as readonly {
        readonly key: string
        readonly label: string
        readonly onRemove: () => void
      }[],
    [branch, dueDate, frequency, paymentStatus, search]
  )
  const hasActiveFilters = activeFilters.length > 0
  const columns = React.useMemo<ColumnDef<ActiveAccountRow>[]>(
    () => [
      {
        id: 'branch',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Branch" className="px-1 text-xs" />
        ),
        enableSorting: false,
        size: 58,
        meta: { headerTitle: 'Branch' },
        cell: ({ row }) => <AccountBranchBadge branch={row.original.branch} />
      },
      {
        id: 'account',
        accessorFn: (row) => row.name,
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Account" className="px-1 text-xs" />
        ),
        sortingFn: 'alphanumeric',
        size: 160,
        meta: { headerTitle: 'Account', cellClassName: 'min-w-0' },
        cell: ({ row }) => (
          <AccountCell name={row.original.name} accountId={row.original.account.id} />
        )
      },
      {
        id: 'contract',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Contract" className="px-1 text-xs" />
        ),
        enableSorting: false,
        size: 96,
        meta: { headerTitle: 'Contract', cellClassName: 'min-w-0' },
        cell: ({ row }) => (
          <ContractCell
            frequency={row.original.meta.paymentFrequency}
            terms={row.original.meta.terms}
          />
        )
      },
      {
        id: 'installment',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Installment" className="px-1 text-xs" />
        ),
        enableSorting: false,
        size: 88,
        meta: {
          headerTitle: 'Installment',
          headerClassName: 'text-right',
          cellClassName: 'text-right'
        },
        cell: ({ row }) => <MoneyCell value={row.original.meta.installmentAmount} />
      },
      {
        id: 'outstandingBalance',
        accessorFn: (row) => row.meta.outstandingBalance,
        header: ({ column }) => (
          <DataGridColumnHeader
            column={column}
            title="Outstanding Balance"
            className="px-1 text-xs"
          />
        ),
        sortingFn: 'basic',
        sortUndefined: 'last',
        size: 126,
        meta: {
          headerTitle: 'Outstanding Balance',
          headerClassName: 'text-right',
          cellClassName: 'text-right'
        },
        cell: ({ row }) => <MoneyCell value={row.original.meta.outstandingBalance} emphasize />
      },
      {
        id: 'status',
        accessorFn: (row) => accountStatusRank[row.status],
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Payment Status" className="px-1 text-xs" />
        ),
        sortingFn: 'basic',
        size: 108,
        meta: { headerTitle: 'Payment Status' },
        cell: ({ row }) => <AccountStatusBadge status={row.original.status} />
      },
      {
        id: 'nextDue',
        accessorFn: (row) => row.nextDueSort,
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Next Due" className="px-1 text-xs" />
        ),
        sortingFn: 'basic',
        sortUndefined: 'last',
        size: 76,
        meta: {
          headerTitle: 'Next Due',
          headerClassName: 'text-right',
          cellClassName: 'text-right'
        },
        cell: ({ row }) => (
          <span
            className={cn(
              'block text-right tabular-nums',
              row.original.status === 'overdue'
                ? 'font-medium text-destructive'
                : 'text-muted-foreground'
            )}
          >
            {relativeDate(row.original.nextDue, true)}
          </span>
        )
      },
      {
        id: 'lastPayment',
        accessorFn: (row) => row.lastPaymentSort,
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Last Payment" className="px-1 text-xs" />
        ),
        sortingFn: 'basic',
        sortUndefined: 'last',
        size: 88,
        meta: {
          headerTitle: 'Last Payment',
          headerClassName: 'text-right',
          cellClassName: 'text-right'
        },
        cell: ({ row }) => (
          <span className="block text-right tabular-nums text-muted-foreground">
            {relativeDate(row.original.meta.lastPayment)}
          </span>
        )
      }
    ],
    []
  )
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table manages reactive table state internally.
  const table = useReactTable({
    data: filteredRows,
    columns,
    state: {
      sorting,
      pagination,
      rowSelection: selectedId ? { [selectedId]: true } : {}
    },
    enableRowSelection: true,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.account.id
  })

  React.useEffect(() => localStorage.setItem(sortStorageKey, JSON.stringify(sorting)), [sorting])
  React.useEffect(
    () => localStorage.setItem(paginationStorageKey, JSON.stringify(pagination)),
    [pagination]
  )
  React.useEffect(() => {
    setPagination((current) => ({ ...current, pageIndex: 0 }))
  }, [branch, dueDate, frequency, paymentStatus, search])

  const clearFilters = (): void => {
    setSearch('')
    setBranch('all')
    setPaymentStatus('all')
    setFrequency('all')
    setDueDate('all')
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden p-3">
      <div className="grid h-full min-h-0 w-full min-w-0 grid-cols-[minmax(0,1fr)_clamp(20rem,24vw,24rem)] gap-3 max-[1099px]:grid-cols-1">
        <div className="flex min-h-0 min-w-0 flex-col gap-3">
          <dl className="flex h-12 min-h-12 items-center overflow-x-auto rounded-md border bg-card px-3 text-xs">
            {[
              { label: 'Active', value: activeAccountsCount.toLocaleString('en-PH') },
              { label: 'Due Today', value: dueTodayCount.toLocaleString('en-PH') },
              { label: 'Overdue', value: overdueCount.toLocaleString('en-PH') },
              { label: "Today's Collections", value: formatHistoryMoney(todaysCollections) }
            ].map((item, index) => (
              <React.Fragment key={item.label}>
                {index > 0 && (
                  <span aria-hidden="true" className="mx-2 shrink-0 text-muted-foreground/60">
                    •
                  </span>
                )}
                <div className="flex shrink-0 items-baseline gap-1.5 whitespace-nowrap">
                  <dt className="text-muted-foreground">{item.label}</dt>
                  <dd className="font-medium tabular-nums text-foreground">{item.value}</dd>
                </div>
              </React.Fragment>
            ))}
          </dl>
          <Card className="flex min-h-0 min-w-0 flex-1 flex-col">
            <CardHeader className="flex shrink-0 flex-col gap-2 border-b px-3 py-2">
              <div className="flex w-full items-center gap-2">
                <InputGroup className="h-8 min-w-72 flex-[0_1_70%]">
                  <InputGroupAddon>
                    <Search aria-hidden="true" />
                  </InputGroupAddon>
                  <InputGroupInput
                    className="text-xs"
                    aria-label="Search active accounts by name, account ID, or mobile number"
                    placeholder="Search customer, account ID..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </InputGroup>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label="Open advanced filters"
                  onClick={() => setIsFiltersOpen(true)}
                  className="ml-auto shrink-0"
                >
                  <SlidersHorizontal data-icon="inline-start" />
                  Filters{activeFilters.length ? ` (${activeFilters.length})` : ''}
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="flex flex-wrap gap-1.5" aria-label="Quick filters">
                  <QuickFilterChip
                    active={paymentStatus === 'due-today'}
                    onClick={() =>
                      setPaymentStatus(paymentStatus === 'due-today' ? 'all' : 'due-today')
                    }
                  >
                    Due Today
                  </QuickFilterChip>
                  <QuickFilterChip
                    active={paymentStatus === 'overdue'}
                    onClick={() =>
                      setPaymentStatus(paymentStatus === 'overdue' ? 'all' : 'overdue')
                    }
                  >
                    Overdue
                  </QuickFilterChip>
                  <QuickFilterChip
                    active={dueDate === 'this-week'}
                    onClick={() => setDueDate(dueDate === 'this-week' ? 'all' : 'this-week')}
                  >
                    Due This Week
                  </QuickFilterChip>
                  <QuickFilterChip
                    active={frequency === 'Weekly'}
                    onClick={() => setFrequency(frequency === 'Weekly' ? 'all' : 'Weekly')}
                  >
                    Weekly
                  </QuickFilterChip>
                  <QuickFilterChip
                    active={frequency === 'Monthly'}
                    onClick={() => setFrequency(frequency === 'Monthly' ? 'all' : 'Monthly')}
                  >
                    Monthly
                  </QuickFilterChip>
                </div>
                {hasActiveFilters && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="ml-auto"
                    onClick={clearFilters}
                  >
                    <X data-icon="inline-start" />
                    Clear All
                  </Button>
                )}
              </div>
              {hasActiveFilters && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {activeFilters.map((filter) => (
                    <ActiveFilterChip
                      key={filter.key}
                      label={filter.label}
                      onRemove={filter.onRemove}
                    />
                  ))}
                </div>
              )}
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col p-0">
              {filteredRows.length ? (
                <DataGrid
                  table={table}
                  recordCount={filteredRows.length}
                  onRowClick={(row) => setSelectedId(row.account.id)}
                  className="flex min-h-0 min-w-0 flex-1 flex-col"
                  tableLayout={{ dense: true, headerSticky: true, width: 'fixed' }}
                  tableClassNames={{ base: tableMinWidthClass }}
                >
                  <DataGridContainer className="min-h-0 min-w-0 flex-1">
                    <DataGridScrollArea className="h-full min-h-0" orientation="both">
                      <DataGridTableVirtual estimateSize={48} overscan={8} />
                    </DataGridScrollArea>
                  </DataGridContainer>
                  <DataGridPagination
                    sizes={[25, 50, 100]}
                    info="Showing {from}–{to} of {count} Active Accounts"
                    className="h-11 min-h-11 grow-0 shrink-0 flex-row flex-nowrap border-t bg-muted/30 px-3 py-0 text-xs [&>div]:py-0 [&>div]:pt-0 [&>div]:pb-0"
                  />
                </DataGrid>
              ) : (
                <div className="flex min-h-0 flex-1 items-center justify-center p-4">
                  <Empty className="border-0">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <FileSearch aria-hidden="true" />
                      </EmptyMedia>
                      <EmptyTitle>No active accounts found.</EmptyTitle>
                      <EmptyDescription>Try clearing one or more filters.</EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                      <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                        Clear Filters
                      </Button>
                    </EmptyContent>
                  </Empty>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        {!isInspectorSheet && (
          <Card className="flex min-h-0 min-w-0 flex-col">
            <InHouseAccountInspector account={selectedRow?.account} meta={selectedRow?.meta} />
          </Card>
        )}
      </div>
      <Sheet open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
        <SheetContent side="right" className="w-[min(92vw,24rem)] p-0">
          <SheetHeader className="border-b">
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription>Refine the active collection queue.</SheetDescription>
          </SheetHeader>
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
            <section className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold">Account Scope</h3>
              <FilterSelect
                label="Branch"
                items={branchFilterItems}
                value={branch}
                onValueChange={(value) => setBranch(value as BranchName | 'all')}
              />
              <FilterSelect
                label="Payment Status"
                items={statusFilterItems}
                value={paymentStatus}
                onValueChange={(value) => setPaymentStatus(value as ActivePaymentStatus | 'all')}
              />
            </section>
            <section className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold">Schedule</h3>
              <FilterSelect
                label="Payment Frequency"
                items={frequencyFilterItems}
                value={frequency}
                onValueChange={setFrequency}
              />
              <FilterSelect
                label="Due Date"
                items={dueDateFilterItems}
                value={dueDate}
                onValueChange={(value) => setDueDate(value as DueDateFilter)}
              />
            </section>
          </div>
          <SheetFooter className="border-t">
            {hasActiveFilters && (
              <Button type="button" variant="outline" onClick={clearFilters}>
                Clear All
              </Button>
            )}
            <Button type="button" onClick={() => setIsFiltersOpen(false)}>
              Done
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      {isInspectorSheet && (
        <Sheet
          open={Boolean(selectedRow)}
          onOpenChange={(open) => !open && setSelectedId(undefined)}
        >
          <SheetContent
            side="right"
            showCloseButton={false}
            className="p-0 data-[side=right]:w-full data-[side=right]:max-w-none data-[side=right]:sm:w-[clamp(20rem,70vw,24rem)] data-[side=right]:sm:max-w-none"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Account details</SheetTitle>
              <SheetDescription>
                Loan and account details for the selected account.
              </SheetDescription>
            </SheetHeader>
            <InHouseAccountInspector
              account={selectedRow?.account}
              meta={selectedRow?.meta}
              isSheet
              onClose={() => setSelectedId(undefined)}
            />
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}
