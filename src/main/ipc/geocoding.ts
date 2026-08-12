import { ipcMain } from 'electron'
import { geocodeRequestSchema, geocodingIpcChannels } from '../../shared/contracts'
import { AppError } from '../database/errors'
import { GeocodingService } from '../services/geocoding-service'

export function registerGeocodingIpc(service: GeocodingService): void {
  ipcMain.handle(geocodingIpcChannels.forward, async (_event, value: unknown) => {
    try {
      return await service.forward(geocodeRequestSchema.parse(value))
    } catch {
      throw new AppError('VALIDATION_ERROR', 'Invalid geocoding request.')
    }
  })
}
