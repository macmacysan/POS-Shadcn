import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const output = resolve(root, '.initial-recovery-test-build')
const work = mkdtempSync(join(tmpdir(), 'cashiers-initial-recovery-'))
const require = createRequire(import.meta.url)

try {
  execFileSync(process.execPath, [
    resolve(root, 'node_modules/typescript/bin/tsc'), '--target', 'ES2022', '--module', 'commonjs',
    '--esModuleInterop', '--skipLibCheck', '--rootDir', resolve(root, 'src'), '--outDir', output,
    resolve(root, 'src/main/database/database.ts'), resolve(root, 'src/main/database/migrations.ts'),
    resolve(root, 'src/main/services/auth-service.ts'), resolve(root, 'src/main/services/backup-service.ts'),
    resolve(root, 'src/main/services/google-drive-snapshot-service.ts')
  ], { stdio: 'inherit' })
  const Database = require('better-sqlite3')
  const { runMigrations } = require(resolve(output, 'main/database/migrations.js'))
  const { BackupService } = require(resolve(output, 'main/services/backup-service.js'))
  const { GoogleDriveSnapshotService } = require(resolve(output, 'main/services/google-drive-snapshot-service.js'))
  const { AuthService } = require(resolve(output, 'main/services/auth-service.js'))
  const sourcePath = join(work, 'source.db')
  const source = new Database(sourcePath)
  runMigrations(source)
  source.prepare("INSERT OR IGNORE INTO branches (id, code, name, created_at, updated_at) VALUES ('goa', 'GOA', 'Goa', ?, ?)").run('2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')
  source.close()
  const live = new Database(':memory:')
  runMigrations(live)
  process.env.CASHIERS_BACKUP_KEY = 'test-only-key'
  const backup = new BackupService(live, sourcePath)
  const snapshot = await backup.create(sourcePath, work)
  const data = readFileSync(snapshot.filePath)
  const drive = {
    findDriveFile: async () => ({ id: 'goa-snapshot', appProperties: { branch: 'Goa', sha256: snapshot.sha256 } }),
    downloadDriveFile: async () => data
  }
  const service = new GoogleDriveSnapshotService(live, sourcePath, work, backup, drive, new AuthService({}))
  const restoredPath = await service.prepareInitialRestore('Goa')
  const restored = new Database(restoredPath, { readonly: true })
  assert.equal(restored.prepare("SELECT name FROM branches WHERE name = 'Goa'").get().name, 'Goa')
  assert.equal(restored.prepare("SELECT value FROM app_settings WHERE key = 'cashier_login_branch'").get().value, 'Goa')
  restored.close()
  await assert.rejects(() => service.prepareInitialRestore('Tinambac'), /branch identity/)
  const emptyBranchService = new GoogleDriveSnapshotService(
    live,
    sourcePath,
    work,
    backup,
    { findDriveFile: async () => undefined },
    new AuthService({})
  )
  assert.equal(await emptyBranchService.prepareInitialRestore('Tinambac'), undefined)
  live.close()
  console.log('initial recovery tests passed')
} finally {
  if (existsSync(output)) rmSync(output, { recursive: true, force: true })
  rmSync(work, { recursive: true, force: true })
}
