import * as React from 'react'

import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ReportDataTable, type ReportColumn, type ReportRow } from '@/components/report-data-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const reportTabs = [
  'Expenses',
  'Income',
  'Payment',
  'Payments',
  'Activity',
  'In-house',
  'Finance'
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
type InstallmentPaymentRow = ReportRow & {
  customer: string
  agreementNo: string
  dueDate: string
  amount: number
  status: string
}
type ActivityRow = ReportRow & { time: string; cashier: string; action: string; details: string }
type InHouseInstallmentRow = ReportRow & {
  customer: string
  contractNo: string
  term: string
  balance: number
  nextDue: string
}
type FinanceInstallmentRow = ReportRow & {
  lender: string
  customer: string
  accountNo: string
  principal: number
  balance: number
  status: string
}

const money = (value: number): string =>
  `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`

const expenseColumns: ReportColumn<ExpenseRow>[] = [
  { accessorKey: 'type', header: 'Type', filterable: true },
  { accessorKey: 'description', header: 'Description', filterable: true },
  { accessorKey: 'category', header: 'Category', filterable: true },
  { accessorKey: 'receiptNo', header: 'Receipt No.', filterable: true },
  { accessorKey: 'vat', header: 'VAT', filterable: true },
  {
    accessorKey: 'amount',
    header: 'Amount',
    cell: ({ getValue }) => money(getValue<number>()),
    meta: { className: 'text-right' }
  }
]

const incomeColumns: ReportColumn<IncomeRow>[] = [
  { accessorKey: 'particular', header: 'Particular', filterable: true },
  { accessorKey: 'remarks', header: 'Remarks', filterable: true },
  { accessorKey: 'receiptRefNo', header: 'Receipt/Ref No.', filterable: true },
  { accessorKey: 'date', header: 'Date', filterable: true },
  { accessorKey: 'amount', header: 'Amount', cell: ({ getValue }) => money(getValue<number>()) }
]

const paymentColumns: ReportColumn<PaymentRow>[] = [
  { accessorKey: 'type', header: 'Type', filterable: true },
  { accessorKey: 'bankName', header: 'Bank Name', filterable: true },
  { accessorKey: 'accountName', header: 'Account Name', filterable: true },
  { accessorKey: 'checkNo', header: 'Check No.', filterable: true },
  { accessorKey: 'date', header: 'Date', filterable: true },
  { accessorKey: 'amount', header: 'Amount', cell: ({ getValue }) => money(getValue<number>()) }
]

const installmentPaymentColumns: ReportColumn<InstallmentPaymentRow>[] = [
  { accessorKey: 'customer', header: 'Customer', filterable: true },
  { accessorKey: 'agreementNo', header: 'Agreement No.', filterable: true },
  { accessorKey: 'dueDate', header: 'Due Date', filterable: true },
  { accessorKey: 'amount', header: 'Amount', cell: ({ getValue }) => money(getValue<number>()) },
  { accessorKey: 'status', header: 'Status', filterable: true }
]

const activityColumns: ReportColumn<ActivityRow>[] = [
  { accessorKey: 'time', header: 'Time', filterable: true },
  { accessorKey: 'cashier', header: 'Cashier', filterable: true },
  { accessorKey: 'action', header: 'Action', filterable: true },
  { accessorKey: 'details', header: 'Details', filterable: true }
]

const inHouseInstallmentColumns: ReportColumn<InHouseInstallmentRow>[] = [
  { accessorKey: 'customer', header: 'Customer', filterable: true },
  { accessorKey: 'contractNo', header: 'Contract No.', filterable: true },
  { accessorKey: 'term', header: 'Term', filterable: true },
  { accessorKey: 'balance', header: 'Balance', cell: ({ getValue }) => money(getValue<number>()) },
  { accessorKey: 'nextDue', header: 'Next Due', filterable: true }
]

const financeInstallmentColumns: ReportColumn<FinanceInstallmentRow>[] = [
  { accessorKey: 'lender', header: 'Lender', filterable: true },
  { accessorKey: 'customer', header: 'Customer', filterable: true },
  { accessorKey: 'accountNo', header: 'Account No.', filterable: true },
  {
    accessorKey: 'principal',
    header: 'Principal',
    cell: ({ getValue }) => money(getValue<number>())
  },
  { accessorKey: 'balance', header: 'Balance', cell: ({ getValue }) => money(getValue<number>()) },
  { accessorKey: 'status', header: 'Status', filterable: true }
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

const installmentPaymentData: InstallmentPaymentRow[] = [
  {
    id: 'installment-payment-1',
    customer: 'Maria Reyes',
    agreementNo: 'AGR-2001',
    dueDate: '2026-07-14',
    amount: 4500,
    status: 'Paid'
  },
  {
    id: 'installment-payment-2',
    customer: 'Jose Lim',
    agreementNo: 'AGR-2002',
    dueDate: '2026-07-14',
    amount: 2800,
    status: 'Partial'
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

const inHouseInstallmentData: InHouseInstallmentRow[] = [
  {
    id: 'in-house-1',
    customer: 'Ramon Tan',
    contractNo: 'IH-3001',
    term: '12 months',
    balance: 18000,
    nextDue: '2026-08-14'
  },
  {
    id: 'in-house-2',
    customer: 'Ella Wong',
    contractNo: 'IH-3002',
    term: '6 months',
    balance: 6200,
    nextDue: '2026-07-28'
  }
]

const financeInstallmentData: FinanceInstallmentRow[] = [
  {
    id: 'finance-1',
    lender: 'Bank A',
    customer: 'Nina Garcia',
    accountNo: 'FIN-4001',
    principal: 50000,
    balance: 37500,
    status: 'Current'
  },
  {
    id: 'finance-2',
    lender: 'Bank B',
    customer: 'Paul Lim',
    accountNo: 'FIN-4002',
    principal: 30000,
    balance: 12000,
    status: 'Current'
  }
]

function ReportTab({
  tab,
  onAddEntry
}: {
  tab: (typeof reportTabs)[number]
  onAddEntry: () => void
}): React.JSX.Element {
  switch (tab) {
    case 'Expenses':
      return (
        <ReportDataTable
          title="Expenses"
          description="Track daily operating expenses and receipts."
          columns={expenseColumns}
          data={expenseData}
          filterPlaceholder="Filter expenses..."
          onAddEntry={onAddEntry}
          addEntryLabel="Add expense"
        />
      )
    case 'Income':
      return (
        <ReportDataTable
          title="Income"
          description="Review income entries recorded for the report date."
          columns={incomeColumns}
          data={incomeData}
          filterPlaceholder="Filter income..."
          onAddEntry={onAddEntry}
          addEntryLabel="Add income"
        />
      )
    case 'Payment':
      return (
        <ReportDataTable
          title="Payments"
          description="Review payment methods and collected amounts."
          columns={paymentColumns}
          data={paymentData}
          filterPlaceholder="Filter payments..."
          onAddEntry={onAddEntry}
          addEntryLabel="Add payment"
        />
      )
    case 'Payments':
      return (
        <ReportDataTable
          title="Installment payments"
          description="Track installment collections and payment status."
          columns={installmentPaymentColumns}
          data={installmentPaymentData}
          filterPlaceholder="Filter installment payments..."
          onAddEntry={onAddEntry}
          addEntryLabel="Add installment payment"
        />
      )
    case 'Activity':
      return (
        <ReportDataTable
          title="Activity"
          description="Review the activity log for this cashier report."
          columns={activityColumns}
          data={activityData}
          filterPlaceholder="Filter activity..."
          onAddEntry={onAddEntry}
          addEntryLabel="Add activity"
        />
      )
    case 'In-house':
      return (
        <ReportDataTable
          title="In-house installment"
          description="Track customer balances and upcoming due dates."
          columns={inHouseInstallmentColumns}
          data={inHouseInstallmentData}
          filterPlaceholder="Filter in-house installments..."
          onAddEntry={onAddEntry}
          addEntryLabel="Add in-house installment"
        />
      )
    case 'Finance':
      return (
        <ReportDataTable
          title="Finance installment"
          description="Review lender accounts, principals, and balances."
          columns={financeInstallmentColumns}
          data={financeInstallmentData}
          filterPlaceholder="Filter finance installments..."
          onAddEntry={onAddEntry}
          addEntryLabel="Add finance installment"
        />
      )
  }
}

const formFields: Record<(typeof reportTabs)[number], string[]> = {
  Expenses: ['Type', 'Description', 'Category', 'Receipt No.', 'VAT', 'Amount'],
  Income: ['Particular', 'Remarks', 'Receipt/Ref No.', 'Date', 'Amount'],
  Payment: ['Type', 'Bank Name', 'Account Name', 'Check No.', 'Date', 'Amount'],
  Payments: ['Customer', 'Agreement No.', 'Due Date', 'Amount', 'Status'],
  Activity: ['Time', 'Cashier', 'Action', 'Details'],
  'In-house': ['Customer', 'Contract No.', 'Term', 'Balance', 'Next Due'],
  Finance: ['Lender', 'Customer', 'Account No.', 'Principal', 'Balance', 'Status']
}

function ReportDetailsForm({ tab }: { tab: (typeof reportTabs)[number] }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3 p-4">
      {formFields[tab].map((field) => {
        const id = `${tab}-${field}`.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
        return (
          <div key={field} className="flex flex-col gap-1.5">
            <Label htmlFor={id}>{field}</Label>
            <Input id={id} name={id} placeholder={`Enter ${field.toLowerCase()}`} />
          </div>
        )
      })}
    </div>
  )
}

export function CashierReportsContent(): React.JSX.Element {
  const [activeTab, setActiveTab] = React.useState<(typeof reportTabs)[number]>(reportTabs[0])
  const focusEntryField = (): void => {
    const firstField = formFields[activeTab][0]
    const id = `${activeTab}-${firstField}`.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    document.getElementById(id)?.focus()
  }

  return (
    <div className="m-4 grid min-h-0 min-w-0 flex-1 grid-cols-[280px_minmax(560px,1fr)_320px] gap-3 overflow-hidden">
      <Card className="flex min-h-0 min-w-0 flex-col overflow-hidden">
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
      <Card className="flex min-h-0 min-w-0 flex-col overflow-hidden shadow-sm">
        <CardContent className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as (typeof reportTabs)[number])}
            className="flex min-h-full flex-col gap-2"
          >
            <TabsList
              aria-label="Cashier report sections"
              className="w-full rounded-lg border bg-muted/50 p-1 text-muted-foreground"
            >
              {reportTabs.map((tab) => (
                <TabsTrigger key={tab} value={tab} className="h-8 rounded-md border-0 px-3 text-xs">
                  {tab}
                </TabsTrigger>
              ))}
            </TabsList>
            {reportTabs.map((tab) => (
              <TabsContent key={tab} value={tab} className="flex flex-col pt-4">
                <ReportTab tab={tab} onAddEntry={focusEntryField} />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
      <Card className="flex min-h-0 min-w-0 flex-col overflow-hidden">
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
      </Card>
    </div>
  )
}
