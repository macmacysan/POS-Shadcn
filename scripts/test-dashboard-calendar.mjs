import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const output = resolve(root, '.dashboard-calendar-test-build')
const require = createRequire(import.meta.url)
const compile = [
  resolve(root, 'src/main/database/migrations.ts'),
  resolve(root, 'src/main/database/user-repository.ts'),
  resolve(root, 'src/main/database/daily-report-repository.ts'),
  resolve(root, 'src/main/database/dashboard-repository.ts')
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
  const { DailyReportRepository } = require(
    resolve(output, 'main/database/daily-report-repository.js')
  )
  const { DashboardRepository } = require(resolve(output, 'main/database/dashboard-repository.js'))

  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db)

  const users = new UserRepository(db)
  users.setCashierLoginBranch('Tinambac')
  users.createAccount({
    username: 'dashboard-calendar-cashier',
    password: 'cashier123',
    branch: 'Tinambac',
    role: 'CASHIER'
  })
  const cashier = users.authenticate({
    username: 'dashboard-calendar-cashier',
    password: 'cashier123'
  })
  const reports = new DailyReportRepository(db)
  reports.resolveActive(
    {
      branchId: cashier.branchId,
      cashierUserId: cashier.id,
      businessDate: '2026-08-27'
    },
    cashier.id
  )

  const dashboard = new DashboardRepository(db)
  const branchOverview = dashboard.getOverview('2026-08-27', 7, {
    branch: 'Tinambac',
    label: 'Tinambac Branch'
  })
  assert.equal(branchOverview.reportCalendar?.month, '2026-08')
  assert.deepEqual(branchOverview.reportCalendar?.days, [
    {
      businessDate: '2026-08-27',
      status: 'DRAFT',
      hasCashCount: false,
      expectedCashCentavos: 0,
      physicalCashCentavos: 0,
      cashVarianceCentavos: 0
    }
  ])
  assert.equal(
    dashboard.getOverview('2026-08-27', 7, { branch: null, label: 'All branches' }).reportCalendar,
    null
  )

  db.close()
  console.log('dashboard calendar tests passed')
} finally {
  if (existsSync(output)) rmSync(output, { recursive: true, force: true })
}
