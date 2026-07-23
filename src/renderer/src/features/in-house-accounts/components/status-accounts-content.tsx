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

import { AccountBranchBadge, AccountStatusBadge } from '@/features/in-house-accounts/components/account-badges'
import { InHouseAccountForm, type InHouseAccountWorkflowSave } from '@/features/in-house-accounts/components/account-form'
import { InHouseAccountInspector } from '@/features/in-house-accounts/components/account-inspector'
import { createRowActionsColumn, type RowActionItem } from '@/components/shared/data-table/row-actions'
import { TableToolbar } from '@/components/shared/data-table/table-toolbar'
import { UniversalDataTable } from '@/components/shared/data-table/universal-data-table'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { DataGridColumnHeader } from '@/components/ui/reui/data-grid/data-grid-column-header'
import { accountStatusRank } from '@/lib/in-house-account-display'
import {
  branchLabels,
  branchNames,
  createAccount,
  createLoan,
  formatAccountName,
  inHouseAccountsStorageKey,
  inHouseLoansStorageKey,
  type BranchName,
} from '@/lib/in-house-accounts'
import { formatHistoryDate, formatHistoryMoney } from '@/lib/installment-history'
import { useInstallmentData, type PersistedInstallmentRow } from '@/features/in-house-accounts/installment-data'
import type { InstallmentView } from '../../../../../shared/contracts'
import { cn } from '@/lib/utils'

type Props = { readonly view: InstallmentView }
type Transition = { readonly kind: 'close' | 'blacklist'; readonly row: PersistedInstallmentRow }

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(false)
  React.useEffect(() => {
    const media = window.matchMedia(query)
    const update = (): void => setMatches(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [query])
  return matches
}

function toBranch(value: string): BranchName {
  return branchNames.find((branch) => branch.toLowerCase() === value.toLowerCase()) ?? 'Lagonoy'
}

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) return String(error.message)
  return 'The database operation could not be completed.'
}

function Money({ value, emphasis = false }: { readonly value?: number; readonly emphasis?: boolean }): React.JSX.Element {
  return <span className={cn('tabular-nums', emphasis && 'font-medium')}>{formatHistoryMoney(value)}</span>
}

function AccountCell({ row }: { readonly row: PersistedInstallmentRow }): React.JSX.Element {
  return (
    <div className="min-w-0">
      <span className="block truncate font-medium">{formatAccountName(row.account)}</span>
      <span className="block truncate text-xs text-muted-foreground">{row.account.id}</span>
    </div>
  )
}

function statusColumns(view: InstallmentView): ColumnDef<PersistedInstallmentRow>[] {
  const base: ColumnDef<PersistedInstallmentRow>[] = [
    {
      id: 'branch',
      header: ({ column }) => <DataGridColumnHeader column={column} title="Branch" />,
      size: 80,
      cell: ({ row }) => <AccountBranchBadge branch={toBranch(row.original.account.branch)} />
    },
    {
      id: 'account',
      accessorFn: (row) => formatAccountName(row.account),
      header: ({ column }) => <DataGridColumnHeader column={column} title="Account" />,
      size: 220,
      meta: { cellClassName: 'min-w-0' },
      cell: ({ row }) => <AccountCell row={row.original} />
    }
  ]
  if (view === 'active') {
    base.push(
      { id: 'nextDue', header: 'Next Due', accessorFn: (row) => row.meta.nextDue ?? '', cell: ({ row }) => formatHistoryDate(row.original.meta.nextDue) },
      { id: 'installment', header: 'Installment', accessorFn: (row) => row.meta.installmentAmount, cell: ({ row }) => <Money value={row.original.meta.installmentAmount} /> },
      { id: 'balance', header: 'Outstanding', accessorFn: (row) => row.meta.outstandingBalance, cell: ({ row }) => <Money value={row.original.meta.outstandingBalance} emphasis /> },
      { id: 'status', header: 'Payment Status', accessorFn: (row) => accountStatusRank[row.meta.status], cell: ({ row }) => <AccountStatusBadge status={row.original.meta.status} /> }
    )
  } else if (view === 'closed') {
    base.push(
      { id: 'closedAt', header: 'Status', cell: () => <AccountStatusBadge status="closed" /> },
      { id: 'totalPaid', header: 'Total Paid', accessorFn: (row) => row.meta.totalPaid, cell: ({ row }) => <Money value={row.original.meta.totalPaid} /> },
      { id: 'balance', header: 'Balance', accessorFn: (row) => row.meta.outstandingBalance, cell: ({ row }) => <Money value={row.original.meta.outstandingBalance} /> }
    )
  } else if (view === 'blacklisted') {
    base.push(
      { id: 'status', header: 'Status', cell: () => <AccountStatusBadge status="blacklisted" /> },
      { id: 'balance', header: 'Outstanding', accessorFn: (row) => row.meta.outstandingBalance, cell: ({ row }) => <Money value={row.original.meta.outstandingBalance} emphasis /> },
      { id: 'nextDue', header: 'Next Due', accessorFn: (row) => row.meta.nextDue ?? '', cell: ({ row }) => formatHistoryDate(row.original.meta.nextDue) }
    )
  } else {
    base.push(
      { id: 'contractStatus', header: 'Status', cell: ({ row }) => <AccountStatusBadge status={row.original.meta.status} /> },
      { id: 'total', header: 'Total Payable', accessorFn: (row) => row.meta.grandTotal, cell: ({ row }) => <Money value={row.original.meta.grandTotal} /> },
      { id: 'balance', header: 'Balance', accessorFn: (row) => row.meta.outstandingBalance, cell: ({ row }) => <Money value={row.original.meta.outstandingBalance} emphasis /> }
    )
  }
  return base
}

export function StatusAccountsContent({ view }: Props): React.JSX.Element {
  const { rows, isLoading, error, reload } = useInstallmentData(view)
  const [selectedId, setSelectedId] = React.useState<string>()
  const [search, setSearch] = React.useState('')
  const [branch, setBranch] = React.useState<BranchName | 'all'>('all')
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'account', desc: false }])
  const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 25 })
  const [isFormOpen, setIsFormOpen] = React.useState(false)
  const [isInspectorOpen, setIsInspectorOpen] = React.useState(true)
  const [transition, setTransition] = React.useState<Transition>()
  const [remarks, setRemarks] = React.useState('')
  const [transitionError, setTransitionError] = React.useState<string>()
  const isSheet = useMediaQuery('(max-width: 1099px)')

  const filteredRows = React.useMemo(() => {
    const query = search.trim().toLowerCase()
    return rows.filter((row) => {
      const account = row.account
      const searchable = `${formatAccountName(account)} ${account.id} ${account.contacts.map((item) => item.value).join(' ')}`.toLowerCase()
      return (!query || searchable.includes(query)) && (branch === 'all' || account.branch === branch)
    })
  }, [branch, rows, search])
  const selected = filteredRows.find((row) => row.contractId === selectedId) ?? filteredRows[0]

  const openTransition = (kind: Transition['kind'], row: PersistedInstallmentRow): void => {
    setTransition({ kind, row })
    setRemarks('')
    setTransitionError(undefined)
  }

  const submitTransition = async (): Promise<void> => {
    if (!transition || !remarks.trim()) {
      setTransitionError('Remarks are required.')
      return
    }
    try {
      const input = {
        accountId: transition.row.account.id,
        contractId: transition.row.contractId,
        remarks,
        actorUserId: 'development-cashier'
      }
      if (transition.kind === 'close') await window.api.installments.closeContract(input)
      else await window.api.installments.blacklistAccount(input)
      setTransition(undefined)
      reload()
    } catch (caught) {
      setTransitionError(errorMessage(caught))
    }
  }

  const saveNewAccount = async (payload: InHouseAccountWorkflowSave): Promise<void> => {
    if (payload.mode !== 'new') return
    const now = new Date()
    const account = createAccount(payload.accountDraft, now)
    const loan = createLoan(account.id, payload.loanDraft, now)
    const existingAccounts = rows.map((row) => row.account)
    const existingLoans = rows.map((row) => row.loan)
    await window.api.installments.bootstrap({
      accounts: [...existingAccounts, account] as unknown as Record<string, unknown>[],
      loans: [...existingLoans, loan] as unknown as Record<string, unknown>[]
    })
    localStorage.setItem(inHouseAccountsStorageKey, JSON.stringify([...existingAccounts, account]))
    localStorage.setItem(inHouseLoansStorageKey, JSON.stringify([...existingLoans, loan]))
    setIsFormOpen(false)
    reload()
  }

  const actionItems = (row: PersistedInstallmentRow): readonly RowActionItem[] => [
    { id: 'view', label: 'View Account', onSelect: () => setSelectedId(row.contractId) },
    ...(row.contractStatus === 'ACTIVE' && view !== 'blacklisted'
      ? [
          {
            id: 'close',
            label: 'Close Account',
            onSelect: () => openTransition('close', row),
            destructive: true,
            requiresConfirmation: false
          } satisfies RowActionItem
        ]
      : []),
    ...(row.accountStatus === 'ACTIVE'
      ? [
          {
            id: 'blacklist',
            label: 'Blacklist Account',
            onSelect: () => openTransition('blacklist', row),
            destructive: true,
            requiresConfirmation: false
          } satisfies RowActionItem
        ]
      : [])
  ]

  const columns = React.useMemo(
    () => [
      ...statusColumns(view),
      createRowActionsColumn<PersistedInstallmentRow>({
        label: `Open ${view} account actions`,
        getActions: actionItems
      })
    ],
    [view, selectedId, rows]
  )
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table manages reactive table state internally.
  const table = useReactTable({
    data: filteredRows,
    columns,
    state: { sorting, pagination, rowSelection: selectedId ? { [selectedId]: true } : {} },
    enableRowSelection: true,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.contractId
  })

  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden p-3">
      <div className={cn('grid h-full min-h-0 w-full min-w-0 gap-3', isFormOpen ? 'grid-cols-1' : 'grid-cols-[minmax(0,1fr)_clamp(20rem,24vw,24rem)] max-[1099px]:grid-cols-1')}>
        {isFormOpen ? (
          <Card className="mx-auto flex min-h-0 w-full max-w-5xl flex-col">
            <CardContent className="flex min-h-0 flex-1 flex-col p-0">
              <InHouseAccountForm accounts={rows.map((row) => row.account)} onSave={(payload) => void saveNewAccount(payload)} onCancel={() => setIsFormOpen(false)} />
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="flex min-h-0 min-w-0 flex-col">
              <CardContent className="flex min-h-0 flex-1 flex-col p-0">
                <TableToolbar className="px-3">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <InputGroup className="h-8 min-w-48 max-w-md flex-1">
                      <InputGroupAddon><Search aria-hidden="true" /></InputGroupAddon>
                      <InputGroupInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search account..." aria-label="Search account" />
                    </InputGroup>
                    <Select value={branch} onValueChange={(value) => setBranch(value as BranchName | 'all')}>
                      <SelectTrigger size="sm" className="w-28" aria-label="Filter by branch"><SelectValue placeholder="Branch" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All branches</SelectItem>
                        {branchNames.map((item) => <SelectItem key={item} value={item}>{branchLabels[item]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {view === 'records' && <Button type="button" size="sm" onClick={() => setIsFormOpen(true)}><Plus data-icon="inline-start" />Add Account</Button>}
                </TableToolbar>
                {error ? <EmptyState message={error} /> : (
                  <UniversalDataTable table={table} recordCount={filteredRows.length} isLoading={isLoading} emptyMessage={`No ${view} installment records found.`} onRowClick={(row) => setSelectedId(row.contractId)} onRowDoubleClick={(row) => setSelectedId(row.contractId)} paginationSizes={[25, 50, 100]} paginationInfo="Showing {from}-{to} of {count} records" tableLayout={{ columnsResizable: true }} />
                )}
              </CardContent>
            </Card>
            {!isSheet && isInspectorOpen && <Card className="flex min-h-0 min-w-0 flex-col"><InHouseAccountInspector account={selected?.account} meta={selected?.meta} onClose={() => setIsInspectorOpen(false)} /></Card>}
          </>
        )}
      </div>
      {!isFormOpen && isSheet && (
        <Sheet open={Boolean(selectedId)} onOpenChange={(open) => !open && setSelectedId(undefined)}>
          <SheetContent side="right" showCloseButton={false} className="w-full p-0 sm:w-[clamp(20rem,70vw,24rem)]">
            <SheetHeader className="sr-only"><SheetTitle>Account details</SheetTitle><SheetDescription>Full details for the selected account.</SheetDescription></SheetHeader>
            <InHouseAccountInspector account={selected?.account} meta={selected?.meta} isSheet onClose={() => setSelectedId(undefined)} />
          </SheetContent>
        </Sheet>
      )}
      <Dialog open={Boolean(transition)} onOpenChange={(open) => !open && setTransition(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{transition?.kind === 'close' ? 'Close account' : 'Blacklist account'}</DialogTitle>
            <DialogDescription>Enter a required note for this status change.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="status-remarks">Remarks</Label>
            <Textarea id="status-remarks" value={remarks} onChange={(event) => setRemarks(event.target.value)} aria-invalid={Boolean(transitionError)} placeholder="Explain this status change..." />
            {transitionError && <p className="text-sm text-destructive">{transitionError}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTransition(undefined)}>Cancel</Button>
            <Button type="button" variant="destructive" onClick={() => void submitTransition()}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {!isInspectorOpen && !isSheet && <Button type="button" variant="outline" size="sm" className="fixed right-4 bottom-4" onClick={() => setIsInspectorOpen(true)}>Show details</Button>}
    </div>
  )
}

function EmptyState({ message }: { readonly message: string }): React.JSX.Element {
  return <div className="flex min-h-0 flex-1 items-center justify-center p-4"><Empty className="border-0"><EmptyHeader><EmptyMedia variant="icon"><FileSearch aria-hidden="true" /></EmptyMedia><EmptyTitle>Unable to load records</EmptyTitle><EmptyDescription>{message}</EmptyDescription></EmptyHeader><EmptyContent><Button type="button" variant="outline" onClick={() => window.location.reload()}>Retry</Button></EmptyContent></Empty></div>
}
