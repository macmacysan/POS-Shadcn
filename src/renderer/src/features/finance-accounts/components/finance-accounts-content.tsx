import * as React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type SortingState
} from '@tanstack/react-table'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { DataGridColumnHeader } from '@/components/ui/reui/data-grid/data-grid-column-header'
import {
  createRowActionsColumn,
  type RowActionItem
} from '@/components/shared/data-table/row-actions'
import { TableToolbar } from '@/components/shared/data-table/table-toolbar'
import { UniversalDataTable } from '@/components/shared/data-table/universal-data-table'
import { AccountBranchBadge } from '@/features/in-house-accounts/components/account-badges'
import { calculateFinanceAmounts } from '../../../../../shared/finance-calculations'
import {
  financeAccountInputSchema,
  financeBranchValues,
  financeProviderValues,
  type CatalogOptionRecord,
  type FinanceAccountInput,
  type FinanceAccountRecord,
  type FinanceItemInput,
  type FinanceItemRecord
} from '../../../../../shared/contracts'
import type { LoginBranch } from '../../../../../shared/contracts'

type Props = {
  readonly selectedBranch: LoginBranch
  readonly initialSearch?: string
}
type FinanceItemFormValues = Omit<FinanceItemInput, 'itemPriceCentavos'> & {
  id: string
  itemPrice: string
}
type FinanceFormValues = Omit<FinanceAccountInput, 'items' | 'downpaymentCentavos'> & {
  items: FinanceItemFormValues[]
  downpayment: string
}
type FinanceTableRow = FinanceItemRecord & { account: FinanceAccountRecord }

const moneyFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2
})

function formatMoney(centavos: number): string {
  return moneyFormatter.format(centavos / 100)
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

function financeColumns(): ColumnDef<FinanceTableRow>[] {
  const text = (value?: string): string => value || '—'
  return [
    {
      id: 'branch',
      accessorFn: (row) => row.account.branch,
      header: ({ column }) => <DataGridColumnHeader column={column} title="Branch" />,
      cell: ({ row }) => <AccountBranchBadge branch={row.original.account.branch} />,
      size: 80
    },
    {
      id: 'provider',
      accessorFn: (row) => row.account.provider,
      header: ({ column }) => <DataGridColumnHeader column={column} title="Type" />,
      cell: ({ row }) => <Badge variant="secondary">{row.original.account.provider}</Badge>,
      size: 120
    },
    {
      id: 'dateReleased',
      accessorFn: (row) => row.account.dateReleased,
      header: ({ column }) => <DataGridColumnHeader column={column} title="Date Release" />,
      cell: ({ row }) => <Cell>{row.original.account.dateReleased}</Cell>,
      size: 112
    },
    {
      id: 'termsMonths',
      accessorFn: (row) => row.account.termsMonths,
      header: 'Terms',
      cell: ({ row }) => (
        <Cell>
          {row.original.account.termsMonths} month
          {row.original.account.termsMonths === 1 ? '' : 's'}
        </Cell>
      ),
      size: 92
    },
    {
      id: 'lastName',
      accessorFn: (row) => row.account.lastName,
      header: 'Last Name',
      cell: ({ row }) => <Cell>{row.original.account.lastName}</Cell>,
      size: 140
    },
    {
      id: 'firstName',
      accessorFn: (row) => row.account.firstName,
      header: 'First Name',
      cell: ({ row }) => <Cell>{row.original.account.firstName}</Cell>,
      size: 140
    },
    {
      id: 'middleName',
      accessorFn: (row) => row.account.middleName,
      header: 'Middle Name',
      cell: ({ row }) => <Cell>{text(row.original.account.middleName)}</Cell>,
      size: 130
    },
    {
      id: 'suffix',
      accessorFn: (row) => row.account.suffix,
      header: 'Suffix',
      cell: ({ row }) => <Cell>{text(row.original.account.suffix)}</Cell>,
      size: 82
    },
    {
      accessorKey: 'quantity',
      header: 'QTY',
      cell: ({ getValue }) => <Cell>{getValue<number>()}</Cell>,
      size: 62
    },
    {
      accessorKey: 'item',
      header: 'Item',
      cell: ({ getValue }) => <Cell>{getValue<string>()}</Cell>,
      size: 180
    },
    {
      accessorKey: 'serialNo',
      header: 'Serial No.',
      cell: ({ getValue }) => <Cell>{text(getValue<string | undefined>())}</Cell>,
      size: 140
    },
    {
      accessorKey: 'itemPriceCentavos',
      header: 'Item Price',
      cell: ({ getValue }) => <Cell money>{formatMoney(getValue<number>())}</Cell>,
      size: 120
    },
    {
      accessorKey: 'totalCentavos',
      header: 'Total',
      cell: ({ getValue }) => <Cell money>{formatMoney(getValue<number>())}</Cell>,
      size: 120
    },
    {
      id: 'grandTotal',
      accessorFn: (row) => row.account.grandTotalCentavos,
      header: 'Grand Total',
      cell: ({ row }) => <Cell money>{formatMoney(row.original.account.grandTotalCentavos)}</Cell>,
      size: 128
    },
    {
      id: 'downpayment',
      accessorFn: (row) => row.account.downpaymentCentavos,
      header: 'Downpayment',
      cell: ({ row }) => <Cell money>{formatMoney(row.original.account.downpaymentCentavos)}</Cell>,
      size: 128
    },
    {
      id: 'balance',
      accessorFn: (row) => row.account.balanceCentavos,
      header: 'Balance',
      cell: ({ row }) => <Cell money>{formatMoney(row.original.account.balanceCentavos)}</Cell>,
      size: 120
    },
    {
      id: 'orNumber',
      accessorFn: (row) => row.account.orNumber,
      header: 'OR#',
      cell: ({ row }) => <Cell>{text(row.original.account.orNumber)}</Cell>,
      size: 100
    },
    {
      id: 'orDate',
      accessorFn: (row) => row.account.orDate,
      header: 'OR Date',
      cell: ({ row }) => <Cell>{text(row.original.account.orDate)}</Cell>,
      size: 105
    },
    {
      id: 'paidDate',
      accessorFn: (row) => row.account.paidDate,
      header: 'Paid Date',
      cell: ({ row }) => <Cell>{text(row.original.account.paidDate)}</Cell>,
      size: 105
    },
    {
      id: 'remarks',
      accessorFn: (row) => row.account.remarks,
      header: 'Remarks',
      cell: ({ row }) => <Cell>{text(row.original.account.remarks)}</Cell>,
      size: 200
    }
  ]
}

export function FinanceAccountsContent({
  selectedBranch,
  initialSearch
}: Props): React.JSX.Element {
  const [accounts, setAccounts] = React.useState<FinanceAccountRecord[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string>()
  const [search, setSearch] = React.useState(initialSearch ?? '')
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'dateReleased', desc: true }])
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25
  })
  const [editing, setEditing] = React.useState<FinanceAccountRecord>()
  const [isCreating, setIsCreating] = React.useState(false)

  const reload = React.useCallback(async (): Promise<void> => {
    setIsLoading(true)
    setLoadError(undefined)
    try {
      const result = await window.api.financeAccounts.list({ search: '' })
      setAccounts(result.rows)
    } catch (caught) {
      setLoadError(errorMessage(caught))
    } finally {
      setIsLoading(false)
    }
  }, [])
  React.useEffect(() => {
    void reload()
  }, [reload])

  const rows = React.useMemo<FinanceTableRow[]>(
    () => accounts.flatMap((account) => account.items.map((item) => ({ ...item, account }))),
    [accounts]
  )
  const filteredRows = React.useMemo(() => {
    const query = search.trim().toLowerCase()
    const scopedRows =
      selectedBranch === 'All Branch'
        ? rows
        : rows.filter(({ account }) => account.branch === selectedBranch)
    if (!query) return scopedRows
    return scopedRows.filter(({ account, item, serialNo }) =>
      [
        account.branch,
        account.provider,
        account.lastName,
        account.firstName,
        account.middleName,
        account.suffix,
        item,
        serialNo,
        account.orNumber,
        account.remarks
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    )
  }, [rows, search, selectedBranch])
  const actions = React.useCallback(
    (row: FinanceTableRow): readonly RowActionItem[] => [
      { id: 'edit', label: 'Edit finance account', onSelect: () => setEditing(row.account) }
    ],
    []
  )
  const columns = React.useMemo(
    () => [
      ...financeColumns(),
      createRowActionsColumn<FinanceTableRow>({
        label: 'Open finance account actions',
        getActions: actions
      })
    ],
    [actions]
  )
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table manages reactive table state internally.
  const table = useReactTable({
    data: filteredRows,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => `${row.account.id}:${row.id}`
  })
  const closeForm = (): void => {
    setIsCreating(false)
    setEditing(undefined)
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden p-3">
      <Card className="flex min-h-0 min-w-0 flex-1 flex-col">
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          <TableToolbar className="px-3">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search finance accounts..."
              className="max-w-sm"
              aria-label="Search finance accounts"
            />
            <Button type="button" size="sm" onClick={() => setIsCreating(true)}>
              <Plus data-icon="inline-start" />
              Add Finance Account
            </Button>
          </TableToolbar>
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
  const [submitError, setSubmitError] = React.useState<string>()
  const [isSaving, setIsSaving] = React.useState(false)
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
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:w-[42rem]">
        <SheetHeader className="border-b p-4">
          <SheetTitle>{record ? 'Edit Finance Account' : 'Add Finance Account'}</SheetTitle>
          <SheetDescription>
            Add one or more released items. Totals update from every item.
          </SheetDescription>
        </SheetHeader>
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
                  <Input
                    id="finance-release-date"
                    type="date"
                    value={values.dateReleased}
                    aria-invalid={Boolean(errors.dateReleased)}
                    onChange={(event) => set('dateReleased', event.target.value)}
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
                  <Input
                    id="finance-suffix"
                    value={values.suffix ?? ''}
                    onChange={(event) => set('suffix', event.target.value)}
                  />
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
                      <Input
                        id={`finance-item-${item.id}`}
                        value={item.item}
                        onChange={(event) => updateItem(item.id, { item: event.target.value })}
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
                  <Input
                    id="finance-or-date"
                    type="date"
                    value={values.orDate ?? ''}
                    onChange={(event) => set('orDate', event.target.value || undefined)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="finance-paid-date">Paid Date</FieldLabel>
                  <Input
                    id="finance-paid-date"
                    type="date"
                    value={values.paidDate ?? ''}
                    onChange={(event) => set('paidDate', event.target.value || undefined)}
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
          <SheetFooter className="border-t p-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {record ? 'Save Changes' : 'Add Finance Account'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
