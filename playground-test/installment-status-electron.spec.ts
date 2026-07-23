import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import path from 'node:path'

async function openInstallmentView(page: Page, name: 'Records' | 'Active' | 'Closed' | 'Blacklisted') {
  const target = page.getByRole('link', { name, exact: true })
  if (!(await target.isVisible())) await page.getByText('Installments', { exact: true }).click()
  if (!(await target.isVisible())) await page.getByText('In-house', { exact: true }).click()
  await target.click()
}

test.describe('installment status views', () => {
  test.setTimeout(60_000)
  let app: ElectronApplication
  let page: Page

  test.beforeEach(async ({}, testInfo) => {
    app = await electron.launch({
      args: [`--user-data-dir=${testInfo.outputPath(`user-data-${Date.now()}`)}`, path.resolve('.')],
      env: {
        ...process.env,
        ELECTRON_RENDERER_URL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173'
      }
    })
    page = await app.firstWindow()
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible({ timeout: 60_000 })
    await page.getByRole('combobox', { name: 'Branch' }).click()
    await page.getByRole('option', { name: 'Goa' }).click()
    await page.getByLabel('Username').fill('cashier')
    await page.getByLabel('Password').fill('password')
    await page.getByRole('button', { name: 'Sign in' }).click()
  })

  test.afterEach(async () => {
    await app.close()
  })

  test('Records, Active, Closed, and Blacklisted render status-appropriate tables', async () => {
    await openInstallmentView(page, 'Records')
    await expect(page.getByRole('table')).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Total Payable' })).toBeVisible()
    await expect(page.getByText('Customer01, Sample', { exact: true })).toBeVisible()
    await expect(page.locator('tbody tr')).toHaveCount(25)
    await expect(page.getByText('Showing 1-25 of 40 records')).toBeVisible()

    await openInstallmentView(page, 'Active')
    await expect(page.getByRole('table')).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Next Due' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Outstanding' })).toBeVisible()
    await expect(page.locator('tbody tr')).toHaveCount(20)

    await openInstallmentView(page, 'Closed')
    await expect(page.getByRole('table')).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Total Paid' })).toBeVisible()
    await expect(page.locator('tbody tr')).toHaveCount(10)

    await openInstallmentView(page, 'Blacklisted')
    await expect(page.getByRole('table')).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Outstanding' })).toBeVisible()
    await expect(page.locator('tbody tr')).toHaveCount(10)
  })
})
