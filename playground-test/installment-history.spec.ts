import { expect, test } from '@playwright/test'

async function openHistory(page: import('@playwright/test').Page, viewport?: { width: number; height: number }): Promise<void> {
  if (viewport) await page.setViewportSize(viewport)
  await page.goto('http://127.0.0.1:5173')
  await page.getByRole('combobox', { name: 'Branch' }).click()
  await page.getByRole('option', { name: 'Goa' }).click()
  await page.getByLabel('Username').fill('cashier')
  await page.getByLabel('Password').fill('password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  if (viewport) await page.getByRole('button', { name: 'Toggle Sidebar' }).first().click()
  await page.getByRole('link', { name: /Cashier reports/i }).click()
  if (viewport) await page.getByRole('button', { name: 'Toggle Sidebar' }).last().click()
  await page.getByRole('tab', { name: 'Installment History' }).click()
}

test('sorts newest first and formats missing money values', async ({ page }) => {
  await openHistory(page)

  const rows = page.locator('tbody tr')
  await expect(rows.first()).toContainText('Jul 14, 2026 10:42 AM')
  await expect(rows.nth(2)).toContainText('—')
  await expect(page.getByText('₱85,000.00')).toBeVisible()
})

test('selects a row with keyboard input and fills the inspector', async ({ page }) => {
  await openHistory(page)

  const firstRow = page.locator('tbody tr').first()
  await firstRow.focus()
  await firstRow.press('Enter')
  await expect(page.getByRole('heading', { name: 'Activity details' })).toBeVisible()
  await expect(page.locator('dt').filter({ hasText: 'Account details' }).first()).toBeVisible()
  await expect(page.getByText('Dining table set', { exact: true })).toBeVisible()
})

test('renders edited field comparison and responsive inspector sheet', async ({ page }) => {
  await openHistory(page)

  await page.locator('tbody tr').nth(2).click()
  await expect(page.getByText('Changed fields', { exact: true })).toBeVisible()
  await expect(page.getByText('Bi-weekly', { exact: true })).toBeVisible()

  await openHistory(page, { width: 700, height: 800 })
  await page.waitForTimeout(300)
  const mobileRow = page.locator('tbody tr').nth(1)
  await mobileRow.focus()
  await mobileRow.press('Enter')
  await expect(page.getByRole('heading', { name: 'Installment History details' })).toBeVisible()
})
