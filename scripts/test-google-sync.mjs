import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const output = resolve(root, '.google-sync-test-build')
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
      resolve(root, 'src/main/database/user-repository.ts'),
      resolve(root, 'src/main/database/expense-repository.ts'),
      resolve(root, 'src/main/database/daily-report-repository.ts'),
      resolve(root, 'src/main/services/auth-service.ts'),
      resolve(root, 'src/main/services/expense-service.ts'),
      resolve(root, 'src/main/services/daily-report-service.ts'),
      resolve(root, 'src/main/services/google-sheet-sync-service.ts')
    ],
    { stdio: 'inherit' }
  )
  const Database = require('better-sqlite3')
  const { runMigrations } = require(resolve(output, 'main/database/migrations.js'))
  const { UserRepository } = require(resolve(output, 'main/database/user-repository.js'))
  const { AuthService } = require(resolve(output, 'main/services/auth-service.js'))
  const { GoogleSheetSyncService } = require(
    resolve(output, 'main/services/google-sheet-sync-service.js')
  )
  const { ExpenseRepository } = require(resolve(output, 'main/database/expense-repository.js'))
  const { ExpenseService } = require(resolve(output, 'main/services/expense-service.js'))
  const { DailyReportRepository } = require(resolve(output, 'main/database/daily-report-repository.js'))
  const { DailyReportService } = require(resolve(output, 'main/services/daily-report-service.js'))
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db)
  runMigrations(db)
  const users = new UserRepository(db)
  users.createAccount({
    username: 'goa-cashier',
    password: 'cashier123',
    branch: 'Goa',
    role: 'CASHIER'
  })
  users.createAccount({
    username: 'admin',
    password: 'admin123',
    branch: 'Goa',
    role: 'ADMIN'
  })
  const auth = new AuthService(users)
  await auth.login({ username: 'goa-cashier', password: 'cashier123' })

  const sheetRows = {
    'Income!A:ZZ': [
      ['id', 'dailyReportId', 'categoryId', 'transactionDate', 'particular', 'receiptNumber', 'remarks', 'amountCentavos', 'status', 'voidedAt', 'voidedByUserId', 'voidReason', 'createdByUserId', 'createdByName', 'createdByFirstName', 'createdAt', 'updatedAt'],
      ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000021', '2026-08-30', 'Google income', 'OR-100', '', '10000', 'POSTED', '', '', '', '00000000-0000-4000-8000-000000000031', 'Goa Cashier', 'Goa', '2026-08-30T00:00:00.000Z', '2026-08-30T00:00:00.000Z']
    ],
    'Expenses!A:ZZ': [
      [
        'id',
        'reportId',
        'branch',
        'type',
        'description',
        'category',
        'receiptNo',
        'vat',
        'amountCentavos',
        'createdAt',
        'updatedAt',
        'status',
        'voidedAt',
        'voidedByUserId',
        'voidReason',
        'createdByUserId',
        'createdByName',
        'createdByFirstName',
        'cashierUserId',
        'cashierName',
        'businessDate'
      ],
      [
        'expense-1',
        'report-1',
        'Goa',
        'Company Expenses',
        'Sample Goa expense',
        'Office Expenses and Supplies',
        'OR-001',
        'VAT',
        '5000',
        '2026-08-30T00:00:00.000Z',
        '2026-08-30T00:00:00.000Z',
        'POSTED',
        '',
        '',
        '',
        'cashier-1',
        'Goa Cashier',
        'Goa',
        'cashier-1',
        'Goa Cashier',
        '2026-08-30'
      ],
      [
        'expense-2',
        'report-1',
        'Goa',
        'Company Expenses',
        'Second Goa expense',
        'Office Expenses and Supplies',
        'OR-002',
        'VAT',
        '6000',
        '2026-08-30T00:00:00.000Z',
        '2026-08-30T00:00:00.000Z',
        'POSTED',
        '',
        '',
        '',
        'cashier-1',
        'Goa Cashier',
        'Goa',
        'cashier-1',
        'Goa Cashier',
        '2026-08-30'
      ],
      [
        'expense-3',
        'report-1',
        'Goa',
        'Company Expenses',
        'Third Goa expense',
        'Office Expenses and Supplies',
        'OR-003',
        'VAT',
        '7000',
        '2026-08-30T00:00:00.000Z',
        '2026-08-30T00:00:00.000Z',
        'POSTED',
        '',
        '',
        '',
        'cashier-1',
        'Goa Cashier',
        'Goa',
        'cashier-1',
        'Goa Cashier',
        '2026-08-30'
      ]
    ],
    'Payments!A:ZZ': [
      ['id', 'daily_report_id', 'payment_method_id', 'payment_method_name', 'transaction_date', 'amount_centavos', 'reference_number', 'bank_name', 'payer_name', 'remarks', 'status', 'voided_at', 'voided_by_user_id', 'void_reason', 'created_by_user_id', 'created_by_name', 'created_by_first_name', 'created_at', 'updated_at'],
      ['00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000022', 'GCash', '2026-08-30', '7500', 'REF-100', '', 'Goa Customer', '', 'POSTED', '', '', '', '00000000-0000-4000-8000-000000000032', 'Goa Cashier', 'Goa', '2026-08-30T00:00:00.000Z', '2026-08-30T00:00:00.000Z']
    ],
    'Payment!A:ZZ': [
      ['id', 'daily_report_id', 'payment_method_id', 'payment_method_name', 'transaction_date', 'amount_centavos', 'reference_number', 'bank_name', 'payer_name', 'remarks', 'status', 'voided_at', 'voided_by_user_id', 'void_reason', 'created_by_user_id', 'created_by_name', 'created_by_first_name', 'created_at', 'updated_at'],
      ['00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000022', 'GCash', '2026-08-30', '7500', 'REF-100', '', 'Goa Customer', '', 'POSTED', '', '', '', '00000000-0000-4000-8000-000000000032', 'Goa Cashier', 'Goa', '2026-08-30T00:00:00.000Z', '2026-08-30T00:00:00.000Z']
    ],
    'Records!A:ZZ': [['id'], ['record-1']],
    'Finance!A:ZZ': [['id'], ['finance-1']],
    'REPORTS!A:Z': []
  }
  let expenseAttempts = 0
  const sheets = {
    values: async (_spreadsheetId, range) => {
      if (range === 'Expenses!A:ZZ' && expenseAttempts++ === 0)
        throw new Error('Temporary Google Sheets error')
      return sheetRows[range] ?? []
    }
  }
  const progress = []
  const sync = new GoogleSheetSyncService(db, sheets, auth, (event) => progress.push(event))

  await sync.syncBranch('Goa')
  const cachedSheets = db
    .prepare('SELECT DISTINCT sheet_name FROM google_sheet_branch_cache ORDER BY sheet_name')
    .all()
    .map((row) => row.sheet_name)
  assert.deepEqual(cachedSheets, ['Expenses', 'Finance', 'Income', 'Payment', 'Payments', 'Records'])
  const expenses = new ExpenseService(new ExpenseRepository(db), auth).list({
    reportId: '00000000-0000-4000-8000-000000000099',
    branch: 'Goa',
    dateFrom: '2026-08-30',
    dateTo: '2026-08-30',
    includeVoided: false,
    pageIndex: 0,
    pageSize: 15,
    search: '',
    sorting: [],
    filters: {}
  })
  assert.equal(expenses.totalRows, 3)
  assert.deepEqual(
    expenses.rows.map((expense) => expense.description).sort(),
    ['Sample Goa expense', 'Second Goa expense', 'Third Goa expense']
  )
  assert.equal(expenses.rows.every((expense) => expense.source === 'google-cache'), true)
  assert.equal(
    db.prepare("SELECT source_branch FROM google_sheet_branch_cache WHERE sheet_name = 'Income'").get()
      .source_branch,
    'Goa'
  )
  const failedDownloadProgress = []
  const syncWithPermanentFailure = new GoogleSheetSyncService(
    db,
    {
      values: async (_spreadsheetId, range) => {
        if (range === 'Finance!A:ZZ') throw new Error('Google Sheets is unavailable')
        return sheetRows[range] ?? []
      }
    },
    auth,
    (event) => failedDownloadProgress.push(event)
  )
  await syncWithPermanentFailure.syncBranch('Tinambac')
  assert.equal(
    failedDownloadProgress.some(
      (event) => event.sheet === 'Finance' && event.phase === 'failed'
    ),
    true
  )
  assert.equal(
    failedDownloadProgress.at(-1).completed,
    failedDownloadProgress.at(-1).total
  )
  const reports = new DailyReportService(new DailyReportRepository(db), auth)
  assert.equal(reports.listIncome({ branch: 'Goa', status: 'POSTED' }).rows[0].source, 'google-cache')
  assert.equal(reports.listPayments({ branch: 'Goa', status: 'POSTED' }).rows[0].source, 'google-cache')
  const adminAuth = new AuthService(users)
  await adminAuth.login({ username: 'admin', password: 'admin123' })
  assert.throws(
    () =>
      new ExpenseService(new ExpenseRepository(db), adminAuth).list({
        includeVoided: false,
        pageIndex: 0,
        pageSize: 15,
        search: '',
        sorting: [],
        filters: {}
      }),
    /only access application settings/
  )
  assert.equal(
    progress.some((event) => event.sheet === 'Expenses' && event.phase === 'retrying'),
    true
  )
  for (const sheet of ['Income', 'Expenses', 'Payment', 'Payments', 'Records', 'Finance']) {
    assert.equal(
      progress.some(
        (event) =>
          event.sheet === sheet &&
          event.phase === 'completed' &&
          event.rowCount === (sheet === 'Expenses' ? 3 : 1)
      ),
      true
    )
  }
  assert.equal(progress.at(-1).completed, progress.at(-1).total)
  db.close()
  console.log('google sync tests passed')
} finally {
  if (existsSync(output)) rmSync(output, { recursive: true, force: true })
}
