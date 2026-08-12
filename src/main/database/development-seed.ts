import type Database from 'better-sqlite3'

import { developmentReportId } from '../../shared/contracts'
import { calculateFinanceAmounts } from '../../shared/finance-calculations'
import { hashPassword } from '../security/passwords'

const developmentDate = '2026-07-14'
const developmentTimestamp = '2026-07-14T08:00:00.000Z'

export function seedDevelopmentData(db: Database.Database): void {
  seedDevelopmentUsers(db)
  const report = db.prepare('SELECT id FROM reports WHERE id = ?').get(developmentReportId)

  const insertReport = db.prepare(`
    INSERT INTO reports (
      id, branch_id, cashier_id, business_date, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  const insertExpense = db.prepare(`
    INSERT INTO expenses (
      id, report_id, type, description, category, receipt_no, vat,
      amount_centavos, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const seed = db.transaction(() => {
    if (!report) {
      insertReport.run(
        developmentReportId,
        'development-lagonoy',
        'development-cashier',
        developmentDate,
        'Draft',
        developmentTimestamp,
        developmentTimestamp
      )

      for (let index = 0; index < 105; index += 1) {
        const type = index % 3 === 0 ? 'Operating' : index % 3 === 1 ? 'Supply' : 'Transport'
        const category =
          index % 3 === 0
            ? 'Office Expenses and Supplies'
            : index % 3 === 1
              ? 'Freight, Postage and Shipping'
              : 'Utilities'
        const amountCentavos = (350 + index * 25) * 100

        insertExpense.run(
          `expense-${index + 1}`,
          developmentReportId,
          type,
          [
            'Printer paper, toner, and office supplies',
            'Fuel and tolls for customer deliveries',
            'Monthly electricity and water bill'
          ][index % 3],
          category,
          `EXP-${String(index + 1).padStart(4, '0')}`,
          index % 3 === 0 ? 'VAT' : index % 3 === 1 ? 'Non-VAT' : '',
          amountCentavos,
          developmentTimestamp,
          developmentTimestamp
        )
      }
    }
  })

  seed()
  seedDevelopmentInstallments(db)
  seedDevelopmentFinanceAccounts(db)
}

function seedDevelopmentUsers(db: Database.Database): void {
  const now = new Date().toISOString()
  const branches = [
    ['development-goa', 'GOA', 'Goa'],
    ['development-tinambac', 'TIN', 'Tinambac'],
    ['development-tigaon', 'TIG', 'Tigaon'],
    ['development-lagonoy', 'LAG', 'Lagonoy']
  ] as const
  const insertBranch = db.prepare(
    `INSERT OR IGNORE INTO branches (id, code, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
  )
  const insertUser = db.prepare(
    `INSERT OR IGNORE INTO users (
      id, branch_id, username, password_hash, display_name, role, is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`
  )
  const seed = db.transaction(() => {
    for (const [id, code, name] of branches) {
      insertBranch.run(id, code, name, now, now)
      insertUser.run(
        `development-cashier-${name.toLowerCase()}`,
        id,
        `cashier-${name.toLowerCase()}`,
        hashPassword('cashier123'),
        `${name} Cashier`,
        'CASHIER',
        now,
        now
      )
    }
    insertUser.run(
      'development-admin',
      null,
      'admin',
      hashPassword('admin'),
      'Development Admin',
      'ADMIN',
      now,
      now
    )
    db.prepare(
      `UPDATE users
          SET password_hash = ?, display_name = 'Development Admin', role = 'ADMIN',
              is_active = 1, updated_at = ?
        WHERE id = 'development-admin'`
    ).run(hashPassword('admin'), now)
    db.prepare('UPDATE reports SET cashier_id = ? WHERE id = ?').run(
      'development-cashier-lagonoy',
      developmentReportId
    )
  })
  seed()
}

function seedDevelopmentInstallments(db: Database.Database): void {
  const now = developmentTimestamp
  const insertAccount = db.prepare(`
    INSERT OR IGNORE INTO accounts (
      id, account_number, display_name, account_type, last_name, first_name,
      middle_name, barangay, city_municipality, province, occupation, agent,
      referred_by, status, blacklisted_at, blacklisted_by_user_id, blacklist_reason,
      is_active, created_at, updated_at
    ) VALUES (?, ?, ?, 'CUSTOMER', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `)
  const insertContact = db.prepare(`
    INSERT OR IGNORE INTO account_contacts (
      id, account_id, contact_type, contact_kind, contact_value, is_primary, created_at, updated_at
    ) VALUES (?, ?, 'PHONE', 'mobile', ?, 1, ?, ?)
  `)
  const insertContract = db.prepare(`
    INSERT OR IGNORE INTO installment_contracts (
      id, account_id, branch_id, installment_type_id, contract_number, contract_date,
      date_released, start_date, first_due_date, payment_frequency, terms,
      principal_centavos, interest_centavos, down_payment_centavos, fees_centavos,
      installment_amount_centavos, financed_amount_centavos, total_payable_centavos,
      status, closed_at, closed_by_user_id, close_reason, remarks, created_by_user_id,
      created_at, updated_at
    ) VALUES (?, ?, 'development-lagonoy', 'installment-type-in-house', ?, ?, ?, ?, ?,
      'Monthly', '12 months', 12000000, 2400000, 0, 0, 1200000, 14400000, 14400000,
      ?, ?, ?, ?, ?, 'development-cashier', ?, ?)
  `)
  const insertItem = db.prepare(`
    INSERT OR IGNORE INTO installment_items (
      id, contract_id, description, quantity, unit_price_centavos, item_total_centavos, created_at, updated_at
    ) VALUES (?, ?, ?, 1, 12000000, 12000000, ?, ?)
  `)
  const insertSchedule = db.prepare(`
    INSERT OR IGNORE INTO in_house_schedules (
      id, contract_id, installment_number, due_date, due_amount_centavos, status, created_at, updated_at
    ) VALUES (?, ?, 1, ?, 14400000, 'PAID', ?, ?)
  `)
  const insertPayment = db.prepare(`
    INSERT OR IGNORE INTO in_house_payments (
      id, contract_id, payment_date, amount_centavos, reference_number, status,
      received_by_user_id, created_at, updated_at
    ) VALUES (?, ?, ?, 14400000, ?, 'POSTED', 'development-cashier', ?, ?)
  `)
  const insertAllocation = db.prepare(`
    INSERT OR IGNORE INTO installment_payment_allocations (
      id, payment_id, schedule_id, allocated_amount_centavos, created_at
    ) VALUES (?, ?, ?, 14400000, ?)
  `)
  const insertHistory = db.prepare(`
    INSERT OR IGNORE INTO installment_activity_history (
      id, contract_id, actor_user_id, action, activity, created_at
    ) VALUES (?, ?, 'development-cashier', 'STATUS_CHANGE', ?, ?)
  `)

  const seed = db.transaction(() => {
    for (let index = 1; index <= 40; index += 1) {
      const number = String(index).padStart(2, '0')
      const accountId = `development-installment-account-${number}`
      const contractId = `development-installment-contract-${number}`
      const status = index > 30 ? 'BLACKLISTED' : 'ACTIVE'
      const contractStatus = index > 20 && index <= 30 ? 'CLOSED' : 'ACTIVE'
      const name = `Sample Customer ${number}`
      const createdAt = `2026-07-${String(1 + ((index - 1) % 20)).padStart(2, '0')}T08:00:00.000Z`
      const closedAt = contractStatus === 'CLOSED' ? '2026-07-20T08:00:00.000Z' : null
      const blacklistAt = status === 'BLACKLISTED' ? '2026-07-20T08:00:00.000Z' : null

      insertAccount.run(
        accountId,
        `DEV-IH-${number}`,
        name,
        `Customer${number}`,
        'Sample',
        null,
        'Poblacion',
        'Lagonoy',
        'Camarines Sur',
        'Employee',
        'Development Seed',
        'Development Seed',
        status,
        blacklistAt,
        status === 'BLACKLISTED' ? 'development-cashier' : null,
        status === 'BLACKLISTED' ? 'Development blacklist sample' : null,
        createdAt,
        now
      )
      insertContact.run(`development-installment-contact-${number}`, accountId, `091700000${number}`, createdAt, now)
      insertContract.run(
        contractId,
        accountId,
        `DEV-CONTRACT-${number}`,
        createdAt.slice(0, 10),
        createdAt.slice(0, 10),
        createdAt.slice(0, 10),
        '2026-08-01',
        contractStatus,
        closedAt,
        contractStatus === 'CLOSED' ? 'development-cashier' : null,
        contractStatus === 'CLOSED' ? 'Development closed sample' : null,
        'Development installment sample',
        contractStatus === 'CLOSED' ? '2026-07-20T08:00:00.000Z' : now,
        now
      )
      insertItem.run(`development-installment-item-${number}`, contractId, `Sample Item ${number}`, createdAt, now)

      if (contractStatus === 'CLOSED') {
        const scheduleId = `development-installment-schedule-${number}`
        const paymentId = `development-installment-payment-${number}`
        insertSchedule.run(scheduleId, contractId, '2026-08-01', createdAt, now)
        insertPayment.run(paymentId, contractId, '2026-07-20', `DEV-PAY-${number}`, createdAt, now)
        insertAllocation.run(`development-installment-allocation-${number}`, paymentId, scheduleId, now)
        insertHistory.run(`development-installment-history-${number}`, contractId, 'Contract closed in development seed', now)
      }
    }
  })

  seed()
}

function seedDevelopmentFinanceAccounts(db: Database.Database): void {
  const insertAccount = db.prepare(`
    INSERT OR IGNORE INTO finance_accounts (
      id, branch, provider, date_released, terms_months, last_name, first_name, middle_name,
      suffix, quantity, item, serial_no, item_price_centavos, grand_total_centavos,
      downpayment_centavos, balance_centavos, or_number, or_date, paid_date, remarks,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertItem = db.prepare(`
    INSERT OR IGNORE INTO finance_account_items (
      id, finance_account_id, sort_order, item, serial_no, quantity, item_price_centavos,
      total_centavos, created_at, updated_at
    ) VALUES (?, ?, 0, ?, ?, ?, ?, ?, ?, ?)
  `)
  const branches = ['Goa', 'Tinambac', 'Tigaon', 'Lagonoy'] as const
  const providers = ['Home Credit', 'Salmon', 'Skyro'] as const
  const seed = db.transaction(() => {
    for (let index = 1; index <= 15; index += 1) {
      const number = String(index).padStart(2, '0')
      const id = `development-finance-account-${number}`
      const quantity = 1 + (index % 3)
      const itemPriceCentavos = (10000 + index * 1500) * 100
      const downpaymentCentavos = (index % 3) * 100000
      const amounts = calculateFinanceAmounts([{ quantity, itemPriceCentavos }], downpaymentCentavos)
      const createdAt = `2026-07-${String(index).padStart(2, '0')}T08:00:00.000Z`
      const item = `Sample Appliance ${number}`

      insertAccount.run(
        id,
        branches[(index - 1) % branches.length],
        providers[(index - 1) % providers.length],
        `2026-07-${String(index).padStart(2, '0')}`,
        3 + (index % 10),
        'Sample',
        `Client ${number}`,
        index % 2 === 0 ? 'M.' : null,
        index % 5 === 0 ? 'Jr.' : null,
        quantity,
        item,
        `DEV-FIN-${number}`,
        itemPriceCentavos,
        amounts.grandTotalCentavos,
        downpaymentCentavos,
        amounts.balanceCentavos,
        `FIN-${number}`,
        `2026-07-${String(index).padStart(2, '0')}`,
        null,
        'Development finance sample',
        createdAt,
        createdAt
      )
      insertItem.run(
        `development-finance-item-${number}`,
        id,
        item,
        `DEV-FIN-${number}`,
        quantity,
        itemPriceCentavos,
        quantity * itemPriceCentavos,
        createdAt,
        createdAt
      )
    }
  })

  seed()
}
