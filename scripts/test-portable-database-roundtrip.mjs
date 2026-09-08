/* eslint-disable no-empty, @typescript-eslint/no-empty-function */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
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
const output = resolve(root, '.portable-database-roundtrip-test-build')
const work = mkdtempSync(join(tmpdir(), 'cashiers-portable-roundtrip-'))
const require = createRequire(import.meta.url)
const admin = { requireAdmin() {} }

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
      resolve(root, 'src/main/ipc/backups.ts'),
      resolve(root, 'src/main/services/portable-database-install.ts'),
      resolve(root, 'src/main/services/backup-service.ts'),
      resolve(root, 'src/main/database/database.ts'),
      resolve(root, 'src/main/database/migrations.ts')
    ],
    { stdio: 'inherit' }
  )
  const Database = require('better-sqlite3')
  const { openDatabase } = require(resolve(output, 'main/database/database.js'))
  const { BackupService } = require(resolve(output, 'main/services/backup-service.js'))
  const { currentSchemaVersion: schemaVersion } = require(
    resolve(output, 'main/database/migrations.js')
  )
  const { PortableDatabaseController } = require(resolve(output, 'main/ipc/backups.js'))
  const { installPortableDatabase } = require(
    resolve(output, 'main/services/portable-database-install.js')
  )
  const pcAUserData = join(work, 'pc-a', 'userData')
  const pcBUserData = join(work, 'pc-b', 'userData')
  const transferDirectory = join(work, 'transfer')
  mkdirSync(transferDirectory, { recursive: true })
  mkdirSync(pcAUserData, { recursive: true })
  mkdirSync(pcBUserData, { recursive: true })
  const pcAPath = join(pcAUserData, 'cashiers-report.db')
  const pcBPath = join(pcBUserData, 'cashiers-report.db')
  let pcA = openDatabase(pcAPath)
  let pcB = openDatabase(pcBPath)
  seedPortableBusinessData(pcA, 'pc-a')
  pcA
    .prepare(
      "INSERT INTO catalog_options (id, kind, value, created_at, updated_at) VALUES ('pc-a-final-write', 'FINANCE_TYPE', 'PC A final write', '2026-09-08T00:00:00.000Z', '2026-09-08T00:00:00.000Z')"
    )
    .run()
  const pcAManifest = businessManifest(pcA)
  assert.ok(existsSync(`${pcAPath}-wal`), 'PC A must have a WAL before export')

  const exportedPath = join(transferDirectory, 'pc-a-export.db')
  const controllerA = new PortableDatabaseController(
    pcAUserData,
    new BackupService(pcA, pcAPath),
    admin,
    () => {},
    {
      showSaveDialog: async () => ({ canceled: false, filePath: exportedPath }),
      showOpenDialog: async () => ({ canceled: true, filePaths: [] })
    },
    Date.now,
    () => transferDirectory
  )
  assert.deepEqual(await controllerA.export(), { fileName: 'pc-a-export.db', schemaVersion })
  assert.deepEqual(readdirSync(transferDirectory), ['pc-a-export.db'])
  assert.equal(existsSync(`${exportedPath}-wal`), false)
  assert.equal(existsSync(`${exportedPath}-shm`), false)
  const portable = join(work, 'pc-b-transfer', 'pc-a-export.db')
  mkdirSync(join(work, 'pc-b-transfer'), { recursive: true })
  copyFileSync(exportedPath, portable)
  const transferredSize = statSync(portable).size

  seedPortableBusinessData(pcB, 'pc-b')
  const pcBManifest = businessManifest(pcB)
  assert.ok(existsSync(`${pcBPath}-wal`), 'PC B must have a WAL before installation')
  let closes = 0
  let relaunches = 0
  let quits = 0
  let selectedPath = portable
  const controllerB = new PortableDatabaseController(
    pcBUserData,
    new BackupService(pcB, pcBPath),
    admin,
    (stagedPath) =>
      installPortableDatabase(
        new BackupService(pcB, pcBPath),
        stagedPath,
        pcBPath,
        () => {
          closes += 1
          pcB.close()
        },
        () => {
          relaunches += 1
        },
        () => {
          quits += 1
        }
      ),
    {
      showSaveDialog: async () => ({ canceled: true }),
      showOpenDialog: async () => ({ canceled: false, filePaths: [selectedPath] })
    },
    Date.now,
    () => transferDirectory
  )
  const selected = await controllerB.select()
  assert.deepEqual(Object.keys(selected ?? {}).sort(), ['fileName', 'schemaVersion', 'token'])
  assert.equal(selected?.fileName, 'pc-a-export.db')
  assert.equal(selected?.schemaVersion, schemaVersion)
  assert.equal(
    statSync(portable).size,
    transferredSize,
    'staging must not modify the transfer file'
  )
  const stage = join(pcBUserData, 'portable-imports')
  assert.equal(readdirSync(stage).length, 1, 'selection must create one internal staged database')
  const stagedPath = join(stage, readdirSync(stage)[0])
  const staged = new Database(stagedPath, { readonly: true })
  assertDatabaseHealthy(assert, staged, schemaVersion)
  staged.close()
  controllerB.confirm(selected.token)
  assert.deepEqual({ closes, relaunches, quits }, { closes: 1, relaunches: 1, quits: 1 })
  assert.equal(existsSync(stagedPath), false)
  assert.throws(() => controllerB.confirm(selected.token), /no longer available/)
  assert.equal(existsSync(`${pcBPath}-wal`), false)
  assert.equal(existsSync(`${pcBPath}-shm`), false)
  const recoveries = readdirSync(pcBUserData).filter(
    (name) =>
      name.startsWith('cashiers-report.db.recovery-') &&
      !name.endsWith('-wal') &&
      !name.endsWith('-shm')
  )
  assert.equal(recoveries.length, 1, 'installation must preserve one recovery database')

  const installed = openDatabase(pcBPath)
  assertDatabaseHealthy(assert, installed, schemaVersion)
  assert.deepEqual(businessManifest(installed), pcAManifest)
  installed.close()
  const recovery = new Database(join(pcBUserData, recoveries[0]), { readonly: true })
  assertDatabaseHealthy(assert, recovery, schemaVersion)
  assert.deepEqual(businessManifest(recovery), pcBManifest)
  assert.ok(recovery.prepare("SELECT id FROM users WHERE id = 'pc-b-user'").get())
  assert.equal(recovery.prepare("SELECT id FROM users WHERE id = 'pc-a-user'").get(), undefined)
  recovery.close()

  const invalid = join(work, 'pc-b-transfer', 'invalid.db')
  writeFileSync(invalid, 'not sqlite')
  const beforeInvalid = new Database(pcBPath, { readonly: true })
  const activeBeforeInvalid = businessManifest(beforeInvalid)
  beforeInvalid.close()
  const recoveryCount = recoveries.length
  selectedPath = invalid
  await assert.rejects(controllerB.select(), /Portable database/)
  assert.equal(
    readdirSync(pcBUserData).filter(
      (name) =>
        name.startsWith('cashiers-report.db.recovery-') &&
        !name.endsWith('-wal') &&
        !name.endsWith('-shm')
    ).length,
    recoveryCount
  )
  assert.deepEqual(
    existsSync(stage) ? readdirSync(stage) : [],
    [],
    'invalid selection must leave no staged artifacts'
  )
  const afterInvalid = openDatabase(pcBPath)
  assertDatabaseHealthy(assert, afterInvalid, schemaVersion)
  assert.deepEqual(businessManifest(afterInvalid), activeBeforeInvalid)
  afterInvalid.close()
  pcA.close()
  console.log('portable database round-trip tests passed')
} finally {
  if (existsSync(output)) rmSync(output, { recursive: true, force: true })
  try {
    rmSync(work, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
  } catch {}
}
