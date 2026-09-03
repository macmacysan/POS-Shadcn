import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const output = resolve(root, '.online-backup-test-build')
const work = mkdtempSync(join(tmpdir(), 'cashiers-online-backup-'))
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
      resolve(root, 'src/main/services/online-backup-revision-service.ts'),
      resolve(root, 'src/main/services/backup-service.ts'),
      resolve(root, 'src/main/database/migrations.ts')
    ],
    { stdio: 'inherit' }
  )
  const Database = require('better-sqlite3')
  const { runMigrations } = require(resolve(output, 'main/database/migrations.js'))
  const { BackupService } = require(resolve(output, 'main/services/backup-service.js'))
  const { OnlineBackupRevisionService } = require(
    resolve(output, 'main/services/online-backup-revision-service.js')
  )
  const sourcePath = join(work, 'cashiers-report.db')
  const source = new Database(sourcePath)
  runMigrations(source)
  source.close()
  const state = new Map()
  let id = 0
  const drive = {
    async replaceDriveFile(input) {
      const file = input.file
        ? state.get(input.file.id)
        : { id: String(++id), name: input.name, version: '1' }
      Object.assign(file, {
        name: input.name,
        data: Buffer.from(input.data),
        appProperties: input.appProperties,
        size: String(input.data.length)
      })
      state.set(file.id, file)
      return file
    },
    async listDriveFiles() {
      return [...state.values()]
    },
    async downloadDriveFile(file) {
      return Buffer.from(state.get(file.id).data)
    },
    async deleteDriveFile(file) {
      state.delete(file.id)
    }
  }
  process.env.CASHIERS_BACKUP_KEY = 'test-only-key'
  const database = new Database(sourcePath)
  const service = new OnlineBackupRevisionService(
    database,
    sourcePath,
    work,
    new BackupService(database, sourcePath),
    drive
  )
  await service.createDailyRevision('Goa')
  await service.createDailyRevision('Goa')
  assert.equal((await service.list('Goa')).length, 1, 'only one daily revision is created')
  const revision = (await service.list('Goa'))[0]
  const staged = await service.stageRestore(revision.id, 'Goa')
  assert.equal(existsSync(staged), true, 'verified revision stages for restore')
  rmSync(staged)
  await assert.rejects(() => service.stageRestore(revision.id, 'Tinambac'), /not found/)
  const file = state.get(revision.id)
  file.data = Buffer.from('truncated')
  await assert.rejects(() => service.stageRestore(revision.id, 'Goa'), /checksum/)
  state.clear()
  for (let days = 0; days < 400; days += 1) {
    const created = new Date()
    created.setDate(created.getDate() - days)
    const retentionFile = {
      id: `retention-${days}`,
      name: `revision-${days}`,
      version: '1',
      size: '1',
      data: Buffer.from('x'),
      appProperties: {
        branch: 'Goa',
        backup_type: 'online-revision',
        created_at: created.toISOString(),
        sha256: 'x',
        verified: 'true'
      }
    }
    state.set(retentionFile.id, retentionFile)
  }
  await service.applyRetention('Goa')
  assert.equal(state.has('retention-0'), true, 'newest daily revision is retained')
  assert.equal(
    state.size < 400,
    true,
    'revisions outside daily, weekly, and monthly retention are removed'
  )
  database.close()
  console.log('online backup revision tests passed')
} finally {
  if (existsSync(output)) rmSync(output, { recursive: true, force: true })
  rmSync(work, { recursive: true, force: true })
}
