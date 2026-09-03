import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const output = resolve(root, '.close-contract-balance-test-build')
const require = createRequire(import.meta.url)
try {
  execFileSync(process.execPath, [resolve(root, 'node_modules/typescript/bin/tsc'), '--target', 'ES2022', '--module', 'commonjs', '--esModuleInterop', '--skipLibCheck', '--rootDir', resolve(root, 'src'), '--outDir', output, resolve(root, 'src/main/database/migrations.ts'), resolve(root, 'src/main/database/installment-rules-repository.ts'), resolve(root, 'src/main/database/installment-repository.ts')], { stdio: 'inherit' })
  const Database = require('better-sqlite3')
  const { runMigrations } = require(resolve(output, 'main/database/migrations.js'))
  const { InstallmentRepository } = require(resolve(output, 'main/database/installment-repository.js'))
  const db = new Database(':memory:'); db.pragma('foreign_keys = ON'); runMigrations(db)
  db.prepare(`INSERT INTO users (id, branch_id, username, password_hash, display_name, first_name, last_name, role, is_active, created_at, updated_at) VALUES ('test-user', 'system-goa', 'test-user', 'test', 'Test User', 'Test', 'User', 'ADMIN', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`).run()
  const installments = new InstallmentRepository(db)
  installments.bootstrap({ accounts: [{ id: 'account-a', branch: 'Goa', firstName: 'Test', lastName: 'Account', barangay: 'Barangay', cityMunicipality: 'Goa', province: 'Camarines Sur', contacts: [], emails: [], createdAt: '2026-01-01T00:00:00.000Z' }], loans: [{ id: 'contract-a', customerId: 'account-a', dateReleased: '2026-01-01', paymentFrequency: 'Weekly', terms: '8', downPayment: 0, items: [{ id: 'item-a', name: 'Item', quantity: 1, price: 10000 }], createdAt: '2026-01-01T00:00:00.000Z' }] })
  const total = db.prepare('SELECT total_payable_centavos FROM installment_contracts WHERE id = ?').get('contract-a').total_payable_centavos
  db.prepare(`INSERT INTO in_house_payments (id, contract_id, submission_id, payment_date, amount_centavos, penalty_centavos, received_by_user_id, created_at, updated_at) VALUES ('payment-a', 'contract-a', 'legacy-payment', '2026-01-01', ?, 0, 'test-user', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`).run(total)
  assert.equal(installments.list({ view: 'active', search: '' }).rows[0]?.meta.outstandingBalance, 0)
  assert.doesNotThrow(() => installments.closeContract({ accountId: 'account-a', contractId: 'contract-a', remarks: 'Fully paid', actorUserId: 'test-user' }))
  db.close(); console.log('close contract balance test passed')
} finally { if (existsSync(output)) rmSync(output, { recursive: true, force: true }) }
