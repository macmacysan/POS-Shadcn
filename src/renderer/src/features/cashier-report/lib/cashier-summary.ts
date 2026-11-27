import type {
  DailyReportSnapshotResponse as Snapshot,
  ExpenseSummaryTotals
} from '@/../../shared/contracts'

export const receiptTypesExcludedFromPicker = new Set(['CASH SALES', 'COLLECTIONS'])
const paymentMethodIds = {
  cash: '00000000-0000-4000-8000-000000000001'
} as const
const RECEIPT_VISIBILITY_STORAGE_KEY = 'cashiers-report-visible-receipt-types'
function receiptTypeSummaryName(name: string, shortName?: string, isSystem = false): string {
  if (!isSystem && shortName?.trim()) return shortName.trim().slice(0, 7)
  switch (name.trim().toUpperCase()) {
    case 'SALES INVOICE':
    case 'SI':
      return 'SI'
    case 'SALES INVOICE - TRADING':
    case 'SI TRADING':
    case 'SI-T':
      return 'SI-T'
    case 'DELIVERY RECEIPT':
    case 'DR':
      return 'DR'
    case 'BOBS PAWNSHOP':
    case 'BP':
      return 'BP'
    default:
      return isSystem ? name : name.trim().slice(0, 7)
  }
}

function readReceiptVisibility(): Set<string> | undefined {
  try {
    const stored = localStorage.getItem(RECEIPT_VISIBILITY_STORAGE_KEY)
    if (!stored) return undefined
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed) || !parsed.every((value) => typeof value === 'string')) {
      return undefined
    }
    return new Set(parsed)
  } catch {
    return undefined
  }
}

export function writeReceiptVisibility(ids: Set<string>): void {
  localStorage.setItem(RECEIPT_VISIBILITY_STORAGE_KEY, JSON.stringify([...ids]))
}

export function initialReceiptVisibility(snapshot: Snapshot, isToday: boolean): Set<string> {
  const availableIds = new Set([
    ...snapshot.receiptTypes.map((type) => type.id),
    ...snapshot.receiptTotals.map((item) => item.receiptTypeId)
  ])
  const storedIds = readReceiptVisibility()
  return !isToday
    ? new Set(snapshot.receiptTotals.map((item) => item.receiptTypeId))
    : storedIds
      ? new Set([...storedIds].filter((id) => availableIds.has(id)))
      : new Set(
          snapshot.receiptTypes.filter((type) => type.isDefaultVisible).map((type) => type.id)
        )
}

type SummaryRow = {
  label: string
  value: number
  emphasis?: boolean
  quantity?: number
  detail?: 'collections' | 'finance' | 'deductions' | 'denominations'
  valueMuted?: boolean
}

export function cashierSummary(
  snapshot: Snapshot,
  expenseTotals: ExpenseSummaryTotals,
  visibleReceiptTypeIds: Set<string>
) {
  const deductionCentavos = snapshot.deductions.reduce(
    (total, item) => total + item.amountCentavos,
    0
  )
  const paymentTotals = snapshot.paymentEntries
    .filter((item) => item.status === 'POSTED')
    .reduce(
      (totals, item) => {
        totals.byMethod[item.paymentMethodName] =
          (totals.byMethod[item.paymentMethodName] ?? 0) + item.amountCentavos
        if (item.paymentMethodId === paymentMethodIds.cash) totals.cash += item.amountCentavos
        else totals.total += item.amountCentavos
        return totals
      },
      { cash: 0, total: 0, byMethod: {} as Record<string, number> }
    )
  const totalCashReceiptsCentavos =
    snapshot.receiptTotals.reduce((total, item) => total + item.amountCentavos, 0) +
    snapshot.cashCollectionsCentavos +
    snapshot.otherIncomeCentavos +
    snapshot.financeDownCentavos +
    paymentTotals.cash
  const totalCashOutCentavos =
    expenseTotals.companyExpensesCentavos +
    expenseTotals.drawingsCentavos +
    expenseTotals.purchasesCentavos +
    expenseTotals.receivablesCentavos +
    deductionCentavos
  const expectedCashCentavos =
    totalCashReceiptsCentavos -
    totalCashOutCentavos -
    snapshot.nonCashCollectionCentavos -
    paymentTotals.total
  const variance = snapshot.physicalCashCentavos - expectedCashCentavos
  const receiptTypesByReport = [
    ...snapshot.receiptTypes.map((type) => {
      const total = snapshot.receiptTotals.find((item) => item.receiptTypeId === type.id)
      return total ? { ...type, name: total.receiptName, shortName: total.receiptShortName } : type
    }),
    ...snapshot.receiptTotals
      .filter((total) => !snapshot.receiptTypes.some((type) => type.id === total.receiptTypeId))
      .map((total, index) => ({
        id: total.receiptTypeId,
        name: total.receiptName,
        shortName: total.receiptShortName,
        sortOrder: Number.MAX_SAFE_INTEGER + index,
        isDefaultVisible: false,
        isSystem: false,
        isActive: false
      }))
  ]
  const receipts = receiptTypesByReport
    .filter(
      (type) =>
        visibleReceiptTypeIds.has(type.id) &&
        !receiptTypesExcludedFromPicker.has(type.name.trim().toUpperCase())
    )
    .map((type) => {
      const total = snapshot.receiptTotals.find((item) => item.receiptTypeId === type.id)
      return {
        ...type,
        label: receiptTypeSummaryName(type.name, type.shortName, type.isSystem),
        value: total?.amountCentavos ?? 0,
        quantity: total?.quantity ?? 0
      }
    })
  const groups: SummaryRow[][] = [
    [
      { label: 'Collections', value: snapshot.cashCollectionsCentavos, detail: 'collections' },
      { label: 'Other', value: snapshot.otherIncomeCentavos, valueMuted: true },
      {
        label: 'Finance Down',
        value: snapshot.financeDownCentavos,
        detail: 'finance',
        valueMuted: true
      },
      { label: 'Cash Payments', value: paymentTotals.cash, valueMuted: true },
      { label: 'Total Cash Receipts', value: totalCashReceiptsCentavos, emphasis: true }
    ],
    [
      { label: 'Expenses', value: expenseTotals.companyExpensesCentavos },
      { label: 'Drawings', value: expenseTotals.drawingsCentavos, valueMuted: true },
      { label: 'Purchases', value: expenseTotals.purchasesCentavos },
      { label: 'Receivables', value: expenseTotals.receivablesCentavos, valueMuted: true },
      { label: 'Deductions', value: deductionCentavos, detail: 'deductions' },
      { label: 'Total Cash Outs', value: totalCashOutCentavos, emphasis: true }
    ],
    [
      ...Object.entries(paymentTotals.byMethod)
        .filter(([method]) => method !== 'Cash')
        .map(([label, value]) => ({ label, value, valueMuted: true })),
      { label: 'Total Payments', value: paymentTotals.total, emphasis: true },
      {
        label: 'Less: non-cash collections',
        value: snapshot.nonCashCollectionCentavos,
        valueMuted: true
      }
    ]
  ]
  const footer: SummaryRow[] = [
    { label: 'Expected Cash', value: expectedCashCentavos },
    {
      label: 'Cash Denominations',
      value: snapshot.physicalCashCentavos,
      detail: 'denominations',
      valueMuted: true
    }
  ]
  return {
    receipts,
    groups: groups.map((group) => group.filter((row) => row.value !== 0)),
    footer,
    variance: { label: 'Cash variance', value: variance, emphasis: true },
    totalCashReceiptsCentavos
  }
}
