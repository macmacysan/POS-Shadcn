/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { createHash } from 'node:crypto'

export function businessManifest(db) {
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )
    .all()
    .map(({ name }) => name)
  return Object.fromEntries(
    tables.map((table) => {
      const rows = db
        .prepare(`SELECT * FROM \"${table.replaceAll('\"', '\"\"')}\" ORDER BY rowid`)
        .all()
      return [table, createHash('sha256').update(JSON.stringify(rows)).digest('hex')]
    })
  )
}

export function assertDatabaseHealthy(assert, db, schemaVersion) {
  assert.equal(db.pragma('integrity_check', { simple: true }), 'ok')
  assert.deepEqual(db.pragma('foreign_key_check'), [])
  assert.equal(
    db.prepare('SELECT MAX(version) AS version FROM schema_migrations').get().version,
    schemaVersion
  )
}

export function seedPortableBusinessData(db, prefix) {
  const now = '2026-09-08T00:00:00.000Z'
  const id = (name) => `${prefix}-${name}`
  const branch = db.prepare("SELECT id FROM branches WHERE name = 'Goa'").get().id
  const first = (table) => db.prepare(`SELECT id FROM ${table} LIMIT 1`).get().id
  const [receipt, method, deduction, denomination, incomeCategory, ruleVersion] = [
    first('receipt_types'),
    first('report_payment_methods'),
    first('deduction_types'),
    first('cash_denominations'),
    first('income_categories'),
    first('installment_rule_versions')
  ]
  db.transaction(() => {
    db.prepare(
      'INSERT INTO users (id, branch_id, username, password_hash, display_name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id('user'), branch, id('user'), 'hash', `${prefix} User`, 'ADMIN', now, now)
    db.prepare('INSERT INTO user_branch_assignments (user_id, branch_id) VALUES (?, ?)').run(
      id('user'),
      branch
    )
    db.prepare(
      "INSERT INTO reports (id, branch_id, cashier_id, business_date, status, created_at, updated_at) VALUES (?, ?, ?, '2026-09-08', 'Draft', ?, ?)"
    ).run(id('report'), branch, id('user'), now, now)
    db.prepare(
      "INSERT INTO daily_reports (id, branch_id, cashier_user_id, business_date, opening_cash_centavos, status, created_at, updated_at) VALUES (?, ?, ?, '2026-09-08', 50000, 'DRAFT', ?, ?)"
    ).run(id('report'), branch, id('user'), now, now)
    db.prepare(
      'INSERT INTO daily_receipt_totals (id, daily_report_id, receipt_type_id, quantity, amount_centavos, created_at, updated_at) VALUES (?, ?, ?, 2, 12345, ?, ?)'
    ).run(id('receipt'), id('report'), receipt, now, now)
    db.prepare(
      "INSERT INTO daily_report_payment_entries (id, daily_report_id, payment_method_id, transaction_date, amount_centavos, status, created_by_user_id, created_at, updated_at) VALUES (?, ?, ?, '2026-09-08', 23456, 'POSTED', ?, ?, ?)"
    ).run(id('payment-entry'), id('report'), method, id('user'), now, now)
    db.prepare(
      "INSERT INTO income_entries (id, daily_report_id, category_id, transaction_date, particular, amount_centavos, status, created_by_user_id, created_at, updated_at) VALUES (?, ?, ?, '2026-09-08', ?, 34567, 'POSTED', ?, ?, ?)"
    ).run(id('income'), id('report'), incomeCategory, `${prefix} income`, id('user'), now, now)
    db.prepare(
      "INSERT INTO expenses (id, report_id, type, description, category, receipt_no, vat, amount_centavos, created_by_user_id, created_at, updated_at) VALUES (?, ?, 'Company Expenses', ?, 'General', 'R-1', '', 45678, ?, ?, ?)"
    ).run(id('expense'), id('report'), `${prefix} expense`, id('user'), now, now)
    db.prepare(
      "INSERT INTO cash_out_entries (id, daily_report_id, transaction_date, description, amount_centavos, status, created_by_user_id, created_at, updated_at) VALUES (?, ?, '2026-09-08', ?, 5678, 'POSTED', ?, ?, ?)"
    ).run(id('cash-out'), id('report'), `${prefix} cash out`, id('user'), now, now)
    db.prepare(
      'INSERT INTO daily_report_deductions (id, daily_report_id, deduction_type_id, amount_centavos, created_at, updated_at) VALUES (?, ?, ?, 6789, ?, ?)'
    ).run(id('deduction'), id('report'), deduction, now, now)
    db.prepare(
      'INSERT INTO daily_report_cash_counts (id, daily_report_id, denomination_id, quantity, created_at, updated_at) VALUES (?, ?, ?, 7, ?, ?)'
    ).run(id('cash-count'), id('report'), denomination, now, now)
    db.prepare(
      'INSERT INTO accounts (id, account_number, display_name, branch_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id('account'), `${prefix}-1`, `${prefix} Account`, branch, now, now)
    db.prepare(
      "INSERT INTO account_contacts (id, account_id, contact_type, contact_value, created_at, updated_at) VALUES (?, ?, 'PHONE', '09170000000', ?, ?)"
    ).run(id('contact'), id('account'), now, now)
    db.prepare(
      "INSERT INTO installment_contracts (id, account_id, branch_id, installment_type_id, contract_number, contract_date, date_released, start_date, first_due_date, payment_frequency, terms, principal_centavos, installment_amount_centavos, financed_amount_centavos, total_payable_centavos, configuration_version_id, created_by_user_id, created_at, updated_at) VALUES (?, ?, ?, 'installment-type-in-house', ?, '2026-09-08', '2026-09-08', '2026-09-08', '2026-09-15', 'Weekly', '2', 100000, 50000, 100000, 100000, ?, ?, ?, ?)"
    ).run(
      id('contract'),
      id('account'),
      branch,
      `${prefix}-contract`,
      ruleVersion,
      id('user'),
      now,
      now
    )
    db.prepare(
      'INSERT INTO installment_items (id, contract_id, description, quantity, unit_price_centavos, item_total_centavos, created_at, updated_at) VALUES (?, ?, ?, 1, 100000, 100000, ?, ?)'
    ).run(id('item'), id('contract'), `${prefix} item`, now, now)
    db.prepare(
      "INSERT INTO in_house_schedules (id, contract_id, installment_number, due_date, due_amount_centavos, status, created_at, updated_at) VALUES (?, ?, 1, '2026-09-15', 50000, 'PARTIALLY_PAID', ?, ?)"
    ).run(id('schedule'), id('contract'), now, now)
    db.prepare(
      "INSERT INTO in_house_payments (id, contract_id, submission_id, payment_date, amount_centavos, penalty_centavos, status, received_by_user_id, created_at, updated_at) VALUES (?, ?, ?, '2026-09-08', 25000, 0, 'POSTED', ?, ?, ?)"
    ).run(id('payment'), id('contract'), id('submission'), id('user'), now, now)
    db.prepare(
      'INSERT INTO installment_payment_allocations (id, payment_id, schedule_id, allocated_amount_centavos, penalty_centavos, created_at) VALUES (?, ?, ?, 25000, 0, ?)'
    ).run(id('allocation'), id('payment'), id('schedule'), now)
    db.prepare(
      "INSERT INTO installment_restructures (id, contract_id, first_due_date, payment_frequency, terms, outstanding_balance_centavos, reason, created_by_user_id, created_at) VALUES (?, ?, '2026-09-22', 'Weekly', 2, 75000, ?, ?, ?)"
    ).run(id('restructure'), id('contract'), `${prefix} test`, id('user'), now)
    db.prepare(
      "INSERT INTO finance_accounts (id, branch, provider, date_released, terms_months, last_name, first_name, quantity, item, item_price_centavos, grand_total_centavos, downpayment_centavos, balance_centavos, created_at, updated_at) VALUES (?, 'Goa', 'Home Credit', '2026-09-08', 12, ?, ?, 1, ?, 90000, 90000, 10000, 80000, ?, ?)"
    ).run(id('finance'), prefix, 'Portable', `${prefix} phone`, now, now)
    db.prepare(
      'INSERT INTO finance_account_items (id, finance_account_id, sort_order, item, quantity, item_price_centavos, total_centavos, created_at, updated_at) VALUES (?, ?, 0, ?, 1, 90000, 90000, ?, ?)'
    ).run(id('finance-item'), id('finance'), `${prefix} phone`, now, now)
    db.prepare(
      "INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, created_at) VALUES (?, ?, 'CREATE', ?, ?, ?)"
    ).run(id('audit'), id('user'), prefix, id('contract'), now)
    db.prepare(
      "INSERT INTO audit_log_changes (id, audit_log_id, column_name, old_value, new_value) VALUES (?, ?, 'amount_centavos', '0', '100000')"
    ).run(id('audit-change'), id('audit'))
    db.prepare(
      "INSERT INTO catalog_options (id, kind, value, created_at, updated_at) VALUES (?, 'FINANCE_TYPE', ?, ?, ?)"
    ).run(id('catalog'), `${prefix} Provider`, now, now)
  })()
  return {
    branch,
    ids: Object.fromEntries(
      ['user', 'report', 'account', 'contract', 'finance'].map((name) => [name, id(name)])
    )
  }
}
