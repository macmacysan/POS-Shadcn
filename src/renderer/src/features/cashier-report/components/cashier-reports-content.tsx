import * as React from 'react'
import { format, isValid, parse } from 'date-fns'
import { CalendarIcon } from '@phosphor-icons/react'
import {
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  Bus,
  CarFront,
  CircleHelp,
  CreditCard,
  Ellipsis,
  GraduationCap,
  Heart,
  HeartHandshake,
  Landmark,
  Megaphone,
  Package,
  Phone,
  Printer,
  ReceiptText,
  Scale,
  ShieldCheck,
  Soup,
  Utensils,
  WalletCards,
  Zap,
  type LucideIcon
} from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Calendar } from '@/components/ui/calendar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ReportDataTable,
  type ReportColumn,
  type ReportRow
} from '@/features/cashier-report/components/report-data-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText
} from '@/components/ui/input-group'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  InstallmentHistoryInspector,
  InstallmentHistoryTable
} from '@/features/installment-history'
import type { RowActionItem } from '@/components/shared/data-table/row-actions'
import { ScrollArea } from '@/components/ui/scroll-area'
import { installmentHistoryData, type InstallmentHistoryRecord } from '@/lib/installment-history'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { ReportSummary } from '@/features/cashier-report/components/report-summary'

const reportTabs = ['Expenses', 'Income', 'Payment', 'Activity'] as const

const expenseTypes = ['Company Expenses', 'Drawings', 'Purchases', 'Receivables'] as const
const vatOptions = ['VAT', 'Non-VAT'] as const
const paymentTypes = ['Bank Check', 'Bank Transfer', 'GCash', 'Other e-wallet'] as const

type ExpenseCategoryConfig = {
  value: string
  fullLabel: string
  shortLabel: string
  icon: LucideIcon
}

const expenseCategoryConfigs = [
  { value: 'Advertising', fullLabel: 'Advertising', shortLabel: 'Ads', icon: Megaphone },
  {
    value: 'Education and training expenses for employees',
    fullLabel: 'Education and training expenses for employees',
    shortLabel: 'Training',
    icon: GraduationCap
  },
  {
    value: 'Licenses and Permits',
    fullLabel: 'Licenses and Permits',
    shortLabel: 'Permits',
    icon: BadgeCheck
  },
  { value: 'Bank Fees', fullLabel: 'Bank Fees', shortLabel: 'Bank Fee', icon: Landmark },
  {
    value: 'Employee Benefit Programs',
    fullLabel: 'Employee Benefit Programs',
    shortLabel: 'Benefits',
    icon: HeartHandshake
  },
  {
    value: 'Office Expenses and Supplies',
    fullLabel: 'Office Expenses and Supplies',
    shortLabel: 'Office',
    icon: BriefcaseBusiness
  },
  {
    value: 'Business Meals',
    fullLabel: 'Business Meals',
    shortLabel: 'Meals',
    icon: Utensils
  },
  { value: 'Food Allowance', fullLabel: 'Food Allowance', shortLabel: 'Food', icon: Soup },
  { value: 'Printing', fullLabel: 'Printing', shortLabel: 'Printing', icon: Printer },
  {
    value: 'Charitable Contributions',
    fullLabel: 'Charitable Contributions',
    shortLabel: 'Charity',
    icon: Heart
  },
  {
    value: 'Freight, Postage and Shipping',
    fullLabel: 'Freight, Postage and Shipping',
    shortLabel: 'Shipping',
    icon: Package
  },
  { value: 'Rent', fullLabel: 'Rent', shortLabel: 'Rent', icon: Building2 },
  {
    value: 'Credit and Collection Fees',
    fullLabel: 'Credit and Collection Fees',
    shortLabel: 'Collection',
    icon: ReceiptText
  },
  {
    value: 'Insurance',
    fullLabel: 'Insurance',
    shortLabel: 'Insurance',
    icon: ShieldCheck
  },
  {
    value: 'Salaries and Compensation',
    fullLabel: 'Salaries and Compensation',
    shortLabel: 'Salaries',
    icon: WalletCards
  },
  {
    value: 'Dues and Subscriptions',
    fullLabel: 'Dues and Subscriptions',
    shortLabel: 'Subscriptions',
    icon: CreditCard
  },
  {
    value: 'Legal and professional expenses',
    fullLabel: 'Legal and professional expenses',
    shortLabel: 'Legal',
    icon: Scale
  },
  {
    value: 'Telephone/Communication Expense',
    fullLabel: 'Telephone/Communication Expense',
    shortLabel: 'Telecom',
    icon: Phone
  },
  {
    value: 'Transporation Allowance',
    fullLabel: 'Transporation Allowance',
    shortLabel: 'Transport',
    icon: Bus
  },
  { value: 'Utilities', fullLabel: 'Utilities', shortLabel: 'Utilities', icon: Zap },
  {
    value: 'Vehicle Maintenance and Repairs',
    fullLabel: 'Vehicle Maintenance and Repairs',
    shortLabel: 'Vehicle',
    icon: CarFront
  },
  { value: 'Others', fullLabel: 'Others', shortLabel: 'Other', icon: Ellipsis }
] as const satisfies readonly ExpenseCategoryConfig[]

const expenseCategories = expenseCategoryConfigs.map(({ value }) => value)
const expenseCategoryConfigByValue = new Map<string, ExpenseCategoryConfig>(
  expenseCategoryConfigs.map((config) => [config.value, config])
)

type ExpenseRow = ReportRow & {
  type: string
  description: string
  category: string
  receiptNo: string
  vat: string
  amount: number
}

type IncomeRow = ReportRow & {
  particular: string
  remarks: string
  receiptRefNo: string
  date: string
  amount: number
}
type PaymentRow = ReportRow & {
  type: string
  bankProvider: string
  accountName: string
  referenceNo: string
  date: string
  amount: number
}

const money = (value: number): string =>
  `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`

const typeClassNames: Record<string, string> = {
  Operating:
    'border-sky-200/70 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300',
  Supply:
    'border-amber-200/70 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  Transport:
    'border-violet-200/70 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300',
  Cash: 'border-emerald-200/70 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  'Bank Check':
    'border-emerald-200/70 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  'Bank Transfer':
    'border-violet-200/70 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300',
  GCash:
    'border-blue-200/70 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
  'Other e-wallet':
    'border-amber-200/70 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
}

function TypeBox({ value }: { value: string }): React.JSX.Element {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-light ${typeClassNames[value] ?? 'border-border bg-muted text-muted-foreground'}`}
    >
      {value}
    </span>
  )
}

function ExpenseCategoryCell({ category }: { category: string }): React.JSX.Element {
  const fallbackLabel = category.trim() || 'Unknown'
  const config = expenseCategoryConfigByValue.get(category) ?? {
    value: category,
    fullLabel: fallbackLabel,
    shortLabel: fallbackLabel,
    icon: CircleHelp
  }
  const Icon = config.icon

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <span className="flex min-w-0 items-center gap-1.5" tabIndex={0}>
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border bg-background">
                <Icon
                  aria-hidden="true"
                  className="size-3 text-muted-foreground"
                  strokeWidth={1.75}
                />
              </span>
              <span className="truncate text-[10px] font-normal text-muted-foreground">
                {config.shortLabel}
              </span>
            </span>
          }
        />
        <TooltipContent>{config.fullLabel}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

const expenseColumns: ReportColumn<ExpenseRow>[] = [
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ getValue }) => <TypeBox value={getValue<string>()} />,
    size: 100,
    meta: { className: 'w-30' }
  },
  {
    accessorKey: 'description',
    header: 'Description',
    size: 360,
    meta: { className: cn('w-750', 'font-light') }
  },
  {
    accessorKey: 'category',
    header: 'Category',
    cell: ({ getValue }) => <ExpenseCategoryCell category={getValue<string>()} />,
    size: 100,
    meta: { className: cn('w-35', 'text-muted-foreground') }
  },
  {
    accessorKey: 'receiptNo',
    header: 'Receipt No',
    size: 120,
    meta: { className: cn('w-24 text-xs', 'text-muted-foreground') }
  },
  {
    accessorKey: 'vat',
    header: 'VAT',
    size: 90,
    meta: { className: cn('w-24 text-xs', 'text-muted-foreground') }
  },
  {
    accessorKey: 'amount',
    header: 'Amount',
    cell: ({ getValue }) => money(getValue<number>()),
    size: 150,
    meta: {
      className: cn('w-38', 'text-right font-light tabular-nums text-foreground')
    }
  }
]

const incomeColumns: ReportColumn<IncomeRow>[] = [
  {
    accessorKey: 'date',
    header: 'Date',
    size: 100,
    meta: { className: cn('w-35', 'text-muted-foreground') }
  },
  {
    accessorKey: 'particular',
    header: 'Particular',
    size: 300,
    meta: { className: cn('w-75', 'font-light') }
  },
  {
    accessorKey: 'receiptRefNo',
    header: 'Receipt / Ref No.',
    size: 150,
    meta: {
      className: cn('w-48', 'text-muted-foreground')
    }
  },
  {
    accessorKey: 'remarks',
    header: 'Remarks',
    size: 200,
    meta: { className: cn('w-[360px]', 'text-muted-foreground') }
  },
  {
    accessorKey: 'amount',
    header: 'Amount',
    cell: ({ getValue }) => money(getValue<number>()),
    size: 150,
    meta: {
      className: cn('w-30', 'text-right font-light tabular-nums text-foreground')
    }
  }
]

const paymentColumns: ReportColumn<PaymentRow>[] = [
  {
    accessorKey: 'type',
    header: 'TYPE',
    size: 100,
    cell: ({ getValue }) => <TypeBox value={getValue<string>()} />
  },
  {
    accessorKey: 'bankProvider',
    header: 'BANK / PROVIDER',
    size: 150,
    meta: { className: 'text-muted-foreground' }
  },
  {
    accessorKey: 'accountName',
    header: 'ACCOUNT NAME',
    size: 200,
    meta: { className: 'font-light' }
  },
  {
    accessorKey: 'referenceNo',
    header: 'REFERENCE NO.',
    meta: { className: 'text-muted-foreground' }
  },
  { accessorKey: 'date', header: 'DATE', meta: { className: 'text-muted-foreground' } },
  {
    accessorKey: 'amount',
    header: 'AMOUNT',
    size: 150,
    cell: ({ getValue }) => money(getValue<number>()),
    meta: { className: 'text-right font-light tabular-nums text-foreground' }
  }
]

const expenseData: ExpenseRow[] = Array.from({ length: 105 }, (_, index) => ({
  id: `expense-${index + 1}`,
  type: index % 3 === 0 ? 'Operating' : index % 3 === 1 ? 'Supply' : 'Transport',
  description: [
    'Printer paper, toner, and office supplies',
    'Fuel and tolls for customer deliveries',
    'Monthly electricity and water bill'
  ][index % 3],
  category: ['Office Expenses and Supplies', 'Freight, Postage and Shipping', 'Utilities'][
    index % 3
  ],
  receiptNo: `EXP-${String(index + 1).padStart(4, '0')}`,
  vat: index % 3 === 0 ? 'VAT' : index % 3 === 1 ? 'Non-VAT' : '',
  amount: 350 + index * 25
}))

const incomeData: IncomeRow[] = [
  {
    id: 'income-1',
    particular: 'Retail sale',
    remarks: 'Daily merchandise sales',
    receiptRefNo: 'OR-1001',
    date: '2026-07-14',
    amount: 12500
  },
  {
    id: 'income-2',
    particular: 'Service fee',
    remarks: 'Installation service',
    receiptRefNo: 'OR-1002',
    date: '2026-07-14',
    amount: 3200
  }
]

const paymentData: PaymentRow[] = [
  {
    id: 'payment-1',
    type: 'Bank Check',
    bankProvider: 'BDO',
    accountName: 'Ana Santos',
    referenceNo: 'CHK-1001',
    date: '2026-07-14',
    amount: 2500
  },
  {
    id: 'payment-2',
    type: 'GCash',
    bankProvider: 'GCash',
    accountName: 'Luis Cruz',
    referenceNo: 'GC-84721',
    date: '2026-07-14',
    amount: 1800
  }
]

function acknowledgeRow(row: ReportRow): void {
  void row.id
}

const destructiveAction = (
  label: string
): Pick<RowActionItem, 'destructive' | 'requiresConfirmation' | 'confirmationMessage'> => ({
  destructive: true,
  requiresConfirmation: true,
  confirmationMessage: `${label}?`
})

function expenseRowActions(
  row: ExpenseRow,
  onDelete: (id: string) => void,
  onEdit: (row: ExpenseRow) => void
): readonly RowActionItem[] {
  return [
    { id: 'view', label: 'View Details', onSelect: () => acknowledgeRow(row) },
    { id: 'edit', label: 'Edit Expense', onSelect: () => onEdit(row) },
    { id: 'duplicate', label: 'Duplicate Expense', onSelect: () => acknowledgeRow(row) },
    {
      id: 'delete',
      label: 'Delete Expense',
      onSelect: () => onDelete(row.id),
      ...destructiveAction('Delete expense')
    }
  ]
}

function incomeRowActions(
  row: IncomeRow,
  onDelete: (id: string) => void,
  onEdit: (row: IncomeRow) => void
): readonly RowActionItem[] {
  return [
    { id: 'view', label: 'View Details', onSelect: () => acknowledgeRow(row) },
    { id: 'edit', label: 'Edit Income', onSelect: () => onEdit(row) },
    { id: 'duplicate', label: 'Duplicate Income', onSelect: () => acknowledgeRow(row) },
    {
      id: 'delete',
      label: 'Delete Income',
      onSelect: () => onDelete(row.id),
      ...destructiveAction('Delete income')
    }
  ]
}

function paymentRowActions(
  row: PaymentRow,
  onDelete: (id: string) => void,
  onEdit: (row: PaymentRow) => void
): readonly RowActionItem[] {
  return [
    { id: 'view', label: 'View Details', onSelect: () => acknowledgeRow(row) },
    { id: 'adjustment', label: 'Record Adjustment', onSelect: () => acknowledgeRow(row) },
    { id: 'edit', label: 'Edit Payment', onSelect: () => onEdit(row) },
    { id: 'print', label: 'Print Receipt', onSelect: () => acknowledgeRow(row) },
    {
      id: 'delete',
      label: 'Delete Payment',
      onSelect: () => onDelete(row.id),
      ...destructiveAction('Delete payment')
    }
  ]
}

function ReportTab({
  tab,
  onAddEntry,
  addEntryLabel,
  selectedHistoryId,
  onSelectHistory,
  onDelete,
  onDeleteSelected,
  onEdit
}: {
  tab: (typeof reportTabs)[number]
  onAddEntry: () => void
  addEntryLabel: string
  selectedHistoryId?: string
  onSelectHistory: (record: InstallmentHistoryRecord) => void
  onDelete: (id: string) => void
  onDeleteSelected: (rows: ReportRow[]) => boolean
  onEdit: (row: ExpenseRow | IncomeRow | PaymentRow) => void
}): React.JSX.Element {
  switch (tab) {
    case 'Expenses':
      return (
        <ReportDataTable
          columns={expenseColumns}
          data={expenseData}
          filterPlaceholder="Filter expenses..."
          onAddEntry={onAddEntry}
          addEntryLabel={addEntryLabel}
          getRowActions={(row) => expenseRowActions(row, onDelete, onEdit)}
          onDeleteSelected={onDeleteSelected}
          onDefaultAction={acknowledgeRow}
        />
      )
    case 'Income':
      return (
        <ReportDataTable
          columns={incomeColumns}
          data={incomeData}
          filterPlaceholder="Filter income..."
          onAddEntry={onAddEntry}
          addEntryLabel={addEntryLabel}
          getRowActions={(row) => incomeRowActions(row, onDelete, onEdit)}
          onDeleteSelected={onDeleteSelected}
          onDefaultAction={acknowledgeRow}
        />
      )
    case 'Payment':
      return (
        <ReportDataTable
          columns={paymentColumns}
          data={paymentData}
          filterPlaceholder="Filter payments..."
          onAddEntry={onAddEntry}
          addEntryLabel={addEntryLabel}
          getRowActions={(row) => paymentRowActions(row, onDelete, onEdit)}
          onDeleteSelected={onDeleteSelected}
          onDefaultAction={acknowledgeRow}
        />
      )
    case 'Activity':
      return (
        <InstallmentHistoryTable
          records={installmentHistoryData}
          selectedId={selectedHistoryId}
          onSelect={() => undefined}
          onDoubleClick={onSelectHistory}
        />
      )
  }
}

const formFields: Record<(typeof reportTabs)[number], string[]> = {
  Expenses: ['Type', 'Description', 'Category', 'Receipt No.', 'VAT', 'Amount'],
  Income: ['Date', 'Particular', 'Receipt / Reference No.', 'Remarks', 'Amount'],
  Payment: ['Type', 'Bank / Provider', 'Account Name', 'Reference No.', 'Date', 'Amount'],
  Activity: []
}

function ReportDatePicker({ id, label }: { id: string; label: string }): React.JSX.Element {
  const [open, setOpen] = React.useState(false)
  const [date, setDate] = React.useState<Date>()
  const [value, setValue] = React.useState('')

  return (
    <InputGroup>
      <InputGroupInput
        id={id}
        name={id}
        value={value}
        placeholder="YYYY-MM-DD"
        aria-label="Date"
        onChange={(event) => {
          const nextValue = event.target.value
          const nextDate = parse(nextValue, 'yyyy-MM-dd', new Date())
          setValue(nextValue)
          if (
            isValid(nextDate) &&
            nextValue.length === 10 &&
            format(nextDate, 'yyyy-MM-dd') === nextValue
          ) {
            setDate(nextDate)
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setOpen(true)
          }
        }}
      />
      <InputGroupAddon align="inline-end">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <InputGroupButton variant="ghost" size="icon-xs" aria-label={`Select ${label}`} />
            }
          >
            <CalendarIcon />
          </PopoverTrigger>
          <PopoverContent className="w-auto overflow-hidden p-0" align="end">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(nextDate) => {
                setDate(nextDate)
                setValue(nextDate ? format(nextDate, 'yyyy-MM-dd') : '')
                setOpen(false)
              }}
            />
          </PopoverContent>
        </Popover>
      </InputGroupAddon>
    </InputGroup>
  )
}

function ReportDetailsForm({ tab }: { tab: (typeof reportTabs)[number] }): React.JSX.Element {
  return (
    <FieldGroup className="p-4">
      {formFields[tab].map((field) => {
        const id = `${tab}-${field}`.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
        const options =
          tab === 'Expenses' && field === 'Type'
            ? expenseTypes
            : tab === 'Expenses' && field === 'Category'
              ? expenseCategories
              : tab === 'Expenses' && field === 'VAT'
                ? vatOptions
                : tab === 'Payment' && field === 'Type'
                  ? paymentTypes
                  : null

        return (
          <Field key={field}>
            <FieldLabel htmlFor={id}>{field}</FieldLabel>
            {options ? (
              <Select name={id}>
                <SelectTrigger id={id} className="w-full" aria-label={field}>
                  <SelectValue placeholder={`Select ${field.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {options.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            ) : field === 'Date' ? (
              <ReportDatePicker id={id} label={field} />
            ) : /(amount|balance|principal)/i.test(field) ? (
              <InputGroup>
                <InputGroupAddon align="inline-start">
                  <InputGroupText>₱</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  id={id}
                  name={id}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={`Enter ${field.toLowerCase()}`}
                />
              </InputGroup>
            ) : (
              <Input id={id} name={id} placeholder={`Enter ${field.toLowerCase()}`} />
            )}
          </Field>
        )
      })}
    </FieldGroup>
  )
}

function EntryFormActions(): React.JSX.Element {
  return (
    <div className="flex shrink-0 flex-wrap gap-2 border-t p-3">
      <Button type="submit" size="sm">
        Save Entry
      </Button>
      <Button type="button" variant="outline" size="sm">
        Save &amp; New
      </Button>
      <Button type="reset" variant="ghost" size="sm">
        Clear
      </Button>
    </div>
  )
}

function EntryFormPanel({
  tab,
  onSave
}: {
  tab: (typeof reportTabs)[number]
  onSave: (form: FormData) => void
}): React.JSX.Element {
  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault()
        onSave(new FormData(event.currentTarget))
      }}
    >
      <ScrollArea className="min-h-0 flex-1">
        <ReportDetailsForm tab={tab} />
      </ScrollArea>
      <EntryFormActions />
    </form>
  )
}

export function CashierReportsContent({
  summaryAlwaysDark = false
}: {
  summaryAlwaysDark?: boolean
}): React.JSX.Element {
  const [activeTab, setActiveTab] = React.useState<(typeof reportTabs)[number]>(reportTabs[0])
  const [expenses, setExpenses] = React.useState(expenseData)
  const [incomes, setIncomes] = React.useState(incomeData)
  const [payments, setPayments] = React.useState(paymentData)
  const [isEntryFormVisible, setIsEntryFormVisible] = React.useState(false)
  const [isSummaryVisible, setIsSummaryVisible] = React.useState(false)
  const [selectedHistory, setSelectedHistory] = React.useState<InstallmentHistoryRecord>()
  const isMobile = useIsMobile()
  const isHistoryTab = activeTab === 'Activity'
  const showRightPanel = !isMobile && isEntryFormVisible

  const editAmount = React.useCallback((row: ExpenseRow | IncomeRow | PaymentRow): void => {
    const nextAmount = window.prompt('Amount', String(row.amount))
    if (nextAmount === null) return
    const amount = Number(nextAmount)
    if (!Number.isFinite(amount) || amount < 0) return
    if ('particular' in row)
      setIncomes((current) =>
        current.map((item) => (item.id === row.id ? { ...item, amount } : item))
      )
    else if ('bankProvider' in row)
      setPayments((current) =>
        current.map((item) => (item.id === row.id ? { ...item, amount } : item))
      )
    else
      setExpenses((current) =>
        current.map((item) => (item.id === row.id ? { ...item, amount } : item))
      )
  }, [])

  const deleteEntry = React.useCallback((id: string): void => {
    const ids = new Set([id])
    setExpenses((current) => current.filter((row) => !ids.has(row.id)))
    setIncomes((current) => current.filter((row) => !ids.has(row.id)))
    setPayments((current) => current.filter((row) => !ids.has(row.id)))
  }, [])

  const deleteSelectedEntries = React.useCallback((rows: ReportRow[]): boolean => {
    const ids = new Set(rows.map((row) => row.id))
    if (!window.confirm(`Delete ${ids.size} selected entr${ids.size === 1 ? 'y' : 'ies'}?`))
      return false
    setExpenses((current) => current.filter((row) => !ids.has(row.id)))
    setIncomes((current) => current.filter((row) => !ids.has(row.id)))
    setPayments((current) => current.filter((row) => !ids.has(row.id)))
    return true
  }, [])

  const saveEntry = React.useCallback((tab: (typeof reportTabs)[number], form: FormData): void => {
    const amount = Number(form.get(`${tab.toLowerCase()}-amount`) ?? 0)
    if (!Number.isFinite(amount) || amount < 0) return
    const id = `${tab.toLowerCase()}-${Date.now()}`
    if (tab === 'Expenses') {
      setExpenses((current) => [
        ...current,
        {
          id,
          type: String(form.get('expenses-type') || 'Operating'),
          description: String(form.get('expenses-description') || 'New expense'),
          category: String(form.get('expenses-category') || 'Others'),
          receiptNo: String(form.get('expenses-receipt-no-') || id.toUpperCase()),
          vat: String(form.get('expenses-vat') || ''),
          amount
        }
      ])
    } else if (tab === 'Income') {
      setIncomes((current) => [
        ...current,
        {
          id,
          particular: String(form.get('income-particular') || 'Other income'),
          remarks: String(form.get('income-remarks') || ''),
          receiptRefNo: String(form.get('income-receipt-reference-no-') || id.toUpperCase()),
          date: String(form.get('income-date') || '2026-07-14'),
          amount
        }
      ])
    } else if (tab === 'Payment') {
      setPayments((current) => [
        ...current,
        {
          id,
          type: String(form.get('payment-type') || 'Bank Check'),
          bankProvider: String(form.get('payment-bank-provider') || ''),
          accountName: String(form.get('payment-account-name') || ''),
          referenceNo: String(form.get('payment-reference-no-') || id.toUpperCase()),
          date: String(form.get('payment-date') || '2026-07-14'),
          amount
        }
      ])
    }
    setIsEntryFormVisible(false)
  }, [])

  React.useEffect(() => {
    if (!isEntryFormVisible) return
    const firstField = formFields[activeTab][0]
    const id = `${activeTab}-${firstField}`.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    document.getElementById(id)?.focus()
  }, [activeTab, isEntryFormVisible])

  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden p-3">
      <div
        className={
          isMobile
            ? 'grid h-full min-h-0 w-full min-w-0 grid-cols-1 gap-3'
            : showRightPanel
              ? 'grid h-full min-h-0 w-full min-w-0 grid-cols-[minmax(180px,220px)_minmax(0,1fr)_minmax(260px,302px)] gap-3 max-[900px]:grid-cols-[minmax(160px,190px)_minmax(0,1fr)]'
              : 'grid h-full min-h-0 w-full min-w-0 grid-cols-[minmax(220px,262px)_minmax(0,1fr)] gap-3'
        }
      >
        {!isMobile && (
          <Card className="flex min-h-0 min-w-0 flex-col">
            <ReportSummary
              expenses={expenses}
              incomes={incomes}
              payments={payments}
              installmentHistory={installmentHistoryData}
              alwaysDark={summaryAlwaysDark}
            />
          </Card>
        )}
        <Card className="flex min-h-0 min-w-0 flex-col py-0 shadow-sm">
          <CardContent className="flex min-h-0 flex-1 flex-col p-0">
            <Tabs
              value={activeTab}
              onValueChange={(value) => {
                const nextTab = value as (typeof reportTabs)[number]
                setActiveTab(nextTab)
                if (nextTab === 'Activity') setIsEntryFormVisible(false)
              }}
              className="flex min-h-0 flex-1 flex-col gap-0"
            >
              <div className="shrink-0 overflow-x-auto border-b [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <TabsList
                  aria-label="Cashier report sections"
                  variant="line"
                  className="h-9 w-max min-w-full justify-start rounded-none bg-transparent p-0"
                >
                  {reportTabs.map((tab) => (
                    <TabsTrigger
                      key={tab}
                      value={tab}
                      className="h-9 flex-none rounded-none px-3 text-xs font-normal data-active:font-light"
                    >
                      {tab === 'Activity' ? 'Installment History' : tab}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {reportTabs.map((tab) => (
                  <TabsContent
                    key={tab}
                    value={tab}
                    className="flex min-h-0 flex-1 flex-col overflow-hidden"
                  >
                    <ReportTab
                      tab={tab}
                      onAddEntry={() => setIsEntryFormVisible((visible) => !visible)}
                      addEntryLabel={isEntryFormVisible ? 'Hide Entry' : 'Add Entry'}
                      selectedHistoryId={selectedHistory?.id}
                      onSelectHistory={setSelectedHistory}
                      onDelete={deleteEntry}
                      onDeleteSelected={deleteSelectedEntries}
                      onEdit={editAmount}
                    />
                  </TabsContent>
                ))}
              </div>
            </Tabs>
          </CardContent>
        </Card>
        {showRightPanel && !isHistoryTab && (
          <Card className="flex min-h-0 min-w-0 flex-col">
            <EntryFormPanel tab={activeTab} onSave={(form) => saveEntry(activeTab, form)} />
          </Card>
        )}
      </div>
      {isMobile && (
        <>
          <Button
            type="button"
            size="sm"
            className="fixed right-4 bottom-4"
            onClick={() => setIsSummaryVisible(true)}
          >
            Today&apos;s Summary
          </Button>
          <Sheet open={isSummaryVisible} onOpenChange={setIsSummaryVisible}>
            <SheetContent side="left" className="w-[min(92vw,22rem)] p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Today&apos;s Summary</SheetTitle>
                <SheetDescription>Daily cashier report totals and cash variance.</SheetDescription>
              </SheetHeader>
              <ReportSummary
                expenses={expenses}
                incomes={incomes}
                payments={payments}
                installmentHistory={installmentHistoryData}
                alwaysDark={summaryAlwaysDark}
              />
            </SheetContent>
          </Sheet>
        </>
      )}
      {isMobile && !isHistoryTab && (
        <Sheet open={isEntryFormVisible} onOpenChange={setIsEntryFormVisible}>
          <SheetContent side="right" className="w-[min(92vw,26rem)] p-0">
            <SheetHeader>
              <SheetTitle>{activeTab} Entry</SheetTitle>
              <SheetDescription>
                Add a cashier report entry for {activeTab.toLowerCase()}.
              </SheetDescription>
            </SheetHeader>
            <EntryFormPanel tab={activeTab} onSave={(form) => saveEntry(activeTab, form)} />
          </SheetContent>
        </Sheet>
      )}
      {isHistoryTab && (
        <Sheet
          open={Boolean(selectedHistory)}
          onOpenChange={(open) => !open && setSelectedHistory(undefined)}
        >
          <SheetContent side="right" className="w-[min(92vw,26rem)] p-0">
            <SheetHeader>
              <SheetTitle>Installment History details</SheetTitle>
              <SheetDescription>Full details for the selected history record.</SheetDescription>
            </SheetHeader>
            <InstallmentHistoryInspector record={selectedHistory} />
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}
