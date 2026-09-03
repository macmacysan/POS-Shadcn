import type {
  DailyReportPaymentEntryRecord,
  DailyReportSnapshotResponse,
  ExpenseRecord,
  PdfReportCharts,
  IncomeEntryRecord,
  InstallmentHistoryRecord,
  FinanceAccountRecord,
  InstallmentAccountRecord
} from '@/../../shared/contracts'
import { formatCentavos } from '@/lib/currency'
import { historyActionLabel } from '@/lib/installment-history'

type AccountCounts = {
  records: number
  active: number
  closed: number
  blacklisted: number
}

export type CashierReportSection =
  | 'Expenses'
  | 'Income'
  | 'Payment'
  | 'Activity History'
  | 'Records'
  | 'Active'
  | 'Closed'
  | 'Blacklisted'
  | 'Accounts'

export type CashierReportPdfData = {
  cashierName: string
  branch: string
  businessDate: string
  generatedAt: string
  note?: string
  snapshot: DailyReportSnapshotResponse
  expenses: ExpenseRecord[]
  incomes: IncomeEntryRecord[]
  payments: DailyReportPaymentEntryRecord[]
  installmentHistory: InstallmentHistoryRecord[]
  accountCounts: AccountCounts
  charts: PdfReportCharts
  sections?: readonly CashierReportSection[]
  financeAccounts?: FinanceAccountRecord[]
  accountLists?: {
    records: InstallmentAccountRecord[]
    active: InstallmentAccountRecord[]
    closed: InstallmentAccountRecord[]
    blacklisted: InstallmentAccountRecord[]
  }
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

type ChartPoint = { label: string; salesCentavos: number; expenseCentavos?: number }

function chartLabel(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value.slice(5, 7)}/${value.slice(8)}`
  if (/^\d{4}-\d{2}$/.test(value)) return value.slice(5)
  return value
}

function barChart(
  title: string,
  points: ChartPoint[],
  series: Array<{ key: 'salesCentavos' | 'expenseCentavos'; label: string; color: string }>
): string {
  const max = Math.max(1, ...points.flatMap((point) => series.map(({ key }) => point[key] ?? 0)))
  const width = 680
  const height = 176
  const plotHeight = 116
  const left = 34
  const slot = (width - left) / points.length
  const barWidth = Math.max(3, (slot - 7) / series.length)
  const bars = points
    .map(
      (point, index) =>
        series
          .map((item, seriesIndex) => {
            const value = point[item.key] ?? 0
            const barHeight = Math.round((value / max) * plotHeight)
            const x = left + index * slot + 4 + seriesIndex * barWidth
            const y = plotHeight + 16 - barHeight
            return `<rect x="${x}" y="${y}" width="${Math.max(1, barWidth - 2)}" height="${barHeight}" fill="${item.color}"><title>${escapeHtml(`${item.label}: ${money(value)}`)}</title></rect>`
          })
          .join('') +
        `<text x="${left + index * slot + slot / 2}" y="${height - 4}" text-anchor="middle">${escapeHtml(chartLabel(point.label))}</text>`
    )
    .join('')
  return `<section class="chart"><h2>${escapeHtml(title)}</h2><div class="chart-legend">${series.map((item) => `<span><i style="background:${item.color}"></i>${escapeHtml(item.label)}</span>`).join('')}</div><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(title)}"><line x1="${left}" y1="${plotHeight + 16}" x2="${width}" y2="${plotHeight + 16}" stroke="#777"/><text x="0" y="24">${escapeHtml(money(max))}</text><text x="17" y="${plotHeight + 19}">0</text>${bars}</svg></section>`
}

export function cashierReportPdfHtml(data: CashierReportPdfData): string {
  const { snapshot } = data
  const sections = new Set<CashierReportSection>(data.sections ?? [
    'Expenses', 'Income', 'Payment', 'Activity History', 'Accounts'
  ])
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
    receiptTotal +
    snapshot.cashCollectionsCentavos +
    snapshot.otherIncomeCentavos +
    snapshot.financeDownCentavos
  const deductionTotal = deductions.reduce((total, item) => total + item.amountCentavos, 0)
  const expenseTotal = data.expenses.reduce((total, item) => total + item.amountCentavos, 0)
  const incomeTotal = data.incomes.reduce((total, item) => total + item.amountCentavos, 0)
  const paymentTotal = data.payments.reduce((total, item) => total + item.amountCentavos, 0)
  const expenseRows = [...new Set(data.expenses.map((item) => item.type))].map((type) => [
    type,
    data.expenses
      .filter((item) => item.type === type)
      .reduce((total, item) => total + item.amountCentavos, 0)
  ]) as Array<[string, number]>
  const cashOutCentavos = expenseTotal + deductionTotal
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
    { label: 'Total Cash Receipts', value: totalReceiptsCentavos, emphasis: true },
    ...expenseRows.map(([label, value]) => ({ label, value })),
    { label: 'Deductions', value: deductionTotal },
    { label: 'Total Cash Outs', value: cashOutCentavos, emphasis: true },
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
    .two-column { display:grid; gap:10px; grid-template-columns:1fr 1fr; } .cash-overview { break-inside:avoid; display:grid; grid-template-columns:42% 30%; justify-content:space-between; margin:8px 0 12px; } .cash-side { display:flex; flex-direction:column; gap:10px; } .cash-overview > div { min-width:0; } .cash-overview h2 { margin-top:0; } .summary-row { border-bottom:1px solid #ddd; display:flex; justify-content:space-between; gap:8px; padding:2px 0; } .summary-row > span:first-child { flex:1; } .summary-row strong { font-weight:400; text-align:right; white-space:nowrap; } .summary-qty { color:#555; font-size:8px; white-space:nowrap; } .summary-row.emphasis, .summary-row.emphasis strong { font-weight:700; } .section { break-inside:avoid; } .signatures { break-inside:avoid; display:grid; gap:26px; grid-template-columns:1fr 1fr; margin-top:24px; } .signature-line { border-bottom:1px solid #111; height:22px; margin:14px 0 3px; } .signature-label { color:#555; display:block; font-size:7px; text-transform:uppercase; } .signature-name { font-size:9px; } .note { break-inside:avoid; margin-top:16px; } .note p { margin:0; white-space:pre-wrap; } .muted { color:#555; } .charts { break-before:page; } .chart-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; } .chart { break-inside:avoid; } .chart h2 { margin:0 0 3px; } .chart svg { display:block; height:auto; width:100%; } .chart svg text { fill:#555; font-size:7px; } .chart-legend { display:flex; gap:8px; margin:0 0 2px; } .chart-legend span { align-items:center; display:flex; gap:3px; } .chart-legend i { display:inline-block; height:6px; width:6px; }
  </style></head><body>
    <header><div class="company">Nueva Camsur Home Furnishing</div><h1>Branch Cashier Report</h1><div class="meta"><div><span>Contributors</span><strong>${escapeHtml(data.cashierName)}</strong></div><div><span>Branch</span><strong>${escapeHtml(data.branch)}</strong></div><div><span>Business date</span><strong>${escapeHtml(data.businessDate)}</strong></div><div><span>Generated</span><strong>${escapeHtml(data.generatedAt)}</strong></div></div></header>
    ${data.sections ? '' : `<section class="cash-overview"><div><h2>Cashier Summary</h2>${cashSummaryRows.map((item) => summaryRow(item.label, item.value, item)).join('')}</div><div class="cash-side"><div><h2>Cash Denominations</h2>${denominations.length ? `<table><thead><tr><th>Denomination</th><th class="amount">Qty</th><th class="amount">Total</th></tr></thead><tbody>${denominations.map((item) => `<tr><td>${escapeHtml(money(item.valueCentavos))}</td><td class="amount">${item.quantity}</td>${amount(item.valueCentavos * item.quantity)}</tr>`).join('')}</tbody></table>` : ''}</div><div><h2>Deductions</h2>${deductions.map((item) => summaryRow(item.label, item.amountCentavos)).join('')}${summaryRow('Total deductions', deductionTotal)}</div></div></section>`}
    ${sections.has('Expenses') ? table(
      'Expenses',
      ['Date', 'Type', 'Description', 'Category', 'Receipt no.', 'VAT', 'Added by', 'Amount'],
      data.expenses.map(
        (item) =>
          `<tr><td>${escapeHtml(item.businessDate)}</td><td>${escapeHtml(item.type)}</td><td>${escapeHtml(item.description)}</td><td>${escapeHtml(item.category)}</td><td>${escapeHtml(item.receiptNo)}</td><td>${escapeHtml(item.vat)}</td><td>${escapeHtml(item.createdByName)}</td>${amount(item.amountCentavos)}</tr>`
      ),
      expenseTotal
    ) : ''}
    ${sections.has('Income') ? table(
      'Income',
      ['Date', 'Particular', 'Receipt / ref.', 'Remarks', 'Added by', 'Amount'],
      data.incomes.map(
        (item) =>
          `<tr><td>${escapeHtml(item.transactionDate)}</td><td>${escapeHtml(item.particular)}</td><td>${escapeHtml(item.receiptNumber)}</td><td>${escapeHtml(item.remarks)}</td><td>${escapeHtml(item.createdByName)}</td>${amount(item.amountCentavos)}</tr>`
      ),
      incomeTotal
    ) : ''}
    ${sections.has('Payment') ? table(
      'Payments',
      ['Date', 'Method', 'Bank / provider', 'Account name', 'Reference no.', 'Added by', 'Amount'],
      data.payments.map(
        (item) =>
          `<tr><td>${escapeHtml(item.transactionDate)}</td><td>${escapeHtml(item.paymentMethodName)}</td><td>${escapeHtml(item.bankName)}</td><td>${escapeHtml(item.payerName)}</td><td>${escapeHtml(item.referenceNumber)}</td><td>${escapeHtml(item.createdByName)}</td>${amount(item.amountCentavos)}</tr>`
      ),
      paymentTotal
    ) : ''}
    ${sections.has('Activity History') ? table(
      'Activity History',
      ['Date', 'Action', 'Activity', 'Account', 'Reference', 'Amount'],
      history.map(
        (item) =>
          `<tr><td>${escapeHtml(item.occurredAt.slice(0, 10))}</td><td>${escapeHtml(historyActionLabel(item))}</td><td>${escapeHtml(item.activity)}</td><td>${escapeHtml(item.accountName)}</td><td>${escapeHtml(item.referenceNumber ?? item.accountNumber)}</td>${amount(item.amountCentavos ?? 0)}</tr>`
      )
    ) : ''}
    ${(['Records', 'Active', 'Closed', 'Blacklisted'] as const).map((section) => sections.has(section) && data.accountLists ? table(section, ['Date Released', 'Branch', 'Account', 'Status', 'Contract', 'Balance'], data.accountLists[section.toLowerCase() as Lowercase<typeof section>].map((item) => `<tr><td>${escapeHtml(item.loan.dateReleased)}</td><td>${escapeHtml(item.account.branch)}</td><td>${escapeHtml(`${item.account.firstName} ${item.account.lastName}`)}</td><td>${escapeHtml(item.meta.status)}</td><td>${escapeHtml(item.contractStatus)}</td>${amount(item.meta.outstandingBalance ?? item.loan.grandTotal)}</tr>`)) : '').join('')}
    ${sections.has('Accounts') && data.financeAccounts?.length ? table('Finance Accounts', ['Date Released', 'Branch', 'Type', 'Account', 'Balance'], data.financeAccounts.map((item) => `<tr><td>${escapeHtml(item.dateReleased)}</td><td>${escapeHtml(item.branch)}</td><td>${escapeHtml(item.provider)}</td><td>${escapeHtml(`${item.firstName} ${item.lastName}`)}</td>${amount(item.balanceCentavos)}</tr>`)) : ''}
    <section class="signatures"><div><span class="signature-label">Prepared by</span><div class="signature-line"></div><strong class="signature-name">${escapeHtml(data.cashierName)}</strong></div><div><span class="signature-label">Verified by</span><div class="signature-line"></div></div></section>
    ${data.note?.trim() ? `<section class="note"><h2>Note</h2><p>${escapeHtml(data.note.trim())}</p></section>` : ''}
    <section class="charts"><h1>Sales & Expense Charts</h1><div class="chart-grid">${barChart('Weekly Sales', data.charts.weeklySales.map((item) => ({ label: item.businessDate, salesCentavos: item.salesCentavos })), [{ key: 'salesCentavos', label: 'Sales', color: '#0369a1' }])}${barChart('Monthly Sales', data.charts.monthlySales.map((item) => ({ label: item.month, salesCentavos: item.salesCentavos })), [{ key: 'salesCentavos', label: 'Sales', color: '#0369a1' }])}${barChart('Yearly Sales', data.charts.yearlySales.map((item) => ({ label: item.year, salesCentavos: item.salesCentavos })), [{ key: 'salesCentavos', label: 'Sales', color: '#0369a1' }])}${barChart('Expenses vs Sales', data.charts.expensesVsSales.map((item) => ({ label: item.month, salesCentavos: item.salesCentavos, expenseCentavos: item.expenseCentavos })), [{ key: 'salesCentavos', label: 'Sales', color: '#0369a1' }, { key: 'expenseCentavos', label: 'Expenses', color: '#dc2626' }])}</div></section>
  </body></html>`
}
