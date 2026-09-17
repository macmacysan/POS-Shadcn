import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const output = resolve(root, '.pdf-report-charts-test-build')
const require = createRequire(import.meta.url)

try {
  execFileSync(
    process.execPath,
    [
      resolve(root, 'node_modules/typescript/bin/tsc'),
      '--target',
      'ES2022',
      '--module',
      'commonjs',
      '--esModuleInterop',
      '--skipLibCheck',
      '--rootDir',
      resolve(root, 'src'),
      '--outDir',
      output,
      resolve(root, 'src/main/database/dashboard-repository.ts')
    ],
    { stdio: 'inherit' }
  )

  const Database = require('better-sqlite3')
  const { DashboardRepository } = require(resolve(output, 'main/database/dashboard-repository.js'))
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE branches (id TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE daily_reports (id TEXT PRIMARY KEY, branch_id TEXT NOT NULL, business_date TEXT NOT NULL, status TEXT NOT NULL);
    CREATE TABLE daily_receipt_totals (daily_report_id TEXT NOT NULL, amount_centavos INTEGER NOT NULL);
    CREATE TABLE expenses (report_id TEXT NOT NULL, amount_centavos INTEGER NOT NULL, status TEXT NOT NULL);
    CREATE TABLE in_house_schedules (id TEXT PRIMARY KEY, contract_id TEXT NOT NULL, due_date TEXT NOT NULL, due_amount_centavos INTEGER NOT NULL);
    CREATE TABLE installment_contracts (id TEXT PRIMARY KEY, account_id TEXT NOT NULL, branch_id TEXT NOT NULL, status TEXT NOT NULL);
    CREATE TABLE accounts (id TEXT PRIMARY KEY, is_active INTEGER NOT NULL);
    CREATE TABLE installment_payment_allocations (schedule_id TEXT NOT NULL, payment_id TEXT NOT NULL, allocated_amount_centavos INTEGER NOT NULL);
    CREATE TABLE in_house_payments (id TEXT PRIMARY KEY, status TEXT NOT NULL, payment_date TEXT NOT NULL);
  `)
  db.prepare("INSERT INTO branches VALUES ('tin', 'Tinambac'), ('goa', 'Goa')").run()
  db.prepare(
    "INSERT INTO daily_reports VALUES ('aug', 'tin', '2026-08-28', 'DRAFT'), ('jul', 'tin', '2026-07-12', 'DRAFT'), ('old', 'tin', '2025-01-10', 'DRAFT'), ('void', 'tin', '2026-08-27', 'VOIDED'), ('other', 'goa', '2026-08-28', 'DRAFT')"
  ).run()
  db.prepare(
    "INSERT INTO daily_receipt_totals VALUES ('aug', 15000), ('jul', 3000), ('old', 2000), ('void', 9999), ('other', 7000)"
  ).run()
  db.prepare(
    "INSERT INTO expenses VALUES ('aug', 4000, 'POSTED'), ('jul', 1000, 'POSTED'), ('aug', 500, 'VOIDED')"
  ).run()

  const charts = new DashboardRepository(db).getPdfCharts('2026-08-28', {
    branch: 'Tinambac',
    label: 'Tinambac Branch'
  })
  assert.equal(charts.weeklyCashReceipts.length, 7)
  assert.equal(charts.weeklyCashReceipts.at(-1)?.cashReceiptsCentavos, 15000)
  assert.equal(charts.monthlyCashFlow.length, 12)
  assert.deepEqual(charts.monthlyCashFlow.at(-1), {
    month: '2026-08',
    cashReceiptsCentavos: 15000,
    expenseCentavos: 4000,
    operatingResultCentavos: 11000
  })
  assert.equal(charts.currentMonthCashReceiptsCentavos, 15000)
  assert.equal(charts.currentMonthExpenseCentavos, 4000)
  assert.equal(charts.currentMonthOperatingResultCentavos, 11000)
  assert.equal(charts.overdueAccountCount, 0)
  assert.equal(charts.overdueOutstandingCentavos, 0)
  const allBranchCharts = new DashboardRepository(db).getPdfCharts('2026-08-28', {
    label: 'All branches'
  })
  assert.equal(allBranchCharts.currentMonthCashReceiptsCentavos, 22000)
  db.prepare("INSERT INTO accounts VALUES ('account', 1)").run()
  db.prepare(
    "INSERT INTO installment_contracts VALUES ('contract', 'account', 'tin', 'ACTIVE')"
  ).run()
  db.prepare(
    "INSERT INTO in_house_schedules VALUES ('schedule', 'contract', '2026-08-01', 9000)"
  ).run()
  const chartsWithOverdue = new DashboardRepository(db).getPdfCharts('2026-08-28', {
    branch: 'Tinambac',
    label: 'Tinambac Branch'
  })
  assert.equal(chartsWithOverdue.overdueAccountCount, 1)
  assert.equal(chartsWithOverdue.overdueOutstandingCentavos, 9000)
  db.close()
  console.log('pdf report chart tests passed')
} finally {
  if (existsSync(output)) rmSync(output, { recursive: true, force: true })
}
