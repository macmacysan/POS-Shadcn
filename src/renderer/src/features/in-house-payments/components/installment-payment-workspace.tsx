import * as React from 'react'
import { ArrowLeft, CalendarDays, Lock, ReceiptText } from 'lucide-react'
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef
} from '@tanstack/react-table'
import { format } from 'date-fns'

import { UniversalDataTable } from '@/components/shared/data-table/universal-data-table'
import { RowActions } from '@/components/shared/data-table/row-actions'
import { VoidEntryDialog } from '@/components/shared/void-entry-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { KpiCard } from '@/components/shared/kpi-card'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
  status: InHouseScheduleRecord['status'] | InHousePaymentRecord['status'] | 'UPCOMING' | 'OVERDUE'
): NonNullable<BadgeProps['variant']> {
  if (status === 'PAID' || status === 'POSTED') return 'success-light' as const
  if (status === 'PARTIALLY_PAID' || status === 'DUE') return 'warning-light' as const
  if (status === 'OVERDUE' || status === 'VOIDED') return 'destructive-light' as const
  if (status === 'WAIVED') return 'secondary' as const
  return 'outline' as const
}

function scheduleStatusLabel(
  row: InHouseScheduleRecord
): InHouseScheduleRecord['status'] | 'UPCOMING' | 'OVERDUE' {
  if (row.status !== 'DUE') return row.status
  const today = format(new Date(), 'yyyy-MM-dd')
  if (row.dueDate < today) return 'OVERDUE'
  return row.dueDate === today ? 'DUE' : 'UPCOMING'
}

function scheduleStatusText(status: ReturnType<typeof scheduleStatusLabel>): string {
  return {
    PAID: 'Paid',
    PARTIALLY_PAID: 'Partial',
    UPCOMING: 'Upcoming',
    DUE: 'Due',
    OVERDUE: 'Overdue',
    WAIVED: 'Waived'
  }[status]
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

function scheduleColumns(
  schedules: readonly InHouseScheduleRecord[],
  firstUpcomingScheduleId: string | undefined
): ColumnDef<InHouseScheduleRecord>[] {
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
      id: 'status',
      accessorKey: 'status',
      header: 'Status',
      size: 128,
      cell: ({ row }) => {
        const isLocked =
          scheduleStatusLabel(row.original) === 'UPCOMING' &&
          row.original.id !== firstUpcomingScheduleId
        return (
          <div className="flex items-center gap-1">
            <Badge variant={statusVariant(scheduleStatusLabel(row.original))}>
              {scheduleStatusText(scheduleStatusLabel(row.original))}
            </Badge>
            {isLocked && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span className="inline-flex text-muted-foreground" aria-label="Payment locked" />
                  }
                >
                  <Lock className="size-3" aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent>Pay the preceding installment first.</TooltipContent>
              </Tooltip>
            )}
          </div>
        )
      }
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
      id: 'lastApplied',
      accessorKey: 'lastAppliedDate',
      header: 'Payment date',
      size: 132,
      meta: { headerClassName: 'text-left', cellClassName: 'text-left' },
      cell: ({ row }) => {
        const paymentDate = row.original.lastAppliedDate
        if (!paymentDate) return <span className="text-muted-foreground">—</span>

        const previous = schedules[row.index - 1]
        const next = schedules[row.index + 1]
        const isContinuation = previous?.lastAppliedDate === paymentDate
        const isAdvance =
          paymentDate < row.original.dueDate ||
          (!isContinuation &&
            next?.lastAppliedDate === paymentDate &&
            paymentDate < next.dueDate)

        return (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span>{isContinuation ? `↳ ${formatDate(paymentDate)}` : formatDate(paymentDate)}</span>
            {!isContinuation && isAdvance && (
              <Badge variant="warning-light" size="sm">
                ADVANCE
              </Badge>
            )}
          </div>
        )
      }
    },
    {
      id: 'paid',
      accessorKey: 'paidAmountCentavos',
      header: 'Allocated',
      size: 130,
      meta: { headerClassName: 'text-right', cellClassName: 'text-right tabular-nums' },
      cell: ({ row }) =>
        row.original.paidAmountCentavos === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span>{formatPhilippinePeso(row.original.paidAmountCentavos / 100)}</span>
        )
    },
    {
      id: 'remaining',
      accessorKey: 'remainingDueCentavos',
      header: 'Remaining',
      size: 130,
      meta: { headerClassName: 'text-right', cellClassName: 'text-right tabular-nums' },
      cell: ({ row }) => (
        <span className={cn(row.original.remainingDueCentavos === 0 && 'text-muted-foreground')}>
          {formatPhilippinePeso(row.original.remainingDueCentavos / 100)}
        </span>
      )
    },
    {
      id: 'balance',
      accessorKey: 'balanceCentavos',
      header: 'Loan balance',
      size: 140,
      meta: { headerClassName: 'text-right', cellClassName: 'text-right font-light tabular-nums' },
      cell: ({ row }) => (
        <span className="text-muted-foreground">
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
        <span
          className={cn(
            row.original.penaltyCentavos === 0 ? 'text-muted-foreground' : 'text-warning'
          )}
        >
          {formatPhilippinePeso(row.original.penaltyCentavos / 100)}
        </span>
      )
    },
  ]
}

function formatScheduleCoverage(
  scheduleIds: readonly string[],
  scheduleNumbers: ReadonlyMap<string, number>
): string {
  const numbers = scheduleIds
    .map((id) => scheduleNumbers.get(id))
    .filter((number): number is number => number !== undefined)
    .sort((left, right) => left - right)
  const [first, ...remaining] = [...new Set(numbers)]
  if (first === undefined) return '—'

  const ranges: string[] = []
  let start = first
  let end = start
  for (const number of remaining) {
    if (number === end + 1) end = number
    else {
      ranges.push(start === end ? `#${start}` : `#${start}–#${end}`)
      start = number
      end = number
    }
  }
  ranges.push(start === end ? `#${start}` : `#${start}–#${end}`)
  return ranges.join(', ')
}

function paymentColumns(
  schedules: readonly InHouseScheduleRecord[],
  onVoid: ((payment: InHousePaymentRecord) => void) | undefined
): ColumnDef<InHousePaymentRecord>[] {
  const scheduleNumbers = new Map(schedules.map((schedule) => [schedule.id, schedule.installmentNumber]))
  return [
    {
      id: 'paymentNumber',
      header: 'Payment no.',
      size: 90,
      meta: { cellClassName: 'text-muted-foreground tabular-nums' },
      cell: ({ row }) => row.index + 1
    },
    {
      id: 'paymentDate',
      accessorKey: 'paymentDate',
      header: 'Payment date',
      size: 110,
      cell: ({ row }) => formatDate(row.original.paymentDate)
    },
    {
      id: 'covers',
      header: 'Covers',
      size: 65,
      meta: { cellClassName: 'text-muted-foreground tabular-nums' },
      cell: ({ row }) => formatScheduleCoverage(row.original.scheduleIds, scheduleNumbers)
    },
    {
      id: 'reference',
      accessorKey: 'referenceNumber',
      header: 'OR',
      size: 80,
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
      id: 'penalty',
      accessorKey: 'penaltyCentavos',
      header: 'Penalty',
      size: 100,
      meta: { headerClassName: 'text-right', cellClassName: 'text-right tabular-nums' },
      cell: ({ row }) => (
        <span
          className={cn(
            row.original.penaltyCentavos === 0 ? 'text-muted-foreground' : 'text-warning'
          )}
        >
          {formatPhilippinePeso(row.original.penaltyCentavos / 100)}
        </span>
      )
    },
    {
      id: 'remarks',
      accessorKey: 'remarks',
      header: 'Remarks',
      size: 160,
      meta: { cellClassName: 'truncate text-muted-foreground' },
      cell: ({ row }) => row.original.remarks || '—'
    },
    {
      id: 'updatedBy',
      accessorKey: 'updatedByName',
      header: 'Updated by',
      size: 160,
      meta: { cellClassName: 'text-muted-foreground' },
      cell: ({ row }) => row.original.updatedByName || '—'
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: 'Status',
      size: 128,
      cell: ({ row }) => <Badge variant={statusVariant(row.original.status)}>{row.original.status}</Badge>
    },
    {
      id: 'actions',
      header: 'Actions',
      size: 56,
      cell: ({ row }) =>
        onVoid && (
          <RowActions
            label="Payment actions"
            className="size-5"
            actions={[
              {
                id: 'void',
                label: 'Void entry',
                destructive: true,
                onSelect: () => onVoid(row.original)
              }
            ]}
          />
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
  const [selectedScheduleId, setSelectedScheduleId] = React.useState<string>()
  const [selectedPaymentId, setSelectedPaymentId] = React.useState<string>()
  const [paymentToVoid, setPaymentToVoid] = React.useState<InHousePaymentRecord>()
  const [activeTab, setActiveTab] = React.useState(initialTab)
  const [amount, setAmount] = React.useState('')
  const [penalty, setPenalty] = React.useState('0.00')
  const [paymentDate, setPaymentDate] = React.useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [referenceNumber, setReferenceNumber] = React.useState('')
  const [remarks, setRemarks] = React.useState('')
  const [formError, setFormError] = React.useState<string>()
  const [isSaving, setIsSaving] = React.useState(false)
  const { notify } = useNotifications()
  const loadRequestId = React.useRef(0)
  const isSubmittingRef = React.useRef(false)
  const submissionIdRef = React.useRef<string | undefined>(undefined)
  const openedInitialPaymentRef = React.useRef<string | undefined>(undefined)
  const openedRecordPaymentRef = React.useRef<string | undefined>(undefined)
  const canRecordPayment =
    workspace?.account.branch === ownBranch &&
    workspace?.contractStatus === 'ACTIVE' &&
    workspace.accountStatus === 'ACTIVE' &&
    workspace.outstandingBalanceCentavos > 0
  const canAdjustPayment =
    workspace?.account.branch === ownBranch &&
    workspace?.contractStatus === 'ACTIVE' &&
    workspace.accountStatus === 'ACTIVE'
  const firstUpcomingScheduleId = React.useMemo(
    () =>
      workspace?.schedules.find((schedule) => scheduleStatusLabel(schedule) === 'UPCOMING')?.id,
    [workspace?.schedules]
  )

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
    columns: React.useMemo(
      () => scheduleColumns(workspace?.schedules ?? [], firstUpcomingScheduleId),
      [firstUpcomingScheduleId, workspace?.schedules]
    ),
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
    getRowId: (row) => row.id
  })
  const paymentTable = useReactTable({
    data: workspace?.payments ?? [],
    columns: React.useMemo(
      () => paymentColumns(workspace?.schedules ?? [], canAdjustPayment ? setPaymentToVoid : undefined),
      [canAdjustPayment, workspace?.schedules]
    ),
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
      setRemarks('')
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
    setPaymentDate(payment?.paymentDate ?? format(new Date(), 'yyyy-MM-dd'))
    setReferenceNumber(payment?.referenceNumber ?? '')
    setRemarks('')
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
        if (!remarks.trim()) {
          setFormError('Enter adjustment remarks.')
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
          remarks: remarks.trim() || undefined,
          reason: remarks.trim(),
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
          remarks: remarks.trim() || undefined,
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

  const voidPayment = (reason: string): void => {
    const payment = paymentToVoid
    if (!payment) return
    setPaymentToVoid(undefined)
    void (async () => {
      try {
        await window.api.installments.voidPayments({ paymentIds: payment.paymentIds, reason })
        setSelectedPaymentId(undefined)
        await load()
        window.dispatchEvent(new Event('installments:changed'))
        notify({ type: 'success', title: 'Payment voided.' })
      } catch {
        notify({ type: 'error', title: 'Payment could not be voided.' })
      }
    })()
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
                      selectedRowId={selectedScheduleId}
                      onRowClick={(schedule) => {
                        if (schedule.status === 'WAIVED') return
                        setSelectedScheduleId(schedule.id)
                        const payment = workspace?.payments.find((item) =>
                          item.scheduleIds.includes(schedule.id)
                        )
                        if (payment && schedule.status === 'PAID') {
                          setActiveTab('ledger')
                          openAdjustment(schedule, payment)
                          return
                        }
                        if (
                          scheduleStatusLabel(schedule) === 'UPCOMING' &&
                          schedule.id !== firstUpcomingScheduleId
                        )
                          return
                        if (schedule.balanceCentavos <= 0) return
                        if (!canRecordPayment) return
                        openPayment(schedule)
                      }}
                      getRowClassName={(schedule) =>
                        cn(
                          schedule.id === firstUpcomingScheduleId && 'bg-primary/5 font-medium',
                          scheduleStatusLabel(schedule) === 'UPCOMING' &&
                            schedule.id !== firstUpcomingScheduleId &&
                            'opacity-50 !cursor-not-allowed'
                        )
                      }
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
                      selectedRowId={selectedPaymentId}
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
                <div className="mt-3">
                  <div className="min-w-0">
                    <h2 className="text-5xl font-semibold leading-none tracking-tighter text-primary tabular-nums">
                      #
                      {selectedSchedule?.installmentNumber ??
                        workspace?.nextDue?.installmentNumber ??
                        'â€”'}
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">Installment</p>
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
                    <Field data-invalid={paymentMode === 'adjust' && Boolean(formError && !remarks.trim())}>
                      <FieldLabel htmlFor="payment-remarks">Remarks</FieldLabel>
                      <Textarea
                        id="payment-remarks"
                        value={remarks}
                        onChange={(event) => setRemarks(event.target.value)}
                        placeholder={paymentMode === 'adjust' ? 'Required' : 'Optional'}
                        maxLength={1000}
                        aria-invalid={paymentMode === 'adjust' && Boolean(formError && !remarks.trim())}
                      />
                      {paymentMode === 'adjust' && (
                        <FieldDescription>
                          The original payment remains in the ledger as voided.
                        </FieldDescription>
                      )}
                    </Field>
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
        <VoidEntryDialog
          open={Boolean(paymentToVoid)}
          label="payment"
          onOpenChange={(open) => !open && setPaymentToVoid(undefined)}
          onConfirm={voidPayment}
        />
      </DialogContent>
    </Dialog>
  )
}
