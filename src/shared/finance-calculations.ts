export type FinanceCalculationItem = {
  quantity: number
  itemPriceCentavos: number
}

export function calculateFinanceAmounts(
  items: readonly FinanceCalculationItem[],
  downpaymentCentavos: number
): { grandTotalCentavos: number; balanceCentavos: number } {
  const grandTotalCentavos = items.reduce(
    (total, item) => total + item.quantity * item.itemPriceCentavos,
    0
  )
  return {
    grandTotalCentavos,
    balanceCentavos: grandTotalCentavos - downpaymentCentavos
  }
}
