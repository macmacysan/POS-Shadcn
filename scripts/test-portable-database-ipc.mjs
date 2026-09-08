import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync
} from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const output = resolve(root, '.portable-database-ipc-test-build')
const work = mkdtempSync(join(tmpdir(), 'cashiers-portable-ipc-'))
const require = createRequire(import.meta.url)
let now = 0
let admin = true
let installs = 0
let dialogs = { save: { canceled: true }, open: { canceled: true, filePaths: [] } }

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
      resolve(root, 'src/main/ipc/backups.ts')
    ],
    { stdio: 'inherit' }
  )
  const { PortableDatabaseController } = require(resolve(output, 'main/ipc/backups.js'))
  const stage = join(work, 'portable-imports')
  const source = join(work, 'selected.db')
  const exported = join(work, 'exported.db')
  const live = join(work, 'cashiers-report.db')
  writeFileSync(source, 'portable')
  writeFileSync(live, 'old database')
  const service = {
    async exportPortableFile(path) {
      writeFileSync(path, 'export')
      return { filePath: path, schemaVersion: 46 }
    },
    preparePortableImport(path, directory) {
      mkdirSync(directory, { recursive: true })
      const stagedPath = join(directory, '.portable-import-0123456789abcdef.db')
      writeFileSync(stagedPath, path)
      return { stagedPath, schemaVersion: 46 }
    }
  }
  const auth = {
    requireAdmin() {
      if (!admin) throw new Error('Admin required')
    }
  }
  const controller = new PortableDatabaseController(
    work,
    service,
    auth,
    (stagedPath) => {
      installs += 1
      renameSync(stagedPath, live)
    },
    {
      showSaveDialog: async () => dialogs.save,
      showOpenDialog: async () => dialogs.open
    },
    () => now,
    () => work
  )

  assert.equal(await controller.export(), undefined)
  dialogs.save = { canceled: false, filePath: exported }
  assert.deepEqual(await controller.export(), { fileName: 'exported.db', schemaVersion: 46 })
  assert.equal(existsSync(exported), true)
  dialogs.open = { canceled: true, filePaths: [] }
  assert.equal(await controller.select(), undefined)
  admin = false
  await assert.rejects(controller.export(), /Admin required/)
  await assert.rejects(controller.select(), /Admin required/)
  assert.throws(() => controller.cancel('0'.repeat(32)), /Admin required/)
  assert.throws(() => controller.confirm('0'.repeat(32)), /Admin required/)
  admin = true
  service.preparePortableImport = () => {
    throw new Error('Portable database is not valid')
  }
  dialogs.open = { canceled: false, filePaths: [source] }
  await assert.rejects(controller.select(), /not valid/)
  service.preparePortableImport = (path, directory) => {
    mkdirSync(directory, { recursive: true })
    const stagedPath = join(
      directory,
      `.portable-import-${Math.random().toString(16).slice(2).padEnd(16, '0')}.db`
    )
    writeFileSync(stagedPath, path)
    return { stagedPath, schemaVersion: 46 }
  }
  const selected = await controller.select()
  assert.ok(selected?.token)
  controller.cancel(selected.token)
  assert.equal(installs, 0)
  assert.throws(() => controller.confirm(selected.token), /no longer available/)
  const confirmed = await controller.select()
  assert.ok(confirmed?.token)
  controller.confirm(confirmed.token)
  assert.equal(installs, 1)
  assert.equal(
    existsSync(live),
    true,
    'successful installation keeps the newly installed live database'
  )
  assert.throws(() => controller.confirm(confirmed.token), /no longer available/)
  const expired = await controller.select()
  now += 15 * 60 * 1000
  assert.throws(() => controller.confirm(expired.token), /expired/)
  const stale = join(stage, '.portable-import-fedcba9876543210.db')
  writeFileSync(stale, 'stale')
  const protectedFile = join(work, 'cashiers-report.db.recovery-test')
  writeFileSync(protectedFile, 'protected')
  now = Date.now() + 2 * 15 * 60 * 1000
  controller.cleanExpired()
  assert.equal(existsSync(protectedFile), true)
  if (existsSync(stale)) unlinkSync(stale)
  console.log('portable database IPC tests passed')
} finally {
  if (existsSync(output)) rmSync(output, { recursive: true, force: true })
  rmSync(work, { recursive: true, force: true })
}
