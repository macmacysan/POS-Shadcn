import * as React from 'react'
import { ArrowLeft, CalendarDays, ReceiptText } from 'lucide-react'
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef
} from '@tanstack/react-table'
import { format } from 'date-fns'

import { UniversalDataTable } from '@/components/shared/data-table/universal-data-table'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { KpiCard } from '@/components/shared/kpi-card'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { DatePickerInput } from '@/components/ui/date-picker-input'
import { AmountInputGroup } from '@/components/ui/amount-input-group'
import { Badge, type BadgeProps } from '@/components/ui/reui/badge'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatPhilippinePeso } from '@/lib/currency'
import { formatAccountName } from '@/lib/in-house-accounts'
import { cn } from '@/lib/utils'
import { useNotifications } from '@/hooks/use-notifications'
import type {
  InHousePaymentRecord,
  InHouseScheduleRecord,
  InstallmentPaymentWorkspace
} from '../../../../../shared/contracts'

type Props = {
  readonly accountId: string
  readonly userId: string
  readonly initialTab?: 'schedule' | 'ledger'
  readonly initialPaymentId?: string
  readonly openRecordPayment?: boolean
  readonly backLabel: string
  readonly onBack: () => void
  readonly ownBranch?: string
}

function toCentavos(value: string): number | undefined {
  const normalized = value.replace(/[^\d.]/g, '')
  if (!normalized || !/^\d+(?:\.\d{0,2})?$/.test(normalized)) return undefined
  const [whole, fraction = ''] = normalized.split('.')
  const centavos = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(centavos) ? centavos : undefined
}

function centsInput(value: number): string {
  return (value / 100).toFixed(2)
}

function formatDate(value: string): string {
  return format(new Date(`${value}T00:00:00`), 'MMM d, yyyy')
}

function statusVariant(
  status: InHouseScheduleRecord['status'] | InHousePaymentRecord['status'] | 'UPCOMING'
): NonNullable<BadgeProps['variant']> {
  if (status === 'PAID' || status === 'POSTED') return 'success-light' as const
  if (status === 'PARTIALLY_PAID') return 'warning-light' as const
  if (status === 'DUE' || status === 'VOIDED') return 'destructive-light' as const
  if (status === 'WAIVED') return 'secondary' as const
  return 'outline' as const
}

function scheduleStatusLabel(
  row: InHouseScheduleRecord
): InHouseScheduleRecord['status'] | 'UPCOMING' {
  if (row.status !== 'DUE' || row.dueDate <= format(new Date(), 'yyyy-MM-dd')) return row.status
  return 'UPCOMING'
}

function scheduleValueClass(row: InHouseScheduleRecord, className?: string): string {
  return cn(row.paidAmountCentavos === 0 && 'text-muted-foreground', className)
}

function PaymentDateField({
  value,
  onChange
}: {
  readonly value: string
  readonly onChange: (value: string) => void
}): React.JSX.Element {
  return (
    <Field>
      <FieldLabel htmlFor="payment-date">Payment date</FieldLabel>
      <DatePickerInput
        id="payment-date"
        value={value}
        onValueChange={onChange}
        aria-label="Payment date"
      />
    </Field>
  )
}

function scheduleColumns(): ColumnDef<InHouseScheduleRecord>[] {
  return [
    {
      id: 'installment',
      accessorKey: 'installmentNumber',
      header: '#',
      size: 64,
      cell: ({ row }) => (
        <span className={scheduleValueClass(row.original, 'font-light')}>
          #{row.original.installmentNumber}
        </span>
      )
    },
    {
      id: 'dueDate',
      accessorKey: 'dueDate',
      header: 'Due date',
      size: 112,
      cell: ({ row }) => (
        <span className={scheduleValueClass(row.original)}>{formatDate(row.original.dueDate)}</span>
      )
    },
    {
      id: 'dueAmount',
      accessorKey: 'dueAmountCentavos',
      header: 'Due amount',
      size: 150,
      meta: { headerClassName: 'text-right', cellClassName: 'text-right tabular-nums' },
      cell: ({ row }) => (
        <span className={scheduleValueClass(row.original)}>
          {formatPhilippinePeso(row.original.dueAmountCentavos / 100)}
        </span>
      )
    },
    {
      id: 'paid',
      accessorKey: 'paidAmountCentavos',
      header: 'Paid',
      size: 130,
      meta: { headerClassName: 'text-right', cellClassName: 'text-right tabular-nums' },
      cell: ({ row }) =>
        row.original.paidAmountCentavos === 0 ? null : (
          <span>{formatPhilippinePeso(row.original.paidAmountCentavos / 100)}</span>
        )
    },
    {
      id: 'balance',
      accessorKey: 'balanceCentavos',
      header: 'Balance',
      size: 140,
      meta: { headerClassName: 'text-right', cellClassName: 'text-right font-light tabular-nums' },
      cell: ({ row }) => (
        <span className={scheduleValueClass(row.original)}>
          {formatPhilippinePeso(row.original.balanceCentavos / 100)}
        </span>
      )
    },
    {
      id: 'penalty',
      accessorKey: 'penaltyCentavos',
      header: 'Penalty',
      size: 130,
      meta: { headerClassName: 'text-right', cellClassName: 'text-right tabular-nums' },
      cell: ({ row }) => (
        <span className={scheduleValueClass(row.original)}>
          {formatPhilippinePeso(row.original.penaltyCentavos / 100)}
        </span>
      )
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: 'Status',
      size: 190,
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-1">
          <Badge variant={statusVariant(scheduleStatusLabel(row.original))}>
            {scheduleStatusLabel(row.original)}
          </Badge>
          {row.original.isAdjusted && (
            <Badge variant="secondary" size="sm">
              ADJUSTED
            </Badge>
          )}
        </div>
      )
    }
  ]
}

function paymentColumns(): ColumnDef<InHousePaymentRecord>[] {
  return [
    {
      id: 'paymentDate',
      accessorKey: 'paymentDate',
      header: 'Payment date',
      size: 150,
      cell: ({ row }) => formatDate(row.original.paymentDate)
    },
    {
      id: 'reference',
      accessorKey: 'referenceNumber',
      header: 'OR / reference',
      size: 220,
      meta: { cellClassName: 'truncate text-muted-foreground' },
      cell: ({ row }) => row.original.referenceNumber || '—'
    },
    {
      id: 'amount',
      accessorKey: 'amountCentavos',
      header: 'Amount received',
      size: 170,
      meta: { headerClassName: 'text-right', cellClassName: 'text-right font-light tabular-nums' },
      cell: ({ row }) => formatPhilippinePeso(row.original.amountCentavos / 100)
    },
    {
      id: 'allocated',
      accessorKey: 'allocatedAmountCentavos',
      header: 'Allocated',
      size: 140,
      meta: { headerClassName: 'text-right', cellClassName: 'text-right tabular-nums' },
      cell: ({ row }) => formatPhilippinePeso(row.original.allocatedAmountCentavos / 100)
    },
    {
      id: 'updatedBy',
      accessorKey: 'updatedByName',
      header: 'Updated by',
      size: 150,
      meta: { cellClassName: 'text-muted-foreground' },
      cell: ({ row }) => row.original.updatedByName || '—'
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: 'Status',
      size: 190,
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-1">
          <Badge variant={statusVariant(row.original.status)}>{row.original.status}</Badge>
          {row.original.isAdjustment && (
            <Badge variant="secondary" size="sm">
              ADJUSTED
            </Badge>
          )}
        </div>
      )
    }
  ]
}

export function InstallmentPaymentWorkspace({
  accountId,
  userId,
  initialTab = 'schedule',
  initialPaymentId,
  openRecordPayment = false,
  backLabel,
  onBack,
  ownBranch
}: Props): React.JSX.Element {
  const [workspace, setWorkspace] = React.useState<InstallmentPaymentWorkspace>()
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string>()
  const [isNotFound, setIsNotFound] = React.useState(false)
  const [isPaymentOpen, setIsPaymentOpen] = React.useState(false)
  const [paymentMode, setPaymentMode] = React.useState<'record' | 'adjust'>('record')
  const [selectedSchedule, setSelectedSchedule] = React.useState<InHouseScheduleRecord>()
  const [selectedPaymentId, setSelectedPaymentId] = React.useState<string>()
  const [activeTab, setActiveTab] = React.useState(initialTab)
  const [amount, setAmount] = React.useState('')
  const [penalty, setPenalty] = React.useState('0.00')
  const [paymentDate, setPaymentDate] = React.useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [referenceNumber, setReferenceNumber] = React.useState('')
  const [adjustmentReason, setAdjustmentReason] = React.useState('')
  const [formError, setFormError] = React.useState<string>()
  const [isSaving, setIsSaving] = React.useState(false)
  const { notify } = useNotifications()
  const loadRequestId = React.useRef(0)
  const isSubmittingRef = React.useRef(false)
  const submissionIdRef = React.useRef<string | undefined>(undefined)
  const openedInitialPaymentRef = React.useRef<string | undefined>(undefined)
  const openedRecordPaymentRef = React.useRef<string | undefined>(undefined)

  const load = React.useCallback(async (): Promise<void> => {
    const requestId = ++loadRequestId.current
    setIsLoading(true)
    setError(undefined)
    setIsNotFound(false)
    setWorkspace(undefined)
    if (!accountId) {
      setIsNotFound(true)
      setIsLoading(false)
      return
    }
    try {
      const nextWorkspace = await window.api.installments.getPaymentWorkspace({
        accountId,
        initialPaymentId
      })
      if (requestId === loadRequestId.current) setWorkspace(nextWorkspace)
    } catch (caught) {
      if (requestId !== loadRequestId.current) return
      const message = 'Payment workspace could not be loaded.'
      if (caught instanceof Error && /not found/i.test(caught.message)) setIsNotFound(true)
      else {
        setError(message)
        notify({ type: 'error', title: 'Could not open payment workspace.', description: message })
      }
    } finally {
      if (requestId === loadRequestId.current) setIsLoading(false)
    }
  }, [accountId, initialPaymentId, notify])

  React.useEffect(() => {
    void load()
  }, [load])

  React.useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  const scheduleTable = useReactTable({
    data: workspace?.schedules ?? [],
    columns: React.useMemo(scheduleColumns, []),
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
    getRowId: (row) => row.id
  })
  const paymentTable = useReactTable({
    data: workspace?.payments ?? [],
    columns: React.useMemo(paymentColumns, []),
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
    getRowId: (row) => row.id
  })
  const openPayment = React.useCallback(
    (schedule?: InHouseScheduleRecord): void => {
      if (!workspace) return
      setPaymentMode('record')
      setSelectedSchedule(schedule)
      setSelectedPaymentId(undefined)
      setAmount(
        centsInput(
          schedule
            ? Math.max(0, schedule.dueAmountCentavos - schedule.paidAmountCentavos)
            : (workspace.nextDue?.amountCentavos ?? workspace.installmentAmountCentavos)
        )
      )
      setPenalty('0.00')
      setPaymentDate(format(new Date(), 'yyyy-MM-dd'))
      setReferenceNumber('')
      setAdjustmentReason('')
      setFormError(undefined)
      submissionIdRef.current = crypto.randomUUID()
      setIsPaymentOpen(true)
    },
    [workspace]
  )

  const openAdjustment = (
    schedule: InHouseScheduleRecord,
    payment?: InHousePaymentRecord
  ): void => {
    if (!workspace || schedule.paidAmountCentavos <= 0) return
    setPaymentMode('adjust')
    setSelectedSchedule(schedule)
    setSelectedPaymentId(payment?.id)
    setAmount(centsInput(payment?.amountCentavos ?? schedule.paidAmountCentavos))
    setPenalty(centsInput(payment?.penaltyCentavos ?? schedule.penaltyCentavos))
    setPaymentDate(format(new Date(), 'yyyy-MM-dd'))
    setReferenceNumber('')
    setAdjustmentReason('')
    setFormError(undefined)
    submissionIdRef.current = crypto.randomUUID()
    setIsPaymentOpen(true)
  }

  React.useEffect(() => {
    if (!workspace || !initialPaymentId || openedInitialPaymentRef.current === initialPaymentId)
      return
    const payment = workspace.payments.find((item) => item.id === initialPaymentId)
    const schedule = payment?.scheduleIds
      .map((scheduleId) => workspace.schedules.find((item) => item.id === scheduleId))
      .find((item): item is InHouseScheduleRecord => Boolean(item && item.paidAmountCentavos > 0))
    if (!payment || !schedule) return
    openedInitialPaymentRef.current = initialPaymentId
    setActiveTab('ledger')
    openAdjustment(schedule, payment)
  }, [initialPaymentId, workspace])

  const canRecordPayment =
    workspace?.account.branch === ownBranch &&
    workspace?.contractStatus === 'ACTIVE' &&
    workspace.accountStatus === 'ACTIVE' &&
    workspace.outstandingBalanceCentavos > 0
  const canAdjustPayment =
    workspace?.account.branch === ownBranch &&
    workspace?.contractStatus === 'ACTIVE' &&
    workspace.accountStatus === 'ACTIVE'

  React.useEffect(() => {
    if (!openRecordPayment || !canRecordPayment || openedRecordPaymentRef.current === accountId)
      return
    openedRecordPaymentRef.current = accountId
    setActiveTab('schedule')
    openPayment()
  }, [accountId, canRecordPayment, openPayment, openRecordPayment])
  const submitPayment = async (): Promise<void> => {
    if (!workspace || isSubmittingRef.current) return
    const amountCentavos = toCentavos(amount)
    const penaltyCentavos = toCentavos(penalty)
    if (amountCentavos === undefined || (paymentMode === 'record' && amountCentavos <= 0)) {
      setFormError('Enter a valid payment amount.')
      return
    }
    if (penaltyCentavos === undefined) {
      setFormError('Enter a valid penalty amount.')
      return
    }
    if (!paymentDate) {
      setFormError('Payment date is required.')
      return
    }
    isSubmittingRef.current = true
    setIsSaving(true)
    setFormError(undefined)
    try {
      if (paymentMode === 'adjust') {
        if (!selectedSchedule) throw new Error('Select an installment to adjust.')
        if (!adjustmentReason.trim()) {
          setFormError('Enter the reason for this adjustment.')
          return
        }
        await window.api.installments.adjustPayment({
          accountId,
          contractId: workspace.contractId,
          paymentId: selectedPaymentId,
          scheduleId: selectedSchedule.id,
          submissionId: submissionIdRef.current ?? crypto.randomUUID(),
          paymentDate,
          amountCentavos,
          penaltyCentavos,
          referenceNumber: referenceNumber.trim() || undefined,
          reason: adjustmentReason.trim(),
          actorUserId: userId
        })
      } else {
        await window.api.installments.createPayment({
          accountId,
          contractId: workspace.contractId,
          scheduleId: selectedSchedule?.id,
          submissionId: submissionIdRef.current ?? crypto.randomUUID(),
          paymentDate,
          amountCentavos,
          penaltyCentavos,
          referenceNumber: referenceNumber.trim() || undefined,
          actorUserId: userId
        })
      }
      setIsPaymentOpen(false)
      await load()
      window.dispatchEvent(new Event('installments:changed'))
      notify({
        type: 'success',
        title: paymentMode === 'adjust' ? 'Payment adjustment posted.' : 'Payment posted.'
      })
    } catch {
      const message =
        paymentMode === 'adjust'
          ? 'Payment adjustment could not be posted.'
          : 'Payment could not be posted.'
      setFormError(message)
      notify({ type: 'error', title: 'Payment action failed.', description: message })
    } finally {
      isSubmittingRef.current = false
      setIsSaving(false)
    }
  }

  if (error) {
    return (
      <Dialog open onOpenChange={(open) => !open && onBack()}>
        <DialogContent className="flex h-[min(90vh,58rem)] w-[min(96vw,90rem)] max-w-none items-center justify-center sm:max-w-none">
          <DialogTitle className="sr-only">Unable to open payment workspace</DialogTitle>
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Unable to open payment workspace</EmptyTitle>
              <EmptyDescription>{error}</EmptyDescription>
            </EmptyHeader>
            <Button type="button" variant="outline" onClick={() => void load()}>
              Retry
            </Button>
          </Empty>
        </DialogContent>
      </Dialog>
    )
  }

  if (isNotFound) {
    return (
      <Dialog open onOpenChange={(open) => !open && onBack()}>
        <DialogContent className="flex h-[min(90vh,58rem)] w-[min(96vw,90rem)] max-w-none items-center justify-center sm:max-w-none">
          <DialogTitle className="sr-only">Installment account not found</DialogTitle>
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Installment account not found</EmptyTitle>
              <EmptyDescription>
                This payment workspace requires a valid in-house installment account.
              </EmptyDescription>
            </EmptyHeader>
            <Button type="button" variant="outline" onClick={onBack}>
              <ArrowLeft data-icon="inline-start" />
              {backLabel}
            </Button>
          </Empty>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onBack()}>
      <DialogContent className="flex h-[min(90vh,58rem)] w-[min(96vw,90rem)] max-w-none flex-col gap-0 overflow-hidden p-3 sm:max-w-none">
        <DialogTitle className="sr-only">Installment payment workspace</DialogTitle>
        <div className="flex min-h-0 min-w-0 flex-1">
          <section className="flex min-h-0 min-w-0 flex-1 flex-col">
            <header className="flex shrink-0 flex-wrap items-start justify-between gap-3 bg-muted/30 px-3 py-2.5">
              <div className="flex min-w-0 items-start gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">In-house installment payment</p>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <h1 className="max-w-[32rem] truncate text-base font-semibold tracking-tight" />
                      }
                    >
                      {workspace ? formatAccountName(workspace.account) : 'Loading account…'}
                    </TooltipTrigger>
                    <TooltipContent>
                      {workspace ? formatAccountName(workspace.account) : 'Loading account'}
                    </TooltipContent>
                  </Tooltip>
                  {workspace && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {workspace.account.id} · {workspace.contractNumber} ·{' '}
                      {workspace.account.branch}
                    </p>
                  )}
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => openPayment()}
                disabled={!canRecordPayment}
              >
                Record payment
              </Button>
            </header>

            {workspace && (
              <section
                className="grid shrink-0 grid-cols-2 gap-3 bg-muted/30 p-3 md:grid-cols-4"
                aria-label="Account payment summary"
              >
                <KpiCard
                  label="Outstanding balance"
                  value={formatPhilippinePeso(workspace.outstandingBalanceCentavos / 100)}
                  emphasis
                />
                <KpiCard
                  label="Total paid"
                  value={formatPhilippinePeso(workspace.totalPaidCentavos / 100)}
                />
                <KpiCard
                  label="Next due"
                  value={workspace.nextDue ? formatDate(workspace.nextDue.dueDate) : '—'}
                />
                <KpiCard
                  label="Due now"
                  value={
                    workspace.nextDue
                      ? formatPhilippinePeso(workspace.nextDue.amountCentavos / 100)
                      : 'Paid in full'
                  }
                />
              </section>
            )}

            <Tabs
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as typeof activeTab)}
              className="min-h-0 flex-1 gap-0 bg-muted/30 px-3"
            >
              <div className="flex shrink-0 items-center justify-between gap-3 py-2">
                <TabsList variant="line" aria-label="Payment workspace views">
                  <TabsTrigger value="schedule">
                    <CalendarDays data-icon="inline-start" />
                    Payment schedule
                  </TabsTrigger>
                  <TabsTrigger value="ledger">
                    <ReceiptText data-icon="inline-start" />
                    Ledger
                  </TabsTrigger>
                </TabsList>
                {workspace && (
                  <Badge variant="outline" size="sm">
                    {workspace.paymentFrequency}
                  </Badge>
                )}
              </div>
              <TabsContent value="schedule" className="flex min-h-0 flex-1">
                <Card className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                  <CardContent className="flex min-h-0 min-w-0 flex-1 flex-col p-0">
                    <UniversalDataTable
                      table={scheduleTable}
                      recordCount={workspace?.schedules.length ?? 0}
                      isLoading={isLoading}
                      emptyMessage="No payment schedule is available for this contract."
                      showPagination={false}
                      onRowClick={(schedule) => {
                        if (schedule.status === 'WAIVED' || schedule.balanceCentavos <= 0) return
                        if (!canRecordPayment) return
                        openPayment(schedule)
                      }}
                      tableLayout={{ columnsResizable: true }}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="ledger" className="flex min-h-0 flex-1">
                <Card className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                  <CardContent className="flex min-h-0 min-w-0 flex-1 flex-col p-0">
                    <UniversalDataTable
                      table={paymentTable}
                      recordCount={workspace?.payments.length ?? 0}
                      isLoading={isLoading}
                      emptyMessage="No payments have been recorded for this contract."
                      showPagination={false}
                      onRowClick={(payment) => {
                        if (payment.status !== 'POSTED' || !canAdjustPayment) return
                        const schedule = payment.scheduleIds
                          .map((scheduleId) =>
                            workspace?.schedules.find((item) => item.id === scheduleId)
                          )
                          .find((item): item is InHouseScheduleRecord => Boolean(item))
                        if (schedule) openAdjustment(schedule, payment)
                      }}
                      tableLayout={{ columnsResizable: true }}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </section>
          {isPaymentOpen && (
            <aside className="flex w-[26rem] max-w-[42%] shrink-0 flex-col border-l bg-background">
              <header className="shrink-0 border-b px-5 pb-4 pt-5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {paymentMode === 'adjust' ? 'Payment adjustment' : 'Record payment'}
                </p>
                <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] items-end gap-4">
                  <div className="min-w-0">
                    <h2 className="text-5xl font-semibold leading-none tracking-tighter text-primary tabular-nums">
                      #
                      {selectedSchedule?.installmentNumber ??
                        workspace?.nextDue?.installmentNumber ??
                        'â€”'}
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">Installment</p>
                  </div>
                  <div className="min-w-0 border-l border-primary/40 pl-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Balance
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold text-primary tabular-nums">
                      {selectedSchedule
                        ? formatPhilippinePeso(selectedSchedule.balanceCentavos / 100)
                        : workspace?.nextDue
                          ? formatPhilippinePeso(workspace.nextDue.amountCentavos / 100)
                          : 'Paid'}
                    </p>
                  </div>
                  <div className="min-w-0 border-l border-primary/40 pl-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Due date
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold text-primary tabular-nums">
                      {selectedSchedule
                        ? formatDate(selectedSchedule.dueDate)
                        : workspace?.nextDue
                          ? formatDate(workspace.nextDue.dueDate)
                          : 'â€”'}
                    </p>
                  </div>
                </div>
              </header>
              <ScrollArea className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4">
                <div className="flex flex-col gap-5 py-4">
                  <Separator />
                  <FieldGroup>
                    <Field data-invalid={Boolean(formError)}>
                      <FieldLabel htmlFor="payment-amount">Amount received</FieldLabel>
                      <AmountInputGroup
                        id="payment-amount"
                        name="payment-amount"
                        value={amount}
                        onValueChange={setAmount}
                        inputClassName="text-foreground"
                        ariaInvalid={Boolean(formError)}
                        autoFocus
                        description={
                          paymentMode === 'adjust'
                            ? 'Use 0.00 to void this installment payment without a replacement amount.'
                            : 'Any amount above this installment is applied to following installments.'
                        }
                      />
                    </Field>
                    <Field
                      className={
                        Number(penalty.replaceAll(',', '')) > 0
                          ? undefined
                          : 'text-muted-foreground'
                      }
                    >
                      <FieldLabel htmlFor="payment-penalty">Penalty</FieldLabel>
                      <AmountInputGroup
                        id="payment-penalty"
                        name="payment-penalty"
                        value={penalty}
                        onValueChange={setPenalty}
                        placeholder="0.00"
                        inputClassName={
                          Number(penalty.replaceAll(',', '')) > 0 ? 'text-destructive' : undefined
                        }
                        description="Displayed separately and excluded from balances."
                      />
                    </Field>
                    <PaymentDateField value={paymentDate} onChange={setPaymentDate} />
                    <Field>
                      <FieldLabel htmlFor="payment-reference">OR / reference number</FieldLabel>
                      <Input
                        id="payment-reference"
                        value={referenceNumber}
                        onChange={(event) => setReferenceNumber(event.target.value)}
                        placeholder="Optional"
                        maxLength={100}
                      />
                    </Field>
                    {paymentMode === 'adjust' && (
                      <Field data-invalid={Boolean(formError && !adjustmentReason.trim())}>
                        <FieldLabel htmlFor="payment-adjustment-reason">
                          Adjustment reason
                        </FieldLabel>
                        <Input
                          id="payment-adjustment-reason"
                          value={adjustmentReason}
                          onChange={(event) => setAdjustmentReason(event.target.value)}
                          placeholder="Required"
                          maxLength={1000}
                          aria-invalid={Boolean(formError && !adjustmentReason.trim())}
                        />
                        <FieldDescription>
                          The original payment remains in the ledger as voided.
                        </FieldDescription>
                      </Field>
                    )}
                    {formError && <FieldError>{formError}</FieldError>}
                  </FieldGroup>
                </div>
              </ScrollArea>
              <footer className="flex shrink-0 justify-end gap-2 border-t px-4 py-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsPaymentOpen(false)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={() => void submitPayment()} disabled={isSaving}>
                  {isSaving
                    ? paymentMode === 'adjust'
                      ? 'Adjusting…'
                      : 'Posting…'
                    : paymentMode === 'adjust'
                      ? 'Void & repost'
                      : 'Post Payment'}
                </Button>
              </footer>
            </aside>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
