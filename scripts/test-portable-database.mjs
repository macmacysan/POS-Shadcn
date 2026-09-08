/* eslint-disable no-empty */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  unlinkSync,
  writeFileSync
} from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  assertDatabaseHealthy,
  businessManifest,
  seedPortableBusinessData
} from './portable-database-fixture.mjs'

const root = resolve(import.meta.dirname, '..')
const output = resolve(root, '.portable-database-test-build')
const work = mkdtempSync(join(tmpdir(), 'cashiers-portable-'))
const require = createRequire(import.meta.url)
const now = '2026-09-08T00:00:00.000Z'

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
      resolve(root, 'src/main/services/backup-service.ts'),
      resolve(root, 'src/main/database/database.ts'),
      resolve(root, 'src/main/database/migrations.ts')
    ],
    { stdio: 'inherit' }
  )
  const Database = require('better-sqlite3')
  const { openDatabase } = require(resolve(output, 'main/database/database.js'))
  const { BackupService } = require(resolve(output, 'main/services/backup-service.js'))
  const { currentSchemaVersion } = require(resolve(output, 'main/database/migrations.js'))
  const sourcePath = join(work, 'source.db')
  const source = openDatabase(sourcePath)
  seedPortableBusinessData(source, 'portable')
  const before = businessManifest(source)
  assert.ok(existsSync(`${sourcePath}-wal`), 'source must have a WAL file before export')
  const service = new BackupService(source, sourcePath)
  const exported = await service.exportPortable(join(work, 'exports'))
  assert.equal(exported.schemaVersion, currentSchemaVersion)
  assert.equal(existsSync(`${exported.filePath}-wal`), false)
  assert.equal(existsSync(`${exported.filePath}-shm`), false)
  assert.deepEqual(businessManifest(source), before, 'export must not modify source data')
  const standalone = new Database(exported.filePath, { readonly: true })
  assertDatabaseHealthy(assert, standalone, currentSchemaVersion)
  assert.deepEqual(businessManifest(standalone), before)
  standalone.close()

  const failedExport = join(work, 'failed-export.db')
  const validatePortable = service.validatePortable
  service.validatePortable = () => {
    throw new Error('Portable database integrity check failed.')
  }
  await assert.rejects(() => service.exportPortableFile(failedExport), /integrity check failed/)
  service.validatePortable = validatePortable
  assert.equal(existsSync(failedExport), false)
  assert.equal(existsSync(`${failedExport}-wal`), false)
  assert.equal(existsSync(`${failedExport}-shm`), false)
  assert.equal(
    readdirSync(work).some((name) => name.startsWith('.portable-export-')),
    false
  )

  const corrupt = join(work, 'corrupt.db')
  writeFileSync(corrupt, 'not sqlite')
  assert.throws(
    () => service.preparePortableImport(corrupt, join(work, 'staging')),
    /Portable database/
  )
  const unrelated = join(work, 'unrelated.db')
  const unrelatedDb = new Database(unrelated)
  unrelatedDb.exec('CREATE TABLE unrelated (id TEXT)')
  unrelatedDb.close()
  assert.throws(
    () => service.preparePortableImport(unrelated, join(work, 'staging')),
    /Portable database/
  )
  const foreignKeyBroken = join(work, 'foreign-key-broken.db')
  copyFileSync(exported.filePath, foreignKeyBroken)
  const broken = new Database(foreignKeyBroken)
  broken.pragma('foreign_keys = OFF')
  broken
    .prepare(
      "INSERT INTO expenses (id, report_id, type, description, category, receipt_no, vat, amount_centavos, created_at, updated_at) VALUES ('broken-expense', 'missing-report', 'Company Expenses', 'Broken', 'General', 'B-1', '', 1, ?, ?)"
    )
    .run(now, now)
  broken.pragma('wal_checkpoint(TRUNCATE)')
  broken.close()
  assert.throws(
    () => service.preparePortableImport(foreignKeyBroken, join(work, 'staging')),
    /foreign-key/
  )
  writeFileSync(`${exported.filePath}-wal`, 'live WAL')
  assert.throws(
    () => service.preparePortableImport(exported.filePath, join(work, 'staging')),
    /WAL sidecar/
  )
  unlinkSync(`${exported.filePath}-wal`)

  const targetPath = join(work, 'destination.db')
  const target = new Database(targetPath)
  target.exec("CREATE TABLE old_data (value TEXT); INSERT INTO old_data VALUES ('preserve me')")
  target.close()
  writeFileSync(`${targetPath}-wal`, 'old wal')
  writeFileSync(`${targetPath}-shm`, 'old shm')
  const prepared = service.preparePortableImport(exported.filePath, join(work, 'staging'))
  const recovery = service.installPortable(prepared.stagedPath, targetPath)
  const recoveryDb = new Database(recovery, { readonly: true })
  assert.equal(recoveryDb.prepare('SELECT value FROM old_data').get().value, 'preserve me')
  recoveryDb.close()
  assert.equal(existsSync(`${recovery}-wal`), true)
  assert.equal(existsSync(`${recovery}-shm`), true)
  assert.equal(existsSync(`${targetPath}-wal`), false)
  assert.equal(existsSync(`${targetPath}-shm`), false)
  const reopened = openDatabase(targetPath)
  assertDatabaseHealthy(assert, reopened, currentSchemaVersion)
  assert.deepEqual(businessManifest(reopened), before)
  reopened.close()
  source.close()
  console.log('portable database tests passed')
} finally {
  if (existsSync(output)) rmSync(output, { recursive: true, force: true })
  try {
    rmSync(work, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
  } catch {}
}
