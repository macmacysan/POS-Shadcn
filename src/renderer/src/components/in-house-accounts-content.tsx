import * as React from 'react'
import { FileSearch, Plus, Search } from 'lucide-react'
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { DataGrid, DataGridContainer } from '@/components/reui/data-grid/data-grid'
import { DataGridColumnHeader } from '@/components/reui/data-grid/data-grid-column-header'
import { DataGridPagination } from '@/components/reui/data-grid/data-grid-pagination'
import { DataGridScrollArea } from '@/components/reui/data-grid/data-grid-scroll-area'
import { DataGridTable } from '@/components/reui/data-grid/data-grid-table'
import {
  InHouseAccountForm,
  type InHouseAccountWorkflowSave
} from '@/components/in-house-account-form'
import { AccountBranchBadge, AccountStatusBadge } from '@/components/in-house-account-badges'
import { InHouseAccountInspector } from '@/components/in-house-account-inspector'
import { accountStatusRank } from '@/lib/in-house-account-display'
import {
  branchLabels,
  branchNames,
  createAccount,
  createLoan,
  formatAccountName,
  formatAddressSummary,
  inHouseAccountsStorageKey,
  inHouseLoansStorageKey,
  readInHouseAccounts,
  readInHouseLoans,
  type BranchName,
  type InHouseAccount
} from '@/lib/in-house-accounts'
import {
  buildAccountMonitoringMeta,
  createAccountHistoryIndex,
  type AccountMonitoringMeta,
  type AccountMonitoringStatus
} from '@/lib/in-house-account-monitoring'
import { cn } from '@/lib/utils'

type AccountRow = {
  readonly account: InHouseAccount
  readonly name: string
  readonly address: string
  readonly branch: BranchName
  readonly status: AccountMonitoringStatus
  readonly nextDue?: string
  readonly nextDueSort: number
  readonly inspectorMeta: AccountMonitoringMeta
}

const storageKey = inHouseAccountsStorageKey
const sortStorageKey = `${storageKey}-sort`
const paginationStorageKey = `${storageKey}-pagination`
const defaultSorting: SortingState = [{ id: 'account', desc: false }]
const defaultPagination: PaginationState = { pageIndex: 0, pageSize: 25 }

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

function toBranchName(value: string): BranchName {
  const match = branchNames.find((branch) => branch.toLowerCase() === value.toLowerCase())
  return match ?? 'Goa'
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

export function InHouseAccountsContent(): React.JSX.Element {
  const [accounts, setAccounts] = React.useState<readonly InHouseAccount[]>(readInHouseAccounts)
  const [loans, setLoans] = React.useState(readInHouseLoans)
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
  const isInspectorSheet = useMediaQuery('(max-width: 1099px)')
  const selected = accounts.find((account) => account.id === selectedId)
  const historyIndex = React.useMemo(createAccountHistoryIndex, [])
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
        const inspectorMeta = buildAccountMonitoringMeta(account.id, historyIndex)
        return {
          account,
          name: formatAccountName(account),
          address: formatAddressSummary(account),
          branch: accountBranch,
          status: inspectorMeta.status,
          nextDue: inspectorMeta.nextDue,
          nextDueSort: inspectorMeta.nextDue ? parseISO(inspectorMeta.nextDue).getTime() : Infinity,
          inspectorMeta
        }
      })
  }, [accounts, agent, branch, historyIndex, search])
  const columns = React.useMemo<ColumnDef<AccountRow>[]>(
    () => [
      {
        id: 'branch',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Branch" />,
        enableSorting: false,
        size: 92,
        meta: {
          headerTitle: 'Branch',
          headerClassName: 'max-[640px]:hidden',
          cellClassName: 'max-[640px]:hidden'
        },
        cell: ({ row }) => <AccountBranchBadge branch={row.original.branch} />
      },
      {
        id: 'account',
        accessorFn: (row) => row.name,
        header: ({ column }) => <DataGridColumnHeader column={column} title="Account" />,
        sortingFn: 'alphanumeric',
        size: 230,
        meta: {
          headerTitle: 'Account',
          cellClassName: 'min-w-0'
        },
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
        header: ({ column }) => <DataGridColumnHeader column={column} title="Address" />,
        enableSorting: false,
        size: 210,
        meta: {
          headerTitle: 'Address',
          headerClassName: 'max-[1099px]:hidden',
          cellClassName: 'max-[1099px]:hidden'
        },
        cell: ({ row }) => (
          <TruncatedText value={row.original.address} className="text-muted-foreground" />
        )
      },
      {
        id: 'status',
        accessorFn: (row) => accountStatusRank[row.status],
        header: ({ column }) => <DataGridColumnHeader column={column} title="Status" />,
        sortingFn: 'basic',
        size: 120,
        meta: {
          headerTitle: 'Status'
        },
        cell: ({ row }) => <AccountStatusBadge status={row.original.status} />
      },
      {
        id: 'nextDue',
        accessorFn: (row) => row.nextDueSort,
        header: ({ column }) => <DataGridColumnHeader column={column} title="Next Due" />,
        sortingFn: 'basic',
        size: 100,
        meta: {
          headerTitle: 'Next Due',
          headerClassName: 'text-right',
          cellClassName: 'text-right'
        },
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
  const totalRows = table.getPrePaginationRowModel().rows.length
  const selectedMeta = selected ? buildAccountMonitoringMeta(selected.id, historyIndex) : undefined

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
  const save = (payload: InHouseAccountWorkflowSave): void => {
    const now = new Date()
    const nextAccount =
      payload.mode === 'new' ? createAccount(payload.accountDraft, now) : undefined
    const customerId = payload.mode === 'new' ? nextAccount?.id : payload.customerId
    if (!customerId) return
    const nextLoan = createLoan(customerId, payload.loanDraft, now)
    const updatedAccounts = nextAccount ? [...accounts, nextAccount] : accounts
    const updatedLoans = [...loans, nextLoan]
    const previousAccounts = localStorage.getItem(storageKey)
    const previousLoans = localStorage.getItem(inHouseLoansStorageKey)

    try {
      localStorage.setItem(storageKey, JSON.stringify(updatedAccounts))
      localStorage.setItem(inHouseLoansStorageKey, JSON.stringify(updatedLoans))
    } catch (error) {
      if (previousAccounts === null) localStorage.removeItem(storageKey)
      else localStorage.setItem(storageKey, previousAccounts)
      if (previousLoans === null) localStorage.removeItem(inHouseLoansStorageKey)
      else localStorage.setItem(inHouseLoansStorageKey, previousLoans)
      throw error
    }
    setAccounts(updatedAccounts)
    setLoans(updatedLoans)
    setSelectedId(customerId)
    setIsFormOpen(false)
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden p-3">
      <div
        className={cn(
          'grid h-full min-h-0 w-full min-w-0 gap-3',
          isFormOpen
            ? 'grid-cols-1'
            : 'grid-cols-[minmax(0,1fr)_clamp(20rem,24vw,24rem)] max-[1099px]:grid-cols-1'
        )}
      >
        {isFormOpen ? (
          <Card className="mx-auto flex min-h-0 w-full max-w-5xl flex-col">
            <CardContent className="flex min-h-0 flex-1 flex-col p-0">
              <InHouseAccountForm
                accounts={accounts}
                onSave={save}
                onCancel={() => setIsFormOpen(false)}
              />
            </CardContent>
          </Card>
        ) : (
          <>
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
                  <DataGrid
                    table={table}
                    recordCount={totalRows}
                    onRowClick={(row) => setSelectedId(row.account.id)}
                    className="flex min-h-0 min-w-0 flex-1 flex-col"
                    tableLayout={{
                      dense: true,
                      headerSticky: true,
                      columnsResizable: true,
                      width: 'fixed'
                    }}
                  >
                    <DataGridContainer className="min-h-0 min-w-0 flex-1">
                      <DataGridScrollArea className="h-full min-h-0" orientation="both">
                        <DataGridTable />
                      </DataGridScrollArea>
                    </DataGridContainer>
                    <DataGridPagination
                      sizes={[25, 50, 100]}
                      info="Showing {from}-{to} of {count} accounts"
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
                        <EmptyTitle>No accounts found.</EmptyTitle>
                        <EmptyDescription>
                          Try clearing filters or add a new account.
                        </EmptyDescription>
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
              </CardContent>
            </Card>
            {!isInspectorSheet && (
              <Card className="flex min-h-0 min-w-0 flex-col">
                <InHouseAccountInspector account={selected} meta={selectedMeta} />
              </Card>
            )}
          </>
        )}
      </div>
      {!isFormOpen && isInspectorSheet && (
        <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelectedId(undefined)}>
          <SheetContent
            side="right"
            showCloseButton={false}
            className="w-full p-0 sm:w-[clamp(20rem,70vw,24rem)]"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Account details</SheetTitle>
              <SheetDescription>Full details for the selected account.</SheetDescription>
            </SheetHeader>
            <InHouseAccountInspector
              account={selected}
              meta={selectedMeta}
              isSheet
              onClose={() => setSelectedId(undefined)}
            />
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}
