import * as React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type PaginationState,
  type RowSelectionState,
  type SortingState
} from '@tanstack/react-table'

import {
  AccountBranchBadge,
  AccountStatusBadge
} from '@/features/in-house-accounts/components/account-badges'
import {
  InHouseAccountForm,
  type InHouseAccountWorkflowSave
} from '@/features/in-house-accounts/components/account-form'
import { InHouseAccountInspector } from '@/features/in-house-accounts/components/account-inspector'
import {
  createRowActionsColumn,
  createRowSelectionColumn,
  type RowActionItem
} from '@/components/shared/data-table/row-actions'
import { TableToolbar } from '@/components/shared/data-table/table-toolbar'
import {
  ShadcnTableFilters,
  type ShadcnFilterField
} from '@/components/shared/data-table/shadcn-table-filters'
import { UniversalDataTable } from '@/components/shared/data-table/universal-data-table'
import { AdminPasswordConfirmationDialog } from '@/components/shared/admin-password-confirmation-dialog'
import { ConfirmationAlertDialog } from '@/components/shared/confirmation-alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/reui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { accountStatusRank } from '@/lib/in-house-account-display'
import type { AccountMonitoringStatus } from '@/lib/in-house-account-monitoring'
import {
  branchNames,
  createAccount,
  createLoan,
  formatAccountName,
  type BranchName
} from '@/lib/in-house-accounts'
import { formatHistoryDate, formatHistoryMoney } from '@/lib/installment-history'
import { useNotifications } from '@/hooks/use-notifications'
import {
  useInstallmentData,
  type PersistedInstallmentRow
} from '@/features/in-house-accounts/installment-data'
import type { InstallmentView } from '../../../../../shared/contracts'
import { cn } from '@/lib/utils'

type Props = {
  readonly view: InstallmentView
  readonly initialBranch?: BranchName
  readonly initialSearch?: string
  readonly onOpenPaymentWorkspace?: (
    accountId: string,
    initialTab: 'schedule' | 'ledger',
    origin: InstallmentView
  ) => void
}
type Transition = { readonly kind: 'close' | 'blacklist'; readonly row: PersistedInstallmentRow }

const activePaymentStatuses: readonly { value: AccountMonitoringStatus; label: string }[] = [
  { value: 'overdue', label: 'Overdue' },
  { value: 'due-soon', label: 'Due Soon' },
  { value: 'fully-paid', label: 'Fully Paid' }
]

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

function Money({
  value,
  emphasis = false
}: {
  readonly value?: number
  readonly emphasis?: boolean
}): React.JSX.Element {
  return (
    <span className={cn('tabular-nums', emphasis && 'font-light')}>
      {formatHistoryMoney(value)}
    </span>
  )
}

function AccountCell({ row }: { readonly row: PersistedInstallmentRow }): React.JSX.Element {
  return (
    <div className="min-w-0">
      <span className="block truncate font-light">{formatAccountName(row.account)}</span>
      <span className="block truncate text-xs text-muted-foreground">{row.account.id}</span>
    </div>
  )
}

function statusColumns(view: InstallmentView): ColumnDef<PersistedInstallmentRow>[] {
  const base: ColumnDef<PersistedInstallmentRow>[] = [
    {
      id: 'branch',
      accessorFn: (row) => row.account.branch,
      header: 'Branch',
      size: 42,
      cell: ({ row }) => <AccountBranchBadge branch={toBranch(row.original.account.branch)} />
    },
    {
      id: 'account',
      accessorFn: (row) => formatAccountName(row.account),
      header: 'Account',
      size: 220,
      meta: { cellClassName: 'min-w-0' },
      cell: ({ row }) => <AccountCell row={row.original} />
    }
  ]
  if (view === 'active') {
    base.push(
      {
        id: 'nextDue',
        header: 'Next Due',
        size: 90,
        accessorFn: (row) => row.meta.nextDue ?? '',
        cell: ({ row }) => formatHistoryDate(row.original.meta.nextDue)
      },
      {
        id: 'installment',
        header: 'Installment',
        size: 135,
        accessorFn: (row) => row.meta.installmentAmount,
        cell: ({ row }) => <Money value={row.original.meta.installmentAmount} />
      },
      {
        id: 'balance',
        header: 'Outstanding',
        size: 135,
        accessorFn: (row) => row.meta.outstandingBalance,
        cell: ({ row }) => <Money value={row.original.meta.outstandingBalance} emphasis />
      },
      {
        id: 'status',
        header: 'Payment Status',
        size: 120,
        accessorFn: (row) => accountStatusRank[row.meta.status],
        cell: ({ row }) => <AccountStatusBadge status={row.original.meta.status} />
      }
    )
  } else if (view === 'closed') {
    base.push(
      {
        id: 'closedAt',
        accessorFn: (row) => row.meta.status,
        header: 'Status',
        size: 90,
        cell: () => <AccountStatusBadge status="closed" />
      },
      {
        id: 'totalPaid',
        header: 'Total Paid',
        size: 120,
        accessorFn: (row) => row.meta.totalPaid,
        cell: ({ row }) => <Money value={row.original.meta.totalPaid} />
      },
      {
        id: 'balance',
        header: 'Balance',
        size: 90,
        accessorFn: (row) => row.meta.outstandingBalance,
        cell: ({ row }) => <Money value={row.original.meta.outstandingBalance} />
      }
    )
  } else if (view === 'blacklisted') {
    base.push(
      {
        id: 'status',
        accessorFn: (row) => row.meta.status,
        header: 'Status',
        size: 90,
        cell: () => <AccountStatusBadge status="blacklisted" />
      },
      {
        id: 'balance',
        header: 'Outstanding',
        size: 90,
        accessorFn: (row) => row.meta.outstandingBalance,
        cell: ({ row }) => <Money value={row.original.meta.outstandingBalance} emphasis />
      },
      {
        id: 'remarks',
        header: 'Remarks',
        accessorFn: (row) => row.loan.remarks ?? '',
        cell: ({ row }) => row.original.loan.remarks || '—'
      }
    )
  } else {
    base.push(
      {
        id: 'contractStatus',
        accessorFn: (row) => row.meta.status,
        header: 'Status',
        size: 90,
        cell: ({ row }) => <AccountStatusBadge status={row.original.meta.status} />
      },
      {
        id: 'total',
        header: 'Total Payable',
        accessorFn: (row) => row.meta.grandTotal,
        cell: ({ row }) => <Money value={row.original.meta.grandTotal} />
      },
      {
        id: 'balance',
        header: 'Balance',
        accessorFn: (row) => row.meta.outstandingBalance,
        cell: ({ row }) => <Money value={row.original.meta.outstandingBalance} emphasis />
      }
    )
  }
  return base
}

export function StatusAccountsContent({
  view,
  initialBranch,
  initialSearch,
  onOpenPaymentWorkspace
}: Props): React.JSX.Element {
  const { rows, isLoading, error, reload } = useInstallmentData(view)
  const [selectedId, setSelectedId] = React.useState<string>()
  const [search, setSearch] = React.useState(initialSearch ?? '')
  const [branch, setBranch] = React.useState<BranchName | 'all'>(initialBranch ?? 'all')
  const [paymentStatus, setPaymentStatus] = React.useState<AccountMonitoringStatus | 'all'>('all')
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'account', desc: false }])
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25
  })
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = React.useState(false)
  const [isFormOpen, setIsFormOpen] = React.useState(false)
  const [isFormDirty, setIsFormDirty] = React.useState(false)
  const [isDiscardConfirmationOpen, setIsDiscardConfirmationOpen] = React.useState(false)
  const [isInspectorOpen, setIsInspectorOpen] = React.useState(true)
  const [isAccountModalOpen, setIsAccountModalOpen] = React.useState(false)
  const [transition, setTransition] = React.useState<Transition>()
  const [remarks, setRemarks] = React.useState('')
  const [transitionError, setTransitionError] = React.useState<string>()
  const [isTransitionSubmitting, setIsTransitionSubmitting] = React.useState(false)
  const isAdmin = initialBranch === undefined
  const isSheet = useMediaQuery('(max-width: 1099px)')
  const { notify } = useNotifications()
  const handleRowSelectionChange = React.useCallback<OnChangeFn<RowSelectionState>>((updater) => {
    setRowSelection((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater
      return next
    })
  }, [])

  const filteredRows = React.useMemo(() => {
    const query = search.trim().toLowerCase()
    return rows.filter((row) => {
      const account = row.account
      const searchable =
        `${formatAccountName(account)} ${account.id} ${account.branch} ${row.contractId} ${row.meta.status} ${row.meta.nextDue ?? ''} ${row.meta.paymentFrequency ?? ''} ${account.contacts.map((item) => item.value).join(' ')}`.toLowerCase()
      return (
        (!query || searchable.includes(query)) &&
        (branch === 'all' || account.branch === branch) &&
        (view !== 'active' || paymentStatus === 'all' || row.meta.status === paymentStatus)
      )
    })
  }, [branch, paymentStatus, rows, search, view])
  const filterFields = React.useMemo<ShadcnFilterField[]>(
    () => [
      {
        key: 'search',
        label: 'Search accounts',
        type: 'text' as const,
        placeholder: 'Search account or contact...'
      },
      {
        key: 'branch',
        label: 'Branch',
        options: branchNames.map((item) => ({ value: item, label: item }))
      }
    ],
    []
  )
  const filters = React.useMemo(() => {
    const next: Array<{ field: string; value: string }> = []
    if (search.trim()) next.push({ field: 'search', value: search })
    if (branch !== 'all') next.push({ field: 'branch', value: branch })
    return next
  }, [branch, search])
  const handleFiltersChange = (next: Array<{ field: string; value: string }>): void => {
    setSearch(next.find((filter) => filter.field === 'search')?.value ?? '')
    setBranch(
      (next.find((filter) => filter.field === 'branch')?.value as BranchName | undefined) ?? 'all'
    )
  }
  const statusCount = (status: AccountMonitoringStatus): number =>
    rows.filter((row) => {
      const branchMatches =
        isAdmin && branch === 'all'
          ? true
          : row.account.branch === (branch === 'all' ? initialBranch : branch)
      return branchMatches && row.meta.status === status
    }).length
  const selected = filteredRows.find((row) => row.contractId === selectedId) ?? filteredRows[0]

  const handleRowDoubleClick = React.useCallback(
    (row: PersistedInstallmentRow): void => {
      setSelectedId(row.contractId)
      if (view === 'active') {
        onOpenPaymentWorkspace?.(row.account.id, 'schedule', view)
        return
      }
      setIsAccountModalOpen(true)
    },
    [onOpenPaymentWorkspace, view]
  )

  const openTransition = React.useCallback(
    (kind: Transition['kind'], row: PersistedInstallmentRow): void => {
      setTransition({ kind, row })
      setRemarks('')
      setTransitionError(undefined)
    },
    []
  )

  const submitTransition = async (): Promise<void> => {
    if (isTransitionSubmitting) return
    if (!transition || !remarks.trim()) {
      setTransitionError('Remarks are required.')
      return
    }
    setIsTransitionSubmitting(true)
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
      setSelectedId(undefined)
      setRowSelection({})
      await reload()
      notify({
        type: 'success',
        title: transition.kind === 'close' ? 'Account closed.' : 'Account blacklisted.'
      })
    } catch (caught) {
      setTransitionError(errorMessage(caught))
    } finally {
      setIsTransitionSubmitting(false)
    }
  }

  const saveNewAccount = async (payload: InHouseAccountWorkflowSave): Promise<void> => {
    const now = new Date()
    const account =
      payload.mode === 'new'
        ? createAccount(payload.accountDraft, now)
        : {
            ...payload.accountDraft,
            id: payload.customerId,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString()
          }
    const loan = createLoan(account.id, payload.loanDraft, now)
    const existingAccounts = rows.map((row) => row.account)
    const existingLoans = rows.map((row) => row.loan)
    const accounts = [...existingAccounts.filter((item) => item.id !== account.id), account]
    await window.api.installments.bootstrap({
      accounts: accounts as unknown as Record<string, unknown>[],
      loans: [...existingLoans, loan] as unknown as Record<string, unknown>[]
    })
    setIsFormOpen(false)
    setIsFormDirty(false)
    await reload()
    notify({
      type: 'success',
      title:
        payload.mode === 'new' ? 'Account and loan created.' : 'Account updated and loan created.'
    })
  }

  const requestFormClose = (): void => {
    if (isFormDirty) {
      setIsDiscardConfirmationOpen(true)
      return
    }
    setIsFormOpen(false)
  }

  const actionItems = React.useCallback(
    (row: PersistedInstallmentRow): readonly RowActionItem[] => [
      { id: 'view', label: 'View Account', onSelect: () => setSelectedId(row.contractId) },
      {
        id: 'client-information',
        label: 'All client information',
        onSelect: () => {
          setSelectedId(row.contractId)
          setIsAccountModalOpen(true)
        }
      },
      ...(row.contractStatus === 'ACTIVE' &&
      row.accountStatus === 'ACTIVE' &&
      onOpenPaymentWorkspace
        ? [
            {
              id: 'record-payment',
              label: 'Record Payment',
              onSelect: () => onOpenPaymentWorkspace(row.account.id, 'schedule', view)
            } satisfies RowActionItem
          ]
        : []),
      ...(onOpenPaymentWorkspace
        ? [
            {
              id: 'view-ledger',
              label: 'View Ledger',
              onSelect: () => onOpenPaymentWorkspace(row.account.id, 'ledger', view)
            } satisfies RowActionItem
          ]
        : []),
      ...(row.contractStatus === 'ACTIVE' &&
      row.meta.outstandingBalance === 0 &&
      view !== 'blacklisted'
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
    ],
    [onOpenPaymentWorkspace, openTransition, view]
  )

  const columns = React.useMemo(
    () => [
      createRowSelectionColumn<PersistedInstallmentRow>(),
      ...statusColumns(view),
      createRowActionsColumn<PersistedInstallmentRow>({
        label: `Open ${view} account actions`,
        getActions: actionItems
      })
    ],
    [actionItems, view]
  )
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table manages reactive table state internally.
  const table = useReactTable({
    data: filteredRows,
    columns,
    state: { sorting, pagination, rowSelection },
    enableRowSelection: true,
    onRowSelectionChange: handleRowSelectionChange,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.contractId
  })

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-3">
      <TableToolbar className="flex-wrap gap-3 border-b-0 bg-transparent px-0 py-3">
        <ShadcnTableFilters
          filters={filters}
          fields={filterFields}
          onChange={handleFiltersChange}
          className="shrink-0"
        />
        {view === 'active' &&
          activePaymentStatuses.map((status) => (
            <Button
              key={status.value}
              type="button"
              size="sm"
              variant={paymentStatus === status.value ? 'secondary' : 'outline'}
              className="gap-2"
              aria-pressed={paymentStatus === status.value}
              onClick={() =>
                setPaymentStatus((current) => (current === status.value ? 'all' : status.value))
              }
            >
              {status.label}
              <Badge variant="destructive-outline" size="sm" aria-hidden="true">
                {statusCount(status.value)}
              </Badge>
            </Button>
          ))}
        <div className="ml-auto flex items-center gap-2">
          {view === 'records' && (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setIsFormDirty(false)
                setIsFormOpen(true)
              }}
            >
              <Plus data-icon="inline-start" />
              Add Account
            </Button>
          )}
          {Object.keys(rowSelection).length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => setIsDeleteConfirmationOpen(true)}
            >
              <Trash2 data-icon="inline-start" />
              Void {Object.keys(rowSelection).length} selected
            </Button>
          )}
        </div>
      </TableToolbar>
      <div className="grid min-h-0 flex-1 w-full min-w-0 grid-cols-[minmax(0,1fr)_clamp(20rem,24vw,24rem)] gap-3 max-[1099px]:grid-cols-1">
        <Card className="flex min-h-0 min-w-0 flex-col">
          <CardContent className="flex min-h-0 flex-1 flex-col p-0">
            <UniversalDataTable
              table={table}
              recordCount={filteredRows.length}
              isLoading={isLoading}
              error={error}
              onRetry={() => void reload()}
              emptyMessage={`No ${view} installment records found.`}
              onRowClick={(row) => setSelectedId(row.contractId)}
              onRowDoubleClick={handleRowDoubleClick}
              paginationSizes={[25, 50, 100]}
              paginationInfo="Showing {from}-{to} of {count} records"
              tableLayout={{ columnsResizable: true }}
            />
          </CardContent>
        </Card>
        {!isSheet && isInspectorOpen && (
          <Card className="flex min-h-0 min-w-0 flex-col">
            <InHouseAccountInspector
              account={selected?.account}
              loans={
                selected
                  ? rows
                      .filter((row) => row.account.id === selected.account.id)
                      .map((row) => row.loan)
                  : []
              }
              meta={selected?.meta}
              onRecordPayment={
                onOpenPaymentWorkspace &&
                selected?.contractStatus === 'ACTIVE' &&
                selected.accountStatus === 'ACTIVE'
                  ? (account) => onOpenPaymentWorkspace(account.id, 'schedule', view)
                  : undefined
              }
              onViewLedger={
                onOpenPaymentWorkspace
                  ? (account) => onOpenPaymentWorkspace(account.id, 'ledger', view)
                  : undefined
              }
              onClose={() => {
                setSelectedId(undefined)
                setIsInspectorOpen(false)
              }}
            />
          </Card>
        )}
      </div>
      {isSheet && (
        <Sheet
          open={Boolean(selectedId)}
          onOpenChange={(open) => !open && setSelectedId(undefined)}
        >
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
              account={selected?.account}
              loans={
                selected
                  ? rows
                      .filter((row) => row.account.id === selected.account.id)
                      .map((row) => row.loan)
                  : []
              }
              meta={selected?.meta}
              isSheet
              onRecordPayment={
                onOpenPaymentWorkspace &&
                selected?.contractStatus === 'ACTIVE' &&
                selected.accountStatus === 'ACTIVE'
                  ? (account) => onOpenPaymentWorkspace(account.id, 'schedule', view)
                  : undefined
              }
              onViewLedger={
                onOpenPaymentWorkspace
                  ? (account) => onOpenPaymentWorkspace(account.id, 'ledger', view)
                  : undefined
              }
              onClose={() => setSelectedId(undefined)}
            />
          </SheetContent>
        </Sheet>
      )}
      <Dialog open={isAccountModalOpen} onOpenChange={setIsAccountModalOpen}>
        <DialogContent className="flex h-[min(90vh,56rem)] max-h-[calc(100dvh-2rem)] w-[min(58rem,calc(100vw-2rem))] flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b bg-muted/20 px-6 py-4 pr-12">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Client record
            </p>
            <DialogTitle>All client information</DialogTitle>
            <DialogDescription>
              Account identity, contact details, financial status, and complete loan history.
            </DialogDescription>
          </DialogHeader>
          <InHouseAccountInspector
            account={selected?.account}
            loans={
              selected
                ? rows
                    .filter((row) => row.account.id === selected.account.id)
                    .map((row) => row.loan)
                : []
            }
            meta={selected?.meta}
            isSheet
            hideHeader
            onClose={() => setIsAccountModalOpen(false)}
            onViewLedger={
              onOpenPaymentWorkspace
                ? (account) => onOpenPaymentWorkspace(account.id, 'ledger', view)
                : undefined
            }
          />
        </DialogContent>
      </Dialog>
      <Dialog
        open={isFormOpen}
        onOpenChange={(open) => (open ? setIsFormOpen(true) : requestFormClose())}
      >
        <DialogContent className="flex h-[min(48rem,calc(100dvh-2rem))] max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
          <DialogHeader className="shrink-0 border-b px-6 py-5 pr-12">
            <DialogTitle>Add Account &amp; Loan</DialogTitle>
            <DialogDescription>
              Create a new customer account and its initial loan in one entry.
            </DialogDescription>
          </DialogHeader>
          <InHouseAccountForm
            onSave={saveNewAccount}
            onCancel={requestFormClose}
            onDirtyChange={setIsFormDirty}
            existingRows={rows}
          />
        </DialogContent>
      </Dialog>
      <ConfirmationAlertDialog
        open={isDiscardConfirmationOpen}
        title="Discard account draft?"
        description="Your entered account and loan details will be lost."
        confirmLabel="Discard draft"
        destructive
        onOpenChange={setIsDiscardConfirmationOpen}
        onConfirm={() => {
          setIsDiscardConfirmationOpen(false)
          setIsFormDirty(false)
          setIsFormOpen(false)
        }}
      />
      <Dialog open={Boolean(transition)} onOpenChange={(open) => !open && setTransition(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {transition?.kind === 'close' ? 'Close account' : 'Blacklist account'}
            </DialogTitle>
            <DialogDescription>Enter a required note for this status change.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="status-remarks">Remarks</Label>
            <Textarea
              id="status-remarks"
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              aria-invalid={Boolean(transitionError)}
              placeholder="Explain this status change..."
            />
            {transitionError && <p className="text-sm text-destructive">{transitionError}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTransition(undefined)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void submitTransition()}
              disabled={isTransitionSubmitting}
            >
              {isTransitionSubmitting ? 'Updating…' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AdminPasswordConfirmationDialog
        open={isDeleteConfirmationOpen}
        title={`Void ${Object.keys(rowSelection).length} selected account${Object.keys(rowSelection).length === 1 ? '' : 's'}?`}
        description="This voids the selected accounts from the workspace. Their financial history is preserved."
        onOpenChange={setIsDeleteConfirmationOpen}
        onConfirm={async (password) => {
          const contractIds = Object.keys(rowSelection)
          await window.api.installments.void({
            contractIds,
            password,
            reason: 'Voided by administrator.'
          })
          setRowSelection({})
          setSelectedId(undefined)
          await reload()
          notify({ type: 'success', title: 'Selected accounts voided.' })
        }}
      />
      {!isInspectorOpen && !isSheet && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="fixed right-4 bottom-4"
          onClick={() => setIsInspectorOpen(true)}
        >
          Show details
        </Button>
      )}
    </div>
  )
}
