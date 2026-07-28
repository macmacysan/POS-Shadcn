export function calculateFinanceAmounts(
  quantity: number,
  itemPriceCentavos: number,
  downpaymentCentavos: number
): { grandTotalCentavos: number; balanceCentavos: number } {
  const grandTotalCentavos = quantity * itemPriceCentavos
  return {
    grandTotalCentavos,
    balanceCentavos: grandTotalCentavos - downpaymentCentavos
  }
}
