import { expect, test, type Page } from '@playwright/test'

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173'

async function openAllAccounts(page: Page): Promise<void> {
  await page.goto(baseUrl)
  await page.getByRole('combobox', { name: 'Branch' }).click()
  await page.getByRole('option', { name: 'Goa' }).click()
  await page.getByLabel('Username').fill('cashier')
  await page.getByLabel('Password').fill('password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByRole('button', { name: 'Finance' }).click()
  await page.getByText('In-house', { exact: true }).click()
  await page.getByText('All Accounts', { exact: true }).click()
}

test('All Accounts browser keeps only cashier-critical columns', async ({ page }) => {
  await openAllAccounts(page)

  const headers = page.locator('thead')
  await expect(headers.getByText('Branch', { exact: true })).toBeVisible()
  await expect(headers.getByText('Account', { exact: true })).toBeVisible()
  await expect(headers.getByText('Address', { exact: true })).toBeVisible()
  await expect(headers.getByText('Status', { exact: true })).toBeVisible()
  await expect(headers.getByText('Next Due', { exact: true })).toBeVisible()

  await expect(headers.getByText('Contact', { exact: true })).toHaveCount(0)
  await expect(headers.getByText('Agent', { exact: true })).toHaveCount(0)
  await expect(headers.getByText('Referred By', { exact: true })).toHaveCount(0)
  await expect(headers.getByText('Last Added', { exact: true })).toHaveCount(0)

  await expect(page.getByText('GOA', { exact: true })).toBeVisible()
  await expect(page.getByRole('table').getByText('IH-2026-0041', { exact: true })).toBeVisible()
  await expect(page.getByText('Showing 1-3 of 3 accounts')).toBeVisible()

  await page.setViewportSize({ width: 900, height: 800 })
  await expect(headers.getByText('Address', { exact: true })).toBeHidden()
  await expect(headers.getByText('Account', { exact: true })).toBeVisible()

  await page.setViewportSize({ width: 390, height: 800 })
  await expect(page.getByRole('dialog', { name: 'Account details' })).toBeVisible()
})

test('All Accounts empty state and sort persistence work', async ({ page }) => {
  await openAllAccounts(page)

  await page.getByRole('button', { name: 'Sort Status' }).click()
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem('cashiers-report-in-house-accounts-sort') ?? '')
    )
    .toContain('"status"')

  await page.getByLabel('Search accounts by name, contact number, or email').fill('zz-no-account')
  await expect(page.getByText('No accounts found.')).toBeVisible()
  const emptyState = page.locator('[data-slot="empty"]')
  await expect(emptyState.getByRole('button', { name: 'Clear Filters' })).toBeVisible()
  await expect(emptyState.getByRole('button', { name: 'Add Account' })).toBeVisible()
  await emptyState.getByRole('button', { name: 'Clear Filters' }).click()
  await expect(page.getByText('No accounts found.')).toBeHidden()
})
