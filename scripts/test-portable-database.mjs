import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const output = resolve(root, '.portable-database-test-build')
const work = mkdtempSync(join(tmpdir(), 'cashiers-portable-'))
const require = createRequire(import.meta.url)
const now = '2026-09-08T00:00:00.000Z'
const tables = [
  'branches', 'users', 'user_branch_assignments', 'daily_reports', 'daily_receipt_totals',
  'daily_report_payment_entries', 'income_entries', 'expenses', 'cash_out_entries',
  'daily_report_deductions', 'daily_report_cash_counts', 'accounts', 'account_contacts',
  'installment_contracts', 'installment_items', 'in_house_schedules', 'in_house_payments',
  'installment_payment_allocations', 'installment_restructures', 'finance_accounts',
  'finance_account_items', 'audit_logs', 'audit_log_changes', 'catalog_options', 'receipt_types',
  'report_payment_methods', 'deduction_types', 'cash_denominations', 'installment_rule_versions',
  'installment_rule_terms'
]

function manifest(db) {
  return Object.fromEntries(
    tables.map((table) => [table, db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count])
  )
}

try {
  execFileSync(process.execPath, [resolve(root, 'node_modules/typescript/bin/tsc'), '--target', 'ES2022', '--module', 'commonjs', '--esModuleInterop', '--skipLibCheck', '--rootDir', resolve(root, 'src'), '--outDir', output, resolve(root, 'src/main/services/backup-service.ts'), resolve(root, 'src/main/database/database.ts'), resolve(root, 'src/main/database/migrations.ts')], { stdio: 'inherit' })
  const Database = require('better-sqlite3')
  const { openDatabase } = require(resolve(output, 'main/database/database.js'))
  const { BackupService } = require(resolve(output, 'main/services/backup-service.js'))
  const sourcePath = join(work, 'source.db')
  const source = openDatabase(sourcePath)
  source.pragma('foreign_keys = ON')
  const branch = source.prepare("SELECT id FROM branches WHERE name = 'Goa'").get().id
  const receipt = source.prepare('SELECT id FROM receipt_types LIMIT 1').get().id
  const method = source.prepare('SELECT id FROM report_payment_methods LIMIT 1').get().id
  const deduction = source.prepare('SELECT id FROM deduction_types LIMIT 1').get().id
  const denomination = source.prepare('SELECT id FROM cash_denominations LIMIT 1').get().id
  const incomeCategory = source.prepare('SELECT id FROM income_categories LIMIT 1').get().id
  const ruleVersion = source.prepare('SELECT id FROM installment_rule_versions LIMIT 1').get().id

  source.transaction(() => {
    source.prepare('INSERT INTO users (id, branch_id, username, password_hash, display_name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('portable-user', branch, 'portable-user', 'hash', 'Portable User', 'ADMIN', now, now)
    source.prepare('INSERT INTO user_branch_assignments (user_id, branch_id) VALUES (?, ?)').run('portable-user', branch)
    source.prepare("INSERT INTO reports (id, branch_id, cashier_id, business_date, status, created_at, updated_at) VALUES (?, ?, ?, '2026-09-08', 'Draft', ?, ?)").run('portable-report', branch, 'portable-user', now, now)
    source.prepare("INSERT INTO daily_reports (id, branch_id, cashier_user_id, business_date, opening_cash_centavos, status, created_at, updated_at) VALUES (?, ?, ?, '2026-09-08', 50000, 'DRAFT', ?, ?)").run('portable-report', branch, 'portable-user', now, now)
    source.prepare('INSERT INTO daily_receipt_totals (id, daily_report_id, receipt_type_id, quantity, amount_centavos, created_at, updated_at) VALUES (?, ?, ?, 2, 12345, ?, ?)').run('portable-receipt', 'portable-report', receipt, now, now)
    source.prepare("INSERT INTO daily_report_payment_entries (id, daily_report_id, payment_method_id, transaction_date, amount_centavos, status, created_by_user_id, created_at, updated_at) VALUES (?, ?, ?, '2026-09-08', 23456, 'POSTED', ?, ?, ?)").run('portable-payment-entry', 'portable-report', method, 'portable-user', now, now)
    source.prepare("INSERT INTO income_entries (id, daily_report_id, category_id, transaction_date, particular, amount_centavos, status, created_by_user_id, created_at, updated_at) VALUES (?, ?, ?, '2026-09-08', 'Portable income', 34567, 'POSTED', ?, ?, ?)").run('portable-income', 'portable-report', incomeCategory, 'portable-user', now, now)
    source.prepare("INSERT INTO expenses (id, report_id, type, description, category, receipt_no, vat, amount_centavos, created_by_user_id, created_at, updated_at) VALUES (?, ?, 'Company Expenses', 'Portable expense', 'General', 'R-1', '', 45678, ?, ?, ?)").run('portable-expense', 'portable-report', 'portable-user', now, now)
    source.prepare("INSERT INTO cash_out_entries (id, daily_report_id, transaction_date, description, amount_centavos, status, created_by_user_id, created_at, updated_at) VALUES (?, ?, '2026-09-08', 'Portable cash out', 5678, 'POSTED', ?, ?, ?)").run('portable-cash-out', 'portable-report', 'portable-user', now, now)
    source.prepare('INSERT INTO daily_report_deductions (id, daily_report_id, deduction_type_id, amount_centavos, created_at, updated_at) VALUES (?, ?, ?, 6789, ?, ?)').run('portable-deduction', 'portable-report', deduction, now, now)
    source.prepare('INSERT INTO daily_report_cash_counts (id, daily_report_id, denomination_id, quantity, created_at, updated_at) VALUES (?, ?, ?, 7, ?, ?)').run('portable-cash-count', 'portable-report', denomination, now, now)
    source.prepare('INSERT INTO accounts (id, account_number, display_name, branch_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run('portable-account', 'PORT-1', 'Portable Account', branch, now, now)
    source.prepare("INSERT INTO account_contacts (id, account_id, contact_type, contact_value, created_at, updated_at) VALUES (?, ?, 'PHONE', '09170000000', ?, ?)").run('portable-contact', 'portable-account', now, now)
    source.prepare("INSERT INTO installment_contracts (id, account_id, branch_id, installment_type_id, contract_number, contract_date, date_released, start_date, first_due_date, payment_frequency, terms, principal_centavos, installment_amount_centavos, financed_amount_centavos, total_payable_centavos, configuration_version_id, created_by_user_id, created_at, updated_at) VALUES (?, ?, ?, 'installment-type-in-house', 'PORT-CONTRACT', '2026-09-08', '2026-09-08', '2026-09-08', '2026-09-15', 'Weekly', '2', 100000, 50000, 100000, 100000, ?, ?, ?, ?)").run('portable-contract', 'portable-account', branch, ruleVersion, 'portable-user', now, now)
    source.prepare('INSERT INTO installment_items (id, contract_id, description, quantity, unit_price_centavos, item_total_centavos, created_at, updated_at) VALUES (?, ?, ?, 1, 100000, 100000, ?, ?)').run('portable-item', 'portable-contract', 'Portable item', now, now)
    source.prepare("INSERT INTO in_house_schedules (id, contract_id, installment_number, due_date, due_amount_centavos, status, created_at, updated_at) VALUES (?, ?, 1, '2026-09-15', 50000, 'PARTIALLY_PAID', ?, ?)").run('portable-schedule', 'portable-contract', now, now)
    source.prepare("INSERT INTO in_house_payments (id, contract_id, submission_id, payment_date, amount_centavos, penalty_centavos, status, received_by_user_id, created_at, updated_at) VALUES (?, ?, 'portable-submission', '2026-09-08', 25000, 0, 'POSTED', ?, ?, ?)").run('portable-payment', 'portable-contract', 'portable-user', now, now)
    source.prepare('INSERT INTO installment_payment_allocations (id, payment_id, schedule_id, allocated_amount_centavos, penalty_centavos, created_at) VALUES (?, ?, ?, 25000, 0, ?)').run('portable-allocation', 'portable-payment', 'portable-schedule', now)
    source.prepare("INSERT INTO installment_restructures (id, contract_id, first_due_date, payment_frequency, terms, outstanding_balance_centavos, reason, created_by_user_id, created_at) VALUES (?, ?, '2026-09-22', 'Weekly', 2, 75000, 'Portable test', ?, ?)").run('portable-restructure', 'portable-contract', 'portable-user', now)
    source.prepare("INSERT INTO finance_accounts (id, branch, provider, date_released, terms_months, last_name, first_name, quantity, item, item_price_centavos, grand_total_centavos, downpayment_centavos, balance_centavos, created_at, updated_at) VALUES (?, 'Goa', 'Home Credit', '2026-09-08', 12, 'Finance', 'Portable', 1, 'Portable phone', 90000, 90000, 10000, 80000, ?, ?)").run('portable-finance', now, now)
    source.prepare('INSERT INTO finance_account_items (id, finance_account_id, sort_order, item, quantity, item_price_centavos, total_centavos, created_at, updated_at) VALUES (?, ?, 0, ?, 1, 90000, 90000, ?, ?)').run('portable-finance-item', 'portable-finance', 'Portable phone', now, now)
    source.prepare("INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, created_at) VALUES (?, ?, 'CREATE', 'portable', 'portable-contract', ?)").run('portable-audit', 'portable-user', now)
    source.prepare("INSERT INTO audit_log_changes (id, audit_log_id, column_name, old_value, new_value) VALUES (?, ?, 'amount_centavos', '0', '100000')").run('portable-audit-change', 'portable-audit')
    source.prepare("INSERT INTO catalog_options (id, kind, value, created_at, updated_at) VALUES (?, 'FINANCE_TYPE', 'Portable Provider', ?, ?)").run('portable-catalog', now, now)
  })()
  const before = manifest(source)
  assert.ok(existsSync(`${sourcePath}-wal`), 'source must have a WAL file before export')
  const service = new BackupService(source, sourcePath)
  const exported = await service.exportPortable(join(work, 'exports'))
  assert.equal(exported.schemaVersion, 46)
  assert.equal(existsSync(`${exported.filePath}-wal`), false)
  assert.equal(existsSync(`${exported.filePath}-shm`), false)
  assert.deepEqual(manifest(source), before, 'export must not modify source data')
  const standalone = new Database(exported.filePath, { readonly: true })
  assert.equal(standalone.pragma('integrity_check', { simple: true }), 'ok')
  assert.deepEqual(standalone.pragma('foreign_key_check'), [])
  assert.deepEqual(manifest(standalone), before)
  assert.equal(standalone.prepare('SELECT amount_centavos FROM in_house_payments WHERE id = ?').get('portable-payment').amount_centavos, 25000)
  standalone.close()

  const corrupt = join(work, 'corrupt.db')
  writeFileSync(corrupt, 'not sqlite')
  assert.throws(() => service.preparePortableImport(corrupt, join(work, 'staging')), /Portable database/)
  const unrelated = join(work, 'unrelated.db')
  const unrelatedDb = new Database(unrelated)
  unrelatedDb.exec('CREATE TABLE unrelated (id TEXT)')
  unrelatedDb.close()
  assert.throws(() => service.preparePortableImport(unrelated, join(work, 'staging')), /Portable database/)
  const foreignKeyBroken = join(work, 'foreign-key-broken.db')
  copyFileSync(exported.filePath, foreignKeyBroken)
  const foreignKeyBrokenDb = new Database(foreignKeyBroken)
  foreignKeyBrokenDb.pragma('foreign_keys = OFF')
  foreignKeyBrokenDb.prepare("INSERT INTO expenses (id, report_id, type, description, category, receipt_no, vat, amount_centavos, created_at, updated_at) VALUES ('broken-expense', 'missing-report', 'Company Expenses', 'Broken', 'General', 'B-1', '', 1, ?, ?)").run(now, now)
  foreignKeyBrokenDb.pragma('wal_checkpoint(TRUNCATE)')
  foreignKeyBrokenDb.close()
  assert.throws(() => service.preparePortableImport(foreignKeyBroken, join(work, 'staging')), /foreign-key/)

  const targetPath = join(work, 'destination.db')
  const target = new Database(targetPath)
  target.exec("CREATE TABLE old_data (value TEXT); INSERT INTO old_data VALUES ('preserve me')")
  target.close()
  writeFileSync(`${targetPath}-wal`, 'old wal')
  writeFileSync(`${targetPath}-shm`, 'old shm')
  const prepared = service.preparePortableImport(exported.filePath, join(work, 'staging'))
  const recovery = service.installPortable(prepared.stagedPath, targetPath)
  const recoveryDb = new Database(recovery, { readonly: true })
  assert.equal(recoveryDb.prepare('SELECT value FROM old_data').get().value, 'preserve me')
  recoveryDb.close()
  assert.equal(existsSync(`${recovery}-wal`), true)
  assert.equal(existsSync(`${recovery}-shm`), true)
  assert.equal(existsSync(`${targetPath}-wal`), false)
  assert.equal(existsSync(`${targetPath}-shm`), false)
  const reopened = openDatabase(targetPath)
  assert.equal(reopened.prepare('SELECT MAX(version) AS version FROM schema_migrations').get().version, 46)
  assert.equal(reopened.prepare('SELECT id FROM finance_account_items WHERE id = ?').get('portable-finance-item').id, 'portable-finance-item')
  assert.deepEqual(manifest(reopened), before)
  reopened.close()
  source.close()
  console.log('portable database tests passed')
} finally {
  if (existsSync(output)) rmSync(output, { recursive: true, force: true })
  try {
    rmSync(work, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
  } catch {
    // Electron may release a closed SQLite handle on the next event-loop turn.
  }
}
