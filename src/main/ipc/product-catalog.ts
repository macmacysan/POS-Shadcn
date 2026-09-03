import { ipcMain } from 'electron'

import { productCatalogIpcChannels } from '../../shared/contracts'
import { toIpcError } from '../database/errors'
import { ProductCatalogService } from '../services/product-catalog-service'

export function registerProductCatalogIpc(service: ProductCatalogService): void {
  ipcMain.handle(productCatalogIpcChannels.list, async () => {
    try {
      return await service.list()
    } catch (error) {
      const payload = toIpcError(error)
      throw new Error(payload.message)
    }
  })
}