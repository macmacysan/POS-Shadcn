import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const output = resolve(root, '.cross-branch-relay-test-build')
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
      resolve(root, 'src/main/database/installment-repository.ts'),
      resolve(root, 'src/main/database/daily-report-repository.ts'),
      resolve(root, 'src/main/database/expense-repository.ts'),
      resolve(root, 'src/main/services/cross-branch-payment-relay-service.ts'),
      resolve(root, 'src/main/services/auth-service.ts'),
      resolve(root, 'src/main/database/user-repository.ts')
    ],
    { stdio: 'inherit' }
  )
  const Database = require('better-sqlite3')
  const { runMigrations } = require(resolve(output, 'main/database/migrations.js'))
  const { InstallmentRepository } = require(
    resolve(output, 'main/database/installment-repository.js')
  )
  const { DailyReportRepository } = require(
    resolve(output, 'main/database/daily-report-repository.js')
  )
  const { ExpenseRepository } = require(resolve(output, 'main/database/expense-repository.js'))
  const { CrossBranchPaymentRelayService } = require(
    resolve(output, 'main/services/cross-branch-payment-relay-service.js')
  )
  const { AuthService } = require(resolve(output, 'main/services/auth-service.js'))
  const { UserRepository } = require(resolve(output, 'main/database/user-repository.js'))
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db)
  const collectionColumns = db
    .prepare('PRAGMA table_info(cross_branch_collections)')
    .all()
    .map((row) => row.name)
  assert.ok(collectionColumns.includes('account_name'))
  assert.ok(
    !db
      .prepare('PRAGMA table_info(account_contacts)')
      .all()
      .some((row) => row.name === 'account_name')
  )
  const repository = new InstallmentRepository(db)
  const now = '2026-01-01T00:00:00.000Z'
  repository.bootstrap({
    accounts: [
      {
        id: 'relay-account',
        branch: 'Goa',
        firstName: 'Relay',
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
        id: 'relay-contract',
        customerId: 'relay-account',
        dateReleased: '2026-01-01',
        paymentFrequency: 'Weekly',
        terms: '8',
        downPayment: 0,
        items: [{ id: 'relay-item', name: 'Test item', model: 'Test', quantity: 1, price: 100 }],
        createdAt: now
      }
    ]
  })
  const event = {
    eventId: 'relay-event-1',
    ownerBranch: 'Goa',
    collectingBranch: 'Tinambac',
    accountId: 'relay-account',
    contractId: 'relay-contract',
    scheduleNumber: 4,
    cashierName: 'Tinambac Cashier',
    paymentDate: '2026-01-02',
    amountCentavos: 1000,
    penaltyCentavos: 0,
    paymentMethod: 'Cash'
  }
  const applied = repository.applyRelayedPayment(event)
  assert.equal(applied.state, 'APPLIED')
  assert.ok(applied.paymentId)
  assert.equal(applied.receivedNow, true)
  assert.equal(applied.accountName, 'Relay Test')
  assert.ok(applied.scheduledDueDate)
  assert.equal(repository.applyRelayedPayment(event).receivedNow, false)
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM in_house_payments').get().count, 1)
  assert.equal(
    db.prepare('SELECT received_by_name FROM in_house_payments WHERE id = ?').get(applied.paymentId)
      .received_by_name,
    event.cashierName
  )
  assert.equal(
    db
      .prepare(
        `SELECT s.installment_number FROM installment_payment_allocations pa
         JOIN in_house_schedules s ON s.id = pa.schedule_id WHERE pa.payment_id = ?`
      )
      .get(applied.paymentId).installment_number,
    event.scheduleNumber
  )

  const ownerAuth = new AuthService(new UserRepository(db))
  ownerAuth.session = {
    id: 'owner-cashier',
    displayName: 'Owner Cashier',
    role: 'CASHIER',
    branch: 'Goa',
    branchId: 'system-goa'
  }
  const incomingEvent = {
    ...event,
    eventId: 'relay-dialog-event',
    scheduleNumber: 5,
    cashierName: 'Tinambac Cashier'
  }
  const incomingRows = [
    [
      'event_id',
      'version',
      'event_type',
      'owner_branch',
      'collecting_branch',
      'payload_json',
      'created_at'
    ],
    [incomingEvent.eventId, '1', 'PAYMENT', 'Goa', 'Tinambac', JSON.stringify(incomingEvent), now]
  ]
  const receivedReceipts = []
  const ownerRelay = new CrossBranchPaymentRelayService(
    db,
    {
      ensureTabs: async () => undefined,
      values: async () => incomingRows,
      updateValues: async () => undefined,
      appendValues: async () => undefined
    },
    ownerAuth,
    repository,
    async () => [],
    undefined,
    (receipt) => receivedReceipts.push(receipt)
  )
  await ownerRelay.sync()
  assert.equal(receivedReceipts.length, 1)
  assert.equal(receivedReceipts[0].accountName, 'Relay Test')
  assert.equal(receivedReceipts[0].cashierName, 'Tinambac Cashier')
  assert.ok(receivedReceipts[0].scheduledDueDate)

  const overpayment = repository.applyRelayedPayment({
    ...event,
    eventId: 'relay-event-2',
    amountCentavos: 100_000_000
  })
  assert.equal(overpayment.state, 'REVIEW')
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM in_house_payments').get().count, 3)

  const mismatch = repository.applyRelayedPayment({
    ...event,
    eventId: 'relay-event-3',
    accountId: 'wrong-account'
  })
  assert.equal(mismatch.state, 'REVIEW')
  assert.equal(mismatch.paymentId, undefined)
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM in_house_payments').get().count, 3)

  db.prepare("UPDATE installment_contracts SET status = 'CLOSED' WHERE id = 'relay-contract'").run()
  const closed = repository.applyRelayedPayment({ ...event, eventId: 'relay-event-4' })
  assert.equal(closed.state, 'REVIEW')
  assert.equal(closed.paymentId, undefined)
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM in_house_payments').get().count, 3)

  db.prepare(
    `INSERT INTO users
    (id, branch_id, username, password_hash, display_name, first_name, last_name, role, is_active, created_at, updated_at)
    VALUES ('relay-cashier', 'system-tinambac', 'relay-cashier', 'test', 'Relay Cashier', 'Relay', 'Cashier', 'CASHIER', 1, ?, ?)`
  ).run(now, now)
  const auth = new AuthService(new UserRepository(db))
  auth.session = {
    id: 'relay-cashier',
    role: 'CASHIER',
    branch: 'Tinambac',
    branchId: 'system-tinambac'
  }
  const sheets = {
    ensureTabs: async () => {
      throw new Error('offline')
    },
    values: async () => [],
    updateValues: async () => undefined,
    appendValues: async () => undefined
  }
  const cachedRecord = {
    account: { id: 'collector-account', branch: 'Goa', firstName: 'Remote', lastName: 'Customer' },
    loan: {
      id: 'collector-contract',
      installmentAmount: 20,
      grandTotal: 160,
      firstDueDate: '2026-01-01',
      paymentFrequency: 'Monthly',
      terms: '8'
    },
    accountStatus: 'ACTIVE',
    contractStatus: 'ACTIVE',
    contractId: 'collector-contract',
    meta: { grandTotal: 160 }
  }
  const relay = new CrossBranchPaymentRelayService(
    db,
    sheets,
    auth,
    repository,
    async () => [cachedRecord],
    () => ({
      account: cachedRecord.account,
      loan: cachedRecord.loan,
      accountStatus: 'ACTIVE',
      contractId: cachedRecord.contractId,
      contractNumber: 'GOA-001',
      contractStatus: 'ACTIVE',
      paymentFrequency: 'Monthly',
      installmentAmountCentavos: 2000,
      totalPayableCentavos: 16000,
      totalPaidCentavos: 1250,
      outstandingBalanceCentavos: 14750,
      schedules: [
        {
          id: 'owner-schedule-1',
          installmentNumber: 1,
          dueDate: '2026-01-01',
          remainingDueCentavos: 750,
          dueAmountCentavos: 2000,
          paidAmountCentavos: 1250,
          balanceCentavos: 14750,
          penaltyCentavos: 0,
          status: 'PARTIALLY_PAID',
          isService: false,
          isAdjusted: false
        }
      ],
      payments: [
        {
          id: 'owner-payment-1',
          sourceSubmissionId: 'owner-event-1',
          paymentDate: '2026-01-01',
          amountCentavos: 1250,
          paymentMethod: 'Cash',
          penaltyCentavos: 0,
          allocatedAmountCentavos: 1250,
          status: 'POSTED',
          isAdjustment: false,
          createdAt: now,
          updatedByName: 'Owner Cashier',
          paymentIds: ['owner-payment-1'],
          scheduleIds: ['owner-schedule-1']
        }
      ]
    })
  )
  const collectionRequest = {
    accountId: 'collector-account',
    contractId: 'collector-contract',
    scheduleId: 'owner-schedule-1',
    submissionId: 'offline-event-1',
    paymentDate: '2026-01-02',
    amountCentavos: 500,
    penaltyCentavos: 50,
    paymentMethod: 'GCash',
    actorUserId: 'untrusted-renderer-user'
  }
  await relay.createCollection(collectionRequest)
  await relay.createCollection(collectionRequest)
  const collectionReportId = db
    .prepare('SELECT daily_report_id FROM cross_branch_collections WHERE id = ?')
    .get('offline-event-1').daily_report_id
  const collectionSnapshot = new DailyReportRepository(db).snapshot(collectionReportId)
  assert.equal(collectionSnapshot.cashCollectionsCentavos, 550)
  assert.equal(collectionSnapshot.collectionDetails[0].amountCentavos, 550)
  const expenseRepository = new ExpenseRepository(db)
  assert.equal(expenseRepository.findSummaryTotals(collectionReportId).drawingsCentavos, 550)
  const drawings = expenseRepository.findPage({
    reportId: collectionReportId,
    includeVoided: false,
    pageIndex: 0,
    pageSize: 50,
    search: '',
    sorting: [],
    filters: {}
  })
  assert.equal(drawings.totalRows, 1)
  assert.equal(drawings.rows[0].type, 'Drawings')
  assert.equal(drawings.rows[0].amountCentavos, 550)
  assert.equal(
    db.prepare('SELECT schedule_id FROM cross_branch_collections').get().schedule_id,
    'collector-contract-schedule-1'
  )
  const workspace = await relay.remoteWorkspace('collector-account')
  assert.equal(workspace.schedules[0].id, 'owner-schedule-1')
  assert.equal(workspace.schedules[0].status, 'PENDING')
  const relayedPayment = workspace.payments.find((payment) => payment.id === 'offline-event-1')
  assert.equal(relayedPayment.updatedByName, 'Relay Cashier')
  assert.deepEqual(relayedPayment.scheduleIds, ['owner-schedule-1'])
  assert.equal(workspace.contractNumber, 'GOA-001')
  assert.equal(
    workspace.payments.some((payment) => payment.updatedByName === 'Owner Cashier'),
    true
  )
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM cross_branch_collections').get().count, 1)
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM cross_branch_relay_outbox').get().count, 1)
  assert.equal(
    db
      .prepare(
        "SELECT COUNT(*) AS count FROM expenses WHERE source_reference = 'cross-branch:offline-event-1'"
      )
      .get().count,
    1
  )
  db.close()
} finally {
  rmSync(output, { recursive: true, force: true })
}
