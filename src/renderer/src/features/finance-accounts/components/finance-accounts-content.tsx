import * as React from 'react'
import { Plus } from 'lucide-react'
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type SortingState
} from '@tanstack/react-table'

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
import { calculateFinanceAmounts } from '../../../../../shared/finance-calculations'
import {
  financeAccountInputSchema,
  financeBranchValues,
  financeProviderValues,
  type FinanceAccountInput,
  type FinanceAccountRecord
} from '../../../../../shared/contracts'

type Props = { readonly selectedBranch: FinanceAccountRecord['branch'] }
type FinanceFormValues = Omit<FinanceAccountInput, 'itemPriceCentavos' | 'downpaymentCentavos'> & {
  itemPrice: string
  downpayment: string
}

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
    quantity: 1,
    item: '',
    serialNo: '',
    itemPrice: '',
    downpayment: '',
    orNumber: '',
    orDate: undefined,
    paidDate: undefined,
    remarks: ''
  }
}

function recordForm(record: FinanceAccountRecord): FinanceFormValues {
  return {
    ...record,
    itemPrice: (record.itemPriceCentavos / 100).toFixed(2),
    downpayment: (record.downpaymentCentavos / 100).toFixed(2)
  }
}

function toInput(values: FinanceFormValues): FinanceAccountInput {
  return {
    ...values,
    middleName: values.middleName?.trim() || undefined,
    suffix: values.suffix?.trim() || undefined,
    serialNo: values.serialNo?.trim() || undefined,
    orNumber: values.orNumber?.trim() || undefined,
    orDate: values.orDate || undefined,
    paidDate: values.paidDate || undefined,
    remarks: values.remarks?.trim() || undefined,
    itemPriceCentavos: asCentavos(values.itemPrice),
    downpaymentCentavos: asCentavos(values.downpayment)
  }
}

function errorMessage(error: unknown): string {
  return error && typeof error === 'object' && 'message' in error
    ? String(error.message)
    : 'The finance account could not be saved.'
}

function financeColumns(): ColumnDef<FinanceAccountRecord>[] {
  const date = (value?: string): string => value || '—'
  const text = (value?: string): string => value || '—'
  return [
    {
      accessorKey: 'branch',
      header: ({ column }) => <DataGridColumnHeader column={column} title="Branch" />,
      size: 100
    },
    {
      accessorKey: 'provider',
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Type (Home Credit, Salmon, Skyro)" />
      ),
      size: 120
    },
    {
      accessorKey: 'dateReleased',
      header: ({ column }) => <DataGridColumnHeader column={column} title="Date Release" />,
      cell: ({ getValue }) => date(getValue<string>()),
      size: 118
    },
    {
      accessorKey: 'termsMonths',
      header: 'TERMS (1 - 12 Months)',
      cell: ({ getValue }) => `${getValue<number>()} month${getValue<number>() === 1 ? '' : 's'}`,
      size: 92
    },
    { accessorKey: 'lastName', header: 'Last Name', size: 150 },
    { accessorKey: 'firstName', header: 'First Name', size: 150 },
    {
      id: 'middleNameSuffix',
      accessorFn: (row) => [row.middleName, row.suffix].filter(Boolean).join(', '),
      header: 'MIDDLE NAME, SUFFIX',
      cell: ({ getValue }) => text(getValue<string>()),
      size: 180
    },
    { accessorKey: 'quantity', header: 'QTY', size: 65 },
    { accessorKey: 'item', header: 'Item', size: 190 },
    {
      accessorKey: 'serialNo',
      header: 'Serial No.',
      cell: ({ getValue }) => text(getValue<string | undefined>()),
      size: 150
    },
    {
      accessorKey: 'itemPriceCentavos',
      header: 'Item Price',
      cell: ({ getValue }) => (
        <span className="block text-right tabular-nums">{formatMoney(getValue<number>())}</span>
      ),
      size: 130
    },
    {
      accessorKey: 'grandTotalCentavos',
      header: 'Total (QTY × Item Price)',
      cell: ({ getValue }) => (
        <span className="block text-right tabular-nums">{formatMoney(getValue<number>())}</span>
      ),
      size: 130
    },
    {
      accessorKey: 'grandTotalCentavos',
      id: 'grandTotal',
      header: 'Grand Total (Sum of Totals)',
      cell: ({ getValue }) => (
        <span className="block text-right font-medium tabular-nums">
          {formatMoney(getValue<number>())}
        </span>
      ),
      size: 135
    },
    {
      accessorKey: 'downpaymentCentavos',
      header: 'Downpayment',
      cell: ({ getValue }) => (
        <span className="block text-right tabular-nums">{formatMoney(getValue<number>())}</span>
      ),
      size: 135
    },
    {
      accessorKey: 'balanceCentavos',
      header: 'Balance (Grand Total - Downpayment)',
      cell: ({ getValue }) => (
        <span className="block text-right font-medium tabular-nums">
          {formatMoney(getValue<number>())}
        </span>
      ),
      size: 130
    },
    {
      accessorKey: 'orNumber',
      header: 'OR#',
      cell: ({ getValue }) => text(getValue<string | undefined>()),
      size: 110
    },
    {
      accessorKey: 'orDate',
      header: 'OR Date',
      cell: ({ getValue }) => date(getValue<string | undefined>()),
      size: 110
    },
    {
      accessorKey: 'paidDate',
      header: 'Paid Date',
      cell: ({ getValue }) => date(getValue<string | undefined>()),
      size: 110
    },
    {
      accessorKey: 'remarks',
      header: 'Remarks',
      cell: ({ getValue }) => text(getValue<string | undefined>()),
      size: 220
    }
  ]
}

export function FinanceAccountsContent({ selectedBranch }: Props): React.JSX.Element {
  const [rows, setRows] = React.useState<FinanceAccountRecord[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string>()
  const [search, setSearch] = React.useState('')
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
      setRows(result.rows)
    } catch (caught) {
      setLoadError(errorMessage(caught))
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void reload()
  }, [reload])

  const filteredRows = React.useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return rows
    return rows.filter((row) =>
      [
        row.branch,
        row.provider,
        row.lastName,
        row.firstName,
        row.middleName,
        row.suffix,
        row.item,
        row.serialNo,
        row.orNumber,
        row.remarks
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    )
  }, [rows, search])

  const actions = React.useCallback(
    (row: FinanceAccountRecord): readonly RowActionItem[] => [
      { id: 'edit', label: 'Edit finance account', onSelect: () => setEditing(row) }
    ],
    []
  )
  const columns = React.useMemo(
    () => [
      ...financeColumns(),
      createRowActionsColumn<FinanceAccountRecord>({
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
    getRowId: (row) => row.id
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
          {loadError ? (
            <p className="p-4 text-sm text-destructive">{loadError}</p>
          ) : (
            <UniversalDataTable
              table={table}
              recordCount={filteredRows.length}
              isLoading={isLoading}
              emptyMessage="No finance accounts found."
              paginationSizes={[25, 50, 100]}
              paginationInfo="Showing {from}-{to} of {count} accounts"
              tableLayout={{ columnsResizable: true }}
            />
          )}
        </CardContent>
      </Card>
      <FinanceAccountSheet
        open={isCreating || Boolean(editing)}
        record={editing}
        initialBranch={selectedBranch}
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
  const [submitError, setSubmitError] = React.useState<string>()
  const [isSaving, setIsSaving] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setValues(record ? recordForm(record) : blankForm(initialBranch))
      setErrors({})
      setSubmitError(undefined)
    }
  }, [initialBranch, open, record])

  const amounts = calculateFinanceAmounts(
    values.quantity,
    asCentavos(values.itemPrice),
    asCentavos(values.downpayment)
  )
  const set = <Key extends keyof FinanceFormValues>(
    key: Key,
    value: FinanceFormValues[Key]
  ): void => setValues((current) => ({ ...current, [key]: value }))
  const submit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const input = toInput(values)
    const parsed = financeAccountInputSchema.safeParse(input)
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
            Amounts are calculated from quantity, item price, and downpayment.
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
                        {financeProviderValues.map((provider) => (
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
                        {Array.from({ length: 12 }, (_, index) => index + 1).map((months) => (
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
              <div className="grid gap-3 sm:grid-cols-2">
                <Field data-invalid={Boolean(errors.quantity)}>
                  <FieldLabel htmlFor="finance-quantity">Qty</FieldLabel>
                  <Input
                    id="finance-quantity"
                    type="number"
                    min="1"
                    step="1"
                    value={values.quantity}
                    aria-invalid={Boolean(errors.quantity)}
                    onChange={(event) => set('quantity', Number(event.target.value))}
                  />
                  {fieldError('quantity')}
                </Field>
                <Field data-invalid={Boolean(errors.item)}>
                  <FieldLabel htmlFor="finance-item">Item</FieldLabel>
                  <Input
                    id="finance-item"
                    value={values.item}
                    aria-invalid={Boolean(errors.item)}
                    onChange={(event) => set('item', event.target.value)}
                  />
                  {fieldError('item')}
                </Field>
                <Field>
                  <FieldLabel htmlFor="finance-serial">Serial No.</FieldLabel>
                  <Input
                    id="finance-serial"
                    value={values.serialNo ?? ''}
                    onChange={(event) => set('serialNo', event.target.value)}
                  />
                </Field>
                <Field data-invalid={Boolean(errors.itemPriceCentavos)}>
                  <FieldLabel htmlFor="finance-item-price">Item Price</FieldLabel>
                  <Input
                    id="finance-item-price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={values.itemPrice}
                    aria-invalid={Boolean(errors.itemPriceCentavos)}
                    onChange={(event) => set('itemPrice', event.target.value)}
                  />
                  {fieldError('itemPriceCentavos')}
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field>
                  <FieldLabel>Total</FieldLabel>
                  <Input readOnly value={formatMoney(amounts.grandTotalCentavos)} />
                </Field>
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
              </div>
              <Field>
                <FieldLabel>Balance</FieldLabel>
                <Input readOnly value={formatMoney(amounts.balanceCentavos)} />
              </Field>
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
