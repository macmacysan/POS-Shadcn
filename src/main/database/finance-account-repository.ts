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
import { recordAudit } from './audit-repository'

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
  status: 'POSTED' | 'VOIDED'
  voided_at: string | null
  voided_by_user_id: string | null
  void_reason: string | null
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
            AND (? = 1 OR f.status = 'POSTED')
          ORDER BY f.date_released DESC, f.created_at DESC, f.id DESC`
      )
      .all(
        query,
        query,
        request.branch ?? null,
        request.branch ?? null,
        request.includeVoided ? 1 : 0
      ) as FinanceRow[]
    return { rows: rows.map((row) => this.toRecord(row)) }
  }

  listGoogleCache(): FinanceAccountListResult {
    const rows = this.db
      .prepare("SELECT payload_json FROM google_sheet_branch_cache WHERE sheet_name = 'Finance'")
      .all() as Array<{ payload_json: string }>
    const cached = rows.flatMap(({ payload_json }) => {
      try {
        const row = JSON.parse(payload_json) as Record<string, string>
        const items = JSON.parse(row.items || '[]') as Array<Record<string, unknown>>
        if (!row.id || !row.branch || !row.provider || !row.dateReleased || !row.lastName || !row.firstName)
          return []
        return [
          {
            id: row.id,
            branch: row.branch as FinanceAccountRecord['branch'],
            provider: row.provider,
            dateReleased: row.dateReleased,
            termsMonths: Number(row.termsMonths) || 0,
            lastName: row.lastName,
            firstName: row.firstName,
            middleName: row.middleName || undefined,
            suffix: row.suffix || undefined,
            items: items.flatMap((item, index) => {
              if (typeof item.item !== 'string' || !Number.isFinite(Number(item.quantity))) return []
              const quantity = Number(item.quantity)
              const itemPriceCentavos = Number(item.itemPriceCentavos) || 0
              return [{ id: String(item.id || `${row.id}-item-${index}`), item: item.item, serialNo: typeof item.serialNo === 'string' ? item.serialNo : undefined, quantity, itemPriceCentavos, totalCentavos: Number(item.totalCentavos) || quantity * itemPriceCentavos }]
            }),
            grandTotalCentavos: Number(row.grandTotalCentavos) || 0,
            downpaymentCentavos: Number(row.downpaymentCentavos) || 0,
            balanceCentavos: Number(row.balanceCentavos) || 0,
            orNumber: row.orNumber || undefined,
            orDate: row.orDate || undefined,
            paidDate: row.paidDate || undefined,
            remarks: row.remarks || undefined,
            createdAt: row.createdAt || '',
            updatedAt: row.updatedAt || '',
            status: row.status === 'VOIDED' ? 'VOIDED' : 'POSTED',
            voidedAt: row.voidedAt || null,
            voidedByUserId: row.voidedByUserId || null,
            voidReason: row.voidReason || null
          } satisfies FinanceAccountRecord
        ]
      } catch {
        return []
      }
    })
    return { rows: cached }
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

  void(ids: readonly string[], actorUserId: string, reason: string): void {
    const run = this.db.transaction(() => {
      const now = new Date().toISOString()
      for (const id of ids) {
        const before = this.getById(id)
        const result = this.db
          .prepare(
            `UPDATE finance_accounts SET status = 'VOIDED', voided_at = ?, voided_by_user_id = ?, void_reason = ?, updated_at = ? WHERE id = ? AND status = 'POSTED'`
          )
          .run(now, actorUserId, reason, now, id)
        if (result.changes === 0)
          throw new AppError('CONFLICT', 'Finance account was already voided.')
        recordAudit(this.db, {
          actorUserId,
          entityType: 'finance_account' as never,
          entityId: id,
          action: 'VOIDED' as never,
          reason,
          changes: [{ field: 'status', oldValue: before.status, newValue: 'VOIDED' }]
        })
      }
    })
    run()
  }

  unvoid(ids: readonly string[], actorUserId: string): void {
    const run = this.db.transaction(() => {
      const now = new Date().toISOString()
      for (const id of ids) {
        const before = this.getById(id)
        if (before.status !== 'VOIDED')
          throw new AppError('CONFLICT', 'Finance account is not voided.')
        this.db
          .prepare(
            `UPDATE finance_accounts SET status = 'POSTED', voided_at = NULL, voided_by_user_id = NULL, void_reason = NULL, updated_at = ? WHERE id = ?`
          )
          .run(now, id)
        recordAudit(this.db, {
          actorUserId,
          entityType: 'finance_account' as never,
          entityId: id,
          action: 'UPDATED' as never,
          changes: [{ field: 'status', oldValue: 'VOIDED', newValue: 'POSTED' }]
        })
      }
    })
    run()
  }

  transfer(
    id: string,
    branch: FinanceAccountRecord['branch'],
    actorUserId: string,
    reason: string
  ): FinanceAccountRecord {
    const transfer = this.db.transaction(() => {
      const current = this.db
        .prepare('SELECT branch FROM finance_accounts WHERE id = ?')
        .get(id) as { branch: string } | undefined
      if (!current) throw new AppError('NOT_FOUND', 'Finance account was not found.')
      if (current.branch === branch)
        throw new AppError('CONFLICT', 'Finance account already belongs to that branch.')
      this.db
        .prepare('UPDATE finance_accounts SET branch = ?, updated_at = ? WHERE id = ?')
        .run(branch, new Date().toISOString(), id)
      recordAudit(this.db, {
        actorUserId,
        entityType: 'finance_account' as never,
        entityId: id,
        action: 'UPDATED' as never,
        reason,
        changes: [{ field: 'branch', oldValue: current.branch, newValue: branch }]
      })
    })
    transfer()
    return this.getById(id)
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
      updatedAt: row.updated_at,
      status: row.status,
      voidedAt: row.voided_at,
      voidedByUserId: row.voided_by_user_id,
      voidReason: row.void_reason
    }
  }
}
