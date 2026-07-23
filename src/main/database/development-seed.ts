import type Database from 'better-sqlite3'

import { developmentReportId } from '../../shared/contracts'

const developmentDate = '2026-07-14'
const developmentTimestamp = '2026-07-14T08:00:00.000Z'

export function seedDevelopmentData(db: Database.Database): void {
  const report = db.prepare('SELECT id FROM reports WHERE id = ?').get(developmentReportId)
  if (report) return

  const insertReport = db.prepare(`
    INSERT INTO reports (
      id, branch_id, cashier_id, business_date, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  const insertExpense = db.prepare(`
    INSERT INTO expenses (
      id, report_id, type, description, category, receipt_no, vat,
      amount_centavos, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const seed = db.transaction(() => {
    insertReport.run(
      developmentReportId,
      'development-lagonoy',
      'development-cashier',
      developmentDate,
      'Draft',
      developmentTimestamp,
      developmentTimestamp
    )

    for (let index = 0; index < 105; index += 1) {
      const type = index % 3 === 0 ? 'Operating' : index % 3 === 1 ? 'Supply' : 'Transport'
      const category =
        index % 3 === 0
          ? 'Office Expenses and Supplies'
          : index % 3 === 1
            ? 'Freight, Postage and Shipping'
            : 'Utilities'
      const amountCentavos = (350 + index * 25) * 100

      insertExpense.run(
        `expense-${index + 1}`,
        developmentReportId,
        type,
        [
          'Printer paper, toner, and office supplies',
          'Fuel and tolls for customer deliveries',
          'Monthly electricity and water bill'
        ][index % 3],
        category,
        `EXP-${String(index + 1).padStart(4, '0')}`,
        index % 3 === 0 ? 'VAT' : index % 3 === 1 ? 'Non-VAT' : '',
        amountCentavos,
        developmentTimestamp,
        developmentTimestamp
      )
    }
  })

  seed()
}
