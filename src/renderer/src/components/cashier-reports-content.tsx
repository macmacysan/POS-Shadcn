import * as React from 'react'

import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ReportDataTable, type ReportColumn, type ReportRow } from '@/components/report-data-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group'

const reportTabs = [
  'Expenses',
  'Income',
  'Payment',
  'Activity'
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
  bankName: string
  accountName: string
  checkNo: string
  date: string
  amount: number
}
type ActivityRow = ReportRow & { time: string; cashier: string; action: string; details: string }

const money = (value: number): string =>
  `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`

const expenseColumns: ReportColumn<ExpenseRow>[] = [
  { accessorKey: 'type', header: 'Type' },
  { accessorKey: 'description', header: 'Description' },
  { accessorKey: 'category', header: 'Category' },
  { accessorKey: 'receiptNo', header: 'Receipt No.' },
  { accessorKey: 'vat', header: 'VAT' },
  {
    accessorKey: 'amount',
    header: 'Amount',
    cell: ({ getValue }) => money(getValue<number>()),
    meta: { className: 'text-right' }
  }
]

const incomeColumns: ReportColumn<IncomeRow>[] = [
  { accessorKey: 'particular', header: 'Particular' },
  { accessorKey: 'remarks', header: 'Remarks' },
  { accessorKey: 'receiptRefNo', header: 'Receipt/Ref No.' },
  { accessorKey: 'date', header: 'Date' },
  { accessorKey: 'amount', header: 'Amount', cell: ({ getValue }) => money(getValue<number>()) }
]

const paymentColumns: ReportColumn<PaymentRow>[] = [
  { accessorKey: 'type', header: 'Type' },
  { accessorKey: 'bankName', header: 'Bank Name' },
  { accessorKey: 'accountName', header: 'Account Name' },
  { accessorKey: 'checkNo', header: 'Check No.' },
  { accessorKey: 'date', header: 'Date' },
  { accessorKey: 'amount', header: 'Amount', cell: ({ getValue }) => money(getValue<number>()) }
]

const activityColumns: ReportColumn<ActivityRow>[] = [
  { accessorKey: 'time', header: 'Time' },
  { accessorKey: 'cashier', header: 'Cashier' },
  { accessorKey: 'action', header: 'Action' },
  { accessorKey: 'details', header: 'Details' }
]

const expenseData: ExpenseRow[] = Array.from({ length: 105 }, (_, index) => ({
  id: `expense-${index + 1}`,
  type: index % 3 === 0 ? 'Operating' : index % 3 === 1 ? 'Supply' : 'Transport',
  description: ['Office supplies', 'Delivery fuel', 'Store utilities'][index % 3],
  category: ['Supplies', 'Transportation', 'Utilities'][index % 3],
  receiptNo: `EXP-${String(index + 1).padStart(4, '0')}`,
  vat: index % 2 === 0 ? 'VATable' : 'Non-VAT',
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
    type: 'Cash',
    bankName: '—',
    accountName: 'Ana Santos',
    checkNo: '—',
    date: '2026-07-14',
    amount: 2500
  },
  {
    id: 'payment-2',
    type: 'GCash',
    bankName: 'GCash',
    accountName: 'Luis Cruz',
    checkNo: '—',
    date: '2026-07-14',
    amount: 1800
  }
]

const activityData: ActivityRow[] = [
  {
    id: 'activity-1',
    time: '08:05 AM',
    cashier: 'C. Dela Cruz',
    action: 'Opened report',
    details: 'Started daily cashier report'
  },
  {
    id: 'activity-2',
    time: '10:42 AM',
    cashier: 'C. Dela Cruz',
    action: 'Added expense',
    details: 'Recorded EXP-1001'
  }
]

function ReportTab({
  tab,
  onAddEntry,
  addEntryLabel
}: {
  tab: (typeof reportTabs)[number]
  onAddEntry: () => void
  addEntryLabel: string
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
        <ReportDataTable
          columns={activityColumns}
          data={activityData}
          filterPlaceholder="Filter activity..."
          onAddEntry={onAddEntry}
          addEntryLabel={addEntryLabel}
        />
      )
  }
}

const formFields: Record<(typeof reportTabs)[number], string[]> = {
  Expenses: ['Type', 'Description', 'Category', 'Receipt No.', 'VAT', 'Amount'],
  Income: ['Particular', 'Remarks', 'Receipt/Ref No.', 'Date', 'Amount'],
  Payment: ['Type', 'Bank Name', 'Account Name', 'Check No.', 'Date', 'Amount'],
  Activity: ['Time', 'Cashier', 'Action', 'Details']
}

function ReportDetailsForm({ tab }: { tab: (typeof reportTabs)[number] }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3 p-4">
      {formFields[tab].map((field) => {
        const id = `${tab}-${field}`.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
        return (
          <div key={field} className="flex flex-col gap-1.5">
            <Label htmlFor={id}>{field}</Label>
            {/(amount|balance|principal)/i.test(field) ? (
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
          </div>
        )
      })}
    </div>
  )
}

export function CashierReportsContent(): React.JSX.Element {
  const [activeTab, setActiveTab] = React.useState<(typeof reportTabs)[number]>(reportTabs[0])
  const [isEntryFormVisible, setIsEntryFormVisible] = React.useState(false)

  React.useEffect(() => {
    if (!isEntryFormVisible) return
    const firstField = formFields[activeTab][0]
    const id = `${activeTab}-${firstField}`.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    document.getElementById(id)?.focus()
  }, [activeTab, isEntryFormVisible])

  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden p-3">
      <div
        className={
          isEntryFormVisible
            ? 'grid h-full min-h-0 grid-cols-[minmax(220px,262px)_minmax(720px,1fr)_minmax(280px,302px)] gap-3'
            : 'grid h-full min-h-0 grid-cols-[minmax(220px,262px)_minmax(720px,1fr)] gap-3'
        }
      >
      <Card className="flex min-h-0 min-w-0 flex-col">
        <aside className="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/20 p-3">
          <div className="shrink-0 border-b pb-3">
            <p className="text-xs text-muted-foreground">Daily Cashier Report</p>
            <h2 className="text-base font-semibold">Today&apos;s Summary</h2>
            <p className="mt-1 text-xs text-muted-foreground">July 14, 2026</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto py-4">
            <div className="rounded-lg border bg-card p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Cash variance</span>
                <span className="text-sm font-semibold">₱0.00</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground">Expected cash</p>
                  <p className="mt-1 font-medium">₱0.00</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Actual cash</p>
                  <p className="mt-1 font-medium">₱0.00</p>
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
              No saved report entries yet.
            </div>
          </div>
        </aside>
      </Card>
      <Card className="flex min-h-0 min-w-0 flex-col py-0 shadow-sm">
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as (typeof reportTabs)[number])}
            className="flex min-h-0 flex-1 flex-col gap-0"
          >
            <div className="shrink-0 overflow-x-auto border-b [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <TabsList
                aria-label="Cashier report sections"
                variant="line"
                className="h-10 w-max min-w-full justify-start rounded-none bg-transparent p-0"
              >
                {reportTabs.map((tab) => (
                  <TabsTrigger
                    key={tab}
                    value={tab}
                    className="h-10 flex-none rounded-none px-3 text-xs font-normal data-active:font-medium"
                  >
                    {tab}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {reportTabs.map((tab) => (
                <TabsContent key={tab} value={tab} className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <ReportTab
                    tab={tab}
                    onAddEntry={() => setIsEntryFormVisible((visible) => !visible)}
                    addEntryLabel={isEntryFormVisible ? 'Hide form' : `Add ${tab.toLowerCase()}`}
                  />
                </TabsContent>
              ))}
            </div>
          </Tabs>
        </CardContent>
      </Card>
      {isEntryFormVisible && <Card className="flex min-h-0 min-w-0 flex-col">
        <div className="flex h-full min-h-0 flex-col">
          <form
            className="flex h-full min-h-0 flex-col"
            onSubmit={(event) => event.preventDefault()}
          >
            <div className="shrink-0 border-b p-4">
              <p className="text-xs text-muted-foreground">New entry</p>
              <h2 className="text-base font-semibold">Add {activeTab}</h2>
            </div>
            <CardContent className="min-h-0 flex-1 overflow-y-auto p-0">
              <ReportDetailsForm tab={activeTab} />
            </CardContent>
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
          </form>
        </div>
      </Card>}
      </div>
    </div>
  )
}
