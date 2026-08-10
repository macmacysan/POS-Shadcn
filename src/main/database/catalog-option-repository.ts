import { randomUUID } from 'crypto'

import type {
  CatalogOptionCreateRequest,
  CatalogOptionIdRequest,
  CatalogOptionListRequest,
  CatalogOptionRecord,
  CatalogOptionRenameRequest
} from '../../shared/contracts'
import { AppError } from './errors'
import type { AppDatabase } from './database'

type Row = {
  id: string
  kind: CatalogOptionRecord['kind']
  value: string
  reference_id: string | null
  is_active: number
}

const record = (row: Row): CatalogOptionRecord => ({
  id: row.id,
  kind: row.kind,
  value: row.value,
  referenceId: row.reference_id,
  isActive: row.is_active === 1
})

export class CatalogOptionRepository {
  constructor(private readonly db: AppDatabase) {}

  list(request: CatalogOptionListRequest = {}): CatalogOptionRecord[] {
    const clauses: string[] = []
    const values: unknown[] = []
    if (request.kind) {
      clauses.push('kind = ?')
      values.push(request.kind)
    }
    if (request.activeOnly) clauses.push('is_active = 1')
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    return (
      this.db
        .prepare(
          `SELECT id, kind, value, reference_id, is_active FROM catalog_options ${where} ORDER BY kind, value`
        )
        .all(...values) as Row[]
    ).map(record)
  }

  create(request: CatalogOptionCreateRequest): CatalogOptionRecord {
    const value = request.value.trim()
    this.validate(request.kind, value)
    const now = new Date().toISOString()
    const id = randomUUID()
    const referenceId = request.kind === 'CASHIER_PAYMENT_TYPE' ? randomUUID() : null
    try {
      const insert = this.db.transaction(() => {
        if (referenceId)
          this.db
            .prepare(
              `INSERT INTO report_payment_methods (id, code, name, is_active, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)`
            )
            .run(referenceId, `CUSTOM_${id}`, value, now, now)
        return this.db
          .prepare(
            `INSERT INTO catalog_options (id, kind, value, reference_id, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?) RETURNING id, kind, value, reference_id, is_active`
          )
          .get(id, request.kind, value, referenceId, now, now) as Row
      })()
      return record(insert)
    } catch {
      throw new AppError('CONFLICT', 'Restore the retired option instead.')
    }
  }

  rename(request: CatalogOptionRenameRequest): CatalogOptionRecord {
    const current = this.get(request.id)
    const value = request.value.trim()
    this.validate(current.kind, value)
    const now = new Date().toISOString()
    try {
      const updated = this.db.transaction(() => {
        if (current.referenceId)
          this.db
            .prepare('UPDATE report_payment_methods SET name = ?, updated_at = ? WHERE id = ?')
            .run(value, now, current.referenceId)
        return this.db
          .prepare(
            'UPDATE catalog_options SET value = ?, updated_at = ? WHERE id = ? RETURNING id, kind, value, reference_id, is_active'
          )
          .get(value, now, request.id) as Row
      })()
      return record(updated)
    } catch {
      throw new AppError('CONFLICT', 'That option already exists.')
    }
  }

  retire(request: CatalogOptionIdRequest): void {
    this.setActive(request.id, false)
  }
  restore(request: CatalogOptionIdRequest): CatalogOptionRecord {
    this.setActive(request.id, true)
    return this.get(request.id)
  }

  private setActive(id: string, active: boolean): void {
    const current = this.get(id)
    const changed = this.db.transaction(() => {
      if (current.referenceId)
        this.db
          .prepare('UPDATE report_payment_methods SET is_active = ?, updated_at = ? WHERE id = ?')
          .run(active ? 1 : 0, new Date().toISOString(), current.referenceId)
      return this.db
        .prepare(
          'UPDATE catalog_options SET is_active = ?, updated_at = ? WHERE id = ? AND is_active = ?'
        )
        .run(active ? 1 : 0, new Date().toISOString(), id, active ? 0 : 1)
    })()
    if (!changed.changes)
      throw new AppError(
        'CONFLICT',
        active ? 'Option is already active.' : 'Option is already retired.'
      )
  }

  private get(id: string): CatalogOptionRecord {
    const row = this.db
      .prepare('SELECT id, kind, value, reference_id, is_active FROM catalog_options WHERE id = ?')
      .get(id) as Row | undefined
    if (!row) throw new AppError('NOT_FOUND', 'Catalog option was not found.')
    return record(row)
  }

  private validate(kind: CatalogOptionRecord['kind'], value: string): void {
    if (
      (kind === 'FINANCE_TERM' || kind === 'IN_HOUSE_LOAN_TERM') &&
      (!/^\d+$/.test(value) ||
        Number(value) < 1 ||
        Number(value) > (kind === 'FINANCE_TERM' ? 24 : 12))
    )
      throw new AppError(
        'VALIDATION_ERROR',
        kind === 'FINANCE_TERM'
          ? 'Finance terms must be whole months from 1 to 24.'
          : 'Loan terms must be whole months from 1 to 12.'
      )
  }
}
