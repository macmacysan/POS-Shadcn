import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const output = resolve(root, '.finance-account-service-test-build')
const require = createRequire(import.meta.url)

const account = {
  id: '0beec7b5-ea3f-4f36-8f0d-51e8f2b3c0c1',
  branch: 'Tinambac',
  provider: 'Home Credit',
  dateReleased: '2026-09-05',
  termsMonths: 6,
  lastName: 'Cashier',
  firstName: 'Test',
  items: [{ id: 'item-1', item: 'Phone', quantity: 1, itemPriceCentavos: 10000, totalCentavos: 10000 }],
  grandTotalCentavos: 10000,
  downpaymentCentavos: 0,
  balanceCentavos: 10000,
  createdAt: '2026-09-05T00:00:00.000Z',
  updatedAt: '2026-09-05T00:00:00.000Z',
  status: 'POSTED',
  voidedAt: null,
  voidedByUserId: null,
  voidReason: null
}

try {
  execFileSync(
    process.execPath,
    [
      resolve(root, 'node_modules/typescript/bin/tsc'),
      '--target', 'ES2022', '--module', 'commonjs', '--esModuleInterop', '--skipLibCheck',
      '--rootDir', resolve(root, 'src'), '--outDir', output,
      resolve(root, 'src/main/services/finance-account-service.ts')
    ],
    { stdio: 'inherit' }
  )

  const { FinanceAccountService } = require(resolve(output, 'main/services/finance-account-service.js'))
  const auth = { requireBranchName: (branch) => assert.equal(branch, 'Tinambac') }
  let updated = false
  const service = new FinanceAccountService(
    {
      list: ({ search }) => ({ rows: search ? [] : [account] }),
      listGoogleCache: () => ({ rows: [] }),
      create: () => account,
      update: () => { updated = true; return account },
      void: () => undefined,
      unvoid: () => undefined,
      transfer: () => account
    },
    auth
  )

  await service.update(account)
  assert.equal(updated, true)
  console.log('finance account edit test passed')
} finally {
  if (existsSync(output)) rmSync(output, { recursive: true, force: true })
}
