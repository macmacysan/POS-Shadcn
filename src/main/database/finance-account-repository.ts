import { randomUUID } from 'node:crypto'

import { calculateFinanceAmounts } from '../../shared/finance-calculations'
import type {
  FinanceAccountCreateRequest,
  FinanceAccountListRequest,
  FinanceAccountListResult,
  FinanceAccountRecord,
  FinanceAccountUpdateRequest,
  FinanceItemRecord
} from '../../shared/contracts'
import { AppError } from './errors'
import type { AppDatabase } from './database'

type FinanceRow = {
  id: string
  branch: FinanceAccountRecord['branch']
  provider: FinanceAccountRecord['provider']
  date_released: string
  terms_months: number
  last_name: string
  first_name: string
  middle_name: string | null
  suffix: string | null
  downpayment_centavos: number
  grand_total_centavos: number
  balance_centavos: number
  or_number: string | null
  or_date: string | null
  paid_date: string | null
  remarks: string | null
  created_at: string
  updated_at: string
}

export class FinanceAccountRepository {
  constructor(private readonly db: AppDatabase) {}

  list(request: FinanceAccountListRequest): FinanceAccountListResult {
    const query = request.search.trim()
    const rows = this.db
      .prepare(
        `SELECT DISTINCT f.* FROM finance_accounts f
          LEFT JOIN finance_account_items i ON i.finance_account_id = f.id
          WHERE (? = '' OR lower(f.branch || ' ' || f.provider || ' ' || f.last_name || ' ' || f.first_name || ' ' || COALESCE(f.or_number, '') || ' ' || COALESCE(f.remarks, '') || ' ' || COALESCE(i.item, '') || ' ' || COALESCE(i.serial_no, '')) LIKE '%' || lower(?) || '%')
            AND (? IS NULL OR f.branch = ?)
          ORDER BY f.date_released DESC, f.created_at DESC, f.id DESC`
      )
      .all(query, query, request.branch ?? null, request.branch ?? null) as FinanceRow[]
    return { rows: rows.map((row) => this.toRecord(row)) }
  }

  create(request: FinanceAccountCreateRequest): FinanceAccountRecord {
    const id = randomUUID()
    const now = new Date().toISOString()
    this.write(id, request, now, now)
    return this.getById(id)
  }

  update(request: FinanceAccountUpdateRequest): FinanceAccountRecord {
    this.getById(request.id)
    this.write(request.id, request, undefined, new Date().toISOString())
    return this.getById(request.id)
  }

  delete(ids: readonly string[]): void {
    const remove = this.db.transaction(() => {
      for (const id of ids) this.getById(id)
      const placeholders = ids.map(() => '?').join(', ')
      this.db
        .prepare(`DELETE FROM finance_account_items WHERE finance_account_id IN (${placeholders})`)
        .run(...ids)
      this.db.prepare(`DELETE FROM finance_accounts WHERE id IN (${placeholders})`).run(...ids)
    })
    remove()
  }

  private write(
    id: string,
    request: FinanceAccountCreateRequest | FinanceAccountUpdateRequest,
    createdAt: string | undefined,
    updatedAt: string
  ): void {
    const amounts = calculateFinanceAmounts(request.items, request.downpaymentCentavos)
    const firstItem = request.items[0]
    const save = this.db.transaction(() => {
      if (createdAt) {
        this.db
          .prepare(
            `INSERT INTO finance_accounts (
              id, branch, provider, date_released, terms_months, last_name, first_name, middle_name,
              suffix, quantity, item, serial_no, item_price_centavos, grand_total_centavos,
              downpayment_centavos, balance_centavos, or_number, or_date, paid_date, remarks,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            id,
            request.branch,
            request.provider,
            request.dateReleased,
            request.termsMonths,
            request.lastName,
            request.firstName,
            request.middleName || null,
            request.suffix || null,
            firstItem.quantity,
            firstItem.item,
            firstItem.serialNo || null,
            firstItem.itemPriceCentavos,
            amounts.grandTotalCentavos,
            request.downpaymentCentavos,
            amounts.balanceCentavos,
            request.orNumber || null,
            request.orDate || null,
            request.paidDate || null,
            request.remarks || null,
            createdAt,
            updatedAt
          )
      } else {
        this.db
          .prepare(
            `UPDATE finance_accounts SET
              branch = ?, provider = ?, date_released = ?, terms_months = ?, last_name = ?, first_name = ?,
              middle_name = ?, suffix = ?, quantity = ?, item = ?, serial_no = ?, item_price_centavos = ?,
              grand_total_centavos = ?, downpayment_centavos = ?, balance_centavos = ?, or_number = ?,
              or_date = ?, paid_date = ?, remarks = ?, updated_at = ? WHERE id = ?`
          )
          .run(
            request.branch,
            request.provider,
            request.dateReleased,
            request.termsMonths,
            request.lastName,
            request.firstName,
            request.middleName || null,
            request.suffix || null,
            firstItem.quantity,
            firstItem.item,
            firstItem.serialNo || null,
            firstItem.itemPriceCentavos,
            amounts.grandTotalCentavos,
            request.downpaymentCentavos,
            amounts.balanceCentavos,
            request.orNumber || null,
            request.orDate || null,
            request.paidDate || null,
            request.remarks || null,
            updatedAt,
            id
          )
        this.db.prepare('DELETE FROM finance_account_items WHERE finance_account_id = ?').run(id)
      }
      const insertItem = this.db.prepare(
        `INSERT INTO finance_account_items (
          id, finance_account_id, sort_order, item, serial_no, quantity, item_price_centavos,
          total_centavos, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      request.items.forEach((item, index) => {
        insertItem.run(
          randomUUID(),
          id,
          index,
          item.item,
          item.serialNo || null,
          item.quantity,
          item.itemPriceCentavos,
          item.quantity * item.itemPriceCentavos,
          updatedAt,
          updatedAt
        )
      })
    })
    save()
  }

  private getById(id: string): FinanceAccountRecord {
    const row = this.db.prepare('SELECT * FROM finance_accounts WHERE id = ?').get(id) as
      FinanceRow | undefined
    if (!row) throw new AppError('NOT_FOUND', 'Finance account was not found.')
    return this.toRecord(row)
  }

  private toRecord(row: FinanceRow): FinanceAccountRecord {
    const items = this.db
      .prepare(
        `SELECT id, item, serial_no, quantity, item_price_centavos, total_centavos
           FROM finance_account_items WHERE finance_account_id = ? ORDER BY sort_order`
      )
      .all(row.id) as Array<{
      id: string
      item: string
      serial_no: string | null
      quantity: number
      item_price_centavos: number
      total_centavos: number
    }>
    return {
      id: row.id,
      branch: row.branch,
      provider: row.provider,
      dateReleased: row.date_released,
      termsMonths: row.terms_months,
      lastName: row.last_name,
      firstName: row.first_name,
      middleName: row.middle_name ?? undefined,
      suffix: row.suffix ?? undefined,
      items: items.map((item): FinanceItemRecord => ({
        id: item.id,
        item: item.item,
        serialNo: item.serial_no ?? undefined,
        quantity: item.quantity,
        itemPriceCentavos: item.item_price_centavos,
        totalCentavos: item.total_centavos
      })),
      grandTotalCentavos: row.grand_total_centavos,
      downpaymentCentavos: row.downpayment_centavos,
      balanceCentavos: row.balance_centavos,
      orNumber: row.or_number ?? undefined,
      orDate: row.or_date ?? undefined,
      paidDate: row.paid_date ?? undefined,
      remarks: row.remarks ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }
}
