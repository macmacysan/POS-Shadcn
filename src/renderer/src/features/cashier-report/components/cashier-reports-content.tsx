import * as React from 'react'
import * as XLSX from 'xlsx'
import { format, parse, parseISO } from 'date-fns'
import { CalendarIcon } from '@phosphor-icons/react'
import {
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  Bus,
  CarFront,
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
  Plus,
  ReceiptText,
  Scale,
  ShieldCheck,
  Soup,
  TriangleAlert,
  Utensils,
  WalletCards,
  Zap,
  Clock3,
  type LucideIcon
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { Checkbox } from '@/components/ui/checkbox'
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
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet
} from '@/components/ui/field'
import { AmountInputGroup } from '@/components/ui/amount-input-group'
import { DatePickerInput } from '@/components/ui/date-picker-input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  InstallmentHistoryInspector,
  InstallmentHistoryTable
} from '@/features/installment-history'
import type { RowActionItem } from '@/components/shared/data-table/row-actions'
import { ConfirmationAlertDialog } from '@/components/shared/confirmation-alert-dialog'
import { VoidEntryDialog } from '@/components/shared/void-entry-dialog'
import type { EntryEntityType, EntryHistoryRecord } from '@/../../shared/contracts'
import { DateSelector, type DateSelectorValue } from '@/../../components/reui/date-selector'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import type { InstallmentHistoryRecord } from '@/lib/installment-history'
import { cn } from '@/lib/utils'
import { formatAmountInput, formatPhilippinePeso } from '@/lib/currency'
import { useMediaQuery } from '@/hooks/use-mobile'
import { useNotifications } from '@/hooks/use-notifications'
import { ReportSummary } from '@/features/cashier-report/components/report-summary'
import { useExpenses, type ExpenseTableRow } from '@/features/cashier-report/hooks/use-expenses'
import { useActiveReport } from '@/contexts/active-report-context'
import {
  amountFromCentavos,
  type CatalogOptionRecord,
  parseAmountToCentavos,
  type DailyReportPaymentEntryRecord,
  type DailyReportSnapshotResponse,
  type ExpenseCategory,
  type ExpenseType,
  type ExpenseVat,
  type ExpenseRecord,
  type IncomeEntryRecord,
  type InstallmentAttentionSummary,
  type InstallmentHistoryRecord as PersistedInstallmentHistoryRecord,
  type InstallmentAccountRecord,
  type FinanceAccountRecord,
  type LoginBranch
} from '@/../../shared/contracts'
import {
  cashierReportPdfHtml,
  type CashierReportSection
} from '@/features/cashier-report/lib/cashier-report-pdf'

const reportTabs = ['Expenses', 'Income', 'Payment', 'Activity'] as const
const noopHistorySelect = (): void => undefined
type ExcelCell = string | number | null
type ExcelSheetRows = Record<string, ExcelCell>[]

function flattenExcelRecord(value: unknown, prefix = ''): Record<string, ExcelCell> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return {
      [prefix || 'Value']: Array.isArray(value) ? JSON.stringify(value) : String(value ?? '')
    }
  const result: Record<string, ExcelCell> = {}
  for (const [key, nested] of Object.entries(value)) {
    const name = prefix ? `${prefix}.${key}` : key
    if (nested && typeof nested === 'object' && !Array.isArray(nested))
      Object.assign(result, flattenExcelRecord(nested, name))
    else if (Array.isArray(nested)) result[name] = JSON.stringify(nested)
    else if (nested == null || (typeof nested === 'number' && !Number.isFinite(nested)))
      result[name] = null
    else
      result[name] =
        typeof nested === 'boolean' ? (nested ? 'TRUE' : 'FALSE') : (nested as ExcelCell)
  }
  return result
}

function installmentAccountRow(item: InstallmentAccountRecord): Record<string, ExcelCell> {
  return {
    id: item.contractId || item.loan.id || item.account.id,
    ...flattenExcelRecord(item)
  }
}

function workbookBase64(sheets: Record<string, ExcelSheetRows>): string {
  const workbook = XLSX.utils.book_new()
  for (const [name, rows] of Object.entries(sheets)) {
    const worksheet = XLSX.utils.json_to_sheet(rows)
    worksheet['!freeze'] = { xSplit: 0, ySplit: 1 }
    XLSX.utils.book_append_sheet(workbook, worksheet, name.slice(0, 31))
  }
  return XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' })
}

const expenseTypes = ['Company Expenses', 'Drawings', 'Purchases', 'Receivables'] as const
const vatOptions = ['VAT', 'Non-VAT'] as const
const paymentTypes = ['Bank Check', 'Bank Transfer', 'GCash', 'Other e-wallet'] as const

type PdfProgressStepId = 'save' | 'sheets' | 'telegram'
type PdfProgressStatus = 'pending' | 'processing' | 'done' | 'failed'
type PdfProgressStep = {
  id: PdfProgressStepId
  label: string
  status: PdfProgressStatus
  error?: string
  attempts: number
}

type PdfReviewRequest = {
  sections?: readonly CashierReportSection[]
  filters?: { branch: LoginBranch; dateFrom?: string; dateTo?: string; accountType?: string }
}

const initialPdfProgress: PdfProgressStep[] = [
  { id: 'save', label: 'Save to Documents', status: 'pending', attempts: 0 },
  { id: 'sheets', label: 'Upload encrypted Drive snapshot', status: 'pending', attempts: 0 },
  { id: 'telegram', label: 'Send to Telegram', status: 'pending', attempts: 0 }
]

function filenameName(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'Report'
  const lastName = parts.pop()!
  return [...parts, lastName.charAt(0)].join(' ').replace(/[^A-Za-z0-9 ]/g, '') || 'Report'
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
  source: 'local' | 'google-cache'
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
  createdByFirstName: string
  createdAt: string
  updatedAt: string
}
type PaymentRow = ReportRow & {
  source: 'local' | 'google-cache'
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
  createdByFirstName: string
  createdAt: string
  updatedAt: string
}

type EntryLoadState = {
  isLoading: boolean
  error?: string
}

const money = formatPhilippinePeso

function createdByInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return `${parts[0]?.[0] ?? '?'}${parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : ''}`.toUpperCase()
}

function CreatedByBadge({ name }: { name: string }): React.JSX.Element {
  return (
    <Badge variant="secondary" className="h-5 px-1 text-[10px] leading-none" aria-label={name}>
      {createdByInitials(name)}
    </Badge>
  )
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].filter(Boolean).sort()
}

function installmentHistoryRow(
  record: PersistedInstallmentHistoryRecord
): InstallmentHistoryRecord {
  const rawRecord = record as PersistedInstallmentHistoryRecord & {
    balance_centavos?: number
  }
  const balanceCentavos = record.balanceCentavos ?? rawRecord.balance_centavos
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
    balance: balanceCentavos === undefined ? undefined : amountFromCentavos(balanceCentavos),
    balanceCentavos,
    details
  }
}

function attentionTiming(item: InstallmentAttentionSummary['overdue'][number]): string {
  if (item.daysFromToday < 0) {
    const days = Math.abs(item.daysFromToday)
    const months = Math.floor(days / 30)
    return months > 0
      ? `${months} month${months === 1 ? '' : 's'} overdue`
      : `${days} day${days === 1 ? '' : 's'} overdue`
  }
  return item.daysFromToday === 0
    ? 'Due today'
    : `Due in ${item.daysFromToday} day${item.daysFromToday === 1 ? '' : 's'}`
}

function InstallmentAttentionPopover({
  summary,
  onViewOverdue,
  onViewAll,
  onOpenAccount
}: {
  summary?: InstallmentAttentionSummary
  onViewOverdue?: () => void
  onViewAll?: () => void
  onOpenAccount?: (accountId: string) => void
}): React.JSX.Element | null {
  const [open, setOpen] = React.useState(false)
  if (!summary || (summary.overdueCount === 0 && summary.nearDueCount === 0)) return null
  const closeAnd = (action?: () => void): void => {
    setOpen(false)
    action?.()
  }
  const renderRows = (items: InstallmentAttentionSummary['overdue']): React.JSX.Element => (
    <div className="flex flex-col gap-0.5">
      {items.map((item) => (
        <button
          key={item.accountId}
          type="button"
          className="flex min-w-0 items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => closeAnd(() => onOpenAccount?.(item.accountId))}
        >
          <span className="min-w-0 truncate">{item.accountName}</span>
          <span
            className={cn(
              'shrink-0 tabular-nums',
              item.daysFromToday < 0 ? 'text-destructive' : 'text-warning-foreground'
            )}
          >
            {attentionTiming(item)}
          </span>
        </button>
      ))}
    </div>
  )
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-w-0 shrink-0 gap-1.5 border-border/70 bg-background px-2.5"
            aria-label="Open installment attention"
          />
        }
      >
        {summary.overdueCount > 0 ? (
          <TriangleAlert data-icon="inline-start" className="text-destructive" aria-hidden="true" />
        ) : (
          <Clock3 data-icon="inline-start" className="text-warning-foreground" aria-hidden="true" />
        )}
        {summary.overdueCount > 0 && (
          <span className="text-destructive">
            <span className="hidden sm:inline">{summary.overdueCount} Overdue</span>
            <span className="sm:hidden">{summary.overdueCount}</span>
          </span>
        )}
        {summary.overdueCount > 0 && summary.nearDueCount > 0 && (
          <span className="text-muted-foreground">·</span>
        )}
        {summary.nearDueCount > 0 && (
          <span className="text-warning-foreground">
            <Clock3 data-icon="inline-start" aria-hidden="true" />
            <span className="hidden sm:inline">{summary.nearDueCount} Near due</span>
            <span className="sm:hidden">{summary.nearDueCount}</span>
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(26rem,calc(100vw-2rem))] p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">Installment attention</p>
          <span className="text-xs text-muted-foreground">Active accounts</span>
        </div>
        {summary.overdueCount > 0 && (
          <section aria-label="Overdue installments">
            <div className="mb-1 flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.12em]">
              <span className="text-destructive">Overdue</span>
              <span className="text-muted-foreground">{summary.overdueCount} accounts</span>
            </div>
            {renderRows(summary.overdue)}
          </section>
        )}
        {summary.overdueCount > 0 && summary.nearDueCount > 0 && <Separator />}
        {summary.nearDueCount > 0 && (
          <section aria-label="Installments near due">
            <div className="mb-1 flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.12em]">
              <span className="text-warning-foreground">Near due</span>
              <span className="text-muted-foreground">{summary.nearDueCount} accounts</span>
            </div>
            {renderRows(summary.nearDue)}
          </section>
        )}
        <Separator />
        <div className="flex items-center justify-between gap-2">
          {summary.overdueCount > 0 ? (
            <Button type="button" variant="ghost" size="xs" onClick={() => closeAnd(onViewOverdue)}>
              View overdue accounts
            </Button>
          ) : <span />}
          <Button type="button" variant="outline" size="xs" onClick={() => closeAnd(onViewAll)}>
            View all
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function CashierReportHeader({
  error,
  actions
}: {
  error?: string
  actions?: React.ReactNode
}): React.JSX.Element {
  return (
    <header className="ml-auto flex min-w-0 shrink-0 items-center justify-end gap-2 px-3 py-1">
      {error && (
        <span className="max-w-48 truncate text-xs text-destructive" role="alert">
          {error}
        </span>
      )}
      {actions}
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
  return <TruncatedText value={label} className="text-[13px] text-muted-foreground" />
}

const expenseColumns: ReportColumn<ExpenseRow>[] = [
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ getValue }) => <TypeBox value={getValue<string>()} kind="expense" />,
    size: 145,
    meta: { className: 'text-muted-foreground' }
  },
  {
    accessorKey: 'description',
    header: 'Description',
    size: 176,
    cell: ({ getValue }) => <TruncatedText value={getValue<string>()} className="font-light" />,
    meta: { className: 'min-w-0' }
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
    header: 'By',
    cell: ({ row }) => <CreatedByBadge name={row.original.createdByName} />,
    size: 20,
    meta: { className: 'px-1 text-center text-muted-foreground' }
  },
  {
    accessorKey: 'amount',
    header: 'Amount',
    cell: ({ getValue }) => money(getValue<number>()),
    size: 144,
    meta: {
      className: 'px-4 text-right font-light tabular-nums text-foreground'
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
    size: 240,
    cell: ({ getValue }) => <TruncatedText value={getValue<string>()} className="font-light" />,
    meta: { className: 'min-w-0' }
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
    meta: { className: 'min-w-0' }
  },
  {
    accessorKey: 'createdByName',
    header: 'By',
    cell: ({ row }) => <CreatedByBadge name={row.original.createdByName} />,
    size: 20,
    meta: { className: 'px-1 text-center text-muted-foreground' }
  },
  {
    accessorKey: 'amount',
    header: 'Amount',
    cell: ({ getValue }) => money(getValue<number>()),
    size: 134,
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
    meta: { className: 'min-w-0' }
  },
  {
    accessorKey: 'accountName',
    header: 'Account name',
    size: 200,
    cell: ({ getValue }) => <TruncatedText value={getValue<string>()} className="font-light" />,
    meta: { className: 'min-w-0' }
  },
  {
    accessorKey: 'referenceNo',
    header: 'Reference no.',
    size: 140,
    cell: ({ getValue }) => (
      <TruncatedText value={getValue<string>()} className="text-muted-foreground" />
    ),
    meta: { className: 'min-w-0 text-muted-foreground' }
  },
  {
    accessorKey: 'date',
    header: 'Date',
    size: 100,
    meta: { className: 'text-muted-foreground' }
  },
  {
    accessorKey: 'createdByName',
    header: 'By',
    cell: ({ row }) => <CreatedByBadge name={row.original.createdByName} />,
    size: 20,
    meta: { className: 'px-1 text-center text-muted-foreground' }
  },
  {
    accessorKey: 'amount',
    header: 'Amount',
    size: 134,
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
    createdByFirstName: record.createdByFirstName ?? record.createdByName ?? 'Unknown',
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    source: record.source
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
    createdByFirstName: record.createdByFirstName ?? record.createdByName ?? 'Unknown',
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    source: record.source
  }
}

function expenseRowActions(
  row: ExpenseRow,
  onView: (row: ExpenseRow, entityType: EntryEntityType) => void,
  onVoid: (row: ExpenseRow, entityType: EntryEntityType) => void,
  onEdit: (row: ExpenseRow) => void,
  onDuplicate: (row: ExpenseRow) => void
): readonly RowActionItem[] {
  return row.source === 'google-cache' || row.status === 'VOIDED'
    ? [{ id: 'view', label: 'View Details', onSelect: () => onView(row, 'EXPENSE') }]
    : [
        { id: 'view', label: 'View Details', onSelect: () => onView(row, 'EXPENSE') },
        { id: 'edit', label: 'Edit Expense', onSelect: () => onEdit(row) },
        { id: 'duplicate', label: 'Duplicate Expense', onSelect: () => onDuplicate(row) },
        {
          id: 'void',
          label: 'Void Expense',
          onSelect: () => onVoid(row, 'EXPENSE'),
          destructive: true
        }
      ]
}

function incomeRowActions(
  row: IncomeRow,
  onView: (row: IncomeRow, entityType: EntryEntityType) => void,
  onVoid: (row: IncomeRow, entityType: EntryEntityType) => void,
  onEdit: (row: IncomeRow) => void,
  onDuplicate: (row: IncomeRow) => void
): readonly RowActionItem[] {
  return row.source === 'google-cache' || row.status === 'VOIDED'
    ? [{ id: 'view', label: 'View Details', onSelect: () => onView(row, 'INCOME') }]
    : [
        { id: 'view', label: 'View Details', onSelect: () => onView(row, 'INCOME') },
        { id: 'edit', label: 'Edit Income', onSelect: () => onEdit(row) },
        { id: 'duplicate', label: 'Duplicate Income', onSelect: () => onDuplicate(row) },
        {
          id: 'void',
          label: 'Void Income',
          onSelect: () => onVoid(row, 'INCOME'),
          destructive: true
        }
      ]
}

function paymentRowActions(
  row: PaymentRow,
  onView: (row: PaymentRow, entityType: EntryEntityType) => void,
  onVoid: (row: PaymentRow, entityType: EntryEntityType) => void,
  onEdit: (row: PaymentRow) => void,
  onDuplicate: (row: PaymentRow) => void
): readonly RowActionItem[] {
  if (row.source === 'google-cache')
    return [{ id: 'view', label: 'View Details', onSelect: () => onView(row, 'PAYMENT') }]
  return [
    { id: 'view', label: 'View Details', onSelect: () => onView(row, 'PAYMENT') },
    { id: 'edit', label: 'Edit Payment', onSelect: () => onEdit(row) },
    { id: 'duplicate', label: 'Duplicate Payment', onSelect: () => onDuplicate(row) },
    {
      id: 'void',
      label: 'Void Payment',
      onSelect: () => onVoid(row, 'PAYMENT'),
      destructive: true
    }
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
  expenseTypes,
  paymentTypes,
  expenseQuery,
  onVoidSelectedExpenses,
  onView,
  onVoid,
  onDuplicate,
  selectedHistoryId,
  onSelectHistory,
  onVoidSelected,
  onVoidSelectedHistory,
  onEdit,
  incomeLoadState,
  paymentLoadState,
  onRetryEntries,
  historyRecords,
  historyLoadState,
  onRetryHistory,
  onVisibleHistoryCountChange,
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
  expenseTypes: readonly string[]
  paymentTypes: readonly string[]
  expenseQuery: ReturnType<typeof useExpenses>
  onVoidSelectedExpenses: (rows: ExpenseRow[]) => Promise<boolean>
  onView: (row: ReportEntryRow, entityType: EntryEntityType) => void
  onVoid: (row: ReportEntryRow, entityType: EntryEntityType) => void
  onDuplicate: (row: ReportEntryRow) => void
  selectedHistoryId?: string
  onSelectHistory: (record: InstallmentHistoryRecord) => void
  onVoidSelected: (rows: ReportRow[]) => boolean | Promise<boolean>
  onVoidSelectedHistory: (rows: InstallmentHistoryRecord[], password: string) => Promise<void>
  onEdit: (row: ExpenseRow | IncomeRow | PaymentRow) => void
  incomeLoadState: EntryLoadState
  paymentLoadState: EntryLoadState
  onRetryEntries: () => void
  historyRecords: InstallmentHistoryRecord[]
  historyLoadState: EntryLoadState
  onRetryHistory: () => void
  onVisibleHistoryCountChange: (count: number) => void
  isAdmin: boolean
  showVoided: boolean
  onShowVoidedChange: (value: boolean) => void
}): React.JSX.Element {
  const expenseAddedByOptions = React.useMemo(
    () => uniqueSorted(expenseRows.map((row) => row.createdByName)),
    [expenseRows]
  )
  const incomeAddedByOptions = React.useMemo(
    () => uniqueSorted(incomeRows.map((row) => row.createdByName)),
    [incomeRows]
  )
  const paymentAddedByOptions = React.useMemo(
    () => uniqueSorted(paymentRows.map((row) => row.createdByName)),
    [paymentRows]
  )
  const expenseFilterOptions = React.useMemo(
    () => ({
      type: expenseTypes,
      createdByName: expenseAddedByOptions
    }),
    [expenseAddedByOptions, expenseTypes]
  )
  const getExpenseActions = React.useCallback(
    (row: ExpenseRow) => expenseRowActions(row, onView, onVoid, onEdit, onDuplicate),
    [onDuplicate, onEdit, onView, onVoid]
  )
  const getIncomeActions = React.useCallback(
    (row: IncomeRow) => incomeRowActions(row, onView, onVoid, onEdit, onDuplicate),
    [onDuplicate, onEdit, onView, onVoid]
  )
  const getPaymentActions = React.useCallback(
    (row: PaymentRow) => paymentRowActions(row, onView, onVoid, onEdit, onDuplicate),
    [onDuplicate, onEdit, onView, onVoid]
  )
  const getAdminExpenseActions = React.useCallback(
    (row: ExpenseRow) => (row.source === 'google-cache' ? expenseRowActions(row, onView, onVoid, onEdit, onDuplicate) : []),
    [onDuplicate, onEdit, onView, onVoid]
  )
  const getAdminIncomeActions = React.useCallback(
    (row: IncomeRow) => (row.source === 'google-cache' ? incomeRowActions(row, onView, onVoid, onEdit, onDuplicate) : []),
    [onDuplicate, onEdit, onView, onVoid]
  )
  const getAdminPaymentActions = React.useCallback(
    (row: PaymentRow) => (row.source === 'google-cache' ? paymentRowActions(row, onView, onVoid, onEdit, onDuplicate) : []),
    [onDuplicate, onEdit, onView, onVoid]
  )
  const onExpenseDefaultAction = React.useCallback(
    (row: ExpenseRow) => {
      if (row.source === 'local') onEdit(row)
    },
    [onEdit]
  )
  const onEntryDefaultAction = React.useCallback(
    (row: IncomeRow | PaymentRow) => {
      if (row.source === 'local') onEdit(row)
    },
    [onEdit]
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
          additionalFilterFields={[
            {
              key: 'category',
              label: 'Category',
              options: expenseCategoryConfigs.map(({ value, fullLabel }) => ({
                value,
                label: fullLabel
              }))
            },
            {
              key: 'receiptNo',
              label: 'Receipt No.',
              type: 'text',
              placeholder: 'Search receipt...'
            },
            {
              key: 'amount',
              label: 'Amount',
              type: 'range',
              minKey: 'amountMin',
              maxKey: 'amountMax',
              minPlaceholder: 'Min',
              maxPlaceholder: 'Max'
            }
          ]}
          globalFilterValue={globalFilter}
          onGlobalFilterValueChange={onGlobalFilterChange}
          getRowActions={isAdmin ? getAdminExpenseActions : getExpenseActions}
          onVoidSelected={isAdmin ? undefined : onVoidSelectedExpenses}
          onDefaultAction={isAdmin ? undefined : onExpenseDefaultAction}
          serverState={expenseQuery}
          filterOptions={expenseFilterOptions}
          toolbarContent={
            <>
              {isAdmin && (
                <Button
                  type="button"
                  variant={showVoided ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => onShowVoidedChange(!showVoided)}
                >
                  {showVoided ? 'Hide voided' : 'Show voided'}
                </Button>
              )}
            </>
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
          getRowActions={isAdmin ? getAdminIncomeActions : getIncomeActions}
          onVoidSelected={isAdmin ? undefined : onVoidSelected}
          onDefaultAction={isAdmin ? undefined : onEntryDefaultAction}
          isLoading={incomeLoadState.isLoading}
          loadError={incomeLoadState.error}
          onRetry={onRetryEntries}
          filterOptions={{
            date: uniqueSorted(incomeRows.map((row) => row.date)),
            createdByName: incomeAddedByOptions
          }}
          toolbarContent={
            <>
              {isAdmin && (
                <Button
                  type="button"
                  variant={showVoided ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => onShowVoidedChange(!showVoided)}
                >
                  {showVoided ? 'Hide voided' : 'Show voided'}
                </Button>
              )}
            </>
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
          getRowActions={isAdmin ? getAdminPaymentActions : getPaymentActions}
          onVoidSelected={isAdmin ? undefined : onVoidSelected}
          onDefaultAction={isAdmin ? undefined : onEntryDefaultAction}
          isLoading={paymentLoadState.isLoading}
          loadError={paymentLoadState.error}
          onRetry={onRetryEntries}
          filterOptions={{
            type: paymentTypes,
            date: uniqueSorted(paymentRows.map((row) => row.date)),
            createdByName: paymentAddedByOptions
          }}
          toolbarContent={
            <>
              {isAdmin && (
                <Button
                  type="button"
                  variant={showVoided ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => onShowVoidedChange(!showVoided)}
                >
                  {showVoided ? 'Hide voided' : 'Show voided'}
                </Button>
              )}
            </>
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
            key={selectedBranch}
            records={historyRecords}
            isLoading={historyLoadState.isLoading}
            selectedBranch={selectedBranch}
            dateFrom={dateFrom}
            dateTo={dateTo}
            globalSearch={globalFilter}
            onGlobalSearchChange={onGlobalFilterChange}
            onVisibleRecordCountChange={onVisibleHistoryCountChange}
            selectedId={selectedHistoryId}
            onSelect={noopHistorySelect}
            onDoubleClick={onSelectHistory}
            onVoidSelected={onVoidSelectedHistory}
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
  return (
    <DatePickerInput
      id={id}
      name={id}
      defaultValue={initialValue ?? format(new Date(), 'yyyy-MM-dd')}
      required
      aria-label={label}
    />
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
              <AmountInputGroup
                id={id}
                name={id}
                defaultValue={initialValues[id]}
                placeholder={`Enter ${field.toLowerCase()}`}
              />
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

function EntryFormActions({
  tab,
  isEdit,
  isSaving
}: {
  tab: (typeof reportTabs)[number]
  isEdit: boolean
  isSaving: boolean
}): React.JSX.Element {
  return (
    <DrawerFooter>
      <Button type="submit" size="sm" disabled={isSaving}>
        {isEdit
          ? `Update ${tab}`
          : tab === 'Payment'
            ? 'Save Payment'
            : tab === 'Expenses'
              ? 'Save Expense'
              : 'Save Income'}
      </Button>
      {!isEdit && (
        <Button type="reset" variant="ghost" size="sm" disabled={isSaving}>
          Clear
        </Button>
      )}
      <DrawerClose
        render={
          <Button type="button" variant="outline" size="sm" disabled={isSaving}>
            Cancel
          </Button>
        }
      />
    </DrawerFooter>
  )
}

function EntryFormPanel({
  tab,
  onSave,
  onDirtyChange,
  saveError,
  expenseTypes,
  paymentTypes,
  initialValues,
  isEdit,
  isSaving
}: {
  tab: (typeof reportTabs)[number]
  onSave: (form: FormData) => void
  onDirtyChange: (isDirty: boolean) => void
  saveError?: string
  expenseTypes: readonly string[]
  paymentTypes: readonly string[]
  initialValues?: Record<string, string>
  isEdit: boolean
  isSaving: boolean
}): React.JSX.Element {
  const [resetKey, setResetKey] = React.useState(0)

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onChange={() => onDirtyChange(true)}
      onReset={() => {
        setResetKey((value) => value + 1)
        onDirtyChange(false)
      }}
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
          key={resetKey}
          tab={tab}
          expenseTypes={expenseTypes}
          paymentTypes={paymentTypes}
          initialValues={initialValues}
        />
      </ScrollArea>
      <EntryFormActions tab={tab} isEdit={isEdit} isSaving={isSaving} />
    </form>
  )
}

export function CashierReportsContent({
  selectedBranch = 'All Branch',
  cashierName = 'Cashier',
  isAdmin = false,
  initialTab = 'Expenses',
  openExportReports = false,
  exportDate,
  onExportReportsOpened,
  onOpenCollection,
  onOpenHistoryPayment,
  onOpenFinance,
  installmentAttention,
  onViewOverdueInstallments,
  onViewInstallmentAccounts,
  onOpenInstallmentAccount
}: {
  selectedBranch?: LoginBranch
  cashierName?: string
  isAdmin?: boolean
  initialTab?: (typeof reportTabs)[number]
  openExportReports?: boolean
  exportDate?: string
  onExportReportsOpened?: () => void
  onOpenCollection?: (accountId: string) => void
  onOpenHistoryPayment?: (accountId: string, paymentId: string) => void
  onOpenFinance?: (accountId: string, returnToHistory?: boolean) => void
  installmentAttention?: InstallmentAttentionSummary
  onViewOverdueInstallments?: () => void
  onViewInstallmentAccounts?: () => void
  onOpenInstallmentAccount?: (accountId: string) => void
}): React.JSX.Element {
  const { notify } = useNotifications()
  const [activeTab, setActiveTab] = React.useState<(typeof reportTabs)[number]>(initialTab)
  const [hoveredTab, setHoveredTab] = React.useState<(typeof reportTabs)[number]>()
  const activeReportValue = useActiveReport()
  const hasActiveReport = activeReportValue !== null
  const activeReport = activeReportValue ?? {
    id: '',
    reportId: '',
    branchId: '',
    cashierUserId: '',
    businessDate: format(new Date(), 'yyyy-MM-dd'),
    openingCashCentavos: 0,
    cashRemittedCentavos: null,
    status: 'DRAFT' as const,
    submittedAt: null,
    approvedAt: null,
    approvedByUserId: null,
    updatedByUserId: null,
    updatedByName: null,
    note: null,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString()
  }
  const [selectedReport, setSelectedReport] = React.useState(activeReport)
  const [isDateLoading, setIsDateLoading] = React.useState(false)
  const [selectedReportMissing, setSelectedReportMissing] = React.useState(!hasActiveReport)
  const [dateError, setDateError] = React.useState<string>()
  const [exportError, setExportError] = React.useState<string>()
  const [isReviewingPdf, setIsReviewingPdf] = React.useState(false)
  const [isExportReportsOpen, setIsExportReportsOpen] = React.useState(false)
  const [exportSections, setExportSections] = React.useState<CashierReportSection[]>([])
  const [exportBranch, setExportBranch] = React.useState<LoginBranch>(selectedBranch)
  const [exportType, setExportType] = React.useState('All Types')
  const [exportStartDate, setExportStartDate] = React.useState(() =>
    format(new Date(), 'yyyy-MM-dd')
  )
  const [exportEndDate, setExportEndDate] = React.useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [pdfPreview, setPdfPreview] = React.useState<{
    fileName: string
    pdfBase64: string
    note: string
  }>()
  const [excelSheets, setExcelSheets] = React.useState<Record<string, ExcelSheetRows>>({})
  const [publishContext, setPublishContext] = React.useState<{
    branch: LoginBranch
    businessDate?: string
    tabs: Record<string, ExcelSheetRows>
  }>()
  const [isExcelExporting, setIsExcelExporting] = React.useState(false)
  const [excelExportMessage, setExcelExportMessage] = React.useState<string>()
  const summarySnapshotRef = React.useRef<DailyReportSnapshotResponse | undefined>(undefined)
  const [isPdfReviewOpen, setIsPdfReviewOpen] = React.useState(false)
  const [pdfProgress, setPdfProgress] = React.useState<PdfProgressStep[]>(initialPdfProgress)
  const [isPdfProcessing, setIsPdfProcessing] = React.useState(false)
  const [pdfNote, setPdfNote] = React.useState('')
  const [pdfReviewRequest, setPdfReviewRequest] = React.useState<PdfReviewRequest>()
  const [telegramNote, setTelegramNote] = React.useState('')
  React.useEffect(() => {
    if (!openExportReports) return
    const date = exportDate ?? format(new Date(), 'yyyy-MM-dd')
    setExportSections([])
    setExportBranch(selectedBranch)
    setExportStartDate(date)
    setExportEndDate(date)
    setIsExportReportsOpen(true)
    onExportReportsOpened?.()
  }, [exportDate, onExportReportsOpened, openExportReports, selectedBranch])
  const [reportSearch, setReportSearch] = React.useState('')
  const [dateRange, setDateRange] = React.useState<DateSelectorValue>(() => {
    const today = new Date()
    return { period: 'day', operator: 'is', startDate: today, endDate: today }
  })
  const dateRequestVersionRef = React.useRef(0)
  React.useEffect(() => {
    if (!activeReportValue) setSelectedReportMissing(true)
  }, [activeReportValue])
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
  const { createExpense, voidExpenses, updateExpense } = expenseQuery
  const [incomes, setIncomes] = React.useState<IncomeRow[]>([])
  const [payments, setPayments] = React.useState<PaymentRow[]>([])
  const [catalogOptions, setCatalogOptions] = React.useState<CatalogOptionRecord[]>([])
  const [historyRecords, setHistoryRecords] = React.useState<InstallmentHistoryRecord[]>([])
  const [visibleHistoryCount, setVisibleHistoryCount] = React.useState(0)
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
  const [isEntryFormSaving, setIsEntryFormSaving] = React.useState(false)
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
  const openHistoryRecord = React.useCallback(
    (record: InstallmentHistoryRecord): void => {
      if (record.source === 'in-house' && record.activity.toLowerCase().includes('payment')) {
        onOpenHistoryPayment?.(record.accountId, record.id)
        return
      }
      if (record.source === 'finance' && record.activity.toLowerCase().includes('finance')) {
        onOpenFinance?.(record.accountId, true)
        return
      }
      setSelectedHistory(record)
    },
    [onOpenHistoryPayment, onOpenFinance]
  )
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
        if (report) {
          setSelectedReport({ ...report, reportId: report.id })
          setSelectedReportMissing(false)
        } else setSelectedReportMissing(true)
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
  const reviewPdf = React.useCallback(
    async (
      sections?: readonly CashierReportSection[],
      filters?: { branch: LoginBranch; dateFrom?: string; dateTo?: string; accountType?: string }
    ): Promise<void> => {
      setPdfReviewRequest({ sections, filters })
      setIsReviewingPdf(true)
      setExportError(undefined)
      setIsPdfReviewOpen(false)
      setPdfPreview(undefined)
      try {
        const branchFilter = filters?.branch ?? selectedBranch
        const allExpenses: ExpenseRecord[] = []
        for (let pageIndex = 0; ; pageIndex += 1) {
          const result = await window.api.reports.expenses.list({
            reportId: undefined,
            includeVoided: true,
            branch: branchFilter === 'All Branch' ? undefined : branchFilter,
            dateFrom: filters?.dateFrom,
            dateTo: filters?.dateTo,
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
          blacklisted,
          financeAccounts,
          charts
        ] = await Promise.all([
          window.api.dailyReports.getSnapshot({ dailyReportId: reportId }),
          window.api.dailyReports.listIncome({
            branch: branchFilter,
            dateFrom: filters?.dateFrom,
            dateTo: filters?.dateTo,
            includeVoided: true
          }),
          window.api.dailyReports.listPayments({
            branch: branchFilter,
            dateFrom: filters?.dateFrom,
            dateTo: filters?.dateTo,
            includeVoided: true
          }),
          window.api.installments.listHistory({
            dateFrom: filters?.dateFrom,
            dateTo: filters?.dateTo
          }),
          window.api.installments.list({
            view: 'records',
            search: '',
            branch: branchFilter === 'All Branch' ? undefined : branchFilter,
            includeVoided: true
          }),
          window.api.installments.list({
            view: 'active',
            search: '',
            branch: branchFilter === 'All Branch' ? undefined : branchFilter,
            includeVoided: true
          }),
          window.api.installments.list({
            view: 'closed',
            search: '',
            branch: branchFilter === 'All Branch' ? undefined : branchFilter,
            includeVoided: true
          }),
          window.api.installments.list({
            view: 'blacklisted',
            search: '',
            branch: branchFilter === 'All Branch' ? undefined : branchFilter,
            includeVoided: true
          }),
          window.api.financeAccounts.list({
            search: '',
            includeVoided: true,
            ...(branchFilter === 'All Branch' ? {} : { branch: branchFilter })
          }),
          window.api.dashboard.getPdfCharts({
            businessDate: filters?.dateTo ?? selectedReport.businessDate,
            ...(branchFilter === 'All Branch' ? {} : { branch: branchFilter })
          })
        ])
        const branch = branchFilter === 'All Branch' ? 'All Branch' : branchFilter
        const postedExpenses = allExpenses.filter(
          (item) => item.source === 'local' && item.status === 'POSTED'
        )
        const postedIncomes = incomeResult.rows.filter(
          (item) => item.source === 'local' && item.status === 'POSTED'
        )
        const postedPayments = paymentResult.rows.filter(
          (item) => item.source === 'local' && item.status === 'POSTED'
        )
        const filteredFinanceAccounts = financeAccounts.rows.filter(
          (item: FinanceAccountRecord) =>
            (!filters?.dateFrom || item.dateReleased >= filters.dateFrom) &&
            (!filters?.dateTo || item.dateReleased <= filters.dateTo) &&
            (!filters?.accountType ||
              filters.accountType === 'All Types' ||
              item.provider === filters.accountType)
        )
        const nextExcelSheets: Record<string, ExcelSheetRows> = {}
        if (sections?.includes('Expenses'))
          nextExcelSheets.Expenses = postedExpenses.map((item) => flattenExcelRecord(item))
        if (sections?.includes('Income'))
          nextExcelSheets.Income = postedIncomes.map((item) => flattenExcelRecord(item))
        if (sections?.includes('Payment'))
          nextExcelSheets.Payment = postedPayments.map((item) => flattenExcelRecord(item))
        if (sections?.includes('Activity History'))
          nextExcelSheets['Activity History'] = installmentHistory
            .filter((item) => branchFilter === 'All Branch' || item.branch === branchFilter)
            .map((item) => flattenExcelRecord(item))
        if (sections?.includes('Accounts'))
          nextExcelSheets.Finance = filteredFinanceAccounts.map((item) => flattenExcelRecord(item))
        if (sections?.includes('Records'))
          nextExcelSheets.Records = records.rows.map(installmentAccountRow)
        if (sections?.includes('Active'))
          nextExcelSheets.Active = active.rows.map(installmentAccountRow)
        if (sections?.includes('Closed'))
          nextExcelSheets.Closed = closed.rows.map(installmentAccountRow)
        if (sections?.includes('Blacklisted'))
          nextExcelSheets.Blacklisted = blacklisted.rows.map(installmentAccountRow)
        setExcelSheets(nextExcelSheets)
        const publishDate =
          filters?.dateFrom && filters.dateFrom === filters.dateTo ? filters.dateFrom : undefined
        setPublishContext({
          branch: branchFilter,
          businessDate: publishDate,
          tabs: {
            Expenses: allExpenses
              .filter((item) => item.source === 'local')
              .map((item) => flattenExcelRecord(item)),
            Income: incomeResult.rows
              .filter((item) => item.source === 'local')
              .map((item) => flattenExcelRecord(item)),
            Payment: paymentResult.rows
              .filter((item) => item.source === 'local')
              .map((item) => flattenExcelRecord(item)),
            Records: records.rows.map(installmentAccountRow),
            Finance: filteredFinanceAccounts.map((item) => flattenExcelRecord(item))
          }
        })
        setExcelExportMessage(undefined)
        const contributors = [
          ...postedExpenses.map((item) => item.createdByName),
          ...postedIncomes.map((item) => item.createdByName),
          ...postedPayments.map((item) => item.createdByName)
        ].filter((name): name is string => Boolean(name?.trim()))
        const contributorLabel = [...new Set(contributors)].join(', ') || cashierName
        const now = new Date()
        const html = cashierReportPdfHtml({
          cashierName: contributorLabel,
          branch,
          businessDate:
            filters?.dateFrom && filters?.dateTo
              ? `${filters.dateFrom} to ${filters.dateTo}`
              : selectedReport.businessDate,
          generatedAt: format(now, 'MMM d, yyyy · h:mm a'),
          note: pdfNote,
          snapshot:
            summarySnapshotRef.current?.report.id === reportId
              ? summarySnapshotRef.current
              : snapshot,
          expenses: postedExpenses,
          incomes: postedIncomes,
          payments: postedPayments,
          installmentHistory: installmentHistory.filter(
            (item) => branchFilter === 'All Branch' || item.branch === branchFilter
          ),
          accountCounts: {
            records: records.rows.length,
            active: active.rows.length,
            closed: closed.rows.length,
            blacklisted: blacklisted.rows.length
          },
          charts,
          sections,
          financeAccounts: sections ? filteredFinanceAccounts : undefined,
          accountLists: {
            records: records.rows,
            active: active.rows,
            closed: closed.rows,
            blacklisted: blacklisted.rows
          }
        })
        const reportDate = filters?.dateFrom ?? selectedReport.businessDate
        const fileName = `${format(parseISO(reportDate), 'MMMM d, yyyy')} - ${filenameName(cashierName)}.pdf`
        const { pdfBase64 } = await window.api.pdfExport.preview({ html, fileName })
        setPdfProgress(initialPdfProgress)
        setTelegramNote('')
        setPdfPreview({ fileName, pdfBase64, note: pdfNote })
        setIsPdfReviewOpen(true)
      } catch (error) {
        const message =
          error &&
          typeof error === 'object' &&
          'message' in error &&
          typeof error.message === 'string'
            ? error.message
            : 'The PDF could not be exported. Please try again.'
        setExportError(message)
      } finally {
        setIsReviewingPdf(false)
      }
    },
    [cashierName, pdfNote, reportId, selectedBranch, selectedReport.businessDate]
  )
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
          if (id === 'telegram') {
            await window.api.dailyReports.markDelivery({
              dailyReportId: reportId,
              channel: 'TELEGRAM'
            })
            window.dispatchEvent(new Event('daily-report-delivery-updated'))
          }
          updatePdfStep(id, { status: 'done', error: undefined })
          return
        } catch (error) {
          lastError =
            id === 'sheets' && error instanceof Error && error.message
              ? error.message
              : id === 'telegram' && error instanceof Error && error.message
                ? error.message
                : 'Saving the report was canceled or failed.'
        }
      }
      updatePdfStep(id, { status: 'failed', error: lastError })
    },
    [reportId, updatePdfStep]
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
      if (id === 'sheets') {
        return async () => {
          if (
            !publishContext ||
            publishContext.branch === 'All Branch' ||
            !publishContext.businessDate
          )
            throw new Error('Select one branch and one business date to publish.')
          await window.api.googleSync.sync({ branch: publishContext.branch })
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
    [cashierName, publishContext, selectedBranch, selectedReport.businessDate, telegramNote]
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
      if (!pdfPreview || isPdfProcessing || pdfPreview.note !== pdfNote) return
      setIsPdfProcessing(true)
      await runPdfStep(id, pdfOperation(id, pdfPreview))
      setIsPdfProcessing(false)
    },
    [isPdfProcessing, pdfNote, pdfOperation, pdfPreview, runPdfStep]
  )
  const exportExcel = React.useCallback(async (): Promise<void> => {
    if (!pdfPreview || !Object.keys(excelSheets).length || isExcelExporting) return
    setIsExcelExporting(true)
    setExcelExportMessage(undefined)
    try {
      const result = await window.api.pdfExport.saveExcel({
        workbookBase64: workbookBase64(excelSheets),
        fileName: pdfPreview.fileName.replace(/\.pdf$/i, '.xlsx')
      })
      if (!result.canceled) setExcelExportMessage('Excel workbook saved.')
    } catch {
      setExcelExportMessage('Excel could not be exported. Please try again.')
    } finally {
      setIsExcelExporting(false)
    }
  }, [excelSheets, isExcelExporting, pdfPreview])
  const refreshEntries = React.useCallback(async (): Promise<void> => {
    const requestVersion = ++entriesRequestVersionRef.current
    setIncomeLoadState((current) => ({ ...current, isLoading: true, error: undefined }))
    setPaymentLoadState((current) => ({ ...current, isLoading: true, error: undefined }))
    const [incomeResult, paymentResult] = await Promise.allSettled([
      window.api.dailyReports.listIncome({
        dailyReportId: reportId,
        status: showVoided ? undefined : 'POSTED'
      }),
      window.api.dailyReports.listPayments({
        dailyReportId: reportId,
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
  }, [reportId, showVoided])

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
          await voidExpenses(
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
    [bulkVoidRows, bulkVoidType, refreshEntries, voidExpenses, voidEntry, voidEntryType]
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
            const paymentMethodId =
              catalogOptions.find(
                (option) => option.kind === 'CASHIER_PAYMENT_TYPE' && option.value === type
              )?.referenceId ?? (type === formEntry.type ? formEntry.paymentMethodId : undefined)
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
            notify({ type: 'success', title: 'Payment updated.' })
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
          notify({
            type: 'success',
            title: formMode === 'duplicate' ? 'Payment duplicated.' : 'Payment saved.'
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
      updateExpense,
      notify
    ]
  )

  const tabRowCounts: Record<(typeof reportTabs)[number], number> = {
    Expenses: expenseQuery.totalRows,
    Income: incomes.length,
    Payment: payments.length,
    Activity: visibleHistoryCount
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
        'expenses-amount': formatAmountInput(String(formEntry.amount))
      } as Record<string, string>
    }
    if ('particular' in formEntry) {
      return {
        'income-date': duplicate ? format(new Date(), 'yyyy-MM-dd') : formEntry.date,
        'income-particular': formEntry.particular,
        'income-receipt-reference-no-': duplicate ? '' : formEntry.receiptRefNo,
        'income-remarks': formEntry.remarks,
        'income-amount': formatAmountInput(String(formEntry.amount))
      } as Record<string, string>
    }
    return {
      'payment-type': formEntry.type,
      'payment-bank-provider': formEntry.bankProvider,
      'payment-account-name': formEntry.accountName,
      'payment-reference-no-': duplicate ? '' : formEntry.referenceNo,
      'payment-date': duplicate ? format(new Date(), 'yyyy-MM-dd') : formEntry.date,
      'payment-amount': formatAmountInput(String(formEntry.amount))
    } as Record<string, string>
  }, [formEntry, formMode])

  React.useEffect(() => {
    if (!isEntryFormVisible) return
    const firstField = formFields[activeTab][0]
    const id = `${activeTab}-${firstField}`.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    document.getElementById(id)?.focus()
  }, [activeTab, isEntryFormVisible])

  if (selectedReportMissing) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-workspace">
        <CashierReportHeader error={dateError} />
        <main className="flex min-h-0 flex-1 items-center justify-center p-6">
          <div className="text-center">
            <h1 className="text-lg font-semibold">No report started</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              There is no daily report for this branch and date.
            </p>
          </div>
        </main>
      </div>
    )
  }

  const selectTab = (nextTab: (typeof reportTabs)[number]): void => {
    setHoveredTab(undefined)
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
  }

  return (
    <div
      className={
        isSummaryCompact
          ? 'flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden bg-workspace p-3'
          : 'grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(220px,252px)_minmax(0,1fr)] gap-4 overflow-hidden bg-workspace p-3'
      }
    >
      {!isSummaryCompact && (
        <div className="-my-3 -ml-3 flex min-h-0 min-w-0 flex-col bg-card">
          <ReportSummary
            key={reportId}
            refreshKey={summaryRefreshKey}
            reportId={reportId}
            businessDate={selectedReport.businessDate}
            branchId={selectedReport.branchId}
            cashierUserId={selectedReport.cashierUserId}
            dateRange={dateRange}
            isDateLoading={isDateLoading}
            onDateRangeChange={changeDateRange}
            expenseTotals={expenseQuery.expenseTotals}
            onOpenCollection={onOpenCollection}
            onOpenFinance={onOpenFinance}
            readOnly={isAdmin}
            onSnapshotChange={(snapshot) => {
              summarySnapshotRef.current = snapshot
            }}
          />
        </div>
      )}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-workspace">
        <div className="grid min-h-0 w-full min-w-0 flex-1 grid-cols-1">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <Tabs
              value={hoveredTab ?? activeTab}
              onValueChange={(value) => selectTab(value as (typeof reportTabs)[number])}
              className="flex min-h-0 flex-1 flex-col gap-0"
            >
              <div className="mx-4 flex shrink-0 items-center">
                <div className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <TabsList
                    aria-label="Cashier report sections"
                    variant="line"
                    onMouseLeave={() => setHoveredTab(undefined)}
                    className="mb-3.5 w-fit justify-start rounded-none bg-transparent pb-0"
                  >
                    {reportTabs.map((tab) => (
                      <TabsTrigger
                        key={tab}
                        value={tab}
                        onMouseEnter={() => setHoveredTab(tab)}
                        onClick={() => selectTab(tab)}
                        className="h-10 flex-none gap-2 rounded-none px-3.5 text-xs data-active:font-semibold data-active:text-foreground group-data-[variant=line]/tabs-list:data-active:after:bg-muted-foreground/60"
                      >
                        <span>{tab === 'Activity' ? 'Activity History' : tab}</span>
                        {tabRowCounts[tab] > 0 && (
                          <Badge
                            variant="secondary"
                            className="min-w-5 justify-center rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground group-data-[state=active]:bg-primary/10 group-data-[state=active]:text-primary"
                          >
                            {tabRowCounts[tab]}
                          </Badge>
                        )}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>
                <CashierReportHeader
                  error={dateError ?? exportError}
                  actions={
                    <div className="flex shrink-0 items-center gap-2">
                      <InstallmentAttentionPopover
                        summary={installmentAttention}
                        onViewOverdue={onViewOverdueInstallments}
                        onViewAll={onViewInstallmentAccounts}
                        onOpenAccount={onOpenInstallmentAccount}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          void reviewPdf(undefined, {
                            branch: selectedBranch,
                            dateFrom: selectedReport.businessDate,
                            dateTo: selectedReport.businessDate
                          })
                        }
                      >
                        <FileDown data-icon="inline-start" aria-hidden="true" />
                        <span className="hidden sm:inline">Review Report</span>
                        <span className="sm:hidden">Review</span>
                      </Button>
                      {!isAdmin && (
                        <Button type="button" size="sm" onClick={toggleEntryForm}>
                          <Plus data-icon="inline-start" aria-hidden="true" />
                          <span className="hidden sm:inline">
                            {isEntryFormVisible ? 'Hide Entry' : 'Add Entry'}
                          </span>
                          <span className="sm:hidden">{isEntryFormVisible ? 'Hide' : 'Add'}</span>
                        </Button>
                      )}
                    </div>
                  }
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
                      expenseTypes={activeExpenseTypes}
                      paymentTypes={activePaymentTypes}
                      expenseQuery={expenseQuery}
                      onVoidSelectedExpenses={isAdmin ? async () => false : deleteSelectedExpenses}
                      onView={openEntryView}
                      onVoid={isAdmin ? () => undefined : requestVoid}
                      onDuplicate={
                        isAdmin ? () => undefined : (row) => startEntryForm(row, 'duplicate')
                      }
                      isAdmin={isAdmin}
                      showVoided={showVoided}
                      onShowVoidedChange={setShowVoided}
                      selectedHistoryId={selectedHistory?.id}
                      onSelectHistory={openHistoryRecord}
                      onVoidSelected={deleteSelectedEntries}
                      onVoidSelectedHistory={async (rows, password) => {
                        const payments = rows.filter((row) =>
                          row.activity.toLowerCase().includes('payment')
                        )
                        const contracts = rows
                          .filter((row) => row.activity === 'Installment record added')
                          .map((row) => row.id.split(':', 1)[0])
                        if (payments.length) {
                          await window.api.installments.voidPayments({
                            paymentIds: payments.map((row) => row.id),
                            password
                          })
                        }
                        if (contracts.length) {
                          await window.api.installments.void({
                            contractIds: contracts,
                            password,
                            reason: 'Voided by administrator'
                          })
                        }
                        setHistoryRefreshKey((key) => key + 1)
                      }}
                      onEdit={(row) => startEntryForm(row, 'edit')}
                      incomeLoadState={incomeLoadState}
                      paymentLoadState={paymentLoadState}
                      onRetryEntries={() => void refreshEntries()}
                      historyRecords={historyRecords}
                      historyLoadState={historyLoadState}
                      onRetryHistory={() => setHistoryRefreshKey((key) => key + 1)}
                      onVisibleHistoryCountChange={setVisibleHistoryCount}
                    />
                  </TabsContent>
                ))}
              </div>
            </Tabs>
          </div>
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
                refreshKey={summaryRefreshKey}
                reportId={reportId}
                businessDate={selectedReport.businessDate}
                branchId={selectedReport.branchId}
                cashierUserId={selectedReport.cashierUserId}
                dateRange={dateRange}
                isDateLoading={isDateLoading}
                onDateRangeChange={changeDateRange}
                expenseTotals={expenseQuery.expenseTotals}
                onOpenCollection={onOpenCollection}
                onOpenFinance={onOpenFinance}
                readOnly={isAdmin}
                onSnapshotChange={(snapshot) => {
                  summarySnapshotRef.current = snapshot
                }}
              />
            </SheetContent>
          </Sheet>
        </>
      )}
      {!isHistoryTab && (
        <Drawer
          open={isEntryFormVisible}
          onOpenChange={(open) => {
            if (!isEntryFormSaving) setEntryFormOpen(open)
          }}
          swipeDirection="right"
        >
          <DrawerContent className="w-full sm:w-[28rem] sm:max-w-xl">
            <DrawerHeader>
              <DrawerTitle>
                {formMode === 'edit'
                  ? `Edit ${activeTab}`
                  : formMode === 'duplicate'
                    ? `Duplicate ${activeTab}`
                    : activeTab === 'Payment'
                      ? 'Add Payment'
                      : `${activeTab} Entry`}
              </DrawerTitle>
              <DrawerDescription>
                {activeTab === 'Payment'
                  ? 'Record a payment for this cashier report.'
                  : `Add a cashier report entry for ${activeTab.toLowerCase()}.`}
              </DrawerDescription>
            </DrawerHeader>
            <EntryFormPanel
              key={formSeed}
              tab={activeTab}
              onSave={(form) => {
                setIsEntryFormSaving(true)
                void saveEntry(activeTab, form).finally(() => setIsEntryFormSaving(false))
              }}
              onDirtyChange={(isDirty) => {
                setIsEntryFormDirty(isDirty)
                if (isDirty) setEntrySaveError(undefined)
              }}
              saveError={entrySaveError}
              expenseTypes={activeExpenseTypes}
              paymentTypes={activePaymentTypes}
              initialValues={initialFormValues}
              isEdit={formMode === 'edit'}
              isSaving={isEntryFormSaving}
            />
          </DrawerContent>
        </Drawer>
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
      <Dialog open={isExportReportsOpen} onOpenChange={setIsExportReportsOpen}>
        <DialogContent className="flex h-[min(88vh,720px)] w-[min(94vw,860px)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
          <DialogHeader className="border-b bg-muted/30 px-7 py-6 pr-12">
            <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
              Report builder
            </p>
            <DialogTitle className="text-2xl tracking-tight">Build a PDF export</DialogTitle>
            <DialogDescription>
              Choose the scope first, then add the report data you need.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto bg-background px-5 py-6 sm:px-7">
            <div className="mx-auto flex max-w-3xl flex-col gap-8">
              <FieldSet className="gap-5">
                <FieldLegend className="mb-0 flex items-start gap-3">
                  <span className="font-mono text-xs text-muted-foreground">01</span>
                  <span>
                    <span className="block font-medium">Set the report scope</span>
                    <span className="block text-sm font-normal text-muted-foreground">
                      This applies to every selected section.
                    </span>
                  </span>
                </FieldLegend>
                <FieldGroup className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>Starting date</FieldLabel>
                    <Popover>
                      <PopoverTrigger
                        render={
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full justify-between font-normal"
                          >
                            <span className="flex min-w-0 items-center gap-2 truncate">
                              <CalendarIcon aria-hidden="true" />
                              <span className="truncate">
                                {format(parseISO(exportStartDate), 'MMM d, yyyy')}
                              </span>
                            </span>
                            <ChevronRight
                              aria-hidden="true"
                              className="rotate-90 text-muted-foreground"
                            />
                          </Button>
                        }
                      />
                      <PopoverContent align="start" className="w-[min(92vw,360px)] p-4">
                        <DateSelector
                          value={{
                            period: 'day',
                            operator: 'is',
                            startDate: parseISO(exportStartDate),
                            endDate: parseISO(exportStartDate)
                          }}
                          onChange={(value) => {
                            if (value.startDate)
                              setExportStartDate(format(value.startDate, 'yyyy-MM-dd'))
                          }}
                          allowRange={false}
                          defaultFilterType="is"
                          showInput={false}
                          showTwoMonths={false}
                          className="w-full sm:max-w-none"
                        />
                      </PopoverContent>
                    </Popover>
                  </Field>
                  <Field>
                    <FieldLabel>Ending date</FieldLabel>
                    <Popover>
                      <PopoverTrigger
                        render={
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full justify-between font-normal"
                          >
                            <span className="flex min-w-0 items-center gap-2 truncate">
                              <CalendarIcon aria-hidden="true" />
                              <span className="truncate">
                                {format(parseISO(exportEndDate), 'MMM d, yyyy')}
                              </span>
                            </span>
                            <ChevronRight
                              aria-hidden="true"
                              className="rotate-90 text-muted-foreground"
                            />
                          </Button>
                        }
                      />
                      <PopoverContent align="start" className="w-[min(92vw,360px)] p-4">
                        <DateSelector
                          value={{
                            period: 'day',
                            operator: 'is',
                            startDate: parseISO(exportEndDate),
                            endDate: parseISO(exportEndDate)
                          }}
                          onChange={(value) => {
                            if (value.startDate)
                              setExportEndDate(format(value.startDate, 'yyyy-MM-dd'))
                          }}
                          allowRange={false}
                          defaultFilterType="is"
                          showInput={false}
                          showTwoMonths={false}
                          className="w-full sm:max-w-none"
                        />
                      </PopoverContent>
                    </Popover>
                  </Field>
                  <Field>
                    <FieldLabel>Branch</FieldLabel>
                    <Select
                      value={exportBranch}
                      onValueChange={(value) => setExportBranch(value as LoginBranch)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All Branch">All Branch</SelectItem>
                        <SelectItem value="Goa">Goa</SelectItem>
                        <SelectItem value="Tinambac">Tinambac</SelectItem>
                        <SelectItem value="Tigaon">Tigaon</SelectItem>
                        <SelectItem value="Lagonoy">Lagonoy</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel>Account type</FieldLabel>
                    <Select
                      value={exportType}
                      onValueChange={(value) => value && setExportType(value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All Types">All Types</SelectItem>
                        <SelectItem value="Home Credit">Home Credit</SelectItem>
                        <SelectItem value="Salmon">Salmon</SelectItem>
                        <SelectItem value="Skyro">Skyro</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </FieldGroup>
              </FieldSet>

              <FieldSet className="gap-5 border-t pt-7">
                <FieldLegend className="mb-0 flex items-start gap-3">
                  <span className="font-mono text-xs text-muted-foreground">02</span>
                  <span>
                    <span className="block font-medium">Choose report contents</span>
                    <span className="block text-sm font-normal text-muted-foreground">
                      Add only the sections you want to review.
                    </span>
                  </span>
                </FieldLegend>
                <div className="grid gap-6 sm:grid-cols-2">
                  <FieldSet className="gap-3">
                    <FieldLegend variant="label">Cashier report</FieldLegend>
                    <FieldDescription>Daily entries and activity.</FieldDescription>
                    <FieldGroup data-slot="checkbox-group" className="grid grid-cols-2 gap-2">
                      {(['Expenses', 'Income', 'Payment', 'Activity History'] as const).map(
                        (section) => {
                          const selected = exportSections.includes(section)
                          const id = `export-section-${section.toLowerCase().replaceAll(' ', '-')}`
                          return (
                            <Field
                              key={section}
                              orientation="horizontal"
                              className="items-center gap-2"
                            >
                              <Checkbox
                                id={id}
                                checked={selected}
                                onCheckedChange={(checked) =>
                                  setExportSections((current) =>
                                    checked
                                      ? [...current, section]
                                      : current.filter((item) => item !== section)
                                  )
                                }
                              />
                              <FieldLabel
                                htmlFor={id}
                                className="cursor-pointer text-sm font-normal"
                              >
                                {section}
                              </FieldLabel>
                            </Field>
                          )
                        }
                      )}
                    </FieldGroup>
                  </FieldSet>
                  <FieldSet className="gap-3">
                    <FieldLegend variant="label">Accounts</FieldLegend>
                    <FieldDescription>Account lists and finance data.</FieldDescription>
                    <FieldGroup data-slot="checkbox-group" className="grid grid-cols-2 gap-2">
                      {(['Records', 'Active', 'Closed', 'Blacklisted'] as const).map((section) => {
                        const selected = exportSections.includes(section)
                        const id = `export-section-${section.toLowerCase()}`
                        return (
                          <Field
                            key={section}
                            orientation="horizontal"
                            className="items-center gap-2"
                          >
                            <Checkbox
                              id={id}
                              checked={selected}
                              onCheckedChange={(checked) =>
                                setExportSections((current) =>
                                  checked
                                    ? [...current, section]
                                    : current.filter((item) => item !== section)
                                )
                              }
                            />
                            <FieldLabel htmlFor={id} className="cursor-pointer text-sm font-normal">
                              {section}
                            </FieldLabel>
                          </Field>
                        )
                      })}
                      <Field orientation="horizontal" className="items-center gap-2">
                        <Checkbox
                          id="export-section-finance"
                          checked={exportSections.includes('Accounts')}
                          onCheckedChange={(checked) =>
                            setExportSections((current) =>
                              checked
                                ? [...current, 'Accounts']
                                : current.filter((item) => item !== 'Accounts')
                            )
                          }
                        />
                        <FieldLabel
                          htmlFor="export-section-finance"
                          className="cursor-pointer text-sm font-normal"
                        >
                          Finance
                        </FieldLabel>
                      </Field>
                    </FieldGroup>
                  </FieldSet>
                </div>
              </FieldSet>
            </div>
          </div>
          <DialogFooter className="items-center border-t bg-muted/30 px-7 py-4">
            <div className="sm:mr-auto">
              <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
                03 — Review
              </p>
              <p className="text-xs text-muted-foreground">
                {exportSections.length
                  ? `${exportSections.length} section${exportSections.length === 1 ? '' : 's'} included`
                  : 'Choose at least one section'}
              </p>
            </div>
            <Button type="button" variant="outline" onClick={() => setIsExportReportsOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                !exportSections.length ||
                !exportStartDate ||
                !exportEndDate ||
                exportEndDate < exportStartDate ||
                isReviewingPdf
              }
              onClick={() => {
                setIsExportReportsOpen(false)
                void reviewPdf(exportSections, {
                  branch: exportBranch,
                  dateFrom: exportStartDate,
                  dateTo: exportEndDate,
                  accountType: exportType
                })
              }}
            >
              Review PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(pdfPreview) && isPdfReviewOpen}
        onOpenChange={(open) => {
          if (!open && !isPdfProcessing) {
            setIsPdfReviewOpen(false)
            setPdfPreview(undefined)
          }
        }}
      >
        <DialogContent className="h-[min(88vh,54rem)] w-[min(96vw,88rem)] max-w-none grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-none">
          <DialogHeader className="border-b bg-background px-6 py-4 pr-12 sm:px-7">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <FileDown className="size-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="truncate text-lg tracking-tight">Review Report</DialogTitle>
                <DialogDescription className="mt-0.5">
                  Check the PDF, then choose how to deliver it.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="grid min-h-0 grid-rows-[minmax(16rem,1fr)_minmax(21rem,auto)] lg:grid-cols-[minmax(0,7fr)_minmax(20rem,3fr)] lg:grid-rows-1">
            <section
              className="flex min-h-0 flex-col bg-muted/30 p-3 sm:p-4 lg:border-r"
              aria-label="PDF preview"
            >
              <div className="flex items-center justify-between px-1 pb-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                <span>PDF preview</span>
                <span>Final document</span>
              </div>
              {pdfPreview && (
                <iframe
                  title="Cashier report PDF preview"
                  src={`data:application/pdf;base64,${pdfPreview.pdfBase64}`}
                  className="min-h-0 flex-1 w-full rounded-md border border-border bg-background shadow-sm"
                />
              )}
            </section>
            <aside className="flex min-h-0 flex-col bg-card lg:border-l-0">
              <div className="shrink-0 border-b bg-muted/20 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold">Report details</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Add context before delivery.
                    </p>
                  </div>
                  <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Optional
                  </span>
                </div>
                <label
                  htmlFor="pdf-report-note"
                  className="mt-4 block text-xs font-medium text-muted-foreground"
                >
                  PDF note
                </label>
                <Textarea
                  id="pdf-report-note"
                  value={pdfNote}
                  onChange={(event) => setPdfNote(event.target.value)}
                  placeholder="Optional note at the end of this PDF"
                  maxLength={800}
                  rows={3}
                  disabled={isPdfProcessing || isReviewingPdf}
                  className="mt-2 min-h-20 resize-none text-sm"
                />
                {pdfPreview?.note !== pdfNote && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    disabled={isReviewingPdf}
                    onClick={() =>
                      pdfReviewRequest &&
                      void reviewPdf(pdfReviewRequest.sections, pdfReviewRequest.filters)
                    }
                  >
                    {isReviewingPdf ? <Spinner data-icon="inline-start" /> : null}
                    Update preview
                  </Button>
                )}
              </div>
              <div className="shrink-0 border-b px-4 py-4 sm:px-5">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Delivery progress</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Save a copy and send to Telegram.
                    </p>
                  </div>
                  <div className="flex items-end gap-2">
                    <span className="text-3xl font-semibold tracking-tight tabular-nums">
                      {Math.round(
                        (pdfProgress.filter(
                          (step) => step.status === 'done' || step.status === 'failed'
                        ).length /
                          pdfProgress.length) *
                          100
                      )}
                      %
                    </span>
                    <span className="pb-0.5 text-xs text-muted-foreground">
                      {pdfProgress.filter((step) => step.status === 'done').length} of{' '}
                      {pdfProgress.length} done
                    </span>
                  </div>
                </div>
                <Progress
                  className="mt-3"
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
              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Delivery checklist
                  </p>
                  <p className="text-xs text-muted-foreground">Print from preview</p>
                </div>
                {excelExportMessage && (
                  <p className="mb-3 text-xs text-primary" role="status">
                    {excelExportMessage}
                  </p>
                )}
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
                              Telegram note
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
                            disabled={pdfPreview.note !== pdfNote}
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
              <DialogFooter className="mx-0 mb-0 flex-wrap rounded-none border-t px-4 py-4 sm:px-5">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPdfProcessing || isExcelExporting}
                  onClick={() => void exportExcel()}
                >
                  {isExcelExporting ? <Spinner data-icon="inline-start" /> : null}
                  Export in Excel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPdfProcessing || isExcelExporting}
                  onClick={() => {
                    setIsPdfReviewOpen(false)
                    setPdfPreview(undefined)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={isPdfProcessing || pdfPreview?.note !== pdfNote}
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
