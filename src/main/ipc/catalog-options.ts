import { ipcMain } from 'electron'
import {
  catalogOptionIpcChannels,
  catalogOptionCreateRequestSchema,
  catalogOptionIdRequestSchema,
  catalogOptionListRequestSchema,
  catalogOptionRenameRequestSchema
} from '../../shared/contracts'
import { AppError } from '../database/errors'
import { CatalogOptionService } from '../services/catalog-option-service'

export function registerCatalogOptionIpc(service: CatalogOptionService): void {
  const handle = <T>(
    channel: string,
    parse: (value: unknown) => T,
    run: (value: T) => unknown
  ): void =>
    ipcMain.handle(channel, (_event, value: unknown) => {
      try {
        return run(parse(value))
      } catch (error) {
        if (error instanceof AppError) throw error
        throw new AppError('VALIDATION_ERROR', 'Invalid catalog option request.')
      }
    })
  handle(
    catalogOptionIpcChannels.list,
    (value) => catalogOptionListRequestSchema.parse(value ?? {}),
    (value) => service.list(value)
  )
  handle(
    catalogOptionIpcChannels.create,
    (value) => catalogOptionCreateRequestSchema.parse(value),
    (value) => service.create(value)
  )
  handle(
    catalogOptionIpcChannels.rename,
    (value) => catalogOptionRenameRequestSchema.parse(value),
    (value) => service.rename(value)
  )
  handle(
    catalogOptionIpcChannels.retire,
    (value) => catalogOptionIdRequestSchema.parse(value),
    (value) => service.retire(value)
  )
  handle(
    catalogOptionIpcChannels.restore,
    (value) => catalogOptionIdRequestSchema.parse(value),
    (value) => service.restore(value)
  )
}
