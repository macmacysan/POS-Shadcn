import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const output = resolve(root, '.backup-test-build')
const work = mkdtempSync(join(tmpdir(), 'cashiers-backup-'))
const require = createRequire(import.meta.url)
try {
  execFileSync(process.execPath, [resolve(root, 'node_modules/typescript/bin/tsc'), '--target', 'ES2022', '--module', 'commonjs', '--esModuleInterop', '--skipLibCheck', '--rootDir', resolve(root, 'src'), '--outDir', output, resolve(root, 'src/main/services/backup-service.ts'), resolve(root, 'src/main/database/database.ts'), resolve(root, 'src/main/database/migrations.ts')], { stdio: 'inherit' })
  const Database = require('better-sqlite3')
  const { runMigrations } = require(resolve(output, 'main/database/migrations.js'))
  const { BackupService } = require(resolve(output, 'main/services/backup-service.js'))
  const sourcePath = join(work, 'source.db')
  const source = new Database(sourcePath)
  source.exec('CREATE TABLE sample (value TEXT); INSERT INTO sample VALUES (\'ok\')')
  source.close()
  const target = new Database(':memory:')
  runMigrations(target)
  process.env.CASHIERS_BACKUP_KEY = 'test-only-key'
  const service = new BackupService(target, sourcePath)
  const backup = await service.create(sourcePath, work)
  assert.equal(backup.sha256.length, 64)
  const restoredPath = join(work, 'restored.db')
  service.restoreValidated(backup.filePath, restoredPath)
  const restored = new Database(restoredPath, { readonly: true })
  assert.equal(restored.prepare('SELECT value FROM sample').get().value, 'ok')
  restored.close()
  target.close()
  console.log('backup tests passed')
} finally {
  if (existsSync(output)) rmSync(output, { recursive: true, force: true })
  rmSync(work, { recursive: true, force: true })
}
