import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const output = resolve(root, '.installment-rules-test-build')
const require = createRequire(import.meta.url)
try {
  execFileSync(process.execPath, [resolve(root, 'node_modules/typescript/bin/tsc'), '--target', 'ES2022', '--module', 'commonjs', '--esModuleInterop', '--skipLibCheck', '--rootDir', resolve(root, 'src'), '--outDir', output, resolve(root, 'src/main/database/migrations.ts'), resolve(root, 'src/main/database/installment-rules-repository.ts'), resolve(root, 'src/main/database/installment-repository.ts')], { stdio: 'inherit' })
  const Database = require('better-sqlite3')
  const { runMigrations } = require(resolve(output, 'main/database/migrations.js'))
  const { InstallmentRulesRepository } = require(resolve(output, 'main/database/installment-rules-repository.js'))
  const { InstallmentRepository } = require(resolve(output, 'main/database/installment-repository.js'))
  const db = new Database(':memory:'); db.pragma('foreign_keys = ON'); runMigrations(db)
  const repository = new InstallmentRulesRepository(db); const baseline = repository.getActive()
  assert.equal(baseline.version, 1); assert.equal(baseline.standardInterestRateBps, 3800); assert.deepEqual(baseline.weeklyTerms, [5, 8, 12, 16]); assert.deepEqual(baseline.semiTerms, [2, 4, 6, 8])
  const user = db.prepare('SELECT id FROM users LIMIT 1').get(); assert.ok(user?.id)
  const updated = repository.save({ ...baseline, standardInterestRateBps: 4000 }, user.id)
  assert.equal(updated.version, 2); assert.equal(updated.standardInterestRateBps, 4000)
  const versions = repository.list(); assert.equal(versions.length, 2); assert.equal(versions[1].standardInterestRateBps, 3800)
  const installments = new InstallmentRepository(db)
  const account = (id) => ({ id, branch: 'Goa', firstName: 'Test', lastName: id, barangay: 'Barangay', cityMunicipality: 'Goa', province: 'Camarines Sur', contacts: [], emails: [], createdAt: '2026-01-01T00:00:00.000Z' })
  const loan = (id, customerId) => ({ id, customerId, dateReleased: '2026-01-01', paymentFrequency: 'Weekly', terms: '8', downPayment: 0, items: [{ id: `${id}-item`, name: 'Item', quantity: 1, price: 10000 }], createdAt: '2026-01-01T00:00:00.000Z' })
  installments.bootstrap({ accounts: [account('account-a')], loans: [loan('contract-a', 'account-a')] })
  assert.equal(db.prepare('SELECT total_payable_centavos FROM installment_contracts WHERE id = ?').get('contract-a').total_payable_centavos, 1400000)
  repository.save({ ...updated, standardInterestRateBps: 5000 }, user.id)
  installments.bootstrap({ accounts: [account('account-b')], loans: [loan('contract-b', 'account-b')] })
  assert.equal(db.prepare('SELECT total_payable_centavos FROM installment_contracts WHERE id = ?').get('contract-a').total_payable_centavos, 1400000)
  assert.equal(db.prepare('SELECT total_payable_centavos FROM installment_contracts WHERE id = ?').get('contract-b').total_payable_centavos, 1500000)
  installments.bootstrap({ accounts: [account('account-c')], loans: [{ ...loan('contract-c', 'account-c'), paymentFrequency: 'Monthly', terms: '3', downPayment: 2000 }] })
  const monthly = installments.list({ view: 'records', search: '' }).rows.find((row) => row.contractId === 'contract-c')
  assert.equal(monthly?.meta.totalPaid, 2000); assert.equal(monthly?.meta.outstandingBalance, 10800)
  db.close(); console.log('installment rules migration tests passed')
} finally { if (existsSync(output)) rmSync(output, { recursive: true, force: true }) }
