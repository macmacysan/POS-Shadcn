import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page
} from '@playwright/test'
import path from 'node:path'

async function openInstallmentView(
  page: Page,
  name: 'Records' | 'Active' | 'Closed' | 'Blacklisted'
): Promise<void> {
  const target = page.getByRole('link', { name, exact: true })
  if (!(await target.isVisible())) await page.getByText('Installments', { exact: true }).click()
  if (!(await target.isVisible())) await page.getByText('In-house', { exact: true }).click()
  await target.click()
}

async function leadingColumnWidths(page: Page): Promise<number[]> {
  return Promise.all(
    ['Select all', 'Branch'].map(async (name) =>
      Math.round(
        await page
          .getByRole('columnheader', { name, exact: true })
          .evaluate((element) => element.getBoundingClientRect().width)
      )
    )
  )
}

test.describe('installment status views', () => {
  test.setTimeout(60_000)
  let app: ElectronApplication
  let page: Page

  test.beforeEach(async ({ browserName }, testInfo) => {
    void browserName
    app = await electron.launch({
      args: [
        `--user-data-dir=${testInfo.outputPath(`user-data-${Date.now()}`)}`,
        path.resolve('.')
      ],
      env: {
        ...process.env,
        ELECTRON_RENDERER_URL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173'
      }
    })
    page = await app.firstWindow()
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible({
      timeout: 60_000
    })
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
    await expect(page.getByRole('button', { name: 'Filter' })).toBeVisible()
    await page.getByRole('button', { name: 'Filter' }).click()
    await expect(page.getByPlaceholder('Search filters...')).toBeVisible()
    await page.keyboard.press('Escape')
    const recordsLeadingWidths = await leadingColumnWidths(page)
    expect(recordsLeadingWidths).toEqual([64, 64])

    await openInstallmentView(page, 'Active')
    await expect(page.getByRole('table')).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Next Due' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Outstanding' })).toBeVisible()
    await expect(page.locator('tbody tr')).toHaveCount(20)
    const activeLeadingWidths = await leadingColumnWidths(page)

    await openInstallmentView(page, 'Closed')
    await expect(page.getByRole('table')).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Total Paid' })).toBeVisible()
    await expect(page.locator('tbody tr')).toHaveCount(10)
    const closedLeadingWidths = await leadingColumnWidths(page)

    await openInstallmentView(page, 'Blacklisted')
    await expect(page.getByRole('table')).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Outstanding' })).toBeVisible()
    await expect(page.locator('tbody tr')).toHaveCount(10)
    expect(activeLeadingWidths).toEqual(recordsLeadingWidths)
    expect(closedLeadingWidths).toEqual(recordsLeadingWidths)
    expect(await leadingColumnWidths(page)).toEqual(recordsLeadingWidths)
  })

  test('active account actions and double-click open the record payment form', async () => {
    await openInstallmentView(page, 'Active')
    const firstRow = page.locator('tbody tr').first()
    await firstRow.hover()
    await firstRow.getByRole('button', { name: 'Account actions' }).click()
    await page.getByRole('menuitem', { name: 'Record Payment' }).click()
    await expect(page.locator('aside').getByText('Record payment', { exact: true })).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('table')).toBeVisible()
    await page.locator('tbody tr').first().dblclick()
    await expect(page.locator('aside').getByText('Record payment', { exact: true })).toBeVisible()
  })
})
