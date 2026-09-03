import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const output = resolve(root, '.installment-import-test-build')
const require = createRequire(import.meta.url)
try {
  execFileSync(process.execPath, [resolve(root, 'node_modules/typescript/bin/tsc'), '--target', 'ES2022', '--module', 'commonjs', '--esModuleInterop', '--skipLibCheck', '--rootDir', resolve(root, 'src'), '--outDir', output, resolve(root, 'src/main/database/migrations.ts'), resolve(root, 'src/main/services/installment-workbook-import-service.ts'), resolve(root, 'src/main/database/installment-repository.ts')], { stdio: 'inherit' })
  const Database = require('better-sqlite3')
  const { runMigrations } = require(resolve(output, 'main/database/migrations.js'))
  const { InstallmentWorkbookImportService } = require(resolve(output, 'main/services/installment-workbook-import-service.js'))
  const { InstallmentRepository } = require(resolve(output, 'main/database/installment-repository.js'))
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db)
  const importer = new InstallmentWorkbookImportService(db)
  const workbook = resolve(root, 'datasource/outputs/INSTALLMENT-corrected.xlsx')
  const first = importer.import(workbook)
  assert.equal(first.imported, true)
  const issueCounts = first.issues.reduce((counts, issue) => ({ ...counts, [issue.code]: (counts[issue.code] ?? 0) + 1 }), {})
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM accounts').get().count, 469)
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM installment_contracts').get().count, 253)
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM installment_items').get().count, 280)
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM in_house_payments').get().count, 2010)
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM installment_items i LEFT JOIN installment_contracts c ON c.id = i.contract_id WHERE c.id IS NULL').get().count, 0)
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM in_house_payments p LEFT JOIN installment_contracts c ON c.id = p.contract_id WHERE c.id IS NULL').get().count, 0)
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM installment_import_issues WHERE code = 'ACCOUNT_NOT_ON_ACCOUNTS_SHEET'").get().count, 325)
  assert.equal(issueCounts.ACCOUNT_NOT_ON_ACCOUNTS_SHEET, 325)
  assert.equal(issueCounts.DUPLICATE_LOAN_STATUS, 72)
  assert.equal(issueCounts.ORPHAN_ITEM_ROW, 6)
  assert.equal(issueCounts.ORPHAN_PAYMENT_ROW, 74)
  assert.equal(issueCounts.INVALID_PAYMENT_AMOUNT, 8)
  const paidContract = db.prepare("SELECT c.id, c.account_id FROM installment_contracts c JOIN in_house_payments p ON p.contract_id = c.id LIMIT 1").get()
  const record = new InstallmentRepository(db).list({ view: 'records', search: '' }).rows.find((row) => row.contractId === paidContract.id)
  assert.equal(record?.account.id, paidContract.account_id)
  assert.equal(record?.loan.id, paidContract.id)
  assert.ok((record?.meta.totalPaid ?? 0) > 0)
  const second = importer.import(workbook)
  assert.equal(second.imported, false)
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM in_house_payments').get().count, 2010)
  db.close()
  console.log(`installment workbook import tests passed: ${JSON.stringify(issueCounts)}`)
} finally {
  if (existsSync(output)) rmSync(output, { recursive: true, force: true })
}
