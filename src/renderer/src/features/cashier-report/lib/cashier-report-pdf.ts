import type {
  DailyReportPaymentEntryRecord,
  DailyReportSnapshotResponse,
  ExpenseRecord,
  IncomeEntryRecord,
  InstallmentHistoryRecord
} from '@/../../shared/contracts'
import { formatCentavos } from '@/lib/currency'

type AccountCounts = {
  records: number
  active: number
  closed: number
  blacklisted: number
}

export type CashierReportPdfData = {
  cashierName: string
  branch: string
  businessDate: string
  snapshot: DailyReportSnapshotResponse
  expenses: ExpenseRecord[]
  incomes: IncomeEntryRecord[]
  payments: DailyReportPaymentEntryRecord[]
  installmentHistory: InstallmentHistoryRecord[]
  accountCounts: AccountCounts
}

const money = formatCentavos

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function amount(value: number): string {
  return `<td class="amount">${escapeHtml(money(value))}</td>`
}

function table(title: string, headings: string[], rows: string[], totalCentavos?: number): string {
  if (!rows.length) return ''
  return `<section class="section"><h2>${escapeHtml(title)}</h2><table><thead><tr>${headings.map((heading) => `<th>${escapeHtml(heading)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody>${totalCentavos === undefined ? '' : `<tfoot><tr><th colspan="${headings.length - 1}">Total</th>${amount(totalCentavos)}</tr></tfoot>`}</table></section>`
}

function summaryRow(label: string, value: number | null | undefined): string {
  return `<div class="summary-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(money(value ?? 0))}</strong></div>`
}

export function cashierReportPdfHtml(data: CashierReportPdfData): string {
  const { snapshot } = data
  const deductions = snapshot.deductions
    .map((item) => ({
      label:
        snapshot.deductionTypes.find((type) => type.id === item.deductionTypeId)?.name ??
        'Deduction',
      amountCentavos: item.amountCentavos
    }))
    .filter((item) => item.amountCentavos > 0)
  const denominations = snapshot.cashCounts
    .map((item) => ({
      valueCentavos:
        snapshot.cashDenominations.find((denomination) => denomination.id === item.denominationId)
          ?.valueCentavos ?? 0,
      quantity: item.quantity
    }))
    .filter((item) => item.quantity > 0 && item.valueCentavos > 0)
  const history = data.installmentHistory.filter((item) => item.action !== 'deleted')
  const receiptTotal = snapshot.receiptTotals.reduce(
    (total, item) => total + item.amountCentavos,
    0
  )
  const deductionTotal = deductions.reduce((total, item) => total + item.amountCentavos, 0)
  const expenseTotal = data.expenses.reduce((total, item) => total + item.amountCentavos, 0)
  const incomeTotal = data.incomes.reduce((total, item) => total + item.amountCentavos, 0)
  const paymentTotal = data.payments.reduce((total, item) => total + item.amountCentavos, 0)
  const historyTotal = history.reduce((total, item) => total + (item.amountCentavos ?? 0), 0)
  const accountRows = (
    [
      ['Total accounts', data.accountCounts.records],
      ['Active', data.accountCounts.active],
      ['Closed', data.accountCounts.closed],
      ['Blacklisted', data.accountCounts.blacklisted]
    ] as Array<[string, number]>
  ).filter(([, count]) => count > 0)

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 10mm 9mm 14mm; }
    * { box-sizing: border-box; } body { color:#111; font:9px Arial,sans-serif; line-height:1.2; }
    h1 { font-size:16px; margin:0 0 3px; } h2 { border-bottom:1px solid #111; font-size:11px; margin:11px 0 3px; padding-bottom:2px; }
    .meta { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; margin-bottom:7px; } .meta span { color:#555; display:block; font-size:7px; text-transform:uppercase; } .meta strong { font-size:9px; }
    table { border-collapse:collapse; width:100%; } th,td { border-bottom:1px solid #ddd; padding:2px 3px; text-align:left; vertical-align:top; } th { font-size:7px; text-transform:uppercase; } thead { display:table-header-group; } tr { break-inside:avoid; } tfoot th,tfoot td { border-top:1px solid #111; font-weight:700; } .amount { text-align:right; white-space:nowrap; }
    .two-column { display:grid; gap:10px; grid-template-columns:1fr 1fr; } .summary-row { border-bottom:1px solid #ddd; display:flex; justify-content:space-between; gap:8px; padding:2px 0; } .summary-row strong { text-align:right; white-space:nowrap; } .section { break-inside:avoid; } .muted { color:#555; }
  </style></head><body>
    <header><h1>Cashier Report</h1><div class="meta"><div><span>Cashier</span><strong>${escapeHtml(data.cashierName)}</strong></div><div><span>Branch</span><strong>${escapeHtml(data.branch)}</strong></div><div><span>Business date</span><strong>${escapeHtml(data.businessDate)}</strong></div></div></header>
    ${table(
      'Expenses',
      ['Type', 'Description', 'Category', 'Receipt no.', 'VAT', 'Amount'],
      data.expenses.map(
        (item) =>
          `<tr><td>${escapeHtml(item.type)}</td><td>${escapeHtml(item.description)}</td><td>${escapeHtml(item.category)}</td><td>${escapeHtml(item.receiptNo)}</td><td>${escapeHtml(item.vat)}</td>${amount(item.amountCentavos)}</tr>`
      ),
      expenseTotal
    )}
    ${table(
      'Income',
      ['Date', 'Particular', 'Receipt / ref.', 'Remarks', 'Amount'],
      data.incomes.map(
        (item) =>
          `<tr><td>${escapeHtml(item.transactionDate)}</td><td>${escapeHtml(item.particular)}</td><td>${escapeHtml(item.receiptNumber)}</td><td>${escapeHtml(item.remarks)}</td>${amount(item.amountCentavos)}</tr>`
      ),
      incomeTotal
    )}
    ${table(
      'Payments',
      ['Date', 'Method', 'Bank / provider', 'Account name', 'Reference no.', 'Amount'],
      data.payments.map(
        (item) =>
          `<tr><td>${escapeHtml(item.transactionDate)}</td><td>${escapeHtml(item.paymentMethodName)}</td><td>${escapeHtml(item.bankName)}</td><td>${escapeHtml(item.payerName)}</td><td>${escapeHtml(item.referenceNumber)}</td>${amount(item.amountCentavos)}</tr>`
      ),
      paymentTotal
    )}
    ${table(
      'Installment History',
      ['Date', 'Action', 'Activity', 'Account', 'Reference', 'Amount'],
      history.map(
        (item) =>
          `<tr><td>${escapeHtml(item.occurredAt.slice(0, 10))}</td><td>${escapeHtml(item.action)}</td><td>${escapeHtml(item.activity)}</td><td>${escapeHtml(item.accountName)}</td><td>${escapeHtml(item.referenceNumber ?? item.accountNumber)}</td>${amount(item.amountCentavos ?? 0)}</tr>`
      ),
      historyTotal
    )}
    <section class="two-column"><div><h2>Cashier Summary</h2>${summaryRow('Opening cash', snapshot.report.openingCashCentavos)}${summaryRow('Total receipts', receiptTotal)}${summaryRow('Expenses', expenseTotal)}${summaryRow('Expected cash', snapshot.expectedCashCentavos)}${summaryRow('Physical cash', snapshot.physicalCashCentavos)}${summaryRow('Cash remitted', snapshot.report.cashRemittedCentavos)}${summaryRow('Variance', snapshot.cashVarianceCentavos)}</div><div>${deductions.length || denominations.length ? `<h2>Deductions and Cash Denominations</h2>${deductions.map((item) => summaryRow(item.label, item.amountCentavos)).join('')}${deductions.length ? summaryRow('Total deductions', deductionTotal) : ''}${denominations.length ? `<table><thead><tr><th>Denomination</th><th class="amount">Qty</th><th class="amount">Total</th></tr></thead><tbody>${denominations.map((item) => `<tr><td>${escapeHtml(money(item.valueCentavos))}</td><td class="amount">${item.quantity}</td>${amount(item.valueCentavos * item.quantity)}</tr>`).join('')}</tbody></table>` : ''}` : ''}</div></section>
    ${accountRows.length ? `<section><h2>Accounts</h2><div class="two-column">${accountRows.map(([label, count]) => `<div class="summary-row"><span>${escapeHtml(label)}</span><strong>${count}</strong></div>`).join('')}</div></section>` : ''}
  </body></html>`
}
