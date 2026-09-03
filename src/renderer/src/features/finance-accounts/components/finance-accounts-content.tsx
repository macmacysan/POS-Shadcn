import * as React from 'react'
import { ChevronDown, Plus, Trash2 } from 'lucide-react'
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

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { DatePickerInput } from '@/components/ui/date-picker-input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer'
import { Textarea } from '@/components/ui/textarea'
import { TableCell, TableRow } from '@/components/ui/table'
import {
  createRowActionsColumn,
  type RowActionItem
} from '@/components/shared/data-table/row-actions'
import { TableToolbar } from '@/components/shared/data-table/table-toolbar'
import { SearchInputGroup } from '@/components/ui/search-input-group'
import {
  ShadcnTableFilters,
  type ShadcnFilterField
} from '@/components/shared/data-table/shadcn-table-filters'
import { UniversalDataTable } from '@/components/shared/data-table/universal-data-table'
import { AdminPasswordConfirmationDialog } from '@/components/shared/admin-password-confirmation-dialog'
import { AccountBranchBadge } from '@/features/in-house-accounts/components/account-badges'
import { ProductCombobox } from '@/components/shared/product-combobox'
import { suffixOptions } from '@/lib/in-house-accounts'
import { useNotifications } from '@/hooks/use-notifications'
import { calculateFinanceAmounts } from '../../../../../shared/finance-calculations'
import {
  financeAccountInputSchema,
  financeBranchValues,
  financeProviderValues,
  type CatalogOptionRecord,
  type FinanceAccountInput,
  type FinanceAccountRecord,
  type FinanceItemInput,
  type ProductCatalogItem
} from '../../../../../shared/contracts'
import type { LoginBranch } from '../../../../../shared/contracts'

type Props = {
  readonly selectedBranch: LoginBranch
  readonly initialSearch?: string
  readonly initialEditId?: string
  readonly onReturnToHistory?: () => void
}
type FinanceItemFormValues = Omit<FinanceItemInput, 'itemPriceCentavos'> & {
  id: string
  itemPrice: string
}
type FinanceFormValues = Omit<FinanceAccountInput, 'items' | 'downpaymentCentavos'> & {
  items: FinanceItemFormValues[]
  downpayment: string
}
type FinanceTableRow = FinanceAccountRecord

const moneyFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2
})

function formatMoney(centavos: number): string {
  return moneyFormatter.format(centavos / 100)
}

function text(value?: string): string {
  return value || '—'
}

function asCentavos(value: string): number {
  const amount = Number(value)
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0
}

function createItem(): FinanceItemFormValues {
  return { id: crypto.randomUUID(), item: '', serialNo: '', quantity: 1, itemPrice: '' }
}

function blankForm(branch: FinanceAccountRecord['branch']): FinanceFormValues {
  return {
    branch,
    provider: 'Home Credit',
    dateReleased: new Date().toISOString().slice(0, 10),
    termsMonths: 1,
    lastName: '',
    firstName: '',
    middleName: '',
    suffix: '',
    items: [createItem()],
    downpayment: '',
    orNumber: '',
    orDate: undefined,
    paidDate: undefined,
    remarks: ''
  }
}

function recordForm(record: FinanceAccountRecord): FinanceFormValues {
  return {
    branch: record.branch,
    provider: record.provider,
    dateReleased: record.dateReleased,
    termsMonths: record.termsMonths,
    lastName: record.lastName,
    firstName: record.firstName,
    middleName: record.middleName ?? '',
    suffix: record.suffix ?? '',
    items: record.items.map((item) => ({
      ...item,
      itemPrice: (item.itemPriceCentavos / 100).toFixed(2)
    })),
    downpayment: (record.downpaymentCentavos / 100).toFixed(2),
    orNumber: record.orNumber ?? '',
    orDate: record.orDate,
    paidDate: record.paidDate,
    remarks: record.remarks ?? ''
  }
}

function toInput(values: FinanceFormValues): FinanceAccountInput {
  return {
    branch: values.branch,
    provider: values.provider,
    dateReleased: values.dateReleased,
    termsMonths: values.termsMonths,
    lastName: values.lastName,
    firstName: values.firstName,
    middleName: values.middleName?.trim() || undefined,
    suffix: values.suffix?.trim() || undefined,
    items: values.items.map(({ item, serialNo, quantity, itemPrice }) => ({
      item,
      serialNo: serialNo?.trim() || undefined,
      quantity,
      itemPriceCentavos: asCentavos(itemPrice)
    })),
    downpaymentCentavos: asCentavos(values.downpayment),
    orNumber: values.orNumber?.trim() || undefined,
    orDate: values.orDate || undefined,
    paidDate: values.paidDate || undefined,
    remarks: values.remarks?.trim() || undefined
  }
}

function errorMessage(error: unknown): string {
  return error && typeof error === 'object' && 'message' in error
    ? String(error.message)
    : 'The finance account could not be saved.'
}

function Cell({
  children,
  money = false
}: {
  readonly children: React.ReactNode
  readonly money?: boolean
}): React.JSX.Element {
  return (
    <span
      className={
        money
          ? 'block text-right text-sm font-light tabular-nums'
          : 'block truncate text-sm font-light'
      }
    >
      {children}
    </span>
  )
}

function financeColumns(expandedIds: ReadonlySet<string>): ColumnDef<FinanceTableRow>[] {
  return [
    {
      id: 'branch',
      accessorFn: (row) => row.branch,
      header: 'Branch',
      cell: ({ row }) => (
        <span className="flex items-center gap-1">
          <ChevronDown
            className={expandedIds.has(row.original.id) ? 'rotate-180' : ''}
            aria-hidden="true"
          />
          <AccountBranchBadge branch={row.original.branch} />
        </span>
      ),
      size: 42
    },
    {
      id: 'provider',
      accessorFn: (row) => row.provider,
      header: 'Type',
      cell: ({ row }) => <Badge variant="secondary">{row.original.provider}</Badge>,
      size: 120
    },
    {
      id: 'dateReleased',
      accessorFn: (row) => row.dateReleased,
      header: 'Date Release',
      cell: ({ row }) => <Cell>{row.original.dateReleased}</Cell>,
      size: 112
    },
    {
      id: 'paidStatus',
      accessorFn: (row) => row.paidDate,
      header: 'Paid',
      cell: ({ row }) => (row.original.paidDate ? <Badge>PAID</Badge> : <Cell>{text()}</Cell>),
      size: 78
    },
    {
      id: 'status',
      accessorFn: (row) => row.status,
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.status === 'VOIDED' ? 'destructive' : 'secondary'}>
          {row.original.status}
        </Badge>
      ),
      size: 92
    },
    {
      id: 'termsMonths',
      accessorFn: (row) => row.termsMonths,
      header: 'Terms',
      cell: ({ row }) => (
        <Cell>
          {row.original.termsMonths} month
          {row.original.termsMonths === 1 ? '' : 's'}
        </Cell>
      ),
      size: 92
    },
    {
      id: 'name',
      accessorFn: (row) =>
        [`${row.lastName},`, row.firstName, row.middleName, row.suffix].filter(Boolean).join(' '),
      header: 'Client Name',
      cell: ({ getValue }) => <Cell>{getValue<string>()}</Cell>,
      size: 180
    },
    {
      id: 'grandTotal',
      accessorFn: (row) => row.grandTotalCentavos,
      header: 'Grand Total',
      cell: ({ row }) => <Cell money>{formatMoney(row.original.grandTotalCentavos)}</Cell>,
      size: 128
    },
    {
      id: 'downpayment',
      accessorFn: (row) => row.downpaymentCentavos,
      header: 'Downpayment',
      cell: ({ row }) => <Cell money>{formatMoney(row.original.downpaymentCentavos)}</Cell>,
      size: 128
    },
    {
      id: 'balance',
      accessorFn: (row) => row.balanceCentavos,
      header: 'Balance',
      cell: ({ row }) => <Cell money>{formatMoney(row.original.balanceCentavos)}</Cell>,
      size: 120
    }
  ]
}

export function FinanceAccountsContent({
  selectedBranch,
  initialSearch,
  initialEditId,
  onReturnToHistory
}: Props): React.JSX.Element {
  const [accounts, setAccounts] = React.useState<FinanceAccountRecord[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string>()
  const [search, setSearch] = React.useState(initialSearch ?? '')
  const [branch, setBranch] = React.useState('')
  const [provider, setProvider] = React.useState('')
  const [dateFrom, setDateFrom] = React.useState('')
  const [dateTo, setDateTo] = React.useState('')
  const [terms, setTerms] = React.useState('')
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'dateReleased', desc: true }])
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25
  })
  const [editing, setEditing] = React.useState<FinanceAccountRecord>()
  const [isCreating, setIsCreating] = React.useState(false)
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set())
  const openedInitialEditRef = React.useRef<string | undefined>(undefined)
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = React.useState(false)
  const [includeVoided, setIncludeVoided] = React.useState(false)
  const filters = [
    ...(branch ? [{ field: 'branch', value: branch }] : []),
    ...(provider ? [{ field: 'provider', value: provider }] : []),
    ...(dateFrom ? [{ field: 'dateFrom', value: dateFrom }] : []),
    ...(dateTo ? [{ field: 'dateTo', value: dateTo }] : []),
    ...(terms ? [{ field: 'terms', value: terms }] : [])
  ]
  const { notify } = useNotifications()
  const handleRowSelectionChange = React.useCallback<OnChangeFn<RowSelectionState>>((updater) => {
    setRowSelection((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater
      return next
    })
  }, [])

  const reload = React.useCallback(async (): Promise<void> => {
    setIsLoading(true)
    setLoadError(undefined)
    try {
      const result = await window.api.financeAccounts.list({ search: '', includeVoided })
      setAccounts(result.rows)
    } catch (caught) {
      setLoadError(errorMessage(caught))
    } finally {
      setIsLoading(false)
    }
  }, [includeVoided])
  React.useEffect(() => {
    void reload()
  }, [reload])
  React.useEffect(() => {
    if (!initialEditId || openedInitialEditRef.current === initialEditId) return
    const account = accounts.find((item) => item.id === initialEditId)
    if (!account) return
    openedInitialEditRef.current = initialEditId
    setRowSelection({ [account.id]: true })
    setEditing(account)
  }, [accounts, initialEditId])

  const rows = accounts
  const financeFilterFields = React.useMemo<ShadcnFilterField[]>(
    () => [
      {
        key: 'branch',
        label: 'Branch',
        options: financeBranchValues.map((value) => ({ value, label: value }))
      },
      {
        key: 'provider',
        label: 'Type',
        options: [...new Set(rows.map((account) => account.provider))]
          .sort()
          .map((value) => ({ value, label: value }))
      },
      {
        key: 'date',
        label: 'Date released',
        type: 'range',
        inputType: 'date',
        minKey: 'dateFrom',
        maxKey: 'dateTo',
        minPlaceholder: 'From',
        maxPlaceholder: 'To'
      },
      {
        key: 'terms',
        label: 'Terms',
        options: [...new Set(rows.map((account) => String(account.termsMonths)))]
          .sort((left, right) => Number(left) - Number(right))
          .map((value) => ({
            value,
            label: `${value} month${value === '1' ? '' : 's'}`
          }))
      }
    ],
    [rows]
  )
  const filteredRows = React.useMemo(() => {
    const query = search.trim().toLowerCase()
    const scopedRows = rows
    return scopedRows.filter(
      (account) =>
        (!branch || account.branch === branch) &&
        (!provider || account.provider === provider) &&
        (!dateFrom || account.dateReleased >= dateFrom) &&
        (!dateTo || account.dateReleased <= dateTo) &&
        (!terms || account.termsMonths === Number(terms)) &&
        (!query ||
          [
            account.branch,
            account.provider,
            account.lastName,
            account.firstName,
            account.middleName,
            account.suffix,
            ...account.items.flatMap((item) => [item.item, item.serialNo]),
            account.orNumber,
            account.remarks
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(query))
    )
  }, [branch, dateFrom, dateTo, provider, rows, search, selectedBranch, terms])
  const actions = React.useCallback(
    (row: FinanceTableRow): readonly RowActionItem[] =>
      row.status === 'VOIDED'
        ? selectedBranch === 'All Branch'
          ? [
              {
                id: 'unvoid',
                label: 'Unvoid finance account',
                onSelect: async () => {
                  await window.api.financeAccounts.unvoid({ ids: [row.id] })
                  await reload()
                  notify({ type: 'success', title: 'Finance account restored.' })
                }
              }
            ]
          : []
        : selectedBranch !== 'All Branch' && row.branch === selectedBranch
          ? [{ id: 'edit', label: 'Edit finance account', onSelect: () => setEditing(row) }]
          : [],
    [notify, reload, selectedBranch]
  )
  const columns = React.useMemo(
    () => [
      ...financeColumns(expandedIds),
      createRowActionsColumn<FinanceTableRow>({
        label: 'Open finance account actions',
        getActions: actions
      })
    ],
    [actions, expandedIds]
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
    getRowId: (row) => row.id
  })
  const selectedAccountIds = React.useMemo(
    () => [...new Set(filteredRows.filter((row) => rowSelection[row.id]).map((row) => row.id))],
    [filteredRows, rowSelection]
  )
  const closeForm = (): void => {
    setIsCreating(false)
    setEditing(undefined)
    if (initialEditId && onReturnToHistory) onReturnToHistory()
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-3">
      <TableToolbar className="flex-wrap gap-3 border-b-0 bg-transparent px-0 py-3">
        <SearchInputGroup
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPagination((current) => ({ ...current, pageIndex: 0 }))
          }}
          placeholder="Search finance accounts..."
          aria-label="Search finance accounts"
        />
        <ShadcnTableFilters
          fields={financeFilterFields}
          filters={filters}
          onChange={(next) => {
            setBranch(next.find((filter) => filter.field === 'branch')?.value ?? '')
            setProvider(next.find((filter) => filter.field === 'provider')?.value ?? '')
            setDateFrom(next.find((filter) => filter.field === 'dateFrom')?.value ?? '')
            setDateTo(next.find((filter) => filter.field === 'dateTo')?.value ?? '')
            setTerms(next.find((filter) => filter.field === 'terms')?.value ?? '')
          }}
          className="shrink-0"
        />
        <div className="ml-auto flex items-center gap-2">
          {selectedBranch !== 'All Branch' && (
            <Button type="button" size="sm" onClick={() => setIsCreating(true)}>
              <Plus data-icon="inline-start" />
              Add Finance Account
            </Button>
          )}
          {selectedBranch === 'All Branch' && (
            <Button
              type="button"
              size="sm"
              variant={includeVoided ? 'secondary' : 'outline'}
              onClick={() => setIncludeVoided((value) => !value)}
            >
              {includeVoided ? 'Hide Voided' : 'Include Voided'}
            </Button>
          )}
          {selectedAccountIds.length > 0 &&
            selectedBranch !== 'All Branch' &&
            selectedAccountIds.every(
              (id) => rows.find((row) => row.id === id)?.status === 'POSTED'
            ) &&
            selectedAccountIds.every(
              (id) => rows.find((row) => row.id === id)?.branch === selectedBranch
            ) && (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => setIsDeleteConfirmationOpen(true)}
              >
                <Trash2 data-icon="inline-start" />
                Void {selectedAccountIds.length} selected
              </Button>
            )}
        </div>
      </TableToolbar>
      <Card className="flex min-h-0 min-w-0 flex-1 flex-col">
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          <UniversalDataTable
            table={table}
            recordCount={filteredRows.length}
            isLoading={isLoading}
            error={loadError}
            onRetry={() => void reload()}
            emptyMessage="No finance accounts found."
            paginationSizes={[25, 50, 100]}
            paginationInfo="Showing {from}-{to} of {count} items"
            tableLayout={{ columnsResizable: true }}
            onRowClick={(row) =>
              setExpandedIds((current) => {
                const next = new Set(current)
                next.has(row.id) ? next.delete(row.id) : next.add(row.id)
                return next
              })
            }
            renderExpandedRow={(row) =>
              expandedIds.has(row.id) ? (
                <TableRow key={`${row.id}-items`}>
                  <TableCell colSpan={columns.length} className="p-0">
                    <Collapsible open>
                      <CollapsibleContent className="bg-muted/20 p-3">
                        <div className="mb-3 grid w-fit max-w-full grid-cols-[8rem_8rem_8rem_16rem] gap-3 overflow-hidden">
                          <div>
                            <span className="block text-xs font-medium text-muted-foreground">
                              OR#
                            </span>
                            <Cell>{text(row.orNumber)}</Cell>
                          </div>
                          <div>
                            <span className="block text-xs font-medium text-muted-foreground">
                              OR Date
                            </span>
                            <Cell>{text(row.orDate)}</Cell>
                          </div>
                          <div>
                            <span className="block text-xs font-medium text-muted-foreground">
                              Paid Date
                            </span>
                            <Cell>{text(row.paidDate)}</Cell>
                          </div>
                          <div>
                            <span className="block text-xs font-medium text-muted-foreground">
                              Remarks
                            </span>
                            <Cell>{text(row.remarks)}</Cell>
                          </div>
                        </div>
                        <div className="grid w-fit max-w-full grid-cols-[3rem_12rem_8rem_6rem_6rem] gap-1 overflow-hidden text-xs">
                          <span className="font-medium text-muted-foreground">QTY</span>
                          <span className="font-medium text-muted-foreground">Item</span>
                          <span className="font-medium text-muted-foreground">Serial No.</span>
                          <span className="text-right font-medium text-muted-foreground">
                            Item Price
                          </span>
                          <span className="text-right font-medium text-muted-foreground">
                            Total
                          </span>
                          {row.items.map((item) => (
                            <React.Fragment key={item.id}>
                              <Cell>{item.quantity}</Cell>
                              <Cell>{item.item}</Cell>
                              <Cell>{item.serialNo || '—'}</Cell>
                              <Cell money>{formatMoney(item.itemPriceCentavos)}</Cell>
                              <Cell money>{formatMoney(item.totalCentavos)}</Cell>
                            </React.Fragment>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </TableCell>
                </TableRow>
              ) : null
            }
          />
        </CardContent>
      </Card>
      <FinanceAccountSheet
        open={isCreating || Boolean(editing)}
        record={editing}
        initialBranch={selectedBranch === 'All Branch' ? financeBranchValues[0] : selectedBranch}
        onClose={closeForm}
        onSaved={() => {
          closeForm()
          void reload()
        }}
      />
      <AdminPasswordConfirmationDialog
        open={isDeleteConfirmationOpen}
        title={`Void ${selectedAccountIds.length} selected finance account${selectedAccountIds.length === 1 ? '' : 's'}?`}
        description="This preserves the selected finance accounts and removes them from normal views."
        requireReason
        onOpenChange={setIsDeleteConfirmationOpen}
        onConfirm={async (password, reason) => {
          await window.api.financeAccounts.void({
            ids: selectedAccountIds,
            password,
            reason: reason ?? ''
          })
          setRowSelection({})
          await reload()
          notify({ type: 'success', title: 'Selected finance accounts voided.' })
        }}
      />
    </div>
  )
}

function FinanceAccountSheet({
  open,
  record,
  initialBranch,
  onClose,
  onSaved
}: {
  readonly open: boolean
  readonly record?: FinanceAccountRecord
  readonly initialBranch: FinanceAccountRecord['branch']
  readonly onClose: () => void
  readonly onSaved: () => void
}): React.JSX.Element {
  const [values, setValues] = React.useState<FinanceFormValues>(() =>
    record ? recordForm(record) : blankForm(initialBranch)
  )
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [catalogOptions, setCatalogOptions] = React.useState<CatalogOptionRecord[]>([])
  const [productCatalog, setProductCatalog] = React.useState<ProductCatalogItem[]>([])
  const [submitError, setSubmitError] = React.useState<string>()
  const [isSaving, setIsSaving] = React.useState(false)
  React.useEffect(() => {
    void window.api.productCatalog
      .list()
      .then(({ rows }) => setProductCatalog(rows))
      .catch(() => undefined)
  }, [])
  React.useEffect(() => {
    void window.api.catalogOptions
      .list({ activeOnly: true })
      .then(({ rows }) => setCatalogOptions(rows))
      .catch(() => undefined)
  }, [])
  const activeProviders = catalogOptions
    .filter((option) => option.kind === 'FINANCE_TYPE')
    .map((option) => option.value)
  const providers = activeProviders.includes(values.provider)
    ? activeProviders
    : [values.provider, ...activeProviders]
  const terms = Array.from({ length: 12 }, (_, index) => index + 1)
  React.useEffect(() => {
    if (open) {
      setValues(record ? recordForm(record) : blankForm(initialBranch))
      setErrors({})
      setSubmitError(undefined)
    }
  }, [initialBranch, open, record])
  const itemInputs = values.items.map(({ quantity, itemPrice }) => ({
    quantity,
    itemPriceCentavos: asCentavos(itemPrice)
  }))
  const amounts = calculateFinanceAmounts(itemInputs, asCentavos(values.downpayment))
  const set = <Key extends keyof FinanceFormValues>(
    key: Key,
    value: FinanceFormValues[Key]
  ): void => setValues((current) => ({ ...current, [key]: value }))
  const updateItem = (id: string, patch: Partial<FinanceItemFormValues>): void =>
    set(
      'items',
      values.items.map((item) => (item.id === id ? { ...item, ...patch } : item))
    )
  const submit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const parsed = financeAccountInputSchema.safeParse(toInput(values))
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {}
      for (const issue of parsed.error.issues)
        nextErrors[String(issue.path[0] ?? 'form')] = issue.message
      setErrors(nextErrors)
      return
    }
    setIsSaving(true)
    setSubmitError(undefined)
    try {
      if (record) await window.api.financeAccounts.update({ id: record.id, ...parsed.data })
      else await window.api.financeAccounts.create(parsed.data)
      onSaved()
    } catch (caught) {
      setSubmitError(errorMessage(caught))
    } finally {
      setIsSaving(false)
    }
  }
  const fieldError = (key: string): React.JSX.Element | null =>
    errors[key] ? <FieldError>{errors[key]}</FieldError> : null

  return (
    <Drawer open={open} onOpenChange={(next) => !next && onClose()} swipeDirection="right">
      <DrawerContent className="w-full sm:w-[42rem] sm:max-w-2xl">
        <DrawerHeader>
          <DrawerTitle>{record ? 'Edit Finance Account' : 'Add Finance Account'}</DrawerTitle>
          <DrawerDescription>
            Add one or more released items. Totals update from every item.
          </DrawerDescription>
        </DrawerHeader>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => void submit(event)}
          noValidate
        >
          <ScrollArea className="min-h-0 flex-1">
            <FieldGroup className="p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field data-invalid={Boolean(errors.branch)}>
                  <FieldLabel htmlFor="finance-branch">Branch</FieldLabel>
                  <Select
                    value={values.branch}
                    onValueChange={(value) =>
                      set('branch', value as FinanceAccountRecord['branch'])
                    }
                  >
                    <SelectTrigger id="finance-branch" aria-invalid={Boolean(errors.branch)}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {financeBranchValues.map((branch) => (
                          <SelectItem key={branch} value={branch}>
                            {branch}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {fieldError('branch')}
                </Field>
                <Field data-invalid={Boolean(errors.provider)}>
                  <FieldLabel htmlFor="finance-provider">Type</FieldLabel>
                  <Select
                    value={values.provider}
                    onValueChange={(value) =>
                      set('provider', value as FinanceAccountRecord['provider'])
                    }
                  >
                    <SelectTrigger id="finance-provider" aria-invalid={Boolean(errors.provider)}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {(providers.length ? providers : financeProviderValues).map((provider) => (
                          <SelectItem key={provider} value={provider}>
                            {provider}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {fieldError('provider')}
                </Field>
                <Field data-invalid={Boolean(errors.dateReleased)}>
                  <FieldLabel htmlFor="finance-release-date">Date Release</FieldLabel>
                  <DatePickerInput
                    id="finance-release-date"
                    value={values.dateReleased}
                    aria-invalid={Boolean(errors.dateReleased)}
                    onValueChange={(date) => set('dateReleased', date)}
                  />
                  {fieldError('dateReleased')}
                </Field>
                <Field data-invalid={Boolean(errors.termsMonths)}>
                  <FieldLabel htmlFor="finance-terms">Terms (months)</FieldLabel>
                  <Select
                    value={String(values.termsMonths)}
                    onValueChange={(value) => set('termsMonths', Number(value))}
                  >
                    <SelectTrigger id="finance-terms" aria-invalid={Boolean(errors.termsMonths)}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {terms.map((months) => (
                          <SelectItem key={months} value={String(months)}>
                            {months} month{months === 1 ? '' : 's'}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {fieldError('termsMonths')}
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field data-invalid={Boolean(errors.lastName)}>
                  <FieldLabel htmlFor="finance-last-name">Last Name</FieldLabel>
                  <Input
                    id="finance-last-name"
                    value={values.lastName}
                    aria-invalid={Boolean(errors.lastName)}
                    onChange={(event) => set('lastName', event.target.value)}
                  />
                  {fieldError('lastName')}
                </Field>
                <Field data-invalid={Boolean(errors.firstName)}>
                  <FieldLabel htmlFor="finance-first-name">First Name</FieldLabel>
                  <Input
                    id="finance-first-name"
                    value={values.firstName}
                    aria-invalid={Boolean(errors.firstName)}
                    onChange={(event) => set('firstName', event.target.value)}
                  />
                  {fieldError('firstName')}
                </Field>
                <Field>
                  <FieldLabel htmlFor="finance-middle-name">Middle Name</FieldLabel>
                  <Input
                    id="finance-middle-name"
                    value={values.middleName ?? ''}
                    onChange={(event) => set('middleName', event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="finance-suffix">Suffix</FieldLabel>
                  <Select
                    value={values.suffix || undefined}
                    onValueChange={(value) => set('suffix', value ?? '')}
                  >
                    <SelectTrigger id="finance-suffix">
                      <SelectValue placeholder="Select suffix" />
                    </SelectTrigger>
                    <SelectContent>
                      {suffixOptions.map((suffix) => (
                        <SelectItem key={suffix} value={suffix}>
                          {suffix}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Items</p>
                <Button
                  type="button"
                  variant="secondary"
                  size="xs"
                  onClick={() => set('items', [...values.items, createItem()])}
                >
                  <Plus data-icon="inline-start" />
                  Add item
                </Button>
              </div>
              {values.items.map((item, index) => (
                <FieldGroup key={item.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground">Item {index + 1}</p>
                    {values.items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove item ${index + 1}`}
                        onClick={() =>
                          set(
                            'items',
                            values.items.filter((current) => current.id !== item.id)
                          )
                        }
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor={`finance-item-${item.id}`}>Item</FieldLabel>
                      <ProductCombobox
                        id={`finance-item-${item.id}`}
                        value={item.item}
                        items={productCatalog}
                        onChange={(product) =>
                          updateItem(item.id, {
                            item: product.description,
                            itemPrice: String(product.retailPriceCentavos / 100)
                          })
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor={`finance-serial-${item.id}`}>Serial No.</FieldLabel>
                      <Input
                        id={`finance-serial-${item.id}`}
                        value={item.serialNo ?? ''}
                        onChange={(event) => updateItem(item.id, { serialNo: event.target.value })}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor={`finance-qty-${item.id}`}>Qty</FieldLabel>
                      <Input
                        id={`finance-qty-${item.id}`}
                        type="number"
                        min="1"
                        step="1"
                        value={item.quantity}
                        onChange={(event) =>
                          updateItem(item.id, { quantity: Number(event.target.value) })
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor={`finance-price-${item.id}`}>Item Price</FieldLabel>
                      <Input
                        id={`finance-price-${item.id}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.itemPrice}
                        onChange={(event) => updateItem(item.id, { itemPrice: event.target.value })}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Total</FieldLabel>
                      <Input
                        readOnly
                        value={formatMoney(item.quantity * asCentavos(item.itemPrice))}
                      />
                    </Field>
                  </div>
                </FieldGroup>
              ))}
              <div className="grid gap-3 sm:grid-cols-3">
                <Field>
                  <FieldLabel>Grand Total</FieldLabel>
                  <Input readOnly value={formatMoney(amounts.grandTotalCentavos)} />
                </Field>
                <Field data-invalid={Boolean(errors.downpaymentCentavos)}>
                  <FieldLabel htmlFor="finance-downpayment">Downpayment</FieldLabel>
                  <Input
                    id="finance-downpayment"
                    type="number"
                    min="0"
                    step="0.01"
                    value={values.downpayment}
                    aria-invalid={Boolean(errors.downpaymentCentavos)}
                    onChange={(event) => set('downpayment', event.target.value)}
                  />
                  {fieldError('downpaymentCentavos')}
                </Field>
                <Field>
                  <FieldLabel>Balance</FieldLabel>
                  <Input readOnly value={formatMoney(amounts.balanceCentavos)} />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="finance-or-number">OR#</FieldLabel>
                  <Input
                    id="finance-or-number"
                    value={values.orNumber ?? ''}
                    onChange={(event) => set('orNumber', event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="finance-or-date">OR Date</FieldLabel>
                  <DatePickerInput
                    id="finance-or-date"
                    value={values.orDate ?? ''}
                    onValueChange={(date) => set('orDate', date || undefined)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="finance-paid-date">Paid Date</FieldLabel>
                  <DatePickerInput
                    id="finance-paid-date"
                    value={values.paidDate ?? ''}
                    onValueChange={(date) => set('paidDate', date || undefined)}
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="finance-remarks">Remarks</FieldLabel>
                <Textarea
                  id="finance-remarks"
                  value={values.remarks ?? ''}
                  onChange={(event) => set('remarks', event.target.value)}
                />
              </Field>
              {submitError && <p className="text-sm text-destructive">{submitError}</p>}
            </FieldGroup>
          </ScrollArea>
          <DrawerFooter>
            <DrawerClose
              render={
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              }
            />
            <Button type="submit" disabled={isSaving}>
              {record ? 'Save Changes' : 'Add Finance Account'}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
