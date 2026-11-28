import {
  cashierSummary,
  initialReceiptVisibility,
  receiptTypesExcludedFromPicker,
  writeReceiptVisibility
} from '../lib/cashier-summary'
import * as React from 'react'
import { addDays, format, startOfDay } from 'date-fns'
import { ChevronLeft, ChevronRight, LockKeyhole, Plus, Trash2 } from 'lucide-react'

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

const money = formatCentavos

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
  fixedDecimals = false,
  placeholder = '—',
  invalid = false,
  disabled = false
}: {
  label: string
  value: number
  onChange: (value: number) => void
  className?: string
  inputClassName?: string
  fixedDecimals?: boolean
  placeholder?: string
  invalid?: boolean
  disabled?: boolean
}): React.JSX.Element {
  const formatValue = React.useCallback(
    (amount: number): string => {
      if (!amount) return ''
      return formatAmountInput(fixedDecimals ? (amount / 100).toFixed(2) : String(amount / 100))
    },
    [fixedDecimals]
  )
  const [text, setText] = React.useState(() => formatValue(value))
  const [isFocused, setIsFocused] = React.useState(false)

  React.useEffect(() => {
    if (!isFocused) setText(formatValue(value))
  }, [formatValue, isFocused, value])

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {pesoSign() && <span className="text-xs text-muted-foreground">{pesoSign()}</span>}
      <Input
        aria-label={label}
        aria-invalid={invalid}
        className={cn(
          'h-7 rounded-md border border-border/70 bg-background px-1.5 text-right text-xs tabular-nums focus-visible:ring-1 focus-visible:ring-ring',
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

function SummaryRow({
  label,
  value,
  emphasis = false,
  className,
  hoverDetails,
}: {
  label: string
  value: number
  emphasis?: boolean
  className?: string
  hoverDetails?: React.ReactNode
}): React.JSX.Element | null {
  const row = (
    <div
      className={cn(
        'flex min-h-7 items-center justify-between gap-3 rounded-md px-1 py-1 text-xs transition-colors hover:bg-muted/60',
        emphasis &&
          'mt-1 min-h-8 rounded-none border-t border-border/60 bg-transparent px-1 py-1 font-medium hover:bg-transparent',
        className
      )}
    >
      <span
        className={cn('min-w-0 text-muted-foreground', emphasis && 'font-semibold text-foreground')}
      >
        {label}
      </span>
      <span
        className={cn(
          'shrink-0 tabular-nums',
          emphasis && 'font-semibold',
          'text-foreground'
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
          render={
            <div
              className="cursor-help rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              tabIndex={0}
              aria-label={`${label} details`}
            />
          }
        >
          {row}
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-72">
          {hoverDetails}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function loadingSummary(): React.JSX.Element {
  return (
    <aside className="flex min-h-0 flex-1 flex-col gap-2 border-r border-border/70 bg-workspace p-2">
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
  dateDialogOpen,
  onDateDialogOpenChange,
  isDateLoading = false,
  onDateRangeChange,
  expenseTotals,
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
  dateDialogOpen?: boolean
  onDateDialogOpenChange?: (open: boolean) => void
  isDateLoading?: boolean
  onDateRangeChange: (value: DateSelectorValue) => void
  expenseTotals: ExpenseSummaryTotals
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
      setVisibleReceiptTypeIds(initialReceiptVisibility(next, isToday))
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
      if (readOnly) return
      snapshotVersionRef.current += 1
      snapshotRef.current = next
      setSnapshot(next)
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
      <aside className="flex min-h-0 flex-1 flex-col bg-workspace p-1.5">
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
  const summary = cashierSummary(snapshot, expenseTotals, visibleReceiptTypeIds)
  const visibleReceiptTypes = summary.receipts
  const variance = summary.variance.value
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

  const hoverDetails = {
    collections: (
      <div className="grid min-w-56 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-xs">
        {snapshot.collectionDetails.map(({ id, name, amountCentavos, paymentMethodName }) => (
          <React.Fragment key={`${name}-${amountCentavos}`}>
            {!readOnly && (
              <Button
                type="button"
                variant="secondary"
                size="xs"
                onClick={() => onOpenCollection?.(id)}
              >
                Update
              </Button>
            )}
            <span className="min-w-0 truncate">
              {paymentMethodName ? `${name} · ${paymentMethodName}` : name}
            </span>
            <span className="text-right tabular-nums">{money(amountCentavos)}</span>
          </React.Fragment>
        ))}
      </div>
    ),
    finance: (
      <div className="grid min-w-56 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-xs">
        {snapshot.financeDownDetails.map(({ id, name, amountCentavos, paymentMethodName }) => (
          <React.Fragment key={`${name}-${amountCentavos}`}>
            {!readOnly && (
              <Button
                type="button"
                variant="secondary"
                size="xs"
                onClick={() => onOpenFinance?.(id)}
              >
                Update
              </Button>
            )}
            <span className="min-w-0 truncate">
              {paymentMethodName ? `${name} · ${paymentMethodName}` : name}
            </span>
            <span className="text-right tabular-nums">{money(amountCentavos)}</span>
          </React.Fragment>
        ))}
      </div>
    ),
    deductions: populatedDeductions.length > 0 && (
      <div className="flex min-w-56 flex-col gap-2 text-xs">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1">
          {populatedDeductions.map(({ label, amountCentavos }) => (
            <React.Fragment key={label}>
              <span className="min-w-0 truncate">{label}</span>
              <span className="text-right tabular-nums">{money(amountCentavos)}</span>
            </React.Fragment>
          ))}
        </div>
        {!readOnly && (
          <Button type="button" variant="secondary" size="xs" onClick={openDeductions}>
            Update
          </Button>
        )}
      </div>
    ),
    denominations: populatedCashDenominations.length > 0 && (
      <div className="flex min-w-56 flex-col gap-2 text-xs">
        <div className="grid grid-cols-[1fr_2rem_1fr] gap-x-3 gap-y-1">
          <span>Value</span>
          <span className="text-right">Qty</span>
          <span className="text-right">Total</span>
          {populatedCashDenominations.map(({ id, valueCentavos, quantity }) => (
            <React.Fragment key={id}>
              <span>{money(valueCentavos)}</span>
              <span className="text-right tabular-nums">{quantity}</span>
              <span className="text-right tabular-nums">{money(valueCentavos * quantity)}</span>
            </React.Fragment>
          ))}
        </div>
        {!readOnly && (
          <Button
            type="button"
            variant="secondary"
            size="xs"
            onClick={() => setOpenDialog('cash-count')}
          >
            Update
          </Button>
        )}
      </div>
    )
  }
  return (
    <>
      <aside className="flex min-h-0 flex-1 flex-col overflow-hidden bg-workspace text-foreground">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-1 border-b px-3 py-1">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <h2 className="text-sm font-medium">Summary</h2>
            <span
              className="shrink-0 text-xs text-muted-foreground empty:hidden"
              aria-live="polite"
            >
              {isSaving ? 'Saving…' : saveError ? 'Save failed' : hasSaved ? 'Saved' : ''}
            </span>
          </div>
          <div className="flex items-center justify-center gap-1">
            <div className="flex min-w-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
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
                open={dateDialogOpen}
                onOpenChange={onDateDialogOpenChange}
                disabled={isDateLoading}
                onSelect={selectDate}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="View next business day"
                disabled={isDateLoading || !selectedDay || selectedDay.getTime() >= today.getTime()}
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

        <div className="min-h-0 flex-1 overflow-auto">
          <div className="px-3 pb-3">
            {(visibleReceiptTypes.length > 0 || summary.groups[0].length > 0) && (
              <h3 className="pt-3 pb-1 text-sm font-medium">Cash Receipts</h3>
            )}
            {visibleReceiptTypes.length > 0 && (
              <>
                <div className="grid grid-cols-[minmax(0,1fr)_2.75rem_max(10rem,calc(22ch+1.5rem))] gap-2 border-b border-border/50 px-1 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>Type</span>
                  <span className="text-right">Qty</span>
                  <span className="text-right">Amount</span>
                </div>
                {visibleReceiptTypes.map((type) => {
                  const hasQuantity = type.quantity > 0
                  const hasAmount = type.value > 0
                  return (
                    <div
                      key={type.id}
                      className="grid grid-cols-[minmax(0,1fr)_2.75rem_max(10rem,calc(22ch+1.5rem))] items-center gap-2 rounded-md px-1 py-1 text-xs transition-colors hover:bg-muted/50"
                    >
                      <div className="flex min-w-0 items-center gap-1.5">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <span
                                  tabIndex={0}
                                  className="min-w-0 truncate text-sm text-foreground"
                                />
                              }
                            >
                              {type.label}
                            </TooltipTrigger>
                            <TooltipContent className="max-w-72">{type.name}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        {!isToday && (
                          <LockKeyhole
                            className={cn(
                              'size-3.5 shrink-0',
                              type.isActive ? 'text-muted-foreground' : 'text-warning-foreground'
                            )}
                            aria-hidden="true"
                          />
                        )}
                      </div>
                      <Input
                        aria-label={`${type.name} quantity`}
                        aria-invalid={hasAmount && !hasQuantity}
                        className={cn(
                          'h-7 min-w-0 rounded-md border border-border/70 bg-background px-1.5 text-right text-xs tabular-nums focus-visible:ring-1 focus-visible:ring-ring',
                          hasAmount &&
                            !hasQuantity &&
                            'border-destructive focus-visible:ring-destructive/40'
                        )}
                        disabled={readOnly}
                        inputMode="numeric"
                        placeholder="—"
                        value={type.quantity || ''}
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
                        value={type.value}
                        fixedDecimals={!isToday}
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
              </>
            )}
            {summary.groups.map(
              (group, index) =>
                group.length > 0 && (
                  <div key={group.at(-1)?.label} className="flex flex-col gap-0.5">
                    {index > 0 && (
                      <h3 className="pt-3 pb-1 text-sm font-medium">
                        {index === 1 ? 'Cash Outflows' : 'Payments'}
                      </h3>
                    )}
                    {group.map((row) => (
                      <SummaryRow
                        key={row.label + Boolean(row.emphasis)}
                        {...row}
                        hoverDetails={row.detail && hoverDetails[row.detail]}
                      />
                    ))}
                  </div>
                )
            )}
          </div>
        </div>
        <div className="shrink-0 border-t border-border bg-workspace px-3 py-2">
          <h3 className="text-sm font-medium">Reconciliation</h3>
          {summary.footer.map((row) => (
            <SummaryRow
              key={row.label}
              {...row}
              hoverDetails={row.detail && hoverDetails[row.detail]}
              className="px-0"
            />
          ))}
          <section
            aria-label="Cash variance"
            className="mt-2 flex min-h-10 items-center justify-between flex-wrap gap-x-2 border-t border-border pt-2"
          >
            <div>
              <span className="block text-sm font-medium">{summary.variance.label}</span>
              <span
                className={cn(
                  'text-xs',
                  variance === 0
                    ? 'text-muted-foreground'
                    : variance > 0
                      ? 'text-warning-foreground'
                      : 'text-destructive'
                )}
              >
                {variance === 0 ? 'Balanced' : variance > 0 ? 'Overage' : 'Shortage'}
              </span>
            </div>
            <span className="ml-auto whitespace-nowrap text-right text-sm font-semibold tabular-nums">
              {money(variance)}
            </span>
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
              <span className="tabular-nums">{money(snapshot.physicalCashCentavos)}</span>
            </div>
            <div className="col-span-3 flex items-center justify-between gap-3 text-sm font-semibold">
              <span>Cash Variance</span>
              <span className="tabular-nums">{money(variance)}</span>
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
              <span className="tabular-nums">
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
              <span className="tabular-nums">{money(variance)}</span>
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
