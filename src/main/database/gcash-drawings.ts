import { randomUUID } from 'node:crypto'

import type { AppDatabase } from './database'

export function recordGcashDrawing(
  db: AppDatabase,
  input: { branchId: string; businessDate: string; amountCentavos: number; actorUserId: string; reference: string; description: string }
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
  const exists = db.prepare('SELECT 1 FROM expenses WHERE report_id = ? AND receipt_no = ?').get(report.id, input.reference)
  if (exists) return
  db.prepare(`INSERT INTO expenses (id, report_id, type, description, category, receipt_no, vat, amount_centavos, created_by_user_id, created_at, updated_at) VALUES (?, ?, 'Drawings', ?, 'Others', ?, '', ?, ?, ?, ?)`)
    .run(randomUUID(), report.id, input.description, input.reference, input.amountCentavos, input.actorUserId, now, now)
}
