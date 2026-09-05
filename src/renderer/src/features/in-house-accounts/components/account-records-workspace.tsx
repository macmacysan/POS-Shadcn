import * as React from 'react'
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type SortingState
} from '@tanstack/react-table'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import {
  ChartNoAxesColumn,
  Columns3,
  MapPin,
  MessageSquareText,
  ReceiptText,
  UserRound,
  WalletCards
} from 'lucide-react'

import {
  AccountBranchBadge,
  AccountStatusBadge
} from '@/features/in-house-accounts/components/account-badges'
import {
  clientPortfolios,
  paymentReliability,
  tardinessSeries
} from '@/features/in-house-accounts/client-portfolio-analytics'
import { AdminPasswordConfirmationDialog } from '@/components/shared/admin-password-confirmation-dialog'
import {
  createRowActionsColumn,
  type RowActionItem
} from '@/components/shared/data-table/row-actions'
import { UniversalDataTable } from '@/components/shared/data-table/universal-data-table'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/reui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle
} from '@/components/ui/empty'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { AmountInputGroup } from '@/components/ui/amount-input-group'
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover'
import { SearchInputGroup } from '@/components/ui/search-input-group'
import {
  ShadcnTableFilters,
  type ShadcnFilterField
} from '@/components/shared/data-table/shadcn-table-filters'
import { Input } from '@/components/ui/input'
import { DatePickerInput } from '@/components/ui/date-picker-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { formatAccountName, type BranchName } from '@/lib/in-house-accounts'
import { formatHistoryDate, formatHistoryMoney } from '@/lib/installment-history'
import { cn } from '@/lib/utils'
import {
  useInstallmentData,
  type PersistedInstallmentRow
} from '@/features/in-house-accounts/installment-data'
import {
  InHouseAccountForm,
  type InHouseAccountWorkflowSave
} from '@/features/in-house-accounts/components/account-form'
import { AddressMapPicker } from '@/features/in-house-accounts/components/address-map-picker'
import { InstallmentQuoteCalculator } from '@/features/in-house-accounts/components/installment-quote-calculator'
import { DetailRow } from '@/features/in-house-accounts/components/account-inspector'
import type { InstallmentHistoryRecord, InstallmentView } from '@/../../shared/contracts'
import { useNotifications } from '@/hooks/use-notifications'

type Props = {
  readonly view: InstallmentView
  readonly initialBranch?: BranchName
  readonly initialSearch?: string
  readonly initialPaymentStatus?: 'overdue'
  readonly ownBranch?: BranchName
  readonly showAllBranches?: boolean
  readonly onOpenPaymentWorkspace?: (
    accountId: string,
    initialTab: 'schedule' | 'ledger',
    origin: InstallmentView,
    initialPaymentId?: string,
    openRecordPayment?: boolean
  ) => void
}
type Transition = {
  readonly kind: 'close' | 'blacklist' | 'restore-closed' | 'restore-blacklisted'
  readonly row: PersistedInstallmentRow
}
type ActiveStatusFilter = 'all' | 'overdue' | 'due-soon' | 'fully-paid'
type LoanEditDraft = {
  readonly accountId: string
  readonly contractId: string
  readonly dateReleased: string
  readonly paymentFrequency: 'Daily' | 'Weekly' | 'Semi' | 'Monthly'
  readonly terms: string
  readonly downPayment: string
  readonly remarks: string
}
type LoanRestructureDraft = {
  readonly row: PersistedInstallmentRow
  readonly firstDueDate: string
  readonly paymentFrequency: 'Daily' | 'Weekly' | 'Semi' | 'Monthly'
  readonly terms: string
  readonly reason: string
}
type Creator =
  | { readonly kind: 'new-client' | 'new-loan' }
  | { readonly kind: 'update-client' | 'update-loan'; readonly row: PersistedInstallmentRow }

const activeStatusFilters: readonly { value: Exclude<ActiveStatusFilter, 'all'>; label: string }[] =
  [
    { value: 'due-soon', label: 'Near Due' },
    { value: 'fully-paid', label: 'Fully Paid' },
    { value: 'overdue', label: 'Overdue' }
  ]

const activeStatusBadgeVariant = {
  overdue: 'destructive',
  'due-soon': 'warning',
  'fully-paid': 'success'
} as const

const visibleColumnOptions = [
  { id: 'account', label: 'Account' },
  { id: 'branch', label: 'Branch' },
  { id: 'city', label: 'City' },
  { id: 'barangay', label: 'Barangay' },
  { id: 'released', label: 'Released' },
  { id: 'balance', label: 'Balance' },
  { id: 'nextPayment', label: 'Next payment' },
  { id: 'status', label: 'Status' },
  { id: 'nextDue', label: 'Next due' },
  { id: 'installment', label: 'Installment' },
  { id: 'paymentFrequency', label: 'Payment frequency' },
  { id: 'terms', label: 'Terms' },
  { id: 'totalPaid', label: 'Total paid' },
  { id: 'lastPayment', label: 'Last payment' },
  { id: 'remarks', label: 'Remarks' }
] as const

function accountFilterOption(
  row: PersistedInstallmentRow,
  field: (typeof visibleColumnOptions)[number]['id']
): { value: string; label: string } {
  switch (field) {
    case 'account':
      return { value: formatAccountName(row.account), label: formatAccountName(row.account) }
    case 'branch':
      return { value: row.account.branch, label: row.account.branch }
    case 'city':
      return {
        value: row.account.cityMunicipality ?? '',
        label: row.account.cityMunicipality ?? ''
      }
    case 'barangay':
      return { value: row.account.barangay ?? '', label: row.account.barangay ?? '' }
    case 'released':
      return { value: row.loan.dateReleased, label: formatHistoryDate(row.loan.dateReleased) }
    case 'balance':
      return {
        value: String(row.meta.outstandingBalance ?? 0),
        label: formatHistoryMoney(row.meta.outstandingBalance)
      }
    case 'nextPayment':
      return {
        value: row.meta.status,
        label:
          row.meta.status === 'fully-paid' ? 'Fully paid' : paymentCountdown(row.meta.nextDue).label
      }
    case 'status':
      return { value: row.meta.status, label: row.meta.status }
    case 'nextDue':
      return { value: row.meta.nextDue ?? '', label: formatHistoryDate(row.meta.nextDue) }
    case 'installment':
      return {
        value: String(row.meta.installmentAmount ?? 0),
        label: formatHistoryMoney(row.meta.installmentAmount)
      }
    case 'paymentFrequency':
      return { value: row.meta.paymentFrequency ?? '', label: row.meta.paymentFrequency ?? '' }
    case 'terms':
      return { value: row.meta.terms ?? '', label: row.meta.terms ?? '' }
    case 'totalPaid':
      return {
        value: String(row.meta.totalPaid ?? 0),
        label: formatHistoryMoney(row.meta.totalPaid)
      }
    case 'lastPayment':
      return { value: row.meta.lastPayment ?? '', label: formatHistoryDate(row.meta.lastPayment) }
    case 'remarks':
      return { value: row.statusRemarks ?? '', label: row.statusRemarks ?? '' }
  }
}

function matchesAccountFilter(
  row: PersistedInstallmentRow,
  filter: { field: string; value: string }
): boolean {
  return (
    accountFilterOption(row, filter.field as (typeof visibleColumnOptions)[number]['id']).value ===
    filter.value
  )
}

function paymentCountdown(nextDue?: string): { label: string; isOverdue: boolean } {
  if (!nextDue) return { label: '—', isOverdue: false }

  const today = new Date()
  const todayAtMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const dueDate = new Date(`${nextDue}T00:00:00`)
  if (Number.isNaN(dueDate.valueOf())) return { label: '—', isOverdue: false }

  const days = Math.round((dueDate.getTime() - todayAtMidnight.getTime()) / 86_400_000)
  if (days === 0) return { label: 'Due today', isOverdue: false }

  const distance = Math.abs(days)
  const amount = distance > 30 ? Math.floor(distance / 30) : distance
  const unit = distance > 30 ? 'month' : 'day'
  const label = `${amount} ${unit}${amount === 1 ? '' : 's'}`
  return { label: days < 0 ? `${label} overdue` : label, isOverdue: days < 0 }
}

function ClientPortfolioModal({
  selected,
  rows,
  onEditClient
}: {
  readonly selected: PersistedInstallmentRow
  readonly rows: readonly PersistedInstallmentRow[]
  readonly onEditClient?: () => void
}): React.JSX.Element {
  const [history, setHistory] = React.useState<InstallmentHistoryRecord[]>([])
  const [paymentSorting, setPaymentSorting] = React.useState<SortingState>([])
  const [paymentPagination, setPaymentPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25
  })
  const [selectedContractId, setSelectedContractId] = React.useState(selected.contractId)
  const [activeChart, setActiveChart] = React.useState<'activity' | 'tardiness'>('activity')
  React.useEffect(() => {
    let cancelled = false
    void window.api.installments
      .listHistory({})
      .then((records) => {
        if (!cancelled)
          setHistory(records.filter((record) => record.accountId === selected.account.id))
      })
      .catch(() => {
        if (!cancelled) setHistory([])
      })
    return () => {
      cancelled = true
    }
  }, [selected.account.id])
  const contracts = rows.filter((row) => row.account.id === selected.account.id)
  const selectedContract =
    contracts.find((row) => row.contractId === selectedContractId) ?? selected
  const portfolio = clientPortfolios(contracts)[0]
  const reliability = paymentReliability(history)
  const tardiness = tardinessSeries(history)
  const balance = portfolio?.outstandingBalance ?? 0
  const nextDue = portfolio?.nextDue ?? selected.meta.nextDue
  const risk = portfolio?.risk ?? selected.meta.status
  const totalPaid = history.reduce((total, record) => total + (record.amountCentavos ?? 0), 0)
  const lastPayment = history[0]
  const datedMonetaryHistory = history.filter(
    (record) =>
      record.amountCentavos !== undefined && !Number.isNaN(new Date(record.occurredAt).valueOf())
  )
  const paymentActivity = [
    ...datedMonetaryHistory
      .reduce((months, record) => {
        const month = record.occurredAt.slice(0, 7)
        const current = months.get(month) ?? { month, label: month, amount: 0 }
        current.amount += (record.amountCentavos ?? 0) / 100
        months.set(month, current)
        return months
      }, new Map<string, { month: string; label: string; amount: number }>())
      .values()
  ].sort((a, b) => a.month.localeCompare(b.month))
  const hasPaymentActivity =
    paymentActivity.length >= 2 && paymentActivity.some((point) => point.amount !== 0)
  const hasTardiness = tardiness.length >= 2 && tardiness.some((point) => point.daysLate > 0)
  const hasAnalytics = hasPaymentActivity || hasTardiness
  const paymentColumns = React.useMemo<ColumnDef<InstallmentHistoryRecord>[]>(
    () => [
      {
        id: 'date',
        header: 'Date',
        accessorKey: 'occurredAt',
        cell: ({ row }) => formatHistoryDate(row.original.occurredAt),
        size: 112
      },
      {
        id: 'reference',
        header: 'Reference',
        accessorFn: (row) => row.referenceNumber ?? '',
        cell: ({ row }) => row.original.referenceNumber ?? '—',
        size: 136
      },
      {
        id: 'activity',
        header: 'Activity',
        accessorKey: 'activity',
        cell: ({ row }) => <span className="block truncate">{row.original.activity}</span>,
        meta: { autoSize: true }
      },
      {
        id: 'amount',
        header: 'Amount',
        accessorFn: (row) => row.amountCentavos,
        cell: ({ row }) =>
          row.original.amountCentavos === undefined
            ? '—'
            : formatHistoryMoney(row.original.amountCentavos / 100),
        size: 128,
        meta: { headerClassName: 'text-right', cellClassName: 'text-right tabular-nums' }
      }
    ],
    []
  )
  const paymentTable = useReactTable({
    data: history,
    columns: paymentColumns,
    state: { sorting: paymentSorting, pagination: paymentPagination },
    onSortingChange: setPaymentSorting,
    onPaginationChange: setPaymentPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.id
  })
  const account = selected.account
  const primaryMobile =
    account.contacts.find((contact) => contact.kind === 'mobile' && contact.isPrimary) ??
    account.contacts.find((contact) => contact.kind === 'mobile')
  const telephone = account.contacts.find((contact) => contact.kind === 'telephone')
  const primaryEmail =
    account.emails.find((email) => email.isPrimary) ?? account.emails.find((email) => email.value)
  const addressSummary =
    [account.streetSubdivision, account.barangay, account.cityMunicipality]
      .filter(Boolean)
      .join(', ') || 'Not provided'
  const fullAddress =
    [
      account.streetSubdivision,
      account.barangay,
      account.cityMunicipality,
      account.province,
      account.regionPsgc?.name
    ]
      .filter(Boolean)
      .join(', ') || 'Not provided'
  const hasSavedLocation =
    typeof account.latitude === 'number' && typeof account.longitude === 'number'
  const remarksCount =
    contracts.filter((row) => row.loan.remarks || row.statusRemarks).length +
    Number(Boolean(account.landmarkRemarks))
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="grid shrink-0 grid-cols-2 border-b bg-muted/20 lg:grid-cols-[minmax(16rem,1.5fr)_repeat(3,minmax(9rem,1fr))]">
        <div className="col-span-2 border-b px-5 py-3 lg:col-span-1 lg:border-b-0">
          <p className="text-xs text-muted-foreground">Portfolio balance</p>
          <p className="mt-1 text-xl font-semibold leading-none tabular-nums">
            {formatHistoryMoney(balance)}
          </p>
        </div>
        <div className="border-b px-5 py-3 lg:border-b-0 lg:border-l">
          <p className="text-xs text-muted-foreground">Next due</p>
          <p className="mt-1 text-sm font-medium tabular-nums">{formatHistoryDate(nextDue)}</p>
        </div>
        <div className="border-b px-5 py-3 lg:border-b-0 lg:border-l">
          <p className="text-muted-foreground">Loan history</p>
          <p className="mt-1 text-sm font-semibold">
            {contracts.length} contract{contracts.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="px-5 py-3 lg:border-l">
          <p className="text-muted-foreground">Payment events</p>
          <p className="mt-1 text-sm font-semibold">{history.length}</p>
        </div>
      </div>
      <Tabs defaultValue="profile" orientation="vertical" className="min-h-0 flex-1 gap-0">
        <TabsList
          variant="line"
          className="m-4 mr-0 w-52 shrink-0 gap-1 border-r pr-4"
          aria-label="Client portfolio categories"
        >
          <TabsTrigger value="profile" className="h-8 justify-start px-2">
            <UserRound data-icon="inline-start" aria-hidden="true" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="location" className="h-8 justify-start px-2">
            <MapPin data-icon="inline-start" aria-hidden="true" />
            Location
          </TabsTrigger>
          <TabsTrigger value="loans" className="h-8 justify-start px-2">
            <WalletCards data-icon="inline-start" aria-hidden="true" />
            Loan details
          </TabsTrigger>
          <TabsTrigger value="payments" className="h-8 justify-between px-2">
            <span className="flex items-center gap-1.5">
              <ReceiptText data-icon="inline-start" aria-hidden="true" />
              Payments
            </span>
            {history.length > 0 && (
              <Badge variant="secondary" size="xs">
                {history.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="analytics" className="h-8 justify-start px-2">
            <ChartNoAxesColumn data-icon="inline-start" aria-hidden="true" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="remarks" className="h-8 justify-between px-2">
            <span className="flex items-center gap-1.5">
              <MessageSquareText data-icon="inline-start" aria-hidden="true" />
              Remarks
            </span>
            {remarksCount > 0 && (
              <Badge variant="secondary" size="xs">
                {remarksCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="min-h-0 min-w-0 overflow-y-auto p-4">
          <div className="mx-auto flex max-w-5xl flex-col gap-6">
            <div className="flex items-start justify-between gap-4 border-b pb-4">
              <div>
                <h2 className="text-sm font-semibold">Client profile</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Identity, contact information, and account ownership.
                </p>
              </div>
              {onEditClient && (
                <Button type="button" variant="outline" size="sm" onClick={onEditClient}>
                  Edit client
                </Button>
              )}
            </div>
            <div className="grid gap-x-10 gap-y-6 lg:grid-cols-2">
              <section>
                <h3 className="border-b pb-2 text-xs font-medium text-muted-foreground">
                  Identity
                </h3>
                <dl className="divide-y">
                  <DetailRow label="Full name" value={formatAccountName(account)} />
                  <DetailRow label="Branch" value={account.branch} />
                  <DetailRow label="Account ID" value={account.id} />
                </dl>
              </section>
              <section>
                <h3 className="border-b pb-2 text-xs font-medium text-muted-foreground">Contact</h3>
                <dl className="divide-y">
                  <DetailRow label="Mobile" value={primaryMobile?.value || 'Not provided'} />
                  <DetailRow label="Telephone" value={telephone?.value || 'Not provided'} />
                  <DetailRow label="Email" value={primaryEmail?.value || 'Not provided'} />
                </dl>
              </section>
              <section>
                <h3 className="border-b pb-2 text-xs font-medium text-muted-foreground">
                  Account ownership
                </h3>
                <dl className="divide-y">
                  <DetailRow label="Occupation" value={account.occupation || 'Not provided'} />
                  <DetailRow label="Agent" value={account.agent || 'Not provided'} />
                  <DetailRow label="Referred by" value={account.referredBy || 'Not provided'} />
                </dl>
              </section>
              <section>
                <h3 className="border-b pb-2 text-xs font-medium text-muted-foreground">
                  Portfolio
                </h3>
                <dl className="divide-y">
                  <DetailRow
                    label="Portfolio balance"
                    value={
                      <span className="font-medium tabular-nums">
                        {formatHistoryMoney(balance)}
                      </span>
                    }
                  />
                  <DetailRow label="Portfolio risk" value={<AccountStatusBadge status={risk} />} />
                </dl>
              </section>
              <section className="lg:col-span-2">
                <h3 className="border-b pb-2 text-xs font-medium text-muted-foreground">Address</h3>
                <dl className="divide-y">
                  <DetailRow label="Address" value={addressSummary} />
                </dl>
              </section>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="location" className="min-h-0 min-w-0 overflow-y-auto p-4">
          <div className="mx-auto flex max-w-5xl flex-col gap-6">
            <div className="border-b pb-4">
              <h2 className="text-sm font-semibold">Location</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Address hierarchy and saved client location.
              </p>
            </div>
            <div className="grid gap-x-10 gap-y-6 lg:grid-cols-2">
              <section>
                <h3 className="border-b pb-2 text-xs font-medium text-muted-foreground">Address</h3>
                <dl className="divide-y">
                  <DetailRow label="Full address" value={fullAddress} />
                  <DetailRow
                    label="Street / subdivision"
                    value={account.streetSubdivision || 'Not provided'}
                  />
                  <DetailRow label="Barangay" value={account.barangay || 'Not provided'} />
                  <DetailRow
                    label="City / municipality"
                    value={account.cityMunicipality || 'Not provided'}
                  />
                  <DetailRow label="Province" value={account.province || 'Not provided'} />
                </dl>
              </section>
              <section>
                <h3 className="border-b pb-2 text-xs font-medium text-muted-foreground">
                  Saved location
                </h3>
                <dl className="divide-y">
                  <DetailRow
                    label="Coordinates"
                    value={
                      hasSavedLocation
                        ? `${account.latitude.toFixed(6)}, ${account.longitude.toFixed(6)}`
                        : 'Not provided'
                    }
                  />
                  <DetailRow
                    label="Landmark / remarks"
                    value={account.landmarkRemarks || 'Not provided'}
                  />
                </dl>
              </section>
              {hasSavedLocation && (
                <section className="lg:col-span-2">
                  <h3 className="border-b pb-2 text-xs font-medium text-muted-foreground">
                    Map preview
                  </h3>
                  <div className="mt-3">
                    <AddressMapPicker
                      latitude={account.latitude}
                      longitude={account.longitude}
                      onChange={() => undefined}
                      readOnly
                      zoom={15}
                    />
                  </div>
                </section>
              )}
            </div>
          </div>
        </TabsContent>
        <TabsContent value="loans" className="min-h-0 min-w-0 overflow-y-auto p-4">
          <div className="mx-auto flex max-w-6xl flex-col gap-6">
            <div className="border-b pb-4">
              <h2 className="text-sm font-semibold">Loan details</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Contract terms, financing structure, and current account position.
              </p>
            </div>
            <div className="grid min-h-0 gap-4 lg:grid-cols-[13rem_minmax(0,1fr)]">
              <Card size="sm" className="min-h-0 overflow-hidden">
                <CardHeader>
                  <CardTitle>Contracts</CardTitle>
                  <CardDescription>Select a loan record.</CardDescription>
                </CardHeader>
                <CardContent className="flex max-h-[calc(100%-4.75rem)] flex-col gap-1 overflow-y-auto p-2">
                  {contracts.map((row) => (
                    <Button
                      key={row.contractId}
                      type="button"
                      variant={row.contractId === selectedContract.contractId ? 'outline' : 'ghost'}
                      size="sm"
                      className="h-auto justify-start px-2 py-2 text-left"
                      onClick={() => setSelectedContractId(row.contractId)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-mono text-xs">{row.contractId}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {formatHistoryMoney(row.meta.outstandingBalance)} balance
                        </span>
                      </span>
                    </Button>
                  ))}
                </CardContent>
              </Card>
              <Card size="sm" className="min-h-0 overflow-hidden">
                <CardHeader>
                  <CardTitle>Selected contract</CardTitle>
                  <CardDescription>Contract, financing, and term details.</CardDescription>
                </CardHeader>
                <CardContent className="grid h-[calc(100%-3.75rem)] gap-4 overflow-y-auto lg:grid-cols-2">
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      Contract and terms
                    </p>
                    <dl className="divide-y text-xs">
                      <div className="flex justify-between gap-4 py-2">
                        <dt className="text-muted-foreground">Contract number</dt>
                        <dd className="font-mono text-xs">{selectedContract.contractId}</dd>
                      </div>
                      <div className="flex justify-between gap-4 py-2">
                        <dt className="text-muted-foreground">Account number</dt>
                        <dd className="font-mono text-xs">{account.id}</dd>
                      </div>
                      <div className="flex justify-between gap-4 py-2">
                        <dt className="text-muted-foreground">Contract status</dt>
                        <dd>
                          <AccountStatusBadge status={selectedContract.meta.status} />
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4 py-2">
                        <dt className="text-muted-foreground">Date released</dt>
                        <dd>
                          {formatHistoryDate(
                            selectedContract.meta.dateReleased ?? selectedContract.loan.dateReleased
                          )}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4 py-2">
                        <dt className="text-muted-foreground">Start date</dt>
                        <dd>
                          {formatHistoryDate(
                            selectedContract.meta.startDate ?? selectedContract.loan.startDate
                          )}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4 py-2">
                        <dt className="text-muted-foreground">Maturity date</dt>
                        <dd>{formatHistoryDate(selectedContract.meta.endDate)}</dd>
                      </div>
                      <div className="flex justify-between gap-4 py-2">
                        <dt className="text-muted-foreground">Terms</dt>
                        <dd>{selectedContract.meta.terms ?? selectedContract.loan.terms}</dd>
                      </div>
                      <div className="flex justify-between gap-4 py-2">
                        <dt className="text-muted-foreground">Payment frequency</dt>
                        <dd>
                          {selectedContract.meta.paymentFrequency ??
                            selectedContract.loan.paymentFrequency}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4 py-2">
                        <dt className="text-muted-foreground">Installment amount</dt>
                        <dd className="tabular-nums">
                          {formatHistoryMoney(
                            selectedContract.meta.installmentAmount ??
                              selectedContract.loan.installmentAmount
                          )}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4 py-2">
                        <dt className="text-muted-foreground">Current balance</dt>
                        <dd className="tabular-nums">
                          {formatHistoryMoney(selectedContract.meta.outstandingBalance)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4 py-2">
                        <dt className="text-muted-foreground">Next due</dt>
                        <dd>{formatHistoryDate(selectedContract.meta.nextDue)}</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="flex flex-col gap-4">
                    <p className="text-xs font-medium text-muted-foreground">Financing</p>
                    <dl className="divide-y text-xs">
                      <div className="flex justify-between gap-4 py-2">
                        <dt className="text-muted-foreground">Principal</dt>
                        <dd className="tabular-nums">
                          {formatHistoryMoney(
                            selectedContract.meta.principal ?? selectedContract.loan.principal
                          )}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4 py-2">
                        <dt className="text-muted-foreground">Interest</dt>
                        <dd className="tabular-nums">
                          {formatHistoryMoney(
                            selectedContract.meta.interest ?? selectedContract.loan.interest
                          )}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4 py-2">
                        <dt className="text-muted-foreground">Down payment</dt>
                        <dd className="tabular-nums">
                          {formatHistoryMoney(
                            selectedContract.meta.downPayment ?? selectedContract.loan.downPayment
                          )}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4 py-2">
                        <dt className="text-muted-foreground">Fees</dt>
                        <dd className="tabular-nums">
                          {formatHistoryMoney(selectedContract.loan.fees)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4 py-2">
                        <dt className="text-muted-foreground">Grand total</dt>
                        <dd className="tabular-nums">
                          {formatHistoryMoney(
                            selectedContract.meta.grandTotal ?? selectedContract.loan.grandTotal
                          )}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4 py-2">
                        <dt className="text-muted-foreground">Total paid</dt>
                        <dd className="tabular-nums">
                          {formatHistoryMoney(selectedContract.meta.totalPaid)}
                        </dd>
                      </div>
                    </dl>
                    <div className="border-t pt-3 text-xs">
                      <p className="text-muted-foreground">Items</p>
                      <p className="mt-1">
                        {selectedContract.loan.items.length
                          ? selectedContract.loan.items
                              .map((item) => `${item.name} ×${item.quantity}`)
                              .join(' · ')
                          : 'No items recorded'}
                      </p>
                    </div>
                    <div className="border-t pt-3 text-xs">
                      <p className="text-muted-foreground">Loan remarks</p>
                      <p className="mt-1 whitespace-pre-wrap">
                        {selectedContract.loan.remarks || 'No loan remarks recorded.'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="payments" className="min-h-0 min-w-0 overflow-y-auto p-4">
          <Card size="sm" className="h-full min-h-0 overflow-hidden">
            <CardHeader className="border-b">
              <CardTitle>Payments</CardTitle>
              <CardDescription>
                Recorded installment payments and transaction history.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col p-0">
              <div className="grid shrink-0 grid-cols-3 gap-3 border-b bg-muted/20 px-5 py-3 text-xs">
                <div>
                  <p className="text-muted-foreground">Last activity</p>
                  <p className="mt-1 font-medium">
                    {lastPayment ? formatHistoryDate(lastPayment.occurredAt) : 'Not recorded'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Recorded payments</p>
                  <p className="mt-1 font-medium">{history.length}</p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground">Amount recorded</p>
                  <p className="mt-1 font-medium tabular-nums">
                    {formatHistoryMoney(totalPaid / 100)}
                  </p>
                </div>
              </div>
              <UniversalDataTable
                table={paymentTable}
                recordCount={history.length}
                emptyMessage="No payments recorded for this account yet."
                paginationSizes={[25, 50, 100]}
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="analytics" className="min-h-0 min-w-0 overflow-y-auto p-4">
          <Card size="sm" className="h-full min-h-0 overflow-hidden">
            <CardHeader className="border-b">
              <CardTitle>Payment performance</CardTitle>
              <CardDescription>Payment activity and recorded lateness over time.</CardDescription>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col p-0">
              {!hasAnalytics ? (
                <Empty className="min-h-0 flex-1 rounded-none border-0">
                  <EmptyHeader>
                    <EmptyTitle>Not enough payment history yet</EmptyTitle>
                    <EmptyDescription>
                      Payment performance will become available once dated installment payments are
                      recorded.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent className="flex-row justify-center gap-4 text-xs text-muted-foreground">
                    <span>Recorded payments {history.length}</span>
                    <span>Dated payments {reliability.total}</span>
                    <span>On time {reliability.onTime}</span>
                    <span>Late {reliability.late}</span>
                  </EmptyContent>
                </Empty>
              ) : (
                <div className="grid min-h-0 flex-1 grid-cols-[11rem_minmax(0,1fr)]">
                  <div className="flex flex-col gap-1 border-r p-3">
                    <Button
                      type="button"
                      variant={activeChart === 'activity' ? 'outline' : 'ghost'}
                      size="sm"
                      className="justify-start"
                      onClick={() => setActiveChart('activity')}
                    >
                      Payment activity
                    </Button>
                    <Button
                      type="button"
                      variant={activeChart === 'tardiness' ? 'outline' : 'ghost'}
                      size="sm"
                      className="justify-start"
                      onClick={() => setActiveChart('tardiness')}
                    >
                      Days late
                    </Button>
                    <dl className="mt-4 flex flex-col gap-2 border-t pt-3 text-xs">
                      <div className="flex items-baseline justify-between gap-2">
                        <dt className="text-muted-foreground">Dated payments</dt>
                        <dd className="tabular-nums">{reliability.total}</dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <dt className="text-muted-foreground">On time</dt>
                        <dd className="tabular-nums">{reliability.onTime}</dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <dt className="text-muted-foreground">Late</dt>
                        <dd className="tabular-nums">{reliability.late}</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="flex min-h-0 min-w-0 flex-col p-4">
                    {activeChart === 'tardiness' && hasTardiness ? (
                      <div className="flex min-h-0 flex-1 flex-col">
                        <p className="mb-3 text-xs text-muted-foreground">Days late by payment</p>
                        <div className="min-h-56 flex-1">
                          <ResponsiveContainer
                            width="100%"
                            height="100%"
                            minWidth={0}
                            minHeight={224}
                          >
                            <BarChart
                              data={tardiness}
                              margin={{ top: 8, right: 16, bottom: 4, left: 8 }}
                            >
                              <CartesianGrid vertical={false} strokeDasharray="3 3" />
                              <XAxis dataKey="label" tickLine={false} axisLine={false} />
                              <YAxis
                                allowDecimals={false}
                                width={40}
                                tickLine={false}
                                axisLine={false}
                              />
                              <Tooltip />
                              <Bar dataKey="daysLate" fill="var(--chart-4)" radius={3} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    ) : activeChart === 'activity' && hasPaymentActivity ? (
                      <div className="flex min-h-0 flex-1 flex-col">
                        <p className="mb-3 text-xs text-muted-foreground">
                          Payment activity by month
                        </p>
                        <div className="min-h-56 flex-1">
                          <ResponsiveContainer
                            width="100%"
                            height="100%"
                            minWidth={0}
                            minHeight={224}
                          >
                            <AreaChart
                              data={paymentActivity}
                              margin={{ top: 8, right: 16, bottom: 4, left: 8 }}
                            >
                              <CartesianGrid vertical={false} strokeDasharray="3 3" />
                              <XAxis dataKey="label" tickLine={false} axisLine={false} />
                              <YAxis
                                width={76}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => formatHistoryMoney(Number(value))}
                              />
                              <Tooltip formatter={(value) => formatHistoryMoney(Number(value))} />
                              <Area
                                type="monotone"
                                dataKey="amount"
                                stroke="var(--chart-2)"
                                fill="var(--chart-2)"
                                fillOpacity={0.2}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    ) : (
                      <Empty className="min-h-0 flex-1 rounded-none border-0">
                        <EmptyHeader>
                          <EmptyTitle>
                            {activeChart === 'tardiness' && reliability.total >= 2
                              ? 'No late payments in the dated history'
                              : 'Not enough data for this view'}
                          </EmptyTitle>
                          <EmptyDescription>
                            {activeChart === 'tardiness' && reliability.total >= 2
                              ? 'All available dated payments were recorded on time.'
                              : 'Record more dated installment payments to populate this analysis.'}
                          </EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="remarks" className="min-h-0 min-w-0 overflow-y-auto p-4">
          <Card size="sm" className="h-full overflow-hidden">
            <CardHeader>
              <CardTitle>Remarks</CardTitle>
              <CardDescription>
                Location, contract, and status notes recorded for this client.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex h-[calc(100%-3.75rem)] flex-col gap-3 overflow-y-auto">
              <div className="rounded-md border p-3 text-xs">
                <p className="text-muted-foreground">Location remarks</p>
                <p className="mt-1 whitespace-pre-wrap">
                  {account.landmarkRemarks || 'No location remarks recorded.'}
                </p>
              </div>
              {contracts.map((row) => (
                <div key={row.contractId} className="rounded-md border p-3 text-xs">
                  <p className="font-mono text-muted-foreground">{row.contractId}</p>
                  <p className="mt-2 text-muted-foreground">Loan remarks</p>
                  <p className="mt-1 whitespace-pre-wrap">
                    {row.loan.remarks || 'No loan remarks recorded.'}
                  </p>
                  <p className="mt-3 text-muted-foreground">Status remarks</p>
                  <p className="mt-1 whitespace-pre-wrap">
                    {row.statusRemarks || 'No status remarks recorded.'}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export function AccountRecordsWorkspace({
  view,
  initialBranch,
  initialSearch = '',
  initialPaymentStatus,
  ownBranch,
  showAllBranches = false,
  onOpenPaymentWorkspace
}: Props): React.JSX.Element {
  const { rows, isLoading, error, reload } = useInstallmentData(
    view,
    false,
    view === 'records' || view === 'blacklisted'
  )
  const { rows: clientRows, reload: reloadClientRows } = useInstallmentData('records')
  React.useEffect(() => {
    const handleInstallmentsChanged = (): void => reload()
    window.addEventListener('installments:changed', handleInstallmentsChanged)
    return () => window.removeEventListener('installments:changed', handleInstallmentsChanged)
  }, [reload])
  const [search, setSearch] = React.useState(initialSearch)
  const [filters, setFilters] = React.useState<Array<{ field: string; value: string }>>([])
  const [activeStatusFilter, setActiveStatusFilter] = React.useState<ActiveStatusFilter>(
    initialPaymentStatus ?? 'all'
  )
  const [selected, setSelected] = React.useState<PersistedInstallmentRow>()
  const [transition, setTransition] = React.useState<Transition>()
  const [remarks, setRemarks] = React.useState('')
  const [transitionError, setTransitionError] = React.useState<string>()
  const [isTransitionSubmitting, setIsTransitionSubmitting] = React.useState(false)
  const [voidRow, setVoidRow] = React.useState<PersistedInstallmentRow>()
  const [clientDraft, setClientDraft] = React.useState<PersistedInstallmentRow['account']>()
  const [loanDraft, setLoanDraft] = React.useState<LoanEditDraft>()
  const [creator, setCreator] = React.useState<Creator>()
  const [restructureDraft, setRestructureDraft] = React.useState<LoanRestructureDraft>()
  const [isQuoteCalculatorOpen, setIsQuoteCalculatorOpen] = React.useState(false)
  const [isEditSaving, setIsEditSaving] = React.useState(false)
  const { notify } = useNotifications()
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'account', desc: false }])
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25
  })
  const [columnVisibility, setColumnVisibility] = React.useState<Record<string, boolean>>({
    city: false,
    barangay: view === 'records',
    nextDue: false,
    installment: false,
    paymentFrequency: view === 'active',
    terms: false,
    totalPaid: false,
    lastPayment: false
  })
  const filterFields = React.useMemo<ShadcnFilterField[]>(
    () =>
      visibleColumnOptions.flatMap(({ id, label }) => {
        if (columnVisibility[id] === false) return []
        const options = Array.from(
          new Map(
            rows
              .map((row) => accountFilterOption(row, id))
              .filter(({ value }) => value)
              .map((option) => [option.value, option])
          ).values()
        ).sort((left, right) => left.label.localeCompare(right.label))
        return options.length > 0 ? [{ key: id, label, options }] : []
      }),
    [columnVisibility, rows]
  )
  const activeStatusCounts = React.useMemo(() => {
    const branch = ownBranch ?? initialBranch
    return rows.reduce(
      (counts, row) => {
        if (!showAllBranches && branch && row.account.branch !== branch) return counts
        if (row.meta.status === 'overdue') counts.overdue += 1
        else if (row.meta.status === 'due-soon' || row.meta.status === 'due-today')
          counts['due-soon'] += 1
        else if (row.meta.status === 'fully-paid') counts['fully-paid'] += 1
        return counts
      },
      { overdue: 0, 'due-soon': 0, 'fully-paid': 0 }
    )
  }, [initialBranch, ownBranch, rows, showAllBranches])
  const filteredRows = React.useMemo(() => {
    const query = search.trim().toLowerCase()
    return rows.filter((row) => {
      const branch = ownBranch ?? initialBranch
      if (!showAllBranches && branch && row.account.branch !== branch) return false
      return (
        (!query ||
          `${formatAccountName(row.account)} ${row.contractId}`.toLowerCase().includes(query)) &&
        filters.every((filter) => matchesAccountFilter(row, filter)) &&
        (view !== 'active' ||
          activeStatusFilter === 'all' ||
          (activeStatusFilter === 'due-soon'
            ? row.meta.status === 'due-soon' || row.meta.status === 'due-today'
            : row.meta.status === activeStatusFilter))
      )
    })
  }, [activeStatusFilter, filters, initialBranch, ownBranch, rows, search, showAllBranches, view])
  const saveClientRecord = async (): Promise<void> => {
    if (!clientDraft || isEditSaving) return
    setIsEditSaving(true)
    try {
      await window.api.installments.bootstrap({ accounts: [clientDraft], loans: [] })
      setClientDraft(undefined)
      reload()
      notify({ type: 'success', title: 'Client record updated.' })
    } catch {
      notify({ type: 'error', title: 'Client record could not be updated.' })
    } finally {
      setIsEditSaving(false)
    }
  }
  const saveClientLoan = async (): Promise<void> => {
    if (!loanDraft || isEditSaving) return
    setIsEditSaving(true)
    try {
      await window.api.installments.updateLoan({
        accountId: loanDraft.accountId,
        contractId: loanDraft.contractId,
        dateReleased: loanDraft.dateReleased,
        paymentFrequency: loanDraft.paymentFrequency,
        terms: Number(loanDraft.terms),
        downPaymentCentavos: Math.round(Number(loanDraft.downPayment) * 100),
        remarks: loanDraft.remarks || undefined
      })
      setLoanDraft(undefined)
      reload()
      notify({ type: 'success', title: 'Client loan updated.' })
    } catch {
      notify({ type: 'error', title: 'Client loan could not be updated.' })
    } finally {
      setIsEditSaving(false)
    }
  }
  const createAccountOrLoan = async (payload: InHouseAccountWorkflowSave): Promise<void> => {
    const now = new Date().toISOString()
    const existing =
      payload.mode === 'existing'
        ? clientRows.find((row) => row.account.id === payload.customerId)?.account
        : undefined
    if (payload.mode === 'existing' && !existing) throw new Error('Selected client was not found.')
    const account = existing ?? {
      ...payload.accountDraft,
      id: `account-${crypto.randomUUID()}`,
      createdAt: now,
      updatedAt: now
    }
    await window.api.installments.bootstrap({
      accounts: [account],
      loans: payload.createLoan
        ? [
            {
              ...payload.loanDraft,
              id: `loan-${crypto.randomUUID()}`,
              customerId: account.id,
              createdAt: now,
              updatedAt: now
            }
          ]
        : []
    })
    setCreator(undefined)
    reload()
    reloadClientRows()
    notify({
      type: 'success',
      title: payload.createLoan
        ? payload.mode === 'new'
          ? 'Client added.'
          : 'Loan added.'
        : 'Client added.'
    })
  }
  const updateClientOrLoan = async (payload: InHouseAccountWorkflowSave): Promise<void> => {
    if (!creator || !('row' in creator)) return
    if (creator.kind === 'update-client') {
      await window.api.installments.bootstrap({
        accounts: [
          {
            ...payload.accountDraft,
            id: creator.row.account.id,
            createdAt: creator.row.account.createdAt,
            updatedAt: creator.row.account.updatedAt
          }
        ],
        loans: []
      })
      notify({ type: 'success', title: 'Client record updated.' })
    } else {
      await window.api.installments.updateLoan({
        accountId: creator.row.account.id,
        contractId: creator.row.contractId,
        dateReleased: payload.loanDraft.dateReleased,
        paymentFrequency:
          payload.loanDraft.paymentFrequency === 'Daily' ||
          payload.loanDraft.paymentFrequency === 'Weekly' ||
          payload.loanDraft.paymentFrequency === 'Monthly'
            ? payload.loanDraft.paymentFrequency
            : 'Semi',
        terms: Number(payload.loanDraft.terms),
        downPaymentCentavos: Math.round(payload.loanDraft.downPayment * 100),
        remarks: payload.loanDraft.remarks || undefined
      })
      notify({ type: 'success', title: 'Client loan updated.' })
    }
    setCreator(undefined)
    reload()
    reloadClientRows()
  }
  const saveRestructure = async (): Promise<void> => {
    if (!restructureDraft || isEditSaving) return
    setIsEditSaving(true)
    try {
      await window.api.installments.restructureLoan({
        accountId: restructureDraft.row.account.id,
        contractId: restructureDraft.row.contractId,
        firstDueDate: restructureDraft.firstDueDate,
        paymentFrequency: restructureDraft.paymentFrequency,
        terms: Number(restructureDraft.terms),
        reason: restructureDraft.reason
      })
      setRestructureDraft(undefined)
      reload()
      reloadClientRows()
      notify({ type: 'success', title: 'Loan repayment schedule restructured.' })
    } catch (error) {
      notify({
        type: 'error',
        title: error instanceof Error ? error.message : 'Loan could not be restructured.'
      })
    } finally {
      setIsEditSaving(false)
    }
  }
  const openTransition = React.useCallback(
    (kind: Transition['kind'], row: PersistedInstallmentRow) => {
      setTransition({ kind, row })
      setRemarks('')
      setTransitionError(undefined)
    },
    []
  )
  const submitTransition = async (): Promise<void> => {
    if (!transition || isTransitionSubmitting) return
    setIsTransitionSubmitting(true)
    setTransitionError(undefined)
    try {
      const request = {
        accountId: transition.row.account.id,
        contractId: transition.row.contractId,
        remarks,
        actorUserId: 'development-cashier'
      }
      if (transition.kind === 'close') await window.api.installments.closeContract(request)
      else if (transition.kind === 'blacklist')
        await window.api.installments.blacklistAccount(request)
      else
        await window.api.installments.restoreStatus({
          ...request,
          status: transition.kind === 'restore-closed' ? 'closed' : 'blacklisted'
        })
      const title =
        transition.kind === 'close'
          ? 'Account closed.'
          : transition.kind === 'blacklist'
            ? 'Account blacklisted.'
            : 'Account restored to active.'
      setTransition(undefined)
      setSelected(undefined)
      reload()
      notify({ type: 'success', title })
    } catch (error) {
      setTransitionError(
        error && typeof error === 'object' && 'message' in error
          ? String(error.message)
          : 'The account status could not be updated.'
      )
    } finally {
      setIsTransitionSubmitting(false)
    }
  }
  const actionItems = React.useCallback(
    (row: PersistedInstallmentRow): readonly RowActionItem[] => {
      const actions: RowActionItem[] = [
        { id: 'view-details', label: 'View Details', onSelect: () => setSelected(row) }
      ]
      if (ownBranch !== row.account.branch) return actions
      if (view === 'records')
        actions.push({
          id: 'update-client-record',
          label: 'Update Client Record',
          onSelect: () => setCreator({ kind: 'update-client', row })
        })
      if (view === 'active' && row.meta.lastPayment)
        actions.push({
          id: 'restructure-client-loan',
          label: 'Restructure Loan',
          onSelect: () =>
            setRestructureDraft({
              row,
              firstDueDate: new Date().toISOString().slice(0, 10),
              paymentFrequency:
                row.loan.paymentFrequency === 'Daily' ||
                row.loan.paymentFrequency === 'Weekly' ||
                row.loan.paymentFrequency === 'Monthly'
                  ? row.loan.paymentFrequency
                  : 'Semi',
              terms: row.loan.terms,
              reason: ''
            })
        })
      else if (view === 'active')
        actions.push({
          id: 'update-client-loan',
          label: 'Update Client Loan',
          onSelect: () => setCreator({ kind: 'update-loan', row })
        })
      const hasBalance = (row.meta.outstandingBalance ?? 0) > 0
      if (
        onOpenPaymentWorkspace &&
        row.contractStatus === 'ACTIVE' &&
        row.accountStatus === 'ACTIVE' &&
        (hasBalance || row.meta.status === 'fully-paid')
      )
        actions.push({
          id: 'record-payment',
          label: 'Record Payment',
          onSelect: () =>
            onOpenPaymentWorkspace(
              row.account.id,
              hasBalance ? 'schedule' : 'ledger',
              view,
              undefined,
              hasBalance
            )
        })
      if (
        row.contractStatus === 'ACTIVE' &&
        row.accountStatus === 'ACTIVE' &&
        row.meta.outstandingBalance === 0
      )
        actions.push({
          id: 'close',
          label: 'Close Account',
          onSelect: () => openTransition('close', row),
          destructive: true
        })
      if (row.accountStatus === 'ACTIVE')
        actions.push({
          id: 'blacklist',
          label: 'Blacklist Account',
          onSelect: () => openTransition('blacklist', row),
          destructive: true
        })
      if (view === 'closed' && row.contractStatus === 'CLOSED')
        actions.push({
          id: 'restore-closed',
          label: 'Restore to Active',
          onSelect: () => openTransition('restore-closed', row)
        })
      if (view === 'blacklisted' && row.accountStatus === 'BLACKLISTED')
        actions.push({
          id: 'restore-blacklisted',
          label: 'Restore to Active',
          onSelect: () => openTransition('restore-blacklisted', row)
        })
      if (row.contractId && row.contractStatus !== 'VOIDED')
        actions.push({
          id: 'void',
          label: 'Void Account',
          onSelect: () => setVoidRow(row),
          destructive: true
        })
      return actions
    },
    [onOpenPaymentWorkspace, openTransition, ownBranch, view]
  )
  const handleRowDoubleClick = React.useCallback(
    (row: PersistedInstallmentRow): void => {
      const hasBalance = (row.meta.outstandingBalance ?? 0) > 0
      if (
        view === 'active' &&
        onOpenPaymentWorkspace &&
        ownBranch === row.account.branch &&
        row.contractStatus === 'ACTIVE' &&
        row.accountStatus === 'ACTIVE' &&
        (hasBalance || row.meta.status === 'fully-paid')
      ) {
        onOpenPaymentWorkspace(
          row.account.id,
          hasBalance ? 'schedule' : 'ledger',
          view,
          undefined,
          hasBalance
        )
        return
      }
      setSelected(row)
    },
    [onOpenPaymentWorkspace, ownBranch, view]
  )
  const columns = React.useMemo<ColumnDef<PersistedInstallmentRow>[]>(
    () => [
      {
        id: 'account',
        header: 'Account',
        accessorFn: (row) => formatAccountName(row.account),
        cell: ({ row }) => (
          <span className="font-medium">{formatAccountName(row.original.account)}</span>
        )
      },
      {
        id: 'branch',
        header: 'Branch',
        accessorFn: (row) => row.account.branch,
        cell: ({ row }) => <AccountBranchBadge branch={row.original.account.branch} />
      },
      {
        id: 'city',
        header: 'City',
        accessorFn: (row) => row.account.cityMunicipality,
        cell: ({ row }) => row.original.account.cityMunicipality
      },
      {
        id: 'barangay',
        header: 'Barangay',
        accessorFn: (row) => row.account.barangay,
        cell: ({ row }) => row.original.account.barangay
      },
      {
        id: 'released',
        header: 'Released',
        accessorFn: (row) => row.loan.dateReleased,
        cell: ({ row }) => formatHistoryDate(row.original.loan.dateReleased)
      },
      {
        id: 'balance',
        header: 'Balance',
        accessorFn: (row) => row.meta.outstandingBalance,
        cell: ({ row }) => (
          <span className="block text-right tabular-nums">
            {formatHistoryMoney(row.original.meta.outstandingBalance)}
          </span>
        ),
        meta: { cellClassName: 'text-right' }
      },
      ...(view === 'active'
        ? [
            {
              id: 'nextPayment',
              header: 'Next payment',
              accessorFn: (row: PersistedInstallmentRow) => row.meta.nextDue ?? '',
              cell: ({ row }: { row: { original: PersistedInstallmentRow } }) => {
                const countdown = paymentCountdown(row.original.meta.nextDue)
                return (
                  <span className={cn(countdown.isOverdue && 'font-medium text-destructive')}>
                    {row.original.meta.status === 'fully-paid' ? 'Fully paid' : countdown.label}
                  </span>
                )
              }
            } satisfies ColumnDef<PersistedInstallmentRow>
          ]
        : []),
      {
        id: 'status',
        header: 'Status',
        accessorFn: (row) => row.meta.status,
        cell: ({ row }) => <AccountStatusBadge status={row.original.meta.status} />
      },
      {
        id: 'nextDue',
        header: 'Next due',
        accessorFn: (row) => row.meta.nextDue ?? '',
        cell: ({ row }) => formatHistoryDate(row.original.meta.nextDue)
      },
      {
        id: 'installment',
        header: 'Installment',
        accessorFn: (row) => row.meta.installmentAmount ?? 0,
        cell: ({ row }) => (
          <span className="block text-right tabular-nums">
            {formatHistoryMoney(row.original.meta.installmentAmount)}
          </span>
        ),
        meta: { cellClassName: 'text-right' }
      },
      {
        id: 'paymentFrequency',
        header: 'Payment frequency',
        enableHiding: view !== 'active',
        accessorFn: (row) => row.meta.paymentFrequency ?? '',
        cell: ({ row }) => row.original.meta.paymentFrequency || '—'
      },
      {
        id: 'terms',
        header: 'Terms',
        accessorFn: (row) => row.meta.terms ?? '',
        cell: ({ row }) => row.original.meta.terms || '—'
      },
      {
        id: 'totalPaid',
        header: 'Total paid',
        accessorFn: (row) => row.meta.totalPaid ?? 0,
        cell: ({ row }) => (
          <span className="block text-right tabular-nums">
            {formatHistoryMoney(row.original.meta.totalPaid)}
          </span>
        ),
        meta: { cellClassName: 'text-right' }
      },
      {
        id: 'lastPayment',
        header: 'Last payment',
        accessorFn: (row) => row.meta.lastPayment ?? '',
        cell: ({ row }) => formatHistoryDate(row.original.meta.lastPayment)
      },
      ...(view === 'closed' || view === 'blacklisted'
        ? [
            {
              id: 'remarks',
              header: 'Remarks',
              accessorFn: (row: PersistedInstallmentRow) => row.statusRemarks ?? '',
              cell: ({ row }: { row: { original: PersistedInstallmentRow } }) =>
                row.original.statusRemarks || '—'
            } satisfies ColumnDef<PersistedInstallmentRow>
          ]
        : []),
      createRowActionsColumn<PersistedInstallmentRow>({
        label: 'Account actions',
        getActions: actionItems
      })
    ],
    [actionItems, view]
  )
  const table = useReactTable({
    data: filteredRows,
    columns,
    state: { sorting, pagination, columnVisibility },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.contractId
  })
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-3">
      <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SearchInputGroup
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search account"
            aria-label="Search account"
          />
          <ShadcnTableFilters
            fields={filterFields}
            filters={filters}
            onChange={(next) => {
              setFilters(next)
              setPagination((current) => ({ ...current, pageIndex: 0 }))
            }}
            className="shrink-0"
          />
          {view === 'active' && (
            <div className="flex items-center gap-1.5">
              {activeStatusFilters.map(({ value, label }) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={activeStatusFilter === value ? 'secondary' : 'outline'}
                  className="relative gap-2"
                  aria-pressed={activeStatusFilter === value}
                  onClick={() => {
                    setActiveStatusFilter((current) => (current === value ? 'all' : value))
                    setPagination((current) => ({ ...current, pageIndex: 0 }))
                  }}
                >
                  {label}
                  {activeStatusCounts[value] > 0 && (
                    <Badge
                      variant={activeStatusBadgeVariant[value]}
                      size="sm"
                      radius="full"
                      className="absolute -top-1.5 -right-2 px-1 text-white"
                      aria-hidden="true"
                    >
                      {activeStatusCounts[value]}
                    </Badge>
                  )}
                </Button>
              ))}
            </div>
          )}
          <Popover>
            <PopoverTrigger
              render={
                <Button type="button" size="sm" variant="outline">
                  <Columns3 data-icon="inline-start" />
                  Columns
                </Button>
              }
            />
            <PopoverContent align="start" className="w-48 p-2">
              <PopoverTitle className="px-2 pb-2 text-xs font-medium text-muted-foreground">
                Show columns
              </PopoverTitle>
              {visibleColumnOptions.map(({ id, label }) => {
                const column = table.getAllLeafColumns().find((column) => column.id === id)
                if (!column?.getCanHide()) return null
                return (
                  <label
                    key={id}
                    htmlFor={`column-${id}`}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <Checkbox
                      id={`column-${id}`}
                      checked={column.getIsVisible()}
                      onCheckedChange={(checked) => column.toggleVisibility(checked === true)}
                    />
                    {label}
                  </label>
                )
              })}
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex items-center gap-3">
          {ownBranch && view === 'records' && (
            <Button type="button" size="sm" onClick={() => setCreator({ kind: 'new-client' })}>
              Add Client
            </Button>
          )}
          {ownBranch && view === 'active' && (
            <>
              <Button type="button" size="sm" variant="outline" onClick={() => setIsQuoteCalculatorOpen(true)}>
                Calculate installment
              </Button>
              <Button type="button" size="sm" onClick={() => setCreator({ kind: 'new-loan' })}>
                Add Loan
              </Button>
            </>
          )}
        </div>
      </div>
      <InstallmentQuoteCalculator open={isQuoteCalculatorOpen} onOpenChange={setIsQuoteCalculatorOpen} />
      <Card className="flex min-h-0 min-w-0 flex-1 flex-col">
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          <UniversalDataTable
            table={table}
            recordCount={filteredRows.length}
            isLoading={isLoading}
            error={error}
            onRetry={reload}
            emptyMessage="No account records found."
            onRowDoubleClick={handleRowDoubleClick}
            paginationSizes={[25, 50, 100]}
            paginationInfo="Showing {from}-{to} of {count} records"
            tableLayout={{ columnsResizable: true }}
          />
        </CardContent>
      </Card>
      <Sheet
        open={Boolean(clientDraft)}
        onOpenChange={(open) => !open && setClientDraft(undefined)}
      >
        <SheetContent side="right" className="flex w-[min(92vw,30rem)] flex-col p-0">
          <SheetHeader>
            <SheetTitle>Update Client Record</SheetTitle>
            <SheetDescription>
              Update the client’s identifying and address details.
            </SheetDescription>
          </SheetHeader>
          {clientDraft && (
            <FieldGroup className="grid min-h-0 flex-1 grid-cols-2 content-start gap-3 overflow-y-auto px-4 pb-4">
              <Field>
                <FieldLabel htmlFor="client-first-name">First name</FieldLabel>
                <Input
                  id="client-first-name"
                  value={clientDraft.firstName}
                  onChange={(event) =>
                    setClientDraft(
                      (current) => current && { ...current, firstName: event.target.value }
                    )
                  }
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="client-last-name">Last name</FieldLabel>
                <Input
                  id="client-last-name"
                  value={clientDraft.lastName}
                  onChange={(event) =>
                    setClientDraft(
                      (current) => current && { ...current, lastName: event.target.value }
                    )
                  }
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="client-middle-name">Middle name</FieldLabel>
                <Input
                  id="client-middle-name"
                  value={clientDraft.middleName ?? ''}
                  onChange={(event) =>
                    setClientDraft(
                      (current) => current && { ...current, middleName: event.target.value }
                    )
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="client-suffix">Suffix</FieldLabel>
                <Input
                  id="client-suffix"
                  value={clientDraft.suffix ?? ''}
                  onChange={(event) =>
                    setClientDraft(
                      (current) => current && { ...current, suffix: event.target.value }
                    )
                  }
                />
              </Field>
              <Field className="col-span-2">
                <FieldLabel htmlFor="client-street">Street / subdivision</FieldLabel>
                <Input
                  id="client-street"
                  value={clientDraft.streetSubdivision ?? ''}
                  onChange={(event) =>
                    setClientDraft(
                      (current) => current && { ...current, streetSubdivision: event.target.value }
                    )
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="client-barangay">Barangay</FieldLabel>
                <Input
                  id="client-barangay"
                  value={clientDraft.barangay}
                  onChange={(event) =>
                    setClientDraft(
                      (current) => current && { ...current, barangay: event.target.value }
                    )
                  }
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="client-city">City / municipality</FieldLabel>
                <Input
                  id="client-city"
                  value={clientDraft.cityMunicipality}
                  onChange={(event) =>
                    setClientDraft(
                      (current) => current && { ...current, cityMunicipality: event.target.value }
                    )
                  }
                  required
                />
              </Field>
              <Field className="col-span-2">
                <FieldLabel htmlFor="client-province">Province</FieldLabel>
                <Input
                  id="client-province"
                  value={clientDraft.province}
                  onChange={(event) =>
                    setClientDraft(
                      (current) => current && { ...current, province: event.target.value }
                    )
                  }
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="client-occupation">Occupation</FieldLabel>
                <Input
                  id="client-occupation"
                  value={clientDraft.occupation ?? ''}
                  onChange={(event) =>
                    setClientDraft(
                      (current) => current && { ...current, occupation: event.target.value }
                    )
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="client-agent">Agent</FieldLabel>
                <Input
                  id="client-agent"
                  value={clientDraft.agent ?? ''}
                  onChange={(event) =>
                    setClientDraft(
                      (current) => current && { ...current, agent: event.target.value }
                    )
                  }
                />
              </Field>
            </FieldGroup>
          )}
          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => setClientDraft(undefined)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void saveClientRecord()} disabled={isEditSaving}>
              Save client
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <Sheet open={Boolean(loanDraft)} onOpenChange={(open) => !open && setLoanDraft(undefined)}>
        <SheetContent side="right" className="flex w-[min(92vw,30rem)] flex-col p-0">
          <SheetHeader>
            <SheetTitle>Update Client Loan</SheetTitle>
            <SheetDescription>
              Changing a loan rebuilds its schedule and is unavailable after payment is posted.
            </SheetDescription>
          </SheetHeader>
          {loanDraft && (
            <FieldGroup className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto px-4 pb-4">
              <Field>
                <FieldLabel htmlFor="loan-date-released">Date released</FieldLabel>
                <DatePickerInput
                  id="loan-date-released"
                  value={loanDraft.dateReleased}
                  onValueChange={(date) =>
                    setLoanDraft(
                      (current) => current && { ...current, dateReleased: date }
                    )
                  }
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="loan-payment-frequency">Payment frequency</FieldLabel>
                <Select
                  value={loanDraft.paymentFrequency}
                  onValueChange={(value) =>
                    setLoanDraft(
                      (current) =>
                        current && {
                          ...current,
                          paymentFrequency: value as LoanEditDraft['paymentFrequency']
                        }
                    )
                  }
                >
                  <SelectTrigger id="loan-payment-frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Daily">Daily</SelectItem>
                    <SelectItem value="Weekly">Weekly</SelectItem>
                    <SelectItem value="Semi">Semi-monthly</SelectItem>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="loan-terms">Terms</FieldLabel>
                <Input
                  id="loan-terms"
                  type="number"
                  min="1"
                  value={loanDraft.terms}
                  onChange={(event) =>
                    setLoanDraft((current) => current && { ...current, terms: event.target.value })
                  }
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="loan-down-payment">Down payment</FieldLabel>
                <AmountInputGroup
                  id="loan-down-payment"
                  name="loan-down-payment"
                  value={loanDraft.downPayment}
                  onValueChange={(value) =>
                    setLoanDraft((current) => current && { ...current, downPayment: value })
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="loan-remarks">Remarks</FieldLabel>
                <Textarea
                  id="loan-remarks"
                  value={loanDraft.remarks}
                  onChange={(event) =>
                    setLoanDraft(
                      (current) => current && { ...current, remarks: event.target.value }
                    )
                  }
                />
              </Field>
            </FieldGroup>
          )}
          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => setLoanDraft(undefined)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void saveClientLoan()} disabled={isEditSaving}>
              Save loan
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <Dialog open={Boolean(creator)} onOpenChange={(open) => !open && setCreator(undefined)}>
        <DialogContent className="flex h-[min(92vh,52rem)] w-[min(96vw,72rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
          <DialogHeader className="sr-only">
            <DialogTitle>
              {creator?.kind === 'new-client'
                ? 'Add Client'
                : creator?.kind === 'new-loan'
                  ? 'Add Loan'
                  : creator?.kind === 'update-client'
                    ? 'Update Client Record'
                    : 'Update Client Loan'}
            </DialogTitle>
            <DialogDescription>Use the existing account and loan creator.</DialogDescription>
          </DialogHeader>
          {creator && (
            <InHouseAccountForm
              key={`${creator.kind}-${'row' in creator ? creator.row.contractId : ''}`}
              initialMode={
                creator.kind === 'new-client' || creator.kind === 'update-client'
                  ? 'new'
                  : 'existing'
              }
              initialBranch={ownBranch}
              initialAccountDraft={'row' in creator ? creator.row.account : undefined}
              initialLoanDraft={'row' in creator ? creator.row.loan : undefined}
              initialCreateLoan={creator.kind !== 'update-client'}
              initialSelectedCustomerId={
                creator.kind === 'update-loan' ? creator.row.account.id : undefined
              }
              lockMode={creator.kind === 'update-client' || creator.kind === 'update-loan'}
              lockCreateLoan={creator.kind === 'update-client' || creator.kind === 'update-loan'}
              submitLabel={creator.kind.startsWith('update') ? 'Update' : undefined}
              existingRows={
                ownBranch ? clientRows.filter((row) => row.account.branch === ownBranch) : []
              }
              onCancel={() => setCreator(undefined)}
              onSave={creator.kind.startsWith('update') ? updateClientOrLoan : createAccountOrLoan}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(restructureDraft)}
        onOpenChange={(open) => !open && setRestructureDraft(undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restructure Loan</DialogTitle>
            <DialogDescription>
              Posted payments remain unchanged. The outstanding balance will be divided into a new
              repayment schedule.
            </DialogDescription>
          </DialogHeader>
          {restructureDraft && (
            <FieldGroup>
              <Field>
                <FieldLabel>Outstanding balance</FieldLabel>
                <Input
                  value={formatHistoryMoney(restructureDraft.row.meta.outstandingBalance)}
                  readOnly
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="restructure-first-due">New first due date</FieldLabel>
                <DatePickerInput
                  id="restructure-first-due"
                  min={new Date().toISOString().slice(0, 10)}
                  value={restructureDraft.firstDueDate}
                  onValueChange={(date) =>
                    setRestructureDraft(
                      (current) => current && { ...current, firstDueDate: date }
                    )
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="restructure-frequency">Payment frequency</FieldLabel>
                <select
                  id="restructure-frequency"
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={restructureDraft.paymentFrequency}
                  onChange={(event) =>
                    setRestructureDraft(
                      (current) =>
                        current && {
                          ...current,
                          paymentFrequency: event.target
                            .value as LoanRestructureDraft['paymentFrequency']
                        }
                    )
                  }
                >
                  <option value="Daily">Daily</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Semi">Semi-monthly</option>
                  <option value="Monthly">Monthly</option>
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="restructure-terms">Remaining payments</FieldLabel>
                <Input
                  id="restructure-terms"
                  type="number"
                  min="1"
                  value={restructureDraft.terms}
                  onChange={(event) =>
                    setRestructureDraft(
                      (current) => current && { ...current, terms: event.target.value }
                    )
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="restructure-reason">Reason</FieldLabel>
                <Textarea
                  id="restructure-reason"
                  value={restructureDraft.reason}
                  onChange={(event) =>
                    setRestructureDraft(
                      (current) => current && { ...current, reason: event.target.value }
                    )
                  }
                />
              </Field>
            </FieldGroup>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRestructureDraft(undefined)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                isEditSaving || !restructureDraft?.reason.trim() || !Number(restructureDraft?.terms)
              }
              onClick={() => void saveRestructure()}
            >
              Restructure loan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(undefined)}>
        <DialogContent className="flex h-[min(90vh,58rem)] w-[min(94vw,95rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
          <DialogHeader className="shrink-0 flex-row items-center justify-between gap-4 border-b px-5 py-3 pr-12">
            <div className="min-w-0">
              <DialogTitle className="truncate text-base font-semibold">
                {selected ? formatAccountName(selected.account) : 'Client portfolio'}
              </DialogTitle>
              {selected && (
                <DialogDescription className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  <span>Client portfolio</span>
                  <AccountBranchBadge branch={selected.account.branch} />
                  <span className="font-mono">{selected.contractId}</span>
                </DialogDescription>
              )}
            </div>
            {selected && <AccountStatusBadge status={selected.meta.status} />}
          </DialogHeader>
          {selected && (
            <ClientPortfolioModal
              selected={selected}
              rows={rows}
              onEditClient={
                view === 'records' && ownBranch === selected.account.branch
                  ? () => setCreator({ kind: 'update-client', row: selected })
                  : undefined
              }
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(transition)} onOpenChange={(open) => !open && setTransition(undefined)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {transition?.kind === 'close'
                ? 'Close account'
                : transition?.kind === 'blacklist'
                  ? 'Blacklist account'
                  : 'Restore account to active'}
            </DialogTitle>
            <DialogDescription>Enter a required note for this status change.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={Boolean(transitionError)}>
              <FieldLabel htmlFor="account-status-remarks">Remarks (optional)</FieldLabel>
              <Textarea
                id="account-status-remarks"
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                aria-invalid={Boolean(transitionError)}
                autoFocus
              />
              {transitionError && <FieldError>{transitionError}</FieldError>}
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTransition(undefined)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant={
                transition?.kind === 'close' || transition?.kind === 'blacklist'
                  ? 'destructive'
                  : 'default'
              }
              disabled={isTransitionSubmitting}
              onClick={() => void submitTransition()}
            >
              {isTransitionSubmitting ? 'Updating…' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AdminPasswordConfirmationDialog
        open={Boolean(voidRow)}
        title="Void account?"
        description="This removes the account contract from the workspace while preserving its financial history."
        confirmLabel="Void Account"
        requireReason
        onOpenChange={(open) => !open && setVoidRow(undefined)}
        onConfirm={async (password, reason) => {
          if (!voidRow) return
          await window.api.installments.void({
            contractIds: [voidRow.contractId],
            password,
            reason: reason ?? ''
          })
          setSelected(undefined)
          reload()
          notify({ type: 'success', title: 'Account voided.' })
        }}
      />
    </div>
  )
}
