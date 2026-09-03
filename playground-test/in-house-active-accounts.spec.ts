import { expect, test, type Page } from '@playwright/test'

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173'

async function signIn(page: Page): Promise<void> {
  await page.getByRole('combobox', { name: 'Branch' }).click()
  await page.getByRole('option', { name: 'Goa' }).click()
  await page.getByLabel('Username').fill('cashier')
  await page.getByLabel('Password').fill('password')
  await page.getByRole('button', { name: 'Sign in' }).click()
}

async function openActiveAccounts(page: Page): Promise<void> {
  await page.goto(baseUrl)
  await signIn(page)
  await page.getByRole('button', { name: 'Finance' }).click()
  await page.getByText('In-house', { exact: true }).click()
  await page.getByRole('link', { name: 'Active Accounts' }).click()
}

test('Active Accounts presents the collection-focused workspace', async ({ page }) => {
  await openActiveAccounts(page)

  const headers = page.locator('thead')
  for (const header of [
    'Branch',
    'Account',
    'Contract',
    'Installment',
    'Outstanding Balance',
    'Payment Status',
    'Next Due',
    'Last Payment'
  ]) {
    await expect(headers.getByText(header, { exact: true })).toBeVisible()
  }

  await expect(page.getByText('Showing 1–3 of 3 Active Accounts')).toBeVisible()
  await expect(page.getByText("Today's Collections")).toBeHidden()
  await expect(
    page.getByRole('table').getByText('Santos, Maria Clara Villanueva Jr.', { exact: true })
  ).toBeVisible()
  await expect(page.getByRole('table').getByText('IH-2026-0041', { exact: true })).toBeHidden()
  await expect(page.getByRole('button', { name: 'Record Payment' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'View Ledger' })).toBeDisabled()
  await expect(page.getByText('Collection Status', { exact: true })).toBeVisible()
  await expect(page.getByText('Financial Breakdown', { exact: true })).toBeVisible()

  await expect(page.getByRole('button', { name: 'Open advanced filters' })).toBeVisible()
  await page.getByRole('button', { name: 'Open advanced filters' }).click()
  const filtersDialog = page.getByRole('dialog', { name: 'Filters' })
  await expect(filtersDialog).toBeVisible()
  await filtersDialog.getByRole('combobox', { name: 'Branch' }).click()
  await page.getByRole('option', { name: 'Tinambac' }).click()
  await page.getByRole('button', { name: 'Apply Filters' }).click()
  await expect(page.getByRole('button', { name: 'Tinambac' })).toBeVisible()
  await page.getByRole('button', { name: 'Tinambac' }).click()
  await expect(page.getByRole('button', { name: 'Tinambac' })).toBeHidden()

  const search = page.getByLabel('Search active accounts by name, account ID, or mobile number')
  await search.fill('IH-2026-0037')
  await expect(
    page.getByRole('table').getByText('Cruz, Luis Miguel', { exact: true })
  ).toBeVisible()
  await expect(page.getByRole('table').getByText('IH-2026-0037', { exact: true })).toBeHidden()
  await expect(page.getByText('Showing 1–1 of 1 Active Accounts')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Search: IH-2026-0037' })).toBeVisible()
  await search.fill('')

  await page.getByRole('button', { name: 'Monthly' }).first().click()
  await expect(page.getByRole('button', { name: 'Monthly' }).first()).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  await page.getByRole('button', { name: 'Clear' }).first().click()
  await expect(page.getByRole('button', { name: 'Monthly' }).first()).toHaveAttribute(
    'aria-pressed',
    'false'
  )

  await page.getByRole('button', { name: 'Sort Outstanding Balance' }).click()
  await expect
    .poll(() =>
      page.evaluate(
        () => localStorage.getItem('cashiers-report-in-house-accounts-active-sort') ?? ''
      )
    )
    .toContain('outstandingBalance')

  const firstAccountRow = page.getByRole('row').filter({ hasText: 'Santos, Maria Clara' })
  await firstAccountRow.focus()
  await firstAccountRow.press('ArrowUp')
  await expect(page.getByRole('heading', { name: 'Cruz, Luis Miguel' })).toBeVisible()

  await page.setViewportSize({ width: 900, height: 800 })
  await expect(page.getByRole('dialog', { name: 'Account details' })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 800 })
  await expect(page.getByRole('dialog', { name: 'Account details' })).toBeVisible()
})

test('Active Accounts keeps a bounded row DOM with 10,000 accounts', async ({ page }) => {
  await page.goto(baseUrl)
  await page.evaluate(() => {
    const accounts = Array.from({ length: 10_000 }, (_, index) => ({
      id: `IH-2026-${String(index + 1).padStart(5, '0')}`,
      branch: ['Goa', 'Tinambac', 'Tigaon', 'Lagonoy'][index % 4],
      lastName: `Customer ${index + 1}`,
      firstName: 'Test',
      barangay: 'Test Barangay',
      cityMunicipality: 'Goa',
      province: 'Camarines Sur',
      contacts: [
        {
          id: `contact-${index + 1}`,
          kind: 'mobile',
          value: `09${String(index).padStart(9, '0')}`,
          isPrimary: true
        }
      ],
      emails: [],
      createdAt: '2026-07-17T00:00:00.000Z',
      updatedAt: '2026-07-17T00:00:00.000Z'
    }))
    localStorage.setItem('cashiers-report-in-house-accounts', JSON.stringify(accounts))
  })
  await page.reload()
  await signIn(page)
  await page.getByRole('button', { name: 'Finance' }).click()
  await page.getByText('In-house', { exact: true }).click()
  await page.getByRole('link', { name: 'Active Accounts' }).click()

  await expect(page.getByText('Showing 1–25 of 10,000 Active Accounts')).toBeVisible()
  await expect.poll(() => page.locator('tbody tr').count()).toBeLessThanOrEqual(25)
  await page
    .getByLabel('Search active accounts by name, account ID, or mobile number')
    .fill('10000')
  await expect(page.getByText('Showing 1–1 of 1 Active Accounts')).toBeVisible()
})
