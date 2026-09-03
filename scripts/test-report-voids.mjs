import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const output = resolve(root, '.report-voids-test-build')
const require = createRequire(import.meta.url)
const compile = [
  resolve(root, 'src/main/database/migrations.ts'),
  resolve(root, 'src/main/database/user-repository.ts'),
  resolve(root, 'src/main/database/expense-repository.ts'),
  resolve(root, 'src/main/database/daily-report-repository.ts'),
  resolve(root, 'src/main/services/auth-service.ts'),
  resolve(root, 'src/main/services/expense-service.ts'),
  resolve(root, 'src/main/services/daily-report-service.ts')
]

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
      ...compile
    ],
    { stdio: 'inherit' }
  )

  const Database = require('better-sqlite3')
  const { runMigrations } = require(resolve(output, 'main/database/migrations.js'))
  const { UserRepository } = require(resolve(output, 'main/database/user-repository.js'))
  const { ExpenseRepository } = require(resolve(output, 'main/database/expense-repository.js'))
  const { DailyReportRepository } = require(
    resolve(output, 'main/database/daily-report-repository.js')
  )
  const { AuthService } = require(resolve(output, 'main/services/auth-service.js'))
  const { ExpenseService } = require(resolve(output, 'main/services/expense-service.js'))
  const { DailyReportService } = require(resolve(output, 'main/services/daily-report-service.js'))

  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db)
  assert.equal(
    db.prepare('SELECT MAX(version) AS version FROM schema_migrations').get().version,
    40
  )
  runMigrations(db)
  const users = new UserRepository(db)
  const expenses = new ExpenseRepository(db)
  const dailyReports = new DailyReportRepository(db)
  const auth = new AuthService(users)
  const expenseService = new ExpenseService(expenses, auth)
  const dailyReportService = new DailyReportService(dailyReports, auth)

  users.setCashierLoginBranch('Tinambac')
  users.createAccount({
    username: 'void-cashier',
    password: 'cashier123',
    branch: 'Tinambac',
    role: 'CASHIER'
  })
  users.createAccount({
    username: 'void-admin',
    password: 'admin123',
    branch: 'Tinambac',
    role: 'ADMIN'
  })

  const cashier = await auth.login({ username: 'void-cashier', password: 'cashier123' })
  const report = dailyReports.resolveActive(
    {
      branchId: cashier.branchId,
      cashierUserId: cashier.id,
      businessDate: '2026-08-27'
    },
    cashier.id
  )
  const googleDriveDelivery = dailyReportService.markDelivery({
    dailyReportId: report.id,
    channel: 'GOOGLE_DRIVE'
  })
  const telegramDelivery = dailyReportService.markDelivery({
    dailyReportId: report.id,
    channel: 'TELEGRAM'
  })
  assert.ok(googleDriveDelivery.googleDriveSubmittedAt)
  assert.equal(googleDriveDelivery.telegramSubmittedAt, null)
  assert.ok(telegramDelivery.googleDriveSubmittedAt)
  assert.ok(telegramDelivery.telegramSubmittedAt)
  assert.deepEqual(
    dailyReportService
      .listCalendar({
        branchId: cashier.branchId,
        cashierUserId: cashier.id,
        month: '2026-08'
      })
      .rows.map(({ googleDriveSubmittedAt, telegramSubmittedAt }) => ({
        googleDriveSubmittedAt: Boolean(googleDriveSubmittedAt),
        telegramSubmittedAt: Boolean(telegramSubmittedAt)
      })),
    [{ googleDriveSubmittedAt: true, telegramSubmittedAt: true }]
  )
  users.createAccount({
    username: 'branch-cashier',
    password: 'cashier123',
    branch: 'Tinambac',
    role: 'CASHIER'
  })
  const branchCashier = db.prepare('SELECT id FROM users WHERE username = ?').get('branch-cashier')
  dailyReports.resolveActive(
    {
      branchId: cashier.branchId,
      cashierUserId: branchCashier.id,
      businessDate: '2026-08-28'
    },
    branchCashier.id
  )
  assert.equal(
    dailyReportService.listCalendar({
      branchId: cashier.branchId,
      cashierUserId: cashier.id,
      month: '2026-08'
    }).rows.length,
    2
  )
  const categoryId = db
    .prepare('SELECT id FROM income_categories WHERE is_active = 1 LIMIT 1')
    .get().id
  const paymentMethodId = db
    .prepare('SELECT id FROM report_payment_methods WHERE is_active = 1 LIMIT 1')
    .get().id

  const expense = expenseService.create({
    reportId: report.id,
    type: 'Operating',
    description: 'Void test expense',
    category: 'Others',
    receiptNo: 'VOID-EXPENSE',
    vat: 'Non-VAT',
    amountCentavos: 12500
  })
  const income = dailyReportService.createIncome({
    dailyReportId: report.id,
    categoryId,
    transactionDate: '2026-08-27',
    particular: 'Void test income',
    receiptNumber: null,
    remarks: null,
    amountCentavos: 22500
  })
  const payment = dailyReportService.createPayment({
    dailyReportId: report.id,
    paymentMethodId,
    transactionDate: '2026-08-27',
    amountCentavos: 32500,
    referenceNumber: null,
    bankName: null,
    payerName: null,
    remarks: null
  })

  await expenseService.void([expense.id], 'Entered in error')
  await dailyReportService.voidIncome({ id: income.id, voidReason: 'Entered in error' })
  await dailyReportService.voidPayment({ id: payment.id, voidReason: 'Entered in error' })

  assert.equal(expenses.findById(expense.id).status, 'VOIDED')
  assert.equal(
    dailyReports.listIncome({ dailyReportId: report.id, status: 'VOIDED' })[0].voidReason,
    'Entered in error'
  )
  assert.equal(
    dailyReports.listPayments({ dailyReportId: report.id, status: 'VOIDED' })[0].voidReason,
    'Entered in error'
  )
  assert.deepEqual(expenses.findSummaryTotals(report.id), {
    companyExpensesCentavos: 0,
    drawingsCentavos: 0,
    purchasesCentavos: 0,
    receivablesCentavos: 0
  })
  assert.equal(
    expenseService.list({
      reportId: report.id,
      includeVoided: true,
      branch: 'Tinambac',
      dateFrom: '2026-08-27',
      dateTo: '2026-08-27',
      pageIndex: 0,
      pageSize: 50,
      search: '',
      sorting: [],
      filters: {}
    }).totalRows,
    1
  )
  assert.equal(dailyReportService.listIncome({ dailyReportId: report.id }).rows.length, 0)
  assert.equal(dailyReportService.listPayments({ dailyReportId: report.id }).rows.length, 0)
  assert.equal(
    dailyReportService.listIncome({ dailyReportId: report.id, includeVoided: true }).rows[0].status,
    'VOIDED'
  )
  assert.equal(
    dailyReportService.listPayments({ dailyReportId: report.id, includeVoided: true }).rows[0]
      .status,
    'VOIDED'
  )

  await auth.logout()
  await auth.login({ username: 'void-admin', password: 'admin123' })
  assert.equal(
    dailyReportService.listCalendar({
      branchId: cashier.branchId,
      cashierUserId: cashier.id,
      month: '2026-08'
    }).rows.length,
    2
  )
  assert.equal(
    expenseService.list({
      reportId: report.id,
      includeVoided: true,
      branch: 'Tinambac',
      dateFrom: '2026-08-27',
      dateTo: '2026-08-27',
      pageIndex: 0,
      pageSize: 50,
      search: '',
      sorting: [],
      filters: {}
    }).totalRows,
    1
  )
  assert.equal(dailyReportService.listIncome({ dailyReportId: report.id }).rows[0].status, 'VOIDED')
  assert.equal(
    dailyReportService.listPayments({ dailyReportId: report.id }).rows[0].status,
    'VOIDED'
  )
  assert.equal(
    db
      .prepare(
        'SELECT action, reason FROM audit_logs WHERE entity_id = ? ORDER BY created_at DESC LIMIT 1'
      )
      .get(expense.id).action,
    'VOIDED'
  )

  db.close()
  console.log('report void tests passed')
} finally {
  if (existsSync(output)) rmSync(output, { recursive: true, force: true })
}
