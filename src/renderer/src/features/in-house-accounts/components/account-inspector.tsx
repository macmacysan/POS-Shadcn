import * as React from 'react'
import { CalendarDays, Copy, History, X } from 'lucide-react'

import {
  AccountBranchBadge,
  AccountStatusBadge
} from '@/features/in-house-accounts/components/account-badges'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Badge as ReuiBadge } from '@/components/ui/reui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  branchLabels,
  formatAccountDateTime,
  formatAccountName,
  type InHouseAccount,
  type InHouseLoan
} from '@/lib/in-house-accounts'
import {
  type AccountMonitoringMeta,
  type AccountMonitoringStatus
} from '@/lib/in-house-account-monitoring'
import { formatHistoryDate, formatHistoryMoney } from '@/lib/installment-history'
import { cn } from '@/lib/utils'

export type AccountInspectorStatus = AccountMonitoringStatus
export type AccountInspectorMeta = AccountMonitoringMeta

type InHouseAccountInspectorProps = {
  readonly account?: InHouseAccount
  readonly loans?: readonly InHouseLoan[]
  readonly meta?: AccountInspectorMeta
  readonly isLoading?: boolean
  readonly isSheet?: boolean
  readonly hideHeader?: boolean
  readonly onClose?: () => void
  readonly onRecordPayment?: (account: InHouseAccount) => void
  readonly onViewAccount?: (account: InHouseAccount) => void
  readonly onViewLedger?: (account: InHouseAccount) => void
}

function Header({
  onClose
}: Pick<InHouseAccountInspectorProps, 'isSheet' | 'onClose'>): React.JSX.Element {
  return (
    <div className="sticky top-0 flex min-h-12 shrink-0 items-center justify-between gap-2 border-b bg-card px-3 py-2">
      <h2 className="text-sm font-semibold">Account Details</h2>
      {onClose && (
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
          <X aria-hidden="true" />
        </Button>
      )}
    </div>
  )
}

function TruncatedName({ value }: { readonly value: string }): React.JSX.Element {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={<h3 className="truncate text-base font-semibold leading-snug" />}>
          {value}
        </TooltipTrigger>
        <TooltipContent>{value}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function SummaryItem({
  label,
  value,
  className
}: {
  readonly label: string
  readonly value: React.ReactNode
  readonly className?: string
}): React.JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('text-right font-light', className)}>{value}</span>
    </div>
  )
}

export function DetailRow({
  label,
  value,
  destructive,
  stacked
}: {
  readonly label: string
  readonly value?: React.ReactNode
  readonly destructive?: boolean
  readonly stacked?: boolean
}): React.JSX.Element | null {
  if (value === undefined || value === null || value === '') return null
  return (
    <div
      className={cn(
        'gap-3 py-1.5 text-xs',
        stacked ? 'flex flex-col gap-1' : 'grid grid-cols-[minmax(7rem,0.85fr)_minmax(0,1.15fr)]'
      )}
    >
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'min-w-0 wrap-break-word font-light',
          !stacked && 'text-right',
          destructive && 'text-destructive'
        )}
      >
        {value}
      </dd>
    </div>
  )
}

function CopyButton({
  value,
  label
}: {
  readonly value: string
  readonly label: string
}): React.JSX.Element | null {
  const canCopy = typeof navigator !== 'undefined' && Boolean(navigator.clipboard)
  if (!canCopy) return null
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={label}
      onClick={() => void navigator.clipboard.writeText(value)}
    >
      <Copy aria-hidden="true" />
    </Button>
  )
}

function ContactRows({
  label,
  values,
  primaryId
}: {
  readonly label: string
  readonly values: readonly { id: string; value: string; isPrimary?: boolean }[]
  readonly primaryId?: string
}): React.JSX.Element | null {
  if (!values.length) return null
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex flex-col gap-1">
        {values.map((item) => {
          const isPrimary = item.id === primaryId || item.isPrimary
          return (
            <div key={item.id} className="flex min-w-0 items-center gap-2 text-xs">
              <span className="min-w-0 flex-1 select-text break-all font-light">{item.value}</span>
              {isPrimary && (
                <Badge variant="secondary" className="shrink-0">
                  Primary
                </Badge>
              )}
              <CopyButton value={item.value} label={`Copy ${item.value}`} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function buildAddressLines(account: InHouseAccount): string[] {
  return [
    account.streetSubdivision,
    [account.barangay, account.cityMunicipality].filter(Boolean).join(', '),
    account.province,
    account.regionPsgc?.name
  ].filter((value): value is string => Boolean(value?.trim()))
}

function optionalDate(value: string | undefined): string | undefined {
  return value ? formatHistoryDate(value) : undefined
}

function optionalMoney(value: number | undefined): string | undefined {
  return value === undefined ? undefined : formatHistoryMoney(value)
}

function LoanHistory({ loans }: { readonly loans: readonly InHouseLoan[] }): React.JSX.Element {
  if (!loans.length) {
    return (
      <Empty className="rounded-md border border-dashed p-6">
        <EmptyHeader>
          <EmptyTitle className="text-sm">No loan history</EmptyTitle>
          <EmptyDescription>This client has no recorded loans yet.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {loans.map((loan) => (
        <div key={loan.id} className="rounded-md border bg-background p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">{loan.id}</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays aria-hidden="true" />
                Released {formatHistoryDate(loan.dateReleased)}
              </p>
            </div>
            <ReuiBadge variant="primary-light" size="sm">
              {loan.paymentFrequency}
            </ReuiBadge>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t pt-3 text-xs">
            <SummaryItem label="Grand total" value={formatHistoryMoney(loan.grandTotal)} />
            <SummaryItem label="Installment" value={formatHistoryMoney(loan.installmentAmount)} />
            <SummaryItem label="Down payment" value={formatHistoryMoney(loan.downPayment)} />
            <SummaryItem label="Terms" value={loan.terms} />
          </div>
          {loan.items.length > 0 && (
            <p className="mt-3 truncate border-t pt-3 text-xs text-muted-foreground">
              {loan.items.map((item) => `${item.name} ×${item.quantity}`).join(' · ')}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

function InspectorSkeleton(): React.JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Header />
      <div className="flex flex-col gap-4 p-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  )
}

export function InHouseAccountInspector({
  account,
  loans = [],
  meta,
  isLoading,
  isSheet,
  hideHeader = false,
  onClose,
  onRecordPayment,
  onViewAccount,
  onViewLedger
}: InHouseAccountInspectorProps): React.JSX.Element {
  const [activeSection, setActiveSection] = React.useState<'all' | 'loans'>('all')

  if (isLoading) return <InspectorSkeleton />

  if (!account)
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {!hideHeader && <Header isSheet={isSheet} onClose={onClose} />}
        <Empty className="h-full rounded-none border-0 p-6">
          <EmptyHeader>
            <EmptyTitle>Select an account</EmptyTitle>
            <EmptyDescription>Select an account to view its details.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )

  const name = formatAccountName(account)
  const mobile = account.contacts.filter((contact) => contact.kind === 'mobile')
  const telephone = account.contacts.filter((contact) => contact.kind === 'telephone')
  const primaryMobile = mobile.find((contact) => contact.isPrimary)
  const addressLines = buildAddressLines(account)
  const address = addressLines.join('\n')
  const isOverdue = meta?.status === 'overdue'
  const viewLedger = onViewLedger ?? onViewAccount

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-card">
      {!hideHeader && <Header isSheet={isSheet} onClose={onClose} />}
      <div className="shrink-0 border-b px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <TruncatedName value={name} />
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <AccountBranchBadge branch={account.branch} />
              <AccountStatusBadge status={meta?.status} />
              <span className="text-xs text-muted-foreground">{account.id}</span>
            </div>
          </div>
          <TooltipProvider>
            <div className="flex shrink-0 gap-2">
              <Tooltip>
                <TooltipTrigger render={<span />}>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!onRecordPayment}
                    onClick={() => onRecordPayment?.(account)}
                  >
                    Record Payment
                  </Button>
                </TooltipTrigger>
                {!onRecordPayment && (
                  <TooltipContent>Payment workflow is not available.</TooltipContent>
                )}
              </Tooltip>
              <Tooltip>
                <TooltipTrigger render={<span />}>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!viewLedger}
                    onClick={() => viewLedger?.(account)}
                  >
                    View Ledger
                  </Button>
                </TooltipTrigger>
                {!viewLedger && <TooltipContent>Ledger workflow is not available.</TooltipContent>}
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryItem
            label="Outstanding balance"
            value={formatHistoryMoney(meta?.outstandingBalance)}
            className={cn(
              'text-base font-semibold tabular-nums',
              meta?.outstandingBalance !== undefined &&
                meta.outstandingBalance < 0 &&
                'text-destructive'
            )}
          />
          <SummaryItem label="Next due" value={formatHistoryDate(meta?.nextDue)} />
          <SummaryItem label="Installment" value={formatHistoryMoney(meta?.installmentAmount)} />
          <SummaryItem
            label="Contract"
            value={
              [meta?.paymentFrequency, meta?.terms].filter(Boolean).join(' ') || 'Not provided'
            }
            className={isOverdue ? 'text-destructive' : undefined}
          />
        </div>
      </div>
      <Tabs
        value={activeSection}
        onValueChange={(value) => setActiveSection(value as 'all' | 'loans')}
        className="min-h-0 flex-1 gap-0"
      >
        <div className="shrink-0 border-b px-6 pt-2">
          <TabsList variant="line" aria-label="Client record views">
            <TabsTrigger value="all">Overview</TabsTrigger>
            <TabsTrigger value="loans">
              <History data-icon="inline-start" aria-hidden="true" />
              Loan history{' '}
              <ReuiBadge variant="primary-light" size="xs">
                {loans.length}
              </ReuiBadge>
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="all" className="min-h-0">
          <ScrollArea className="h-full">
            <div className="grid gap-4 p-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
              <div className="flex min-w-0 flex-col gap-4">
                <Card size="sm">
                  <CardHeader>
                    <CardTitle>Collection status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <dl className="divide-y">
                      <DetailRow
                        label="Payment amount"
                        value={optionalMoney(meta?.installmentAmount)}
                      />
                      <DetailRow
                        label="Frequency"
                        value={
                          meta?.paymentFrequency === 'Semi'
                            ? 'Semi-monthly'
                            : meta?.paymentFrequency
                        }
                      />
                      <DetailRow label="No. of payments" value={meta?.terms} />
                      <DetailRow label="Next due" value={optionalDate(meta?.nextDue)} />
                      <DetailRow label="Last payment" value={optionalDate(meta?.lastPayment)} />
                      <DetailRow
                        label="Days delayed"
                        value={meta?.delayedDays}
                        destructive={isOverdue}
                      />
                      <DetailRow label="Missed payments" value={meta?.missedPayments} />
                    </dl>
                  </CardContent>
                </Card>
                <Card size="sm">
                  <CardHeader>
                    <CardTitle>Financial breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <dl className="divide-y">
                      <DetailRow label="Date released" value={optionalDate(meta?.dateReleased)} />
                      <DetailRow label="Start date" value={optionalDate(meta?.startDate)} />
                      <DetailRow label="End date" value={optionalDate(meta?.endDate)} />
                      <DetailRow label="Grand total" value={optionalMoney(meta?.grandTotal)} />
                      <DetailRow label="Interest" value={optionalMoney(meta?.interest)} />
                      <DetailRow
                        label="Total interest"
                        value={optionalMoney(meta?.totalInterest)}
                      />
                      <DetailRow label="Down payment" value={optionalMoney(meta?.downPayment)} />
                      <DetailRow
                        label="Required Downpayment"
                        value={optionalMoney(meta?.requiredFee)}
                      />
                      <DetailRow label="Total paid" value={optionalMoney(meta?.totalPaid)} />
                    </dl>
                  </CardContent>
                </Card>
              </div>
              <div className="flex min-w-0 flex-col gap-4">
                <Card size="sm">
                  <CardHeader>
                    <CardTitle>Contact</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <ContactRows
                      label="Mobile numbers"
                      values={mobile}
                      primaryId={primaryMobile?.id}
                    />
                    <ContactRows label="Telephone numbers" values={telephone} />
                    <ContactRows label="Email addresses" values={account.emails} />
                  </CardContent>
                </Card>
                <Card size="sm">
                  <CardHeader>
                    <CardTitle>Address</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {address ? (
                      <div className="flex items-start gap-2">
                        <p className="min-w-0 flex-1 select-text whitespace-pre-line text-xs font-light leading-5">
                          {address}
                        </p>
                        <CopyButton value={address} label="Copy address" />
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Not provided</p>
                    )}
                  </CardContent>
                </Card>
                <Card size="sm">
                  <CardHeader>
                    <CardTitle>Account record</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <dl className="divide-y">
                      <DetailRow label="Branch" value={branchLabels[account.branch]} />
                      <DetailRow label="Civil status" value={account.civilStatus} />
                      <DetailRow label="Occupation" value={account.occupation} />
                      <DetailRow label="Agent" value={account.agent} />
                      <DetailRow label="Referred by" value={account.referredBy} />
                      <DetailRow label="Created" value={formatAccountDateTime(account.createdAt)} />
                      <DetailRow
                        label="Last updated"
                        value={formatAccountDateTime(account.updatedAt)}
                      />
                    </dl>
                  </CardContent>
                </Card>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
        <TabsContent value="loans" className="min-h-0">
          <ScrollArea className="h-full">
            <div className="p-6">
              <LoanHistory loans={loans} />
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}
