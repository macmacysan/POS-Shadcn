import { z } from 'zod'

export const catalogOptionKinds = [
  'CASHIER_EXPENSE_TYPE',
  'CASHIER_PAYMENT_TYPE',
  'IN_HOUSE_AGENT',
  'IN_HOUSE_LOAN_TERM',
  'FINANCE_TYPE',
  'FINANCE_TERM'
] as const

export const catalogOptionKindSchema = z.enum(catalogOptionKinds)
const idSchema = z.string().uuid()
const valueSchema = z.string().trim().min(1).max(200)

export const catalogOptionRecordSchema = z.object({
  id: idSchema,
  kind: catalogOptionKindSchema,
  value: valueSchema,
  referenceId: z.string().uuid().nullable(),
  isActive: z.boolean()
})
export const catalogOptionCreateRequestSchema = z.object({
  kind: catalogOptionKindSchema,
  value: valueSchema
})
export const catalogOptionRenameRequestSchema = z.object({ id: idSchema, value: valueSchema })
export const catalogOptionIdRequestSchema = z.object({ id: idSchema })
export const catalogOptionListRequestSchema = z.object({
  kind: catalogOptionKindSchema.optional(),
  activeOnly: z.boolean().optional()
})

export type CatalogOptionKind = z.infer<typeof catalogOptionKindSchema>
export type CatalogOptionRecord = z.infer<typeof catalogOptionRecordSchema>
export type CatalogOptionCreateRequest = z.infer<typeof catalogOptionCreateRequestSchema>
export type CatalogOptionRenameRequest = z.infer<typeof catalogOptionRenameRequestSchema>
export type CatalogOptionIdRequest = z.infer<typeof catalogOptionIdRequestSchema>
export type CatalogOptionListRequest = z.infer<typeof catalogOptionListRequestSchema>

export const catalogOptionIpcChannels = {
  list: 'catalog-options:list',
  create: 'catalog-options:create',
  rename: 'catalog-options:rename',
  retire: 'catalog-options:retire',
  restore: 'catalog-options:restore'
} as const

export type CatalogOptionsApi = {
  catalogOptions: {
    list(request?: CatalogOptionListRequest): Promise<{ rows: CatalogOptionRecord[] }>
    create(request: CatalogOptionCreateRequest): Promise<CatalogOptionRecord>
    rename(request: CatalogOptionRenameRequest): Promise<CatalogOptionRecord>
    retire(request: CatalogOptionIdRequest): Promise<void>
    restore(request: CatalogOptionIdRequest): Promise<CatalogOptionRecord>
  }
}
