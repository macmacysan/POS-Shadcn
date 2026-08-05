import type Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'

import { buildInHouseSchedule } from '../services/in-house-schedule'

export const currentSchemaVersion = 16

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `)

  const applied = db
    .prepare('SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations')
    .get() as { version: number }

  if (applied.version > currentSchemaVersion) {
    throw new Error('Database schema is newer than this application.')
  }

  if (applied.version < 1) {
    const migrate = db.transaction(() => {
      db.exec(`
        CREATE TABLE reports (
          id TEXT PRIMARY KEY NOT NULL,
          branch_id TEXT NOT NULL,
          cashier_id TEXT NOT NULL,
          business_date TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('Draft', 'Submitted', 'Locked')),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE expenses (
          id TEXT PRIMARY KEY NOT NULL,
          report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          description TEXT NOT NULL,
          category TEXT NOT NULL,
          receipt_no TEXT NOT NULL,
          vat TEXT NOT NULL DEFAULT '',
          amount_centavos INTEGER NOT NULL CHECK (amount_centavos >= 0),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE INDEX expenses_report_created_idx
          ON expenses (report_id, created_at DESC, id DESC);
        CREATE INDEX expenses_report_type_idx
          ON expenses (report_id, type);
        CREATE INDEX expenses_report_category_idx
          ON expenses (report_id, category);
        CREATE INDEX expenses_report_vat_idx
          ON expenses (report_id, vat);
        CREATE INDEX expenses_report_receipt_no_idx
          ON expenses (report_id, receipt_no);
      `)
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(
        1,
        new Date().toISOString()
      )
    })

    migrate()
  }

  if (applied.version < 2) {
    const migrate = db.transaction(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS branches (
          id TEXT PRIMARY KEY,
          code TEXT NOT NULL COLLATE NOCASE UNIQUE,
          name TEXT NOT NULL COLLATE NOCASE UNIQUE,
          is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          branch_id TEXT,
          username TEXT NOT NULL COLLATE NOCASE UNIQUE,
          password_hash TEXT NOT NULL,
          display_name TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('CASHIER', 'ADMIN', 'SUPERVISOR', 'AUDITOR')),
          is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
          last_login_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS accounts (
          id TEXT PRIMARY KEY,
          account_number TEXT NOT NULL COLLATE NOCASE UNIQUE,
          display_name TEXT NOT NULL,
          account_type TEXT NOT NULL DEFAULT 'CUSTOMER'
            CHECK (account_type IN ('CUSTOMER', 'BUSINESS', 'OTHER')),
          last_name TEXT NOT NULL DEFAULT '',
          first_name TEXT NOT NULL DEFAULT '',
          middle_name TEXT,
          suffix TEXT,
          street_subdivision TEXT,
          barangay TEXT NOT NULL DEFAULT '',
          city_municipality TEXT NOT NULL DEFAULT '',
          province TEXT NOT NULL DEFAULT '',
          occupation TEXT,
          agent TEXT,
          referred_by TEXT,
          status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'BLACKLISTED')),
          blacklisted_at TEXT,
          blacklisted_by_user_id TEXT,
          blacklist_reason TEXT,
          is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (blacklisted_by_user_id) REFERENCES users(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS account_contacts (
          id TEXT PRIMARY KEY,
          account_id TEXT NOT NULL,
          contact_type TEXT NOT NULL CHECK (contact_type IN ('PHONE', 'EMAIL', 'ADDRESS', 'OTHER')),
          contact_kind TEXT,
          contact_value TEXT NOT NULL,
          is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
          UNIQUE (account_id, contact_type, contact_value)
        );

        CREATE TABLE IF NOT EXISTS installment_types (
          id TEXT PRIMARY KEY,
          code TEXT NOT NULL COLLATE NOCASE UNIQUE,
          name TEXT NOT NULL COLLATE NOCASE UNIQUE,
          provider_kind TEXT NOT NULL CHECK (provider_kind IN ('IN_HOUSE', 'EXTERNAL')),
          is_system INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0, 1)),
          is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
          created_by_user_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS installment_contracts (
          id TEXT PRIMARY KEY,
          account_id TEXT NOT NULL,
          branch_id TEXT NOT NULL,
          installment_type_id TEXT NOT NULL,
          contract_number TEXT NOT NULL COLLATE NOCASE UNIQUE,
          contract_date TEXT NOT NULL,
          date_released TEXT NOT NULL,
          start_date TEXT NOT NULL,
          first_due_date TEXT NOT NULL,
          payment_frequency TEXT NOT NULL CHECK (payment_frequency IN ('Weekly', 'Bi-weekly', 'Monthly')),
          terms TEXT NOT NULL,
          principal_centavos INTEGER NOT NULL DEFAULT 0 CHECK (principal_centavos >= 0),
          interest_centavos INTEGER NOT NULL DEFAULT 0 CHECK (interest_centavos >= 0),
          down_payment_centavos INTEGER NOT NULL DEFAULT 0 CHECK (down_payment_centavos >= 0),
          fees_centavos INTEGER NOT NULL DEFAULT 0 CHECK (fees_centavos >= 0),
          installment_amount_centavos INTEGER NOT NULL DEFAULT 0 CHECK (installment_amount_centavos >= 0),
          financed_amount_centavos INTEGER NOT NULL DEFAULT 0 CHECK (financed_amount_centavos >= 0),
          total_payable_centavos INTEGER NOT NULL DEFAULT 0 CHECK (total_payable_centavos >= 0),
          status TEXT NOT NULL DEFAULT 'ACTIVE'
            CHECK (status IN ('DRAFT', 'ACTIVE', 'CLOSED', 'VOIDED', 'DEFAULTED')),
          closed_at TEXT,
          closed_by_user_id TEXT,
          close_reason TEXT,
          remarks TEXT,
          created_by_user_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
          FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
          FOREIGN KEY (installment_type_id) REFERENCES installment_types(id) ON DELETE RESTRICT,
          FOREIGN KEY (closed_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
          FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS installment_items (
          id TEXT PRIMARY KEY,
          contract_id TEXT NOT NULL,
          description TEXT NOT NULL,
          quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
          unit_price_centavos INTEGER NOT NULL CHECK (unit_price_centavos >= 0),
          item_total_centavos INTEGER NOT NULL CHECK (item_total_centavos >= 0),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (contract_id) REFERENCES installment_contracts(id) ON DELETE RESTRICT
        );

        CREATE TABLE IF NOT EXISTS in_house_schedules (
          id TEXT PRIMARY KEY,
          contract_id TEXT NOT NULL,
          installment_number INTEGER NOT NULL CHECK (installment_number > 0),
          due_date TEXT NOT NULL,
          due_amount_centavos INTEGER NOT NULL CHECK (due_amount_centavos > 0),
          status TEXT NOT NULL DEFAULT 'DUE'
            CHECK (status IN ('DUE', 'PARTIALLY_PAID', 'PAID', 'WAIVED')),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (contract_id) REFERENCES installment_contracts(id) ON DELETE RESTRICT,
          UNIQUE (contract_id, installment_number)
        );

        CREATE TABLE IF NOT EXISTS in_house_payments (
          id TEXT PRIMARY KEY,
          contract_id TEXT NOT NULL,
          payment_date TEXT NOT NULL,
          amount_centavos INTEGER NOT NULL CHECK (amount_centavos > 0),
          reference_number TEXT,
          status TEXT NOT NULL DEFAULT 'POSTED' CHECK (status IN ('POSTED', 'VOIDED')),
          voided_at TEXT,
          voided_by_user_id TEXT,
          void_reason TEXT,
          received_by_user_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (contract_id) REFERENCES installment_contracts(id) ON DELETE RESTRICT,
          FOREIGN KEY (voided_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
          FOREIGN KEY (received_by_user_id) REFERENCES users(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS installment_payment_allocations (
          id TEXT PRIMARY KEY,
          payment_id TEXT NOT NULL,
          schedule_id TEXT NOT NULL,
          allocated_amount_centavos INTEGER NOT NULL CHECK (allocated_amount_centavos > 0),
          created_at TEXT NOT NULL,
          FOREIGN KEY (payment_id) REFERENCES in_house_payments(id) ON DELETE RESTRICT,
          FOREIGN KEY (schedule_id) REFERENCES in_house_schedules(id) ON DELETE RESTRICT,
          UNIQUE (payment_id, schedule_id)
        );

        CREATE TABLE IF NOT EXISTS installment_activity_history (
          id TEXT PRIMARY KEY,
          contract_id TEXT NOT NULL,
          actor_user_id TEXT,
          action TEXT NOT NULL,
          activity TEXT NOT NULL,
          amount_centavos INTEGER CHECK (amount_centavos IS NULL OR amount_centavos >= 0),
          created_at TEXT NOT NULL,
          FOREIGN KEY (contract_id) REFERENCES installment_contracts(id) ON DELETE RESTRICT,
          FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY,
          actor_user_id TEXT,
          action TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          reason TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS audit_log_changes (
          id TEXT PRIMARY KEY,
          audit_log_id TEXT NOT NULL,
          column_name TEXT NOT NULL,
          old_value TEXT,
          new_value TEXT,
          FOREIGN KEY (audit_log_id) REFERENCES audit_logs(id) ON DELETE RESTRICT,
          UNIQUE (audit_log_id, column_name)
        );

        CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);
        CREATE INDEX IF NOT EXISTS idx_contracts_status ON installment_contracts(status);
        CREATE INDEX IF NOT EXISTS idx_contracts_account ON installment_contracts(account_id);
        CREATE INDEX IF NOT EXISTS idx_contracts_branch ON installment_contracts(branch_id);
        CREATE INDEX IF NOT EXISTS idx_contracts_due_date ON installment_contracts(first_due_date);
      `)

      const now = new Date().toISOString()
      db.prepare(
        `INSERT OR IGNORE INTO installment_types
          (id, code, name, provider_kind, is_system, created_at, updated_at)
         VALUES ('installment-type-in-house', 'IN_HOUSE', 'In-house', 'IN_HOUSE', 1, ?, ?)`
      ).run(now, now)

      db.prepare(
        'INSERT OR IGNORE INTO branches (id, code, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
      ).run('development-lagonoy', 'LAG', 'Lagonoy', now, now)

      db.prepare(
        `INSERT OR IGNORE INTO users
          (id, branch_id, username, password_hash, display_name, role, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'CASHIER', 0, ?, ?)`
      ).run(
        'development-cashier',
        'development-lagonoy',
        'development-cashier',
        '$2b$12$C6UzMDM.H6dfI/f/IKcEe.7s9z1Hj8oX0bYVY9xH5v1k3X7y8z9a',
        'Development Cashier',
        now,
        now
      )

      const legacyUsers = db.prepare('SELECT DISTINCT cashier_id FROM reports').all() as Array<{
        cashier_id: string
      }>
      const insertUser = db.prepare(
        `INSERT OR IGNORE INTO users
          (id, branch_id, username, password_hash, display_name, role, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'CASHIER', 0, ?, ?)`
      )
      for (const user of legacyUsers) {
        insertUser.run(
          user.cashier_id,
          'development-lagonoy',
          `legacy-${user.cashier_id}`,
          '$2b$12$C6UzMDM.H6dfI/f/IKcEe.7s9z1Hj8oX0bYVY9xH5v1k3X7y8z9a',
          `Legacy ${user.cashier_id}`,
          now,
          now
        )
      }

      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(2, now)
    })

    migrate()
  }

  if (applied.version < 3) {
    const migrate = db.transaction(() => {
      const now = new Date().toISOString()
      db.prepare(
        `INSERT OR IGNORE INTO branches (id, code, name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`
      ).run('development-lagonoy', 'LAG', 'Lagonoy', now, now)
      db.prepare(
        `INSERT OR IGNORE INTO users
          (id, branch_id, username, password_hash, display_name, role, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'CASHIER', 0, ?, ?)`
      ).run(
        'development-cashier',
        'development-lagonoy',
        'development-cashier',
        '$2b$12$C6UzMDM.H6dfI/f/IKcEe.7s9z1Hj8oX0bYVY9xH5v1k3X7y8z9a',
        'Development Cashier',
        now,
        now
      )
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(3, now)
    })
    migrate()
  }

  if (applied.version < 4) {
    const migrate = db.transaction(() => {
      const now = new Date().toISOString()
      const contracts = db
        .prepare(
          `SELECT c.id, c.first_due_date, c.payment_frequency, c.terms, c.total_payable_centavos
             FROM installment_contracts c
             JOIN installment_types t ON t.id = c.installment_type_id
            WHERE t.provider_kind = 'IN_HOUSE'
              AND NOT EXISTS (
                SELECT 1 FROM in_house_schedules s WHERE s.contract_id = c.id
              )`
        )
        .all() as Array<{
        id: string
        first_due_date: string
        payment_frequency: string
        terms: string
        total_payable_centavos: number
      }>
      const insert = db.prepare(
        `INSERT INTO in_house_schedules
          (id, contract_id, installment_number, due_date, due_amount_centavos, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      for (const contract of contracts) {
        for (const schedule of buildInHouseSchedule(
          contract.first_due_date,
          contract.payment_frequency,
          contract.terms,
          contract.total_payable_centavos
        )) {
          insert.run(
            randomUUID(),
            contract.id,
            schedule.installmentNumber,
            schedule.dueDate,
            schedule.dueAmountCentavos,
            now,
            now
          )
        }
      }
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(4, now)
    })
    migrate()
  }

  if (applied.version < 5) {
    const migrate = db.transaction(() => {
      db.exec(`
        ALTER TABLE in_house_payments ADD COLUMN submission_id TEXT;
        CREATE UNIQUE INDEX IF NOT EXISTS in_house_payments_submission_idx
          ON in_house_payments (contract_id, submission_id)
          WHERE submission_id IS NOT NULL;
      `)
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(
        5,
        new Date().toISOString()
      )
    })
    migrate()
  }

  if (applied.version < 6) {
    const migrate = db.transaction(() => {
      db.exec(`
        ALTER TABLE in_house_payments ADD COLUMN replaces_payment_id TEXT;
        CREATE INDEX IF NOT EXISTS in_house_payments_replaces_payment_idx
          ON in_house_payments (replaces_payment_id)
          WHERE replaces_payment_id IS NOT NULL;
      `)
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(
        6,
        new Date().toISOString()
      )
    })
    migrate()
  }

  if (applied.version < 7) {
    const migrate = db.transaction(() => {
      db.exec(`
        CREATE TABLE finance_accounts (
          id TEXT PRIMARY KEY NOT NULL,
          branch TEXT NOT NULL CHECK (branch IN ('Goa', 'Tinambac', 'Tigaon', 'Lagonoy')),
          provider TEXT NOT NULL CHECK (provider IN ('Home Credit', 'Salmon', 'Skyro')),
          date_released TEXT NOT NULL,
          terms_months INTEGER NOT NULL CHECK (terms_months BETWEEN 1 AND 12),
          last_name TEXT NOT NULL,
          first_name TEXT NOT NULL,
          middle_name TEXT,
          suffix TEXT,
          quantity INTEGER NOT NULL CHECK (quantity > 0),
          item TEXT NOT NULL,
          serial_no TEXT,
          item_price_centavos INTEGER NOT NULL CHECK (item_price_centavos >= 0),
          grand_total_centavos INTEGER NOT NULL CHECK (grand_total_centavos >= 0),
          downpayment_centavos INTEGER NOT NULL CHECK (downpayment_centavos >= 0),
          balance_centavos INTEGER NOT NULL CHECK (balance_centavos >= 0),
          or_number TEXT,
          or_date TEXT,
          paid_date TEXT,
          remarks TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX finance_accounts_branch_date_idx
          ON finance_accounts (branch, date_released DESC, created_at DESC);
      `)
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(
        7,
        new Date().toISOString()
      )
    })
    migrate()
  }

  if (applied.version < 8) {
    const migrate = db.transaction(() => {
      db.exec(`
        CREATE TABLE finance_account_items (
          id TEXT PRIMARY KEY NOT NULL,
          finance_account_id TEXT NOT NULL REFERENCES finance_accounts(id) ON DELETE RESTRICT,
          sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
          item TEXT NOT NULL,
          serial_no TEXT,
          quantity INTEGER NOT NULL CHECK (quantity > 0),
          item_price_centavos INTEGER NOT NULL CHECK (item_price_centavos >= 0),
          total_centavos INTEGER NOT NULL CHECK (total_centavos >= 0),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE (finance_account_id, sort_order)
        );
        INSERT INTO finance_account_items (
          id, finance_account_id, sort_order, item, serial_no, quantity, item_price_centavos,
          total_centavos, created_at, updated_at
        )
        SELECT 'finance-item-' || id, id, 0, item, serial_no, quantity, item_price_centavos,
               grand_total_centavos, created_at, updated_at
          FROM finance_accounts;
        CREATE INDEX finance_account_items_account_sort_idx
          ON finance_account_items (finance_account_id, sort_order);
      `)
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(
        8,
        new Date().toISOString()
      )
    })
    migrate()
  }

  if (applied.version < 9) {
    const migrate = db.transaction(() => {
      db.exec(`
        CREATE TABLE report_reconciliations (
          report_id TEXT PRIMARY KEY NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
          physical_cash_centavos INTEGER NOT NULL,
          cash_remitted_centavos INTEGER NOT NULL CHECK (cash_remitted_centavos >= 0),
          cash_variance_centavos INTEGER NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX report_reconciliations_updated_idx
          ON report_reconciliations (updated_at DESC);
      `)
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(
        9,
        new Date().toISOString()
      )
    })
    migrate()
  }

  if (applied.version < 10) {
    const migrate = db.transaction(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS daily_reports (
          id TEXT PRIMARY KEY NOT NULL,
          branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
          cashier_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
          business_date TEXT NOT NULL CHECK (length(business_date) = 10),
          opening_cash_centavos INTEGER NOT NULL DEFAULT 0 CHECK (opening_cash_centavos >= 0),
          cash_remitted_centavos INTEGER CHECK (cash_remitted_centavos IS NULL OR cash_remitted_centavos >= 0),
          status TEXT NOT NULL DEFAULT 'DRAFT'
            CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REOPENED', 'VOIDED')),
          submitted_at TEXT,
          approved_at TEXT,
          approved_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE (branch_id, cashier_user_id, business_date)
        );
        CREATE INDEX IF NOT EXISTS idx_daily_reports_business_date
          ON daily_reports (branch_id, business_date);

        CREATE TABLE IF NOT EXISTS receipt_types (
          id TEXT PRIMARY KEY NOT NULL,
          code TEXT NOT NULL COLLATE NOCASE UNIQUE,
          name TEXT NOT NULL COLLATE NOCASE UNIQUE,
          is_system INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0, 1)),
          is_default_visible INTEGER NOT NULL DEFAULT 0 CHECK (is_default_visible IN (0, 1)),
          is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS daily_receipt_totals (
          id TEXT PRIMARY KEY NOT NULL,
          daily_report_id TEXT NOT NULL REFERENCES daily_reports(id) ON DELETE RESTRICT,
          receipt_type_id TEXT NOT NULL REFERENCES receipt_types(id) ON DELETE RESTRICT,
          quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
          amount_centavos INTEGER NOT NULL DEFAULT 0 CHECK (amount_centavos >= 0),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE (daily_report_id, receipt_type_id)
        );
        CREATE INDEX IF NOT EXISTS idx_daily_receipt_totals_report
          ON daily_receipt_totals (daily_report_id);

        CREATE TABLE IF NOT EXISTS report_payment_methods (
          id TEXT PRIMARY KEY NOT NULL,
          code TEXT NOT NULL COLLATE NOCASE UNIQUE,
          name TEXT NOT NULL COLLATE NOCASE UNIQUE,
          is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS daily_report_payment_entries (
          id TEXT PRIMARY KEY NOT NULL,
          daily_report_id TEXT NOT NULL REFERENCES daily_reports(id) ON DELETE RESTRICT,
          payment_method_id TEXT NOT NULL REFERENCES report_payment_methods(id) ON DELETE RESTRICT,
          transaction_date TEXT NOT NULL CHECK (length(transaction_date) = 10),
          amount_centavos INTEGER NOT NULL CHECK (amount_centavos > 0),
          reference_number TEXT,
          bank_name TEXT,
          payer_name TEXT,
          remarks TEXT,
          status TEXT NOT NULL DEFAULT 'POSTED' CHECK (status IN ('POSTED', 'VOIDED')),
          voided_at TEXT,
          voided_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
          void_reason TEXT,
          created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_daily_report_payments_report
          ON daily_report_payment_entries (daily_report_id);
        CREATE INDEX IF NOT EXISTS idx_daily_report_payments_method_date
          ON daily_report_payment_entries (payment_method_id, transaction_date);

        CREATE TABLE IF NOT EXISTS cash_out_entries (
          id TEXT PRIMARY KEY NOT NULL,
          daily_report_id TEXT NOT NULL REFERENCES daily_reports(id) ON DELETE RESTRICT,
          transaction_date TEXT NOT NULL CHECK (length(transaction_date) = 10),
          description TEXT NOT NULL,
          amount_centavos INTEGER NOT NULL CHECK (amount_centavos > 0),
          status TEXT NOT NULL DEFAULT 'POSTED' CHECK (status IN ('POSTED', 'VOIDED')),
          voided_at TEXT,
          voided_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
          void_reason TEXT,
          created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_cash_out_entries_report
          ON cash_out_entries (daily_report_id);

        CREATE TABLE IF NOT EXISTS deduction_types (
          id TEXT PRIMARY KEY NOT NULL,
          code TEXT NOT NULL COLLATE NOCASE UNIQUE,
          name TEXT NOT NULL COLLATE NOCASE UNIQUE,
          contribution_code TEXT NOT NULL CHECK (contribution_code IN ('ER', 'EE', 'EE_LOAN')),
          is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS daily_report_deductions (
          id TEXT PRIMARY KEY NOT NULL,
          daily_report_id TEXT NOT NULL REFERENCES daily_reports(id) ON DELETE RESTRICT,
          deduction_type_id TEXT NOT NULL REFERENCES deduction_types(id) ON DELETE RESTRICT,
          amount_centavos INTEGER NOT NULL CHECK (amount_centavos >= 0),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE (daily_report_id, deduction_type_id)
        );
        CREATE INDEX IF NOT EXISTS idx_daily_report_deductions_report
          ON daily_report_deductions (daily_report_id);

        CREATE TABLE IF NOT EXISTS cash_denominations (
          id TEXT PRIMARY KEY NOT NULL,
          value_centavos INTEGER NOT NULL UNIQUE CHECK (value_centavos > 0),
          is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
          sort_order INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS daily_report_cash_counts (
          id TEXT PRIMARY KEY NOT NULL,
          daily_report_id TEXT NOT NULL REFERENCES daily_reports(id) ON DELETE RESTRICT,
          denomination_id TEXT NOT NULL REFERENCES cash_denominations(id) ON DELETE RESTRICT,
          quantity INTEGER NOT NULL CHECK (quantity >= 0),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE (daily_report_id, denomination_id)
        );
        CREATE INDEX IF NOT EXISTS idx_daily_report_cash_counts_report
          ON daily_report_cash_counts (daily_report_id);

        CREATE TABLE IF NOT EXISTS income_categories (
          id TEXT PRIMARY KEY NOT NULL,
          code TEXT NOT NULL COLLATE NOCASE UNIQUE,
          name TEXT NOT NULL COLLATE NOCASE UNIQUE,
          summary_group TEXT NOT NULL CHECK (summary_group IN ('COLLECTION', 'OTHER_INCOME', 'FINANCE')),
          is_system INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0, 1)),
          is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS income_entries (
          id TEXT PRIMARY KEY NOT NULL,
          daily_report_id TEXT NOT NULL REFERENCES daily_reports(id) ON DELETE RESTRICT,
          category_id TEXT NOT NULL REFERENCES income_categories(id) ON DELETE RESTRICT,
          transaction_date TEXT NOT NULL CHECK (length(transaction_date) = 10),
          particular TEXT NOT NULL,
          receipt_number TEXT,
          remarks TEXT,
          amount_centavos INTEGER NOT NULL CHECK (amount_centavos > 0),
          status TEXT NOT NULL DEFAULT 'POSTED' CHECK (status IN ('POSTED', 'VOIDED')),
          voided_at TEXT,
          voided_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
          void_reason TEXT,
          created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_income_entries_report ON income_entries (daily_report_id);
        CREATE INDEX IF NOT EXISTS idx_income_entries_category ON income_entries (category_id);

        CREATE TABLE IF NOT EXISTS expense_categories (
          id TEXT PRIMARY KEY NOT NULL,
          code TEXT NOT NULL COLLATE NOCASE UNIQUE,
          name TEXT NOT NULL COLLATE NOCASE UNIQUE,
          is_system INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0, 1)),
          is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS expense_entries (
          id TEXT PRIMARY KEY NOT NULL,
          daily_report_id TEXT NOT NULL REFERENCES daily_reports(id) ON DELETE RESTRICT,
          category_id TEXT NOT NULL REFERENCES expense_categories(id) ON DELETE RESTRICT,
          transaction_date TEXT NOT NULL CHECK (length(transaction_date) = 10),
          description TEXT NOT NULL,
          receipt_number TEXT,
          vat_type TEXT NOT NULL DEFAULT 'NON_VAT'
            CHECK (vat_type IN ('VATABLE', 'VAT_EXEMPT', 'ZERO_RATED', 'NON_VAT')),
          vat_amount_centavos INTEGER NOT NULL DEFAULT 0 CHECK (vat_amount_centavos >= 0),
          gross_amount_centavos INTEGER NOT NULL CHECK (gross_amount_centavos > 0),
          payment_method_code TEXT NOT NULL DEFAULT 'CASH'
            CHECK (payment_method_code IN ('CASH', 'CHECK', 'BANK_TRANSFER', 'GCASH', 'MAYA', 'OTHER_EWALLET', 'OTHER')),
          reference_number TEXT,
          remarks TEXT,
          status TEXT NOT NULL DEFAULT 'POSTED' CHECK (status IN ('POSTED', 'VOIDED')),
          voided_at TEXT,
          voided_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
          void_reason TEXT,
          created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          CHECK (vat_amount_centavos <= gross_amount_centavos)
        );
        CREATE INDEX IF NOT EXISTS idx_expense_entries_report ON expense_entries (daily_report_id);
        CREATE INDEX IF NOT EXISTS idx_expense_entries_category ON expense_entries (category_id);
      `)

      const now = new Date().toISOString()
      const seed = db.prepare(
        `INSERT OR IGNORE INTO receipt_types
          (id, code, name, is_system, is_default_visible, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, 1, ?, ?, ?, ?)`
      )
      for (const [id, code, name, isDefaultVisible, sortOrder] of [
        ['receipt-type-cash-sales', 'CASH_SALES', 'Cash Sales', 0, 10],
        ['receipt-type-collections', 'COLLECTIONS', 'Collections', 0, 20],
        ['receipt-type-sales-invoice', 'SALES_INVOICE', 'SALES INVOICE', 0, 30],
        [
          'receipt-type-sales-invoice-trading',
          'SALES_INVOICE_TRADING',
          'SALES INVOICE - TRADING',
          0,
          40
        ],
        ['receipt-type-delivery-receipt', 'DELIVERY_RECEIPT', 'DELIVERY RECEIPT', 0, 50],
        ['receipt-type-bobs-pawnshop', 'BOBS_PAWNSHOP', 'BOBS PAWNSHOP', 0, 60]
      ]) {
        seed.run(id, code, name, isDefaultVisible, sortOrder, now, now)
      }

      const seedPaymentMethod = db.prepare(
        `INSERT OR IGNORE INTO report_payment_methods (id, code, name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      for (const [id, code, name] of [
        ['report-payment-method-check', 'CHECK', 'Check'],
        ['report-payment-method-bank-transfer', 'BANK_TRANSFER', 'Bank Transfer'],
        ['report-payment-method-gcash', 'GCASH', 'GCash'],
        ['report-payment-method-maya', 'MAYA', 'Maya'],
        ['report-payment-method-other-ewallet', 'OTHER_EWALLET', 'Other E-wallet']
      ]) {
        seedPaymentMethod.run(id, code, name, now, now)
      }

      const seedIncomeCategory = db.prepare(
        `INSERT OR IGNORE INTO income_categories
          (id, code, name, summary_group, is_system, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, ?, ?, ?)`
      )
      for (const [id, code, name, summaryGroup, sortOrder] of [
        ['income-category-collections', 'COLLECTIONS', 'Collections', 'COLLECTION', 10],
        ['income-category-other-income', 'OTHER_INCOME', 'Other Income', 'OTHER_INCOME', 20],
        ['income-category-finance', 'FINANCE', 'Finance Income', 'FINANCE', 30]
      ]) {
        seedIncomeCategory.run(id, code, name, summaryGroup, sortOrder, now, now)
      }

      const seedDeductionType = db.prepare(
        `INSERT OR IGNORE INTO deduction_types
          (id, code, name, contribution_code, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      for (const [id, code, name, contributionCode] of [
        ['deduction-type-sss-er', 'SSS_ER', 'SSS ER (EMPLOYER CONT.)', 'ER'],
        ['deduction-type-sss-ee', 'SSS_EE', "SSS EC (EMPLOYEES' CONT.)", 'EE'],
        ['deduction-type-sss-ee-loan', 'SSS_EE_LOAN', 'SSS EC/LOAN DEDUCTIONS', 'EE_LOAN'],
        ['deduction-type-pagibig-er', 'PAGIBIG_ER', 'PAG-IBIG ER', 'ER'],
        ['deduction-type-pagibig-ee', 'PAGIBIG_EE', 'PAG-IBIG EC', 'EE'],
        [
          'deduction-type-pagibig-ee-loan',
          'PAGIBIG_EE_LOAN',
          'PAG-IBIG EC/LOAN DEDUCTIONS',
          'EE_LOAN'
        ],
        ['deduction-type-philhealth-er', 'PHILHEALTH_ER', 'PHILHEALTH ER', 'ER'],
        ['deduction-type-philhealth-ee', 'PHILHEALTH_EE', 'PHILHEALTH EC', 'EE']
      ]) {
        seedDeductionType.run(id, code, name, contributionCode, now, now)
      }

      const seedDenomination = db.prepare(
        `INSERT OR IGNORE INTO cash_denominations (id, value_centavos, sort_order)
         VALUES (?, ?, ?)`
      )
      for (const [valueCentavos, sortOrder] of [
        [100000, 10],
        [50000, 20],
        [20000, 30],
        [10000, 40],
        [5000, 50],
        [2000, 60],
        [1000, 70],
        [500, 80],
        [100, 90],
        [25, 100],
        [10, 110],
        [5, 120],
        [1, 130]
      ]) {
        seedDenomination.run(`cash-denomination-${valueCentavos}`, valueCentavos, sortOrder)
      }

      // Preserve the existing report identity while moving new daily-report work to the
      // documented table. Legacy expense records continue to reference the same report id.
      db.exec(`
        INSERT OR IGNORE INTO daily_reports (
          id, branch_id, cashier_user_id, business_date, opening_cash_centavos,
          cash_remitted_centavos, status, created_at, updated_at
        )
        SELECT id, branch_id, cashier_id, business_date, 0, NULL,
          CASE status
            WHEN 'Submitted' THEN 'SUBMITTED'
            WHEN 'Locked' THEN 'APPROVED'
            ELSE 'DRAFT'
          END,
          created_at, updated_at
        FROM reports;
      `)

      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(10, now)
    })
    migrate()
  }

  if (applied.version < 11) {
    const migrate = db.transaction(() => {
      db.exec(`
        ALTER TABLE expenses ADD COLUMN status TEXT NOT NULL DEFAULT 'POSTED'
          CHECK (status IN ('POSTED', 'VOIDED'));
        ALTER TABLE expenses ADD COLUMN voided_at TEXT;
        ALTER TABLE expenses ADD COLUMN voided_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
        ALTER TABLE expenses ADD COLUMN void_reason TEXT;
        CREATE INDEX IF NOT EXISTS expenses_report_status_idx ON expenses (report_id, status);
      `)
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(
        11,
        new Date().toISOString()
      )
    })
    migrate()
  }

  if (applied.version < 12) {
    const migrate = db.transaction(() => {
      const now = new Date().toISOString()
      const seed = db.prepare(
        `INSERT OR IGNORE INTO receipt_types
          (id, code, name, is_system, is_default_visible, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, 1, 0, ?, ?, ?)`
      )
      for (const [id, code, name, sortOrder] of [
        ['receipt-type-sales-invoice', 'SALES_INVOICE', 'SALES INVOICE', 30],
        [
          'receipt-type-sales-invoice-trading',
          'SALES_INVOICE_TRADING',
          'SALES INVOICE - TRADING',
          40
        ],
        ['receipt-type-delivery-receipt', 'DELIVERY_RECEIPT', 'DELIVERY RECEIPT', 50],
        ['receipt-type-bobs-pawnshop', 'BOBS_PAWNSHOP', 'BOBS PAWNSHOP', 60]
      ]) {
        seed.run(id, code, name, sortOrder, now, now)
      }
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(12, now)
    })
    migrate()
  }

  if (applied.version < 13) {
    const migrate = db.transaction(() => {
      const now = new Date().toISOString()
      db.prepare(
        `UPDATE receipt_types
         SET name = CASE id
           WHEN 'receipt-type-sales-invoice' THEN 'SALES INVOICE'
           WHEN 'receipt-type-sales-invoice-trading' THEN 'SALES INVOICE - TRADING'
           WHEN 'receipt-type-delivery-receipt' THEN 'DELIVERY RECEIPT'
           ELSE name
         END,
         is_system = CASE id
           WHEN 'receipt-type-sales-invoice' THEN 1
           WHEN 'receipt-type-sales-invoice-trading' THEN 1
           WHEN 'receipt-type-delivery-receipt' THEN 1
           WHEN 'receipt-type-bobs-pawnshop' THEN 1
           ELSE is_system
         END,
         updated_at = ?
         WHERE id IN (
           'receipt-type-sales-invoice',
           'receipt-type-sales-invoice-trading',
           'receipt-type-delivery-receipt',
           'receipt-type-bobs-pawnshop'
         )`
      ).run(now)
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(13, now)
    })
    migrate()
  }

  if (applied.version < 14) {
    const migrate = db.transaction(() => {
      const now = new Date().toISOString()
      db.prepare(
        `UPDATE receipt_types
         SET name = CASE id
           WHEN 'receipt-type-sales-invoice' THEN 'SALES INVOICE'
           WHEN 'receipt-type-sales-invoice-trading' THEN 'SALES INVOICE - TRADING'
           WHEN 'receipt-type-delivery-receipt' THEN 'DELIVERY RECEIPT'
           ELSE name
         END,
         is_system = CASE id
           WHEN 'receipt-type-sales-invoice' THEN 1
           WHEN 'receipt-type-sales-invoice-trading' THEN 1
           WHEN 'receipt-type-delivery-receipt' THEN 1
           WHEN 'receipt-type-bobs-pawnshop' THEN 1
           ELSE is_system
         END,
         updated_at = ?
         WHERE id IN (
           'receipt-type-sales-invoice',
           'receipt-type-sales-invoice-trading',
           'receipt-type-delivery-receipt',
           'receipt-type-bobs-pawnshop'
         )`
      ).run(now)
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(14, now)
    })
    migrate()
  }

  if (applied.version < 15) {
    const migrate = db.transaction(() => {
      const now = new Date().toISOString()
      const updateDeductionType = db.prepare(
        `UPDATE deduction_types SET name = ?, contribution_code = ?, updated_at = ? WHERE code = ?`
      )
      updateDeductionType.run("SSS EC (EMPLOYEES' CONT.)", 'EE', now, 'SSS_EE')
      updateDeductionType.run('PAG-IBIG EC', 'EE', now, 'PAGIBIG_EE')
      updateDeductionType.run('PHILHEALTH EC', 'EE', now, 'PHILHEALTH_EE')

      const insertDeductionType = db.prepare(
        `INSERT OR IGNORE INTO deduction_types
          (id, code, name, contribution_code, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      for (const [id, code, name, contributionCode] of [
        ['deduction-type-sss-er', 'SSS_ER', 'SSS ER (EMPLOYER CONT.)', 'ER'],
        ['deduction-type-sss-ee-loan', 'SSS_EE_LOAN', 'SSS EC/LOAN DEDUCTIONS', 'EE_LOAN'],
        ['deduction-type-pagibig-er', 'PAGIBIG_ER', 'PAG-IBIG ER', 'ER'],
        [
          'deduction-type-pagibig-ee-loan',
          'PAGIBIG_EE_LOAN',
          'PAG-IBIG EC/LOAN DEDUCTIONS',
          'EE_LOAN'
        ],
        ['deduction-type-philhealth-er', 'PHILHEALTH_ER', 'PHILHEALTH ER', 'ER']
      ]) {
        insertDeductionType.run(id, code, name, contributionCode, now, now)
      }
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(15, now)
    })
    migrate()
  }

  if (applied.version < 16) {
    const migrate = db.transaction(() => {
      db.exec(`ALTER TABLE receipt_types ADD COLUMN short_name TEXT NOT NULL DEFAULT ''`)
      db.exec(`UPDATE receipt_types SET short_name = substr(name, 1, 7) WHERE short_name = ''`)
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(
        16,
        new Date().toISOString()
      )
    })
    migrate()
  }
}
