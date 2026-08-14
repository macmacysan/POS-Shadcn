import * as React from 'react'
import { addDays, format, isValid, parse, startOfDay } from 'date-fns'
import { CalendarIcon } from '@phosphor-icons/react'
import {
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  Bus,
  CarFront,
  ChevronLeft,
  ChevronRight,
  Check,
  CircleAlert,
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
  FileDown,
  ReceiptText,
  Scale,
  ShieldCheck,
  Soup,
  Utensils,
  WalletCards,
  Zap,
  type LucideIcon
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent } from '@/components/ui/card'
import { Calendar } from '@/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ReportDataTable,
  type ReportColumn,
  type ReportRow
} from '@/features/cashier-report/components/report-data-table'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
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
import { ConfirmationAlertDialog } from '@/components/shared/confirmation-alert-dialog'
import { VoidEntryDialog } from '@/components/shared/void-entry-dialog'
import type { EntryEntityType, EntryHistoryRecord } from '@/../../shared/contracts'
import type { DateSelectorValue } from '@/../../components/reui/date-selector'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { InstallmentHistoryRecord } from '@/lib/installment-history'
import { cn } from '@/lib/utils'
import { formatAmountInput, formatPhilippinePeso, pesoSign } from '@/lib/currency'
import { useMediaQuery } from '@/hooks/use-mobile'
import { ReportSummary } from '@/features/cashier-report/components/report-summary'
import { ReportDateDialog } from '@/features/cashier-report/components/report-date-dialog'
import { useExpenses, type ExpenseTableRow } from '@/features/cashier-report/hooks/use-expenses'
import { useActiveReport } from '@/contexts/active-report-context'
import {
  expenseTypeValues,
  amountFromCentavos,
  type CatalogOptionRecord,
  parseAmountToCentavos,
  type DailyReportPaymentEntryRecord,
  type ExpenseCategory,
  type ExpenseType,
  type ExpenseVat,
  type ExpenseRecord,
  type IncomeEntryRecord,
  type InstallmentHistoryRecord as PersistedInstallmentHistoryRecord,
  type LoginBranch
} from '@/../../shared/contracts'
import { cashierReportPdfHtml } from '@/features/cashier-report/lib/cashier-report-pdf'

const reportTabs = ['Expenses', 'Income', 'Payment', 'Activity'] as const
const noopHistorySelect = (): void => undefined

const expenseTypes = ['Company Expenses', 'Drawings', 'Purchases', 'Receivables'] as const
const vatOptions = ['VAT', 'Non-VAT'] as const
const paymentTypes = ['Bank Check', 'Bank Transfer', 'GCash', 'Other e-wallet'] as const

type PdfProgressStepId = 'save' | 'telegram'
type PdfProgressStatus = 'pending' | 'processing' | 'done' | 'failed'
type PdfProgressStep = {
  id: PdfProgressStepId
  label: string
  status: PdfProgressStatus
  error?: string
  attempts: number
}

const initialPdfProgress: PdfProgressStep[] = [
  { id: 'save', label: 'Saving to Documents', status: 'pending', attempts: 0 },
  { id: 'telegram', label: 'Sending to Telegram', status: 'pending', attempts: 0 }
]

function filenameSegment(value: string): string {
  const segment = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]/g, '')
  return segment || 'Report'
}

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
type ReportEntryRow = ExpenseRow | IncomeRow | PaymentRow

type IncomeRow = ReportRow & {
  branch: string
  categoryId: string
  particular: string
  remarks: string
  receiptRefNo: string
  date: string
  amount: number
  amountCentavos: number
  status: 'POSTED' | 'VOIDED'
  voidedAt: string | null
  voidReason: string | null
  createdByUserId: string
  createdByName: string
  createdAt: string
  updatedAt: string
}
type PaymentRow = ReportRow & {
  branch: string
  paymentMethodId: string
  type: string
  bankProvider: string
  accountName: string
  referenceNo: string
  date: string
  amount: number
  amountCentavos: number
  status: 'POSTED' | 'VOIDED'
  voidedAt: string | null
  voidReason: string | null
  createdByUserId: string
  createdByName: string
  createdAt: string
  updatedAt: string
}

type EntryLoadState = {
  isLoading: boolean
  error?: string
}

const money = formatPhilippinePeso

function installmentHistoryRow(
  record: PersistedInstallmentHistoryRecord
): InstallmentHistoryRecord {
  const accountDetails = `${record.accountName} · ${record.accountNumber}`
  const paymentDetails = {
    datePaid: record.occurredAt.slice(0, 10),
    referenceNumber: record.referenceNumber,
    amountPaid:
      record.amountCentavos === undefined ? undefined : amountFromCentavos(record.amountCentavos)
  }
  const details: InstallmentHistoryRecord['details'] =
    record.action === 'deleted'
      ? { kind: 'deleted', snapshot: { accountDetails }, payment: paymentDetails }
      : record.action === 'edited'
        ? { kind: 'edited', changes: [], payment: paymentDetails }
        : { kind: 'new', snapshot: { accountDetails }, payment: paymentDetails }

  return {
    id: record.id,
    occurredAt: record.occurredAt,
    action: record.action,
    source: record.source,
    accountId: record.accountId,
    branch: record.branch,
    accountName: record.accountName,
    reference: record.referenceNumber ?? record.accountNumber,
    activity: record.activity,
    amount:
      record.amountCentavos === undefined ? undefined : amountFromCentavos(record.amountCentavos),
    details
  }
}

function CashierReportHeader({
  branchId,
  cashierUserId,
  dateRange,
  isLoading,
  isExporting,
  error,
  showExport = true,
  showDateSelector = true,
  onDateRangeChange,
  onExport
}: {
  branchId: string
  cashierUserId: string
  dateRange: DateSelectorValue
  isLoading: boolean
  isExporting: boolean
  error?: string
  showExport?: boolean
  showDateSelector?: boolean
  onDateRangeChange: (value: DateSelectorValue) => void
  onExport: () => void
}): React.JSX.Element {
  const startDate = dateRange.startDate
  const today = startOfDay(new Date())
  const selectedDay = startDate ? startOfDay(startDate) : undefined
  const selectDate = (date: Date): void =>
    onDateRangeChange({ period: 'day', operator: 'is', startDate: date, endDate: date })

  return (
    <header className="flex shrink-0 items-center justify-end gap-2 px-3 py-1">
      {error && (
        <span className="mr-auto text-xs text-destructive" role="alert">
          {error}
        </span>
      )}
      <div className="flex shrink-0 items-center gap-1">
        {showExport && (
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Review report"
            disabled={isLoading || isExporting}
            onClick={onExport}
          >
            <FileDown aria-hidden="true" />
          </Button>
        )}
        {showDateSelector && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="View previous business day"
              disabled={isLoading || !startDate}
              onClick={() => startDate && selectDate(addDays(startDate, -1))}
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <ReportDateDialog
              branchId={branchId}
              cashierUserId={cashierUserId}
              date={startDate}
              disabled={isLoading}
              onSelect={selectDate}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="View next business day"
              disabled={isLoading || !selectedDay || selectedDay.getTime() >= today.getTime()}
              onClick={() => startDate && selectDate(addDays(startDate, 1))}
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </>
        )}
      </div>
    </header>
  )
}

const entryTypeBadgeClasses: Record<'expense' | 'payment', Record<string, string>> = {
  expense: {
    'Company Expenses':
      'border-status-warning/25 bg-status-warning/15 text-status-warning-foreground',
    Drawings: 'border-secondary bg-secondary text-secondary-foreground',
    Purchases: 'border-interactive-muted bg-interactive-muted text-interactive-muted-foreground',
    Receivables: 'border-status-info/25 bg-status-info/15 text-status-info-foreground',
    Operating: 'border-secondary bg-secondary text-secondary-foreground',
    Supply: 'border-status-warning/25 bg-status-warning/15 text-status-warning-foreground',
    Transport: 'border-status-info/25 bg-status-info/15 text-status-info-foreground'
  },
  payment: {
    'Bank Check': 'border-status-info/25 bg-status-info/15 text-status-info-foreground',
    'Bank Transfer':
      'border-interactive-muted bg-interactive-muted text-interactive-muted-foreground',
    GCash: 'border-status-warning/25 bg-status-warning/15 text-status-warning-foreground',
    'Other e-wallet': 'border-secondary bg-secondary text-secondary-foreground'
  }
}

function TypeBox({
  value,
  kind
}: {
  value: string
  kind: 'expense' | 'payment'
}): React.JSX.Element {
  const toneClass =
    entryTypeBadgeClasses[kind][value] ?? 'border-secondary bg-secondary text-secondary-foreground'

  return (
    <Badge variant="outline" className={toneClass}>
      {value}
    </Badge>
  )
}

function TruncatedText({
  value,
  className
}: {
  value: string
  className?: string
}): React.JSX.Element {
  const textRef = React.useRef<HTMLSpanElement>(null)
  const [isTruncated, setIsTruncated] = React.useState(false)

  React.useLayoutEffect(() => {
    const text = textRef.current
    if (!text) return
    const update = (): void => {
      const next = text.scrollWidth > text.clientWidth
      setIsTruncated((current) => (current === next ? current : next))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(text)
    return () => observer.disconnect()
  }, [value])

  const text = (
    <span
      ref={textRef}
      className={cn('block min-w-0 truncate', className)}
      tabIndex={isTruncated ? 0 : undefined}
    >
      {value}
    </span>
  )

  if (!isTruncated) return text

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={text} />
        <TooltipContent className="max-w-80">{value}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function ExpenseCategoryCell({ category }: { category: string }): React.JSX.Element {
  const fallbackLabel = category.trim() || 'Unknown'
  const label = expenseCategoryConfigByValue.get(category)?.shortLabel ?? fallbackLabel
  return <TruncatedText value={label} className="text-muted-foreground" />
}

const expenseColumns: ReportColumn<ExpenseRow>[] = [
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ getValue }) => <TypeBox value={getValue<string>()} kind="expense" />,
    size: 132,
    meta: { className: 'text-muted-foreground' }
  },
  {
    accessorKey: 'description',
    header: 'Description',
    size: 220,
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
    cell: ({ getValue }) => (
      <TruncatedText value={getValue<string>()} className="text-muted-foreground" />
    ),
    meta: { className: 'text-xs text-muted-foreground' }
  },
  {
    accessorKey: 'vat',
    header: 'VAT',
    size: 80,
    meta: { className: 'text-xs text-muted-foreground' }
  },
  {
    accessorKey: 'createdByName',
    header: 'Added by',
    size: 120,
    meta: { className: 'text-muted-foreground' }
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

const compactExpenseColumns: ReportColumn<ExpenseRow>[] = [
  expenseColumns[0],
  expenseColumns[1],
  expenseColumns[6]
]

const branchColumn = {
  accessorKey: 'branch',
  header: 'Branch',
  size: 42,
  meta: { className: 'text-muted-foreground' }
} as const

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
    cell: ({ getValue }) => (
      <TruncatedText value={getValue<string>()} className="text-muted-foreground" />
    ),
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
    meta: { className: 'min-w-0', autoSize: true }
  },
  {
    accessorKey: 'createdByName',
    header: 'Added by',
    size: 120,
    meta: { className: 'text-muted-foreground' }
  },
  {
    accessorKey: 'amount',
    header: 'Amount',
    cell: ({ getValue }) => money(getValue<number>()),
    size: 112,
    meta: {
      className: cn('w-30', 'text-right font-light tabular-nums text-foreground')
    }
  }
]

const compactIncomeColumns: ReportColumn<IncomeRow>[] = [incomeColumns[1], incomeColumns[5]]

const paymentColumns: ReportColumn<PaymentRow>[] = [
  {
    accessorKey: 'type',
    header: 'Type',
    size: 132,
    cell: ({ getValue }) => <TypeBox value={getValue<string>()} kind="payment" />
  },
  {
    accessorKey: 'bankProvider',
    header: 'Bank / provider',
    size: 150,
    cell: ({ getValue }) => (
      <TruncatedText value={getValue<string>()} className="text-muted-foreground" />
    ),
    meta: { className: 'min-w-0', autoSize: true }
  },
  {
    accessorKey: 'accountName',
    header: 'Account name',
    size: 200,
    cell: ({ getValue }) => <TruncatedText value={getValue<string>()} className="font-light" />,
    meta: { className: 'min-w-0', autoSize: true }
  },
  {
    accessorKey: 'referenceNo',
    header: 'Reference no.',
    cell: ({ getValue }) => (
      <TruncatedText value={getValue<string>()} className="text-muted-foreground" />
    ),
    meta: { className: 'min-w-0 text-muted-foreground', autoSize: true }
  },
  {
    accessorKey: 'date',
    header: 'Date',
    size: 100,
    meta: { className: 'text-muted-foreground' }
  },
  {
    accessorKey: 'createdByName',
    header: 'Added by',
    size: 120,
    meta: { className: 'text-muted-foreground' }
  },
  {
    accessorKey: 'amount',
    header: 'Amount',
    size: 112,
    cell: ({ getValue }) => money(getValue<number>()),
    meta: { className: 'text-right font-light tabular-nums text-foreground' }
  }
]

const compactPaymentColumns: ReportColumn<PaymentRow>[] = [
  paymentColumns[0],
  paymentColumns[1],
  paymentColumns[6]
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
    branch: record.branch,
    categoryId: record.categoryId,
    particular: record.particular,
    remarks: record.remarks ?? '',
    receiptRefNo: record.receiptNumber ?? '',
    date: record.transactionDate,
    amount: record.amountCentavos / 100,
    amountCentavos: record.amountCentavos,
    status: record.status,
    voidedAt: record.voidedAt,
    voidReason: record.voidReason,
    createdByUserId: record.createdByUserId,
    createdByName: record.createdByName ?? 'Unknown',
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  }
}

function paymentRow(record: DailyReportPaymentEntryRecord): PaymentRow {
  return {
    id: record.id,
    branch: record.branch,
    paymentMethodId: record.paymentMethodId,
    type:
      record.paymentMethodName ?? paymentLabelByMethod[record.paymentMethodId] ?? 'Other e-wallet',
    bankProvider: record.bankName ?? '',
    accountName: record.payerName ?? '',
    referenceNo: record.referenceNumber ?? '',
    date: record.transactionDate,
    amount: record.amountCentavos / 100,
    amountCentavos: record.amountCentavos,
    status: record.status,
    voidedAt: record.voidedAt,
    voidReason: record.voidReason,
    createdByUserId: record.createdByUserId,
    createdByName: record.createdByName ?? 'Unknown',
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  }
}

function acknowledgeRow(row: ReportRow): void {
  void row.id
}

function expenseRowActions(
  row: ExpenseRow,
  onView: (row: ExpenseRow, entityType: EntryEntityType) => void,
  onVoid: (row: ExpenseRow, entityType: EntryEntityType) => void,
  onEdit: (row: ExpenseRow) => void,
  onDuplicate: (row: ExpenseRow) => void,
  isAdmin: boolean
): readonly RowActionItem[] {
  return row.status === 'VOIDED'
    ? [{ id: 'view', label: 'View Details', onSelect: () => onView(row, 'EXPENSE') }]
    : [
        { id: 'view', label: 'View Details', onSelect: () => onView(row, 'EXPENSE') },
        { id: 'edit', label: 'Edit Expense', onSelect: () => onEdit(row) },
        { id: 'duplicate', label: 'Duplicate Expense', onSelect: () => onDuplicate(row) },
        ...(isAdmin
          ? [
              {
                id: 'void',
                label: 'Void Expense',
                onSelect: () => onVoid(row, 'EXPENSE'),
                destructive: true
              }
            ]
          : [])
      ]
}

function incomeRowActions(
  row: IncomeRow,
  onView: (row: IncomeRow, entityType: EntryEntityType) => void,
  onVoid: (row: IncomeRow, entityType: EntryEntityType) => void,
  onEdit: (row: IncomeRow) => void,
  onDuplicate: (row: IncomeRow) => void,
  isAdmin: boolean
): readonly RowActionItem[] {
  return row.status === 'VOIDED'
    ? [{ id: 'view', label: 'View Details', onSelect: () => onView(row, 'INCOME') }]
    : [
        { id: 'view', label: 'View Details', onSelect: () => onView(row, 'INCOME') },
        { id: 'edit', label: 'Edit Income', onSelect: () => onEdit(row) },
        { id: 'duplicate', label: 'Duplicate Income', onSelect: () => onDuplicate(row) },
        ...(isAdmin
          ? [
              {
                id: 'void',
                label: 'Void Income',
                onSelect: () => onVoid(row, 'INCOME'),
                destructive: true
              }
            ]
          : [])
      ]
}

function paymentRowActions(
  row: PaymentRow,
  onView: (row: PaymentRow, entityType: EntryEntityType) => void,
  onVoid: (row: PaymentRow, entityType: EntryEntityType) => void,
  onEdit: (row: PaymentRow) => void,
  onDuplicate: (row: PaymentRow) => void,
  isAdmin: boolean
): readonly RowActionItem[] {
  return [
    { id: 'view', label: 'View Details', onSelect: () => onView(row, 'PAYMENT') },
    { id: 'edit', label: 'Edit Payment', onSelect: () => onEdit(row) },
    { id: 'duplicate', label: 'Duplicate Payment', onSelect: () => onDuplicate(row) },
    ...(isAdmin
      ? [
          {
            id: 'void',
            label: 'Void Payment',
            onSelect: () => onVoid(row, 'PAYMENT'),
            destructive: true
          }
        ]
      : [])
  ].filter((action) => row.status !== 'VOIDED' || action.id === 'view')
}

function entryFieldLabel(field: string): string {
  return field.replace(/([A-Z])/g, ' $1').replace(/^./, (value) => value.toUpperCase())
}

function entryFieldValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (field === 'amountCentavos') return money(Number(value) / 100)
  if (field === 'status') return String(value)
  return String(value)
}

function EntryDetailsDialog({
  entry,
  entityType,
  onOpenChange
}: {
  entry?: ReportEntryRow
  entityType?: EntryEntityType
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  const [history, setHistory] = React.useState<EntryHistoryRecord[]>([])
  const [selectedHistoryId, setSelectedHistoryId] = React.useState<string>()
  const [error, setError] = React.useState<string>()

  React.useEffect(() => {
    if (!entry || !entityType) return
    setHistory([])
    setSelectedHistoryId(undefined)
    setError(undefined)
    void window.api.entryHistory
      .list({ entityType, entityId: entry.id })
      .then((result) => setHistory(result.rows))
      .catch(() => setError('Revision history could not be loaded.'))
  }, [entry, entityType])

  const selectedRevision = history.find((item) => item.id === selectedHistoryId)
  const values = entry ? Object.entries(entry as unknown as Record<string, unknown>) : []
  return (
    <Dialog open={Boolean(entry)} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(80vh,42rem)] w-[min(94vw,72rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>Entry details</DialogTitle>
          <DialogDescription>
            {entityType ? `${entityType.toLowerCase()} record · ${entry?.branch ?? 'Branch'}` : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(10rem,13rem)_minmax(0,1fr)]">
          <aside className="min-h-0 overflow-y-auto border-r p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Revision history</p>
            {error && <p className="text-xs text-destructive">{error}</p>}
            {!error && history.length === 0 && (
              <p className="text-xs text-muted-foreground">No history found.</p>
            )}
            <div className="flex flex-col gap-1">
              {history.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={cn(
                    'rounded-md px-2 py-2 text-left text-xs hover:bg-muted',
                    selectedHistoryId === item.id && 'bg-muted'
                  )}
                  onClick={() => setSelectedHistoryId(item.id)}
                >
                  <span className="block font-medium">{item.action}</span>
                  <span className="block text-muted-foreground">
                    {format(new Date(item.createdAt), 'MMM d, yyyy · h:mm:ss a')}
                  </span>
                  <span className="block text-muted-foreground">{item.actorName ?? 'System'}</span>
                </button>
              ))}
            </div>
          </aside>
          <div className="min-h-0 overflow-y-auto p-5">
            {selectedRevision ? (
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-sm font-medium">{selectedRevision.action} revision</p>
                  <p className="text-xs text-muted-foreground">
                    Changes recorded for this revision
                  </p>
                </div>
                {selectedRevision.changes.map((change) => {
                  const unchanged = change.oldValue === change.newValue
                  return (
                    <div
                      key={change.field}
                      className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-3 border-b pb-2 text-xs"
                    >
                      <span className="text-muted-foreground">{entryFieldLabel(change.field)}</span>
                      <span className={cn(unchanged && 'text-muted-foreground')}>
                        {unchanged
                          ? (change.newValue ?? '—')
                          : `${change.oldValue ?? '—'} → ${change.newValue ?? '—'}`}
                      </span>
                    </div>
                  )
                })}
                {selectedRevision.reason && (
                  <p className="text-xs text-destructive">Reason: {selectedRevision.reason}</p>
                )}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {values
                  .filter(
                    ([field]) =>
                      !['id', 'reportId', 'dailyReportId', 'createdByUserId'].includes(field)
                  )
                  .map(([field, value]) => (
                    <div key={field}>
                      <p className="text-xs text-muted-foreground">{entryFieldLabel(field)}</p>
                      <p className="text-sm tabular-nums">{entryFieldValue(field, value)}</p>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ReportTab({
  tab,
  isCompact,
  showBranch,
  globalFilter,
  onGlobalFilterChange,
  selectedBranch,
  dateFrom,
  dateTo,
  expenseRows,
  incomeRows,
  paymentRows,
  expenseQuery,
  onDeleteSelectedExpenses,
  onView,
  onVoid,
  onDuplicate,
  onAddEntry,
  addEntryLabel,
  selectedHistoryId,
  onSelectHistory,
  onDeleteSelected,
  onEdit,
  incomeLoadState,
  paymentLoadState,
  onRetryEntries,
  historyRecords,
  historyLoadState,
  onRetryHistory,
  isAdmin,
  showVoided,
  onShowVoidedChange
}: {
  tab: (typeof reportTabs)[number]
  isCompact: boolean
  showBranch: boolean
  globalFilter: string
  onGlobalFilterChange: (value: string) => void
  selectedBranch: LoginBranch
  dateFrom?: string
  dateTo?: string
  expenseRows: ExpenseRow[]
  incomeRows: IncomeRow[]
  paymentRows: PaymentRow[]
  expenseQuery: ReturnType<typeof useExpenses>
  onDeleteSelectedExpenses: (rows: ExpenseRow[]) => Promise<boolean>
  onView: (row: ReportEntryRow, entityType: EntryEntityType) => void
  onVoid: (row: ReportEntryRow, entityType: EntryEntityType) => void
  onDuplicate: (row: ReportEntryRow) => void
  onAddEntry: () => void
  addEntryLabel: string
  selectedHistoryId?: string
  onSelectHistory: (record: InstallmentHistoryRecord) => void
  onDeleteSelected: (rows: ReportRow[]) => boolean | Promise<boolean>
  onEdit: (row: ExpenseRow | IncomeRow | PaymentRow) => void
  incomeLoadState: EntryLoadState
  paymentLoadState: EntryLoadState
  onRetryEntries: () => void
  historyRecords: InstallmentHistoryRecord[]
  historyLoadState: EntryLoadState
  onRetryHistory: () => void
  isAdmin: boolean
  showVoided: boolean
  onShowVoidedChange: (value: boolean) => void
}): React.JSX.Element {
  const getExpenseActions = React.useCallback(
    (row: ExpenseRow) => expenseRowActions(row, onView, onVoid, onEdit, onDuplicate, isAdmin),
    [isAdmin, onDuplicate, onEdit, onView, onVoid]
  )
  const getIncomeActions = React.useCallback(
    (row: IncomeRow) => incomeRowActions(row, onView, onVoid, onEdit, onDuplicate, isAdmin),
    [isAdmin, onDuplicate, onEdit, onView, onVoid]
  )
  const getPaymentActions = React.useCallback(
    (row: PaymentRow) => paymentRowActions(row, onView, onVoid, onEdit, onDuplicate, isAdmin),
    [isAdmin, onDuplicate, onEdit, onView, onVoid]
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
          columns={
            isCompact
              ? compactExpenseColumns
              : showBranch
                ? [branchColumn, ...expenseColumns]
                : expenseColumns
          }
          data={expenseRows}
          filterPlaceholder="Filter expenses..."
          globalFilterValue={globalFilter}
          onGlobalFilterValueChange={onGlobalFilterChange}
          onAddEntry={onAddEntry}
          addEntryLabel={addEntryLabel}
          getRowActions={getExpenseActions}
          onDeleteSelected={isAdmin ? onDeleteSelectedExpenses : undefined}
          onDefaultAction={onExpenseDefaultAction}
          serverState={expenseQuery}
          filterOptions={{
            type: expenseTypeValues,
            category: expenseCategories,
            vat: vatOptions,
            ...(showBranch ? { branch: ['Goa', 'Tinambac', 'Tigaon', 'Lagonoy'] } : {})
          }}
          toolbarContent={
            isAdmin ? (
              <Button
                type="button"
                variant={showVoided ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => onShowVoidedChange(!showVoided)}
              >
                {showVoided ? 'Hide voided' : 'Show voided'}
              </Button>
            ) : undefined
          }
        />
      )
    case 'Income':
      return (
        <ReportDataTable
          columns={
            isCompact
              ? compactIncomeColumns
              : showBranch
                ? [branchColumn, ...incomeColumns]
                : incomeColumns
          }
          data={incomeRows}
          filterPlaceholder="Filter income..."
          globalFilterValue={globalFilter}
          onGlobalFilterValueChange={onGlobalFilterChange}
          onAddEntry={onAddEntry}
          addEntryLabel={addEntryLabel}
          getRowActions={getIncomeActions}
          onDeleteSelected={isAdmin ? onDeleteSelected : undefined}
          onDefaultAction={acknowledgeRow}
          isLoading={incomeLoadState.isLoading}
          loadError={incomeLoadState.error}
          onRetry={onRetryEntries}
          filterOptions={
            showBranch ? { branch: ['Goa', 'Tinambac', 'Tigaon', 'Lagonoy'] } : undefined
          }
          toolbarContent={
            isAdmin ? (
              <Button
                type="button"
                variant={showVoided ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => onShowVoidedChange(!showVoided)}
              >
                {showVoided ? 'Hide voided' : 'Show voided'}
              </Button>
            ) : undefined
          }
        />
      )
    case 'Payment':
      return (
        <ReportDataTable
          columns={
            isCompact
              ? compactPaymentColumns
              : showBranch
                ? [branchColumn, ...paymentColumns]
                : paymentColumns
          }
          data={paymentRows}
          filterPlaceholder="Filter payments..."
          globalFilterValue={globalFilter}
          onGlobalFilterValueChange={onGlobalFilterChange}
          onAddEntry={onAddEntry}
          addEntryLabel={addEntryLabel}
          getRowActions={getPaymentActions}
          onDeleteSelected={isAdmin ? onDeleteSelected : undefined}
          onDefaultAction={acknowledgeRow}
          isLoading={paymentLoadState.isLoading}
          loadError={paymentLoadState.error}
          onRetry={onRetryEntries}
          filterOptions={
            showBranch ? { branch: ['Goa', 'Tinambac', 'Tigaon', 'Lagonoy'] } : undefined
          }
          toolbarContent={
            isAdmin ? (
              <Button
                type="button"
                variant={showVoided ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => onShowVoidedChange(!showVoided)}
              >
                {showVoided ? 'Hide voided' : 'Show voided'}
              </Button>
            ) : undefined
          }
        />
      )
    case 'Activity':
      return (
        <div className="flex min-h-0 flex-1 flex-col">
          {historyLoadState.error && (
            <div className="flex items-center justify-between gap-2 border-b border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <span>{historyLoadState.error}</span>
              <Button type="button" variant="outline" size="xs" onClick={onRetryHistory}>
                Retry
              </Button>
            </div>
          )}
          <InstallmentHistoryTable
            records={historyRecords}
            isLoading={historyLoadState.isLoading}
            selectedBranch={selectedBranch}
            dateFrom={dateFrom}
            dateTo={dateTo}
            globalSearch={globalFilter}
            onGlobalSearchChange={onGlobalFilterChange}
            selectedId={selectedHistoryId}
            onSelect={noopHistorySelect}
            onDoubleClick={onSelectHistory}
          />
        </div>
      )
  }
}

const formFields: Record<(typeof reportTabs)[number], string[]> = {
  Expenses: ['Type', 'Description', 'Category', 'Receipt No.', 'VAT', 'Amount'],
  Income: ['Date', 'Particular', 'Receipt / Reference No.', 'Remarks', 'Amount'],
  Payment: ['Type', 'Bank / Provider', 'Account Name', 'Reference No.', 'Date', 'Amount'],
  Activity: []
}

function ReportDatePicker({
  id,
  label,
  initialValue
}: {
  id: string
  label: string
  initialValue?: string
}): React.JSX.Element {
  const [open, setOpen] = React.useState(false)
  const [date, setDate] = React.useState<Date>()
  const [value, setValue] = React.useState(initialValue ?? '')

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

function ReportDetailsForm({
  tab,
  expenseTypes,
  paymentTypes,
  initialValues = {}
}: {
  tab: (typeof reportTabs)[number]
  expenseTypes: readonly string[]
  paymentTypes: readonly string[]
  initialValues?: Record<string, string>
}): React.JSX.Element {
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
              <Select name={id} defaultValue={initialValues[id]}>
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
              <ReportDatePicker id={id} label={field} initialValue={initialValues[id]} />
            ) : /(amount|balance|principal)/i.test(field) ? (
              <InputGroup>
                <InputGroupAddon align="inline-start">
                  {pesoSign() && <InputGroupText>{pesoSign()}</InputGroupText>}
                </InputGroupAddon>
                <InputGroupInput
                  id={id}
                  name={id}
                  type="text"
                  inputMode="decimal"
                  defaultValue={initialValues[id]}
                  placeholder={`Enter ${field.toLowerCase()}`}
                  onChange={(event) => {
                    event.currentTarget.value = formatAmountInput(event.currentTarget.value)
                  }}
                />
              </InputGroup>
            ) : (
              <Input
                id={id}
                name={id}
                defaultValue={initialValues[id]}
                placeholder={`Enter ${field.toLowerCase()}`}
              />
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
  onSave,
  onDirtyChange,
  saveError,
  expenseTypes,
  paymentTypes,
  initialValues
}: {
  tab: (typeof reportTabs)[number]
  onSave: (form: FormData) => void
  onDirtyChange: (isDirty: boolean) => void
  saveError?: string
  expenseTypes: readonly string[]
  paymentTypes: readonly string[]
  initialValues?: Record<string, string>
}): React.JSX.Element {
  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onChange={() => onDirtyChange(true)}
      onReset={() => onDirtyChange(false)}
      onSubmit={(event) => {
        event.preventDefault()
        onSave(new FormData(event.currentTarget))
      }}
    >
      {saveError && (
        <div
          role="alert"
          className="border-b border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
        >
          {saveError}
        </div>
      )}
      <ScrollArea className="min-h-0 flex-1">
        <ReportDetailsForm
          tab={tab}
          expenseTypes={expenseTypes}
          paymentTypes={paymentTypes}
          initialValues={initialValues}
        />
      </ScrollArea>
      <EntryFormActions />
    </form>
  )
}

export function CashierReportsContent({
  summaryAlwaysDark = false,
  selectedBranch = 'All Branch',
  cashierName = 'Cashier',
  isAdmin = false
}: {
  summaryAlwaysDark?: boolean
  selectedBranch?: LoginBranch
  cashierName?: string
  isAdmin?: boolean
}): React.JSX.Element {
  const [activeTab, setActiveTab] = React.useState<(typeof reportTabs)[number]>(reportTabs[0])
  const activeReport = useActiveReport()
  const [selectedReport, setSelectedReport] = React.useState(activeReport)
  const [isDateLoading, setIsDateLoading] = React.useState(false)
  const [dateError, setDateError] = React.useState<string>()
  const [exportError, setExportError] = React.useState<string>()
  const [isReviewingPdf, setIsReviewingPdf] = React.useState(false)
  const [pdfPreview, setPdfPreview] = React.useState<{ fileName: string; pdfBase64: string }>()
  const [isPdfReviewOpen, setIsPdfReviewOpen] = React.useState(false)
  const [pdfProgress, setPdfProgress] = React.useState<PdfProgressStep[]>(initialPdfProgress)
  const [isPdfProcessing, setIsPdfProcessing] = React.useState(false)
  const [telegramNote, setTelegramNote] = React.useState('')
  const [reportSearch, setReportSearch] = React.useState('')
  const [dateRange, setDateRange] = React.useState<DateSelectorValue>(() => {
    const today = new Date()
    return { period: 'day', operator: 'is', startDate: today, endDate: today }
  })
  const dateRequestVersionRef = React.useRef(0)
  const reportId = selectedReport.reportId
  const selectedStartDate = dateRange.startDate
    ? format(dateRange.startDate, 'yyyy-MM-dd')
    : undefined
  const selectedEndDate = dateRange.endDate
    ? format(dateRange.endDate, 'yyyy-MM-dd')
    : selectedStartDate
  const dateFrom = dateRange.operator === 'before' ? undefined : selectedStartDate
  const dateTo = dateRange.operator === 'after' ? undefined : selectedEndDate
  const [showVoided, setShowVoided] = React.useState(false)
  const expenseQuery = useExpenses(
    reportId,
    selectedBranch,
    dateFrom,
    dateTo,
    isAdmin && showVoided
  )
  const { createExpense, removeExpenses, updateExpense } = expenseQuery
  const [incomes, setIncomes] = React.useState<IncomeRow[]>([])
  const [payments, setPayments] = React.useState<PaymentRow[]>([])
  const [catalogOptions, setCatalogOptions] = React.useState<CatalogOptionRecord[]>([])
  const [historyRecords, setHistoryRecords] = React.useState<InstallmentHistoryRecord[]>([])
  const [historyLoadState, setHistoryLoadState] = React.useState<EntryLoadState>({
    isLoading: true
  })
  const [historyRefreshKey, setHistoryRefreshKey] = React.useState(0)
  const historyRequestVersionRef = React.useRef(0)
  const [incomeLoadState, setIncomeLoadState] = React.useState<EntryLoadState>({ isLoading: true })
  const [paymentLoadState, setPaymentLoadState] = React.useState<EntryLoadState>({
    isLoading: true
  })
  const [isEntryFormVisible, setIsEntryFormVisible] = React.useState(false)
  const [isEntryFormDirty, setIsEntryFormDirty] = React.useState(false)
  const [entrySaveError, setEntrySaveError] = React.useState<string>()
  const [confirmation, setConfirmation] = React.useState<{
    title: string
    description: string
    confirmLabel: string
    destructive?: boolean
    onConfirm: () => void
  }>()
  const [isSummaryVisible, setIsSummaryVisible] = React.useState(false)
  const [selectedHistory, setSelectedHistory] = React.useState<InstallmentHistoryRecord>()
  const [selectedEntry, setSelectedEntry] = React.useState<ReportEntryRow>()
  const [selectedEntryType, setSelectedEntryType] = React.useState<EntryEntityType>()
  const entryDialogClosingRef = React.useRef(false)
  const [voidEntry, setVoidEntry] = React.useState<ReportEntryRow>()
  const [voidEntryType, setVoidEntryType] = React.useState<EntryEntityType>()
  const [bulkVoidRows, setBulkVoidRows] = React.useState<ReportEntryRow[]>([])
  const [bulkVoidType, setBulkVoidType] = React.useState<EntryEntityType>()
  const [formMode, setFormMode] = React.useState<'create' | 'edit' | 'duplicate'>('create')
  const [formEntry, setFormEntry] = React.useState<ReportEntryRow>()
  const [formSeed, setFormSeed] = React.useState(0)
  const entriesRequestVersionRef = React.useRef(0)
  const isEntryFormCompact = useMediaQuery('(max-width: 900px)')
  const isSummaryCompact = useMediaQuery('(max-width: 760px)')
  const isHistoryTab = activeTab === 'Activity'
  const activeCatalogValues = React.useCallback(
    (kind: CatalogOptionRecord['kind'], fallback: readonly string[]) => {
      const values = catalogOptions
        .filter((option) => option.kind === kind && option.isActive)
        .map((option) => option.value)
      return values.length ? values : fallback
    },
    [catalogOptions]
  )
  const activeExpenseTypes = activeCatalogValues('CASHIER_EXPENSE_TYPE', expenseTypes)
  const activePaymentTypes = activeCatalogValues('CASHIER_PAYMENT_TYPE', paymentTypes)
  React.useEffect(() => {
    void window.api.catalogOptions
      .list({ activeOnly: true })
      .then(({ rows }) => setCatalogOptions(rows))
      .catch(() => undefined)
  }, [])
  const showRightPanel = !isEntryFormCompact && isEntryFormVisible
  React.useEffect(() => {
    const requestVersion = ++historyRequestVersionRef.current
    setHistoryLoadState({ isLoading: true })
    void window.api.installments
      .listHistory({ dateFrom, dateTo })
      .then((records) => {
        if (requestVersion !== historyRequestVersionRef.current) return
        setHistoryRecords(records.map(installmentHistoryRow))
        setHistoryLoadState({ isLoading: false })
      })
      .catch(() => {
        if (requestVersion !== historyRequestVersionRef.current) return
        setHistoryRecords([])
        setHistoryLoadState({
          isLoading: false,
          error: 'Installment history could not be loaded.'
        })
      })
  }, [dateFrom, dateTo, historyRefreshKey])
  const changeBusinessDate = React.useCallback(
    async (date: Date): Promise<void> => {
      const businessDate = format(date, 'yyyy-MM-dd')
      if (businessDate === selectedReport.businessDate) return
      const requestVersion = ++dateRequestVersionRef.current
      setIsDateLoading(true)
      setDateError(undefined)
      try {
        const report = await window.api.dailyReports.resolveActive({
          branchId: activeReport.branchId,
          cashierUserId: activeReport.cashierUserId,
          businessDate
        })
        if (requestVersion !== dateRequestVersionRef.current) return
        setSelectedReport({ ...report, reportId: report.id })
      } catch {
        if (requestVersion !== dateRequestVersionRef.current) return
        setDateError('That report date could not be loaded.')
      } finally {
        if (requestVersion === dateRequestVersionRef.current) setIsDateLoading(false)
      }
    },
    [activeReport.branchId, activeReport.cashierUserId, selectedReport.businessDate]
  )
  const changeDateRange = React.useCallback(
    (value: DateSelectorValue): void => {
      if (!value.startDate) return
      const next = {
        ...value,
        period: 'day' as const,
        operator: 'is' as const,
        endDate: value.startDate
      }
      setDateRange(next)
      void changeBusinessDate(value.startDate)
    },
    [changeBusinessDate]
  )
  const setEntryFormOpen = React.useCallback(
    (open: boolean): void => {
      if (open) {
        setFormMode('create')
        setFormEntry(undefined)
        setFormSeed((value) => value + 1)
        setIsEntryFormDirty(false)
        setEntrySaveError(undefined)
        setIsEntryFormVisible(true)
        return
      }
      if (isEntryFormDirty) {
        setConfirmation({
          title: 'Discard unsaved entry changes?',
          description: 'Your entered report details will be lost.',
          confirmLabel: 'Discard changes',
          destructive: true,
          onConfirm: () => {
            setConfirmation(undefined)
            setIsEntryFormDirty(false)
            setEntrySaveError(undefined)
            setIsEntryFormVisible(false)
          }
        })
        return
      }
      setIsEntryFormDirty(false)
      setEntrySaveError(undefined)
      setIsEntryFormVisible(false)
    },
    [isEntryFormDirty]
  )
  const toggleEntryForm = React.useCallback(
    () => setEntryFormOpen(!isEntryFormVisible),
    [isEntryFormVisible, setEntryFormOpen]
  )
  const summaryRefreshKey = [
    expenseQuery.expenseTotals.companyExpensesCentavos,
    expenseQuery.expenseTotals.drawingsCentavos,
    expenseQuery.expenseTotals.purchasesCentavos,
    expenseQuery.expenseTotals.receivablesCentavos,
    ...incomes.map((income) => `${income.id}:${income.amount}`),
    ...payments.map((payment) => `${payment.id}:${payment.paymentMethodId}:${payment.amount}`)
  ].join(':')
  const reviewPdf = React.useCallback(async (): Promise<void> => {
    setIsReviewingPdf(true)
    setExportError(undefined)
    try {
      const allExpenses: ExpenseRecord[] = []
      for (let pageIndex = 0; ; pageIndex += 1) {
        const result = await window.api.reports.expenses.list({
          reportId,
          includeVoided: false,
          pageIndex,
          pageSize: 100,
          search: '',
          sorting: [],
          filters: {}
        })
        allExpenses.push(...result.rows)
        if (allExpenses.length >= result.totalRows) break
      }
      const [
        snapshot,
        incomeResult,
        paymentResult,
        installmentHistory,
        records,
        active,
        closed,
        blacklisted
      ] = await Promise.all([
        window.api.dailyReports.getSnapshot({ dailyReportId: reportId }),
        window.api.dailyReports.listIncome({ dailyReportId: reportId, status: 'POSTED' }),
        window.api.dailyReports.listPayments({ dailyReportId: reportId, status: 'POSTED' }),
        window.api.installments.listHistory({
          dateFrom: selectedReport.businessDate,
          dateTo: selectedReport.businessDate
        }),
        window.api.installments.list({
          view: 'records',
          search: '',
          branch: selectedBranch === 'All Branch' ? undefined : selectedBranch
        }),
        window.api.installments.list({
          view: 'active',
          search: '',
          branch: selectedBranch === 'All Branch' ? undefined : selectedBranch
        }),
        window.api.installments.list({
          view: 'closed',
          search: '',
          branch: selectedBranch === 'All Branch' ? undefined : selectedBranch
        }),
        window.api.installments.list({
          view: 'blacklisted',
          search: '',
          branch: selectedBranch === 'All Branch' ? undefined : selectedBranch
        })
      ])
      const branch = selectedBranch === 'All Branch' ? 'All Branch' : selectedBranch
      const contributors = [
        ...allExpenses.map((item) => item.createdByName),
        ...incomeResult.rows.map((item) => item.createdByName),
        ...paymentResult.rows.map((item) => item.createdByName)
      ].filter((name): name is string => Boolean(name?.trim()))
      const contributorLabel = [...new Set(contributors)].join(', ') || cashierName
      const now = new Date()
      const html = cashierReportPdfHtml({
        cashierName: contributorLabel,
        branch,
        businessDate: selectedReport.businessDate,
        generatedAt: format(now, 'MMM d, yyyy · h:mm a'),
        snapshot,
        expenses: allExpenses,
        incomes: incomeResult.rows,
        payments: paymentResult.rows,
        installmentHistory: installmentHistory.filter(
          (item) => selectedBranch === 'All Branch' || item.branch === selectedBranch
        ),
        accountCounts: {
          records: records.rows.length,
          active: active.rows.length,
          closed: closed.rows.length,
          blacklisted: blacklisted.rows.length
        }
      })
      const time = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
      const fileName = `${filenameSegment(branch)}-${selectedReport.businessDate}-${time}.pdf`
      const { pdfBase64 } = await window.api.pdfExport.preview({ html, fileName })
      setPdfProgress(initialPdfProgress)
      setTelegramNote('')
      setPdfPreview({ fileName, pdfBase64 })
      setIsPdfReviewOpen(true)
    } catch {
      setExportError('The PDF could not be exported. Please try again.')
    } finally {
      setIsReviewingPdf(false)
    }
  }, [cashierName, reportId, selectedBranch, selectedReport.businessDate])
  const updatePdfStep = React.useCallback(
    (id: PdfProgressStepId, patch: Partial<PdfProgressStep>): void => {
      setPdfProgress((steps) =>
        steps.map((step) => (step.id === id ? { ...step, ...patch } : step))
      )
    },
    []
  )
  const runPdfStep = React.useCallback(
    async (id: PdfProgressStepId, operation: () => Promise<void>): Promise<void> => {
      let lastError = 'This operation failed.'
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        updatePdfStep(id, { status: 'processing', attempts: attempt, error: undefined })
        try {
          await operation()
          updatePdfStep(id, { status: 'done', error: undefined })
          return
        } catch {
          lastError =
            id === 'telegram'
              ? 'Telegram could not send the report.'
              : 'Saving the report was canceled or failed.'
        }
      }
      updatePdfStep(id, { status: 'failed', error: lastError })
    },
    [updatePdfStep]
  )
  const pdfOperation = React.useCallback(
    (
      id: PdfProgressStepId,
      preview: { fileName: string; pdfBase64: string }
    ): (() => Promise<void>) => {
      if (id === 'save') {
        return async () => {
          const result = await window.api.pdfExport.save(preview)
          if (result.canceled) throw new Error('Save canceled')
        }
      }
      return () =>
        window.api.pdfExport.sendTelegram({
          ...preview,
          caption: [
            `Date: ${selectedReport.businessDate}`,
            `Time: ${format(new Date(), 'hh:mm a')}`,
            `Branch: ${selectedBranch}`,
            `Name: ${cashierName}`,
            '',
            `Note: ${telegramNote.trim()}`
          ].join('\n')
        })
    },
    [cashierName, selectedBranch, selectedReport.businessDate, telegramNote]
  )
  const startPdfExport = React.useCallback(async (): Promise<void> => {
    if (!pdfPreview) return
    setPdfProgress(initialPdfProgress)
    setIsPdfProcessing(true)
    for (const step of initialPdfProgress) {
      await runPdfStep(step.id, pdfOperation(step.id, pdfPreview))
    }
    setIsPdfProcessing(false)
  }, [pdfOperation, pdfPreview, runPdfStep])
  const beginPdfExport = React.useCallback((): void => {
    if (!pdfPreview) return
    setPdfProgress(initialPdfProgress)
    void startPdfExport()
  }, [pdfPreview, startPdfExport])
  const retryPdfStep = React.useCallback(
    async (id: PdfProgressStepId): Promise<void> => {
      if (!pdfPreview || isPdfProcessing) return
      setIsPdfProcessing(true)
      await runPdfStep(id, pdfOperation(id, pdfPreview))
      setIsPdfProcessing(false)
    },
    [isPdfProcessing, pdfOperation, pdfPreview, runPdfStep]
  )
  const refreshEntries = React.useCallback(async (): Promise<void> => {
    const requestVersion = ++entriesRequestVersionRef.current
    setIncomeLoadState((current) => ({ ...current, isLoading: true, error: undefined }))
    setPaymentLoadState((current) => ({ ...current, isLoading: true, error: undefined }))
    const [incomeResult, paymentResult] = await Promise.allSettled([
      window.api.dailyReports.listIncome({
        branch: selectedBranch,
        dateFrom,
        dateTo,
        status: showVoided ? undefined : 'POSTED'
      }),
      window.api.dailyReports.listPayments({
        branch: selectedBranch,
        dateFrom,
        dateTo,
        status: showVoided ? undefined : 'POSTED'
      })
    ])
    if (requestVersion !== entriesRequestVersionRef.current) return
    if (incomeResult.status === 'fulfilled') {
      setIncomes(incomeResult.value.rows.map(incomeRow))
      setIncomeLoadState({ isLoading: false })
    } else {
      setIncomeLoadState({ isLoading: false, error: 'Income entries could not be loaded.' })
    }
    if (paymentResult.status === 'fulfilled') {
      setPayments(paymentResult.value.rows.map(paymentRow))
      setPaymentLoadState({ isLoading: false })
    } else {
      setPaymentLoadState({ isLoading: false, error: 'Payment entries could not be loaded.' })
    }
  }, [dateFrom, dateTo, selectedBranch, showVoided])

  React.useEffect(() => {
    void refreshEntries()
  }, [refreshEntries])

  const openEntryView = React.useCallback(
    (row: ReportEntryRow, entityType: EntryEntityType): void => {
      entryDialogClosingRef.current = false
      setSelectedEntry(row)
      setSelectedEntryType(entityType)
    },
    []
  )
  const closeEntryDetails = React.useCallback((open: boolean): void => {
    if (open || entryDialogClosingRef.current) return
    entryDialogClosingRef.current = true
    setSelectedEntry(undefined)
    setSelectedEntryType(undefined)
  }, [])

  const startEntryForm = React.useCallback(
    (row: ReportEntryRow | undefined, mode: 'edit' | 'duplicate'): void => {
      setFormEntry(row)
      setFormMode(mode)
      setFormSeed((value) => value + 1)
      setIsEntryFormDirty(false)
      setEntrySaveError(undefined)
      setIsEntryFormVisible(true)
    },
    []
  )

  const requestVoid = React.useCallback(
    (row: ReportEntryRow, entityType: EntryEntityType): void => {
      setVoidEntry(row)
      setVoidEntryType(entityType)
    },
    []
  )

  const deleteSelectedExpenses = React.useCallback(async (rows: ExpenseRow[]): Promise<boolean> => {
    setBulkVoidRows(rows)
    setBulkVoidType('EXPENSE')
    return false
  }, [])

  const deleteSelectedEntries = React.useCallback(async (rows: ReportRow[]): Promise<boolean> => {
    const selected = rows as ReportEntryRow[]
    setBulkVoidRows(selected)
    setBulkVoidType(selected.every((row) => 'particular' in row) ? 'INCOME' : 'PAYMENT')
    return false
  }, [])

  const confirmVoid = React.useCallback(
    async (reason: string): Promise<void> => {
      const rows = voidEntry ? [voidEntry] : bulkVoidRows
      const entityType = voidEntryType ?? bulkVoidType
      if (!rows.length || !entityType) return
      try {
        if (entityType === 'EXPENSE') {
          await removeExpenses(
            rows.map((row) => row.id),
            reason
          )
        } else {
          await Promise.all(
            rows.map((row) =>
              entityType === 'INCOME'
                ? window.api.dailyReports.voidIncome({ id: row.id, voidReason: reason })
                : window.api.dailyReports.voidPayment({ id: row.id, voidReason: reason })
            )
          )
        }
        await refreshEntries()
        setVoidEntry(undefined)
        setVoidEntryType(undefined)
        setBulkVoidRows([])
        setBulkVoidType(undefined)
      } catch {
        return
      }
    },
    [bulkVoidRows, bulkVoidType, refreshEntries, removeExpenses, voidEntry, voidEntryType]
  )

  const saveEntry = React.useCallback(
    async (tab: (typeof reportTabs)[number], form: FormData): Promise<void> => {
      setEntrySaveError(undefined)
      if (formMode === 'edit' && formEntry) {
        try {
          const amountCentavos = parseAmountToCentavos(
            String(form.get(`${tab.toLowerCase()}-amount`) ?? '0')
          )
          if ('reportId' in formEntry) {
            await updateExpense({
              id: formEntry.id,
              type: String(form.get('expenses-type') || formEntry.type) as ExpenseType,
              description: String(form.get('expenses-description') || formEntry.description),
              category: String(
                form.get('expenses-category') || formEntry.category
              ) as ExpenseCategory,
              receiptNo: String(form.get('expenses-receipt-no-') || ''),
              vat: String(form.get('expenses-vat') || '') as ExpenseVat,
              amountCentavos
            })
          } else if ('particular' in formEntry) {
            await window.api.dailyReports.updateIncome({
              id: formEntry.id,
              categoryId: formEntry.categoryId,
              transactionDate: String(form.get('income-date') || formEntry.date),
              particular: String(form.get('income-particular') || formEntry.particular),
              receiptNumber: String(form.get('income-receipt-reference-no-') || '') || null,
              remarks: String(form.get('income-remarks') || '') || null,
              amountCentavos
            })
          } else {
            const type = String(form.get('payment-type') || formEntry.type)
            const paymentMethodId = catalogOptions.find(
              (option) => option.kind === 'CASHIER_PAYMENT_TYPE' && option.value === type
            )?.referenceId
            if (!paymentMethodId) throw new Error('Payment type is unavailable.')
            await window.api.dailyReports.updatePayment({
              id: formEntry.id,
              paymentMethodId,
              transactionDate: String(form.get('payment-date') || formEntry.date),
              referenceNumber: String(form.get('payment-reference-no-') || '') || null,
              bankName: String(form.get('payment-bank-provider') || '') || null,
              payerName: String(form.get('payment-account-name') || '') || null,
              remarks: null,
              amountCentavos
            })
          }
          await refreshEntries()
          setFormMode('create')
          setFormEntry(undefined)
          setIsEntryFormDirty(false)
          setIsEntryFormVisible(false)
        } catch {
          setEntrySaveError('This entry could not be updated. Review the values and try again.')
        }
        return
      }
      if (tab === 'Expenses') {
        try {
          await createExpense({
            reportId,
            type: String(form.get('expenses-type') || 'Operating') as ExpenseType,
            description: String(form.get('expenses-description') || 'New expense'),
            category: String(form.get('expenses-category') || 'Others') as ExpenseCategory,
            receiptNo: String(form.get('expenses-receipt-no-') || ''),
            vat: String(form.get('expenses-vat') || '') as ExpenseVat,
            amountCentavos: parseAmountToCentavos(String(form.get('expenses-amount') || '0')),
            ...(formMode === 'duplicate' && formEntry ? { duplicatedFromId: formEntry.id } : {})
          })
          setIsEntryFormDirty(false)
          setIsEntryFormVisible(false)
        } catch {
          setEntrySaveError('This entry could not be saved. Review the values and try again.')
          return
        }
        return
      }

      let amountCentavos: number
      try {
        amountCentavos = parseAmountToCentavos(
          String(form.get(`${tab.toLowerCase()}-amount`) ?? '0')
        )
      } catch {
        setEntrySaveError('Enter a valid amount before saving.')
        return
      }
      try {
        if (tab === 'Income') {
          await window.api.dailyReports.createIncome({
            dailyReportId: reportId,
            categoryId: 'income-category-other-income',
            transactionDate: String(form.get('income-date') || format(new Date(), 'yyyy-MM-dd')),
            particular: String(form.get('income-particular') || 'Other income'),
            receiptNumber: String(form.get('income-receipt-reference-no-') || '') || null,
            remarks: String(form.get('income-remarks') || '') || null,
            amountCentavos,
            ...(formMode === 'duplicate' && formEntry ? { duplicatedFromId: formEntry.id } : {})
          })
        } else if (tab === 'Payment') {
          const type = String(form.get('payment-type') || activePaymentTypes[0] || 'Bank Check')
          const paymentMethodId = catalogOptions.find(
            (option) =>
              option.kind === 'CASHIER_PAYMENT_TYPE' && option.value === type && option.isActive
          )?.referenceId
          if (!paymentMethodId) throw new Error('Payment type is unavailable.')
          await window.api.dailyReports.createPayment({
            dailyReportId: reportId,
            paymentMethodId,
            transactionDate: String(form.get('payment-date') || format(new Date(), 'yyyy-MM-dd')),
            referenceNumber: String(form.get('payment-reference-no-') || '') || null,
            bankName: String(form.get('payment-bank-provider') || '') || null,
            payerName: String(form.get('payment-account-name') || '') || null,
            remarks: null,
            amountCentavos,
            ...(formMode === 'duplicate' && formEntry ? { duplicatedFromId: formEntry.id } : {})
          })
        }
        await refreshEntries()
        setIsEntryFormDirty(false)
        setIsEntryFormVisible(false)
      } catch {
        setEntrySaveError('This entry could not be saved. Review the values and try again.')
      }
    },
    [
      activePaymentTypes,
      catalogOptions,
      createExpense,
      formEntry,
      formMode,
      refreshEntries,
      reportId,
      updateExpense
    ]
  )

  const tabRowCounts: Record<(typeof reportTabs)[number], number> = {
    Expenses: expenseQuery.totalRows,
    Income: incomes.length,
    Payment: payments.length,
    Activity: historyRecords.length
  }

  const initialFormValues = React.useMemo<Record<string, string>>((): Record<string, string> => {
    if (!formEntry) return {}
    const duplicate = formMode === 'duplicate'
    if ('reportId' in formEntry) {
      return {
        'expenses-type': formEntry.type,
        'expenses-description': formEntry.description,
        'expenses-category': formEntry.category,
        'expenses-receipt-no-': duplicate ? '' : formEntry.receiptNo,
        'expenses-vat': formEntry.vat,
        'expenses-amount': String(formEntry.amount)
      } as Record<string, string>
    }
    if ('particular' in formEntry) {
      return {
        'income-date': duplicate ? format(new Date(), 'yyyy-MM-dd') : formEntry.date,
        'income-particular': formEntry.particular,
        'income-receipt-reference-no-': duplicate ? '' : formEntry.receiptRefNo,
        'income-remarks': formEntry.remarks,
        'income-amount': String(formEntry.amount)
      } as Record<string, string>
    }
    return {
      'payment-type': formEntry.type,
      'payment-bank-provider': formEntry.bankProvider,
      'payment-account-name': formEntry.accountName,
      'payment-reference-no-': duplicate ? '' : formEntry.referenceNo,
      'payment-date': duplicate ? format(new Date(), 'yyyy-MM-dd') : formEntry.date,
      'payment-amount': String(formEntry.amount)
    } as Record<string, string>
  }, [formEntry, formMode])

  React.useEffect(() => {
    if (!isEntryFormVisible) return
    const firstField = formFields[activeTab][0]
    const id = `${activeTab}-${firstField}`.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    document.getElementById(id)?.focus()
  }, [activeTab, isEntryFormVisible])

  return (
    <div
      className={
        isSummaryCompact
          ? 'flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden p-3'
          : 'grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(200px,220px)_minmax(0,1fr)] gap-3 overflow-hidden p-3'
      }
    >
      {!isSummaryCompact && (
        <Card
          className={cn(
            'flex min-h-0 min-w-0 flex-col py-0 ring-0',
            summaryAlwaysDark &&
              'dark sidebar-always-dark bg-sidebar text-sidebar-foreground ring-sidebar-border'
          )}
        >
          <ReportSummary
            key={reportId}
            alwaysDark={summaryAlwaysDark}
            refreshKey={summaryRefreshKey}
            reportId={reportId}
            businessDate={selectedReport.businessDate}
            branchId={selectedReport.branchId}
            cashierUserId={selectedReport.cashierUserId}
            dateRange={dateRange}
            isDateLoading={isDateLoading}
            onDateRangeChange={changeDateRange}
            expenseTotals={expenseQuery.expenseTotals}
          />
        </Card>
      )}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div
          className={
            showRightPanel
              ? 'grid min-h-0 w-full min-w-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(260px,302px)] gap-3'
              : 'grid min-h-0 w-full min-w-0 flex-1 grid-cols-1'
          }
        >
          <Card className="flex min-h-0 min-w-0 flex-col py-0 shadow-sm">
            <CardContent className="flex min-h-0 flex-1 flex-col p-0">
              <Tabs
                value={activeTab}
                onValueChange={(value) => {
                  const nextTab = value as (typeof reportTabs)[number]
                  if (nextTab !== activeTab && isEntryFormVisible && isEntryFormDirty) {
                    setConfirmation({
                      title: 'Discard unsaved entry changes?',
                      description: 'Your entered report details will be lost.',
                      confirmLabel: 'Discard changes',
                      destructive: true,
                      onConfirm: () => {
                        setConfirmation(undefined)
                        setIsEntryFormDirty(false)
                        setActiveTab(nextTab)
                        if (nextTab === 'Activity') setIsEntryFormVisible(false)
                      }
                    })
                    return
                  }
                  setIsEntryFormDirty(false)
                  setActiveTab(nextTab)
                  if (nextTab === 'Activity') setIsEntryFormVisible(false)
                }}
                className="flex min-h-0 flex-1 flex-col gap-0"
              >
                <div className="flex shrink-0 items-center">
                  <div className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <TabsList
                      aria-label="Cashier report sections"
                      variant="line"
                      className="h-10 w-max  justify-start rounded-none bg-transparent pb-2"
                    >
                      {reportTabs.map((tab) => (
                        <TabsTrigger
                          key={tab}
                          value={tab}
                          className="h-10 flex-none gap-1.5 rounded-none px-3.5 text-xs font-normal data-active:text-primary data-active:font-semibold"
                        >
                          <span>{tab === 'Activity' ? 'Installment' : tab}</span>
                          <Badge
                            variant="secondary"
                            className="min-w-5 justify-center px-1 tabular-nums"
                          >
                            {tabRowCounts[tab]}
                          </Badge>
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </div>
                  <CashierReportHeader
                    branchId={selectedReport.branchId}
                    cashierUserId={selectedReport.cashierUserId}
                    dateRange={dateRange}
                    isLoading={isDateLoading}
                    isExporting={isReviewingPdf}
                    error={dateError ?? exportError}
                    showDateSelector={false}
                    onDateRangeChange={changeDateRange}
                    onExport={() => void reviewPdf()}
                  />
                </div>
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  {reportTabs.map((tab) => (
                    <TabsContent
                      key={tab}
                      value={tab}
                      className="flex min-h-0 flex-1 flex-col overflow-hidden"
                    >
                      <ReportTab
                        isCompact={isEntryFormCompact}
                        tab={tab}
                        showBranch={selectedBranch === 'All Branch'}
                        globalFilter={reportSearch}
                        onGlobalFilterChange={(value) => {
                          setReportSearch(value)
                          expenseQuery.onGlobalFilterChange(value)
                        }}
                        selectedBranch={selectedBranch}
                        dateFrom={dateFrom}
                        dateTo={dateTo}
                        expenseRows={expenseQuery.rows}
                        incomeRows={incomes}
                        paymentRows={payments}
                        expenseQuery={expenseQuery}
                        onDeleteSelectedExpenses={deleteSelectedExpenses}
                        onView={openEntryView}
                        onVoid={requestVoid}
                        onDuplicate={(row) => startEntryForm(row, 'duplicate')}
                        isAdmin={isAdmin}
                        showVoided={showVoided}
                        onShowVoidedChange={setShowVoided}
                        onAddEntry={toggleEntryForm}
                        addEntryLabel={isEntryFormVisible ? 'Hide Entry' : 'Add Entry'}
                        selectedHistoryId={selectedHistory?.id}
                        onSelectHistory={setSelectedHistory}
                        onDeleteSelected={deleteSelectedEntries}
                        onEdit={(row) => startEntryForm(row, 'edit')}
                        incomeLoadState={incomeLoadState}
                        paymentLoadState={paymentLoadState}
                        onRetryEntries={() => void refreshEntries()}
                        historyRecords={historyRecords}
                        historyLoadState={historyLoadState}
                        onRetryHistory={() => setHistoryRefreshKey((key) => key + 1)}
                      />
                    </TabsContent>
                  ))}
                </div>
              </Tabs>
            </CardContent>
          </Card>
          {showRightPanel && !isHistoryTab && (
            <Card className="flex min-h-0 min-w-0 flex-col">
              <EntryFormPanel
                key={formSeed}
                tab={activeTab}
                onSave={(form) => saveEntry(activeTab, form)}
                onDirtyChange={(isDirty) => {
                  setIsEntryFormDirty(isDirty)
                  if (isDirty) setEntrySaveError(undefined)
                }}
                saveError={entrySaveError}
                expenseTypes={activeExpenseTypes}
                paymentTypes={activePaymentTypes}
                initialValues={initialFormValues}
              />
            </Card>
          )}
        </div>
      </div>
      {isSummaryCompact && (
        <>
          <Button
            type="button"
            size="sm"
            className="fixed right-4 bottom-4"
            onClick={() => setIsSummaryVisible(true)}
          >
            {selectedReport.businessDate === format(new Date(), 'yyyy-MM-dd')
              ? 'Today’s Summary'
              : `${format(parse(selectedReport.businessDate, 'yyyy-MM-dd', new Date()), 'MMM d')} Summary`}
          </Button>
          <Sheet open={isSummaryVisible} onOpenChange={setIsSummaryVisible}>
            <SheetContent side="left" className="w-[min(92vw,22rem)] p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>
                  {selectedReport.businessDate === format(new Date(), 'yyyy-MM-dd')
                    ? 'Today’s Summary'
                    : `${format(parse(selectedReport.businessDate, 'yyyy-MM-dd', new Date()), 'MMMM d, yyyy')} Summary`}
                </SheetTitle>
                <SheetDescription>
                  Cashier report totals and cash variance for the selected business date.
                </SheetDescription>
              </SheetHeader>
              <ReportSummary
                key={reportId}
                alwaysDark={summaryAlwaysDark}
                refreshKey={summaryRefreshKey}
                reportId={reportId}
                businessDate={selectedReport.businessDate}
                branchId={selectedReport.branchId}
                cashierUserId={selectedReport.cashierUserId}
                dateRange={dateRange}
                isDateLoading={isDateLoading}
                onDateRangeChange={changeDateRange}
                expenseTotals={expenseQuery.expenseTotals}
              />
            </SheetContent>
          </Sheet>
        </>
      )}
      {isEntryFormCompact && !isHistoryTab && (
        <Sheet open={isEntryFormVisible} onOpenChange={setEntryFormOpen}>
          <SheetContent side="right" className="w-[min(92vw,26rem)] p-0">
            <SheetHeader>
              <SheetTitle>{activeTab} Entry</SheetTitle>
              <SheetDescription>
                Add a cashier report entry for {activeTab.toLowerCase()}.
              </SheetDescription>
            </SheetHeader>
            <EntryFormPanel
              key={formSeed}
              tab={activeTab}
              onSave={(form) => saveEntry(activeTab, form)}
              onDirtyChange={(isDirty) => {
                setIsEntryFormDirty(isDirty)
                if (isDirty) setEntrySaveError(undefined)
              }}
              saveError={entrySaveError}
              expenseTypes={activeExpenseTypes}
              paymentTypes={activePaymentTypes}
              initialValues={initialFormValues}
            />
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
      <Dialog
        open={Boolean(pdfPreview) && isPdfReviewOpen}
        onOpenChange={(open) => {
          if (!open && !isPdfProcessing) {
            setIsPdfReviewOpen(false)
            setPdfPreview(undefined)
          }
        }}
      >
        <DialogContent className="h-[min(84vh,52rem)] w-[min(94vw,84rem)] max-w-none grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-none">
          <DialogHeader className="border-b px-6 py-5 pr-12">
            <DialogTitle>Review Report</DialogTitle>
            <DialogDescription>Review the final PDF before sending it.</DialogDescription>
          </DialogHeader>
          <div className="grid min-h-0 grid-rows-[minmax(18rem,1fr)_auto] lg:grid-cols-[minmax(0,7fr)_minmax(19rem,3fr)] lg:grid-rows-1">
            <div className="min-h-0 bg-muted/30 p-4 lg:border-r">
              {pdfPreview && (
                <iframe
                  title="Cashier report PDF preview"
                  src={`data:application/pdf;base64,${pdfPreview.pdfBase64}`}
                  className="h-full min-h-0 w-full rounded-lg border border-border bg-background"
                />
              )}
            </div>
            <aside className="flex min-h-0 flex-col bg-card">
              <div className="flex flex-col gap-3">
                <div className="border-b bg-muted/35 p-5">
                  <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Delivery progress
                  </span>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <span className="text-4xl font-semibold tracking-tight tabular-nums">
                      {Math.round(
                        (pdfProgress.filter(
                          (step) => step.status === 'done' || step.status === 'failed'
                        ).length /
                          pdfProgress.length) *
                          100
                      )}
                      %
                    </span>
                    <span className="pb-1 text-xs text-muted-foreground">
                      {pdfProgress.filter((step) => step.status === 'done').length} of{' '}
                      {pdfProgress.length} done
                    </span>
                  </div>
                  <Progress
                    className="mt-4"
                    value={
                      (pdfProgress.filter(
                        (step) => step.status === 'done' || step.status === 'failed'
                      ).length /
                        pdfProgress.length) *
                      100
                    }
                    aria-label="Report delivery progress"
                  />
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <p className="mb-3 text-xs text-muted-foreground">
                  Use the PDF preview's print control when a paper copy is needed.
                </p>
                <div className="flex flex-col gap-2">
                  {pdfProgress.map((step) => (
                    <div
                      key={step.id}
                      className="flex items-start gap-2.5 rounded-lg border border-border/70 p-3"
                    >
                      <div className="mt-0.5 text-muted-foreground">
                        {step.status === 'processing' ? (
                          <Spinner />
                        ) : step.status === 'done' ? (
                          <Check className="text-primary" aria-hidden="true" />
                        ) : step.status === 'failed' ? (
                          <CircleAlert className="text-destructive" aria-hidden="true" />
                        ) : (
                          <span className="block size-4 rounded-full border border-border" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium">{step.label}</span>
                          <Badge
                            variant={step.status === 'failed' ? 'destructive' : 'secondary'}
                            className="capitalize"
                          >
                            {step.status}
                          </Badge>
                        </div>
                        {step.error && (
                          <Alert variant="destructive" className="mt-2">
                            <AlertTitle>Could not complete this step</AlertTitle>
                            <AlertDescription>{step.error}</AlertDescription>
                          </Alert>
                        )}
                        {step.id === 'telegram' && (
                          <div className="mt-3 flex flex-col gap-1.5">
                            <label htmlFor="telegram-report-note" className="text-xs font-medium">
                              Note
                            </label>
                            <Textarea
                              id="telegram-report-note"
                              value={telegramNote}
                              onChange={(event) => setTelegramNote(event.target.value)}
                              placeholder="Optional note for this report"
                              maxLength={800}
                              rows={3}
                              disabled={isPdfProcessing || step.status === 'done'}
                              className="min-h-20 resize-none text-xs"
                            />
                          </div>
                        )}
                        {step.status === 'failed' && !isPdfProcessing && pdfPreview && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={() => void retryPdfStep(step.id)}
                          >
                            Retry
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <DialogFooter className="mx-0 mb-0 rounded-none border-t px-4 py-4">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPdfProcessing}
                  onClick={() => {
                    setIsPdfReviewOpen(false)
                    setPdfPreview(undefined)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={isPdfProcessing}
                  onClick={() => {
                    if (pdfProgress.every((step) => step.status === 'pending')) beginPdfExport()
                    else {
                      setIsPdfReviewOpen(false)
                      setPdfPreview(undefined)
                    }
                  }}
                >
                  {isPdfProcessing ? <Spinner data-icon="inline-start" /> : null}
                  {pdfProgress.every((step) => step.status === 'pending') ? 'Send' : 'Done'}
                </Button>
              </DialogFooter>
            </aside>
          </div>
        </DialogContent>
      </Dialog>
      {confirmation && (
        <ConfirmationAlertDialog
          open
          title={confirmation.title}
          description={confirmation.description}
          confirmLabel={confirmation.confirmLabel}
          destructive={confirmation.destructive}
          onOpenChange={(open) => !open && setConfirmation(undefined)}
          onConfirm={confirmation.onConfirm}
        />
      )}
      <EntryDetailsDialog
        entry={selectedEntry}
        entityType={selectedEntryType}
        onOpenChange={closeEntryDetails}
      />
      <VoidEntryDialog
        open={Boolean(voidEntry || bulkVoidRows.length)}
        label={bulkVoidRows.length > 1 ? `${bulkVoidRows.length} entries` : 'entry'}
        onOpenChange={(open) => {
          if (!open) {
            setVoidEntry(undefined)
            setVoidEntryType(undefined)
            setBulkVoidRows([])
            setBulkVoidType(undefined)
          }
        }}
        onConfirm={(reason) => void confirmVoid(reason)}
      />
    </div>
  )
}
