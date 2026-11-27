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
    if (request.kind === 'CASHIER_PAYMENT_TYPE' || request.paymentContext) {
      const context = request.paymentContext ?? 'CASHIER_REPORT'
      const rows = this.db
        .prepare(
          `SELECT m.id, COALESCE(c.display_name, m.name) AS value, m.id AS reference_id, c.is_active
             FROM payment_methods m
             JOIN payment_method_contexts c ON c.payment_method_id = m.id
            WHERE c.context = ? ${request.activeOnly ? 'AND c.is_active = 1' : ''}
            ORDER BY m.name`
        )
        .all(context) as Row[]
      return rows.map((row) => record({ ...row, kind: 'CASHIER_PAYMENT_TYPE' }))
    }
    if (!request.kind) {
      return [
        ...this.list({ ...request, kind: 'CASHIER_PAYMENT_TYPE' }),
        ...this.list({ ...request, kind: 'CASHIER_EXPENSE_TYPE' }),
        ...this.list({ ...request, kind: 'IN_HOUSE_AGENT' }),
        ...this.list({ ...request, kind: 'IN_HOUSE_LOAN_TERM' }),
        ...this.list({ ...request, kind: 'FINANCE_TYPE' }),
        ...this.list({ ...request, kind: 'FINANCE_TERM' })
      ]
    }
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
    if (request.kind === 'CASHIER_PAYMENT_TYPE') {
      const id = randomUUID()
      try {
        this.db.transaction(() => {
          this.db
            .prepare(
              'INSERT INTO payment_methods (id, code, name, is_active, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)'
            )
            .run(id, `CUSTOM_${id.replaceAll('-', '').toUpperCase()}`, value, now, now)
          this.db
            .prepare(
              'INSERT INTO payment_method_contexts (payment_method_id, context, is_active) VALUES (?, ?, 1)'
            )
            .run(id, 'CASHIER_REPORT')
        })()
      } catch {
        throw new AppError('CONFLICT', 'That payment method already exists.')
      }
      return { id, kind: request.kind, value, referenceId: id, isActive: true }
    }
    const referenceId = null
    try {
      const insert = this.db.transaction(() => {
        if (referenceId)
          this.db
            .prepare(
              `INSERT INTO payment_methods (id, code, name, is_active, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)`
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
    if (current.kind === 'CASHIER_PAYMENT_TYPE') {
      try {
        this.db
          .prepare(
            "UPDATE payment_method_contexts SET display_name = ? WHERE payment_method_id = ? AND context = 'CASHIER_REPORT'"
          )
          .run(value, current.id)
      } catch {
        throw new AppError('CONFLICT', 'That payment method name already exists.')
      }
      return { ...current, value }
    }
    try {
      const updated = this.db.transaction(() => {
        if (current.referenceId)
          this.db
            .prepare('UPDATE payment_methods SET name = ?, updated_at = ? WHERE id = ?')
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
    if (current.kind === 'CASHIER_PAYMENT_TYPE') {
      const result = this.db
        .prepare(
          'UPDATE payment_method_contexts SET is_active = ? WHERE payment_method_id = ? AND context = ? AND is_active = ?'
        )
        .run(active ? 1 : 0, id, 'CASHIER_REPORT', active ? 0 : 1)
      if (!result.changes)
        throw new AppError(
          'CONFLICT',
          active ? 'Option is already active.' : 'Option is already retired.'
        )
      return
    }
    const changed = this.db.transaction(() => {
      if (current.referenceId)
        this.db
          .prepare('UPDATE payment_methods SET is_active = ?, updated_at = ? WHERE id = ?')
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
    if (!row) {
      const payment = this.db
        .prepare(
          `SELECT m.id, COALESCE(c.display_name, m.name) AS value, m.id AS reference_id, c.is_active
           FROM payment_methods m JOIN payment_method_contexts c ON c.payment_method_id = m.id
          WHERE m.id = ? AND c.context = 'CASHIER_REPORT'`
        )
        .get(id) as Row | undefined
      if (payment)
        return {
          ...record({ ...payment, kind: 'CASHIER_PAYMENT_TYPE' }),
          isActive: payment.is_active === 1
        }
      throw new AppError('NOT_FOUND', 'Catalog option was not found.')
    }
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
