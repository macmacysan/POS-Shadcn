import * as React from 'react'
import { Plus, X } from 'lucide-react'

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
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { formatPhilippinePeso } from '@/lib/currency'
import type { InstallmentHistoryRecord } from '@/lib/installment-history'
import { amountFromCentavos, type ExpenseSummaryTotals } from '@/../../shared/contracts'

export type SummaryExpense = { type: string; amount: number }
export type SummaryIncome = { receiptType?: string; amount: number }
export type SummaryPayment = { type: string; amount: number; isDownPayment?: boolean }

type ReceiptValue = { quantity: number; amount: number }
type DeductionValues = Record<string, number>
type CashDenominations = Record<string, number>
type OpenDialog = 'deductions' | 'cash' | null

type SidebarOptions = {
  receiptTypes: string[]
  customReceiptTypes: string[]
  receiptValues: Record<string, ReceiptValue>
  deductions: boolean
  deductionValues: DeductionValues
  cashAmount: boolean
  cashDenominations: CashDenominations
  cashRemitted: boolean
}

type ReportSummaryProps = {
  expenseTotals: ExpenseSummaryTotals
  incomes: SummaryIncome[]
  payments: SummaryPayment[]
  installmentHistory: InstallmentHistoryRecord[]
  alwaysDark?: boolean
}

const defaultReceiptTypes = ['Sales Invoice', 'SI Trading', 'Delivery Receipt', 'Pawnshop']
const deductionTypes = ['SSS', 'PhilHealth', 'Pag-IBIG', 'Withholding Tax']
const cashDenominationValues = ['0.25', '1', '5', '10', '20', '50', '100', '200', '500', '1000']
const transferTypes = ['Bank Check', 'Bank Transfer', 'GCash', 'Other e-wallet'] as const
const optionsStorageKey = 'cashier-report-summary-options'
const openingCashStorageKey = 'cashier-report-opening-cash'

const money = formatPhilippinePeso

const amountValue = (value: string): number => {
  const parsed = Number(value.replace(/[^\d.-]/g, ''))
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

function useStoredNumber(key: string): [number, (value: number) => void] {
  const [value, setValue] = React.useState(() => Number(localStorage.getItem(key) ?? 0) || 0)
  const update = React.useCallback(
    (nextValue: number) => {
      setValue(nextValue)
      localStorage.setItem(key, String(nextValue))
    },
    [key]
  )
  return [value, update]
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
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <span className="text-xs text-muted-foreground">₱</span>
      <Input
        aria-label={label}
        className="h-7 text-right tabular-nums"
        inputMode="decimal"
        value={value || ''}
        onChange={(event) => onChange(amountValue(event.target.value))}
      />
    </div>
  )
}

function Section({
  label,
  children
}: {
  label?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="border-b border-border/60 py-2.5 last:border-b-0">
      {label && (
        <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
          {label}
        </p>
      )}
      <div className="flex flex-col gap-1">{children}</div>
    </section>
  )
}

function SummaryRow({
  label,
  value,
  emphasis = false,
  onClick
}: {
  label: string
  value: number
  emphasis?: boolean
  onClick?: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      className={cn(
        'flex min-h-7 w-full items-center justify-between gap-3 rounded-md text-left text-xs',
        onClick && 'cursor-pointer px-1.5 transition-colors hover:bg-muted/70'
      )}
      onClick={onClick}
      disabled={!onClick}
    >
      <span
        className={cn(
          'min-w-0 truncate',
          emphasis ? 'font-light text-foreground' : 'text-muted-foreground'
        )}
      >
        {label}
      </span>
      <span className={cn('shrink-0 tabular-nums', emphasis && 'font-semibold text-foreground')}>
        {money(value)}
      </span>
    </button>
  )
}

function TotalRow({
  label,
  value,
  className
}: {
  label: string
  value: number
  className?: string
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'mt-1 flex items-center justify-between border-t border-border/60 pt-2 text-xs',
        className
      )}
    >
      <span className="font-light text-foreground">{label}</span>
      <span className="font-semibold tabular-nums text-foreground">{money(value)}</span>
    </div>
  )
}

function ReceiptRow({
  type,
  value,
  onChange
}: {
  type: string
  value: ReceiptValue
  onChange: (value: ReceiptValue) => void
}): React.JSX.Element {
  const isEmpty = value.amount === 0

  return (
    <div
      className={cn(
        'grid grid-cols-[minmax(0,1fr)_4rem_5.75rem] items-center gap-2 text-xs',
        isEmpty && 'text-muted-foreground'
      )}
    >
      <span className="min-w-0 truncate text-muted-foreground">{type}</span>
      <Input
        aria-label={`${type} quantity`}
        className="h-7 px-1.5 text-right tabular-nums"
        inputMode="numeric"
        placeholder="0"
        value={value.quantity || ''}
        onChange={(event) =>
          onChange({ ...value, quantity: Math.max(0, Math.floor(amountValue(event.target.value))) })
        }
      />
      <AmountInput
        label={`${type} amount`}
        value={value.amount}
        onChange={(amount) => onChange({ ...value, amount })}
      />
    </div>
  )
}

function initialOptions(): SidebarOptions {
  try {
    const saved = JSON.parse(
      localStorage.getItem(optionsStorageKey) ?? '{}'
    ) as Partial<SidebarOptions>
    return {
      receiptTypes: saved.receiptTypes ?? [],
      customReceiptTypes: saved.customReceiptTypes ?? [],
      receiptValues: saved.receiptValues ?? {},
      deductions: saved.deductions ?? false,
      deductionValues: saved.deductionValues ?? {},
      cashAmount: saved.cashAmount ?? false,
      cashDenominations: saved.cashDenominations ?? {},
      cashRemitted: saved.cashRemitted ?? false
    }
  } catch {
    return {
      receiptTypes: [],
      customReceiptTypes: [],
      receiptValues: {},
      deductions: false,
      deductionValues: {},
      cashAmount: false,
      cashDenominations: {},
      cashRemitted: false
    }
  }
}

export const ReportSummary = React.memo(function ReportSummary({
  expenseTotals,
  incomes,
  payments,
  installmentHistory,
  alwaysDark = false
}: ReportSummaryProps): React.JSX.Element {
  const [options, setOptions] = React.useState<SidebarOptions>(initialOptions)
  const [openingCash, setOpeningCash] = useStoredNumber(openingCashStorageKey)
  const [cashRemitted, setCashRemitted] = React.useState(0)
  const [openDialog, setOpenDialog] = React.useState<OpenDialog>(null)
  const [customType, setCustomType] = React.useState('')

  React.useEffect(() => {
    localStorage.setItem(optionsStorageKey, JSON.stringify(options))
  }, [options])

  const allReceiptTypes = [...defaultReceiptTypes, ...options.customReceiptTypes]
  const updateOption = (key: keyof SidebarOptions, value: boolean | string): void => {
    setOptions((current) => {
      if (key === 'receiptTypes' && typeof value === 'string') {
        return {
          ...current,
          receiptTypes: current.receiptTypes.includes(value)
            ? current.receiptTypes.filter((item) => item !== value)
            : [...current.receiptTypes, value],
          receiptValues: current.receiptValues[value]
            ? current.receiptValues
            : { ...current.receiptValues, [value]: { quantity: 0, amount: 0 } }
        }
      }
      return { ...current, [key]: value }
    })
  }

  const addCustomReceiptType = (): void => {
    const nextType = customType.trim()
    if (!nextType || allReceiptTypes.some((type) => type.toLowerCase() === nextType.toLowerCase()))
      return
    setOptions((current) => ({
      ...current,
      customReceiptTypes: [...current.customReceiptTypes, nextType],
      receiptTypes: [...current.receiptTypes, nextType],
      receiptValues: { ...current.receiptValues, [nextType]: { quantity: 0, amount: 0 } }
    }))
    setCustomType('')
  }

  const removeCustomReceiptType = (type: string): void => {
    setOptions((current) => ({
      ...current,
      customReceiptTypes: current.customReceiptTypes.filter((item) => item !== type),
      receiptTypes: current.receiptTypes.filter((item) => item !== type),
      receiptValues: Object.fromEntries(
        Object.entries(current.receiptValues).filter(([key]) => key !== type)
      )
    }))
  }

  const updateReceipt = (type: string, value: ReceiptValue): void =>
    setOptions((current) => ({
      ...current,
      receiptValues: { ...current.receiptValues, [type]: value }
    }))

  const updateDeduction = (type: string, value: number): void =>
    setOptions((current) => ({
      ...current,
      deductionValues: { ...current.deductionValues, [type]: value }
    }))

  const updateDenomination = (denomination: string, quantity: number): void =>
    setOptions((current) => ({
      ...current,
      cashDenominations: { ...current.cashDenominations, [denomination]: quantity }
    }))

  const {
    receiptRows,
    collections,
    otherIncome,
    finance,
    totalReceipts,
    expensesTotal,
    deductions,
    drawings,
    purchases,
    receivables,
    cashOut,
    transferRows,
    countedCash,
    expectedCash,
    variance,
    endingCash
  } = React.useMemo(() => {
    const receiptRows = options.receiptTypes.map((type) => ({
      type,
      ...(options.receiptValues[type] ?? { quantity: 0, amount: 0 })
    }))
    const cashSales = receiptRows.reduce((sum, row) => sum + row.amount, 0)
    const collections = installmentHistory.reduce(
      (sum, record) =>
        sum +
        (record.source === 'in-house' && record.action !== 'deleted'
          ? (record.details.payment?.amountPaid ?? 0)
          : 0),
      0
    )
    const otherIncome = incomes.reduce((sum, row) => sum + row.amount, 0)
    const finance = payments.reduce(
      (sum, payment) => sum + (payment.isDownPayment ? payment.amount : 0),
      0
    )
    const expenseSummary = {
      expensesTotal: amountFromCentavos(expenseTotals.companyExpensesCentavos),
      drawings: amountFromCentavos(expenseTotals.drawingsCentavos),
      purchases: amountFromCentavos(expenseTotals.purchasesCentavos),
      receivables: amountFromCentavos(expenseTotals.receivablesCentavos)
    }
    const deductions = deductionTypes.reduce(
      (sum, type) => sum + (options.deductionValues[type] ?? 0),
      0
    )
    const transferRows = transferTypes.map((type) => ({
      type,
      amount: payments.reduce(
        (sum, payment) => sum + (payment.type === type ? payment.amount : 0),
        0
      )
    }))
    const nonCash = transferRows.reduce((sum, row) => sum + row.amount, 0)
    const cashOut =
      expenseSummary.expensesTotal +
      deductions +
      expenseSummary.drawings +
      expenseSummary.purchases +
      expenseSummary.receivables
    const totalReceipts = cashSales + collections + otherIncome + finance
    const countedCash = cashDenominationValues.reduce(
      (sum, denomination) =>
        sum + Number(denomination) * (options.cashDenominations[denomination] ?? 0),
      0
    )
    const expectedCash = openingCash + totalReceipts - cashOut - nonCash
    const variance = countedCash - expectedCash

    return {
      receiptRows,
      collections,
      otherIncome,
      finance,
      totalReceipts,
      ...expenseSummary,
      deductions,
      cashOut,
      transferRows,
      countedCash,
      expectedCash,
      variance,
      endingCash: expectedCash - cashRemitted
    }
  }, [cashRemitted, expenseTotals, incomes, installmentHistory, openingCash, options, payments])

  const visibleCashInRows = [
    { label: 'Collections', value: collections },
    { label: 'Other Income', value: otherIncome },
    { label: 'Finance', value: finance },
    { label: 'Total Receipts', value: totalReceipts, emphasis: true }
  ].filter((row) => row.value !== 0)
  const visibleCashOutRows = [
    { label: 'Expenses', value: expensesTotal },
    ...(options.deductions && deductions !== 0
      ? [
          {
            label: 'Deductions',
            value: deductions,
            onClick: () => setOpenDialog('deductions' as const)
          }
        ]
      : []),
    { label: 'Drawings', value: drawings },
    { label: 'Purchases', value: purchases },
    { label: 'Receivables', value: receivables },
    { label: 'Cash Out', value: cashOut, emphasis: true }
  ].filter((row) => row.value !== 0)
  const visibleTransferRows = transferRows.filter((row) => row.amount !== 0)

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
            <p className="truncate text-[10px] font-light uppercase tracking-[0.14em] text-muted-foreground">
              Daily Cashier Report
            </p>
            <h2 className="truncate text-sm font-semibold tracking-tight">Today&apos;s Summary</h2>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="icon-xs"
                  aria-label="Customize sidebar"
                />
              }
            >
              <Plus aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Customize Sidebar</DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Receipt Types
                </DropdownMenuLabel>
                {allReceiptTypes.map((type) => {
                  const isCustom = options.customReceiptTypes.includes(type)
                  return (
                    <div key={type} className="flex items-center">
                      <DropdownMenuCheckboxItem
                        checked={options.receiptTypes.includes(type)}
                        onCheckedChange={() => updateOption('receiptTypes', type)}
                        className="flex-1"
                      >
                        {type}
                      </DropdownMenuCheckboxItem>
                      {isCustom && (
                        <Button
                          type="button"
                          size="icon-xs"
                          variant="ghost"
                          className="mr-1 shrink-0"
                          aria-label={`Remove ${type}`}
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={() => removeCustomReceiptType(type)}
                        >
                          <X aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                  )
                })}
                <div className="mt-1 flex gap-1.5 px-1.5">
                  <Input
                    aria-label="Custom receipt type"
                    className="h-7"
                    placeholder="Custom type"
                    value={customType}
                    onChange={(event) => setCustomType(event.target.value)}
                    onPointerDown={(event) => event.stopPropagation()}
                    onKeyDown={(event) => {
                      event.stopPropagation()
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        addCustomReceiptType()
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="secondary"
                    aria-label="Add custom receipt type"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={addCustomReceiptType}
                  >
                    <Plus aria-hidden="true" />
                  </Button>
                </div>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Optional Fields
                </DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={options.deductions}
                  onCheckedChange={(checked) => updateOption('deductions', checked)}
                >
                  Deductions
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={options.cashAmount}
                  onCheckedChange={(checked) => updateOption('cashAmount', checked)}
                >
                  Cash Amount
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={options.cashRemitted}
                  onCheckedChange={(checked) => updateOption('cashRemitted', checked)}
                >
                  Cash Remitted
                </DropdownMenuCheckboxItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <ScrollArea className="min-h-0 flex-1">
          <div className="px-3 pb-3">
            {openingCash !== 0 && (
              <Section label="Opening">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-muted-foreground">Opening Cash</span>
                  <AmountInput
                    label="Opening Cash"
                    value={openingCash}
                    onChange={setOpeningCash}
                    className="w-24"
                  />
                </div>
              </Section>
            )}
            {receiptRows.length > 0 && (
              <Section label="Receipts">
                {receiptRows.length > 0 && (
                  <div className="grid grid-cols-[minmax(0,1fr)_4rem_5.75rem] gap-2 px-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <span>Type</span>
                    <span className="text-right">Qty</span>
                    <span className="text-right">Amount</span>
                  </div>
                )}
                {receiptRows.map((row) => (
                  <ReceiptRow
                    key={row.type}
                    type={row.type}
                    value={row}
                    onChange={(value) => updateReceipt(row.type, value)}
                  />
                ))}
              </Section>
            )}
            {visibleCashInRows.length > 0 && (
              <Section label="Cash in">
                {visibleCashInRows.map((row) => (
                  <SummaryRow key={row.label} {...row} />
                ))}
              </Section>
            )}
            {visibleCashOutRows.length > 0 && (
              <Section label="Cash out">
                {visibleCashOutRows.map((row) => (
                  <SummaryRow key={row.label} {...row} />
                ))}
              </Section>
            )}
            {visibleTransferRows.length > 0 && (
              <Section label="Transfers">
                {visibleTransferRows.map((row) => (
                  <SummaryRow key={row.type} label={row.type} value={row.amount} />
                ))}
              </Section>
            )}
          </div>
        </ScrollArea>

        <div className="shrink-0 border-t border-border bg-background px-3 py-2">
          {expectedCash !== 0 && <SummaryRow label="Expected Cash" value={expectedCash} emphasis />}
          {options.cashAmount && (
            <SummaryRow
              label="Cash Amount"
              value={countedCash}
              onClick={() => setOpenDialog('cash')}
            />
          )}
          <div
            className={cn(
              'mt-1 flex flex-col gap-0 border-t py-2',
              variance === 0
                ? 'border-border'
                : variance > 0
                  ? 'border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/30'
                  : 'border-destructive/30 bg-destructive/5'
            )}
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Variance
            </span>
            {variance === 0 ? (
              <span className="text-xs font-medium text-muted-foreground">Cash is balanced</span>
            ) : (
              <span
                className={cn(
                  'flex flex-col leading-3',
                  variance > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-destructive'
                )}
              >
                <span className="text-base font-semibold tabular-nums">{money(variance)}</span>
                <span className="text-[10px] font-light">
                  {variance > 0 ? 'More than expected' : 'Less than expected'}
                </span>
              </span>
            )}
          </div>
          {options.cashRemitted && (
            <div className="flex min-h-9 items-center justify-between gap-3 border-t border-border/60 text-xs">
              <span className="text-muted-foreground">Cash Remitted</span>
              <AmountInput
                label="Cash Remitted"
                value={cashRemitted}
                onChange={setCashRemitted}
                className="w-24"
              />
            </div>
          )}
          {options.cashRemitted && cashRemitted > 0 && (
            <div className="flex items-end justify-between gap-3 pt-2">
              <span className="pb-1 text-xs text-muted-foreground">Ending Cash</span>
              <span className="text-xl font-semibold tracking-tight tabular-nums">
                {money(endingCash)}
              </span>
            </div>
          )}
        </div>
      </aside>

      <Dialog
        open={openDialog === 'deductions'}
        onOpenChange={(open) => setOpenDialog(open ? 'deductions' : null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deductions</DialogTitle>
            <DialogDescription>
              Enter statutory deductions included in today&apos;s cash out.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[1fr_7rem] items-center gap-x-3 gap-y-2">
            <span className="text-sm text-muted-foreground">Deduction</span>
            <span className="text-right text-sm text-muted-foreground">Amount</span>
            {deductionTypes.map((type) => (
              <React.Fragment key={type}>
                <span className="text-sm">{type}</span>
                <AmountInput
                  label={`${type} deduction`}
                  value={options.deductionValues[type] ?? 0}
                  onChange={(value) => updateDeduction(type, value)}
                />
              </React.Fragment>
            ))}
            <TotalRow label="Total Deductions" value={deductions} className="col-span-2" />
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setOpenDialog(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={openDialog === 'cash'}
        onOpenChange={(open) => setOpenDialog(open ? 'cash' : null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cash Denomination</DialogTitle>
            <DialogDescription>
              Count each denomination to calculate the cash amount.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[1fr_7rem_5rem] items-center gap-x-3 gap-y-2">
            <span className="text-sm text-muted-foreground">Denomination</span>
            <span className="text-right text-sm text-muted-foreground">Qty</span>
            <span className="text-right text-sm text-muted-foreground">Total</span>
            {[...cashDenominationValues].reverse().map((denomination) => {
              const quantity = options.cashDenominations[denomination] ?? 0
              return (
                <React.Fragment key={denomination}>
                  <span className="text-sm">₱{denomination}</span>
                  <Input
                    aria-label={`₱${denomination} quantity`}
                    className="h-7 text-center tabular-nums"
                    inputMode="numeric"
                    value={quantity || ''}
                    onChange={(event) =>
                      updateDenomination(
                        denomination,
                        Math.max(0, Math.floor(amountValue(event.target.value)))
                      )
                    }
                  />
                  <span className="text-right text-sm tabular-nums">
                    {quantity ? money(Number(denomination) * quantity) : ''}
                  </span>
                </React.Fragment>
              )
            })}
            <TotalRow label="Total Cash Amount" value={countedCash} className="col-span-3" />
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
