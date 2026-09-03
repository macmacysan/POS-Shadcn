import type { ProductCatalogItem } from '../../shared/contracts'
import { ProductCatalogRepository } from '../database/product-catalog-repository'
import { GoogleSheetsClient } from './google-sheets-client'

const priceListId = '1gS2eSevxSrfwZ82V4p7wdjjsEM1U2ts7gLIPaY8pNH4'

function centavos(value: string | undefined): number | undefined {
  const amount = Number(value?.replace(/[^\d.-]/g, ''))
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : undefined
}

export class ProductCatalogService {
  constructor(
    private readonly repository: ProductCatalogRepository,
    private readonly sheets: Pick<GoogleSheetsClient, 'values'>
  ) {}

  async list(): Promise<{ rows: ProductCatalogItem[] }> {
    try {
      const [header = [], ...records] = await this.sheets.values(priceListId, 'A:E')
      const descriptionColumn = header.findIndex(
        (value) => value.trim().toLowerCase() === 'description'
      )
      const retailPriceColumn = header.findIndex((value) =>
        ['retail', 'retail price'].includes(value.trim().toLowerCase())
      )
      const costPriceColumn = header.findIndex((value) =>
        ['cost', 'cost price'].includes(value.trim().toLowerCase())
      )
      if (descriptionColumn < 0 || retailPriceColumn < 0 || costPriceColumn < 0)
        throw new Error('The product price list is missing Description, Retail Price, or Cost Price columns.')

      const rows = records.flatMap((record) => {
        const description = record[descriptionColumn]?.trim()
        const retailPriceCentavos = centavos(record[retailPriceColumn])
        const costPriceCentavos = centavos(record[costPriceColumn])
        return description &&
          description.length <= 300 &&
          retailPriceCentavos !== undefined &&
          costPriceCentavos !== undefined
          ? [{ description, retailPriceCentavos, costPriceCentavos }]
          : []
      })
      const items = Array.from(new Map(rows.map((item) => [item.description, item])).values())
      if (items.length) this.repository.replace(items)
    } catch {
      // The last successful import remains usable while the price list is offline.
    }
    return { rows: this.repository.list() }
  }
}
