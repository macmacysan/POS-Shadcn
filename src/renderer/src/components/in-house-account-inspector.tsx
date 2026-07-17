import * as React from 'react'
import { Copy, MoreHorizontal, X } from 'lucide-react'

import { AccountStatusBadge } from '@/components/in-house-account-badges'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  branchLabels,
  formatAccountDateTime,
  formatAccountName,
  type InHouseAccount
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
  readonly meta?: AccountInspectorMeta
  readonly isLoading?: boolean
  readonly isSheet?: boolean
  readonly onClose?: () => void
  readonly onRecordPayment?: (account: InHouseAccount) => void
  readonly onViewAccount?: (account: InHouseAccount) => void
  readonly onViewLedger?: (account: InHouseAccount) => void
}

function Header({
  isSheet,
  onClose
}: Pick<InHouseAccountInspectorProps, 'isSheet' | 'onClose'>): React.JSX.Element {
  return (
    <div className="sticky top-0 flex min-h-12 shrink-0 items-center justify-between gap-2 border-b bg-card px-3 py-2">
      <h2 className="text-sm font-semibold">Account Details</h2>
      {isSheet && (
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
      <span className={cn('text-right font-medium', className)}>{value}</span>
    </div>
  )
}

function Section({
  title,
  children
}: {
  readonly title: string
  readonly children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold">{title}</h3>
      {children}
    </section>
  )
}

function DetailRow({
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
          'min-w-0 break-words font-medium',
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
              <span className="min-w-0 flex-1 select-text break-all font-medium">{item.value}</span>
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
  meta,
  isLoading,
  isSheet,
  onClose,
  onRecordPayment,
  onViewAccount,
  onViewLedger
}: InHouseAccountInspectorProps): React.JSX.Element {
  if (isLoading) return <InspectorSkeleton />

  if (!account)
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Header isSheet={isSheet} onClose={onClose} />
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
      <Header isSheet={isSheet} onClose={onClose} />

      <div className="shrink-0 border-b bg-card p-3">
        <div className="flex flex-col gap-3">
          <div className="min-w-0">
            <TruncatedName value={name} />
            <p className="mt-1 select-text text-xs text-muted-foreground">
              {account.id} · {branchLabels[account.branch]}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline">{branchLabels[account.branch]}</Badge>
              <AccountStatusBadge status={meta?.status} />
            </div>
          </div>

          <TooltipProvider>
            <div className="flex gap-2">
              <Tooltip>
                <TooltipTrigger render={<span className="flex-1" />}>
                  <Button
                    type="button"
                    size="sm"
                    className="w-full"
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
                <TooltipTrigger render={<span className="flex-1" />}>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={!viewLedger}
                    onClick={() => viewLedger?.(account)}
                  >
                    View Ledger
                  </Button>
                </TooltipTrigger>
                {!viewLedger && <TooltipContent>Ledger workflow is not available.</TooltipContent>}
              </Tooltip>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button type="button" variant="outline" size="icon-sm" />}
                >
                  <MoreHorizontal aria-hidden="true" />
                  <span className="sr-only">More account actions</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuGroup>
                    <DropdownMenuItem disabled>No extra actions</DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </TooltipProvider>

          <div className="rounded-md border bg-background p-3">
            <p className="text-xs text-muted-foreground">Outstanding Balance</p>
            <p
              className={cn(
                'mt-1 select-text text-2xl font-semibold tabular-nums',
                meta?.outstandingBalance !== undefined &&
                  meta.outstandingBalance < 0 &&
                  'text-destructive'
              )}
            >
              {formatHistoryMoney(meta?.outstandingBalance)}
            </p>
            <div className="mt-3 flex flex-col gap-1.5">
              <SummaryItem label="Next Due" value={formatHistoryDate(meta?.nextDue)} />
              <SummaryItem label="Frequency" value={meta?.paymentFrequency ?? 'Not provided'} />
              {isOverdue && meta?.delayedDays !== undefined && (
                <SummaryItem
                  label="Delayed"
                  value={`${meta.delayedDays} ${meta.delayedDays === 1 ? 'day' : 'days'}`}
                  className="text-destructive"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 p-3">
          <Section title="Loan Overview">
            <dl className="divide-y">
              <DetailRow
                label="Outstanding balance"
                value={optionalMoney(meta?.outstandingBalance)}
                destructive={meta?.outstandingBalance !== undefined && meta.outstandingBalance < 0}
              />
              <DetailRow
                label="Installment amount"
                value={optionalMoney(meta?.installmentAmount)}
              />
              <DetailRow label="Payment frequency" value={meta?.paymentFrequency} />
              <DetailRow label="Terms" value={meta?.terms} />
              <DetailRow label="Next due" value={optionalDate(meta?.nextDue)} />
              <DetailRow label="Last payment" value={optionalDate(meta?.lastPayment)} />
              <DetailRow
                label="Loan status"
                value={meta?.status ? <AccountStatusBadge status={meta.status} /> : undefined}
              />
              <DetailRow label="Days delayed" value={meta?.delayedDays} destructive={isOverdue} />
              <DetailRow label="Missed payments" value={meta?.missedPayments} />
            </dl>
          </Section>

          <Separator />

          <Section title="Financial & Contract Details">
            <dl className="divide-y">
              <DetailRow label="Date released" value={optionalDate(meta?.dateReleased)} />
              <DetailRow label="Start date" value={optionalDate(meta?.startDate)} />
              <DetailRow label="End date" value={optionalDate(meta?.endDate)} />
              <DetailRow label="Required fee" value={optionalMoney(meta?.requiredFee)} />
              <DetailRow label="Grand total" value={optionalMoney(meta?.grandTotal)} />
              <DetailRow label="Principal" value={optionalMoney(meta?.principal)} />
              <DetailRow label="Interest" value={optionalMoney(meta?.interest)} />
              <DetailRow label="Total interest" value={optionalMoney(meta?.totalInterest)} />
              <DetailRow label="Down payment" value={optionalMoney(meta?.downPayment)} />
              <DetailRow label="Total paid" value={optionalMoney(meta?.totalPaid)} />
              <DetailRow label="Account opened" value={formatAccountDateTime(account.createdAt)} />
            </dl>
          </Section>

          <Separator />

          <Section title="Contact">
            <ContactRows label="Mobile numbers" values={mobile} primaryId={primaryMobile?.id} />
            <ContactRows label="Telephone numbers" values={telephone} />
            <ContactRows label="Email addresses" values={account.emails} />
          </Section>

          <Separator />

          <Section title="Address">
            {address ? (
              <div className="flex items-start gap-2">
                <p className="min-w-0 flex-1 select-text whitespace-pre-line text-xs font-medium leading-5">
                  {address}
                </p>
                <CopyButton value={address} label="Copy address" />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Not provided</p>
            )}
          </Section>

          <Separator />

          <Section title="Additional Information">
            <dl className="divide-y">
              <DetailRow label="Occupation" value={account.occupation} />
              <DetailRow label="Agent" value={account.agent} />
              <DetailRow label="Referred by" value={account.referredBy} />
              <DetailRow label="Last updated" value={formatAccountDateTime(account.updatedAt)} />
              <DetailRow label="Last added" value={formatAccountDateTime(account.createdAt)} />
            </dl>
          </Section>
        </div>
      </ScrollArea>
    </div>
  )
}
