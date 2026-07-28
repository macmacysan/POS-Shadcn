import { randomUUID } from 'node:crypto'

import { calculateFinanceAmounts } from '../../shared/finance-calculations'
import type {
  FinanceAccountCreateRequest,
  FinanceAccountListRequest,
  FinanceAccountListResult,
  FinanceAccountRecord,
  FinanceAccountUpdateRequest
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
  quantity: number
  item: string
  serial_no: string | null
  item_price_centavos: number
  grand_total_centavos: number
  downpayment_centavos: number
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
        `SELECT * FROM finance_accounts
          WHERE (? = '' OR lower(branch || ' ' || provider || ' ' || last_name || ' ' || first_name || ' ' || item || ' ' || COALESCE(serial_no, '') || ' ' || COALESCE(or_number, '') || ' ' || COALESCE(remarks, '')) LIKE '%' || lower(?) || '%')
            AND (? IS NULL OR branch = ?)
          ORDER BY date_released DESC, created_at DESC, id DESC`
      )
      .all(query, query, request.branch ?? null, request.branch ?? null) as FinanceRow[]
    return { rows: rows.map((row) => this.toRecord(row)) }
  }

  create(request: FinanceAccountCreateRequest): FinanceAccountRecord {
    const id = randomUUID()
    const now = new Date().toISOString()
    const amounts = calculateFinanceAmounts(
      request.quantity,
      request.itemPriceCentavos,
      request.downpaymentCentavos
    )
    this.write(id, request, amounts, now, now)
    return this.getById(id)
  }

  update(request: FinanceAccountUpdateRequest): FinanceAccountRecord {
    this.getById(request.id)
    const now = new Date().toISOString()
    const amounts = calculateFinanceAmounts(
      request.quantity,
      request.itemPriceCentavos,
      request.downpaymentCentavos
    )
    this.write(request.id, request, amounts, undefined, now)
    return this.getById(request.id)
  }

  private write(
    id: string,
    request: FinanceAccountCreateRequest | FinanceAccountUpdateRequest,
    amounts: ReturnType<typeof calculateFinanceAmounts>,
    createdAt: string | undefined,
    updatedAt: string
  ): void {
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
          request.quantity,
          request.item,
          request.serialNo || null,
          request.itemPriceCentavos,
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
      return
    }
    this.db
      .prepare(
        `UPDATE finance_accounts SET
          branch = ?, provider = ?, date_released = ?, terms_months = ?, last_name = ?, first_name = ?,
          middle_name = ?, suffix = ?, quantity = ?, item = ?, serial_no = ?, item_price_centavos = ?,
          grand_total_centavos = ?, downpayment_centavos = ?, balance_centavos = ?, or_number = ?,
          or_date = ?, paid_date = ?, remarks = ?, updated_at = ?
        WHERE id = ?`
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
        request.quantity,
        request.item,
        request.serialNo || null,
        request.itemPriceCentavos,
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
  }

  private getById(id: string): FinanceAccountRecord {
    const row = this.db.prepare('SELECT * FROM finance_accounts WHERE id = ?').get(id) as
      FinanceRow | undefined
    if (!row) throw new AppError('NOT_FOUND', 'Finance account was not found.')
    return this.toRecord(row)
  }

  private toRecord(row: FinanceRow): FinanceAccountRecord {
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
      quantity: row.quantity,
      item: row.item,
      serialNo: row.serial_no ?? undefined,
      itemPriceCentavos: row.item_price_centavos,
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
