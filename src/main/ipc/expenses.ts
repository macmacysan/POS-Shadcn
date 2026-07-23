import { ipcMain } from 'electron'

import {
  expenseCreateInputSchema,
  expenseIpcChannels,
  expenseIdSchema,
  expenseListRequestSchema,
  expenseRemoveInputSchema,
  expenseSummaryTotalsRequestSchema,
  expenseUpdateInputSchema
} from '../../shared/contracts'
import { toIpcError } from '../database/errors'
import { ExpenseService } from '../services/expense-service'

function rethrowIpcError(error: unknown): never {
  throw toIpcError(error)
}

export function registerExpenseIpc(service: ExpenseService): void {
  ipcMain.handle(expenseIpcChannels.list, (_event, input: unknown) => {
    try {
      return service.list(expenseListRequestSchema.parse(input))
    } catch (error) {
      return rethrowIpcError(error)
    }
  })

  ipcMain.handle(expenseIpcChannels.getById, (_event, input: unknown) => {
    try {
      const { id } = expenseIdSchema.parse(input)
      return service.getById(id)
    } catch (error) {
      return rethrowIpcError(error)
    }
  })

  ipcMain.handle(expenseIpcChannels.create, (_event, input: unknown) => {
    try {
      return service.create(expenseCreateInputSchema.parse(input))
    } catch (error) {
      return rethrowIpcError(error)
    }
  })

  ipcMain.handle(expenseIpcChannels.update, (_event, input: unknown) => {
    try {
      return service.update(expenseUpdateInputSchema.parse(input))
    } catch (error) {
      return rethrowIpcError(error)
    }
  })

  ipcMain.handle(expenseIpcChannels.remove, (_event, input: unknown) => {
    try {
      const { ids } = expenseRemoveInputSchema.parse(input)
      service.remove(ids)
    } catch (error) {
      return rethrowIpcError(error)
    }
  })

  ipcMain.handle(expenseIpcChannels.summaryTotals, (_event, input: unknown) => {
    try {
      const { reportId } = expenseSummaryTotalsRequestSchema.parse(input)
      return service.summaryTotals(reportId)
    } catch (error) {
      return rethrowIpcError(error)
    }
  })
}
