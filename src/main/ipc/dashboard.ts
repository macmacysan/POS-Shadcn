import { ipcMain } from 'electron'

import { dashboardGetRequestSchema, dashboardIpcChannels } from '../../shared/contracts'
import { toIpcError } from '../database/errors'
import { DashboardService } from '../services/dashboard-service'

export function registerDashboardIpc(service: DashboardService): void {
  ipcMain.handle(dashboardIpcChannels.get, (_event, input: unknown) => {
    try {
      return service.getOverview(dashboardGetRequestSchema.parse(input))
    } catch (error) {
      const payload = toIpcError(error)
      throw Object.assign(new Error(payload.message), payload)
    }
  })
}
