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
  `)
  db.prepare("INSERT INTO branches VALUES ('tin', 'Tinambac'), ('goa', 'Goa')").run()
  db.prepare("INSERT INTO daily_reports VALUES ('aug', 'tin', '2026-08-28', 'DRAFT'), ('jul', 'tin', '2026-07-12', 'DRAFT'), ('old', 'tin', '2025-01-10', 'DRAFT'), ('void', 'tin', '2026-08-27', 'VOIDED'), ('other', 'goa', '2026-08-28', 'DRAFT')").run()
  db.prepare("INSERT INTO daily_receipt_totals VALUES ('aug', 15000), ('jul', 3000), ('old', 2000), ('void', 9999), ('other', 7000)").run()
  db.prepare("INSERT INTO expenses VALUES ('aug', 4000, 'POSTED'), ('jul', 1000, 'POSTED'), ('aug', 500, 'VOIDED')").run()

  const charts = new DashboardRepository(db).getPdfCharts('2026-08-28', {
    branch: 'Tinambac',
    label: 'Tinambac Branch'
  })
  assert.equal(charts.weeklySales.length, 7)
  assert.equal(charts.weeklySales.at(-1)?.salesCentavos, 15000)
  assert.equal(charts.monthlySales.length, 12)
  assert.deepEqual(charts.expensesVsSales.at(-1), {
    month: '2026-08',
    salesCentavos: 15000,
    expenseCentavos: 4000
  })
  assert.deepEqual(charts.yearlySales, [
    { year: '2025', salesCentavos: 2000 },
    { year: '2026', salesCentavos: 18000 }
  ])
  db.close()
  console.log('pdf report chart tests passed')
} finally {
  if (existsSync(output)) rmSync(output, { recursive: true, force: true })
}
