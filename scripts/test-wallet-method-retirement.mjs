import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const output = resolve(root, '.wallet-method-retirement-test-build')
const require = createRequire(import.meta.url)
let db

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
      resolve(root, 'src/main/database/migrations.ts')
    ],
    { stdio: 'inherit' }
  )

  const Database = require('better-sqlite3')
  const { currentSchemaVersion, runMigrations } = require(
    resolve(output, 'main/database/migrations.js')
  )
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db)

  assert.equal(
    db.prepare('SELECT MAX(version) AS version FROM schema_migrations').get().version,
    currentSchemaVersion
  )
  assert.equal(
    db
      .prepare("SELECT COUNT(*) AS count FROM catalog_options WHERE kind = 'CASHIER_PAYMENT_TYPE'")
      .get().count,
    0
  )
  for (const context of ['CASHIER_REPORT', 'EXPENSE', 'INSTALLMENT', 'FINANCE']) {
    assert.equal(
      db
        .prepare(
          'SELECT COUNT(*) AS count FROM payment_method_contexts WHERE context = ? AND is_active = 1'
        )
        .get(context).count,
      7
    )
  }
  assert.deepEqual(
    db
      .prepare(
        `SELECT id FROM payment_methods
          WHERE id IN (
            'report-payment-method-gcash',
            'report-payment-method-other-ewallet'
          )
          ORDER BY id`
      )
      .all(),
    [{ id: 'report-payment-method-gcash' }, { id: 'report-payment-method-other-ewallet' }]
  )

  runMigrations(db)
  for (const [table, column] of [
    ['in_house_payments', 'payment_method'],
    ['installment_contracts', 'down_payment_method'],
    ['finance_accounts', 'payment_method'],
    ['cross_branch_collections', 'payment_method']
  ]) {
    const sql = db
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(table).sql
    for (const method of ['Cash', 'Check', 'Bank Transfer', 'GCash', 'Maya', 'Other E-wallet', 'Other'])
      assert.ok(sql.includes(`'${method}'`), `${table}.${column} accepts ${method}`)
  }
  assert.ok(
    db
      .pragma('foreign_key_list(expense_entries)')
      .some((key) => key.table === 'payment_methods' && key.from === 'payment_method_code')
  )
  assert.equal(
    db.prepare("SELECT name FROM payment_methods WHERE code = 'CHECK'").get().name,
    'Check'
  )
  assert.equal(
    db
      .prepare(
        `SELECT display_name FROM payment_method_contexts
          WHERE payment_method_id = 'report-payment-method-check' AND context = 'CASHIER_REPORT'`
      )
      .get().display_name,
    null
  )
  console.log('wallet payment method retirement tests passed')
} finally {
  db?.close()
  if (existsSync(output)) rmSync(output, { recursive: true, force: true })
}
