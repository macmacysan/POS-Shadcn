import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const output = resolve(root, '.installment-status-test-build')
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
      resolve(root, 'src/main/database/installment-repository.ts')
    ],
    { stdio: 'inherit' }
  )
  const Database = require('better-sqlite3')
  const { runMigrations } = require(resolve(output, 'main/database/migrations.js'))
  const { InstallmentRepository } = require(
    resolve(output, 'main/database/installment-repository.js')
  )
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db)
  const repository = new InstallmentRepository(db)
  const now = '2026-01-01T00:00:00.000Z'
  db.prepare(
    `INSERT INTO users
      (id, branch_id, username, password_hash, display_name, first_name, last_name, role, is_active, created_at, updated_at)
     VALUES ('status-user', 'system-goa', 'status-user', 'test', 'Status User', 'Status', 'User', 'CASHIER', 1, ?, ?)`
  ).run(now, now)
  repository.bootstrap({
    accounts: [
      {
        id: 'status-account',
        branch: 'Goa',
        firstName: 'Status',
        lastName: 'Test',
        barangay: 'Test',
        cityMunicipality: 'Goa',
        province: 'Camarines Sur',
        contacts: [],
        emails: [],
        createdAt: now
      }
    ],
    loans: [
      {
        id: 'status-contract',
        customerId: 'status-account',
        dateReleased: '2026-01-01',
        paymentFrequency: 'Weekly',
        terms: '8',
        downPayment: 0,
        items: [{ id: 'status-item', name: 'Test', model: 'Test', quantity: 1, price: 100 }],
        createdAt: now
      }
    ]
  })
  repository.bootstrap({
    accounts: [
      {
        id: 'client-only-account',
        branch: 'Goa',
        firstName: 'Client',
        lastName: 'Only',
        barangay: 'Test',
        cityMunicipality: 'Goa',
        province: 'Camarines Sur',
        contacts: [],
        emails: [],
        createdAt: now
      }
    ],
    loans: []
  })
  const clientOnly = repository
    .list({ view: 'records', search: 'client-only-account', includeVoided: false })
    .rows.find((row) => row.account.id === 'client-only-account')
  assert.equal(clientOnly?.account.branch, 'Goa')
  assert.equal(clientOnly?.contractId, '')
  repository.updateLoan({
    accountId: 'status-account',
    contractId: 'status-contract',
    dateReleased: '2026-01-02',
    paymentFrequency: 'Weekly',
    terms: 8,
    downPaymentCentavos: 0,
    remarks: 'Updated before collection'
  })
  assert.equal(
    db.prepare('SELECT terms FROM installment_contracts WHERE id = ?').get('status-contract').terms,
    '8'
  )
  assert.equal(
    db
      .prepare('SELECT count(*) AS count FROM in_house_schedules WHERE contract_id = ?')
      .get('status-contract').count,
    8
  )
  db.prepare(
    `INSERT INTO in_house_payments
      (id, contract_id, payment_date, amount_centavos, status, created_at, updated_at)
     VALUES ('status-payment', 'status-contract', '2026-01-02', 100, 'POSTED', ?, ?)`
  ).run(now, now)
  assert.throws(
    () =>
      repository.updateLoan({
        accountId: 'status-account',
        contractId: 'status-contract',
        dateReleased: '2026-01-02',
        paymentFrequency: 'Weekly',
        terms: 8,
        downPaymentCentavos: 0
      }),
    /posted payments/
  )
  repository.restructureLoan({
    accountId: 'status-account',
    contractId: 'status-contract',
    firstDueDate: new Date().toISOString().slice(0, 10),
    paymentFrequency: 'Weekly',
    terms: 4,
    reason: 'Customer requested a new repayment schedule.',
    actorUserId: 'status-user'
  })
  assert.equal(
    db
      .prepare(
        `SELECT count(*) AS count FROM in_house_schedules
          WHERE contract_id = ? AND is_restructured = 0`
      )
      .get('status-contract').count,
    4
  )
  assert.equal(
    db
      .prepare(
        `SELECT sum(due_amount_centavos) AS total FROM in_house_schedules
          WHERE contract_id = ? AND is_restructured = 0`
      )
      .get('status-contract').total,
    db.prepare('SELECT total_payable_centavos FROM installment_contracts WHERE id = ?').get('status-contract')
      .total_payable_centavos - 100
  )
  assert.equal(
    db
      .prepare('SELECT count(*) AS count FROM installment_restructures WHERE contract_id = ?')
      .get('status-contract').count,
    1
  )
  assert.equal(
    repository
      .listHistory({})
      .some((record) => record.activity === 'Loan repayment schedule restructured'),
    true
  )
  db.prepare("UPDATE in_house_payments SET status = 'VOIDED' WHERE id = 'status-payment'").run()
  db.prepare('UPDATE installment_contracts SET total_payable_centavos = 0 WHERE id = ?').run(
    'status-contract'
  )
  const request = {
    accountId: 'status-account',
    contractId: 'status-contract',
    remarks: 'Status action test',
    actorUserId: 'status-user'
  }
  repository.closeContract(request)
  repository.restoreStatus({ ...request, status: 'closed' })
  assert.equal(
    db.prepare('SELECT status FROM installment_contracts WHERE id = ?').get('status-contract')
      .status,
    'ACTIVE'
  )
  assert.throws(
    () => repository.restoreStatus({ ...request, status: 'closed' }),
    /Only closed contracts can be restored/
  )
  repository.blacklistAccount(request)
  repository.restoreStatus({ ...request, status: 'blacklisted' })
  assert.equal(
    db.prepare('SELECT status FROM accounts WHERE id = ?').get('status-account').status,
    'ACTIVE'
  )
  assert.throws(
    () => repository.restoreStatus({ ...request, status: 'blacklisted' }),
    /Only blacklisted accounts can be restored/
  )
  assert.equal(
    db.prepare("SELECT count(*) AS count FROM audit_log_changes WHERE new_value = 'ACTIVE'").get()
      .count,
    2
  )
  db.close()
  console.log('installment status action tests passed')
} finally {
  if (existsSync(output)) rmSync(output, { recursive: true, force: true })
}
