import * as React from 'react'
import { ArrowLeft, CalendarDays, CalendarIcon, ReceiptText } from 'lucide-react'
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef
} from '@tanstack/react-table'
import { format } from 'date-fns'

import { UniversalDataTable } from '@/components/shared/data-table/universal-data-table'
import { InHouseAccountInspector } from '@/features/in-house-accounts/components/account-inspector'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText
} from '@/components/ui/input-group'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge, type BadgeProps } from '@/components/ui/reui/badge'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DataGridColumnHeader } from '@/components/ui/reui/data-grid/data-grid-column-header'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatPhilippinePeso } from '@/lib/currency'
import { branchNames, formatAccountName, type InHouseAccount } from '@/lib/in-house-accounts'
import { type AccountMonitoringMeta } from '@/lib/in-house-account-monitoring'
import { cn } from '@/lib/utils'
import { useNotifications } from '@/hooks/use-notifications'
import type {
  InHousePaymentRecord,
  InHouseScheduleRecord,
  InstallmentPaymentWorkspace
} from '../../../../../shared/contracts'

type Props = {
  readonly accountId: string
  readonly initialTab?: 'schedule' | 'ledger'
  readonly backLabel: string
  readonly onBack: () => void
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
  status: InHouseScheduleRecord['status'] | InHousePaymentRecord['status']
): NonNullable<BadgeProps['variant']> {
  if (status === 'PAID' || status === 'POSTED') return 'success-light' as const
  if (status === 'PARTIALLY_PAID') return 'warning-light' as const
  if (status === 'DUE' || status === 'VOIDED') return 'destructive-light' as const
  if (status === 'WAIVED') return 'secondary' as const
  return 'outline' as const
}

function scheduleValueClass(row: InHouseScheduleRecord, className?: string): string {
  return cn(row.paidAmountCentavos === 0 && 'text-muted-foreground', className)
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(false)

  React.useEffect(() => {
    const media = window.matchMedia(query)
    const update = (): void => setMatches(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [query])

  return matches
}

function accountForInspector(
  account: InstallmentPaymentWorkspace['account'] | undefined
): InHouseAccount | undefined {
  if (!account) return undefined
  const branch =
    branchNames.find((value) => value.toLowerCase() === account.branch.toLowerCase()) ?? 'Lagonoy'
  return { ...account, branch }
}

function paymentWorkspaceMeta(
  workspace: InstallmentPaymentWorkspace | undefined
): AccountMonitoringMeta | undefined {
  if (!workspace) return undefined

  return {
    status:
      workspace.accountStatus === 'BLACKLISTED'
        ? 'blacklisted'
        : workspace.contractStatus === 'CLOSED'
          ? 'closed'
          : workspace.outstandingBalanceCentavos === 0
            ? 'fully-paid'
            : 'active',
    nextDue: workspace.nextDue?.dueDate,
    outstandingBalance: workspace.outstandingBalanceCentavos / 100,
    paymentFrequency: workspace.paymentFrequency,
    lastPayment: workspace.payments.find((payment) => payment.status === 'POSTED')?.paymentDate,
    terms: workspace.schedules.length ? `${workspace.schedules.length} installments` : undefined,
    installmentAmount: workspace.installmentAmountCentavos / 100,
    grandTotal: workspace.totalPayableCentavos / 100,
    totalPaid: workspace.totalPaidCentavos / 100
  }
}

function PaymentDateField({
  value,
  onChange
}: {
  readonly value: string
  readonly onChange: (value: string) => void
}): React.JSX.Element {
  const [open, setOpen] = React.useState(false)
  const selected = value ? new Date(`${value}T00:00:00`) : undefined

  return (
    <Field>
      <FieldLabel htmlFor="payment-date">Payment date</FieldLabel>
      <InputGroup>
        <InputGroupInput
          id="payment-date"
          value={value ? formatDate(value) : ''}
          readOnly
          aria-label="Payment date"
        />
        <InputGroupAddon align="inline-end">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Select payment date"
                />
              }
            >
              <CalendarIcon />
            </PopoverTrigger>
            <PopoverContent className="w-auto overflow-hidden p-0" align="end">
              <Calendar
                mode="single"
                selected={selected}
                onSelect={(nextDate) => {
                  if (!nextDate) return
                  onChange(format(nextDate, 'yyyy-MM-dd'))
                  setOpen(false)
                }}
              />
            </PopoverContent>
          </Popover>
        </InputGroupAddon>
      </InputGroup>
    </Field>
  )
}

function scheduleColumns(): ColumnDef<InHouseScheduleRecord>[] {
  return [
    {
      id: 'installment',
      accessorKey: 'installmentNumber',
      header: ({ column }) => <DataGridColumnHeader column={column} title="#" />,
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
      header: ({ column }) => <DataGridColumnHeader column={column} title="Due date" />,
      size: 112,
      cell: ({ row }) => (
        <span className={scheduleValueClass(row.original)}>{formatDate(row.original.dueDate)}</span>
      )
    },
    {
      id: 'dueAmount',
      accessorKey: 'dueAmountCentavos',
      header: ({ column }) => <DataGridColumnHeader column={column} title="Due amount" />,
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
      header: ({ column }) => <DataGridColumnHeader column={column} title="Paid" />,
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
      header: ({ column }) => <DataGridColumnHeader column={column} title="Balance" />,
      size: 140,
      meta: { headerClassName: 'text-right', cellClassName: 'text-right font-light tabular-nums' },
      cell: ({ row }) => (
        <span className={scheduleValueClass(row.original)}>
          {formatPhilippinePeso(row.original.balanceCentavos / 100)}
        </span>
      )
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: ({ column }) => <DataGridColumnHeader column={column} title="Status" />,
      size: 190,
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-1">
          <Badge variant={statusVariant(row.original.status)}>{row.original.status}</Badge>
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
      header: ({ column }) => <DataGridColumnHeader column={column} title="Payment date" />,
      size: 150,
      cell: ({ row }) => formatDate(row.original.paymentDate)
    },
    {
      id: 'reference',
      accessorKey: 'referenceNumber',
      header: ({ column }) => <DataGridColumnHeader column={column} title="OR / reference" />,
      size: 220,
      meta: { cellClassName: 'truncate text-muted-foreground' },
      cell: ({ row }) => row.original.referenceNumber || '—'
    },
    {
      id: 'amount',
      accessorKey: 'amountCentavos',
      header: ({ column }) => <DataGridColumnHeader column={column} title="Amount received" />,
      size: 170,
      meta: { headerClassName: 'text-right', cellClassName: 'text-right font-light tabular-nums' },
      cell: ({ row }) => formatPhilippinePeso(row.original.amountCentavos / 100)
    },
    {
      id: 'allocated',
      accessorKey: 'allocatedAmountCentavos',
      header: ({ column }) => <DataGridColumnHeader column={column} title="Allocated" />,
      size: 140,
      meta: { headerClassName: 'text-right', cellClassName: 'text-right tabular-nums' },
      cell: ({ row }) => formatPhilippinePeso(row.original.allocatedAmountCentavos / 100)
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: ({ column }) => <DataGridColumnHeader column={column} title="Status" />,
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
  initialTab = 'schedule',
  backLabel,
  onBack
}: Props): React.JSX.Element {
  const isInspectorSheet = useMediaQuery('(max-width: 1099px)')
  const [workspace, setWorkspace] = React.useState<InstallmentPaymentWorkspace>()
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string>()
  const [isNotFound, setIsNotFound] = React.useState(false)
  const [isPaymentOpen, setIsPaymentOpen] = React.useState(false)
  const [paymentMode, setPaymentMode] = React.useState<'record' | 'adjust'>('record')
  const [selectedSchedule, setSelectedSchedule] = React.useState<InHouseScheduleRecord>()
  const [isInspectorOpen, setIsInspectorOpen] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState(initialTab)
  const [amount, setAmount] = React.useState('')
  const [paymentDate, setPaymentDate] = React.useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [referenceNumber, setReferenceNumber] = React.useState('')
  const [adjustmentReason, setAdjustmentReason] = React.useState('')
  const [formError, setFormError] = React.useState<string>()
  const [isSaving, setIsSaving] = React.useState(false)
  const { notify } = useNotifications()
  const loadRequestId = React.useRef(0)
  const isSubmittingRef = React.useRef(false)
  const submissionIdRef = React.useRef<string | undefined>(undefined)

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
      const nextWorkspace = await window.api.installments.getPaymentWorkspace({ accountId })
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
  }, [accountId, notify])

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
  const openPayment = (schedule?: InHouseScheduleRecord): void => {
    if (!workspace) return
    setPaymentMode('record')
    setSelectedSchedule(schedule)
    setAmount(
      centsInput(
        schedule
          ? Math.max(0, schedule.dueAmountCentavos - schedule.paidAmountCentavos)
          : (workspace.nextDue?.amountCentavos ?? workspace.installmentAmountCentavos)
      )
    )
    setPaymentDate(format(new Date(), 'yyyy-MM-dd'))
    setReferenceNumber('')
    setAdjustmentReason('')
    setFormError(undefined)
    submissionIdRef.current = crypto.randomUUID()
    setIsPaymentOpen(true)
  }

  const openAdjustment = (schedule: InHouseScheduleRecord): void => {
    if (!workspace || schedule.paidAmountCentavos <= 0) return
    setPaymentMode('adjust')
    setSelectedSchedule(schedule)
    setAmount(centsInput(schedule.paidAmountCentavos))
    setPaymentDate(format(new Date(), 'yyyy-MM-dd'))
    setReferenceNumber('')
    setAdjustmentReason('')
    setFormError(undefined)
    submissionIdRef.current = crypto.randomUUID()
    setIsPaymentOpen(true)
  }

  const canRecordPayment =
    workspace?.contractStatus === 'ACTIVE' &&
    workspace.accountStatus === 'ACTIVE' &&
    workspace.outstandingBalanceCentavos > 0
  const inspectorAccount = React.useMemo(() => accountForInspector(workspace?.account), [workspace])
  const inspectorMeta = React.useMemo(() => paymentWorkspaceMeta(workspace), [workspace])

  const submitPayment = async (): Promise<void> => {
    if (!workspace || isSubmittingRef.current) return
    const amountCentavos = toCentavos(amount)
    if (amountCentavos === undefined || (paymentMode === 'record' && amountCentavos <= 0)) {
      setFormError('Enter a valid payment amount.')
      return
    }
    const maximum =
      paymentMode === 'adjust' && selectedSchedule
        ? selectedSchedule.dueAmountCentavos
        : selectedSchedule
          ? selectedSchedule.dueAmountCentavos - selectedSchedule.paidAmountCentavos
          : workspace.outstandingBalanceCentavos
    if (amountCentavos > maximum) {
      setFormError('Payment amount cannot exceed the remaining balance.')
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
          scheduleId: selectedSchedule.id,
          submissionId: submissionIdRef.current ?? crypto.randomUUID(),
          paymentDate,
          amountCentavos,
          referenceNumber: referenceNumber.trim() || undefined,
          reason: adjustmentReason.trim(),
          actorUserId: 'development-cashier'
        })
      } else {
        await window.api.installments.createPayment({
          accountId,
          contractId: workspace.contractId,
          scheduleId: selectedSchedule?.id,
          submissionId: submissionIdRef.current ?? crypto.randomUUID(),
          paymentDate,
          amountCentavos,
          referenceNumber: referenceNumber.trim() || undefined,
          actorUserId: 'development-cashier'
        })
      }
      setIsPaymentOpen(false)
      await load()
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
      <main className="flex min-h-0 min-w-0 flex-1 items-center justify-center p-3">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Unable to open payment workspace</EmptyTitle>
            <EmptyDescription>{error}</EmptyDescription>
          </EmptyHeader>
          <Button type="button" variant="outline" onClick={() => void load()}>
            Retry
          </Button>
        </Empty>
      </main>
    )
  }

  if (isNotFound) {
    return (
      <main className="flex min-h-0 min-w-0 flex-1 items-center justify-center p-3">
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
      </main>
    )
  }

  return (
    <main className="flex min-h-0 min-w-0 flex-1 overflow-hidden p-3">
      <div className="grid h-full min-h-0 w-full min-w-0 grid-cols-[minmax(0,1fr)_clamp(20rem,24vw,24rem)] gap-3 max-[1099px]:grid-cols-1">
        <Card className="flex min-h-0 min-w-0 flex-col">
          <CardContent className="flex min-h-0 min-w-0 flex-1 flex-col p-0">
            <header className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b px-4 py-2.5">
              <div className="flex min-w-0 items-start gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={onBack}>
                  <ArrowLeft />
                  <span className="sr-only">{backLabel}</span>
                </Button>
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
              {isInspectorSheet && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsInspectorOpen(true)}
                >
                  Account Details
                </Button>
              )}
            </header>

            {workspace && (
              <section
                className="grid shrink-0 grid-cols-2 divide-x divide-y border-b md:grid-cols-4 md:divide-y-0"
                aria-label="Account payment summary"
              >
                <SummaryMetric
                  label="Outstanding balance"
                  value={formatPhilippinePeso(workspace.outstandingBalanceCentavos / 100)}
                  emphasis
                />
                <SummaryMetric
                  label="Total paid"
                  value={formatPhilippinePeso(workspace.totalPaidCentavos / 100)}
                />
                <SummaryMetric
                  label="Next due"
                  value={workspace.nextDue ? formatDate(workspace.nextDue.dueDate) : '—'}
                />
                <SummaryMetric
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
              className="min-h-0 flex-1 gap-0"
            >
              <div className="flex shrink-0 items-center justify-between gap-3 border-b px-4">
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
                <UniversalDataTable
                  table={scheduleTable}
                  recordCount={workspace?.schedules.length ?? 0}
                  isLoading={isLoading}
                  emptyMessage="No payment schedule is available for this contract."
                  showPagination={false}
                  onRowDoubleClick={(schedule) => {
                    if (schedule.status === 'WAIVED') return
                    if (schedule.paidAmountCentavos > 0) openAdjustment(schedule)
                    else openPayment(schedule)
                  }}
                  tableLayout={{ columnsResizable: true }}
                />
              </TabsContent>
              <TabsContent value="ledger" className="flex min-h-0 flex-1">
                <UniversalDataTable
                  table={paymentTable}
                  recordCount={workspace?.payments.length ?? 0}
                  isLoading={isLoading}
                  emptyMessage="No payments have been recorded for this contract."
                  showPagination={false}
                  tableLayout={{ columnsResizable: true }}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {!isInspectorSheet && (
          <Card className="flex min-h-0 min-w-0 flex-col">
            <InHouseAccountInspector
              account={inspectorAccount}
              meta={inspectorMeta}
              isLoading={isLoading}
              onRecordPayment={canRecordPayment ? () => openPayment() : undefined}
              onViewLedger={() => setActiveTab('ledger')}
            />
          </Card>
        )}
      </div>

      {isInspectorSheet && (
        <Sheet open={isInspectorOpen} onOpenChange={setIsInspectorOpen}>
          <SheetContent
            side="right"
            showCloseButton={false}
            className="w-full p-0 sm:w-[clamp(20rem,70vw,24rem)]"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Account details</SheetTitle>
              <SheetDescription>Full details for this installment account.</SheetDescription>
            </SheetHeader>
            <InHouseAccountInspector
              account={inspectorAccount}
              meta={inspectorMeta}
              isLoading={isLoading}
              isSheet
              onRecordPayment={canRecordPayment ? () => openPayment() : undefined}
              onViewLedger={() => {
                setActiveTab('ledger')
                setIsInspectorOpen(false)
              }}
              onClose={() => setIsInspectorOpen(false)}
            />
          </SheetContent>
        </Sheet>
      )}

      <Sheet open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md" showCloseButton={false}>
          <SheetHeader className="border-b px-5 py-4">
            <SheetTitle>
              {paymentMode === 'adjust' ? 'Adjust payment' : 'Record payment'}
            </SheetTitle>
            <SheetDescription>
              {paymentMode === 'adjust'
                ? `Void and repost payment activity for installment #${selectedSchedule?.installmentNumber}.`
                : selectedSchedule
                  ? `Apply this payment to installment #${selectedSchedule.installmentNumber}.`
                  : workspace?.nextDue
                    ? `Apply this payment to installment #${workspace.nextDue.installmentNumber} first.`
                    : 'Post a payment against this account.'}
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-5 p-5">
              <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/20 p-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Remaining balance</p>
                  <p className="mt-1 font-medium tabular-nums">
                    {workspace && formatPhilippinePeso(workspace.outstandingBalanceCentavos / 100)}
                  </p>
                </div>
                <div className="border-l pl-3">
                  <p className="text-xs text-muted-foreground">
                    {paymentMode === 'adjust' ? 'Installment amount' : 'Selected installment'}
                  </p>
                  <p className="mt-1 font-medium tabular-nums">
                    {selectedSchedule
                      ? formatPhilippinePeso(selectedSchedule.dueAmountCentavos / 100)
                      : workspace?.nextDue
                        ? formatPhilippinePeso(workspace.nextDue.amountCentavos / 100)
                        : 'Paid in full'}
                  </p>
                </div>
              </div>
              <Separator />
              <FieldGroup>
                <Field data-invalid={Boolean(formError)}>
                  <FieldLabel htmlFor="payment-amount">Amount received</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <InputGroupText>₱</InputGroupText>
                    </InputGroupAddon>
                    <InputGroupInput
                      id="payment-amount"
                      inputMode="decimal"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      aria-invalid={Boolean(formError)}
                      autoFocus
                    />
                  </InputGroup>
                  <FieldDescription>
                    {paymentMode === 'adjust'
                      ? 'Use 0.00 to void this installment payment without a replacement amount.'
                      : 'Payment cannot exceed the selected installment balance.'}
                  </FieldDescription>
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
                    <FieldLabel htmlFor="payment-adjustment-reason">Adjustment reason</FieldLabel>
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
          <SheetFooter className="flex-row justify-end border-t px-5 py-4">
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
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </main>
  )
}

function SummaryMetric({
  label,
  value,
  emphasis = false
}: {
  readonly label: string
  readonly value: string
  readonly emphasis?: boolean
}): React.JSX.Element {
  return (
    <div className="min-w-0 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('mt-1 truncate tabular-nums', emphasis ? 'font-semibold' : 'font-light')}>
        {value}
      </p>
    </div>
  )
}
