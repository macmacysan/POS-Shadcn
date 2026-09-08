import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  utimesSync,
  writeFileSync
} from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const output = resolve(root, '.portable-database-ipc-test-build')
const work = mkdtempSync(join(tmpdir(), 'cashiers-portable-ipc-'))
const require = createRequire(import.meta.url)
let now = Date.now()
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
      resolve(root, 'src/main/ipc/backups.ts'),
      resolve(root, 'src/main/services/portable-database-install.ts')
    ],
    { stdio: 'inherit' }
  )
  const { PortableDatabaseController } = require(resolve(output, 'main/ipc/backups.js'))
  const { installPortableDatabase } = require(
    resolve(output, 'main/services/portable-database-install.js')
  )
  const stage = join(work, 'portable-imports')
  const source = join(work, 'selected.db')
  const exported = join(work, 'exported.db')
  const live = join(work, 'cashiers-report.db')
  const recovery = join(work, 'cashiers-report.db.recovery-test')
  const startupStale = join(stage, '.portable-import-abcdef0123456789.db')
  writeFileSync(source, 'portable')
  writeFileSync(live, 'old database')
  writeFileSync(recovery, 'recovery database')
  mkdirSync(stage, { recursive: true })
  writeFileSync(startupStale, 'stale')
  utimesSync(startupStale, (now - 15 * 60 * 1000 - 1) / 1000, (now - 15 * 60 * 1000 - 1) / 1000)
  let stagedPath = ''
  let stageNumber = 0
  const service = {
    async exportPortableFile(path) {
      writeFileSync(path, 'export')
      return { filePath: path, schemaVersion: 46 }
    },
    preparePortableImport(path, directory) {
      mkdirSync(directory, { recursive: true })
      stagedPath = join(
        directory,
        `.portable-import-${(++stageNumber).toString(16).padStart(16, '0')}.db`
      )
      writeFileSync(stagedPath, path)
      return { stagedPath, schemaVersion: 46 }
    }
  }
  const preparePortableImport = service.preparePortableImport
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

  assert.equal(existsSync(startupStale), false, 'startup cleanup removes expired staged files')
  assert.equal(existsSync(live), true, 'startup cleanup leaves the live database untouched')
  assert.equal(existsSync(recovery), true, 'startup cleanup leaves recovery copies untouched')

  let closes = 0
  let relaunches = 0
  let quits = 0
  assert.throws(
    () =>
      installPortableDatabase(
        {
          installPortable: () => {
            throw new Error('installation failed after rollback')
          }
        },
        'staged.db',
        'cashiers-report.db',
        () => {
          closes += 1
        },
        () => {
          relaunches += 1
        },
        () => {
          quits += 1
        }
      ),
    /installation failed/
  )
  assert.deepEqual({ closes, relaunches, quits }, { closes: 1, relaunches: 1, quits: 1 })

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
  service.preparePortableImport = preparePortableImport
  const selected = await controller.select()
  assert.deepEqual(Object.keys(selected ?? {}).sort(), ['fileName', 'schemaVersion', 'token'])
  assert.match(selected?.token ?? '', /^[a-f0-9]{32}$/)
  assert.equal('stagedPath' in (selected ?? {}), false)
  assert.notEqual(selected?.token, stagedPath)
  const canceledStage = stagedPath
  controller.cancel(selected.token)
  assert.equal(existsSync(canceledStage), false, 'cancel removes its staged file')
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
  const expiredStage = stagedPath
  now += 15 * 60 * 1000
  assert.throws(() => controller.confirm(expired.token), /expired/)
  assert.equal(existsSync(expiredStage), false, 'expired confirmation removes its staged file')
  assert.throws(() => controller.confirm(expired.token), /no longer available/)
  const stale = join(stage, '.portable-import-fedcba9876543210.db')
  writeFileSync(stale, 'stale')
  utimesSync(stale, (now - 15 * 60 * 1000 - 1) / 1000, (now - 15 * 60 * 1000 - 1) / 1000)
  controller.cleanExpired()
  assert.equal(existsSync(stale), false, 'periodic cleanup removes matching staged files')
  assert.equal(existsSync(live), true, 'periodic cleanup leaves the live database untouched')
  assert.equal(existsSync(recovery), true, 'periodic cleanup leaves recovery copies untouched')
  console.log('portable database IPC tests passed')
} finally {
  if (existsSync(output)) rmSync(output, { recursive: true, force: true })
  rmSync(work, { recursive: true, force: true })
}
