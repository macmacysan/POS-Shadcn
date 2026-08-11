import * as React from 'react'
import { format } from 'date-fns'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle
} from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useActiveReport } from '@/contexts/active-report-context'
import { cn } from '@/lib/utils'
import { formatCentavos } from '@/lib/currency'
import type { DailyReportSnapshotResponse, ExpenseSummaryTotals } from '@/../../shared/contracts'

type OpenDialog = 'cash-count' | 'deductions' | null
type Snapshot = DailyReportSnapshotResponse

const deductionDefinitions = [
  { id: 'deduction-type-sss-er', label: 'SSS ER (EMPLOYER CONT.)' },
  { id: 'deduction-type-sss-ee', label: "SSS EC (EMPLOYEES' CONT.)" },
  { id: 'deduction-type-sss-ee-loan', label: 'SSS EC/LOAN DEDUCTIONS' },
  { id: 'deduction-type-pagibig-er', label: 'PAG-IBIG ER' },
  { id: 'deduction-type-pagibig-ee', label: 'PAG-IBIG EC' },
  { id: 'deduction-type-pagibig-ee-loan', label: 'PAG-IBIG EC/LOAN DEDUCTIONS' },
  { id: 'deduction-type-philhealth-er', label: 'PHILHEALTH ER' },
  { id: 'deduction-type-philhealth-ee', label: 'PHILHEALTH EC' }
] as const

const receiptTypesExcludedFromPicker = new Set(['CASH SALES', 'COLLECTIONS'])
const paymentMethodIds = {
  bankCheck: 'report-payment-method-check',
  bankTransfer: 'report-payment-method-bank-transfer',
  gcash: 'report-payment-method-gcash',
  otherEwallet: 'report-payment-method-other-ewallet'
} as const
const RECEIPT_VISIBILITY_STORAGE_KEY = 'cashiers-report-visible-receipt-types'
const defaultReceiptTypeNames = new Set([
  'SALES INVOICE',
  'SALES INVOICE - TRADING',
  'DELIVERY RECEIPT',
  'BOBS PAWNSHOP',
  'SI',
  'SI TRADING',
  'SI-T',
  'DR',
  'BP'
])

function receiptTypeSummaryName(name: string, shortName?: string, isSystem = false): string {
  if (!isSystem && shortName?.trim()) return shortName.trim().slice(0, 7)
  switch (name.trim().toUpperCase()) {
    case 'SALES INVOICE':
    case 'SI':
      return 'SI'
    case 'SALES INVOICE - TRADING':
    case 'SI TRADING':
    case 'SI-T':
      return 'SI-T'
    case 'DELIVERY RECEIPT':
    case 'DR':
      return 'DR'
    case 'BOBS PAWNSHOP':
    case 'BP':
      return 'BP'
    default:
      return isSystem ? name : name.trim().slice(0, 7)
  }
}

const money = formatCentavos

function readReceiptVisibility(): Set<string> | undefined {
  try {
    const stored = localStorage.getItem(RECEIPT_VISIBILITY_STORAGE_KEY)
    if (!stored) return undefined
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed) || !parsed.every((value) => typeof value === 'string')) {
      return undefined
    }
    return new Set(parsed)
  } catch {
    return undefined
  }
}

function writeReceiptVisibility(ids: Set<string>): void {
  localStorage.setItem(RECEIPT_VISIBILITY_STORAGE_KEY, JSON.stringify([...ids]))
}

function amountToCentavos(value: string): number {
  const normalized = value.trim()
  if (!/^\d*(?:\.\d{0,2})?$/.test(normalized) || !normalized) return 0
  return Math.round(Number(normalized) * 100)
}

function AmountInput({
  label,
  value,
  onChange,
  className,
  inputClassName,
  invalid = false
}: {
  label: string
  value: number
  onChange: (value: number) => void
  className?: string
  inputClassName?: string
  invalid?: boolean
}): React.JSX.Element {
  const [text, setText] = React.useState(() => (value ? String(value / 100) : ''))
  const [isFocused, setIsFocused] = React.useState(false)

  React.useEffect(() => {
    if (!isFocused) setText(value ? String(value / 100) : '')
  }, [isFocused, value])

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <span className="text-xs text-muted-foreground">₱</span>
      <Input
        aria-label={label}
        aria-invalid={invalid}
        className={cn('h-7 text-right tabular-nums', inputClassName)}
        inputMode="decimal"
        value={text}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onChange={(event) => {
          const next = event.target.value
          setText(next)
          onChange(amountToCentavos(next))
        }}
      />
    </div>
  )
}

function Section({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="border-b border-border/60 py-1.5 last:border-b-0">
      <p className="mb-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-col gap-0.5">{children}</div>
    </section>
  )
}

function SummaryRow({
  label,
  value,
  emphasis = false,
  className,
  hoverDetails,
  hideWhenZero = false
}: {
  label: string
  value: number
  emphasis?: boolean
  className?: string
  hoverDetails?: React.ReactNode
  hideWhenZero?: boolean
}): React.JSX.Element | null {
  if (hideWhenZero && value === 0) return null

  const row = (
    <div className={cn('flex min-h-7 items-center justify-between gap-3 text-xs', className)}>
      <span
        className={cn(
          'min-w-0 truncate text-muted-foreground',
          emphasis && 'font-medium text-foreground'
        )}
      >
        {label}
      </span>
      <span className={cn('shrink-0 tabular-nums', emphasis && 'font-semibold text-foreground')}>
        {money(value)}
      </span>
    </div>
  )

  if (!hoverDetails) return row

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={<div className="cursor-default" tabIndex={0} aria-label={`${label} details`} />}
        >
          {row}
        </TooltipTrigger>
        <TooltipContent className="max-w-72 dark">{hoverDetails}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function loadingSummary(): React.JSX.Element {
  return (
    <aside className="flex min-h-0 flex-1 flex-col gap-3 p-1.5">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-36 w-full" />
      <Skeleton className="h-24 w-full" />
    </aside>
  )
}

function receiptTotal(snapshot: Snapshot, receiptTypeId: string) {
  return snapshot.receiptTotals.find((item) => item.receiptTypeId === receiptTypeId)
}

function deduction(snapshot: Snapshot, deductionTypeId: string) {
  return snapshot.deductions.find((item) => item.deductionTypeId === deductionTypeId)
}

function cashCount(snapshot: Snapshot, denominationId: string) {
  return snapshot.cashCounts.find((item) => item.denominationId === denominationId)
}

function updateReceipt(
  snapshot: Snapshot,
  receiptTypeId: string,
  patch: Partial<{ quantity: number; amountCentavos: number }>
): Snapshot {
  const existing = receiptTotal(snapshot, receiptTypeId)
  const type = snapshot.receiptTypes.find((item) => item.id === receiptTypeId)
  const now = snapshot.report.updatedAt
  const next = {
    id: existing?.id ?? `draft-receipt-${receiptTypeId}`,
    dailyReportId: snapshot.report.id,
    receiptTypeId,
    receiptName: existing?.receiptName ?? type?.name ?? 'Receipt',
    receiptShortName: existing?.receiptShortName ?? type?.shortName ?? 'Receipt',
    quantity: patch.quantity ?? existing?.quantity ?? 0,
    amountCentavos: patch.amountCentavos ?? existing?.amountCentavos ?? 0,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  }
  return {
    ...snapshot,
    receiptTotals: existing
      ? snapshot.receiptTotals.map((item) => (item.receiptTypeId === receiptTypeId ? next : item))
      : [...snapshot.receiptTotals, next]
  }
}

function updateDeduction(
  snapshot: Snapshot,
  deductionTypeId: string,
  amountCentavos: number
): Snapshot {
  const existing = deduction(snapshot, deductionTypeId)
  const now = snapshot.report.updatedAt
  const next = {
    id: existing?.id ?? `draft-deduction-${deductionTypeId}`,
    dailyReportId: snapshot.report.id,
    deductionTypeId,
    amountCentavos,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  }
  return {
    ...snapshot,
    deductions: existing
      ? snapshot.deductions.map((item) => (item.deductionTypeId === deductionTypeId ? next : item))
      : [...snapshot.deductions, next]
  }
}

function updateCashCount(snapshot: Snapshot, denominationId: string, quantity: number): Snapshot {
  const existing = cashCount(snapshot, denominationId)
  const now = snapshot.report.updatedAt
  const next = {
    id: existing?.id ?? `draft-cash-count-${denominationId}`,
    dailyReportId: snapshot.report.id,
    denominationId,
    quantity,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  }
  return {
    ...snapshot,
    cashCounts: existing
      ? snapshot.cashCounts.map((item) => (item.denominationId === denominationId ? next : item))
      : [...snapshot.cashCounts, next]
  }
}

function summaryRequest(snapshot: Snapshot) {
  return {
    dailyReportId: snapshot.report.id,
    openingCashCentavos: snapshot.report.openingCashCentavos,
    cashRemittedCentavos: snapshot.report.cashRemittedCentavos,
    receiptTotals: snapshot.receiptTotals.map((item) => ({
      receiptTypeId: item.receiptTypeId,
      quantity: item.quantity,
      amountCentavos: item.amountCentavos
    })),
    deductions: snapshot.deductions.map((item) => ({
      deductionTypeId: item.deductionTypeId,
      amountCentavos: item.amountCentavos
    })),
    cashCounts: snapshot.cashCounts.map((item) => ({
      denominationId: item.denominationId,
      quantity: item.quantity
    }))
  }
}

export const ReportSummary = React.memo(function ReportSummary({
  alwaysDark = true,
  refreshKey,
  reportId: reportIdOverride,
  businessDate,
  expenseTotals
}: {
  alwaysDark?: boolean
  refreshKey?: string
  reportId?: string
  businessDate?: string
  expenseTotals: ExpenseSummaryTotals
}): React.JSX.Element {
  const { reportId: activeReportId, businessDate: activeBusinessDate } = useActiveReport()
  const reportId = reportIdOverride ?? activeReportId
  const reportBusinessDate = businessDate ?? activeBusinessDate
  const isToday = reportBusinessDate === format(new Date(), 'yyyy-MM-dd')
  const [snapshot, setSnapshot] = React.useState<Snapshot>()
  const [error, setError] = React.useState<string>()
  const [openDialog, setOpenDialog] = React.useState<OpenDialog>(null)
  const [isReceiptPickerOpen, setIsReceiptPickerOpen] = React.useState(false)
  const [visibleReceiptTypeIds, setVisibleReceiptTypeIds] = React.useState<Set<string>>(new Set())
  const [draftDeductions, setDraftDeductions] = React.useState<Record<string, number>>({})
  const [isSaving, setIsSaving] = React.useState(false)
  const [hasSaved, setHasSaved] = React.useState(false)
  const [saveError, setSaveError] = React.useState<string>()
  const snapshotRef = React.useRef<Snapshot | undefined>(undefined)
  const savingRef = React.useRef(false)
  const pendingRef = React.useRef(false)
  const snapshotVersionRef = React.useRef(0)

  const load = React.useCallback(async (): Promise<void> => {
    if (pendingRef.current || savingRef.current) return
    const snapshotVersion = ++snapshotVersionRef.current
    setError(undefined)
    try {
      const next = await window.api.dailyReports.getSnapshot({ dailyReportId: reportId })
      if (snapshotVersion !== snapshotVersionRef.current) return
      snapshotRef.current = next
      setSnapshot(next)
      const availableIds = new Set([
        ...next.receiptTypes.map((type) => type.id),
        ...next.receiptTotals.map((item) => item.receiptTypeId)
      ])
      const storedIds = readReceiptVisibility()
      setVisibleReceiptTypeIds(
        !isToday
          ? new Set(next.receiptTotals.map((item) => item.receiptTypeId))
          : storedIds
            ? new Set([...storedIds].filter((id) => availableIds.has(id)))
            : new Set(
                next.receiptTypes.filter((type) => type.isDefaultVisible).map((type) => type.id)
              )
      )
      setHasSaved(false)
      setSaveError(undefined)
    } catch {
      if (snapshotVersion !== snapshotVersionRef.current) return
      setError('The report summary could not be loaded.')
    }
  }, [isToday, reportId])

  React.useEffect(() => {
    void load()
  }, [load, refreshKey])

  const flush = React.useCallback(async (): Promise<void> => {
    if (savingRef.current) return
    savingRef.current = true
    setIsSaving(true)
    try {
      while (pendingRef.current && snapshotRef.current) {
        pendingRef.current = false
        const saved = await window.api.dailyReports.updateSummary(
          summaryRequest(snapshotRef.current)
        )
        if (!pendingRef.current) {
          snapshotVersionRef.current += 1
          snapshotRef.current = saved
          setSnapshot(saved)
          setHasSaved(true)
        }
      }
    } catch {
      pendingRef.current = true
      setSaveError('Changes could not be saved. Review the values and try again.')
    } finally {
      savingRef.current = false
      setIsSaving(false)
    }
  }, [])

  const save = React.useCallback(
    (next: Snapshot): void => {
      snapshotVersionRef.current += 1
      snapshotRef.current = next
      setSnapshot(next)
      setHasSaved(false)
      setSaveError(undefined)
      pendingRef.current = true
      void flush()
    },
    [flush]
  )

  if (!snapshot && !error) return loadingSummary()
  if (!snapshot) {
    return (
      <aside
        className={cn('flex min-h-0 flex-1 flex-col p-1.5', alwaysDark && 'dark sidebar-always-dark')}
      >
        <Empty className="m-auto border-0">
          <EmptyHeader>
            <EmptyTitle>Summary unavailable</EmptyTitle>
            <EmptyDescription>{error}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
              Retry
            </Button>
          </EmptyContent>
        </Empty>
      </aside>
    )
  }

  const deductionCentavos = snapshot.deductions.reduce(
    (total, item) => total + item.amountCentavos,
    0
  )
  const populatedDeductions = deductionDefinitions
    .map(({ id, label }) => ({
      label,
      amountCentavos: deduction(snapshot, id)?.amountCentavos ?? 0
    }))
    .filter(({ amountCentavos }) => amountCentavos > 0)
  const populatedCashDenominations = snapshot.cashDenominations
    .map((denomination) => ({
      ...denomination,
      quantity: cashCount(snapshot, denomination.id)?.quantity ?? 0
    }))
    .filter(({ quantity }) => quantity > 0)
    .sort((a, b) => b.valueCentavos - a.valueCentavos)
  const cashOutEntriesCentavos = snapshot.cashOutEntries
    .filter((item) => item.status === 'POSTED')
    .reduce((total, item) => total + item.amountCentavos, 0)
  const cashOutCentavos = snapshot.legacyExpenseCashOutCentavos + cashOutEntriesCentavos
  const paymentTotals = snapshot.paymentEntries
    .filter((item) => item.status === 'POSTED')
    .reduce(
      (totals, item) => {
        if (item.paymentMethodId === paymentMethodIds.bankCheck)
          totals.bankCheck += item.amountCentavos
        else if (item.paymentMethodId === paymentMethodIds.bankTransfer)
          totals.bankTransfer += item.amountCentavos
        else if (item.paymentMethodId === paymentMethodIds.gcash)
          totals.gcash += item.amountCentavos
        else totals.otherEwallet += item.amountCentavos
        totals.total += item.amountCentavos
        return totals
      },
      { bankCheck: 0, bankTransfer: 0, gcash: 0, otherEwallet: 0, total: 0 }
    )
  const totalReceiptsCentavos =
    snapshot.receiptTotals.reduce((total, item) => total + item.amountCentavos, 0) -
    snapshot.financeBalanceCentavos +
    snapshot.cashCollectionsCentavos +
    snapshot.otherIncomeCentavos +
    snapshot.financeDownCentavos
  const hasReceiptSummary = [
    snapshot.cashCollectionsCentavos,
    snapshot.otherIncomeCentavos,
    snapshot.financeDownCentavos,
    snapshot.financeBalanceCentavos,
    totalReceiptsCentavos
  ].some(Boolean)
  const hasCashOutSummary = [
    expenseTotals.companyExpensesCentavos,
    expenseTotals.drawingsCentavos,
    expenseTotals.purchasesCentavos,
    expenseTotals.receivablesCentavos,
    deductionCentavos,
    cashOutCentavos,
    paymentTotals.total
  ].some(Boolean)
  const variance = snapshot.cashVarianceCentavos
  const receiptTypesByReport = [
    ...snapshot.receiptTypes.map((type) => {
      const total = receiptTotal(snapshot, type.id)
      return total ? { ...type, name: total.receiptName, shortName: total.receiptShortName } : type
    }),
    ...snapshot.receiptTotals
      .filter((total) => !snapshot.receiptTypes.some((type) => type.id === total.receiptTypeId))
      .map((total, index) => ({
        id: total.receiptTypeId,
        name: total.receiptName,
        shortName: total.receiptShortName,
        sortOrder: Number.MAX_SAFE_INTEGER + index,
        isDefaultVisible: false,
        isSystem: false,
        isActive: false
      }))
  ]
  const visibleReceiptTypes = receiptTypesByReport.filter(
    (type) =>
      visibleReceiptTypeIds.has(type.id) &&
      !receiptTypesExcludedFromPicker.has(type.name.trim().toUpperCase())
  )
  const selectableReceiptTypes = snapshot.receiptTypes.filter(
    (type) => !receiptTypesExcludedFromPicker.has(type.name.trim().toUpperCase())
  )
  const standardReceiptTypes = selectableReceiptTypes.filter((type) =>
    defaultReceiptTypeNames.has(type.name.trim().toUpperCase())
  )
  const customReceiptTypes = selectableReceiptTypes.filter(
    (type) => !defaultReceiptTypeNames.has(type.name.trim().toUpperCase())
  )

  const toggleReceiptType = (receiptTypeId: string, checked: boolean): void => {
    setVisibleReceiptTypeIds((current) => {
      const next = new Set(current)
      if (checked) next.add(receiptTypeId)
      else next.delete(receiptTypeId)
      writeReceiptVisibility(next)
      return next
    })
  }

  const openDeductions = (): void => {
    setIsReceiptPickerOpen(false)
    setDraftDeductions(
      Object.fromEntries(
        deductionDefinitions.map(({ id }) => [id, deduction(snapshot, id)?.amountCentavos ?? 0])
      )
    )
    setOpenDialog('deductions')
  }

  const addDeductions = (): void => {
    let next = snapshot
    for (const { id } of deductionDefinitions) {
      next = updateDeduction(next, id, draftDeductions[id] ?? 0)
    }
    save(next)
    setOpenDialog(null)
  }

  return (
    <>
      <aside
        className={cn(
          'flex min-h-0 flex-1 flex-col overflow-hidden bg-sidebar text-sidebar-foreground',
          alwaysDark && 'dark sidebar-always-dark'
        )}
      >
        <header className="mt-2 flex shrink-0 items-center justify-between border-b border-sidebar-border bg-sidebar px-3 py-1.5">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold tracking-tight">
              {isToday
                ? 'Today’s Summary'
                : `${format(new Date(`${reportBusinessDate}T00:00:00`), 'MMM d')} Summary`}
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            <Popover open={isReceiptPickerOpen} onOpenChange={setIsReceiptPickerOpen}>
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Add receipt type or deductions"
                  />
                }
              >
                <Plus />
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64">
                <p className="text-xs font-medium">Show receipt types</p>
                <p className="text-[10px] text-muted-foreground">
                  Select the receipt types needed in this summary.
                </p>
                <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
                  {[...standardReceiptTypes, ...customReceiptTypes].map((type) => (
                    <div
                      key={type.id}
                      className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-xs hover:bg-muted"
                    >
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                        <Checkbox
                          checked={visibleReceiptTypeIds.has(type.id)}
                          onCheckedChange={(checked) =>
                            toggleReceiptType(type.id, checked === true)
                          }
                          aria-label={`Show ${type.name}`}
                        />
                        <span className="min-w-0 truncate">{type.name}</span>
                      </label>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  className="mt-1 w-full"
                  onClick={openDeductions}
                >
                  Deductions
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  className="mt-1 w-full"
                  onClick={() => {
                    setIsReceiptPickerOpen(false)
                    setOpenDialog('cash-count')
                  }}
                >
                  Counted Cash
                </Button>
              </PopoverContent>
            </Popover>
            <span className="text-[10px] text-muted-foreground" aria-live="polite">
              {isSaving ? 'Saving…' : saveError ? 'Save failed' : hasSaved ? 'Saved' : ''}
            </span>
          </div>
        </header>

        {error && (
          <div className="flex items-center justify-between gap-2 border-b border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <span>{error}</span>
            <Button type="button" variant="outline" size="xs" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        )}
        {saveError && (
          <div
            role="alert"
            className="flex items-center justify-between gap-2 border-b border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
          >
            <span>{saveError}</span>
            <Button type="button" variant="outline" size="xs" onClick={() => void flush()}>
              Retry save
            </Button>
          </div>
        )}

        <ScrollArea className="min-h-0 flex-1">
          <div className="px-3 pb-1.5">
            {visibleReceiptTypes.length > 0 && (
              <Section label="">
                <div className="grid grid-cols-[minmax(0,1fr)_3.5rem_6rem] gap-2 px-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <span>Type</span>
                  <span className="text-right">Qty</span>
                  <span className="text-right">Amount</span>
                </div>
                {visibleReceiptTypes.map((type) => {
                  const value = receiptTotal(snapshot, type.id)
                  const hasQuantity = (value?.quantity ?? 0) > 0
                  const hasAmount = (value?.amountCentavos ?? 0) > 0
                  return (
                    <div
                      key={type.id}
                      className="grid grid-cols-[minmax(0,1fr)_3.5rem_6rem] items-center gap-2 text-xs"
                    >
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger
                            render={<span className="min-w-0 truncate text-muted-foreground" />}
                          >
                            {receiptTypeSummaryName(type.name, type.shortName, type.isSystem)}
                            {!isToday && ` · ${type.isActive ? 'Frozen' : 'Archived'}`}
                          </TooltipTrigger>
                          <TooltipContent className="max-w-72">{type.name}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Input
                        aria-label={`${type.name} quantity`}
                        aria-invalid={hasAmount && !hasQuantity}
                        className={cn(
                          'h-7 px-1.5 text-right tabular-nums',
                          hasAmount &&
                            !hasQuantity &&
                            'border-destructive focus-visible:ring-destructive/40'
                        )}
                        inputMode="numeric"
                        value={value?.quantity || ''}
                        onChange={(event) =>
                          save(
                            updateReceipt(snapshot, type.id, {
                              quantity: Math.max(0, Math.floor(Number(event.target.value) || 0))
                            })
                          )
                        }
                      />
                      <AmountInput
                        label={`${type.name} amount`}
                        value={value?.amountCentavos ?? 0}
                        invalid={hasQuantity && !hasAmount}
                        inputClassName={cn(
                          hasQuantity &&
                            !hasAmount &&
                            'border-destructive focus-visible:ring-destructive/40'
                        )}
                        onChange={(amountCentavos) =>
                          save(updateReceipt(snapshot, type.id, { amountCentavos }))
                        }
                      />
                    </div>
                  )
                })}
              </Section>
            )}
            {hasReceiptSummary && (
              <Section label="">
                <SummaryRow
                  label="Collections"
                  value={snapshot.cashCollectionsCentavos ?? 0}
                  hideWhenZero
                />
                <SummaryRow label="Other" value={snapshot.otherIncomeCentavos ?? 0} hideWhenZero />
                <SummaryRow
                  label="Finance Down"
                  value={snapshot.financeDownCentavos ?? 0}
                  hideWhenZero
                />
                <SummaryRow
                  label="Finance Bal"
                  value={snapshot.financeBalanceCentavos ?? 0}
                  hideWhenZero
                />
                <SummaryRow
                  label="Total Receipts"
                  value={totalReceiptsCentavos}
                  emphasis
                  hideWhenZero
                />
              </Section>
            )}
            {hasCashOutSummary && (
              <Section label="">
                <SummaryRow
                  label="Company Expenses"
                  value={expenseTotals.companyExpensesCentavos}
                  hideWhenZero
                />
                <SummaryRow label="Drawings" value={expenseTotals.drawingsCentavos} hideWhenZero />
                <SummaryRow
                  label="Purchases"
                  value={expenseTotals.purchasesCentavos}
                  hideWhenZero
                />
                <SummaryRow
                  label="Receivables"
                  value={expenseTotals.receivablesCentavos}
                  hideWhenZero
                />
                <SummaryRow
                  label="Deductions"
                  value={deductionCentavos}
                  hideWhenZero
                  hoverDetails={
                    populatedDeductions.length > 0 && (
                      <div className="grid min-w-56 grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-xs">
                        {populatedDeductions.map(({ label, amountCentavos }) => (
                          <React.Fragment key={label}>
                            <span className="min-w-0 truncate text-muted-foreground">{label}</span>
                            <span className="text-right tabular-nums">{money(amountCentavos)}</span>
                          </React.Fragment>
                        ))}
                      </div>
                    )
                  }
                />
                <SummaryRow
                  label="Total Cash Out"
                  value={cashOutCentavos}
                  emphasis
                  className="border-b border-border/60"
                  hideWhenZero
                />
                <SummaryRow label="Bank Check" value={paymentTotals.bankCheck} hideWhenZero />
                <SummaryRow label="Bank Transfer" value={paymentTotals.bankTransfer} hideWhenZero />
                <SummaryRow label="Gcash" value={paymentTotals.gcash} hideWhenZero />
                <SummaryRow
                  label="Other e-wallet"
                  value={paymentTotals.otherEwallet}
                  hideWhenZero
                />
                <SummaryRow
                  label="Total Payments"
                  value={paymentTotals.total}
                  emphasis
                  hideWhenZero
                />
              </Section>
            )}
          </div>
        </ScrollArea>

        <div className="shrink-0 border-t border-sidebar-border bg-sidebar px-3 py-1">
          <SummaryRow label="Expected Cash" value={snapshot.expectedCashCentavos} emphasis />
          <SummaryRow
            label="Cash Denominations"
            value={snapshot.physicalCashCentavos}
            hideWhenZero
            hoverDetails={
              populatedCashDenominations.length > 0 && (
                <div className="grid min-w-56 grid-cols-[1fr_2rem_1fr] gap-x-3 gap-y-1 text-xs">
                  <span className="text-muted-foreground">Value</span>
                  <span className="text-right text-muted-foreground">Qty</span>
                  <span className="text-right text-muted-foreground">Total</span>
                  {populatedCashDenominations.map(({ id, valueCentavos, quantity }) => (
                    <React.Fragment key={id}>
                      <span>{money(valueCentavos)}</span>
                      <span className="text-right tabular-nums">{quantity}</span>
                      <span className="text-right tabular-nums">
                        {money(valueCentavos * quantity)}
                      </span>
                    </React.Fragment>
                  ))}
                </div>
              )
            }
          />
          <SummaryRow label="Cash Remitted" value={0} hideWhenZero />
          <div
            className={cn(
              'mt-2 mb-2 rounded-md border px-2.5 py-2',
              variance === 0
                ? 'border-border bg-muted/50'
                : variance > 0
                  ? 'border-warning/40 bg-warning/10'
                  : 'border-destructive/40 bg-destructive/10'
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Cash Variance
              </span>
              <span
                className={cn(
                  'text-[10px] font-medium',
                  variance > 0 && 'text-warning-foreground',
                  variance < 0 && 'text-destructive'
                )}
              >
                {variance === 0 ? 'Balanced' : variance > 0 ? 'Over by' : 'Short by'}
              </span>
            </div>
            <span
              className={cn(
                'mt-1 block text-lg font-semibold tabular-nums',
                variance > 0 && 'text-warning-foreground',
                variance < 0 && 'text-destructive'
              )}
            >
              {money(Math.abs(variance))}
            </span>
          </div>
        </div>
      </aside>

      <Dialog
        open={openDialog === 'cash-count'}
        onOpenChange={(open) => setOpenDialog(open ? 'cash-count' : null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cash Count</DialogTitle>
            <DialogDescription>
              Count each denomination. The total and variance update automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[1fr_6rem_6rem] items-center gap-x-3 gap-y-1">
            <span className="text-sm text-muted-foreground">Denomination</span>
            <span className="text-right text-sm text-muted-foreground">Qty</span>
            <span className="text-right text-sm text-muted-foreground">Total</span>
            {snapshot.cashDenominations
              .filter((denomination) => denomination.valueCentavos >= 25)
              .sort((a, b) => b.valueCentavos - a.valueCentavos)
              .map((denomination) => {
                const value = cashCount(snapshot, denomination.id)?.quantity ?? 0
                return (
                  <div
                    key={denomination.id}
                    className={cn('contents', !value && 'text-muted-foreground opacity-60')}
                  >
                    <span className="text-sm">{money(denomination.valueCentavos)}</span>
                    <Input
                      aria-label={`${money(denomination.valueCentavos)} quantity`}
                      className={cn(
                        'h-7 text-center tabular-nums',
                        !value && 'text-muted-foreground'
                      )}
                      inputMode="numeric"
                      value={value || ''}
                      onChange={(event) =>
                        save(
                          updateCashCount(
                            snapshot,
                            denomination.id,
                            Math.max(0, Math.floor(Number(event.target.value) || 0))
                          )
                        )
                      }
                    />
                    <span className="text-right text-sm tabular-nums">
                      {value ? money(denomination.valueCentavos * value) : ''}
                    </span>
                  </div>
                )
              })}
            <SummaryRow
              label="Total Cash Amount"
              value={snapshot.physicalCashCentavos}
              emphasis
              className="col-span-3"
            />
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setOpenDialog(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={openDialog === 'deductions'}
        onOpenChange={(open) => setOpenDialog(open ? 'deductions' : null)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Monthly Deductions for Employees</DialogTitle>
            <DialogDescription>Enter the employee deductions for this report.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {deductionDefinitions.map(({ id, label }) => (
              <div key={id} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 text-muted-foreground">{label}</span>
                <AmountInput
                  label={label}
                  value={draftDeductions[id] ?? 0}
                  onChange={(amountCentavos) =>
                    setDraftDeductions((current) => ({ ...current, [id]: amountCentavos }))
                  }
                  className="w-32 shrink-0"
                />
              </div>
            ))}
            <SummaryRow
              label="Total"
              value={deductionDefinitions.reduce(
                (total, { id }) => total + (draftDeductions[id] ?? 0),
                0
              )}
              emphasis
              className="border-t border-border pt-1"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpenDialog(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={addDeductions}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
})
