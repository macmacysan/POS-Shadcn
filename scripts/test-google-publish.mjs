import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const output = resolve(root, '.google-publish-test-build')
const work = mkdtempSync(join(tmpdir(), 'cashiers-google-publish-'))
const require = createRequire(import.meta.url)

try {
  execFileSync(process.execPath, [
    resolve(root, 'node_modules/typescript/bin/tsc'),
    '--target', 'ES2022', '--module', 'commonjs', '--esModuleInterop', '--skipLibCheck',
    '--rootDir', resolve(root, 'src'), '--outDir', output,
    resolve(root, 'src/main/services/google-sheet-publish-service.ts'),
    resolve(root, 'src/main/database/errors.ts'),
    resolve(root, 'src/shared/contracts/google-sync.ts')
  ], { stdio: 'inherit' })

  const { GoogleSheetPublishService } = require(resolve(output, 'main/services/google-sheet-publish-service.js'))
  const calls = []
  const rows = [['id', 'status'], ['report-1', 'POSTED']]
  const sheets = {
    async ensureTabs(_id, tabs) { calls.push(['tabs', tabs]) },
    async values() { return rows },
    async updateValuesBatch(_id, writes) { calls.push(['writes', writes]) }
  }
  const result = await new GoogleSheetPublishService(sheets).publish({
    branch: 'Goa', businessDate: '2026-08-27', tabs: [{ name: 'Summary', rows: [
      { id: 'report-1', status: 'VOIDED' },
      { id: 'report-2', status: 'DRAFT' }
    ] }] 
  })
  assert.equal(result.updatedRows, 1)
  assert.equal(result.appendedRows, 1)
  assert.equal(calls[1][0], 'writes')
  assert.deepEqual(calls[1][1].map((write) => write.range), ['Summary!A2', 'Summary!A3'])
  assert.equal(calls[1][1][0].values[0][1], 'VOIDED')
  console.log('google publish tests passed')
} finally {
  if (existsSync(output)) rmSync(output, { recursive: true, force: true })
  rmSync(work, { recursive: true, force: true })
}
