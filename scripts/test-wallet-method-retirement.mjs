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
  assert.deepEqual(
    db
      .prepare(
        `SELECT reference_id, is_active FROM catalog_options
          WHERE reference_id IN (
            'report-payment-method-gcash',
            'report-payment-method-other-ewallet'
          )
          ORDER BY reference_id`
      )
      .all(),
    [
      { reference_id: 'report-payment-method-gcash', is_active: 0 },
      { reference_id: 'report-payment-method-other-ewallet', is_active: 0 }
    ]
  )
  assert.equal(
    db
      .prepare(
        `SELECT is_active FROM catalog_options
          WHERE reference_id = 'report-payment-method-check'`
      )
      .get().is_active,
    1
  )
  assert.deepEqual(
    db
      .prepare(
        `SELECT id FROM report_payment_methods
          WHERE id IN (
            'report-payment-method-gcash',
            'report-payment-method-other-ewallet'
          )
          ORDER BY id`
      )
      .all(),
    [
      { id: 'report-payment-method-gcash' },
      { id: 'report-payment-method-other-ewallet' }
    ]
  )

  runMigrations(db)
  assert.deepEqual(
    db
      .prepare(
        `SELECT reference_id, is_active FROM catalog_options
          WHERE reference_id IN (
            'report-payment-method-gcash',
            'report-payment-method-other-ewallet'
          )
          ORDER BY reference_id`
      )
      .all(),
    [
      { reference_id: 'report-payment-method-gcash', is_active: 0 },
      { reference_id: 'report-payment-method-other-ewallet', is_active: 0 }
    ]
  )
  console.log('wallet payment method retirement tests passed')
} finally {
  db?.close()
  if (existsSync(output)) rmSync(output, { recursive: true, force: true })
}
