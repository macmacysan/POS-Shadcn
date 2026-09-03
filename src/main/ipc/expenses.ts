import { ipcMain } from 'electron'

import {
  expenseCreateInputSchema,
  expenseIpcChannels,
  expenseIdSchema,
  expenseListRequestSchema,
  expenseVoidInputSchema,
  expenseSummaryTotalsRequestSchema,
  expenseUpdateInputSchema
} from '../../shared/contracts'
import { toIpcError } from '../database/errors'
import { ExpenseService } from '../services/expense-service'

function rethrowIpcError(error: unknown): never {
  throw toIpcError(error)
}

export function registerExpenseIpc(service: ExpenseService, onCommitted?: () => void): void {
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
      const result = service.create(expenseCreateInputSchema.parse(input))
      onCommitted?.()
      return result
    } catch (error) {
      return rethrowIpcError(error)
    }
  })

  ipcMain.handle(expenseIpcChannels.update, (_event, input: unknown) => {
    try {
      const result = service.update(expenseUpdateInputSchema.parse(input))
      onCommitted?.()
      return result
    } catch (error) {
      return rethrowIpcError(error)
    }
  })

  ipcMain.handle(expenseIpcChannels.void, (_event, input: unknown) => {
    try {
      const { ids, reason } = expenseVoidInputSchema.parse(input)
      service.void(ids, reason)
      onCommitted?.()
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
