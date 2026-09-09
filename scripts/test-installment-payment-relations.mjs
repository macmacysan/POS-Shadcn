import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const output = resolve(root, '.installment-payment-relations-test-build')
const require = createRequire(import.meta.url)
const schedules = [
  { id: 'two', installmentNumber: 2 },
  { id: 'three', installmentNumber: 3 },
  { id: 'four', installmentNumber: 4 }
]

try {
  execFileSync(process.execPath, [
    resolve(root, 'node_modules/typescript/bin/tsc'),
    '--target', 'ES2022',
    '--module', 'commonjs',
    '--esModuleInterop',
    '--skipLibCheck',
    '--rootDir', resolve(root, 'src'),
    '--outDir', output,
    resolve(root, 'src/renderer/src/lib/installment-payment-relations.ts')
  ])
  const { groupSchedulePaymentRelations } = require(
    resolve(output, 'renderer/src/lib/installment-payment-relations.js')
  )
  const relations = groupSchedulePaymentRelations(schedules, [
    { id: 'payment-a', status: 'POSTED', amountCentavos: 500000, scheduleIds: ['two', 'three', 'four'] },
    { id: 'payment-b', status: 'POSTED', amountCentavos: 100000, scheduleIds: ['four'] },
    { id: 'voided', status: 'VOIDED', amountCentavos: 999999, scheduleIds: ['two'] }
  ])

  assert.deepEqual(relations.get('two')?.map((relation) => relation.payment.id), ['payment-a'])
  assert.equal(relations.get('two')?.[0].isFirstSchedule, true)
  assert.equal(relations.get('three')?.[0].isFirstSchedule, false)
  assert.deepEqual(relations.get('four')?.map((relation) => relation.payment.id), ['payment-a', 'payment-b'])
  assert.deepEqual(relations.get('four')?.[0].scheduleNumbers, [2, 3, 4])
  console.log('installment payment relationship tests passed')
} finally {
  if (existsSync(output)) rmSync(output, { recursive: true, force: true })
}
