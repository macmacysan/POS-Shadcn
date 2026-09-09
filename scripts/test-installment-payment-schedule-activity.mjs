import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const output = resolve(root, '.installment-payment-schedule-activity-test-build')
const require = createRequire(import.meta.url)

try {
  execFileSync(process.execPath, [
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
  ])
  const Database = require('better-sqlite3')
  const { runMigrations } = require(resolve(output, 'main/database/migrations.js'))
  const { InstallmentRepository } = require(
    resolve(output, 'main/database/installment-repository.js')
  )
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db)
  const repository = new InstallmentRepository(db)
  const now = '2026-09-01T00:00:00.000Z'

  repository.bootstrap({
    accounts: [
      {
        id: 'schedule-account',
        branch: 'Goa',
        firstName: 'Schedule',
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
        id: 'schedule-contract',
        customerId: 'schedule-account',
        dateReleased: '2026-09-01',
        paymentFrequency: 'Monthly',
        terms: '3',
        downPayment: 0,
        items: [{ id: 'schedule-item', name: 'Test', model: 'Test', quantity: 1, price: 10000 }],
        createdAt: now
      }
    ]
  })

  const schedules = db
    .prepare(
      'SELECT id, installment_number, due_amount_centavos FROM in_house_schedules WHERE contract_id = ? ORDER BY installment_number'
    )
    .all('schedule-contract')
  const [first, second, third] = schedules
  const firstPartOfSecond = Math.floor(second.due_amount_centavos / 2)
  const secondPartOfSecond = second.due_amount_centavos - firstPartOfSecond
  const partialThird = Math.floor(third.due_amount_centavos / 2)
  const insertPayment = db.prepare(
    `INSERT INTO in_house_payments
      (id, contract_id, payment_date, amount_centavos, reference_number, status, created_at, updated_at)
     VALUES (?, 'schedule-contract', ?, ?, ?, 'POSTED', ?, ?)`
  )
  const insertAllocation = db.prepare(
    `INSERT INTO installment_payment_allocations
      (id, payment_id, schedule_id, allocated_amount_centavos, penalty_centavos, created_at)
     VALUES (?, ?, ?, ?, 0, ?)`
  )
  insertPayment.run(
    'payment-a',
    '2026-08-05',
    first.due_amount_centavos + firstPartOfSecond,
    '123455',
    now,
    now
  )
  insertPayment.run(
    'payment-b',
    '2026-09-09',
    secondPartOfSecond + partialThird,
    '123456',
    now,
    now
  )
  insertAllocation.run('allocation-a1', 'payment-a', first.id, first.due_amount_centavos, now)
  insertAllocation.run('allocation-a2', 'payment-a', second.id, firstPartOfSecond, now)
  insertAllocation.run('allocation-b2', 'payment-b', second.id, secondPartOfSecond, now)
  insertAllocation.run('allocation-b3', 'payment-b', third.id, partialThird, now)
  db.prepare("UPDATE in_house_schedules SET status = 'PAID' WHERE id IN (?, ?)").run(
    first.id,
    second.id
  )
  db.prepare("UPDATE in_house_schedules SET status = 'PARTIALLY_PAID' WHERE id = ?").run(third.id)
  db.prepare(
    `INSERT INTO in_house_schedules
      (id, contract_id, installment_number, due_date, due_amount_centavos, status, created_at, updated_at)
     VALUES ('schedule-upcoming', 'schedule-contract', 4, '2026-12-01', ?, 'DUE', ?, ?)`
  ).run(third.due_amount_centavos, now, now)

  const workspace = repository.getPaymentWorkspace({ accountId: 'schedule-account' })
  const secondSchedule = workspace.schedules.find((schedule) => schedule.id === second.id)
  const thirdSchedule = workspace.schedules.find((schedule) => schedule.id === third.id)
  const firstSchedule = workspace.schedules.find((schedule) => schedule.id === first.id)
  const fourthSchedule = workspace.schedules.find((schedule) => schedule.id === 'schedule-upcoming')
  assert.equal(firstSchedule?.paidAmountCentavos, first.due_amount_centavos)
  assert.equal(firstSchedule?.remainingDueCentavos, 0)
  assert.equal(firstSchedule?.lastAppliedDate, '2026-08-05')
  assert.equal(secondSchedule?.paidAmountCentavos, second.due_amount_centavos)
  assert.equal(secondSchedule?.remainingDueCentavos, 0)
  assert.equal(secondSchedule?.lastAppliedDate, '2026-09-09')
  assert.equal(thirdSchedule?.paidAmountCentavos, partialThird)
  assert.equal(thirdSchedule?.remainingDueCentavos, third.due_amount_centavos - partialThird)
  assert.equal(thirdSchedule?.lastAppliedDate, '2026-09-09')
  assert.equal(workspace.nextDue?.installmentNumber, thirdSchedule?.installmentNumber)
  assert.equal(fourthSchedule?.paidAmountCentavos, 0)
  assert.equal(fourthSchedule?.remainingDueCentavos, third.due_amount_centavos)
  assert.equal(fourthSchedule?.lastAppliedDate, undefined)

  insertPayment.run('payment-b-split', '2026-09-09', 1, '123457', now, now)
  db.prepare("UPDATE in_house_payments SET replaces_payment_id = 'payment-b' WHERE id = 'payment-b-split'").run()
  insertAllocation.run('allocation-b-split', 'payment-b-split', third.id, 1, now)
  const splitWorkspace = repository.getPaymentWorkspace({ accountId: 'schedule-account' })
  assert.equal(splitWorkspace.payments.length, 2)
  assert.equal(
    splitWorkspace.payments.find((payment) => payment.id === 'payment-b-split')?.amountCentavos,
    secondPartOfSecond + partialThird + 1
  )
  assert.deepEqual(
    splitWorkspace.payments.find((payment) => payment.id === 'payment-b-split')?.paymentIds.sort(),
    ['payment-b', 'payment-b-split']
  )
  const adjustedAmount = third.due_amount_centavos + 100000
  repository.adjustPayment({
    accountId: 'schedule-account',
    contractId: 'schedule-contract',
    paymentId: 'payment-b',
    scheduleId: third.id,
    submissionId: 'schedule-adjustment',
    paymentDate: '2026-10-01',
    amountCentavos: adjustedAmount,
    penaltyCentavos: 0,
    reason: 'Allocation cap regression test',
    actorUserId: null
  })

  const adjustedWorkspace = repository.getPaymentWorkspace({ accountId: 'schedule-account' })
  const adjustedThird = adjustedWorkspace.schedules.find((schedule) => schedule.id === third.id)
  const adjustedFourth = adjustedWorkspace.schedules.find(
    (schedule) => schedule.id === 'schedule-upcoming'
  )
  assert.equal(adjustedThird?.paidAmountCentavos, third.due_amount_centavos)
  assert.equal(adjustedThird?.remainingDueCentavos, 0)
  assert.equal(adjustedThird?.status, 'PAID')
  assert.equal(adjustedFourth?.paidAmountCentavos, 100000)
  assert.equal(adjustedFourth?.remainingDueCentavos, third.due_amount_centavos - 100000)
  assert.equal(adjustedFourth?.status, 'PARTIALLY_PAID')
  assert.equal(adjustedWorkspace.nextDue?.installmentNumber, secondSchedule?.installmentNumber)
  assert.equal(adjustedWorkspace.nextDue?.amountCentavos, secondPartOfSecond)
  const maximumOverAllocation = db
    .prepare(
      `SELECT MAX(MAX(0, paid_amount_centavos - due_amount_centavos)) AS value
         FROM (
           SELECT s.due_amount_centavos,
                  COALESCE(SUM(CASE WHEN p.status = 'POSTED' THEN pa.allocated_amount_centavos ELSE 0 END), 0)
                    AS paid_amount_centavos
             FROM in_house_schedules s
             LEFT JOIN installment_payment_allocations pa ON pa.schedule_id = s.id
             LEFT JOIN in_house_payments p ON p.id = pa.payment_id
            WHERE s.contract_id = 'schedule-contract'
            GROUP BY s.id
         )`
    )
    .get()
  assert.equal(maximumOverAllocation.value, 0)
  const totals = db
    .prepare(
      `SELECT
         (SELECT COALESCE(SUM(amount_centavos), 0) FROM in_house_payments WHERE status = 'POSTED') AS received,
         (SELECT COALESCE(SUM(pa.allocated_amount_centavos), 0)
            FROM installment_payment_allocations pa
            JOIN in_house_payments p ON p.id = pa.payment_id
           WHERE p.status = 'POSTED') AS allocated`
    )
    .get()
  assert.equal(totals.received, totals.allocated)
  const replacementPayments = db
    .prepare(
      `SELECT COUNT(*) AS count, MAX(amount_centavos) AS amount_centavos
         FROM in_house_payments
        WHERE replaces_payment_id = 'payment-b' AND status = 'POSTED'`
    )
    .get()
  assert.equal(replacementPayments.count, 1)
  assert.equal(replacementPayments.amount_centavos, adjustedAmount)
  assert.equal(adjustedWorkspace.payments.length, 2)
  assert.equal(
    adjustedWorkspace.payments.filter((payment) => payment.amountCentavos === adjustedAmount).length,
    1
  )
  repository.createPayment({
    accountId: 'schedule-account',
    contractId: 'schedule-contract',
    scheduleId: 'schedule-upcoming',
    submissionId: 'payment-remarks',
    paymentDate: '2026-10-02',
    amountCentavos: 1,
    penaltyCentavos: 0,
    referenceNumber: '123458',
    remarks: 'Payment remark',
    actorUserId: null
  })
  assert.equal(
    repository
      .getPaymentWorkspace({ accountId: 'schedule-account' })
      .payments.find((payment) => payment.referenceNumber === '123458')?.remarks,
    'Payment remark'
  )
  db.close()
  console.log('installment payment schedule activity tests passed')
} finally {
  if (existsSync(output)) rmSync(output, { recursive: true, force: true })
}
