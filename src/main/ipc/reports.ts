import { ipcMain } from 'electron'

import { reportGetByIdRequestSchema, reportIpcChannels } from '../../shared/contracts'
import { toIpcError } from '../database/errors'
import { ReportService } from '../services/report-service'

function rethrowIpcError(error: unknown): never {
  throw toIpcError(error)
}

export function registerReportIpc(service: ReportService): void {
  ipcMain.handle(reportIpcChannels.getById, (_event, input: unknown) => {
    try {
      const { reportId } = reportGetByIdRequestSchema.parse(input)
      return service.getById(reportId)
    } catch (error) {
      return rethrowIpcError(error)
    }
  })
}
