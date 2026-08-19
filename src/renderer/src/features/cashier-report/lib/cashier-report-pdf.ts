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
  generatedAt: string
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

function summaryRow(
  label: string,
  value: number | null | undefined,
  options: { emphasis?: boolean; quantity?: number; alwaysShow?: boolean } = {}
): string {
  if ((value === null || value === undefined || value === 0) && !options.alwaysShow) return ''
  return `<div class="summary-row${options.emphasis ? ' emphasis' : ''}"><span>${escapeHtml(label)}</span>${options.quantity === undefined ? '' : `<span class="summary-qty">Qty ${options.quantity}</span>`}<strong>${escapeHtml(money(value ?? 0))}</strong></div>`
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
  const totalReceiptsCentavos =
    receiptTotal -
    snapshot.financeBalanceCentavos +
    snapshot.cashCollectionsCentavos +
    snapshot.otherIncomeCentavos +
    snapshot.financeDownCentavos
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
  const expenseRows = [...new Set(data.expenses.map((item) => item.type))].map((type) => [
    type,
    data.expenses
      .filter((item) => item.type === type)
      .reduce((total, item) => total + item.amountCentavos, 0)
  ]) as Array<[string, number]>
  const cashOutCentavos =
    snapshot.legacyExpenseCashOutCentavos +
    snapshot.cashOutEntries
      .filter((item) => item.status === 'POSTED')
      .reduce((total, item) => total + item.amountCentavos, 0)
  const paymentTotals = snapshot.paymentEntries
    .filter((item) => item.status === 'POSTED')
    .reduce(
      (totals, item) => {
        if (item.paymentMethodId === 'report-payment-method-check')
          totals.bankCheck += item.amountCentavos
        else if (item.paymentMethodId === 'report-payment-method-bank-transfer')
          totals.bankTransfer += item.amountCentavos
        else if (item.paymentMethodId === 'report-payment-method-gcash')
          totals.gcash += item.amountCentavos
        else totals.otherEwallet += item.amountCentavos
        totals.total += item.amountCentavos
        return totals
      },
      { bankCheck: 0, bankTransfer: 0, gcash: 0, otherEwallet: 0, total: 0 }
    )
  const expectedCashCentavos = totalReceiptsCentavos - cashOutCentavos - paymentTotals.total
  const cashVarianceCentavos = snapshot.physicalCashCentavos - expectedCashCentavos
  const cashSummaryRows: Array<{
    label: string
    value: number | null | undefined
    quantity?: number
    emphasis?: boolean
    alwaysShow?: boolean
  }> = [
    ...snapshot.receiptTotals.map((item) => ({
      label: item.receiptName,
      value: item.amountCentavos,
      quantity: item.quantity
    })),
    { label: 'Collections', value: snapshot.cashCollectionsCentavos },
    { label: 'Other', value: snapshot.otherIncomeCentavos },
    { label: 'Finance Down', value: snapshot.financeDownCentavos },
    { label: 'Finance Bal', value: snapshot.financeBalanceCentavos },
    { label: 'Total Receipts', value: totalReceiptsCentavos, emphasis: true },
    ...expenseRows.map(([label, value]) => ({ label, value })),
    { label: 'Deductions', value: deductionTotal },
    { label: 'Total Cash Out', value: cashOutCentavos, emphasis: true },
    { label: 'Bank Check', value: paymentTotals.bankCheck },
    { label: 'Bank Transfer', value: paymentTotals.bankTransfer },
    { label: 'Gcash', value: paymentTotals.gcash },
    { label: 'E-wallet', value: paymentTotals.otherEwallet },
    { label: 'Total Payments', value: paymentTotals.total, emphasis: true },
    { label: 'Expected Cash', value: expectedCashCentavos },
    { label: 'Cash Denominations', value: snapshot.physicalCashCentavos },
    { label: 'Cash Remitted', value: snapshot.report.cashRemittedCentavos },
    { label: 'Cash Variance', value: cashVarianceCentavos, emphasis: true, alwaysShow: true }
  ]

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 10mm 9mm 14mm; }
    * { box-sizing: border-box; } body { color:#111; font:9px Arial,sans-serif; line-height:1.2; }
    h1 { font-size:16px; margin:0 0 3px; } h2 { border-bottom:1px solid #111; font-size:11px; margin:11px 0 3px; padding-bottom:2px; }
    .company { font-size:10px; font-weight:700; letter-spacing:.04em; margin-bottom:2px; text-transform:uppercase; }
    .meta { display:grid; grid-template-columns:repeat(4,1fr); gap:6px; margin-bottom:7px; } .meta span { color:#555; display:block; font-size:7px; text-transform:uppercase; } .meta strong { font-size:9px; }
    table { border-collapse:collapse; width:100%; } th,td { border-bottom:1px solid #ddd; padding:2px 3px; text-align:left; vertical-align:top; } th { font-size:7px; text-transform:uppercase; } thead { display:table-header-group; } tr { break-inside:avoid; } tfoot th,tfoot td { border-top:1px solid #111; font-weight:700; } .amount { text-align:right; white-space:nowrap; }
    .two-column { display:grid; gap:10px; grid-template-columns:1fr 1fr; } .cash-overview { break-inside:avoid; display:grid; grid-template-columns:42% 30%; justify-content:space-between; margin:8px 0 12px; } .cash-side { display:flex; flex-direction:column; gap:10px; } .cash-overview > div { min-width:0; } .cash-overview h2 { margin-top:0; } .summary-row { border-bottom:1px solid #ddd; display:flex; justify-content:space-between; gap:8px; padding:2px 0; } .summary-row > span:first-child { flex:1; } .summary-row strong { font-weight:400; text-align:right; white-space:nowrap; } .summary-qty { color:#555; font-size:8px; white-space:nowrap; } .summary-row.emphasis, .summary-row.emphasis strong { font-weight:700; } .section { break-inside:avoid; } .signatures { break-inside:avoid; display:grid; gap:26px; grid-template-columns:1fr 1fr; margin-top:24px; } .signature-line { border-bottom:1px solid #111; height:22px; margin:14px 0 3px; } .signature-label { color:#555; display:block; font-size:7px; text-transform:uppercase; } .signature-name { font-size:9px; } .muted { color:#555; }
  </style></head><body>
    <header><div class="company">Nueva Camsur Home Furnishing</div><h1>Branch Cashier Report</h1><div class="meta"><div><span>Contributors</span><strong>${escapeHtml(data.cashierName)}</strong></div><div><span>Branch</span><strong>${escapeHtml(data.branch)}</strong></div><div><span>Business date</span><strong>${escapeHtml(data.businessDate)}</strong></div><div><span>Generated</span><strong>${escapeHtml(data.generatedAt)}</strong></div></div></header>
    <section class="cash-overview"><div><h2>Cashier Summary</h2>${cashSummaryRows.map((item) => summaryRow(item.label, item.value, item)).join('')}</div><div class="cash-side"><div><h2>Cash Denominations</h2>${denominations.length ? `<table><thead><tr><th>Denomination</th><th class="amount">Qty</th><th class="amount">Total</th></tr></thead><tbody>${denominations.map((item) => `<tr><td>${escapeHtml(money(item.valueCentavos))}</td><td class="amount">${item.quantity}</td>${amount(item.valueCentavos * item.quantity)}</tr>`).join('')}</tbody></table>` : ''}</div><div><h2>Deductions</h2>${deductions.map((item) => summaryRow(item.label, item.amountCentavos)).join('')}${summaryRow('Total deductions', deductionTotal)}</div></div></section>
    ${table(
      'Expenses',
      ['Type', 'Description', 'Category', 'Receipt no.', 'VAT', 'Added by', 'Amount'],
      data.expenses.map(
        (item) =>
          `<tr><td>${escapeHtml(item.type)}</td><td>${escapeHtml(item.description)}</td><td>${escapeHtml(item.category)}</td><td>${escapeHtml(item.receiptNo)}</td><td>${escapeHtml(item.vat)}</td><td>${escapeHtml(item.createdByName)}</td>${amount(item.amountCentavos)}</tr>`
      ),
      expenseTotal
    )}
    ${table(
      'Income',
      ['Date', 'Particular', 'Receipt / ref.', 'Remarks', 'Added by', 'Amount'],
      data.incomes.map(
        (item) =>
          `<tr><td>${escapeHtml(item.transactionDate)}</td><td>${escapeHtml(item.particular)}</td><td>${escapeHtml(item.receiptNumber)}</td><td>${escapeHtml(item.remarks)}</td><td>${escapeHtml(item.createdByName)}</td>${amount(item.amountCentavos)}</tr>`
      ),
      incomeTotal
    )}
    ${table(
      'Payments',
      ['Date', 'Method', 'Bank / provider', 'Account name', 'Reference no.', 'Added by', 'Amount'],
      data.payments.map(
        (item) =>
          `<tr><td>${escapeHtml(item.transactionDate)}</td><td>${escapeHtml(item.paymentMethodName)}</td><td>${escapeHtml(item.bankName)}</td><td>${escapeHtml(item.payerName)}</td><td>${escapeHtml(item.referenceNumber)}</td><td>${escapeHtml(item.createdByName)}</td>${amount(item.amountCentavos)}</tr>`
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
    ${accountRows.length ? `<section><h2>Accounts</h2><div class="two-column">${accountRows.map(([label, count]) => `<div class="summary-row"><span>${escapeHtml(label)}</span><strong>${count}</strong></div>`).join('')}</div></section>` : ''}
    <section class="signatures"><div><span class="signature-label">Prepared by</span><div class="signature-line"></div><strong class="signature-name">${escapeHtml(data.cashierName)}</strong></div><div><span class="signature-label">Verified by</span><div class="signature-line"></div></div></section>
  </body></html>`
}
