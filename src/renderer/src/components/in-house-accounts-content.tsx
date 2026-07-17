import * as React from 'react'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileSearch,
  Plus,
  Search
} from 'lucide-react'
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type SortingState
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { differenceInCalendarDays, format, parseISO, startOfToday } from 'date-fns'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
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
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useIsMobile } from '@/hooks/use-mobile'
import { InHouseAccountForm } from '@/components/in-house-account-form'
import { InHouseAccountInspector } from '@/components/in-house-account-inspector'
import {
  branchLabels,
  branchNames,
  createAccount,
  formatAccountName,
  formatAddressSummary,
  normalizeAccountDraft,
  sampleAccounts,
  type BranchName,
  type InHouseAccount
} from '@/lib/in-house-accounts'
import {
  installmentHistoryData,
  type InstallmentHistoryRecord,
  type PaymentDetails
} from '@/lib/installment-history'
import { cn } from '@/lib/utils'

type AccountStatus =
  'active' | 'due-today' | 'due-soon' | 'overdue' | 'closed' | 'blacklisted' | 'fully-paid'

type AccountRow = {
  readonly account: InHouseAccount
  readonly name: string
  readonly address: string
  readonly branch: BranchName
  readonly branchCode: string
  readonly status: AccountStatus
  readonly nextDue?: string
  readonly nextDueSort: number
}

const storageKey = 'cashiers-report-in-house-accounts'
const sortStorageKey = `${storageKey}-sort`
const paginationStorageKey = `${storageKey}-pagination`
const defaultSorting: SortingState = [{ id: 'account', desc: false }]
const defaultPagination: PaginationState = { pageIndex: 0, pageSize: 25 }
const branchCodeByName: Record<BranchName, string> = {
  Goa: 'GOA',
  Tinambac: 'TIN',
  Tigaon: 'TIG',
  Lagonoy: 'LAG'
}
const statusRank: Record<AccountStatus, number> = {
  overdue: 0,
  'due-today': 1,
  'due-soon': 2,
  active: 3,
  'fully-paid': 4,
  closed: 5,
  blacklisted: 6
}
const statusLabel: Record<AccountStatus, string> = {
  active: 'Active',
  'due-today': 'Due Today',
  'due-soon': 'Due Soon',
  overdue: 'Overdue',
  closed: 'Closed',
  blacklisted: 'Blacklisted',
  'fully-paid': 'Fully Paid'
}

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

function readAccounts(): readonly InHouseAccount[] {
  const saved = localStorage.getItem(storageKey)
  if (!saved) return sampleAccounts
  try {
    const parsed: unknown = JSON.parse(saved)
    return Array.isArray(parsed) ? (parsed as InHouseAccount[]) : sampleAccounts
  } catch (error) {
    if (error instanceof SyntaxError) return sampleAccounts
    throw error
  }
}

function toBranchName(value: string): BranchName {
  const match = branchNames.find((branch) => branch.toLowerCase() === value.toLowerCase())
  return match ?? 'Goa'
}

function getPayment(record: InstallmentHistoryRecord): PaymentDetails | undefined {
  return record.details.payment
}

function buildAccountMeta(
  accountId: string
): Pick<AccountRow, 'status' | 'nextDue' | 'nextDueSort'> {
  const records = installmentHistoryData
    .filter((record) => record.source === 'in-house' && record.accountId === accountId)
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
  const latestBalance = records
    .map((record) => getPayment(record)?.newBalance ?? record.balance)
    .find((balance): balance is number => typeof balance === 'number')
  const nextDue = records
    .filter((record) => record.action !== 'deleted')
    .map((record) => getPayment(record)?.dueDate)
    .filter((value): value is string => Boolean(value))
    .sort()[0]

  if (latestBalance === 0) {
    return {
      status: 'fully-paid',
      nextDue,
      nextDueSort: nextDue ? parseISO(nextDue).getTime() : Infinity
    }
  }
  if (!nextDue) return { status: 'active', nextDueSort: Infinity }

  const days = differenceInCalendarDays(parseISO(nextDue), startOfToday())
  const status: AccountStatus =
    days < 0 ? 'overdue' : days === 0 ? 'due-today' : days <= 7 ? 'due-soon' : 'active'
  return { status, nextDue, nextDueSort: parseISO(nextDue).getTime() }
}

function formatDueDate(value: string | undefined): string {
  if (!value) return '—'
  const days = differenceInCalendarDays(parseISO(value), startOfToday())
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return format(parseISO(value), 'MMM d')
}

function TruncatedText({
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
}

function BranchBadge({
  branch,
  code
}: {
  readonly branch: BranchName
  readonly code: string
}): React.JSX.Element {
  return (
    <Badge variant="outline" className="gap-1.5 px-1.5">
      <span
        aria-hidden="true"
        className={cn(
          'size-1.5 rounded-full',
          branch === 'Goa' && 'bg-primary',
          branch === 'Tinambac' && 'bg-muted-foreground',
          branch === 'Tigaon' && 'bg-accent-foreground',
          branch === 'Lagonoy' && 'bg-secondary-foreground'
        )}
      />
      {code}
    </Badge>
  )
}

function StatusBadge({ status }: { readonly status: AccountStatus }): React.JSX.Element {
  return (
    <Badge
      variant={
        status === 'overdue' || status === 'blacklisted'
          ? 'destructive'
          : status === 'due-today'
            ? 'default'
            : status === 'active' || status === 'due-soon' || status === 'fully-paid'
              ? 'secondary'
              : 'outline'
      }
    >
      {statusLabel[status]}
    </Badge>
  )
}

function SortButton({
  column,
  label
}: {
  readonly column: AccountColumn
  readonly label: string
}): React.JSX.Element {
  const sorted = column.getIsSorted()
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="-ml-2 h-7 px-2 text-xs"
      onClick={column.getToggleSortingHandler()}
      aria-label={`Sort ${label}`}
    >
      {label}
      {sorted === 'desc' ? (
        <ArrowDown data-icon="inline-end" />
      ) : sorted === 'asc' ? (
        <ArrowUp data-icon="inline-end" />
      ) : (
        <ArrowUpDown data-icon="inline-end" />
      )}
    </Button>
  )
}

type AccountColumn = ReturnType<
  ReturnType<typeof useReactTable<AccountRow>>['getAllColumns']
>[number]

function columnClassName(id: string): string {
  return cn(
    'flex min-w-0 items-center px-3 py-1',
    id === 'branch' && 'max-[640px]:hidden',
    id === 'account' && 'min-w-0',
    id === 'address' && 'max-[1099px]:hidden',
    id === 'status' && 'justify-start',
    id === 'nextDue' && 'justify-end text-right'
  )
}

const rowGridClassName =
  'grid w-full grid-cols-[5.75rem_minmax(12rem,1.35fr)_minmax(9rem,1fr)_7.5rem_6.25rem] max-[1099px]:grid-cols-[5.75rem_minmax(0,1fr)_7.5rem_6.25rem] max-[640px]:grid-cols-[minmax(0,1fr)_7.5rem_6.25rem]'

function AccountTableBody({
  table,
  selectedId,
  onSelect
}: {
  readonly table: ReturnType<typeof useReactTable<AccountRow>>
  readonly selectedId?: string
  readonly onSelect: (account: InHouseAccount) => void
}): React.JSX.Element {
  const parentRef = React.useRef<HTMLDivElement>(null)
  const rows = table.getRowModel().rows
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual owns scroll measurement state.
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 8
  })

  const selectAt = (index: number): void => {
    const row = rows[index]
    if (row) onSelect(row.original.account)
  }

  return (
    <div ref={parentRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
      <Table className="grid w-full table-fixed">
        <TableHeader className="sticky top-0 bg-card shadow-xs">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow
              key={headerGroup.id}
              className={cn('h-9 hover:bg-transparent', rowGridClassName)}
            >
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={cn(
                    'h-9 text-xs font-medium normal-case text-muted-foreground',
                    columnClassName(header.column.id)
                  )}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody className="relative grid" style={{ height: `${virtualizer.getTotalSize()}px` }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index]
            const selected = row.original.account.id === selectedId
            return (
              <TableRow
                key={row.id}
                tabIndex={0}
                aria-selected={selected}
                data-state={selected ? 'selected' : undefined}
                className={cn(
                  'absolute h-12 cursor-pointer border-b border-l-2 border-l-transparent text-xs outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring data-[state=selected]:border-l-primary data-[state=selected]:bg-primary/10 data-[state=selected]:hover:bg-primary/10',
                  rowGridClassName
                )}
                style={{ transform: `translateY(${virtualRow.start}px)` }}
                onClick={() => onSelect(row.original.account)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelect(row.original.account)
                  }
                  if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    selectAt(Math.min(virtualRow.index + 1, rows.length - 1))
                  }
                  if (event.key === 'ArrowUp') {
                    event.preventDefault()
                    selectAt(Math.max(virtualRow.index - 1, 0))
                  }
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className={columnClassName(cell.column.id)}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

export function InHouseAccountsContent(): React.JSX.Element {
  const [accounts, setAccounts] = React.useState<readonly InHouseAccount[]>(readAccounts)
  const [selectedId, setSelectedId] = React.useState<string | undefined>(accounts[0]?.id)
  const [search, setSearch] = React.useState('')
  const [branch, setBranch] = React.useState<BranchName | 'all'>('all')
  const [agent, setAgent] = React.useState('all')
  const [sorting, setSorting] = React.useState<SortingState>(() =>
    readJson(sortStorageKey, defaultSorting)
  )
  const [pagination, setPagination] = React.useState<PaginationState>(() =>
    readJson(paginationStorageKey, defaultPagination)
  )
  const [isFormOpen, setIsFormOpen] = React.useState(false)
  const isMobile = useIsMobile()
  const selected = accounts.find((account) => account.id === selectedId)
  const agents = React.useMemo(
    () =>
      Array.from(
        new Set(
          accounts
            .map((account) => account.agent)
            .filter((value): value is string => Boolean(value))
        )
      ),
    [accounts]
  )
  const visibleAccounts = React.useMemo(() => {
    const query = search.trim().toLowerCase()
    return accounts
      .filter((account) => branch === 'all' || toBranchName(String(account.branch)) === branch)
      .filter((account) => agent === 'all' || account.agent === agent)
      .filter(
        (account) =>
          !query ||
          [
            formatAccountName(account),
            ...account.contacts.map((contact) => contact.value),
            ...account.emails.map((email) => email.value)
          ]
            .join(' ')
            .toLowerCase()
            .includes(query)
      )
      .map((account) => {
        const accountBranch = toBranchName(String(account.branch))
        return {
          account,
          name: formatAccountName(account),
          address: formatAddressSummary(account),
          branch: accountBranch,
          branchCode: branchCodeByName[accountBranch],
          ...buildAccountMeta(account.id)
        }
      })
  }, [accounts, agent, branch, search])
  const columns = React.useMemo<ColumnDef<AccountRow>[]>(
    () => [
      {
        id: 'branch',
        header: 'Branch',
        enableSorting: false,
        cell: ({ row }) => (
          <BranchBadge branch={row.original.branch} code={row.original.branchCode} />
        )
      },
      {
        id: 'account',
        accessorFn: (row) => row.name,
        header: ({ column }) => <SortButton column={column} label="Account" />,
        sortingFn: 'alphanumeric',
        cell: ({ row }) => (
          <div className="min-w-0">
            <TruncatedText value={row.original.name} className="font-medium text-foreground" />
            <span className="block truncate text-muted-foreground">{row.original.account.id}</span>
          </div>
        )
      },
      {
        id: 'address',
        accessorFn: (row) => row.address,
        header: 'Address',
        enableSorting: false,
        cell: ({ row }) => (
          <TruncatedText value={row.original.address} className="text-muted-foreground" />
        )
      },
      {
        id: 'status',
        accessorFn: (row) => statusRank[row.status],
        header: ({ column }) => <SortButton column={column} label="Status" />,
        sortingFn: 'basic',
        cell: ({ row }) => <StatusBadge status={row.original.status} />
      },
      {
        id: 'nextDue',
        accessorFn: (row) => row.nextDueSort,
        header: ({ column }) => <SortButton column={column} label="Next Due" />,
        sortingFn: 'basic',
        cell: ({ row }) => (
          <span
            className={cn(
              'tabular-nums',
              row.original.status === 'overdue'
                ? 'font-medium text-destructive'
                : 'text-muted-foreground'
            )}
          >
            {formatDueDate(row.original.nextDue)}
          </span>
        )
      }
    ],
    []
  )
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table manages reactive table state internally.
  const table = useReactTable({
    data: visibleAccounts,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.account.id
  })
  const totalRows = table.getPrePaginationRowModel().rows.length
  const pageRows = table.getRowModel().rows.length
  const firstRow = totalRows === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1
  const lastRow = Math.min(firstRow + pageRows - 1, totalRows)

  React.useEffect(() => {
    localStorage.setItem(sortStorageKey, JSON.stringify(sorting))
  }, [sorting])
  React.useEffect(() => {
    localStorage.setItem(paginationStorageKey, JSON.stringify(pagination))
  }, [pagination])
  React.useEffect(() => {
    setPagination((current) => ({ ...current, pageIndex: 0 }))
  }, [agent, branch, search])

  const clearFilters = (): void => {
    setSearch('')
    setBranch('all')
    setAgent('all')
  }
  const save = (draft: Parameters<typeof createAccount>[0]): void => {
    const next = createAccount(normalizeAccountDraft(draft))
    const updated = [...accounts, next]
    setAccounts(updated)
    setSelectedId(next.id)
    setIsFormOpen(false)
    localStorage.setItem(storageKey, JSON.stringify(updated))
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden p-3">
      <div className="grid h-full min-h-0 w-full min-w-0 grid-cols-[minmax(0,1fr)_minmax(270px,320px)] gap-3 max-[767px]:grid-cols-1">
        <Card className="flex min-h-0 min-w-0 flex-col">
          <CardContent className="flex min-h-0 flex-1 flex-col p-0">
            <CardHeader className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-card px-3 py-2">
              <InputGroup className="h-8 min-w-48 max-w-md flex-1">
                <InputGroupAddon>
                  <Search aria-hidden="true" />
                </InputGroupAddon>
                <InputGroupInput
                  className="text-xs"
                  aria-label="Search accounts by name, contact number, or email"
                  placeholder="Search name, contact, or email..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </InputGroup>
              <Select
                value={branch}
                onValueChange={(value) => setBranch(value as BranchName | 'all')}
              >
                <SelectTrigger size="sm" className="w-28" aria-label="Filter by branch">
                  <SelectValue placeholder="Branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All branches</SelectItem>
                  {branchNames.map((item) => (
                    <SelectItem key={item} value={item}>
                      {branchLabels[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {agents.length > 0 && (
                <Select value={agent} onValueChange={(value) => setAgent(value ?? 'all')}>
                  <SelectTrigger size="sm" className="w-32" aria-label="Filter by agent">
                    <SelectValue placeholder="Agent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All agents</SelectItem>
                    {agents.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button
                type="button"
                size="sm"
                className="shrink-0"
                onClick={() => setIsFormOpen(true)}
              >
                <Plus data-icon="inline-start" />
                Add Account
              </Button>
            </CardHeader>
            {totalRows ? (
              <AccountTableBody
                table={table}
                selectedId={selectedId}
                onSelect={(account) => setSelectedId(account.id)}
              />
            ) : (
              <div className="flex min-h-0 flex-1 items-center justify-center p-4">
                <Empty className="border-0">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <FileSearch aria-hidden="true" />
                    </EmptyMedia>
                    <EmptyTitle>No accounts found.</EmptyTitle>
                    <EmptyDescription>Try clearing filters or add a new account.</EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent className="flex-row justify-center">
                    <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                      Clear Filters
                    </Button>
                    <Button type="button" size="sm" onClick={() => setIsFormOpen(true)}>
                      <Plus data-icon="inline-start" />
                      Add Account
                    </Button>
                  </EmptyContent>
                </Empty>
              </div>
            )}
            <CardFooter className="flex min-h-11 shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <span>
                Showing {firstRow}-{lastRow} of {totalRows} accounts
              </span>
              <div className="flex items-center gap-2">
                <span>Rows per page</span>
                <Select
                  value={String(pagination.pageSize)}
                  onValueChange={(value) => table.setPageSize(Number(value))}
                >
                  <SelectTrigger size="sm" className="w-20" aria-label="Rows per page">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[25, 50, 100].map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="First page"
                    disabled={!table.getCanPreviousPage()}
                    onClick={() => table.setPageIndex(0)}
                  >
                    <ChevronsLeft aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Previous page"
                    disabled={!table.getCanPreviousPage()}
                    onClick={() => table.previousPage()}
                  >
                    <ChevronLeft aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Next page"
                    disabled={!table.getCanNextPage()}
                    onClick={() => table.nextPage()}
                  >
                    <ChevronRight aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Last page"
                    disabled={!table.getCanNextPage()}
                    onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                  >
                    <ChevronsRight aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </CardFooter>
          </CardContent>
        </Card>
        {!isMobile && (
          <Card className="flex min-h-0 min-w-0 flex-col">
            <CardHeader className="border-b p-4">
              <CardTitle>Account Details</CardTitle>
            </CardHeader>
            <InHouseAccountInspector account={selected} />
          </Card>
        )}
      </div>
      {isMobile && (
        <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelectedId(undefined)}>
          <SheetContent side="right" className="w-[min(92vw,26rem)] p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Account details</SheetTitle>
              <SheetDescription>Full details for the selected account.</SheetDescription>
            </SheetHeader>
            <InHouseAccountInspector account={selected} />
          </SheetContent>
        </Sheet>
      )}
      <Drawer
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        swipeDirection={isMobile ? 'down' : 'right'}
        showSwipeHandle={isMobile}
      >
        <DrawerContent className="[--drawer-content-width:min(96vw,46rem)] data-[swipe-axis=x]:[--drawer-bleed-background:transparent] data-[swipe-axis=x]:[--drawer-inset:0px] data-[swipe-axis=y]:[--drawer-inset:1rem]">
          <DrawerHeader className="border-b px-4 py-3">
            <DrawerTitle>Add Account</DrawerTitle>
            <DrawerDescription>Create an in-house installment customer account.</DrawerDescription>
          </DrawerHeader>
          <InHouseAccountForm onSave={save} onCancel={() => setIsFormOpen(false)} />
        </DrawerContent>
      </Drawer>
    </div>
  )
}
