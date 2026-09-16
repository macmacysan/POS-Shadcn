import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const output = resolve(root, '.installment-rules-test-build')
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
      resolve(root, 'src/main/database/migrations.ts'),
      resolve(root, 'src/main/database/installment-rules-repository.ts'),
      resolve(root, 'src/main/database/installment-repository.ts')
    ],
    { stdio: 'inherit' }
  )
  const Database = require('better-sqlite3')
  const { runMigrations } = require(resolve(output, 'main/database/migrations.js'))
  const { InstallmentRulesRepository } = require(
    resolve(output, 'main/database/installment-rules-repository.js')
  )
  const { InstallmentRepository } = require(
    resolve(output, 'main/database/installment-repository.js')
  )
  const { buildInHouseSchedule } = require(resolve(output, 'main/services/in-house-schedule.js'))
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db)
  const repository = new InstallmentRulesRepository(db)
  const baseline = repository.getActive()
  assert.equal(baseline.version, 1)
  assert.equal(baseline.standardInterestRateBps, 3800)
  assert.deepEqual(baseline.weeklyTerms, [5, 8, 12, 16])
  assert.deepEqual(baseline.semiTerms, [2, 4, 6, 8])
  db.prepare(
    `INSERT INTO users (id, branch_id, username, password_hash, display_name, first_name, last_name, role, is_active, created_at, updated_at) VALUES ('test-user', 'system-goa', 'test-user', 'test', 'Test User', 'Test', 'User', 'ADMIN', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`
  ).run()
  const user = db.prepare("SELECT id FROM users WHERE id = 'test-user'").get()
  assert.ok(user?.id)
  const updated = repository.save({ ...baseline, standardInterestRateBps: 4000 }, user.id)
  assert.equal(updated.version, 2)
  assert.equal(updated.standardInterestRateBps, 4000)
  const versions = repository.list()
  assert.equal(versions.length, 2)
  assert.equal(versions[1].standardInterestRateBps, 3800)
  const installments = new InstallmentRepository(db)
  const account = (id) => ({
    id,
    branch: 'Goa',
    firstName: 'Test',
    lastName: id,
    barangay: 'Barangay',
    cityMunicipality: 'Goa',
    province: 'Camarines Sur',
    contacts: [],
    emails: [],
    createdAt: '2026-01-01T00:00:00.000Z'
  })
  const loan = (id, customerId) => ({
    id,
    customerId,
    dateReleased: '2026-01-01',
    paymentFrequency: 'Weekly',
    terms: '8',
    downPayment: 0,
    items: [{ id: `${id}-item`, name: 'Item', quantity: 1, price: 10000 }],
    createdAt: '2026-01-01T00:00:00.000Z'
  })
  installments.bootstrap({
    accounts: [account('account-a')],
    loans: [loan('contract-a', 'account-a')]
  })
  assert.equal(
    db
      .prepare('SELECT total_payable_centavos FROM installment_contracts WHERE id = ?')
      .get('contract-a').total_payable_centavos,
    1400000
  )
  repository.save({ ...updated, standardInterestRateBps: 5000 }, user.id)
  installments.bootstrap({
    accounts: [account('account-b')],
    loans: [loan('contract-b', 'account-b')]
  })
  assert.equal(
    db
      .prepare('SELECT total_payable_centavos FROM installment_contracts WHERE id = ?')
      .get('contract-a').total_payable_centavos,
    1400000
  )
  assert.equal(
    db
      .prepare('SELECT total_payable_centavos FROM installment_contracts WHERE id = ?')
      .get('contract-b').total_payable_centavos,
    1500000
  )
  installments.bootstrap({
    accounts: [account('account-c')],
    loans: [
      {
        ...loan('contract-c', 'account-c'),
        paymentFrequency: 'Monthly',
        terms: '3',
        downPayment: 2000
      }
    ]
  })
  const monthly = installments
    .list({ view: 'records', search: '' })
    .rows.find((row) => row.contractId === 'contract-c')
  assert.equal(monthly?.meta.totalPaid, 2000)
  assert.equal(monthly?.meta.outstandingBalance, 10800)
  const monthlyWorkspace = installments.getPaymentWorkspace({ accountId: 'account-c' })
  assert.equal(monthlyWorkspace.downPayment?.amountCentavos, 200000)
  assert.equal(monthlyWorkspace.payments.length, 0)
  assert.ok(monthlyWorkspace.schedules.every((schedule) => schedule.paidAmountCentavos === 0))
  installments.updateLoan({
    accountId: 'account-a',
    contractId: 'contract-a',
    dateReleased: '2026-01-01',
    paymentFrequency: 'Weekly',
    terms: 8,
    downPaymentCentavos: 200000
  })
  const updatedAdvance = installments.getPaymentWorkspace({ accountId: 'account-a' })
  assert.equal(updatedAdvance.downPayment, undefined)
  assert.equal(updatedAdvance.payments.length, 1)
  assert.equal(updatedAdvance.payments[0]?.remarks, 'Advanced payment')
  for (const [frequency, terms] of [
    ['Daily', '30'],
    ['Weekly', '8'],
    ['Semi', '2']
  ]) {
    const contractId = `advance-${frequency.toLowerCase()}`
    const accountId = `account-${contractId}`
    installments.bootstrap({
      accounts: [account(accountId)],
      loans: [
        { ...loan(contractId, accountId), paymentFrequency: frequency, terms, downPayment: 2000 }
      ]
    })
    const workspace = installments.getPaymentWorkspace({ accountId })
    assert.equal(workspace.downPayment, undefined)
    assert.equal(workspace.totalPaidCentavos, 200000)
    assert.equal(workspace.payments.length, 1)
    assert.equal(workspace.payments[0]?.status, 'POSTED')
    assert.equal(workspace.payments[0]?.remarks, 'Advanced payment')
    assert.equal(workspace.payments[0]?.allocatedAmountCentavos, 200000)
    assert.ok(workspace.schedules.some((schedule) => schedule.paidAmountCentavos > 0))
  }
  installments.bootstrap({
    accounts: [account('account-legacy-advance')],
    loans: [loan('legacy-advance', 'account-legacy-advance')]
  })
  db.prepare('UPDATE installment_contracts SET down_payment_centavos = ? WHERE id = ?').run(
    200000,
    'legacy-advance'
  )
  db.prepare('DELETE FROM schema_migrations WHERE version = 50').run()
  runMigrations(db)
  const migratedAdvance = installments.getPaymentWorkspace({ accountId: 'account-legacy-advance' })
  assert.equal(migratedAdvance.downPayment, undefined)
  assert.equal(migratedAdvance.totalPaidCentavos, 200000)
  assert.equal(migratedAdvance.payments.length, 1)
  assert.equal(migratedAdvance.payments[0]?.remarks, 'Advanced payment')
  assert.ok(migratedAdvance.schedules.some((schedule) => schedule.paidAmountCentavos > 0))
  for (const frequency of ['Daily', 'Weekly', 'Semi-monthly', 'Monthly']) {
    const roundedUp = buildInHouseSchedule('2026-01-01', frequency, '2', 249110)
    assert.equal(roundedUp[0]?.dueAmountCentavos, 124600)
    assert.equal(
      roundedUp.reduce((total, payment) => total + payment.dueAmountCentavos, 0),
      249110
    )
    const roundedDown = buildInHouseSchedule('2026-01-01', frequency, '2', 249044)
    assert.equal(roundedDown[0]?.dueAmountCentavos, 124500)
    assert.equal(
      roundedDown.reduce((total, payment) => total + payment.dueAmountCentavos, 0),
      249044
    )
  }
  db.close()
  console.log('installment rules migration tests passed')
} finally {
  if (existsSync(output)) rmSync(output, { recursive: true, force: true })
}
