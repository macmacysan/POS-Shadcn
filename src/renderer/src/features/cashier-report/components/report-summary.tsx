import * as React from 'react'
import { addDays, format, startOfDay } from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'

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
import type { DateSelectorValue } from '@/../../components/reui/date-selector'
import { ReportDateDialog } from '@/features/cashier-report/components/report-date-dialog'
import { cn } from '@/lib/utils'
import { formatAmountInput, formatCentavos, pesoSign } from '@/lib/currency'
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
  const normalized = value.replaceAll(',', '').trim()
  if (!/^\d*(?:\.\d{0,2})?$/.test(normalized) || !normalized) return 0
  return Math.round(Number(normalized) * 100)
}

function AmountInput({
  label,
  value,
  onChange,
  className,
  inputClassName,
  placeholder = '—',
  invalid = false,
  disabled = false
}: {
  label: string
  value: number
  onChange: (value: number) => void
  className?: string
  inputClassName?: string
  placeholder?: string
  invalid?: boolean
  disabled?: boolean
}): React.JSX.Element {
  const [text, setText] = React.useState(() =>
    value ? formatAmountInput(String(value / 100)) : ''
  )
  const [isFocused, setIsFocused] = React.useState(false)

  React.useEffect(() => {
    if (!isFocused) setText(value ? formatAmountInput(String(value / 100)) : '')
  }, [isFocused, value])

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {pesoSign() && <span className="text-xs text-muted-foreground">{pesoSign()}</span>}
      <Input
        aria-label={label}
        aria-invalid={invalid}
        className={cn(
          'h-7 rounded-none border-x-0 border-t-0 border-b border-border/70 text-right tabular-nums',
          inputClassName
        )}
        inputMode="decimal"
        disabled={disabled}
        placeholder={placeholder}
        value={text}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onChange={(event) => {
          const next = formatAmountInput(event.target.value)
          setText(next)
          onChange(amountToCentavos(next))
        }}
      />
    </div>
  )
}

function Section({
  label,
  className,
  children
}: {
  label: string
  className?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className={cn('border-b border-border/50 py-2 last:border-b-0', className)}>
      {label && (
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
      )}
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
  hideWhenZero = false,
  valueMuted = false
}: {
  label: string
  value: number
  emphasis?: boolean
  className?: string
  hoverDetails?: React.ReactNode
  hideWhenZero?: boolean
  valueMuted?: boolean
}): React.JSX.Element | null {
  if (hideWhenZero && value === 0) return null

  const row = (
    <div
      className={cn(
        'flex min-h-6 items-center justify-between gap-3 rounded-sm px-1.5 text-xs transition-colors hover:bg-muted/60',
        className
      )}
    >
      <span
        className={cn(
          'min-w-0 truncate text-muted-foreground',
          emphasis && 'font-medium text-foreground'
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          'shrink-0 font-mono text-[11px] tabular-nums',
          emphasis && 'font-semibold',
          valueMuted ? 'text-muted-foreground' : emphasis && 'text-foreground'
        )}
      >
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
        <TooltipContent side="right" className="max-w-72">{hoverDetails}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function loadingSummary(): React.JSX.Element {
  return (
    <aside className="flex min-h-0 flex-1 flex-col gap-2 border-r border-border/70 bg-card p-2">
      <Skeleton className="h-9 w-full rounded-md" />
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
  refreshKey,
  reportId: reportIdOverride,
  businessDate,
  branchId,
  cashierUserId,
  dateRange,
  isDateLoading = false,
  onDateRangeChange,
  expenseTotals,
  onSnapshotChange,
  onOpenCollection,
  onOpenFinance,
  readOnly = false
}: {
  refreshKey?: string
  reportId?: string
  businessDate?: string
  branchId: string
  cashierUserId: string
  dateRange: DateSelectorValue
  isDateLoading?: boolean
  onDateRangeChange: (value: DateSelectorValue) => void
  expenseTotals: ExpenseSummaryTotals
  onSnapshotChange?: (snapshot: Snapshot) => void
  onOpenCollection?: (accountId: string) => void
  onOpenFinance?: (accountId: string) => void
  readOnly?: boolean
}): React.JSX.Element {
  const reportId = reportIdOverride ?? ''
  const reportBusinessDate = businessDate
  const isToday = reportBusinessDate === format(new Date(), 'yyyy-MM-dd')
  const startDate = dateRange.startDate
  const today = startOfDay(new Date())
  const selectedDay = startDate ? startOfDay(startDate) : undefined
  const selectDate = (date: Date): void =>
    onDateRangeChange({ period: 'day', operator: 'is', startDate: date, endDate: date })
  const [snapshot, setSnapshot] = React.useState<Snapshot>()
  const [error, setError] = React.useState<string>()
  const [openDialog, setOpenDialog] = React.useState<OpenDialog>(null)
  const [receiptToClear, setReceiptToClear] = React.useState<string>()
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
      onSnapshotChange?.(next)
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
  }, [isToday, onSnapshotChange, reportId])

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
          onSnapshotChange?.(saved)
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
  }, [onSnapshotChange])

  const save = React.useCallback(
    (next: Snapshot): void => {
      if (readOnly) return
      snapshotVersionRef.current += 1
      snapshotRef.current = next
      setSnapshot(next)
      onSnapshotChange?.(next)
      setHasSaved(false)
      setSaveError(undefined)
      pendingRef.current = true
      void flush()
    },
    [flush, readOnly]
  )

  if (!snapshot && !error) return loadingSummary()
  if (!snapshot) {
    return (
      <aside className="flex min-h-0 flex-1 flex-col bg-card p-1.5">
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
  const totalCashReceiptsCentavos =
    snapshot.receiptTotals.reduce((total, item) => total + item.amountCentavos, 0) +
    snapshot.cashCollectionsCentavos +
    snapshot.otherIncomeCentavos +
    snapshot.financeDownCentavos
  const totalCashOutCentavos =
    expenseTotals.companyExpensesCentavos +
    expenseTotals.drawingsCentavos +
    expenseTotals.purchasesCentavos +
    expenseTotals.receivablesCentavos +
    deductionCentavos
  const expectedCashCentavos =
    totalCashReceiptsCentavos - totalCashOutCentavos - paymentTotals.total
  const hasReceiptSummary = [
    snapshot.cashCollectionsCentavos,
    snapshot.otherIncomeCentavos,
    snapshot.financeDownCentavos,
    totalCashReceiptsCentavos
  ].some(Boolean)
  const hasCashOutSummary = [
    expenseTotals.companyExpensesCentavos,
    expenseTotals.drawingsCentavos,
    expenseTotals.purchasesCentavos,
    expenseTotals.receivablesCentavos,
    totalCashOutCentavos,
    paymentTotals.total
  ].some(Boolean)
  const variance = snapshot.physicalCashCentavos - expectedCashCentavos
  const variancePresentation =
    variance === 0
      ? {
          state: 'Balanced',
          detail: 'Counted cash matches expected cash.',
          surfaceClassName: 'border-success/25 bg-success/5',
          railClassName: 'bg-success',
          stateClassName: 'text-success-foreground'
        }
      : variance > 0
        ? {
            state: 'Over expected',
            detail: 'Counted cash is higher than expected cash.',
            surfaceClassName: 'border-warning/25 bg-warning/5',
            railClassName: 'bg-warning',
            stateClassName: 'text-warning-foreground'
          }
        : {
            state: 'Short expected',
            detail: 'Counted cash is lower than expected cash.',
            surfaceClassName: 'border-destructive/25 bg-destructive/5',
            railClassName: 'bg-destructive',
            stateClassName: 'text-destructive'
          }
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

  const requestClearReceipt = (receiptTypeId: string): void => {
    setReceiptToClear(receiptTypeId)
    setIsReceiptPickerOpen(false)
  }

  const clearReceiptValues = (): void => {
    if (!receiptToClear) return
    save(updateReceipt(snapshot, receiptToClear, { quantity: 0, amountCentavos: 0 }))
    setVisibleReceiptTypeIds((current) => {
      const next = new Set(current).add(receiptToClear)
      writeReceiptVisibility(next)
      return next
    })
    setReceiptToClear(undefined)
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
      <aside className="flex min-h-0 flex-1 flex-col overflow-hidden border-r border-border/70 bg-card text-foreground">
        <header className="relative flex h-14 shrink-0 items-center px-3">
          <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="View previous business day"
                disabled={isDateLoading || !startDate}
                onClick={() => startDate && selectDate(addDays(startDate, -1))}
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              <ReportDateDialog
                branchId={branchId}
                cashierUserId={cashierUserId}
                date={startDate}
                reportId={snapshot.report.id}
                cashVarianceCentavos={variance}
                disabled={isDateLoading}
                onSelect={selectDate}
              />
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="View next business day"
                disabled={
                  isDateLoading || !selectedDay || selectedDay.getTime() >= today.getTime()
                }
                onClick={() => startDate && selectDate(addDays(startDate, 1))}
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            <div>
              <Popover open={isReceiptPickerOpen} onOpenChange={setIsReceiptPickerOpen}>
                <PopoverTrigger
                  render={
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="outline"
                      aria-label="Add receipt type or deductions"
                    />
                  }
                >
                  <Plus />
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 p-3">
                  <p className="text-sm font-semibold">Receipt rows</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Show receipt types or clear values from an orphaned row.
                  </p>
                  <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
                    {[...standardReceiptTypes, ...customReceiptTypes].map((type) => {
                      const value = receiptTotal(snapshot, type.id)
                      const hasReceiptValue =
                        (value?.quantity ?? 0) > 0 || (value?.amountCentavos ?? 0) > 0
                      return (
                        <div
                          key={type.id}
                          className="flex items-center gap-2 rounded-md px-2 py-2 text-xs transition-colors hover:bg-muted"
                        >
                          <label
                            className={cn(
                              'flex min-w-0 flex-1 items-center gap-2',
                              !hasReceiptValue && 'cursor-pointer'
                            )}
                          >
                            <Checkbox
                              checked={visibleReceiptTypeIds.has(type.id)}
                              onCheckedChange={(checked) =>
                                toggleReceiptType(type.id, checked === true)
                              }
                              aria-label={`Show ${type.name}`}
                            />
                            <span className="min-w-0 truncate">{type.name}</span>
                          </label>
                          {hasReceiptValue && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              aria-label={`Clear values for ${type.name}`}
                              disabled={readOnly}
                              onClick={() => requestClearReceipt(type.id)}
                            >
                              <Trash2 aria-hidden="true" />
                            </Button>
                          )}
                        </div>
                      )
                    })}
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
            </div>
            </div>
          <div className="ml-auto flex items-center gap-1.5">
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
          <div className="px-2.5">
            {visibleReceiptTypes.length > 0 && (
              <Section label="" className="border-b-0">
                <div className="grid grid-cols-[minmax(0,1fr)_3.04rem_5.12rem] gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
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
                      className="grid grid-cols-[minmax(0,1fr)_3.04rem_5.12rem] items-center gap-2 rounded-sm px-1.5 py-0.5 text-xs hover:bg-muted/40"
                    >
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger
                            render={<span className="min-w-0 line-clamp-2 text-[11px] leading-tight text-muted-foreground" />}
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
                          'h-7 min-w-0 rounded-none border-x-0 border-t-0 border-b border-border/70 px-1.5 text-right text-[11px] font-mono tabular-nums',
                          hasAmount &&
                            !hasQuantity &&
                            'border-destructive focus-visible:ring-destructive/40'
                        )}
                        disabled={readOnly}
                        inputMode="numeric"
                        placeholder="—"
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
                          'text-[11px] font-mono',
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
              <Section label="" className="-mt-3.5 border-b-0">
                <SummaryRow
                  label="Collections"
                  value={snapshot.cashCollectionsCentavos ?? 0}
                  hideWhenZero
                  valueMuted
                  hoverDetails={
                    <div className="grid min-w-56 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-xs">
                      {snapshot.collectionDetails.map(({ id, name, amountCentavos }) => (
                        <React.Fragment key={`${name}-${amountCentavos}`}>
                          {!readOnly && <Button type="button" variant="secondary" size="xs" onClick={() => onOpenCollection?.(id)}>Update</Button>}
                          <span className="min-w-0 truncate">{name}</span>
                          <span className="text-right tabular-nums">{money(amountCentavos)}</span>
                        </React.Fragment>
                      ))}
                    </div>
                  }
                />
                <SummaryRow
                  label="Other"
                  value={snapshot.otherIncomeCentavos ?? 0}
                  hideWhenZero
                  valueMuted
                />
                <SummaryRow
                  label="Finance Down"
                  value={snapshot.financeDownCentavos ?? 0}
                  hideWhenZero
                  valueMuted
                  hoverDetails={
                    <div className="grid min-w-56 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-xs">
                      {snapshot.financeDownDetails.map(({ id, name, amountCentavos }) => (
                        <React.Fragment key={`${name}-${amountCentavos}`}>
                          {!readOnly && <Button type="button" variant="secondary" size="xs" onClick={() => onOpenFinance?.(id)}>Update</Button>}
                          <span className="min-w-0 truncate">{name}</span>
                          <span className="text-right tabular-nums">{money(amountCentavos)}</span>
                        </React.Fragment>
                      ))}
                    </div>
                  }
                />
                <SummaryRow
                  label="Total Cash Receipts"
                  value={totalCashReceiptsCentavos}
                  emphasis
                  hideWhenZero
                  valueMuted
                />
              </Section>
            )}
            {hasCashOutSummary && (
              <Section label="" className="-mt-2 border-b-0 py-0">
                <SummaryRow
                  label="Expenses"
                  value={expenseTotals.companyExpensesCentavos}
                  hideWhenZero
                  valueMuted
                />
                <SummaryRow
                  label="Drawings"
                  value={expenseTotals.drawingsCentavos}
                  hideWhenZero
                  valueMuted
                />
                <SummaryRow
                  label="Purchases"
                  value={expenseTotals.purchasesCentavos}
                  hideWhenZero
                  valueMuted
                />
                <SummaryRow
                  label="Receivables"
                  value={expenseTotals.receivablesCentavos}
                  hideWhenZero
                  valueMuted
                />
                <SummaryRow
                  label="Deductions"
                  value={deductionCentavos}
                  hideWhenZero
                  valueMuted
                  hoverDetails={
                    populatedDeductions.length > 0 && (
                      <div className="flex min-w-56 flex-col gap-2 text-xs">
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1">
                          {populatedDeductions.map(({ label, amountCentavos }) => (
                            <React.Fragment key={label}>
                              <span className="min-w-0 truncate">{label}</span>
                              <span className="text-right tabular-nums">{money(amountCentavos)}</span>
                            </React.Fragment>
                          ))}
                        </div>
                        {!readOnly && <Button type="button" variant="secondary" size="xs" onClick={openDeductions}>Update</Button>}
                      </div>
                    )
                  }
                />
                <SummaryRow
                  label="Total Cash Outs"
                  value={totalCashOutCentavos}
                  emphasis
                  hideWhenZero
                  valueMuted
                />
                <SummaryRow
                  label="Bank Check"
                  value={paymentTotals.bankCheck}
                  hideWhenZero
                  valueMuted
                />
                <SummaryRow
                  label="Bank Transfer"
                  value={paymentTotals.bankTransfer}
                  hideWhenZero
                  valueMuted
                />
                <SummaryRow label="Gcash" value={paymentTotals.gcash} hideWhenZero valueMuted />
                <SummaryRow
                  label="E-wallet"
                  value={paymentTotals.otherEwallet}
                  hideWhenZero
                  valueMuted
                />
                <SummaryRow
                  label="Total Payments"
                  value={paymentTotals.total}
                  emphasis
                  hideWhenZero
                  valueMuted
                />
              </Section>
            )}
          </div>
        </ScrollArea>
        <div className="shrink-0 border-t border-sidebar-border bg-background/30 px-3 py-1">
          <SummaryRow
            label="Expected Cash"
            value={expectedCashCentavos}
            emphasis
            valueMuted
          />
          <SummaryRow
            label="Cash Denominations"
            value={snapshot.physicalCashCentavos}
            hideWhenZero
            valueMuted
            hoverDetails={
              populatedCashDenominations.length > 0 && (
                <div className="flex min-w-56 flex-col gap-2 text-xs">
                  <div className="grid grid-cols-[1fr_2rem_1fr] gap-x-3 gap-y-1">
                    <span>Value</span>
                    <span className="text-right">Qty</span>
                    <span className="text-right">Total</span>
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
                  {!readOnly && <Button type="button" variant="secondary" size="xs" onClick={() => setOpenDialog('cash-count')}>Update</Button>}
                </div>
              )
            }
          />
          <SummaryRow label="Cash Remitted" value={0} hideWhenZero valueMuted />
          <section
            aria-label="Cash variance"
            className={cn(
              'relative mt-1 overflow-hidden border px-3 py-2.5',
              variancePresentation.surfaceClassName
            )}
          >
            <span
              aria-hidden="true"
              className={cn('absolute inset-y-0 left-0 w-0.5', variancePresentation.railClassName)}
            />
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Cash variance
              </span>
              <span
                className={cn(
                  'text-[10px] font-semibold uppercase tracking-[0.08em]',
                  variancePresentation.stateClassName
                )}
              >
                {variancePresentation.state}
              </span>
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-3">
              <span className="font-mono text-lg font-semibold tracking-tight tabular-nums">
                {money(Math.abs(variance))}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {variance === 0 ? 'No difference' : variance > 0 ? 'Counted over' : 'Counted short'}
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
              {variancePresentation.detail}
            </p>
          </section>
        </div>
      </aside>

      <Dialog
        open={receiptToClear !== undefined}
        onOpenChange={(open) => !open && setReceiptToClear(undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear receipt values?</DialogTitle>
            <DialogDescription>
              This will clear the quantity and amount from this receipt row and save the change.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReceiptToClear(undefined)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={clearReceiptValues}>
              Clear values
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                      disabled={readOnly}
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
            <div className="col-span-3 mt-2 flex items-center justify-between gap-3 border-t border-border pt-2 text-sm font-semibold">
              <span>Total Cash Amount</span>
              <span className="font-mono tabular-nums">{money(snapshot.physicalCashCentavos)}</span>
            </div>
            <div className="col-span-3 flex items-center justify-between gap-3 text-sm font-semibold">
              <span>Cash Variance</span>
              <span className="font-mono tabular-nums">{money(variance)}</span>
            </div>
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
                  disabled={readOnly}
                />
              </div>
            ))}
            <div className="mt-1 flex items-center justify-between gap-3 border-t border-border pt-2 text-sm font-semibold">
              <span>Total Deductions</span>
              <span className="font-mono tabular-nums">
                {money(
                  deductionDefinitions.reduce(
                    (total, { id }) => total + (draftDeductions[id] ?? 0),
                    0
                  )
                )}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm font-semibold">
              <span>Cash Variance</span>
              <span className="font-mono tabular-nums">{money(variance)}</span>
            </div>
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
