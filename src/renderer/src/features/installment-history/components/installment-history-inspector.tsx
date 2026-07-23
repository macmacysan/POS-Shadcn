import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  actionLabels,
  formatHistoryDate,
  formatHistoryDateTime,
  formatHistoryMoney,
  sourceLabels,
  type InstallmentHistoryRecord,
  type InstallmentSnapshot,
  type PaymentDetails
} from '@/lib/installment-history'

type InstallmentHistoryInspectorProps = {
  record: InstallmentHistoryRecord | undefined
  className?: string
}

function DetailValue({
  label,
  value
}: {
  label: string
  value: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="grid grid-cols-[minmax(7rem,0.8fr)_minmax(0,1.2fr)] gap-3 py-1.5 text-xs">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium">{value ?? '-'}</dd>
    </div>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <h3 className="pt-4 pb-1 text-xs font-semibold uppercase tracking-wide">{children}</h3>
}

function SnapshotDetails({
  snapshot,
  deleted
}: {
  snapshot: InstallmentSnapshot
  deleted?: boolean
}): React.JSX.Element {
  return (
    <>
      <SectionHeading>{deleted ? 'Deleted record snapshot' : 'Account details'}</SectionHeading>
      <dl className="divide-y">
        <DetailValue label="Account details" value={snapshot.accountDetails} />
        <DetailValue label="Loan details" value={snapshot.loanDetails} />
        <DetailValue label="Terms" value={snapshot.terms} />
        <DetailValue label="Frequency" value={snapshot.frequency} />
        <DetailValue label="Start date" value={formatHistoryDate(snapshot.startDate)} />
        <DetailValue label="End date" value={formatHistoryDate(snapshot.endDate)} />
        <DetailValue label="Downpayment" value={formatHistoryMoney(snapshot.downpayment)} />
        <DetailValue label="Grand total" value={formatHistoryMoney(snapshot.grandTotal)} />
        <DetailValue label="Initial balance" value={formatHistoryMoney(snapshot.initialBalance)} />
      </dl>
      {snapshot.items && snapshot.items.length > 0 && (
        <div className="pt-3">
          <p className="pb-2 text-xs font-medium text-muted-foreground">Items</p>
          <div className="overflow-hidden rounded-md border">
            {snapshot.items.map((item) => (
              <div
                key={`${item.name}-${item.price}`}
                className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 border-b px-3 py-2 text-xs last:border-b-0"
              >
                <span className="min-w-0 truncate" title={item.name}>
                  {item.name}
                </span>
                <span className="text-muted-foreground">×{item.quantity}</span>
                <span className="text-right font-medium">{formatHistoryMoney(item.price)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {deleted && (
        <dl className="divide-y pt-2">
          <DetailValue label="Deleted by" value={snapshot.deletedBy} />
          <DetailValue
            label="Deletion date & time"
            value={snapshot.deletionAt ? formatHistoryDateTime(snapshot.deletionAt) : undefined}
          />
          <DetailValue label="Deletion reason" value={snapshot.deletionReason} />
        </dl>
      )}
    </>
  )
}

function PaymentDetailsSection({ payment }: { payment: PaymentDetails }): React.JSX.Element {
  return (
    <>
      <SectionHeading>Payment details</SectionHeading>
      <dl className="divide-y">
        <DetailValue
          label="Schedule number"
          value={payment.scheduleNumber ? `#${payment.scheduleNumber}` : undefined}
        />
        <DetailValue label="Due date" value={formatHistoryDate(payment.dueDate)} />
        <DetailValue label="Date paid" value={formatHistoryDate(payment.datePaid)} />
        <DetailValue label="OR / reference no." value={payment.referenceNumber} />
        <DetailValue label="Payment method" value={payment.paymentMethod} />
        <DetailValue label="Late fee" value={formatHistoryMoney(payment.lateFee)} />
        <DetailValue label="Amount paid" value={formatHistoryMoney(payment.amountPaid)} />
        <DetailValue label="Previous balance" value={formatHistoryMoney(payment.previousBalance)} />
        <DetailValue label="New balance" value={formatHistoryMoney(payment.newBalance)} />
        <DetailValue label="Notes" value={payment.notes} />
      </dl>
    </>
  )
}

function EventDetails({ record }: { record: InstallmentHistoryRecord }): React.JSX.Element {
  switch (record.details.kind) {
    case 'new':
      return (
        <>
          <SnapshotDetails snapshot={record.details.snapshot} />
          {record.details.payment && <PaymentDetailsSection payment={record.details.payment} />}
        </>
      )
    case 'edited':
      return (
        <>
          <SectionHeading>Changed fields</SectionHeading>
          <div className="overflow-hidden rounded-md border">
            <div className="grid grid-cols-3 gap-2 bg-muted/50 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <span>Field</span>
              <span>Previous value</span>
              <span>New value</span>
            </div>
            {record.details.changes.map((change) => (
              <div key={change.field} className="grid grid-cols-3 gap-2 border-t px-3 py-2 text-xs">
                <span className="font-medium">{change.field}</span>
                <span className="break-words text-muted-foreground">{change.previousValue}</span>
                <span className="break-words font-medium">{change.newValue}</span>
              </div>
            ))}
          </div>
          {record.details.payment && <PaymentDetailsSection payment={record.details.payment} />}
        </>
      )
    case 'deleted':
      return (
        <>
          <SnapshotDetails snapshot={record.details.snapshot} deleted />
          {record.details.payment && <PaymentDetailsSection payment={record.details.payment} />}
        </>
      )
  }
}

export function InstallmentHistoryInspector({
  record,
  className
}: InstallmentHistoryInspectorProps): React.JSX.Element {
  if (!record) {
    return (
      <div className={`flex min-h-0 flex-1 items-center justify-center p-6 ${className ?? ''}`}>
        <Empty className="border-0 p-4">
          <EmptyHeader>
            <EmptyTitle className="text-base">No history record selected</EmptyTitle>
            <EmptyDescription>Select a history record to view its details.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${className ?? ''}`}>
      <div className="shrink-0 border-b p-3">
        <p className="text-xs text-muted-foreground">Installment History</p>
        <h2 className="text-sm font-semibold">Activity details</h2>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-3">
          <SectionHeading>Activity Summary</SectionHeading>
          <dl className="divide-y">
            <DetailValue
              label="Action"
              value={
                <Badge variant={record.action === 'deleted' ? 'destructive' : 'secondary'}>
                  {actionLabels[record.action]}
                </Badge>
              }
            />
            <DetailValue label="Source" value={sourceLabels[record.source]} />
            <DetailValue label="Account" value={record.accountName} />
            <DetailValue label="Date & time" value={formatHistoryDateTime(record.occurredAt)} />
            <DetailValue label="Recorded by" value={record.performedBy} />
          </dl>
          <Separator className="mt-3" />
          <div className="pt-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger render={<p className="truncate pt-3 text-xs font-medium" />}>
                  {record.activity}
                </TooltipTrigger>
                <TooltipContent>{record.activity}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <EventDetails record={record} />
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
