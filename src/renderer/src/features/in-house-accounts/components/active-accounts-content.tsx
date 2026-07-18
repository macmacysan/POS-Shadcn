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

import { AccountBranchBadge, AccountStatusBadge } from '@/features/in-house-accounts/components/account-badges'
import { InHouseAccountInspector } from '@/features/in-house-accounts/components/account-inspector'
import { createRowActionsColumn, type RowActionItem } from '@/components/shared/data-table/row-actions'
import { DataGridColumnHeader } from '@/components/ui/reui/data-grid/data-grid-column-header'
import { dataTableColumnSizes, UniversalDataTable } from '@/components/shared/data-table/universal-data-table'
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
import { Input } from '@/components/ui/input'
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
import { formatHistoryMoney } from '@/lib/installment-history'
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

function daysUntilDue(nextDue: string | undefined): number | undefined {
  return nextDue ? differenceInCalendarDays(parseISO(nextDue), startOfToday()) : undefined
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
  name
}: {
  readonly name: string
}): React.JSX.Element {
  return <TruncatedText value={name} className="font-semibold text-foreground" />
})

const ContractCell = React.memo(function ContractCell({
  frequency,
  terms
}: {
  readonly frequency?: string
  readonly terms?: string
}): React.JSX.Element {
  const contract = [frequency, terms?.replace(/\s*months?$/i, '')].filter(Boolean).join(' ')

  return contract ? (
    <TruncatedText value={contract} className="font-medium text-foreground" />
  ) : (
    <span aria-hidden="true" />
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
      size="xs"
      variant="ghost"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'h-9 rounded-md px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground',
        active && 'bg-muted/70 text-foreground'
      )}
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

function noopActiveAccountAction(account: InHouseAccount): void {
  void account.id
}

function activeAccountRowActions(
  row: ActiveAccountRow,
  viewAccount: () => void
): readonly RowActionItem[] {
  return [
    {
      id: 'record-payment',
      label: 'Record Payment',
      onSelect: () => noopActiveAccountAction(row.account)
    },
    { id: 'view', label: 'View Account', onSelect: viewAccount },
    {
      id: 'view-ledger',
      label: 'View Ledger',
      onSelect: () => noopActiveAccountAction(row.account)
    },
    { id: 'edit-loan', label: 'Edit Loan', onSelect: () => noopActiveAccountAction(row.account) },
    {
      id: 'edit-customer',
      label: 'Edit Customer',
      onSelect: () => noopActiveAccountAction(row.account)
    },
    { id: 'add-loan', label: 'Add Loan', onSelect: () => noopActiveAccountAction(row.account) },
    {
      id: 'reschedule-payment',
      label: 'Reschedule Payment',
      onSelect: () => noopActiveAccountAction(row.account)
    },
    {
      id: 'print-statement',
      label: 'Print Statement',
      onSelect: () => noopActiveAccountAction(row.account)
    },
    {
      id: 'close-account',
      label: 'Close Account',
      onSelect: () => noopActiveAccountAction(row.account),
      destructive: true,
      requiresConfirmation: true,
      confirmationMessage: 'Close account?'
    },
    {
      id: 'blacklist',
      label: 'Blacklist Account',
      onSelect: () => noopActiveAccountAction(row.account),
      destructive: true,
      requiresConfirmation: true,
      confirmationMessage: 'Blacklist account?'
    }
  ]
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
  const [contextMenu, setContextMenu] = React.useState({ rowId: '', signal: 0 })
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
        size: dataTableColumnSizes.branch.compactSize,
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
        size: dataTableColumnSizes.account.compactSize,
        meta: { headerTitle: 'Account', cellClassName: 'min-w-0' },
        cell: ({ row }) => <AccountCell name={row.original.name} />
      },
      {
        id: 'contract',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Contract" className="px-1 text-xs" />
        ),
        enableSorting: false,
        size: dataTableColumnSizes.receiptNumber.size,
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
        size: dataTableColumnSizes.amount.compactSize,
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
        size: dataTableColumnSizes.amount.wideSize,
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
        size: dataTableColumnSizes.status.compactSize,
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
        size: dataTableColumnSizes.date.narrowSize,
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
        size: dataTableColumnSizes.date.compactSize,
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
      },
      createRowActionsColumn<ActiveAccountRow>({
        label: 'Open active account actions',
        getActions: (row) => activeAccountRowActions(row, () => setSelectedId(row.account.id)),
        getOpenSignal: (rowId) => (contextMenu.rowId === rowId ? contextMenu.signal : undefined)
      })
    ],
    [contextMenu]
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
          <Card className="flex min-h-0 min-w-0 flex-1 flex-col">
            <CardHeader className="flex shrink-0 flex-col gap-2 border-b px-3 py-1.5">
              <div className="flex w-full items-center gap-2">
                <div className="relative min-w-72 flex-[1_1_70%]">
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    className="h-10 pl-8 text-xs"
                    aria-label="Search active accounts by name, account ID, or mobile number"
                    placeholder="Search customer, account ID..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label="Open advanced filters"
                  onClick={() => setIsFiltersOpen(true)}
                  className="ml-auto h-10 shrink-0"
                >
                  <SlidersHorizontal data-icon="inline-start" />
                  Filters{activeFilters.length ? ` (${activeFilters.length})` : ''}
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap gap-2" aria-label="Quick filters">
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
                    className="ml-auto h-9"
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
                <UniversalDataTable
                  table={table}
                  recordCount={filteredRows.length}
                  onRowClick={(row) => setSelectedId(row.account.id)}
                  onRowDoubleClick={(row) => setSelectedId(row.account.id)}
                  onRowContextMenu={(row, event) => {
                    event.preventDefault()
                    setSelectedId(row.account.id)
                    setContextMenu((current) => ({
                      rowId: row.account.id,
                      signal: current.signal + 1
                    }))
                  }}
                  virtual
                  virtualEstimateSize={48}
                  virtualOverscan={8}
                  paginationSizes={[25, 50, 100]}
                  paginationInfo="Showing {from}-{to} of {count} Active Accounts"
                />
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
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
            <section className="flex flex-col gap-2.5">
              <h3 className="text-xs font-semibold text-foreground">Account</h3>
              <FilterSelect
                label="Branch"
                items={branchFilterItems}
                value={branch}
                onValueChange={(value) => setBranch(value as BranchName | 'all')}
              />
              <FilterSelect
                label="Status"
                items={statusFilterItems}
                value={paymentStatus}
                onValueChange={(value) => setPaymentStatus(value as ActivePaymentStatus | 'all')}
              />
            </section>
            <section className="flex flex-col gap-2.5">
              <h3 className="text-xs font-semibold text-foreground">Schedule</h3>
              <FilterSelect
                label="Frequency"
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
            <Button type="button" variant="ghost" onClick={clearFilters}>
              Reset
            </Button>
            <Button type="button" onClick={() => setIsFiltersOpen(false)}>
              Apply Filters
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
