import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page
} from '@playwright/test'
import path from 'node:path'

import type { InstallmentPaymentWorkspace } from '../src/shared/contracts'

type Workspace = InstallmentPaymentWorkspace

async function paymentWorkspace(
  page: Page,
  accountId: string
): Promise<InstallmentPaymentWorkspace> {
  return page.evaluate(
    (id) => window.api.installments.getPaymentWorkspace({ accountId: id }),
    accountId
  )
}

async function signIn(page: Page): Promise<void> {
  await page.getByRole('combobox', { name: 'Branch' }).click()
  await page.getByRole('option', { name: 'Goa' }).click()
  await page.getByLabel('Username').fill('cashier')
  await page.getByRole('textbox', { name: 'Password' }).fill('password')
  await page.getByRole('button', { name: 'Continue' }).click()
}

async function postPayment(
  page: Page,
  workspace: Workspace,
  amountCentavos: number,
  submissionId: string,
  penaltyCentavos = 0
): Promise<void> {
  await page.evaluate(
    async ({
      accountId,
      contractId,
      amountCentavos: amount,
      penalty: penaltyCentavos,
      submissionId: submission
    }) => {
      await window.api.installments.createPayment({
        accountId,
        contractId,
        submissionId: submission,
        paymentDate: '2026-07-25',
        amountCentavos: amount,
        penaltyCentavos,
        actorUserId: 'development-cashier'
      })
    },
    {
      accountId: workspace.account.id,
      contractId: workspace.contractId,
      amountCentavos,
      penalty: penaltyCentavos,
      submissionId
    }
  )
}

async function adjustPayment(
  page: Page,
  workspace: Workspace,
  scheduleId: string,
  amountCentavos: number,
  submissionId: string
): Promise<void> {
  await page.evaluate(
    async ({
      accountId,
      contractId,
      scheduleId: schedule,
      amountCentavos: amount,
      submissionId: submission
    }) => {
      await window.api.installments.adjustPayment({
        accountId,
        contractId,
        scheduleId: schedule,
        submissionId: submission,
        paymentDate: '2026-07-26',
        amountCentavos: amount,
        reason: 'Corrected receipt amount',
        actorUserId: 'development-cashier'
      })
    },
    {
      accountId: workspace.account.id,
      contractId: workspace.contractId,
      scheduleId,
      amountCentavos,
      submissionId
    }
  )
}

test.describe('in-house payment workspace in Electron', () => {
  test.setTimeout(90_000)

  test('routes account workspaces and posts exact, idempotent allocations', async ({
    browserName
  }, testInfo) => {
    void browserName
    const userDataDir = testInfo.outputPath(`payment-workspace-${Date.now()}`)
    const ids = {
      full: 'PAY-VALID-FULL',
      partial: 'PAY-VALID-PARTIAL',
      multi: 'PAY-VALID-MULTI',
      settlement: 'PAY-VALID-SETTLEMENT',
      overpayment: 'PAY-VALID-OVERPAYMENT',
      rejected: 'PAY-VALID-REJECTED',
      duplicate: 'PAY-VALID-DUPLICATE',
      blacklisted: 'PAY-VALID-BLACKLISTED',
      closed: 'PAY-VALID-CLOSED'
    }
    let app: ElectronApplication | undefined

    try {
      app = await electron.launch({
        args: [`--user-data-dir=${userDataDir}`, path.resolve('.')]
      })
      const page = await app.firstWindow()
      await expect(page.getByRole('heading', { name: 'Cashier Daily Report' })).toBeVisible()
      await signIn(page)

      await page.evaluate(async (input) => {
        await window.api.installments.bootstrap({
          accounts: Object.values(input).map((id) => ({
            id,
            branch: 'Lagonoy',
            firstName: 'Validation',
            lastName: id,
            barangay: 'Market Site',
            cityMunicipality: 'Lagonoy',
            province: 'Camarines Sur',
            contacts: [],
            emails: [],
            createdAt: '2026-07-25T00:00:00.000Z',
            updatedAt: '2026-07-25T00:00:00.000Z'
          })),
          loans: Object.values(input).map((id) => ({
            id: `contract-${id}`,
            customerId: id,
            dateReleased: '2026-07-01',
            startDate: '2026-07-01',
            firstDueDate: '2026-08-01',
            paymentFrequency: 'Monthly',
            terms: '3 months',
            principal: 1000.03,
            interest: 0,
            downPayment: 0,
            fees: 0,
            installmentAmount: 333.34,
            grandTotal: 1000.03,
            items: [{ id: `item-${id}`, name: 'Validation item', quantity: 1, price: 781.27 }],
            createdAt: '2026-07-25T00:00:00.000Z',
            updatedAt: '2026-07-25T00:00:00.000Z'
          }))
        })
      }, ids)

      const full = await paymentWorkspace(page, ids.full)
      expect(full.schedules.map((item) => item.dueAmountCentavos)).toEqual([33334, 33334, 33335])
      await postPayment(page, full, full.schedules[0].dueAmountCentavos, 'full-schedule')
      const fullAfter = await paymentWorkspace(page, ids.full)
      expect(fullAfter.totalPaidCentavos).toBe(33334)
      expect(fullAfter.schedules[0]).toMatchObject({ paidAmountCentavos: 33334, status: 'PAID' })
      expect(fullAfter.schedules.map((item) => item.balanceCentavos)).toEqual([66669, 66669, 66669])
      const activeRecords = await page.evaluate(() =>
        window.api.installments.list({ view: 'active', search: '', includeVoided: false })
      )
      expect(
        activeRecords.rows.find((row) => row.contractId === full.contractId)?.meta.nextDue
      ).toBe(fullAfter.schedules[1].dueDate)

      const partial = await paymentWorkspace(page, ids.partial)
      await postPayment(page, partial, 10000, 'partial-schedule')
      const partialAfter = await paymentWorkspace(page, ids.partial)
      expect(partialAfter.schedules[0]).toMatchObject({
        paidAmountCentavos: 10000,
        status: 'PARTIALLY_PAID'
      })
      expect(partialAfter.schedules.map((item) => item.balanceCentavos)).toEqual([
        90003, 90003, 90003
      ])
      await page.evaluate(
        async ({ accountId, contractId, scheduleId }) => {
          await window.api.installments.createPayment({
            accountId,
            contractId,
            scheduleId,
            submissionId: 'target-later-schedule',
            paymentDate: '2026-07-25',
            amountCentavos: 7000,
            actorUserId: 'development-cashier'
          })
        },
        {
          accountId: partial.account.id,
          contractId: partial.contractId,
          scheduleId: partial.schedules[1].id
        }
      )
      const targetedAfter = await paymentWorkspace(page, ids.partial)
      expect(targetedAfter.schedules[1]).toMatchObject({ paidAmountCentavos: 7000 })
      await adjustPayment(
        page,
        targetedAfter,
        targetedAfter.schedules[1].id,
        3000,
        'adjust-targeted-schedule'
      )
      const adjustedAfter = await paymentWorkspace(page, ids.partial)
      expect(adjustedAfter.schedules[0]).toMatchObject({ paidAmountCentavos: 10000 })
      expect(adjustedAfter.schedules[1]).toMatchObject({
        paidAmountCentavos: 3000,
        status: 'PARTIALLY_PAID',
        isAdjusted: true
      })
      expect(adjustedAfter.payments.some((payment) => payment.status === 'VOIDED')).toBeTruthy()
      expect(adjustedAfter.payments.some((payment) => payment.isAdjustment)).toBeTruthy()
      await adjustPayment(
        page,
        adjustedAfter,
        adjustedAfter.schedules[1].id,
        0,
        'void-targeted-schedule'
      )
      const voidedAfter = await paymentWorkspace(page, ids.partial)
      expect(voidedAfter.schedules[1]).toMatchObject({
        paidAmountCentavos: 0,
        status: 'DUE',
        isAdjusted: true
      })

      const multi = await paymentWorkspace(page, ids.multi)
      await postPayment(page, multi, 66718, 'multiple-schedules')
      const multiAfter = await paymentWorkspace(page, ids.multi)
      expect(multiAfter.schedules.map((item) => item.paidAmountCentavos)).toEqual([
        33334, 33334, 50
      ])
      expect(multiAfter.schedules.map((item) => item.status)).toEqual([
        'PAID',
        'PAID',
        'PARTIALLY_PAID'
      ])
      expect(multiAfter.schedules.map((item) => item.balanceCentavos)).toEqual([
        66669, 33335, 33285
      ])

      const overpayment = await paymentWorkspace(page, ids.overpayment)
      const overpaymentAmount = overpayment.schedules[0].dueAmountCentavos + 500
      await postPayment(page, overpayment, overpaymentAmount, 'overpayment', 500)
      const overpaymentAfter = await paymentWorkspace(page, ids.overpayment)
      expect(overpaymentAfter.schedules[0]).toMatchObject({
        paidAmountCentavos: overpayment.schedules[0].dueAmountCentavos,
        penaltyCentavos: 500,
        status: 'PAID'
      })
      expect(overpaymentAfter.schedules[1].paidAmountCentavos).toBe(500)
      expect(overpaymentAfter.totalPaidCentavos).toBe(overpaymentAmount)
      expect(overpaymentAfter.outstandingBalanceCentavos).toBe(
        overpayment.outstandingBalanceCentavos - overpaymentAmount
      )

      const settlement = await paymentWorkspace(page, ids.settlement)
      await postPayment(page, settlement, settlement.outstandingBalanceCentavos, 'settle-balance')
      const settlementAfter = await paymentWorkspace(page, ids.settlement)
      expect(settlementAfter.outstandingBalanceCentavos).toBe(0)
      expect(settlementAfter.schedules.every((item) => item.status === 'PAID')).toBeTruthy()

      const closed = await paymentWorkspace(page, ids.closed)
      await postPayment(page, closed, closed.outstandingBalanceCentavos, 'close-balance')
      await page.evaluate(
        async (input) => {
          await window.api.installments.closeContract({
            accountId: input.accountId,
            contractId: input.contractId,
            remarks: 'Validation closure',
            actorUserId: 'development-cashier'
          })
        },
        { accountId: closed.account.id, contractId: closed.contractId }
      )
      expect((await paymentWorkspace(page, ids.closed)).contractStatus).toBe('CLOSED')

      const rejected = await paymentWorkspace(page, ids.rejected)
      const rejections = await page.evaluate(
        async (input) => {
          const request = {
            accountId: input.accountId,
            contractId: input.contractId,
            paymentDate: '2026-07-25',
            actorUserId: 'development-cashier'
          }
          const results = await Promise.all([
            window.api.installments
              .createPayment({
                ...request,
                submissionId: 'over',
                amountCentavos: input.balance + 1
              })
              .then(() => 'accepted')
              .catch(() => 'rejected'),
            window.api.installments
              .createPayment({ ...request, submissionId: 'zero', amountCentavos: 0 })
              .then(() => 'accepted')
              .catch(() => 'rejected'),
            window.api.installments
              .createPayment({ ...request, submissionId: 'negative', amountCentavos: -1 })
              .then(() => 'accepted')
              .catch(() => 'rejected')
          ])
          return results
        },
        {
          accountId: rejected.account.id,
          contractId: rejected.contractId,
          balance: rejected.outstandingBalanceCentavos
        }
      )
      expect(rejections).toEqual(['accepted', 'rejected', 'rejected'])
      expect((await paymentWorkspace(page, ids.rejected)).payments).toHaveLength(1)

      const duplicate = await paymentWorkspace(page, ids.duplicate)
      await Promise.all([
        postPayment(page, duplicate, 10000, 'same-submission'),
        postPayment(page, duplicate, 10000, 'same-submission')
      ])
      const duplicateAfter = await paymentWorkspace(page, ids.duplicate)
      expect(duplicateAfter.payments).toHaveLength(1)
      expect(duplicateAfter.totalPaidCentavos).toBe(10000)

      const blacklisted = await paymentWorkspace(page, ids.blacklisted)
      await page.evaluate(
        async (input) => {
          await window.api.installments.blacklistAccount({
            accountId: input.accountId,
            contractId: input.contractId,
            remarks: 'Validation restriction',
            actorUserId: 'development-cashier'
          })
        },
        { accountId: blacklisted.account.id, contractId: blacklisted.contractId }
      )
      await expect
        .poll(async () => paymentWorkspace(page, ids.blacklisted))
        .toMatchObject({ accountStatus: 'BLACKLISTED' })
      expect(
        await page.evaluate(
          async (input) => {
            try {
              await window.api.installments.createPayment(input)
              return 'accepted'
            } catch {
              return 'rejected'
            }
          },
          {
            accountId: blacklisted.account.id,
            contractId: blacklisted.contractId,
            submissionId: 'blacklisted-payment',
            paymentDate: '2026-07-25',
            amountCentavos: 10000,
            actorUserId: 'development-cashier'
          }
        )
      ).toBe('rejected')

      const closedPaymentResult = await page.evaluate(
        async (input) => {
          try {
            await window.api.installments.createPayment(input)
            return 'accepted'
          } catch {
            return 'rejected'
          }
        },
        {
          accountId: closed.account.id,
          contractId: closed.contractId,
          submissionId: 'closed-payment',
          paymentDate: '2026-07-25',
          amountCentavos: 10000,
          actorUserId: 'development-cashier'
        }
      )
      expect(closedPaymentResult).toBe('rejected')

      for (const id of [ids.closed, ids.blacklisted]) {
        await page.evaluate((accountId) => {
          window.location.hash = `/installments/in-house/accounts/${accountId}/payments?tab=ledger&from=records`
        }, id)
        await expect(page.getByRole('button', { name: 'Record Payment' })).toHaveCount(0)
      }

      await page.evaluate(() => {
        window.location.hash = ''
      })
      await page.getByRole('link', { name: 'Active', exact: true }).click()
      const activeRow = page.getByRole('row').filter({ hasText: ids.full })
      await activeRow.getByRole('button', { name: 'Open active account actions' }).click()
      await page.getByRole('menuitem', { name: 'Record Payment' }).click()
      await expect(page).toHaveURL(
        new RegExp(`/accounts/${ids.full}/payments\\?tab=schedule&from=active`)
      )
      await expect(page.getByRole('tab', { name: 'Payment schedule' })).toHaveAttribute(
        'aria-selected',
        'true'
      )
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await page.getByRole('button', { name: 'Back to Active Accounts' }).click()
      await activeRow.getByRole('button', { name: 'Open active account actions' }).click()
      await page.getByRole('menuitem', { name: 'View Ledger' }).click()
      await expect(page).toHaveURL(
        new RegExp(`/accounts/${ids.full}/payments\\?tab=ledger&from=active`)
      )

      await page.evaluate((id) => {
        window.location.hash = `/installments/in-house/accounts/${id}/payments?tab=ledger&from=active`
      }, ids.full)
      await expect(
        page.getByRole('heading', { name: `${ids.full}, Validation` }).first()
      ).toBeVisible()
      await expect(page.getByRole('tab', { name: 'Ledger' })).toHaveAttribute(
        'aria-selected',
        'true'
      )
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Back to Active Accounts' })).toBeVisible()
      await expect(page.getByRole('link', { name: 'Active', exact: true })).toBeVisible()

      for (const size of [
        { width: 1366, height: 768 },
        { width: 900, height: 670 }
      ]) {
        await app.evaluate(({ BrowserWindow }, nextSize) => {
          BrowserWindow.getAllWindows()[0]?.setSize(nextSize.width, nextSize.height)
        }, size)
        await page.waitForTimeout(100)
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
        ).toBeTruthy()
        await expect(page.getByRole('columnheader', { name: 'Amount received' })).toBeVisible()
        await expect(page.getByRole('button', { name: 'Back to Active Accounts' })).toBeVisible()
        await page.screenshot({
          path: testInfo.outputPath(`payment-workspace-${size.width}x${size.height}.png`)
        })
      }

      await page.getByRole('tab', { name: 'Payment schedule' }).click()
      await expect(page.getByRole('columnheader', { name: 'Balance' })).toBeVisible()
      const scheduleRows = page.locator('tbody tr')
      await expect(scheduleRows.nth(0).getByText('PAID', { exact: true })).toHaveClass(
        /bg-success\/10/
      )
      await expect(scheduleRows.nth(1).getByText('DUE', { exact: true })).toHaveClass(
        /bg-destructive\/10/
      )
      await expect(scheduleRows.nth(0).locator('td').nth(3)).not.toBeEmpty()
      await expect(scheduleRows.nth(1).locator('td').nth(3)).toBeEmpty()
      await expect(scheduleRows.nth(1).locator('td').first().locator('span')).toHaveClass(
        /text-muted-foreground/
      )
      await expect(scheduleRows.nth(0).locator('td').nth(4)).toHaveText('₱666.69')
      await expect(scheduleRows.nth(1).locator('td').nth(4)).toHaveText('₱666.69')
      await scheduleRows.first().dblclick()
      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Adjust payment' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Void & repost' })).toBeVisible()
      await page.getByRole('button', { name: 'Cancel' }).click()
      await scheduleRows.nth(1).dblclick()
      await expect(page.getByRole('heading', { name: 'Record payment' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Post Payment' })).toBeVisible()
      await page.getByRole('button', { name: 'Cancel' }).click()

      await page.goBack()
      await expect(page.getByText(ids.full, { exact: true }).first()).toBeVisible()

      await page.evaluate(() => {
        window.location.hash = '/installments/in-house/accounts//payments?from=active'
      })
      await expect(page.getByText('Installment account not found', { exact: true })).toBeVisible()
    } finally {
      await app?.close()
    }
  })
})
