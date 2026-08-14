import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = resolve(import.meta.dirname, '..')
const output = resolve(root, '.installment-test-build')
const config = {
  standardInterestRateBps: 3800,
  requiredDownPaymentRateBps: 2250,
  monthlyPlans: [{ terms: 1, interestRateBps: 0 }, { terms: 3, interestRateBps: 2800 }, { terms: 6, interestRateBps: 3500 }, { terms: 12, interestRateBps: 5000 }],
  dailyPlans: [{ terms: 30, requiredFeePayments: 2 }, { terms: 50, requiredFeePayments: 4 }, { terms: 80, requiredFeePayments: 6 }, { terms: 120, requiredFeePayments: 8 }],
  weeklyTerms: [5, 8, 12, 16], semiTerms: [2, 4, 6, 8]
}
try {
  execFileSync(process.execPath, [resolve(root, 'node_modules/typescript/bin/tsc'), '--target', 'ES2022', '--module', 'commonjs', '--esModuleInterop', '--skipLibCheck', '--rootDir', resolve(root, 'src/shared'), '--outDir', output, resolve(root, 'src/shared/installment-calculations.ts')], { stdio: 'inherit' })
  const calculations = await import(pathToFileURL(resolve(output, 'installment-calculations.js')).href)
  assert.equal(calculations.calculateStartDate('2026-01-01', 'Daily'), '2026-01-02')
  assert.equal(calculations.calculateStartDate('2026-01-01', 'Weekly'), '2026-01-08')
  assert.equal(calculations.calculateStartDate('2026-01-01', 'Semi'), '2026-01-16')
  assert.equal(calculations.calculateStartDate('2026-01-31', 'Monthly'), '2026-02-28')
  assert.equal(calculations.calculateEndDate('2026-01-08', 'Weekly', 8), '2026-02-26')
  assert.equal(calculations.calculateEndDate('2026-01-16', 'Semi', 8), '2026-05-01')
  assert.equal(calculations.calculateGrandTotal([{ quantity: 2, unitPriceCentavos: 500000 }, { quantity: 1, unitPriceCentavos: 350000 }]), 1350000)
  const calculate = (frequency, terms, downPayment = 0) => calculations.calculateInstallment({ releaseDate: '2026-01-01', frequency, terms, items: [{ quantity: 1, unitPriceCentavos: 1000000 }], actualDownPaymentCentavos: downPayment }, config)
  assert.equal(calculate('Daily', 30).totalInstallmentCentavos, 1380000)
  assert.equal(calculate('Weekly', 8).requiredFeeCentavos, 172500)
  assert.equal(calculate('Semi', 4).requiredFeeCentavos, 345000)
  assert.equal(calculate('Monthly', 1, 200000).paymentAmountCentavos, 800000)
  assert.equal(calculate('Monthly', 3, 300000).totalInstallmentCentavos, 1280000)
  assert.equal(calculate('Monthly', 6).totalInstallmentCentavos, 1350000)
  assert.equal(calculate('Monthly', 12).totalInstallmentCentavos, 1500000)
  assert.equal(calculate('Monthly', 12).requiredFeeCentavos, 225000)
  assert.equal(calculate('Daily', 5).totalInstallmentCentavos, null)
  console.log('installment calculation tests passed')
} finally {
  if (existsSync(output)) rmSync(output, { recursive: true, force: true })
}
