import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const output = resolve(root, '.google-drive-records-test-build')
const work = mkdtempSync(join(tmpdir(), 'cashiers-drive-records-'))
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
      resolve(root, 'src/main/database/database.ts'),
      resolve(root, 'src/main/database/migrations.ts'),
      resolve(root, 'src/main/database/user-repository.ts'),
      resolve(root, 'src/main/database/installment-repository.ts'),
      resolve(root, 'src/main/services/auth-service.ts'),
      resolve(root, 'src/main/services/backup-service.ts'),
      resolve(root, 'src/main/services/google-drive-snapshot-service.ts')
    ],
    { stdio: 'inherit' }
  )
  const Database = require('better-sqlite3')
  const { runMigrations } = require(resolve(output, 'main/database/migrations.js'))
  const { UserRepository } = require(resolve(output, 'main/database/user-repository.js'))
  const { InstallmentRepository } = require(
    resolve(output, 'main/database/installment-repository.js')
  )
  const { AuthService } = require(resolve(output, 'main/services/auth-service.js'))
  const { BackupService } = require(resolve(output, 'main/services/backup-service.js'))
  const { GoogleDriveSnapshotService } = require(
    resolve(output, 'main/services/google-drive-snapshot-service.js')
  )
  const sourcePath = join(work, 'goa.db')
  const source = new Database(sourcePath)
  runMigrations(source)
  new InstallmentRepository(source).bootstrap({
    accounts: [
      {
        id: 'goa-account',
        branch: 'Goa',
        firstName: 'Goa',
        lastName: 'Client',
        barangay: 'Barangay',
        cityMunicipality: 'Goa',
        province: 'Camarines Sur',
        contacts: [],
        emails: [],
        createdAt: '2026-01-01T00:00:00.000Z'
      }
    ],
    loans: [
      {
        id: 'goa-contract',
        customerId: 'goa-account',
        dateReleased: '2026-01-01',
        paymentFrequency: 'Weekly',
        terms: '8',
        downPayment: 0,
        items: [{ id: 'goa-item', name: 'Item', quantity: 1, price: 10000 }],
        createdAt: '2026-01-01T00:00:00.000Z'
      }
    ]
  })
  source.close()
  const live = new Database(':memory:')
  runMigrations(live)
  live
    .prepare(
      "INSERT INTO app_settings (key, value, updated_at) VALUES ('cashier_login_branch', 'Lagonoy', '2026-01-01T00:00:00.000Z')"
    )
    .run()
  const users = new UserRepository(live)
  users.createAccount({
    username: 'lagonoy-cashier',
    password: 'cashier123',
    branch: 'Lagonoy',
    role: 'CASHIER'
  })
  const auth = new AuthService(users)
  await auth.login({ username: 'lagonoy-cashier', password: 'cashier123' })
  process.env.CASHIERS_BACKUP_KEY = 'test-only-key'
  const backup = new BackupService(live, sourcePath)
  const snapshot = await backup.create(sourcePath, work)
  live
    .prepare(
      "INSERT INTO google_drive_snapshots (branch, remote_revision) VALUES ('Goa', 'same-revision')"
    )
    .run()
  const service = new GoogleDriveSnapshotService(
    live,
    sourcePath,
    work,
    backup,
    {
      findDriveFile: async () => ({
        id: 'goa-snapshot',
        version: 'same-revision',
        appProperties: { branch: 'Goa', sha256: snapshot.sha256 }
      }),
      downloadDriveFile: async () => readFileSync(snapshot.filePath)
    },
    auth
  )
  await service.syncBranch('Goa')
  assert.equal(
    live
      .prepare(
        "SELECT COUNT(*) AS count FROM google_sheet_branch_cache WHERE source_branch = 'Goa' AND sheet_name = 'Records'"
      )
      .get().count,
    1
  )
  live.close()
  console.log('google drive record cache tests passed')
} finally {
  if (existsSync(output)) rmSync(output, { recursive: true, force: true })
  rmSync(work, { recursive: true, force: true })
}
