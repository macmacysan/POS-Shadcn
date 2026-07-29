import * as React from 'react'

import { Button } from '@/components/ui/button'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useActiveReport } from '@/contexts/active-report-context'
import { cn } from '@/lib/utils'
import { formatCentavos } from '@/lib/currency'
import type { DailyReportSnapshotResponse } from '@/../../shared/contracts'

type OpenDialog = 'cash-count' | null
type Snapshot = DailyReportSnapshotResponse

const money = formatCentavos

function amountToCentavos(value: string): number {
  const normalized = value.trim()
  if (!/^\d*(?:\.\d{0,2})?$/.test(normalized) || !normalized) return 0
  return Math.round(Number(normalized) * 100)
}

function AmountInput({
  label,
  value,
  onChange,
  className
}: {
  label: string
  value: number
  onChange: (value: number) => void
  className?: string
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
        className="h-7 text-right tabular-nums"
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
    <section className="border-b border-border/60 py-2.5 last:border-b-0">
      <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-col gap-1">{children}</div>
    </section>
  )
}

function SummaryRow({
  label,
  value,
  emphasis = false,
  className
}: {
  label: string
  value: number
  emphasis?: boolean
  className?: string
}): React.JSX.Element {
  return (
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
}

function loadingSummary(): React.JSX.Element {
  return (
    <aside className="flex min-h-0 flex-1 flex-col gap-3 p-3">
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
  const now = snapshot.report.updatedAt
  const next = {
    id: existing?.id ?? `draft-receipt-${receiptTypeId}`,
    dailyReportId: snapshot.report.id,
    receiptTypeId,
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
  alwaysDark = false,
  refreshKey
}: {
  alwaysDark?: boolean
  refreshKey?: string
}): React.JSX.Element {
  const { reportId } = useActiveReport()
  const [snapshot, setSnapshot] = React.useState<Snapshot>()
  const [error, setError] = React.useState<string>()
  const [openDialog, setOpenDialog] = React.useState<OpenDialog>(null)
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
      setHasSaved(false)
      setSaveError(undefined)
    } catch {
      if (snapshotVersion !== snapshotVersionRef.current) return
      setError('Today’s report summary could not be loaded.')
    }
  }, [reportId])

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
      <aside className={cn('flex min-h-0 flex-1 flex-col p-3', alwaysDark && 'dark')}>
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

  const incomeCentavos = snapshot.incomeEntries
    .filter((item) => item.status === 'POSTED')
    .reduce((total, item) => total + item.amountCentavos, 0)
  const deductionCentavos = snapshot.deductions.reduce(
    (total, item) => total + item.amountCentavos,
    0
  )
  const cashOutEntriesCentavos = snapshot.cashOutEntries
    .filter((item) => item.status === 'POSTED')
    .reduce((total, item) => total + item.amountCentavos, 0)
  const cashOutCentavos = snapshot.legacyExpenseCashOutCentavos + cashOutEntriesCentavos
  const variance = snapshot.cashVarianceCentavos

  return (
    <>
      <aside
        className={cn(
          'flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/20',
          alwaysDark && 'dark'
        )}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-border bg-muted/55 px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Daily Cashier Report
            </p>
            <h2 className="truncate text-sm font-semibold tracking-tight">Today’s Summary</h2>
          </div>
          <span className="text-[10px] text-muted-foreground" aria-live="polite">
            {isSaving ? 'Saving…' : saveError ? 'Save failed' : hasSaved ? 'Saved' : ''}
          </span>
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
          <div className="px-3 pb-3">
            <Section label="Opening">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground">Opening Cash</span>
                <AmountInput
                  label="Opening Cash"
                  value={snapshot.report.openingCashCentavos}
                  onChange={(openingCashCentavos) =>
                    save({
                      ...snapshot,
                      report: { ...snapshot.report, openingCashCentavos }
                    })
                  }
                  className="w-28"
                />
              </div>
            </Section>
            <Section label="Receipts">
              <div className="grid grid-cols-[minmax(0,1fr)_3.5rem_6rem] gap-2 px-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                <span>Type</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Amount</span>
              </div>
              {snapshot.receiptTypes.map((type) => {
                const value = receiptTotal(snapshot, type.id)
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
                          {type.name}
                        </TooltipTrigger>
                        <TooltipContent className="max-w-72">{type.name}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <Input
                      aria-label={`${type.name} quantity`}
                      className="h-7 px-1.5 text-right tabular-nums"
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
                      onChange={(amountCentavos) =>
                        save(updateReceipt(snapshot, type.id, { amountCentavos }))
                      }
                    />
                  </div>
                )
              })}
            </Section>
            <Section label="Cash in">
              <SummaryRow label="Posted Income" value={incomeCentavos} />
              <SummaryRow
                label="Total Receipts"
                value={snapshot.receiptTotals.reduce(
                  (total, item) => total + item.amountCentavos,
                  0
                )}
                emphasis
              />
            </Section>
            <Section label="Cash out">
              <SummaryRow label="Expenses (posted)" value={snapshot.legacyExpenseCashOutCentavos} />
              <SummaryRow label="Cash Out entries" value={cashOutEntriesCentavos} />
              <SummaryRow label="Total Cash Out" value={cashOutCentavos} emphasis />
            </Section>
            <Section label="Deductions">
              {snapshot.deductionTypes.map((type) => (
                <div key={type.id} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-muted-foreground">{type.name}</span>
                  <AmountInput
                    label={`${type.name} deduction`}
                    value={deduction(snapshot, type.id)?.amountCentavos ?? 0}
                    onChange={(amountCentavos) =>
                      save(updateDeduction(snapshot, type.id, amountCentavos))
                    }
                    className="w-28"
                  />
                </div>
              ))}
              <SummaryRow label="Total Deductions" value={deductionCentavos} emphasis />
            </Section>
          </div>
        </ScrollArea>

        <div className="shrink-0 border-t border-border bg-background px-3 py-2">
          <SummaryRow label="Expected Cash" value={snapshot.expectedCashCentavos} emphasis />
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="mt-1 w-full justify-between"
            onClick={() => setOpenDialog('cash-count')}
          >
            Counted Cash
            <span className="tabular-nums">{money(snapshot.physicalCashCentavos)}</span>
          </Button>
          <div
            className={cn(
              'mt-2 border-t py-2',
              variance === 0
                ? 'border-border'
                : variance > 0
                  ? 'border-warning bg-warning/10'
                  : 'border-destructive/30 bg-destructive/5'
            )}
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Cash Variance
            </span>
            <span
              className={cn(
                'mt-1 block text-lg font-semibold tabular-nums',
                variance < 0 && 'text-destructive'
              )}
            >
              {money(variance)}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {variance === 0
                ? 'Cash is balanced'
                : variance > 0
                  ? 'More than expected'
                  : 'Less than expected'}
            </span>
          </div>
          <div className="flex min-h-9 items-center justify-between gap-3 border-t border-border/60 text-xs">
            <span className="text-muted-foreground">Cash Remitted</span>
            <AmountInput
              label="Cash Remitted"
              value={snapshot.report.cashRemittedCentavos ?? 0}
              onChange={(cashRemittedCentavos) =>
                save({
                  ...snapshot,
                  report: { ...snapshot.report, cashRemittedCentavos }
                })
              }
              className="w-28"
            />
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
          <div className="grid grid-cols-[1fr_6rem_6rem] items-center gap-x-3 gap-y-2">
            <span className="text-sm text-muted-foreground">Denomination</span>
            <span className="text-right text-sm text-muted-foreground">Qty</span>
            <span className="text-right text-sm text-muted-foreground">Total</span>
            {[...snapshot.cashDenominations].reverse().map((denomination) => {
              const value = cashCount(snapshot, denomination.id)?.quantity ?? 0
              return (
                <React.Fragment key={denomination.id}>
                  <span className="text-sm">{money(denomination.valueCentavos)}</span>
                  <Input
                    aria-label={`${money(denomination.valueCentavos)} quantity`}
                    className="h-7 text-center tabular-nums"
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
                </React.Fragment>
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
    </>
  )
})
