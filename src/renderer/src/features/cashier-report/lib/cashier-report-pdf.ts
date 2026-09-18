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
import { historyActionLabel, isVisibleInstallmentHistoryRecord } from '@/lib/installment-history'

type AccountCounts = {
  records: number
  active: number
  closed: number
  blacklisted: number
}

export type CashierReportSection =
  | 'Cash Summary'
  | 'Total Cash Receipts'
  | 'Expenses'
  | 'Income'
  | 'Payment'
  | 'Activity History'
  | 'Records'
  | 'Active'
  | 'Closed'
  | 'Blacklisted'
  | 'Finance Accounts'

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
  includeCharts?: boolean
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

function table(
  title: string,
  headings: string[],
  rows: string[],
  totalCentavos?: number,
  totalLabel = 'Total'
): string {
  if (!rows.length) return ''
  return `<section class="section"><h2>${escapeHtml(title)}</h2><table><thead><tr>${headings.map((heading) => `<th>${escapeHtml(heading)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody>${totalCentavos === undefined ? '' : `<tfoot><tr><th colspan="${headings.length - 1}">${escapeHtml(totalLabel)}</th>${amount(totalCentavos)}</tr></tfoot>`}</table></section>`
}

function summaryRow(
  label: string,
  value: number | null | undefined,
  options: { emphasis?: boolean; quantity?: number; alwaysShow?: boolean } = {}
): string {
  if ((value === null || value === undefined || value === 0) && !options.alwaysShow) return ''
  return `<div class="summary-row${options.emphasis ? ' emphasis' : ''}"><span>${escapeHtml(label)}</span>${options.quantity === undefined ? '' : `<span class="summary-qty">Qty ${options.quantity}</span>`}<strong>${escapeHtml(money(value ?? 0))}</strong></div>`
}

type ChartValueKey = 'cashReceiptsCentavos' | 'expenseCentavos'
type ChartPoint = {
  label: string
  cashReceiptsCentavos?: number
  expenseCentavos?: number
}

function chartLabel(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value.slice(5, 7)}/${value.slice(8)}`
  if (/^\d{4}-\d{2}$/.test(value))
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][
      Number(value.slice(5)) - 1
    ]
  return value
}

function barChart(
  title: string,
  points: ChartPoint[],
  series: Array<{ key: ChartValueKey; label: string; color: string }>,
  height = 176
): string {
  const max = Math.max(1, ...points.flatMap((point) => series.map(({ key }) => point[key] ?? 0)))
  const width = 680
  const plotHeight = height - 60
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
  const sections = new Set<CashierReportSection>(
    data.sections ?? ['Cash Summary', 'Expenses', 'Income', 'Payment', 'Activity History']
  )
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
  const history = data.installmentHistory.filter(isVisibleInstallmentHistoryRecord)
  const receiptTotal = snapshot.receiptTotals.reduce(
    (total, item) => total + item.amountCentavos,
    0
  )
  const totalReceiptsCentavos =
    receiptTotal +
    snapshot.cashCollectionsCentavos +
    snapshot.otherIncomeCentavos +
    snapshot.financeDownCentavos
  const cashReceiptRows = [
    ...snapshot.receiptTotals.map((item) => ({
      type: item.receiptName,
      quantity: item.quantity,
      amountCentavos: item.amountCentavos
    })),
    { type: 'Collections', quantity: undefined, amountCentavos: snapshot.cashCollectionsCentavos },
    { type: 'Other Income', quantity: undefined, amountCentavos: snapshot.otherIncomeCentavos },
    {
      type: 'Finance Downpayment',
      quantity: undefined,
      amountCentavos: snapshot.financeDownCentavos
    }
  ].filter((item) => item.quantity !== undefined || item.amountCentavos > 0)
  const deductionTotal = deductions.reduce((total, item) => total + item.amountCentavos, 0)
  const expenseTotal = data.expenses.reduce((total, item) => total + item.amountCentavos, 0)
  const incomeTotal = data.incomes.reduce((total, item) => total + item.amountCentavos, 0)
  const paymentTotal = data.payments.reduce((total, item) => total + item.amountCentavos, 0)
  const expenseSummary = data.expenses.reduce(
    (totals, item) => {
      if (item.type === 'Company Expenses' || item.type === 'Operating')
        totals.companyExpensesCentavos += item.amountCentavos
      else if (item.type === 'Drawings') totals.drawingsCentavos += item.amountCentavos
      else if (item.type === 'Purchases' || item.type === 'Supply')
        totals.purchasesCentavos += item.amountCentavos
      else if (item.type === 'Receivables') totals.receivablesCentavos += item.amountCentavos
      return totals
    },
    {
      companyExpensesCentavos: 0,
      drawingsCentavos: 0,
      purchasesCentavos: 0,
      receivablesCentavos: 0
    }
  )
  const cashOutCentavos =
    expenseSummary.companyExpensesCentavos +
    expenseSummary.drawingsCentavos +
    expenseSummary.purchasesCentavos +
    expenseSummary.receivablesCentavos +
    deductionTotal
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
    { label: 'Total Cash Receipts', value: totalReceiptsCentavos, emphasis: true },
    { label: 'Expenses', value: expenseSummary.companyExpensesCentavos },
    { label: 'Drawings', value: expenseSummary.drawingsCentavos },
    { label: 'Purchases', value: expenseSummary.purchasesCentavos },
    { label: 'Receivables', value: expenseSummary.receivablesCentavos },
    { label: 'Deductions', value: deductionTotal },
    { label: 'Total Cash Outs', value: cashOutCentavos, emphasis: true },
    { label: 'Bank Check', value: paymentTotals.bankCheck },
    { label: 'Bank Transfer', value: paymentTotals.bankTransfer },
    { label: 'Gcash', value: paymentTotals.gcash },
    { label: 'E-wallet', value: paymentTotals.otherEwallet },
    { label: 'Total Payments', value: paymentTotals.total, emphasis: true },
    { label: 'Expected Cash', value: expectedCashCentavos, emphasis: true },
    { label: 'Cash Denominations', value: snapshot.physicalCashCentavos },
    { label: 'Cash Variance', value: cashVarianceCentavos, emphasis: true, alwaysShow: true }
  ]
  const currentMonthLabel =
    data.charts.monthlyCashFlow.at(-1)?.month ?? data.businessDate.slice(0, 7)
  const variance = snapshot.cashVarianceCentavos
  const operatingResult = data.charts.currentMonthOperatingResultCentavos
  const exceptions = [
    ...(operatingResult < 0
      ? [
          {
            title: 'Monthly cash result is below expenses',
            detail: `${currentMonthLabel}: ${money(operatingResult)}`
          }
        ]
      : []),
    ...(variance !== 0
      ? [
          {
            title: variance > 0 ? 'Cash overage needs review' : 'Cash shortage needs review',
            detail: `Expected ${money(snapshot.expectedCashCentavos)}; counted ${money(snapshot.physicalCashCentavos)}; variance ${money(variance)}`
          }
        ]
      : []),
    ...(data.charts.overdueAccountCount > 0
      ? [
          {
            title: `${data.charts.overdueAccountCount} overdue account${data.charts.overdueAccountCount === 1 ? '' : 's'}`,
            detail: `Outstanding balance: ${money(data.charts.overdueOutstandingCentavos)}`
          }
        ]
      : [])
  ]

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 10mm 9mm 14mm; }
    * { box-sizing: border-box; } body { color:#111; font:9px Arial,sans-serif; line-height:1.2; }
    h1 { font-size:16px; margin:0 0 3px; } h2 { border-bottom:1px solid #111; font-size:11px; margin:11px 0 3px; padding-bottom:2px; }
    .company { font-size:10px; font-weight:700; letter-spacing:.04em; margin-bottom:2px; text-transform:uppercase; }
    .meta { display:grid; grid-template-columns:repeat(4,1fr); gap:6px; margin-bottom:7px; } .meta span { color:#555; display:block; font-size:7px; text-transform:uppercase; } .meta strong { font-size:9px; }
    table { border-collapse:collapse; width:100%; } th,td { border-bottom:1px solid #ddd; padding:2px 3px; text-align:left; vertical-align:top; } th { font-size:7px; text-transform:uppercase; } thead { display:table-header-group; } tr { break-inside:avoid; } tfoot th,tfoot td { border-top:1px solid #111; font-weight:700; } .amount { text-align:right; white-space:nowrap; }
    .two-column { display:grid; gap:10px; grid-template-columns:1fr 1fr; } .cash-overview { break-inside:avoid; display:grid; grid-template-columns:42% 30%; justify-content:space-between; margin:8px 0 12px; } .cash-side { display:flex; flex-direction:column; gap:10px; } .cash-overview > div { min-width:0; } .cash-overview h2 { margin-top:0; } .summary-row { border-bottom:1px solid #ddd; display:flex; justify-content:space-between; gap:8px; padding:2px 0; } .summary-row > span:first-child { flex:1; } .summary-row strong { font-weight:400; text-align:right; white-space:nowrap; } .summary-qty { color:#555; font-size:8px; white-space:nowrap; } .summary-row.emphasis, .summary-row.emphasis strong { font-weight:700; } .section { break-inside:avoid; } .signatures { break-inside:avoid; display:grid; gap:26px; grid-template-columns:1fr 1fr; margin-top:24px; } .signature-line { border-bottom:1px solid #111; height:22px; margin:14px 0 3px; } .signature-label { color:#555; display:block; font-size:7px; text-transform:uppercase; } .signature-name { font-size:9px; } .note { break-inside:avoid; margin-top:16px; } .note p { margin:0; white-space:pre-wrap; } .muted { color:#555; } .charts { break-before:page; } .chart { break-inside:avoid; } .chart h2 { border:0; font-size:10px; margin:0 0 4px; padding:0; } .chart svg { display:block; height:auto; width:100%; } .chart svg text { fill:#4b5563; font-size:7px; } .chart-legend { display:flex; gap:9px; margin:0 0 3px; } .chart-legend span { align-items:center; display:flex; gap:3px; } .chart-legend i { display:inline-block; height:6px; width:6px; }
    .executive-header { border-bottom:1px solid #1f2937; margin-bottom:13px; padding-bottom:8px; } .executive-header h1 { font-size:19px; margin:0; } .executive-subtitle { color:#4b5563; font-size:9px; margin-top:3px; } .executive-meta { display:flex; gap:16px; margin-top:7px; } .executive-meta span { color:#4b5563; font-size:7px; text-transform:uppercase; } .executive-meta strong { font-size:8px; margin-left:3px; } .performance-hero { border-bottom:1px solid #9ca3af; margin-bottom:12px; padding-bottom:10px; } .performance-hero h2 { border:0; color:#374151; font-size:9px; margin:0 0 5px; padding:0; text-transform:uppercase; } .performance-result { align-items:baseline; display:flex; gap:10px; } .performance-result strong { font-size:22px; letter-spacing:-.02em; } .performance-result.negative strong { color:#b91c1c; } .performance-result span { color:#4b5563; font-size:9px; } .performance-note { color:#4b5563; font-size:8px; margin:4px 0 0; } .performance-metrics { border-bottom:1px solid #d1d5db; border-top:1px solid #d1d5db; display:grid; grid-template-columns:repeat(3,1fr); margin:0 0 14px; } .performance-metric { padding:8px 10px; } .performance-metric + .performance-metric { border-left:1px solid #d1d5db; } .performance-metric span { color:#4b5563; display:block; font-size:7px; text-transform:uppercase; } .performance-metric strong { display:block; font-size:13px; margin-top:4px; } .cash-control { border-bottom:1px solid #d1d5db; border-top:1px solid #1f2937; margin-top:13px; padding:8px 0 9px; } .cash-control-heading { align-items:baseline; display:flex; justify-content:space-between; } .cash-control-heading h2 { border:0; font-size:10px; margin:0; padding:0; } .cash-control-heading span { color:#4b5563; font-size:8px; } .cash-control-values { display:grid; grid-template-columns:repeat(4,1fr); margin-top:7px; } .cash-control-values div { padding:0 8px; } .cash-control-values div:first-child { padding-left:0; } .cash-control-values div + div { border-left:1px solid #d1d5db; } .cash-control-values span { color:#4b5563; display:block; font-size:7px; text-transform:uppercase; } .cash-control-values strong { display:block; font-size:10px; margin-top:3px; } .exceptions { margin-top:12px; } .exceptions h2 { border:0; font-size:10px; margin:0 0 5px; padding:0; } .exception-list { display:grid; gap:5px; } .exception { background:#fef2f2; border-top:2px solid #b91c1c; padding:7px 8px; } .exception strong { display:block; font-size:8.5px; } .exception span { color:#4b5563; display:block; font-size:7.5px; margin-top:3px; } .control-clear { color:#166534; font-size:8.5px; margin:5px 0 0; } .executive-footer { border-top:1px solid #9ca3af; color:#4b5563; display:flex; font-size:7px; justify-content:space-between; margin-top:12px; padding-top:5px; }
  </style></head><body>
    <header><div class="company">Nueva Camsur Home Furnishing</div><h1>Branch Cashier Report</h1><div class="meta"><div><span>Contributors</span><strong>${escapeHtml(data.cashierName)}</strong></div><div><span>Branch</span><strong>${escapeHtml(data.branch)}</strong></div><div><span>Business date</span><strong>${escapeHtml(data.businessDate)}</strong></div><div><span>Generated</span><strong>${escapeHtml(data.generatedAt)}</strong></div></div></header>
    ${
      sections.has('Cash Summary')
        ? `<section class="cash-overview"><div><h2>Cash Summary</h2>${cashSummaryRows.map((item) => summaryRow(item.label, item.value, item)).join('')}</div><div class="cash-side"><div><h2>Cash Denominations</h2>${denominations.length ? `<table><thead><tr><th>Denomination</th><th class="amount">Qty</th><th class="amount">Total</th></tr></thead><tbody>${denominations.map((item) => `<tr><td>${escapeHtml(money(item.valueCentavos))}</td><td class="amount">${item.quantity}</td>${amount(item.valueCentavos * item.quantity)}</tr>`).join('')}</tbody></table>` : ''}</div><div><h2>Deductions</h2>${deductions.map((item) => summaryRow(item.label, item.amountCentavos)).join('')}${summaryRow('Total deductions', deductionTotal)}</div></div></section>`
        : ''
    }
    ${
      sections.has('Total Cash Receipts')
        ? table(
            'Total Cash Receipts',
            ['Receipt type', 'Qty', 'Amount'],
            cashReceiptRows.map(
              (item) =>
                `<tr><td>${escapeHtml(item.type)}</td><td class="amount">${item.quantity ?? ''}</td>${amount(item.amountCentavos)}</tr>`
            ),
            totalReceiptsCentavos,
            'Total Cash Receipts'
          )
        : ''
    }
    ${
      sections.has('Expenses')
        ? table(
            'Expenses',
            ['Date', 'Type', 'Description', 'Category', 'Receipt no.', 'VAT', 'Added by', 'Amount'],
            data.expenses.map(
              (item) =>
                `<tr><td>${escapeHtml(item.businessDate)}</td><td>${escapeHtml(item.type)}</td><td>${escapeHtml(item.description)}</td><td>${escapeHtml(item.category)}</td><td>${escapeHtml(item.receiptNo)}</td><td>${escapeHtml(item.vat)}</td><td>${escapeHtml(item.createdByName)}</td>${amount(item.amountCentavos)}</tr>`
            ),
            expenseTotal
          )
        : ''
    }
    ${
      sections.has('Income')
        ? table(
            'Income',
            ['Date', 'Particular', 'Receipt / ref.', 'Remarks', 'Added by', 'Amount'],
            data.incomes.map(
              (item) =>
                `<tr><td>${escapeHtml(item.transactionDate)}</td><td>${escapeHtml(item.particular)}</td><td>${escapeHtml(item.receiptNumber)}</td><td>${escapeHtml(item.remarks)}</td><td>${escapeHtml(item.createdByName)}</td>${amount(item.amountCentavos)}</tr>`
            ),
            incomeTotal
          )
        : ''
    }
    ${
      sections.has('Payment')
        ? table(
            'Payments',
            [
              'Date',
              'Method',
              'Bank / provider',
              'Account name',
              'Reference no.',
              'Added by',
              'Amount'
            ],
            data.payments.map(
              (item) =>
                `<tr><td>${escapeHtml(item.transactionDate)}</td><td>${escapeHtml(item.paymentMethodName)}</td><td>${escapeHtml(item.bankName)}</td><td>${escapeHtml(item.payerName)}</td><td>${escapeHtml(item.referenceNumber)}</td><td>${escapeHtml(item.createdByName)}</td>${amount(item.amountCentavos)}</tr>`
            ),
            paymentTotal
          )
        : ''
    }
    ${
      sections.has('Activity History')
        ? table(
            'Activity History',
            ['Date', 'Action', 'Activity', 'Account', 'Reference', 'Amount'],
            history.map(
              (item) =>
                `<tr><td>${escapeHtml(item.occurredAt.slice(0, 10))}</td><td>${escapeHtml(historyActionLabel(item))}</td><td>${escapeHtml(item.activity)}</td><td>${escapeHtml(item.accountName)}</td><td>${escapeHtml(item.referenceNumber ?? item.accountNumber)}</td>${amount(item.amountCentavos ?? 0)}</tr>`
            )
          )
        : ''
    }
    ${(['Records', 'Active', 'Closed', 'Blacklisted'] as const)
      .map((section) =>
        sections.has(section) && data.accountLists
          ? table(
              section,
              ['Date Released', 'Branch', 'Account', 'Status', 'Contract', 'Balance'],
              data.accountLists[section.toLowerCase() as Lowercase<typeof section>].map(
                (item) =>
                  `<tr><td>${escapeHtml(item.loan.dateReleased)}</td><td>${escapeHtml(item.account.branch)}</td><td>${escapeHtml(`${item.account.firstName} ${item.account.lastName}`)}</td><td>${escapeHtml(item.meta.status)}</td><td>${escapeHtml(item.contractStatus)}</td>${amount(item.meta.outstandingBalance ?? item.loan.grandTotal)}</tr>`
              )
            )
          : ''
      )
      .join('')}
    ${
      sections.has('Finance Accounts') && data.financeAccounts?.length
        ? table(
            'Finance Accounts',
            ['Date Released', 'Branch', 'Type', 'Account', 'Balance'],
            data.financeAccounts.map(
              (item) =>
                `<tr><td>${escapeHtml(item.dateReleased)}</td><td>${escapeHtml(item.branch)}</td><td>${escapeHtml(item.provider)}</td><td>${escapeHtml(`${item.firstName} ${item.lastName}`)}</td>${amount(item.balanceCentavos)}</tr>`
            )
          )
        : ''
    }
    <section class="signatures"><div><span class="signature-label">Prepared by</span><div class="signature-line"></div><strong class="signature-name">${escapeHtml(data.cashierName)}</strong></div><div><span class="signature-label">Verified by</span><div class="signature-line"></div></div></section>
    ${data.note?.trim() ? `<section class="note"><h2>Note</h2><p>${escapeHtml(data.note.trim())}</p></section>` : ''}
    ${
      data.includeCharts === false
        ? ''
        : `<section class="charts"><div class="executive-header"><div class="company">Nueva Camsur Home Furnishing</div><h1>Monthly Cash Performance</h1><div class="executive-subtitle">A management view of month-to-date cash performance, supported by selected-day cash control.</div><div class="executive-meta"><div><span>Scope</span><strong>${escapeHtml(data.branch)}</strong></div><div><span>As of</span><strong>${escapeHtml(data.businessDate)}</strong></div><div><span>Generated</span><strong>${escapeHtml(data.generatedAt)}</strong></div></div></div><section class="performance-hero"><h2>${escapeHtml(currentMonthLabel)} cash result</h2><div class="performance-result${operatingResult < 0 ? ' negative' : ''}"><strong>${escapeHtml(money(operatingResult))}</strong><span>${operatingResult < 0 ? 'Cash receipts are below posted expenses.' : 'Cash receipts exceed posted expenses.'}</span></div><p class="performance-note">Cash receipts less posted expenses. This is a cash-performance measure, not a profit measure.</p></section><div class="performance-metrics"><div class="performance-metric"><span>Month-to-date cash receipts</span><strong>${escapeHtml(money(data.charts.currentMonthCashReceiptsCentavos))}</strong></div><div class="performance-metric"><span>Month-to-date posted expenses</span><strong>${escapeHtml(money(data.charts.currentMonthExpenseCentavos))}</strong></div><div class="performance-metric"><span>Month-to-date cash result</span><strong>${escapeHtml(money(operatingResult))}</strong></div></div>${barChart(
            '12-Month Cash Receipts vs Expenses',
            data.charts.monthlyCashFlow.map((item) => ({
              label: item.month,
              cashReceiptsCentavos: item.cashReceiptsCentavos,
              expenseCentavos: item.expenseCentavos
            })),
            [
              { key: 'cashReceiptsCentavos', label: 'Cash Receipts', color: '#0369a1' },
              { key: 'expenseCentavos', label: 'Posted Expenses', color: '#b91c1c' }
            ],
            280
          )}<section class="cash-control"><div class="cash-control-heading"><h2>Selected-Day Cash Control</h2><span>Expected cash to physical count; remittance is a separate handoff.</span></div><div class="cash-control-values"><div><span>Expected cash</span><strong>${escapeHtml(money(snapshot.expectedCashCentavos))}</strong></div><div><span>Physical count</span><strong>${escapeHtml(money(snapshot.physicalCashCentavos))}</strong></div><div><span>Cash variance</span><strong>${escapeHtml(money(snapshot.cashVarianceCentavos))}</strong></div><div><span>Cash remitted</span><strong>${escapeHtml(snapshot.report.cashRemittedCentavos === null ? 'Not recorded' : money(snapshot.report.cashRemittedCentavos))}</strong></div></div></section><section class="exceptions"><h2>Material Exceptions</h2>${exceptions.length ? `<div class="exception-list">${exceptions.map((exception) => `<div class="exception"><strong>${escapeHtml(exception.title)}</strong><span>${escapeHtml(exception.detail)}</span></div>`).join('')}</div>` : '<p class="control-clear">No material cash-control or overdue-account exception as of this report date.</p>'}</section><div class="executive-footer"><span>Monthly Cash Performance</span><span>${escapeHtml(data.branch)} · ${escapeHtml(data.businessDate)}</span></div></section>`
    }
  </body></html>`
}
