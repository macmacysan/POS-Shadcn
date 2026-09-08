/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const output = resolve(root, '.finance-provider-migration-test-build')
const work = mkdtempSync(join(tmpdir(), 'cashiers-finance-provider-'))
const require = createRequire(import.meta.url)
const now = '2026-09-08T00:00:00.000Z'

function createPrePartOneDatabase(Database, filePath) {
  const db = new Database(filePath)
  db.pragma('foreign_keys = ON')
  db.exec(`
    CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
    INSERT INTO schema_migrations VALUES (46, '${now}');
    CREATE TABLE users (id TEXT PRIMARY KEY NOT NULL);
    CREATE TABLE finance_accounts (
      id TEXT PRIMARY KEY NOT NULL,
      branch TEXT NOT NULL CHECK (branch IN ('Goa', 'Tinambac', 'Tigaon', 'Lagonoy')),
      provider TEXT NOT NULL CHECK (provider IN ('Home Credit', 'Salmon', 'Skyro')),
      date_released TEXT NOT NULL,
      terms_months INTEGER NOT NULL CHECK (terms_months BETWEEN 1 AND 12),
      last_name TEXT NOT NULL, first_name TEXT NOT NULL, middle_name TEXT, suffix TEXT,
      quantity INTEGER NOT NULL CHECK (quantity > 0), item TEXT NOT NULL, serial_no TEXT,
      item_price_centavos INTEGER NOT NULL CHECK (item_price_centavos >= 0),
      grand_total_centavos INTEGER NOT NULL CHECK (grand_total_centavos >= 0),
      downpayment_centavos INTEGER NOT NULL CHECK (downpayment_centavos >= 0),
      balance_centavos INTEGER NOT NULL CHECK (balance_centavos >= 0),
      or_number TEXT, or_date TEXT, paid_date TEXT, remarks TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'POSTED' CHECK (status IN ('POSTED', 'VOIDED')),
      voided_at TEXT, voided_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL, void_reason TEXT
    );
    CREATE INDEX finance_accounts_branch_date_idx ON finance_accounts (branch, date_released DESC, created_at DESC);
    CREATE INDEX finance_accounts_status_idx ON finance_accounts (status);
    CREATE TABLE finance_account_items (
      id TEXT PRIMARY KEY NOT NULL,
      finance_account_id TEXT NOT NULL REFERENCES finance_accounts(id) ON DELETE RESTRICT,
      sort_order INTEGER NOT NULL CHECK (sort_order >= 0), item TEXT NOT NULL, serial_no TEXT,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      item_price_centavos INTEGER NOT NULL CHECK (item_price_centavos >= 0),
      total_centavos INTEGER NOT NULL CHECK (total_centavos >= 0),
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE (finance_account_id, sort_order)
    );
    CREATE INDEX finance_account_items_account_sort_idx ON finance_account_items (finance_account_id, sort_order);
  `)
  const insertAccount = db.prepare(`INSERT INTO finance_accounts (
    id, branch, provider, date_released, terms_months, last_name, first_name, middle_name, suffix,
    quantity, item, serial_no, item_price_centavos, grand_total_centavos, downpayment_centavos,
    balance_centavos, or_number, or_date, paid_date, remarks, created_at, updated_at, status,
    voided_at, voided_by_user_id, void_reason
  ) VALUES (?, 'Goa', ?, '2026-09-08', 12, ?, 'First', NULL, NULL, 1, 'Phone', NULL, 10000, 10000, 0, 10000, NULL, NULL, NULL, ?, ?, ?, 'POSTED', NULL, NULL, NULL)`)
  const insertItem = db.prepare(
    'INSERT INTO finance_account_items VALUES (?, ?, 0, ?, NULL, 1, 10000, 10000, ?, ?)'
  )
  for (const provider of ['Home Credit', 'Salmon', 'Skyro']) {
    const id = provider.toLowerCase().replace(' ', '-')
    insertAccount.run(id, provider, provider, `${provider} history`, now, now)
    insertItem.run(`${id}-item`, id, `${provider} Phone`, now, now)
  }
  return db
}

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
  const filePath = join(work, 'pre-part-1.db')
  const db = createPrePartOneDatabase(Database, filePath)
  const accountsBefore = db.prepare('SELECT * FROM finance_accounts ORDER BY id').all()
  const itemsBefore = db.prepare('SELECT * FROM finance_account_items ORDER BY id').all()
  runMigrations(db)
  assert.equal(
    db.prepare('SELECT MAX(version) AS version FROM schema_migrations').get().version,
    currentSchemaVersion
  )
  assert.deepEqual(db.prepare('SELECT * FROM finance_accounts ORDER BY id').all(), accountsBefore)
  assert.deepEqual(db.prepare('SELECT * FROM finance_account_items ORDER BY id').all(), itemsBefore)
  const financeSchema = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'finance_accounts'")
    .get().sql
  assert.equal(financeSchema.includes("provider IN ('Home Credit', 'Salmon', 'Skyro')"), false)
  assert.match(financeSchema, /branch IN \('Goa', 'Tinambac', 'Tigaon', 'Lagonoy'\)/)
  assert.match(financeSchema, /terms_months BETWEEN 1 AND 12/)
  assert.match(financeSchema, /status IN \('POSTED', 'VOIDED'\)/)
  assert.deepEqual(
    db
      .prepare("SELECT name FROM pragma_index_list('finance_accounts') ORDER BY name")
      .all()
      .map((row) => row.name),
    [
      'finance_accounts_branch_date_idx',
      'finance_accounts_status_idx',
      'sqlite_autoindex_finance_accounts_1'
    ]
  )
  assert.equal(db.pragma('integrity_check', { simple: true }), 'ok')
  assert.deepEqual(db.pragma('foreign_key_check'), [])
  assert.equal(db.pragma('foreign_key_list(finance_account_items)')[0].table, 'finance_accounts')

  db.exec(`CREATE TABLE catalog_options (id TEXT PRIMARY KEY, kind TEXT NOT NULL, value TEXT NOT NULL, is_active INTEGER NOT NULL);
    INSERT INTO catalog_options VALUES ('bpi-finance', 'FINANCE_TYPE', 'BPI Finance', 1);`)
  const provider = db
    .prepare("SELECT value FROM catalog_options WHERE kind = 'FINANCE_TYPE' AND is_active = 1")
    .get().value
  db.prepare(
    "INSERT INTO finance_accounts (id, branch, provider, date_released, terms_months, last_name, first_name, quantity, item, item_price_centavos, grand_total_centavos, downpayment_centavos, balance_centavos, created_at, updated_at) VALUES ('bpi-account', 'Goa', ?, '2026-09-08', 12, 'BPI', 'Customer', 1, 'Phone', 10000, 10000, 0, 10000, ?, ?)"
  ).run(provider, now, now)
  assert.equal(
    db.prepare("SELECT provider FROM finance_accounts WHERE id = 'bpi-account'").get().provider,
    'BPI Finance'
  )
  for (const provider of ['Home Credit', 'Salmon', 'Skyro']) {
    db.prepare('UPDATE finance_accounts SET provider = ? WHERE provider = ?').run(
      provider,
      provider
    )
  }
  db.prepare("UPDATE catalog_options SET is_active = 0 WHERE id = 'bpi-finance'").run()
  assert.equal(
    db.prepare("SELECT provider FROM finance_accounts WHERE id = 'bpi-account'").get().provider,
    'BPI Finance'
  )
  assert.equal(db.pragma('integrity_check', { simple: true }), 'ok')
  assert.deepEqual(db.pragma('foreign_key_check'), [])
  db.close()
  console.log('finance provider migration tests passed')
} finally {
  if (existsSync(output)) rmSync(output, { recursive: true, force: true })
  rmSync(work, { recursive: true, force: true })
}
