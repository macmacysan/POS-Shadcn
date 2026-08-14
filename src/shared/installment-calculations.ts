import type { InstallmentFrequency, InstallmentRules } from './contracts'

export type InstallmentItem = { quantity: number; unitPriceCentavos: number }
export type InstallmentCalculation = {
  startDate: string | null; endDate: string | null; grandTotalCentavos: number; totalInstallmentCentavos: number | null; interestCentavos: number | null; paymentAmountCentavos: number | null; requiredFeeCentavos: number | null; interestRateBps: number | null; dailyRequiredFeeFactor: number | null
}
const localDate = (value: string): Date | null => /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : null
const isoDate = (value: Date): string => [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-')
const addDays = (date: Date, days: number): Date => { const next = new Date(date); next.setDate(next.getDate() + days); return next }
const addMonths = (date: Date, months: number): Date => {
  const next = new Date(date); const day = next.getDate()
  next.setDate(1); next.setMonth(next.getMonth() + months)
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
  next.setDate(Math.min(day, lastDay)); return next
}
export function calculateStartDate(releaseDate: string, frequency: InstallmentFrequency): string | null { const date = localDate(releaseDate); if (!date) return null; return isoDate(frequency === 'Daily' ? addDays(date, 1) : frequency === 'Weekly' ? addDays(date, 7) : frequency === 'Semi' ? addDays(date, 15) : addMonths(date, 1)) }
export function calculateEndDate(startDate: string | null, frequency: InstallmentFrequency, terms: number): string | null { const date = startDate && localDate(startDate); if (!date || !Number.isInteger(terms) || terms < 1) return null; const intervals = terms - 1; return isoDate(frequency === 'Daily' ? addDays(date, intervals) : frequency === 'Weekly' ? addDays(date, intervals * 7) : frequency === 'Semi' ? addDays(date, intervals * 15) : addMonths(date, intervals)) }
export function calculateGrandTotal(items: readonly InstallmentItem[]): number { return items.reduce((total, item) => total + (Number.isInteger(item.quantity) && item.quantity > 0 && Number.isInteger(item.unitPriceCentavos) && item.unitPriceCentavos >= 0 ? item.quantity * item.unitPriceCentavos : 0), 0) }
export function calculateInstallment(input: { releaseDate: string; frequency: InstallmentFrequency; terms: number; items: readonly InstallmentItem[]; actualDownPaymentCentavos: number }, rules: InstallmentRules): InstallmentCalculation {
  const grandTotalCentavos = calculateGrandTotal(input.items); const startDate = calculateStartDate(input.releaseDate, input.frequency); const endDate = calculateEndDate(startDate, input.frequency, input.terms); const monthly = rules.monthlyPlans.find((plan) => plan.terms === input.terms); const daily = rules.dailyPlans.find((plan) => plan.terms === input.terms)
  const valid = input.frequency === 'Daily' ? Boolean(daily) : input.frequency === 'Weekly' ? rules.weeklyTerms.includes(input.terms) : input.frequency === 'Semi' ? rules.semiTerms.includes(input.terms) : Boolean(monthly)
  if (!valid) return { startDate, endDate, grandTotalCentavos, totalInstallmentCentavos: null, interestCentavos: null, paymentAmountCentavos: null, requiredFeeCentavos: null, interestRateBps: null, dailyRequiredFeeFactor: null }
  const interestRateBps = input.frequency === 'Monthly' ? monthly!.interestRateBps : rules.standardInterestRateBps
  const totalInstallmentCentavos = Math.round(grandTotalCentavos * (10000 + interestRateBps) / 10000)
  const paymentBase = input.frequency === 'Monthly' ? totalInstallmentCentavos - Math.max(0, input.actualDownPaymentCentavos) : totalInstallmentCentavos
  const paymentAmountCentavos = Math.round(paymentBase / input.terms)
  const dailyRequiredFeeFactor = input.frequency === 'Daily' ? daily!.requiredFeePayments : null
  const requiredFeeCentavos = input.frequency === 'Daily' ? paymentAmountCentavos * dailyRequiredFeeFactor! : input.frequency === 'Monthly' ? Math.round(grandTotalCentavos * rules.requiredDownPaymentRateBps / 10000) : paymentAmountCentavos
  return { startDate, endDate, grandTotalCentavos, totalInstallmentCentavos, interestCentavos: totalInstallmentCentavos - grandTotalCentavos, paymentAmountCentavos, requiredFeeCentavos, interestRateBps, dailyRequiredFeeFactor }
}
