import * as React from 'react'
import { format, parse, parseISO } from 'date-fns'
import {
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  Bus,
  CarFront,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
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
import type { DateSelectorValue } from '@/../../components/reui/date-selector'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  isVisibleInstallmentHistoryRecord,
  type InstallmentHistoryRecord
} from '@/lib/installment-history'
import { cn } from '@/lib/utils'
import { formatAmountInput, formatPhilippinePeso } from '@/lib/currency'
import { useMediaQuery } from '@/hooks/use-mobile'
import { useNotifications } from '@/hooks/use-notifications'
import { ReportSummary } from '@/features/cashier-report/components/report-summary'
import { ReportsGenerator } from '@/features/cashier-report/components/reports-generator'
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
  type IncomeEntryRecord,
  type InstallmentAttentionSummary,
  type InstallmentHistoryRecord as PersistedInstallmentHistoryRecord,
  type LoginBranch
} from '@/../../shared/contracts'

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
    <Badge variant="secondary" className="h-5 px-1 text-xs leading-none" aria-label={name}>
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
    penaltyCentavos: record.penaltyCentavos,
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
            onPointerEnter={() => setOpen(true)}
            onClick={summary.overdueCount > 0 ? () => closeAnd(onViewOverdue) : undefined}
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
            <div className="mb-1 flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-widest">
              <span className="text-destructive">Overdue</span>
              <span className="text-muted-foreground">{summary.overdueCount} accounts</span>
            </div>
            {renderRows(summary.overdue)}
          </section>
        )}
        {summary.overdueCount > 0 && summary.nearDueCount > 0 && <Separator />}
        {summary.nearDueCount > 0 && (
          <section aria-label="Installments near due">
            <div className="mb-1 flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-widest">
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
          ) : (
            <span />
          )}
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
  return <TruncatedText value={label} className="text-sm text-muted-foreground" />
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
    cell: ({ getValue }) => <TruncatedText value={getValue<string>()} className="text-sm" />,
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
      className: 'px-4 text-right text-sm font-medium tabular-nums text-foreground'
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
    cell: ({ getValue }) => <TruncatedText value={getValue<string>()} className="text-sm" />,
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
      className: cn('w-30', 'text-right text-sm font-medium tabular-nums text-foreground')
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
    cell: ({ getValue }) => <TruncatedText value={getValue<string>()} className="text-sm" />,
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
    meta: { className: 'text-right text-sm font-medium tabular-nums text-foreground' }
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
  onShowVoidedChange,
  leadingToolbarContent,
  afterFiltersContent,
  trailingToolbarContent
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
  onVoidSelectedHistory: (rows: InstallmentHistoryRecord[], reason: string) => Promise<void>
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
  leadingToolbarContent?: React.ReactNode
  afterFiltersContent?: React.ReactNode
  trailingToolbarContent?: React.ReactNode
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
    (row: ExpenseRow) =>
      row.source === 'google-cache'
        ? expenseRowActions(row, onView, onVoid, onEdit, onDuplicate)
        : [],
    [onDuplicate, onEdit, onView, onVoid]
  )
  const getAdminIncomeActions = React.useCallback(
    (row: IncomeRow) =>
      row.source === 'google-cache'
        ? incomeRowActions(row, onView, onVoid, onEdit, onDuplicate)
        : [],
    [onDuplicate, onEdit, onView, onVoid]
  )
  const getAdminPaymentActions = React.useCallback(
    (row: PaymentRow) =>
      row.source === 'google-cache'
        ? paymentRowActions(row, onView, onVoid, onEdit, onDuplicate)
        : [],
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
          leadingToolbarContent={leadingToolbarContent}
          afterFiltersContent={afterFiltersContent}
          trailingToolbarContent={trailingToolbarContent}
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
          leadingToolbarContent={leadingToolbarContent}
          afterFiltersContent={afterFiltersContent}
          trailingToolbarContent={trailingToolbarContent}
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
          leadingToolbarContent={leadingToolbarContent}
          afterFiltersContent={afterFiltersContent}
          trailingToolbarContent={trailingToolbarContent}
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
            dateFrom={dateFrom}
            dateTo={dateTo}
            leadingToolbarContent={leadingToolbarContent}
            afterFiltersContent={afterFiltersContent}
            trailingToolbarContent={trailingToolbarContent}
            onVisibleRecordCountChange={onVisibleHistoryCountChange}
            selectedId={selectedHistoryId}
            onSelect={onSelectHistory}
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
  reportPage = false,
  selectedBranch = 'All Branch',
  cashierName = 'Cashier',
  isAdmin = false,
  initialTab = 'Expenses',
  selectedBusinessDate,
  onSelectedBusinessDateChange,
  attentionReportId,
  onAttentionReportOpened,
  onAttentionReportLoaded,
  openAttentionDateDialog,
  onAttentionDateDialogOpenChange,
  onOpenCollection,
  onOpenHistoryPayment,
  onOpenFinance,
  installmentAttention,
  onViewOverdueInstallments,
  onViewInstallmentAccounts,
  onOpenInstallmentAccount
}: {
  reportPage?: boolean
  selectedBranch?: LoginBranch
  cashierName?: string
  isAdmin?: boolean
  initialTab?: (typeof reportTabs)[number]
  selectedBusinessDate?: string
  onSelectedBusinessDateChange?: (businessDate: string) => void
  attentionReportId?: string
  onAttentionReportOpened?: () => void
  onAttentionReportLoaded?: () => void
  openAttentionDateDialog?: boolean
  onAttentionDateDialogOpenChange?: (open: boolean) => void
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
  const summarySnapshotRef = React.useRef<DailyReportSnapshotResponse | undefined>(undefined)
  const [reportSearch, setReportSearch] = React.useState('')
  const [dateRange, setDateRange] = React.useState<DateSelectorValue>(() => {
    const initialDate = parseISO(selectedBusinessDate ?? activeReport.businessDate)
    return { period: 'day', operator: 'is', startDate: initialDate, endDate: initialDate }
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
        setHistoryRecords(
          records.filter(isVisibleInstallmentHistoryRecord).map(installmentHistoryRow)
        )
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
  React.useEffect(() => {
    if (!selectedBusinessDate || selectedBusinessDate === selectedReport.businessDate) return
    void changeBusinessDate(parseISO(selectedBusinessDate))
  }, [changeBusinessDate, selectedBusinessDate, selectedReport.businessDate])
  React.useEffect(() => {
    if (!attentionReportId) return
    let active = true
    void window.api.dailyReports
      .getSnapshot({ dailyReportId: attentionReportId })
      .then((snapshot) => {
        if (!active) return
        setSelectedReport({ ...snapshot.report, reportId: snapshot.report.id })
        setSelectedReportMissing(false)
        const date = parseISO(snapshot.report.businessDate)
        setDateRange({ period: 'day', operator: 'is', startDate: date, endDate: date })
        onSelectedBusinessDateChange?.(snapshot.report.businessDate)
        onAttentionReportLoaded?.()
      })
      .catch(() => {
        if (active) setDateError('That report date could not be loaded.')
      })
      .finally(() => {
        if (active) onAttentionReportOpened?.()
      })
    return () => {
      active = false
    }
  }, [
    attentionReportId,
    onAttentionReportLoaded,
    onAttentionReportOpened,
    onSelectedBusinessDateChange
  ])

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
      onSelectedBusinessDateChange?.(format(value.startDate, 'yyyy-MM-dd'))
      void changeBusinessDate(value.startDate)
    },
    [changeBusinessDate, onSelectedBusinessDateChange]
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

  if (reportPage) {
    return (
      <ReportsGenerator
        reportPage
        selectedBranch={selectedBranch}
        cashierName={cashierName}
        reportId={reportId}
        businessDate={selectedReport.businessDate}
        summarySnapshotRef={summarySnapshotRef}
      />
    )
  }

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
  const tabToolbarContent = (
    <div className="min-w-0 max-w-full overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden">
      <TabsList aria-label="Cashier report sections" className="h-8 w-fit justify-start bg-muted">
        {reportTabs.map((tab) => (
          <TabsTrigger
            key={tab}
            value={tab}
            className="flex-none gap-1.5 px-3 text-sm"
            onClick={() => selectTab(tab)}
          >
            <span>{tab === 'Activity' ? 'Activity History' : tab}</span>
            {tabRowCounts[tab] > 0 && (
              <Badge
                variant="secondary"
                className="size-5 shrink-0 justify-center rounded-full bg-muted p-0 text-xs tabular-nums text-muted-foreground group-data-[state=active]:bg-primary/10 group-data-[state=active]:text-primary"
              >
                {tabRowCounts[tab]}
              </Badge>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
    </div>
  )

  return (
    <div
      className={
        isSummaryCompact
          ? 'flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden p-4'
          : 'grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(220px,252px)_minmax(0,1fr)] gap-5 overflow-hidden bg-workspace p-4'
      }
    >
      {!isSummaryCompact && (
        <div className="-my-3 -ml-4 flex min-h-0 min-w-76 flex-col bg-card">
          <ReportSummary
            key={reportId}
            refreshKey={summaryRefreshKey}
            reportId={reportId}
            businessDate={selectedReport.businessDate}
            branchId={selectedReport.branchId}
            cashierUserId={selectedReport.cashierUserId}
            dateRange={dateRange}
            dateDialogOpen={openAttentionDateDialog}
            onDateDialogOpenChange={onAttentionDateDialogOpenChange}
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
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="grid min-h-0 w-full min-w-0 flex-1 grid-cols-1">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <Tabs
              value={activeTab}
              onValueChange={(value) => selectTab(value as (typeof reportTabs)[number])}
              className="flex min-h-0 flex-1 flex-col gap-0"
            >
              <div className="flex min-h-0 flex-1 flex-col overflow-visible">
                {reportTabs.map((tab) => (
                  <TabsContent
                    key={tab}
                    value={tab}
                    className="flex min-h-0 flex-1 flex-col overflow-visible"
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
                      leadingToolbarContent={tabToolbarContent}
                      afterFiltersContent={
                        <InstallmentAttentionPopover
                          summary={installmentAttention}
                          onViewOverdue={onViewOverdueInstallments}
                          onViewAll={onViewInstallmentAccounts}
                          onOpenAccount={onOpenInstallmentAccount}
                        />
                      }
                      trailingToolbarContent={
                        <>
                          {dateError && (
                            <span
                              className="max-w-48 truncate text-xs text-destructive"
                              role="alert"
                            >
                              {dateError}
                            </span>
                          )}
                          {!isAdmin && (
                            <Button type="button" size="sm" onClick={toggleEntryForm}>
                              <Plus data-icon="inline-start" aria-hidden="true" />
                              <span className="hidden sm:inline">
                                {isEntryFormVisible ? 'Hide Entry' : 'Add Entry'}
                              </span>
                              <span className="sm:hidden">
                                {isEntryFormVisible ? 'Hide' : 'Add'}
                              </span>
                            </Button>
                          )}
                        </>
                      }
                      selectedHistoryId={selectedHistory?.id}
                      onSelectHistory={openHistoryRecord}
                      onVoidSelected={deleteSelectedEntries}
                      onVoidSelectedHistory={async (rows, reason) => {
                        const payments = rows.filter((row) =>
                          row.activity.toLowerCase().includes('payment')
                        )
                        const contracts = rows
                          .filter((row) => row.activity === 'Installment record added')
                          .map((row) => row.id.split(':', 1)[0])
                        if (payments.length) {
                          await window.api.installments.voidPayments({
                            paymentIds: payments.map((row) => row.id),
                            reason
                          })
                        }
                        if (contracts.length) {
                          await window.api.installments.void({
                            contractIds: contracts,
                            reason
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
                dateDialogOpen={openAttentionDateDialog}
                onDateDialogOpenChange={onAttentionDateDialogOpenChange}
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
      <ReportsGenerator
        reportPage={false}
        selectedBranch={selectedBranch}
        cashierName={cashierName}
        reportId={reportId}
        businessDate={selectedReport.businessDate}
        summarySnapshotRef={summarySnapshotRef}
      />
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
