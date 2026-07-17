import * as React from 'react'
import { format, isValid, parse } from 'date-fns'
import { CalendarIcon } from '@phosphor-icons/react'

import { Card, CardContent } from '@/components/ui/card'
import { Calendar } from '@/components/ui/calendar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ReportDataTable, type ReportColumn, type ReportRow } from '@/components/report-data-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText
} from '@/components/ui/input-group'
import { InstallmentHistoryInspector } from '@/components/installment-history-inspector'
import { InstallmentHistoryTable } from '@/components/installment-history-table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { installmentHistoryData, type InstallmentHistoryRecord } from '@/lib/installment-history'
import { useIsMobile } from '@/hooks/use-mobile'

const reportTabs = ['Expenses', 'Income', 'Payment', 'Activity'] as const

const expenseTypes = ['Company Expenses', 'Drawings', 'Purchases', 'Receivables'] as const
const vatOptions = ['VAT', 'Non-VAT', 'Blank'] as const
const paymentTypes = ['Bank Check', 'Bank Transfer', 'GCash', 'Other e-wallet'] as const

const expenseCategories = [
  'Advertising',
  'Education and training expenses for employees',
  'Licenses and Permits',
  'Bank Fees',
  'Employee Benefit Programs',
  'Office Expenses and Supplies',
  'Business Meals',
  'Food Allowance',
  'Printing',
  'Charitable Contributions',
  'Freight, Postage and Shipping',
  'Rent',
  'Credit and Collection Fees',
  'Insurance',
  'Salaries and Compensation',
  'Dues and Subscriptions',
  'Legal and professional expenses',
  'Telephone/Communication Expense',
  'Transporation Allowance',
  'Utilities',
  'Vehicle Maintenance and Repairs',
  'Others'
] as const

type ExpenseRow = ReportRow & {
  type: string
  description: string
  category: string
  receiptNo: string
  vat: string
  amount: number
}

type IncomeRow = ReportRow & {
  particular: string
  remarks: string
  receiptRefNo: string
  date: string
  amount: number
}
type PaymentRow = ReportRow & {
  type: string
  bankProvider: string
  accountName: string
  referenceNo: string
  date: string
  amount: number
}

const money = (value: number): string =>
  `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`

const typeClassNames: Record<string, string> = {
  Operating:
    'border-sky-200/70 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300',
  Supply:
    'border-amber-200/70 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  Transport:
    'border-violet-200/70 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300',
  Cash: 'border-emerald-200/70 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  'Bank Check':
    'border-emerald-200/70 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  'Bank Transfer':
    'border-violet-200/70 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300',
  GCash:
    'border-blue-200/70 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
  'Other e-wallet':
    'border-amber-200/70 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
}

function TypeBox({ value }: { value: string }): React.JSX.Element {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${typeClassNames[value] ?? 'border-border bg-muted text-muted-foreground'}`}
    >
      {value}
    </span>
  )
}

const expenseColumns: ReportColumn<ExpenseRow>[] = [
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ getValue }) => <TypeBox value={getValue<string>()} />,
    meta: { className: 'w-[17%]' }
  },
  {
    accessorKey: 'description',
    header: 'Description',
    meta: { className: 'w-[30%] font-medium' }
  },
  {
    accessorKey: 'category',
    header: 'Category',
    meta: { className: 'w-[15%] text-muted-foreground' }
  },
  {
    accessorKey: 'receiptNo',
    header: 'Receipt No.',
    meta: { className: 'w-[12%] text-muted-foreground' }
  },
  { accessorKey: 'vat', header: 'VAT', meta: { className: 'w-[8%] text-muted-foreground' } },
  {
    accessorKey: 'amount',
    header: 'Amount',
    cell: ({ getValue }) => money(getValue<number>()),
    meta: { className: 'w-[18%] text-right font-medium tabular-nums text-foreground' }
  }
]

const incomeColumns: ReportColumn<IncomeRow>[] = [
  { accessorKey: 'date', header: 'DATE', meta: { className: 'w-[15%] text-muted-foreground' } },
  { accessorKey: 'particular', header: 'PARTICULAR', meta: { className: 'w-[25%] font-medium' } },
  {
    accessorKey: 'receiptRefNo',
    header: 'RECEIPT / REFERENCE NO.',
    meta: { className: 'w-[22%] text-muted-foreground' }
  },
  {
    accessorKey: 'remarks',
    header: 'REMARKS',
    meta: { className: 'w-[28%] text-muted-foreground' }
  },
  {
    accessorKey: 'amount',
    header: 'AMOUNT',
    cell: ({ getValue }) => money(getValue<number>()),
    meta: { className: 'w-[10%] text-right font-medium tabular-nums text-foreground' }
  }
]

const paymentColumns: ReportColumn<PaymentRow>[] = [
  {
    accessorKey: 'type',
    header: 'TYPE',
    cell: ({ getValue }) => <TypeBox value={getValue<string>()} />
  },
  {
    accessorKey: 'bankProvider',
    header: 'BANK / PROVIDER',
    meta: { className: 'text-muted-foreground' }
  },
  { accessorKey: 'accountName', header: 'ACCOUNT NAME', meta: { className: 'font-medium' } },
  {
    accessorKey: 'referenceNo',
    header: 'REFERENCE NO.',
    meta: { className: 'text-muted-foreground' }
  },
  { accessorKey: 'date', header: 'DATE', meta: { className: 'text-muted-foreground' } },
  {
    accessorKey: 'amount',
    header: 'AMOUNT',
    cell: ({ getValue }) => money(getValue<number>()),
    meta: { className: 'text-right font-medium tabular-nums text-foreground' }
  }
]

const expenseData: ExpenseRow[] = Array.from({ length: 105 }, (_, index) => ({
  id: `expense-${index + 1}`,
  type: index % 3 === 0 ? 'Operating' : index % 3 === 1 ? 'Supply' : 'Transport',
  description: [
    'Printer paper, toner, and office supplies',
    'Fuel and tolls for customer deliveries',
    'Monthly electricity and water bill'
  ][index % 3],
  category: ['Office Expenses and Supplies', 'Freight, Postage and Shipping', 'Utilities'][
    index % 3
  ],
  receiptNo: `EXP-${String(index + 1).padStart(4, '0')}`,
  vat: index % 3 === 0 ? 'VAT' : index % 3 === 1 ? 'Non-VAT' : '',
  amount: 350 + index * 25
}))

const incomeData: IncomeRow[] = [
  {
    id: 'income-1',
    particular: 'Retail sale',
    remarks: 'Daily merchandise sales',
    receiptRefNo: 'OR-1001',
    date: '2026-07-14',
    amount: 12500
  },
  {
    id: 'income-2',
    particular: 'Service fee',
    remarks: 'Installation service',
    receiptRefNo: 'OR-1002',
    date: '2026-07-14',
    amount: 3200
  }
]

const paymentData: PaymentRow[] = [
  {
    id: 'payment-1',
    type: 'Bank Check',
    bankProvider: 'BDO',
    accountName: 'Ana Santos',
    referenceNo: 'CHK-1001',
    date: '2026-07-14',
    amount: 2500
  },
  {
    id: 'payment-2',
    type: 'GCash',
    bankProvider: 'GCash',
    accountName: 'Luis Cruz',
    referenceNo: 'GC-84721',
    date: '2026-07-14',
    amount: 1800
  }
]

function ReportTab({
  tab,
  onAddEntry,
  addEntryLabel,
  selectedHistoryId,
  onSelectHistory
}: {
  tab: (typeof reportTabs)[number]
  onAddEntry: () => void
  addEntryLabel: string
  selectedHistoryId?: string
  onSelectHistory: (record: InstallmentHistoryRecord) => void
}): React.JSX.Element {
  switch (tab) {
    case 'Expenses':
      return (
        <ReportDataTable
          columns={expenseColumns}
          data={expenseData}
          filterPlaceholder="Filter expenses..."
          onAddEntry={onAddEntry}
          addEntryLabel={addEntryLabel}
        />
      )
    case 'Income':
      return (
        <ReportDataTable
          columns={incomeColumns}
          data={incomeData}
          filterPlaceholder="Filter income..."
          onAddEntry={onAddEntry}
          addEntryLabel={addEntryLabel}
        />
      )
    case 'Payment':
      return (
        <ReportDataTable
          columns={paymentColumns}
          data={paymentData}
          filterPlaceholder="Filter payments..."
          onAddEntry={onAddEntry}
          addEntryLabel={addEntryLabel}
        />
      )
    case 'Activity':
      return (
        <InstallmentHistoryTable
          records={installmentHistoryData}
          selectedId={selectedHistoryId}
          onSelect={onSelectHistory}
        />
      )
  }
}

const formFields: Record<(typeof reportTabs)[number], string[]> = {
  Expenses: ['Type', 'Description', 'Category', 'Receipt No.', 'VAT', 'Amount'],
  Income: ['Date', 'Particular', 'Receipt / Reference No.', 'Remarks', 'Amount'],
  Payment: ['Type', 'Bank / Provider', 'Account Name', 'Reference No.', 'Date', 'Amount'],
  Activity: []
}

function ReportDatePicker({ id, label }: { id: string; label: string }): React.JSX.Element {
  const [open, setOpen] = React.useState(false)
  const [date, setDate] = React.useState<Date>()
  const [value, setValue] = React.useState('')

  return (
    <InputGroup>
      <InputGroupInput
        id={id}
        name={id}
        value={value}
        placeholder="YYYY-MM-DD"
        aria-label="Date"
        onChange={(event) => {
          const nextValue = event.target.value
          const nextDate = parse(nextValue, 'yyyy-MM-dd', new Date())
          setValue(nextValue)
          if (
            isValid(nextDate) &&
            nextValue.length === 10 &&
            format(nextDate, 'yyyy-MM-dd') === nextValue
          ) {
            setDate(nextDate)
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setOpen(true)
          }
        }}
      />
      <InputGroupAddon align="inline-end">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <InputGroupButton variant="ghost" size="icon-xs" aria-label={`Select ${label}`} />
            }
          >
            <CalendarIcon />
          </PopoverTrigger>
          <PopoverContent className="w-auto overflow-hidden p-0" align="end">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(nextDate) => {
                setDate(nextDate)
                setValue(nextDate ? format(nextDate, 'yyyy-MM-dd') : '')
                setOpen(false)
              }}
            />
          </PopoverContent>
        </Popover>
      </InputGroupAddon>
    </InputGroup>
  )
}

function ReportDetailsForm({ tab }: { tab: (typeof reportTabs)[number] }): React.JSX.Element {
  return (
    <FieldGroup className="p-4">
      {formFields[tab].map((field) => {
        const id = `${tab}-${field}`.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
        const options =
          tab === 'Expenses' && field === 'Type'
            ? expenseTypes
            : tab === 'Expenses' && field === 'Category'
              ? expenseCategories
              : tab === 'Expenses' && field === 'VAT'
                ? vatOptions
                : tab === 'Payment' && field === 'Type'
                  ? paymentTypes
                  : null

        return (
          <Field key={field}>
            <FieldLabel htmlFor={id}>{field}</FieldLabel>
            {options ? (
              <Select name={id}>
                <SelectTrigger id={id} className="w-full" aria-label={field}>
                  <SelectValue placeholder={`Select ${field.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {options.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            ) : field === 'Date' ? (
              <ReportDatePicker id={id} label={field} />
            ) : /(amount|balance|principal)/i.test(field) ? (
              <InputGroup>
                <InputGroupAddon align="inline-start">
                  <InputGroupText>₱</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  id={id}
                  name={id}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={`Enter ${field.toLowerCase()}`}
                />
              </InputGroup>
            ) : (
              <Input id={id} name={id} placeholder={`Enter ${field.toLowerCase()}`} />
            )}
          </Field>
        )
      })}
    </FieldGroup>
  )
}

function TodaySummary(): React.JSX.Element {
  return (
    <aside className="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/20 p-3">
      <div className="shrink-0 border-b pb-3">
        <p className="text-xs text-muted-foreground">Daily Cashier Report</p>
        <h2 className="text-base font-semibold">Today&apos;s Summary</h2>
        <p className="mt-1 text-xs text-muted-foreground">July 14, 2026</p>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="py-4">
          <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Cash variance</span>
              <span className="text-sm font-semibold">{money(0)}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground">Expected cash</p>
                <p className="mt-1 font-medium">{money(0)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Actual cash</p>
                <p className="mt-1 font-medium">{money(0)}</p>
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            No saved report entries yet.
          </div>
        </div>
      </ScrollArea>
    </aside>
  )
}

function EntryFormActions(): React.JSX.Element {
  return (
    <div className="flex shrink-0 flex-wrap gap-2 border-t p-3">
      <Button type="submit" size="sm">
        Save Entry
      </Button>
      <Button type="button" variant="outline" size="sm">
        Save &amp; New
      </Button>
      <Button type="reset" variant="ghost" size="sm">
        Clear
      </Button>
    </div>
  )
}

function EntryFormPanel({ tab }: { tab: (typeof reportTabs)[number] }): React.JSX.Element {
  return (
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => event.preventDefault()}>
      <ScrollArea className="min-h-0 flex-1">
        <ReportDetailsForm tab={tab} />
      </ScrollArea>
      <EntryFormActions />
    </form>
  )
}

export function CashierReportsContent(): React.JSX.Element {
  const [activeTab, setActiveTab] = React.useState<(typeof reportTabs)[number]>(reportTabs[0])
  const [isEntryFormVisible, setIsEntryFormVisible] = React.useState(false)
  const [isSummaryVisible, setIsSummaryVisible] = React.useState(false)
  const [selectedHistory, setSelectedHistory] = React.useState<InstallmentHistoryRecord>()
  const isMobile = useIsMobile()
  const isHistoryTab = activeTab === 'Activity'
  const showRightPanel = !isMobile && (isHistoryTab || isEntryFormVisible)

  React.useEffect(() => {
    if (!isEntryFormVisible) return
    const firstField = formFields[activeTab][0]
    const id = `${activeTab}-${firstField}`.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    document.getElementById(id)?.focus()
  }, [activeTab, isEntryFormVisible])

  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden p-3">
      <div
        className={
          isMobile
            ? 'grid h-full min-h-0 w-full min-w-0 grid-cols-1 gap-3'
            : showRightPanel
              ? 'grid h-full min-h-0 w-full min-w-0 grid-cols-[minmax(180px,220px)_minmax(0,1fr)_minmax(260px,302px)] gap-3 max-[900px]:grid-cols-[minmax(160px,190px)_minmax(0,1fr)]'
              : 'grid h-full min-h-0 w-full min-w-0 grid-cols-[minmax(220px,262px)_minmax(0,1fr)] gap-3'
        }
      >
        {!isMobile && (
          <Card className="flex min-h-0 min-w-0 flex-col">
            <TodaySummary />
          </Card>
        )}
        <Card className="flex min-h-0 min-w-0 flex-col py-0 shadow-sm">
          <CardContent className="flex min-h-0 flex-1 flex-col p-0">
            <Tabs
              value={activeTab}
              onValueChange={(value) => {
                const nextTab = value as (typeof reportTabs)[number]
                setActiveTab(nextTab)
                if (nextTab === 'Activity') setIsEntryFormVisible(false)
              }}
              className="flex min-h-0 flex-1 flex-col gap-0"
            >
              <div className="shrink-0 overflow-x-auto border-b [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <TabsList
                  aria-label="Cashier report sections"
                  variant="line"
                  className="h-9 w-max min-w-full justify-start rounded-none bg-transparent p-0"
                >
                  {reportTabs.map((tab) => (
                    <TabsTrigger
                      key={tab}
                      value={tab}
                      className="h-9 flex-none rounded-none px-3 text-xs font-normal data-active:font-medium"
                    >
                      {tab === 'Activity' ? 'Installment History' : tab}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {reportTabs.map((tab) => (
                  <TabsContent
                    key={tab}
                    value={tab}
                    className="flex min-h-0 flex-1 flex-col overflow-hidden"
                  >
                    <ReportTab
                      tab={tab}
                      onAddEntry={() => setIsEntryFormVisible((visible) => !visible)}
                      addEntryLabel={isEntryFormVisible ? 'Hide Entry' : 'Add Entry'}
                      selectedHistoryId={selectedHistory?.id}
                      onSelectHistory={setSelectedHistory}
                    />
                  </TabsContent>
                ))}
              </div>
            </Tabs>
          </CardContent>
        </Card>
        {showRightPanel && !isHistoryTab && (
          <Card className="flex min-h-0 min-w-0 flex-col">
            <EntryFormPanel tab={activeTab} />
          </Card>
        )}
        {isHistoryTab && !isMobile && (
          <Card className="flex min-h-0 min-w-0 flex-col">
            <InstallmentHistoryInspector record={selectedHistory} />
          </Card>
        )}
      </div>
      {isMobile && (
        <>
          <Button
            type="button"
            size="sm"
            className="fixed right-4 bottom-4"
            onClick={() => setIsSummaryVisible(true)}
          >
            Today&apos;s Summary
          </Button>
          <Sheet open={isSummaryVisible} onOpenChange={setIsSummaryVisible}>
            <SheetContent side="left" className="w-[min(92vw,22rem)] p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Today&apos;s Summary</SheetTitle>
                <SheetDescription>Daily cashier report totals and cash variance.</SheetDescription>
              </SheetHeader>
              <TodaySummary />
            </SheetContent>
          </Sheet>
        </>
      )}
      {isMobile && !isHistoryTab && (
        <Sheet open={isEntryFormVisible} onOpenChange={setIsEntryFormVisible}>
          <SheetContent side="right" className="w-[min(92vw,26rem)] p-0">
            <SheetHeader>
              <SheetTitle>{activeTab} Entry</SheetTitle>
              <SheetDescription>
                Add a cashier report entry for {activeTab.toLowerCase()}.
              </SheetDescription>
            </SheetHeader>
            <EntryFormPanel tab={activeTab} />
          </SheetContent>
        </Sheet>
      )}
      {isHistoryTab && isMobile && (
        <Sheet
          open={Boolean(selectedHistory)}
          onOpenChange={(open) => !open && setSelectedHistory(undefined)}
        >
          <SheetContent side="right" className="w-[min(92vw,26rem)] p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Installment History details</SheetTitle>
              <SheetDescription>Full details for the selected history record.</SheetDescription>
            </SheetHeader>
            <InstallmentHistoryInspector record={selectedHistory} />
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}
