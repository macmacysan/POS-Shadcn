import type { ProductCatalogItem } from '../../shared/contracts'
import type { AppDatabase } from './database'

type Row = { description: string; retail_price_centavos: number; cost_price_centavos: number | null }

export class ProductCatalogRepository {
  constructor(private readonly db: AppDatabase) {}

  list(): ProductCatalogItem[] {
    return (
      this.db
        .prepare(
          'SELECT description, retail_price_centavos, cost_price_centavos FROM product_catalog_items ORDER BY description'
        )
        .all() as Row[]
    ).map((row) => ({
      description: row.description,
      retailPriceCentavos: row.retail_price_centavos,
      ...(row.cost_price_centavos === null ? {} : { costPriceCentavos: row.cost_price_centavos })
    }))
  }

  replace(items: readonly ProductCatalogItem[]): void {
    const now = new Date().toISOString()
    const write = this.db.transaction(() => {
      this.db.prepare('DELETE FROM product_catalog_items').run()
      const insert = this.db.prepare(
        'INSERT INTO product_catalog_items (description, retail_price_centavos, cost_price_centavos, imported_at) VALUES (?, ?, ?, ?)'
      )
      for (const item of items)
        insert.run(item.description, item.retailPriceCentavos, item.costPriceCentavos ?? null, now)
    })
    write()
  }
}
