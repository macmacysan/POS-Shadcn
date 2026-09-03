export type InHouseScheduleSeed = {
  installmentNumber: number
  dueDate: string
  dueAmountCentavos: number
}

function termCount(terms: string): number {
  const parsed = Number.parseInt(terms, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

function addFrequency(date: Date, frequency: string, count: number): Date {
  const next = new Date(`${date.toISOString().slice(0, 10)}T00:00:00.000Z`)
  if (frequency === 'Daily') next.setUTCDate(next.getUTCDate() + count)
  else if (frequency === 'Weekly') next.setUTCDate(next.getUTCDate() + count * 7)
  else if (frequency === 'Bi-weekly') next.setUTCDate(next.getUTCDate() + count * 14)
  else if (frequency === 'Semi-monthly') next.setUTCDate(next.getUTCDate() + count * 15)
  else next.setUTCMonth(next.getUTCMonth() + count)
  return next
}

/** The authoritative in-house repayment schedule used for storage and payment allocation. */
export function buildInHouseSchedule(
  firstDueDate: string,
  paymentFrequency: string,
  terms: string,
  totalPayableCentavos: number
): InHouseScheduleSeed[] {
  const count = termCount(terms)
  const baseAmount = Math.floor(totalPayableCentavos / count)
  const remainder = totalPayableCentavos % count
  const firstDue = new Date(`${firstDueDate}T00:00:00.000Z`)

  if (Number.isNaN(firstDue.getTime()) || totalPayableCentavos <= 0) return []

  return Array.from({ length: count }, (_, index) => {
    const dueDate = addFrequency(firstDue, paymentFrequency, index).toISOString().slice(0, 10)
    return {
      installmentNumber: index + 1,
      dueDate,
      dueAmountCentavos: baseAmount + (index === count - 1 ? remainder : 0)
    }
  })
}
