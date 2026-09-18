import type {
  InstallmentPaymentWorkspace,
  InHouseScheduleRecord
} from '../../../../../shared/contracts'

const escapeHtml = (value: string | number | undefined): string =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')

const money = (centavos: number): string =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(centavos / 100)

const date = (value?: string): string => {
  if (!value) return ''
  const parsed = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsed.valueOf())
    ? value
    : new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(
        parsed
      )
}

function paymentForSchedule(
  workspace: InstallmentPaymentWorkspace,
  schedule: InHouseScheduleRecord
) {
  return workspace.payments.find(
    (payment) => payment.status === 'POSTED' && payment.scheduleIds.includes(schedule.id)
  )
}

export function createPaymentSchedulePdfHtml(
  workspace: InstallmentPaymentWorkspace,
  verticalAdjustmentInches = 0
): string {
  const topMarginInches = Math.min(0.29, Math.max(0.03, 0.13 + verticalAdjustmentInches))
  const { account } = workspace
  const contact =
    account.contacts.find((item) => item.kind === 'mobile' && item.isPrimary) ??
    account.contacts.find((item) => item.kind === 'mobile')
  const address = [
    account.streetSubdivision,
    account.barangay,
    account.cityMunicipality,
    account.province
  ]
    .filter(Boolean)
    .join(', ')
  const rows = workspace.schedules
    .map((schedule) => {
      const payment = paymentForSchedule(workspace, schedule)
      const allocatedAmountCentavos = payment?.allocatedAmountCentavos ?? 0
      const hasAllocatedPayment = allocatedAmountCentavos > 0
      return `<tr><td>${schedule.installmentNumber}</td><td>${escapeHtml(date(schedule.dueDate))}</td><td class="amount">${hasAllocatedPayment ? escapeHtml(money(allocatedAmountCentavos)) : ''}</td><td>${escapeHtml(payment ? date(payment.paymentDate) : '')}</td><td>${escapeHtml(payment?.referenceNumber)}</td><td></td><td class="amount">${schedule.penaltyCentavos ? escapeHtml(money(schedule.penaltyCentavos)) : ''}</td><td class="amount">${hasAllocatedPayment ? escapeHtml(money(schedule.balanceCentavos)) : ''}</td><td>${escapeHtml(payment?.remarks || (schedule.isService ? 'Service' : ''))}</td></tr>`
    })
    .join('')
  const name = [account.lastName, account.firstName, account.middleName, account.suffix]
    .filter(Boolean)
    .join(', ')
  const detail = (label: string, value?: string): string =>
    `<div class="detail"><span class="label">${escapeHtml(label)}:</span><span class="value">${escapeHtml(value)}</span></div>`
  const optionalMoney = (value: number): string => (value > 0 ? money(value) : '')
  const unitDesired = workspace.loan.items
    .map((item) => item.name)
    .filter(Boolean)
    .join(', ')
  const cashPriceCentavos = Math.round(workspace.loan.grandTotal * 100)
  const installmentPriceCentavos = Math.round(
    (workspace.loan.grandTotal + workspace.loan.interest) * 100
  )
  const details = [
    [
      detail('Address', address),
      detail('Occupation', account.occupation),
      detail('Name of Spouse'),
      detail('Unit Desired', unitDesired),
      detail('Cash Price', optionalMoney(cashPriceCentavos)),
      detail('Installment Price', optionalMoney(installmentPriceCentavos))
    ],
    [
      detail('Downpayment', optionalMoney(Math.round(workspace.loan.downPayment * 100))),
      detail('Monthly Payment', optionalMoney(workspace.installmentAmountCentavos)),
      detail('Discounted Monthly Payment'),
      detail('CP No.', contact?.value),
      detail('Serial Number'),
      detail('Terms', workspace.loan.terms)
    ],
    [
      detail('Release Date', date(workspace.loan.dateReleased)),
      detail('OR. #'),
      detail('OR # Date'),
      detail('Other Source of Fund'),
      detail('No. of Loan', workspace.contractNumber),
      detail('Remarks', workspace.loan.remarks)
    ]
  ]
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: 8in 5in; margin: ${topMarginInches.toFixed(2)}in .12in .08in; } * { box-sizing:border-box; } body { color:#111; font:9.5px Arial,sans-serif; margin:0; } h1 { background:transparent; font-size:15px; height:.2in; line-height:.2in; margin:0; padding:0 4px; } .title { font-size:8px; font-weight:700; height:.14in; line-height:.14in; margin:0; padding:0 4px; text-transform:uppercase; } .details { display:grid; grid-template-columns:1.25fr 1fr 1fr; gap:8px; margin:0; padding-top:.12in; } .detail { align-items:center; border:0; display:grid; grid-template-columns:96px 1fr; height:.24in; padding:0 4px; } .label { font-weight:700; } .value { overflow-wrap:anywhere; } table { border-collapse:collapse; margin:0; table-layout:fixed; width:100%; } th,td { padding:0 3px; vertical-align:middle; } th { background:transparent; border:1px solid #111; font-size:7px; height:.24in; text-align:left; text-transform:uppercase; } td { border-left:1px solid #111; border-right:1px solid #111; height:.24in; } tbody tr:last-child td { border-bottom:1px solid #111; } tr { break-inside:avoid; } .amount { text-align:right; white-space:nowrap; }
  </style></head><body><h1>${escapeHtml(name)}</h1><p class="title">In-house installment payment schedule</p><section class="details">${details.map((column) => `<div>${column.join('')}</div>`).join('')}</section><table><thead><tr><th style="width:4%">No.</th><th style="width:13%">Schedule</th><th style="width:11%" class="amount">Payment</th><th style="width:12%">Date</th><th style="width:8%">OR</th><th style="width:12%">Collector</th><th style="width:9%" class="amount">Add.</th><th style="width:11%" class="amount">Bal.</th><th style="width:20%">Remarks</th></tr></thead><tbody>${rows}</tbody></table></body></html>`
}
