export type ProductCatalogItem = {
  description: string
  retailPriceCentavos: number
  costPriceCentavos?: number
}

export const productCatalogIpcChannels = {
  list: 'product-catalog:list'
} as const

export type ProductCatalogApi = {
  productCatalog: {
    list(): Promise<{ rows: ProductCatalogItem[] }>
  }
}
