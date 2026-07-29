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
import { formatPhilippinePeso } from '@/lib/currency'
import { useIsMobile } from '@/hooks/use-mobile'
import { ReportSummary } from '@/features/cashier-report/components/report-summary'
import { useExpenses, type ExpenseTableRow } from '@/features/cashier-report/hooks/use-expenses'
import { useActiveReport } from '@/contexts/active-report-context'
import {
  expenseTypeValues,
  parseAmountToCentavos,
  type DailyReportPaymentEntryRecord,
  type ExpenseCategory,
  type ExpenseType,
  type ExpenseVat,
  type IncomeEntryRecord
} from '@/../../shared/contracts'

const reportTabs = ['Expenses', 'Income', 'Payment', 'Activity'] as const
const noopHistorySelect = (): void => undefined

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

type ExpenseRow = ExpenseTableRow

type IncomeRow = ReportRow & {
  categoryId: string
  particular: string
  remarks: string
  receiptRefNo: string
  date: string
  amount: number
}
type PaymentRow = ReportRow & {
  paymentMethodId: string
  type: string
  bankProvider: string
  accountName: string
  referenceNo: string
  date: string
  amount: number
}

const money = formatPhilippinePeso

function TypeBox({ value }: { value: string }): React.JSX.Element {
  return (
    <span className="inline-flex h-5 items-center rounded-sm bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
      {value}
    </span>
  )
}

function TruncatedText({
  value,
  className
}: {
  value: string
  className?: string
}): React.JSX.Element {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={<span className={cn('block min-w-0 truncate', className)} tabIndex={0} />}
        >
          {value}
        </TooltipTrigger>
        <TooltipContent className="max-w-80">{value}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
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
    size: 88,
    meta: { className: 'text-muted-foreground' }
  },
  {
    accessorKey: 'description',
    header: 'Description',
    size: 240,
    cell: ({ getValue }) => <TruncatedText value={getValue<string>()} className="font-light" />,
    meta: { className: 'min-w-0', autoSize: true }
  },
  {
    accessorKey: 'category',
    header: 'Category',
    cell: ({ getValue }) => <ExpenseCategoryCell category={getValue<string>()} />,
    size: 88,
    meta: { className: 'text-muted-foreground' }
  },
  {
    accessorKey: 'receiptNo',
    header: 'Receipt No',
    size: 96,
    meta: { className: 'text-xs text-muted-foreground' }
  },
  {
    accessorKey: 'vat',
    header: 'VAT',
    size: 70,
    meta: { className: 'text-xs text-muted-foreground' }
  },
  {
    accessorKey: 'amount',
    header: 'Amount',
    cell: ({ getValue }) => money(getValue<number>()),
    size: 120,
    meta: {
      className: 'text-right font-light tabular-nums text-foreground'
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
    cell: ({ getValue }) => <TruncatedText value={getValue<string>()} className="font-light" />,
    meta: { className: 'min-w-0', autoSize: true }
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
    cell: ({ getValue }) => (
      <TruncatedText value={getValue<string>()} className="text-muted-foreground" />
    ),
    meta: { className: 'min-w-0' }
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
    cell: ({ getValue }) => (
      <TruncatedText value={getValue<string>()} className="text-muted-foreground" />
    ),
    meta: { className: 'min-w-0', autoSize: true }
  },
  {
    accessorKey: 'accountName',
    header: 'ACCOUNT NAME',
    size: 200,
    cell: ({ getValue }) => <TruncatedText value={getValue<string>()} className="font-light" />,
    meta: { className: 'min-w-0' }
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

const paymentMethodByLabel: Record<string, string> = {
  'Bank Check': 'report-payment-method-check',
  'Bank Transfer': 'report-payment-method-bank-transfer',
  GCash: 'report-payment-method-gcash',
  'Other e-wallet': 'report-payment-method-other-ewallet'
}

const paymentLabelByMethod = Object.fromEntries(
  Object.entries(paymentMethodByLabel).map(([label, id]) => [id, label])
) as Record<string, string>

function incomeRow(record: IncomeEntryRecord): IncomeRow {
  return {
    id: record.id,
    categoryId: record.categoryId,
    particular: record.particular,
    remarks: record.remarks ?? '',
    receiptRefNo: record.receiptNumber ?? '',
    date: record.transactionDate,
    amount: record.amountCentavos / 100
  }
}

function paymentRow(record: DailyReportPaymentEntryRecord): PaymentRow {
  return {
    id: record.id,
    paymentMethodId: record.paymentMethodId,
    type: paymentLabelByMethod[record.paymentMethodId] ?? 'Other e-wallet',
    bankProvider: record.bankName ?? '',
    accountName: record.payerName ?? '',
    referenceNo: record.referenceNumber ?? '',
    date: record.transactionDate,
    amount: record.amountCentavos / 100
  }
}

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
  expenseRows,
  incomeRows,
  paymentRows,
  expenseQuery,
  onDeleteExpense,
  onDeleteSelectedExpenses,
  onAddEntry,
  addEntryLabel,
  selectedHistoryId,
  onSelectHistory,
  onDelete,
  onDeleteSelected,
  onEdit
}: {
  tab: (typeof reportTabs)[number]
  expenseRows: ExpenseRow[]
  incomeRows: IncomeRow[]
  paymentRows: PaymentRow[]
  expenseQuery: ReturnType<typeof useExpenses>
  onDeleteExpense: (id: string) => Promise<void>
  onDeleteSelectedExpenses: (rows: ExpenseRow[]) => Promise<boolean>
  onAddEntry: () => void
  addEntryLabel: string
  selectedHistoryId?: string
  onSelectHistory: (record: InstallmentHistoryRecord) => void
  onDelete: (id: string) => void
  onDeleteSelected: (rows: ReportRow[]) => boolean | Promise<boolean>
  onEdit: (row: ExpenseRow | IncomeRow | PaymentRow) => void
}): React.JSX.Element {
  const getExpenseActions = React.useCallback(
    (row: ExpenseRow) => expenseRowActions(row, onDeleteExpense, onEdit),
    [onDeleteExpense, onEdit]
  )
  const getIncomeActions = React.useCallback(
    (row: IncomeRow) => incomeRowActions(row, onDelete, onEdit),
    [onDelete, onEdit]
  )
  const getPaymentActions = React.useCallback(
    (row: PaymentRow) => paymentRowActions(row, onDelete, onEdit),
    [onDelete, onEdit]
  )
  const onExpenseDefaultAction = React.useCallback(
    (row: ExpenseRow) => {
      expenseQuery.setSelectedId(row.id)
      acknowledgeRow(row)
    },
    [expenseQuery.setSelectedId]
  )

  switch (tab) {
    case 'Expenses':
      return (
        <ReportDataTable
          columns={expenseColumns}
          data={expenseRows}
          filterPlaceholder="Filter expenses..."
          onAddEntry={onAddEntry}
          addEntryLabel={addEntryLabel}
          getRowActions={getExpenseActions}
          onDeleteSelected={onDeleteSelectedExpenses}
          onDefaultAction={onExpenseDefaultAction}
          serverState={expenseQuery}
          filterOptions={{
            type: expenseTypeValues,
            category: expenseCategories,
            vat: vatOptions
          }}
        />
      )
    case 'Income':
      return (
        <ReportDataTable
          columns={incomeColumns}
          data={incomeRows}
          filterPlaceholder="Filter income..."
          onAddEntry={onAddEntry}
          addEntryLabel={addEntryLabel}
          getRowActions={getIncomeActions}
          onDeleteSelected={onDeleteSelected}
          onDefaultAction={acknowledgeRow}
        />
      )
    case 'Payment':
      return (
        <ReportDataTable
          columns={paymentColumns}
          data={paymentRows}
          filterPlaceholder="Filter payments..."
          onAddEntry={onAddEntry}
          addEntryLabel={addEntryLabel}
          getRowActions={getPaymentActions}
          onDeleteSelected={onDeleteSelected}
          onDefaultAction={acknowledgeRow}
        />
      )
    case 'Activity':
      return (
        <InstallmentHistoryTable
          records={installmentHistoryData}
          selectedId={selectedHistoryId}
          onSelect={noopHistorySelect}
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
  const expenseQuery = useExpenses()
  const { reportId } = useActiveReport()
  const { createExpense, removeExpenses, updateExpense } = expenseQuery
  const [incomes, setIncomes] = React.useState<IncomeRow[]>([])
  const [payments, setPayments] = React.useState<PaymentRow[]>([])
  const [isEntryFormVisible, setIsEntryFormVisible] = React.useState(false)
  const [isSummaryVisible, setIsSummaryVisible] = React.useState(false)
  const [selectedHistory, setSelectedHistory] = React.useState<InstallmentHistoryRecord>()
  const isMobile = useIsMobile()
  const isHistoryTab = activeTab === 'Activity'
  const showRightPanel = !isMobile && isEntryFormVisible
  const toggleEntryForm = React.useCallback(() => setIsEntryFormVisible((visible) => !visible), [])
  const refreshEntries = React.useCallback(async (): Promise<void> => {
    const [incomeResult, paymentResult] = await Promise.all([
      window.api.dailyReports.listIncome({ dailyReportId: reportId, status: 'POSTED' }),
      window.api.dailyReports.listPayments({ dailyReportId: reportId, status: 'POSTED' })
    ])
    setIncomes(incomeResult.rows.map(incomeRow))
    setPayments(paymentResult.rows.map(paymentRow))
  }, [reportId])

  React.useEffect(() => {
    void refreshEntries().catch(() => {
      setIncomes([])
      setPayments([])
    })
  }, [refreshEntries])

  const editAmount = React.useCallback(
    async (row: ExpenseRow | IncomeRow | PaymentRow): Promise<void> => {
      const nextAmount = window.prompt('Amount', String(row.amount))
      if (nextAmount === null) return
      if ('reportId' in row) {
        let amountCentavos: number
        try {
          amountCentavos = parseAmountToCentavos(nextAmount)
        } catch {
          return
        }
        await updateExpense({
          id: row.id,
          type: row.type,
          description: row.description,
          category: row.category,
          receiptNo: row.receiptNo,
          vat: row.vat,
          amountCentavos
        })
        return
      }
      const amount = Number(nextAmount)
      if (!Number.isFinite(amount) || amount < 0) return
      try {
        const amountCentavos = parseAmountToCentavos(nextAmount)
        if ('particular' in row) {
          await window.api.dailyReports.updateIncome({
            id: row.id,
            categoryId: row.categoryId,
            transactionDate: row.date,
            particular: row.particular,
            receiptNumber: row.receiptRefNo || null,
            remarks: row.remarks || null,
            amountCentavos
          })
        } else if ('bankProvider' in row) {
          await window.api.dailyReports.updatePayment({
            id: row.id,
            paymentMethodId: row.paymentMethodId,
            transactionDate: row.date,
            referenceNumber: row.referenceNo || null,
            bankName: row.bankProvider || null,
            payerName: row.accountName || null,
            remarks: null,
            amountCentavos
          })
        } else return
        await refreshEntries()
      } catch {
        return
      }
    },
    [refreshEntries, updateExpense]
  )

  const deleteExpense = React.useCallback(
    async (id: string): Promise<void> => {
      try {
        await removeExpenses([id])
      } catch {
        return
      }
    },
    [removeExpenses]
  )

  const deleteSelectedExpenses = React.useCallback(
    async (rows: ExpenseRow[]): Promise<boolean> => {
      const ids = rows.map((row) => row.id)
      if (!window.confirm(`Delete ${ids.length} selected entr${ids.length === 1 ? 'y' : 'ies'}?`))
        return false
      try {
        await removeExpenses(ids)
        return true
      } catch {
        return false
      }
    },
    [removeExpenses]
  )

  const deleteEntry = React.useCallback(
    async (id: string): Promise<void> => {
      const income = incomes.find((row) => row.id === id)
      const payment = payments.find((row) => row.id === id)
      try {
        if (income) await window.api.dailyReports.voidIncome({ id, voidReason: 'Voided from Cashier Reports' })
        else if (payment)
          await window.api.dailyReports.voidPayment({ id, voidReason: 'Voided from Cashier Reports' })
        else return
        await refreshEntries()
      } catch {
        return
      }
    },
    [incomes, payments, refreshEntries]
  )

  const deleteSelectedEntries = React.useCallback(async (rows: ReportRow[]): Promise<boolean> => {
    const ids = new Set(rows.map((row) => row.id))
    if (!window.confirm(`Delete ${ids.size} selected entr${ids.size === 1 ? 'y' : 'ies'}?`))
      return false
    try {
      await Promise.all(
        [...ids].map((id) => {
          if (incomes.some((row) => row.id === id)) {
            return window.api.dailyReports.voidIncome({ id, voidReason: 'Voided from Cashier Reports' })
          }
          return window.api.dailyReports.voidPayment({ id, voidReason: 'Voided from Cashier Reports' })
        })
      )
      await refreshEntries()
      return true
    } catch {
      return false
    }
  }, [incomes, refreshEntries])

  const saveEntry = React.useCallback(
    async (tab: (typeof reportTabs)[number], form: FormData): Promise<void> => {
      if (tab === 'Expenses') {
        try {
          await createExpense({
            reportId,
            type: String(form.get('expenses-type') || 'Operating') as ExpenseType,
            description: String(form.get('expenses-description') || 'New expense'),
            category: String(form.get('expenses-category') || 'Others') as ExpenseCategory,
            receiptNo: String(form.get('expenses-receipt-no-') || ''),
            vat: String(form.get('expenses-vat') || '') as ExpenseVat,
            amountCentavos: parseAmountToCentavos(String(form.get('expenses-amount') || '0'))
          })
          setIsEntryFormVisible(false)
        } catch {
          return
        }
        return
      }

      let amountCentavos: number
      try {
        amountCentavos = parseAmountToCentavos(String(form.get(`${tab.toLowerCase()}-amount`) ?? '0'))
      } catch {
        return
      }
      if (tab === 'Income') {
        await window.api.dailyReports.createIncome({
          dailyReportId: reportId,
          categoryId: 'income-category-other-income',
          transactionDate: String(form.get('income-date') || format(new Date(), 'yyyy-MM-dd')),
          particular: String(form.get('income-particular') || 'Other income'),
          receiptNumber: String(form.get('income-receipt-reference-no-') || '') || null,
          remarks: String(form.get('income-remarks') || '') || null,
          amountCentavos
        })
      } else if (tab === 'Payment') {
        const type = String(form.get('payment-type') || 'Bank Check')
        await window.api.dailyReports.createPayment({
          dailyReportId: reportId,
          paymentMethodId: paymentMethodByLabel[type] ?? 'report-payment-method-other-ewallet',
          transactionDate: String(form.get('payment-date') || format(new Date(), 'yyyy-MM-dd')),
          referenceNumber: String(form.get('payment-reference-no-') || '') || null,
          bankName: String(form.get('payment-bank-provider') || '') || null,
          payerName: String(form.get('payment-account-name') || '') || null,
          remarks: null,
          amountCentavos
        })
      }
      await refreshEntries()
      setIsEntryFormVisible(false)
    },
    [createExpense, refreshEntries, reportId]
  )

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
              expenseTotals={expenseQuery.expenseTotals}
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
                      expenseRows={expenseQuery.rows}
                      incomeRows={incomes}
                      paymentRows={payments}
                      expenseQuery={expenseQuery}
                      onDeleteExpense={deleteExpense}
                      onDeleteSelectedExpenses={deleteSelectedExpenses}
                      onAddEntry={toggleEntryForm}
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
                expenseTotals={expenseQuery.expenseTotals}
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
