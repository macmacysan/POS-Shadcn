import { ipcMain } from 'electron'

import {
  dailyReportIpcChannels,
  dailyReportPaymentCreateRequestSchema,
  dailyReportPaymentListRequestSchema,
  dailyReportPaymentUpdateRequestSchema,
  dailyReportPaymentVoidRequestSchema,
  dailyReportResolveActiveRequestSchema,
  dailyReportSnapshotRequestSchema,
  incomeCreateRequestSchema,
  incomeListRequestSchema,
  incomeUpdateRequestSchema,
  incomeVoidRequestSchema
} from '../../shared/contracts'
import { toIpcError } from '../database/errors'
import { DailyReportService } from '../services/daily-report-service'

export function registerDailyReportIpc(service: DailyReportService): void {
  const handle = <T>(channel: string, parse: (input: unknown) => T, run: (input: T) => unknown): void => {
    ipcMain.handle(channel, (_event, input: unknown) => {
      try {
        return run(parse(input))
      } catch (error) {
        throw toIpcError(error)
      }
    })
  }

  handle(dailyReportIpcChannels.resolveActive, dailyReportResolveActiveRequestSchema.parse, (input) =>
    service.resolveActive(input)
  )
  handle(dailyReportIpcChannels.getSnapshot, dailyReportSnapshotRequestSchema.parse, (input) =>
    service.getSnapshot(input)
  )
  handle(dailyReportIpcChannels.listIncome, incomeListRequestSchema.parse, (input) =>
    service.listIncome(input)
  )
  handle(dailyReportIpcChannels.createIncome, incomeCreateRequestSchema.parse, (input) =>
    service.createIncome(input)
  )
  handle(dailyReportIpcChannels.updateIncome, incomeUpdateRequestSchema.parse, (input) =>
    service.updateIncome(input)
  )
  handle(dailyReportIpcChannels.voidIncome, incomeVoidRequestSchema.parse, (input) =>
    service.voidIncome(input)
  )
  handle(dailyReportIpcChannels.listPayments, dailyReportPaymentListRequestSchema.parse, (input) =>
    service.listPayments(input)
  )
  handle(dailyReportIpcChannels.createPayment, dailyReportPaymentCreateRequestSchema.parse, (input) =>
    service.createPayment(input)
  )
  handle(dailyReportIpcChannels.updatePayment, dailyReportPaymentUpdateRequestSchema.parse, (input) =>
    service.updatePayment(input)
  )
  handle(dailyReportIpcChannels.voidPayment, dailyReportPaymentVoidRequestSchema.parse, (input) =>
    service.voidPayment(input)
  )
}
