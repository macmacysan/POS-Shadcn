import type { InHousePaymentRecord, InHouseScheduleRecord } from '../../../shared/contracts'

export type SchedulePaymentRelation = {
  payment: InHousePaymentRecord
  scheduleNumbers: number[]
  isFirstSchedule: boolean
}

export function groupSchedulePaymentRelations(
  schedules: InHouseScheduleRecord[],
  payments: InHousePaymentRecord[]
): Map<string, SchedulePaymentRelation[]> {
  const scheduleNumbers = new Map(schedules.map((schedule) => [schedule.id, schedule.installmentNumber]))
  const relations = new Map<string, SchedulePaymentRelation[]>()

  for (const payment of payments) {
    if (payment.status !== 'POSTED') continue
    const scheduleIds = [...new Set(payment.scheduleIds)].filter((id) => scheduleNumbers.has(id))
    if (!scheduleIds.length) continue
    const numbers = scheduleIds.map((id) => scheduleNumbers.get(id)!).sort((a, b) => a - b)
    const firstScheduleId = scheduleIds.reduce((first, id) =>
      scheduleNumbers.get(id)! < scheduleNumbers.get(first)! ? id : first
    )

    for (const scheduleId of scheduleIds) {
      const related = relations.get(scheduleId) ?? []
      related.push({ payment, scheduleNumbers: numbers, isFirstSchedule: scheduleId === firstScheduleId })
      relations.set(scheduleId, related)
    }
  }

  return relations
}
