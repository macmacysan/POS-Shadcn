import { randomUUID } from 'node:crypto'

import type { AppDatabase } from './database'

export function recordGcashDrawing(
  db: AppDatabase,
  input: { branchId: string; businessDate: string; amountCentavos: number; actorUserId: string; reference: string; description: string; receiptNo?: string }
): void {
  if (input.amountCentavos <= 0) return
  const now = new Date().toISOString()
  let report = db.prepare('SELECT id FROM daily_reports WHERE branch_id = ? AND business_date = ?').get(input.branchId, input.businessDate) as { id: string } | undefined
  if (!report) {
    const id = randomUUID()
    db.prepare(`INSERT INTO daily_reports (id, branch_id, cashier_user_id, business_date, opening_cash_centavos, updated_by_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?, ?)`)
      .run(id, input.branchId, input.actorUserId, input.businessDate, input.actorUserId, now, now)
    report = { id }
  }
  db.prepare(`INSERT OR IGNORE INTO reports (id, branch_id, cashier_id, business_date, status, created_at, updated_at)
    SELECT id, branch_id, cashier_user_id, business_date, 'Draft', created_at, updated_at
      FROM daily_reports WHERE id = ?`).run(report.id)
  db.prepare(`INSERT INTO expenses (id, report_id, type, description, category, receipt_no, source_reference, vat, amount_centavos, created_by_user_id, created_at, updated_at)
    VALUES (?, ?, 'Drawings', ?, 'Others', ?, ?, '', ?, ?, ?, ?)
    ON CONFLICT(source_reference) DO UPDATE SET report_id = excluded.report_id, description = excluded.description,
      receipt_no = excluded.receipt_no, amount_centavos = excluded.amount_centavos, updated_at = excluded.updated_at`)
    .run(randomUUID(), report.id, input.description, input.receiptNo ?? '', input.reference, input.amountCentavos, input.actorUserId, now, now)
}
