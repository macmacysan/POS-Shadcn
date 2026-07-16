import { expect, test } from '@playwright/test'

test('Finance navigation exposes one expandable installment group at a time', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173')
  await page.getByRole('combobox', { name: 'Branch' }).click()
  await page.getByRole('option', { name: 'Goa' }).click()
  await page.getByLabel('Username').fill('cashier')
  await page.getByLabel('Password').fill('password')
  await page.getByRole('button', { name: 'Sign in' }).click()

  await page.getByRole('button', { name: 'Finance' }).click()
  await expect(page.getByText('Overview', { exact: true })).toBeVisible()
  await expect(page.getByText('Installment History', { exact: true })).toBeVisible()

  await page.getByText('In-house Installment', { exact: true }).click()
  await expect(page.getByText('Blacklisted Accounts', { exact: true })).toBeVisible()
  await page.getByText('Finance Installment', { exact: true }).click()
  await expect(page.getByText('Completed Accounts', { exact: true })).toBeVisible()
  await expect(page.getByText('Blacklisted Accounts', { exact: true })).toBeHidden()

  await expect(page.getByText('Reports', { exact: true })).toBeVisible()
  await expect(page.getByText('Branches', { exact: true })).toBeVisible()
  await expect(page.getByText('Cashiers', { exact: true })).toBeVisible()
  await expect(page.getByText('Settings', { exact: true })).toBeVisible()
  await expect(page.getByText('Help', { exact: true })).toBeVisible()

  await page.locator('[data-sidebar="trigger"]').click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => window.innerWidth)
  )
})
