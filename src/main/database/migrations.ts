import type Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'

import { buildInHouseSchedule } from '../services/in-house-schedule'

export const currentSchemaVersion = 45

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
      db.exec(`
        DELETE FROM daily_report_cash_counts
        WHERE denomination_id IN (
          SELECT id FROM cash_denominations WHERE value_centavos < 25
        );
        DELETE FROM cash_denominations WHERE value_centavos < 25;
      `)
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
        [25, 100]
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

  if (applied.version < 17) {
    const migrate = db.transaction(() => {
      db.exec(`ALTER TABLE daily_receipt_totals ADD COLUMN receipt_name TEXT NOT NULL DEFAULT ''`)
      db.exec(
        `ALTER TABLE daily_receipt_totals ADD COLUMN receipt_short_name TEXT NOT NULL DEFAULT ''`
      )
      db.exec(`
        UPDATE daily_receipt_totals
           SET receipt_name = receipt_types.name,
               receipt_short_name = receipt_types.short_name
          FROM receipt_types
         WHERE receipt_types.id = daily_receipt_totals.receipt_type_id
           AND daily_receipt_totals.receipt_name = ''
      `)
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(
        17,
        new Date().toISOString()
      )
    })
    migrate()
  }

  if (applied.version < 18) {
    const migrate = db.transaction(() => {
      db.exec(
        `ALTER TABLE installment_contracts ADD COLUMN schedule_frequency TEXT NOT NULL DEFAULT ''`
      )
      db.exec(
        `UPDATE installment_contracts SET schedule_frequency = payment_frequency WHERE schedule_frequency = ''`
      )
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(
        18,
        new Date().toISOString()
      )
    })
    migrate()
  }

  if (applied.version < 19) {
    const migrate = db.transaction(() => {
      const now = new Date().toISOString()
      db.exec(`
        CREATE TABLE catalog_options (
          id TEXT PRIMARY KEY,
          kind TEXT NOT NULL CHECK (kind IN ('CASHIER_EXPENSE_TYPE', 'CASHIER_PAYMENT_TYPE', 'IN_HOUSE_AGENT', 'IN_HOUSE_LOAN_TERM', 'FINANCE_TYPE', 'FINANCE_TERM')),
          value TEXT NOT NULL,
          reference_id TEXT,
          is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(kind, value)
        );
        CREATE INDEX catalog_options_kind_active_idx ON catalog_options (kind, is_active, value);
      `)
      const seed = db.prepare(
        `INSERT OR IGNORE INTO catalog_options (id, kind, value, reference_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
      )
      for (const [id, kind, value, referenceId] of [
        ['catalog-expense-company', 'CASHIER_EXPENSE_TYPE', 'Company Expenses', null],
        ['catalog-expense-drawings', 'CASHIER_EXPENSE_TYPE', 'Drawings', null],
        ['catalog-expense-purchases', 'CASHIER_EXPENSE_TYPE', 'Purchases', null],
        ['catalog-expense-receivables', 'CASHIER_EXPENSE_TYPE', 'Receivables', null],
        [
          'catalog-payment-check',
          'CASHIER_PAYMENT_TYPE',
          'Bank Check',
          'report-payment-method-check'
        ],
        [
          'catalog-payment-transfer',
          'CASHIER_PAYMENT_TYPE',
          'Bank Transfer',
          'report-payment-method-bank-transfer'
        ],
        ['catalog-payment-gcash', 'CASHIER_PAYMENT_TYPE', 'GCash', 'report-payment-method-gcash'],
        [
          'catalog-payment-ewallet',
          'CASHIER_PAYMENT_TYPE',
          'Other e-wallet',
          'report-payment-method-other-ewallet'
        ],
        ['catalog-agent-mark', 'IN_HOUSE_AGENT', 'Mark Rivera', null],
        ['catalog-agent-nina', 'IN_HOUSE_AGENT', 'Nina Dela Cruz', null],
        ['catalog-agent-paolo', 'IN_HOUSE_AGENT', 'Paolo Santos', null],
        ['catalog-finance-home-credit', 'FINANCE_TYPE', 'Home Credit', null],
        ['catalog-finance-salmon', 'FINANCE_TYPE', 'Salmon', null],
        ['catalog-finance-skyro', 'FINANCE_TYPE', 'Skyro', null]
      ])
        seed.run(id, kind, value, referenceId, now, now)
      for (let term = 1; term <= 12; term += 1)
        seed.run(`catalog-loan-term-${term}`, 'IN_HOUSE_LOAN_TERM', String(term), null, now, now)
      for (let term = 1; term <= 24; term += 1)
        seed.run(`catalog-finance-term-${term}`, 'FINANCE_TERM', String(term), null, now, now)
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(19, now)
    })
    migrate()
  }

  if (applied.version < 20) {
    const migrate = db.transaction(() => {
      const now = new Date().toISOString()
      db.exec(
        `ALTER TABLE daily_report_payment_entries ADD COLUMN payment_method_name TEXT NOT NULL DEFAULT ''`
      )
      db.prepare(
        `UPDATE daily_report_payment_entries SET payment_method_name = report_payment_methods.name FROM report_payment_methods WHERE report_payment_methods.id = daily_report_payment_entries.payment_method_id AND payment_method_name = ''`
      ).run()
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(20, now)
    })
    migrate()
  }

  if (applied.version < 21) {
    const migrate = db.transaction(() => {
      db.exec(`ALTER TABLE accounts ADD COLUMN civil_status TEXT`)
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(
        21,
        new Date().toISOString()
      )
    })
    migrate()
  }

  if (applied.version < 22) {
    const migrate = db.transaction(() => {
      db.exec(`ALTER TABLE accounts ADD COLUMN latitude REAL`)
      db.exec(`ALTER TABLE accounts ADD COLUMN longitude REAL`)
      db.exec(`ALTER TABLE accounts ADD COLUMN landmark_remarks TEXT`)
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(
        22,
        new Date().toISOString()
      )
    })
    migrate()
  }

  if (applied.version < 23) {
    const migrate = db.transaction(() => {
      const now = new Date().toISOString()
      const versionId = randomUUID()
      db.exec(`
        CREATE TABLE installment_rule_versions (
          id TEXT PRIMARY KEY,
          version INTEGER NOT NULL UNIQUE,
          is_active INTEGER NOT NULL CHECK (is_active IN (0, 1)),
          standard_interest_rate_bps INTEGER NOT NULL CHECK (standard_interest_rate_bps >= 0),
          required_down_payment_rate_bps INTEGER NOT NULL CHECK (required_down_payment_rate_bps BETWEEN 0 AND 10000),
          created_by_user_id TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
        );
        CREATE UNIQUE INDEX installment_rule_versions_active_idx ON installment_rule_versions(is_active) WHERE is_active = 1;
        CREATE TABLE installment_rule_terms (
          version_id TEXT NOT NULL,
          frequency TEXT NOT NULL CHECK (frequency IN ('Daily', 'Weekly', 'Semi', 'Monthly')),
          terms INTEGER NOT NULL CHECK (terms > 0),
          interest_rate_bps INTEGER,
          required_fee_payments INTEGER,
          PRIMARY KEY (version_id, frequency, terms),
          FOREIGN KEY (version_id) REFERENCES installment_rule_versions(id) ON DELETE RESTRICT
        );
        ALTER TABLE installment_contracts ADD COLUMN configuration_version_id TEXT;
        ALTER TABLE installment_contracts ADD COLUMN end_date TEXT;
        ALTER TABLE installment_contracts ADD COLUMN interest_rate_bps INTEGER;
        ALTER TABLE installment_contracts ADD COLUMN required_down_payment_rate_bps INTEGER;
        ALTER TABLE installment_contracts ADD COLUMN daily_required_fee_factor INTEGER;
        ALTER TABLE installment_contracts ADD COLUMN payment_amount_centavos INTEGER;
        ALTER TABLE installment_contracts ADD COLUMN required_fee_centavos INTEGER;
      `)
      db.prepare(
        `INSERT INTO installment_rule_versions (id, version, is_active, standard_interest_rate_bps, required_down_payment_rate_bps, created_at) VALUES (?, 1, 1, 3800, 2250, ?)`
      ).run(versionId, now)
      const insert = db.prepare(
        `INSERT INTO installment_rule_terms (version_id, frequency, terms, interest_rate_bps, required_fee_payments) VALUES (?, ?, ?, ?, ?)`
      )
      for (const [terms, fee] of [
        [30, 2],
        [50, 4],
        [80, 6],
        [120, 8]
      ])
        insert.run(versionId, 'Daily', terms, null, fee)
      for (const terms of [5, 8, 12, 16]) insert.run(versionId, 'Weekly', terms, null, null)
      for (const terms of [2, 4, 6, 8]) insert.run(versionId, 'Semi', terms, null, null)
      for (const [terms, rate] of [
        [1, 0],
        [3, 2800],
        [6, 3500],
        [12, 5000]
      ])
        insert.run(versionId, 'Monthly', terms, rate, null)
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(23, now)
    })
    migrate()
  }

  if (applied.version < 24) {
    const migrate = db.transaction(() => {
      const now = new Date().toISOString()
      db.exec(
        `ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0 CHECK (must_change_password IN (0, 1));`
      )
      const users = db.prepare('SELECT id, display_name FROM users').all() as Array<{
        id: string
        display_name: string
      }>
      const insert = db.prepare(
        `INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, reason, created_at) VALUES (?, NULL, 'MIGRATION', 'user', ?, 'User profile migration', ?)`
      )
      for (const user of users) insert.run(randomUUID(), user.id, now)
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(24, now)
    })
    migrate()
  }

  if (applied.version < 25) {
    const migrate = db.transaction(() => {
      const now = new Date().toISOString()
      const insertLog = db.prepare(
        `INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      const insertChange = db.prepare(
        `INSERT INTO audit_log_changes (id, audit_log_id, column_name, old_value, new_value)
         VALUES (?, ?, ?, ?, ?)`
      )
      const add = (
        actorUserId: string | null,
        action: string,
        entityType: string,
        entityId: string,
        createdAt: string,
        reason: string | null,
        changes: Array<[string, string | null, string | null]>
      ): void => {
        const id = randomUUID()
        insertLog.run(id, actorUserId, action, entityType, entityId, reason, createdAt)
        for (const [field, oldValue, newValue] of changes) {
          insertChange.run(randomUUID(), id, field, oldValue, newValue)
        }
      }
      const expenses = db
        .prepare(
          `SELECT e.*, dr.cashier_user_id FROM expenses e JOIN daily_reports dr ON dr.id = e.report_id`
        )
        .all() as Array<Record<string, string | number | null>>
      for (const row of expenses) {
        add(
          String(row.cashier_user_id),
          'CREATED',
          'EXPENSE',
          String(row.id),
          String(row.created_at),
          null,
          [
            ['type', null, String(row.type)],
            ['description', null, String(row.description)],
            ['category', null, String(row.category)],
            ['receiptNo', null, String(row.receipt_no)],
            ['vat', null, String(row.vat)],
            ['amountCentavos', null, String(row.amount_centavos)]
          ]
        )
        if (row.status === 'VOIDED') {
          add(
            row.voided_by_user_id ? String(row.voided_by_user_id) : null,
            'VOIDED',
            'EXPENSE',
            String(row.id),
            String(row.voided_at ?? row.updated_at),
            row.void_reason ? String(row.void_reason) : null,
            [['status', 'POSTED', 'VOIDED']]
          )
        }
      }
      const incomes = db.prepare('SELECT * FROM income_entries').all() as Array<
        Record<string, string | number | null>
      >
      for (const row of incomes) {
        add(
          String(row.created_by_user_id),
          'CREATED',
          'INCOME',
          String(row.id),
          String(row.created_at),
          null,
          [
            ['particular', null, String(row.particular)],
            ['transactionDate', null, String(row.transaction_date)],
            ['amountCentavos', null, String(row.amount_centavos)]
          ]
        )
        if (row.status === 'VOIDED')
          add(
            row.voided_by_user_id ? String(row.voided_by_user_id) : null,
            'VOIDED',
            'INCOME',
            String(row.id),
            String(row.voided_at ?? row.updated_at),
            row.void_reason ? String(row.void_reason) : null,
            [['status', 'POSTED', 'VOIDED']]
          )
      }
      const payments = db.prepare('SELECT * FROM daily_report_payment_entries').all() as Array<
        Record<string, string | number | null>
      >
      for (const row of payments) {
        add(
          String(row.created_by_user_id),
          'CREATED',
          'PAYMENT',
          String(row.id),
          String(row.created_at),
          null,
          [
            ['transactionDate', null, String(row.transaction_date)],
            ['amountCentavos', null, String(row.amount_centavos)],
            ['referenceNumber', null, row.reference_number ? String(row.reference_number) : null]
          ]
        )
        if (row.status === 'VOIDED')
          add(
            row.voided_by_user_id ? String(row.voided_by_user_id) : null,
            'VOIDED',
            'PAYMENT',
            String(row.id),
            String(row.voided_at ?? row.updated_at),
            row.void_reason ? String(row.void_reason) : null,
            [['status', 'POSTED', 'VOIDED']]
          )
      }
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(25, now)
    })
    migrate()
  }

  if (applied.version < 26) {
    const migrate = db.transaction(() => {
      const now = new Date().toISOString()
      db.exec('ALTER TABLE expenses ADD COLUMN created_by_user_id TEXT REFERENCES users(id)')
      db.exec(`
        UPDATE expenses
           SET created_by_user_id = (
             SELECT cashier_user_id FROM daily_reports WHERE daily_reports.id = expenses.report_id
           )
         WHERE created_by_user_id IS NULL
      `)

      const groups = db
        .prepare(
          `SELECT branch_id, business_date
             FROM daily_reports
            GROUP BY branch_id, business_date
           HAVING COUNT(*) > 1`
        )
        .all() as Array<{ branch_id: string; business_date: string }>

      const findReports = db.prepare(
        `SELECT id, branch_id, cashier_user_id, business_date
           FROM daily_reports
          WHERE branch_id = ? AND business_date = ?
          ORDER BY created_at, id`
      )
      const move = (table: string, canonicalId: string, duplicateId: string): void => {
        db.prepare(`UPDATE ${table} SET daily_report_id = ? WHERE daily_report_id = ?`).run(
          canonicalId,
          duplicateId
        )
      }

      for (const group of groups) {
        const reports = findReports.all(group.branch_id, group.business_date) as Array<{
          id: string
          branch_id: string
          cashier_user_id: string
          business_date: string
        }>
        const canonical = reports[0]
        for (const duplicate of reports.slice(1)) {
          move('income_entries', canonical.id, duplicate.id)
          move('daily_report_payment_entries', canonical.id, duplicate.id)
          move('cash_out_entries', canonical.id, duplicate.id)
          move('expense_entries', canonical.id, duplicate.id)
          db.prepare('UPDATE expenses SET report_id = ? WHERE report_id = ?').run(
            canonical.id,
            duplicate.id
          )

          const receiptTotals = db
            .prepare('SELECT * FROM daily_receipt_totals WHERE daily_report_id = ?')
            .all(duplicate.id) as Array<Record<string, string | number>>
          for (const row of receiptTotals) {
            const existing = db
              .prepare(
                'SELECT id FROM daily_receipt_totals WHERE daily_report_id = ? AND receipt_type_id = ?'
              )
              .get(canonical.id, row.receipt_type_id)
            if (existing) {
              db.prepare(
                `UPDATE daily_receipt_totals
                    SET quantity = quantity + ?, amount_centavos = amount_centavos + ?, updated_at = ?
                  WHERE id = ?`
              ).run(row.quantity, row.amount_centavos, now, (existing as { id: string }).id)
              db.prepare('DELETE FROM daily_receipt_totals WHERE id = ?').run(row.id)
            } else {
              db.prepare('UPDATE daily_receipt_totals SET daily_report_id = ? WHERE id = ?').run(
                canonical.id,
                row.id
              )
            }
          }

          const deductions = db
            .prepare('SELECT * FROM daily_report_deductions WHERE daily_report_id = ?')
            .all(duplicate.id) as Array<Record<string, string | number>>
          for (const row of deductions) {
            const existing = db
              .prepare(
                'SELECT id FROM daily_report_deductions WHERE daily_report_id = ? AND deduction_type_id = ?'
              )
              .get(canonical.id, row.deduction_type_id)
            if (existing) {
              db.prepare(
                `UPDATE daily_report_deductions
                    SET amount_centavos = amount_centavos + ?, updated_at = ?
                  WHERE id = ?`
              ).run(row.amount_centavos, now, (existing as { id: string }).id)
              db.prepare('DELETE FROM daily_report_deductions WHERE id = ?').run(row.id)
            } else {
              db.prepare('UPDATE daily_report_deductions SET daily_report_id = ? WHERE id = ?').run(
                canonical.id,
                row.id
              )
            }
          }

          const cashCounts = db
            .prepare('SELECT * FROM daily_report_cash_counts WHERE daily_report_id = ?')
            .all(duplicate.id) as Array<Record<string, string | number>>
          for (const row of cashCounts) {
            const existing = db
              .prepare(
                'SELECT id FROM daily_report_cash_counts WHERE daily_report_id = ? AND denomination_id = ?'
              )
              .get(canonical.id, row.denomination_id)
            if (existing) {
              db.prepare(
                `UPDATE daily_report_cash_counts
                    SET quantity = quantity + ?, updated_at = ?
                  WHERE id = ?`
              ).run(row.quantity, now, (existing as { id: string }).id)
              db.prepare('DELETE FROM daily_report_cash_counts WHERE id = ?').run(row.id)
            } else {
              db.prepare(
                'UPDATE daily_report_cash_counts SET daily_report_id = ? WHERE id = ?'
              ).run(canonical.id, row.id)
            }
          }
          db.prepare('DELETE FROM daily_reports WHERE id = ?').run(duplicate.id)
        }
        db.prepare(
          `INSERT OR IGNORE INTO reports (id, branch_id, cashier_id, business_date, status, created_at, updated_at)
           SELECT id, branch_id, cashier_user_id, business_date, 'Draft', ?, ?
             FROM daily_reports WHERE id = ?`
        ).run(now, now, canonical.id)
      }

      db.exec(
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_reports_branch_business_date ON daily_reports (branch_id, business_date)'
      )
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(26, now)
    })
    migrate()
  }

  if (applied.version < 27) {
    const migrate = db.transaction(() => {
      const now = new Date().toISOString()
      db.exec(`
        CREATE TABLE user_branch_assignments (
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
          PRIMARY KEY (user_id, branch_id)
        );
        INSERT OR IGNORE INTO user_branch_assignments (user_id, branch_id)
          SELECT id, branch_id FROM users WHERE branch_id IS NOT NULL;
      `)
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(27, now)
    })
    migrate()
  }

  if (applied.version < 28) {
    const migrate = db.transaction(() => {
      const now = new Date().toISOString()
      db.exec(`
        ALTER TABLE users ADD COLUMN first_name TEXT NOT NULL DEFAULT '';
        ALTER TABLE users ADD COLUMN last_name TEXT NOT NULL DEFAULT '';
        UPDATE users SET first_name = display_name WHERE first_name = '';
      `)
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(28, now)
    })
    migrate()
  }

  if (applied.version < 29) {
    const migrate = db.transaction(() => {
      const now = new Date().toISOString()
      db.exec(`
        DELETE FROM audit_log_changes
         WHERE audit_log_id IN (
           SELECT id FROM audit_logs
            WHERE actor_user_id LIKE 'development-%' OR entity_id LIKE 'development-%'
         );
        DELETE FROM audit_logs
         WHERE actor_user_id LIKE 'development-%' OR entity_id LIKE 'development-%';
        DELETE FROM daily_receipt_totals
         WHERE daily_report_id IN (
           SELECT id FROM daily_reports
            WHERE id LIKE 'development-%' OR cashier_user_id LIKE 'development-%'
         );
        DELETE FROM daily_report_payment_entries
         WHERE daily_report_id IN (
           SELECT id FROM daily_reports
            WHERE id LIKE 'development-%' OR cashier_user_id LIKE 'development-%'
         );
        DELETE FROM cash_out_entries
         WHERE daily_report_id IN (
           SELECT id FROM daily_reports
            WHERE id LIKE 'development-%' OR cashier_user_id LIKE 'development-%'
         );
        DELETE FROM daily_report_deductions
         WHERE daily_report_id IN (
           SELECT id FROM daily_reports
            WHERE id LIKE 'development-%' OR cashier_user_id LIKE 'development-%'
         );
        DELETE FROM daily_report_cash_counts
         WHERE daily_report_id IN (
           SELECT id FROM daily_reports
            WHERE id LIKE 'development-%' OR cashier_user_id LIKE 'development-%'
         );
        DELETE FROM income_entries
         WHERE daily_report_id IN (
           SELECT id FROM daily_reports
            WHERE id LIKE 'development-%' OR cashier_user_id LIKE 'development-%'
         );
        DELETE FROM expense_entries
         WHERE daily_report_id IN (
           SELECT id FROM daily_reports
            WHERE id LIKE 'development-%' OR cashier_user_id LIKE 'development-%'
         );
        DELETE FROM daily_reports
         WHERE id LIKE 'development-%' OR cashier_user_id LIKE 'development-%';
        DELETE FROM reports
         WHERE id = '00000000-0000-4000-8000-000000000001'
            OR cashier_id LIKE 'development-%';
        DELETE FROM installment_payment_allocations
         WHERE payment_id IN (
           SELECT id FROM in_house_payments
            WHERE contract_id IN (
              SELECT id FROM installment_contracts
               WHERE id LIKE 'development-%' OR account_id LIKE 'development-%'
            )
         ) OR schedule_id IN (
           SELECT id FROM in_house_schedules
            WHERE contract_id IN (
              SELECT id FROM installment_contracts
               WHERE id LIKE 'development-%' OR account_id LIKE 'development-%'
            )
         );
        DELETE FROM in_house_payments
         WHERE contract_id IN (
           SELECT id FROM installment_contracts
            WHERE id LIKE 'development-%' OR account_id LIKE 'development-%'
         );
        DELETE FROM in_house_schedules
         WHERE contract_id IN (
           SELECT id FROM installment_contracts
            WHERE id LIKE 'development-%' OR account_id LIKE 'development-%'
         );
        DELETE FROM installment_items
         WHERE contract_id IN (
           SELECT id FROM installment_contracts
            WHERE id LIKE 'development-%' OR account_id LIKE 'development-%'
         );
        DELETE FROM installment_activity_history
         WHERE contract_id IN (
           SELECT id FROM installment_contracts
            WHERE id LIKE 'development-%' OR account_id LIKE 'development-%'
         );
        DELETE FROM installment_contracts
         WHERE id LIKE 'development-%' OR account_id LIKE 'development-%';
        DELETE FROM account_contacts WHERE account_id LIKE 'development-%';
        DELETE FROM accounts WHERE id LIKE 'development-%';
        DELETE FROM finance_account_items WHERE finance_account_id LIKE 'development-%';
        DELETE FROM finance_accounts WHERE id LIKE 'development-%';
        DELETE FROM users WHERE id LIKE 'development-%';
      `)
      const insertBranch = db.prepare(
        `INSERT OR IGNORE INTO branches (id, code, name, is_active, created_at, updated_at)
         VALUES (?, ?, ?, 1, ?, ?)`
      )
      for (const [id, code, name] of [
        ['system-goa', 'GOA', 'Goa'],
        ['system-tinambac', 'TIN', 'Tinambac'],
        ['system-tigaon', 'TIG', 'Tigaon'],
        ['system-lagonoy', 'LAG', 'Lagonoy']
      ]) {
        insertBranch.run(id, code, name, now, now)
      }
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(29, now)
    })
    migrate()
  }

  if (applied.version < 30) {
    const migrate = db.transaction(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `)
      const now = new Date().toISOString()
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(30, now)
    })
    migrate()
  }

  if (applied.version < 31) {
    const migrate = db.transaction(() => {
      const now = new Date().toISOString()
      db.exec(`
        CREATE TABLE installment_import_runs (
          source_sha256 TEXT PRIMARY KEY,
          source_path TEXT NOT NULL,
          imported_at TEXT NOT NULL,
          report_json TEXT NOT NULL
        );
        CREATE TABLE installment_import_issues (
          source_sha256 TEXT NOT NULL REFERENCES installment_import_runs(source_sha256) ON DELETE CASCADE,
          sheet_name TEXT NOT NULL,
          row_number INTEGER NOT NULL,
          code TEXT NOT NULL,
          detail TEXT NOT NULL,
          PRIMARY KEY (source_sha256, sheet_name, row_number, code)
        );
        CREATE INDEX installment_import_issues_code_idx ON installment_import_issues (source_sha256, code);
        CREATE INDEX installment_items_contract_idx ON installment_items (contract_id);
        CREATE INDEX in_house_payments_contract_idx ON in_house_payments (contract_id);
      `)
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(31, now)
    })
    migrate()
  }

  if (applied.version < 32) {
    const migrate = db.transaction(() => {
      const now = new Date().toISOString()
      db.exec(`
        ALTER TABLE in_house_payments ADD COLUMN penalty_centavos INTEGER NOT NULL DEFAULT 0 CHECK (penalty_centavos >= 0);
        ALTER TABLE installment_payment_allocations ADD COLUMN penalty_centavos INTEGER NOT NULL DEFAULT 0 CHECK (penalty_centavos >= 0);
      `)
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(32, now)
    })
    migrate()
  }

  if (applied.version < 33) {
    const migrate = db.transaction(() => {
      const now = new Date().toISOString()
      db.exec(
        'ALTER TABLE daily_reports ADD COLUMN updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL'
      )
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(33, now)
    })
    migrate()
  }

  if (applied.version < 34) {
    const migrate = db.transaction(() => {
      const now = new Date().toISOString()
      db.exec('ALTER TABLE daily_reports ADD COLUMN note TEXT')
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(34, now)
    })
    migrate()
  }

  if (applied.version < 35) {
    const migrate = db.transaction(() => {
      const now = new Date().toISOString()
      db.exec(`
        CREATE TABLE google_sheet_sources (
          key TEXT PRIMARY KEY NOT NULL,
          spreadsheet_id TEXT NOT NULL,
          branch TEXT,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE google_sheet_imports (
          id TEXT PRIMARY KEY NOT NULL,
          spreadsheet_id TEXT NOT NULL,
          sheet_name TEXT NOT NULL,
          source_row INTEGER NOT NULL,
          source_record_id TEXT NOT NULL,
          source_updated_at TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('IMPORTED', 'DUPLICATE', 'CONFLICT', 'INVALID', 'FAILED')),
          detail TEXT,
          imported_at TEXT NOT NULL,
          UNIQUE (spreadsheet_id, sheet_name, source_row, source_record_id, source_updated_at)
        );
        CREATE INDEX google_sheet_imports_record_idx
          ON google_sheet_imports (source_record_id, source_updated_at);
        CREATE TABLE google_sheet_conflicts (
          id TEXT PRIMARY KEY NOT NULL,
          spreadsheet_id TEXT NOT NULL,
          sheet_name TEXT NOT NULL,
          source_row INTEGER NOT NULL,
          source_record_id TEXT NOT NULL,
          local_updated_at TEXT NOT NULL,
          source_updated_at TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED', 'REJECTED')),
          created_at TEXT NOT NULL,
          resolved_at TEXT
        );
      `)
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(35, now)
    })
    migrate()
  }

  if (applied.version < 36) {
    const migrate = db.transaction(() => {
      const now = new Date().toISOString()
      db.exec(`
        CREATE TABLE backup_records (
          id TEXT PRIMARY KEY NOT NULL,
          file_name TEXT NOT NULL,
          local_path TEXT NOT NULL,
          sha256 TEXT NOT NULL,
          size_bytes INTEGER NOT NULL,
          encrypted INTEGER NOT NULL CHECK (encrypted IN (0, 1)),
          remote_path TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX backup_records_created_idx ON backup_records (created_at DESC);
      `)
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(36, now)
    })
    migrate()
  }

  if (applied.version < 37) {
    const migrate = db.transaction(() => {
      db.exec(`
        ALTER TABLE finance_accounts ADD COLUMN status TEXT NOT NULL DEFAULT 'POSTED'
          CHECK (status IN ('POSTED', 'VOIDED'));
        ALTER TABLE finance_accounts ADD COLUMN voided_at TEXT;
        ALTER TABLE finance_accounts ADD COLUMN voided_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
        ALTER TABLE finance_accounts ADD COLUMN void_reason TEXT;
        ALTER TABLE installment_contracts ADD COLUMN previous_status TEXT;
        UPDATE installment_contracts SET previous_status = 'ACTIVE' WHERE status = 'VOIDED';
        CREATE INDEX finance_accounts_status_idx ON finance_accounts (status);
      `)
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(
        37,
        new Date().toISOString()
      )
    })
    migrate()
  }

  if (applied.version < 38) {
    const migrate = db.transaction(() => {
      const now = new Date().toISOString()
      db.exec(`
        ALTER TABLE accounts ADD COLUMN branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL;
        UPDATE accounts
           SET branch_id = (
             SELECT c.branch_id
               FROM installment_contracts c
              WHERE c.account_id = accounts.id
              ORDER BY c.created_at DESC
              LIMIT 1
           )
         WHERE branch_id IS NULL;
        CREATE INDEX accounts_branch_idx ON accounts (branch_id);
      `)
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(38, now)
    })
    migrate()
  }

  if (applied.version < 39) {
    const migrate = db.transaction(() => {
      const now = new Date().toISOString()
      db.exec(`
        ALTER TABLE installment_contracts ADD COLUMN down_payment_applied_centavos INTEGER NOT NULL DEFAULT 0;
        UPDATE installment_contracts
           SET down_payment_applied_centavos = down_payment_centavos
         WHERE COALESCE(NULLIF(schedule_frequency, ''), payment_frequency) = 'Monthly';
        ALTER TABLE in_house_schedules ADD COLUMN is_restructured INTEGER NOT NULL DEFAULT 0 CHECK (is_restructured IN (0, 1));
        ALTER TABLE in_house_schedules ADD COLUMN restructure_id TEXT;
        CREATE TABLE installment_restructures (
          id TEXT PRIMARY KEY,
          contract_id TEXT NOT NULL REFERENCES installment_contracts(id) ON DELETE RESTRICT,
          first_due_date TEXT NOT NULL,
          payment_frequency TEXT NOT NULL,
          terms INTEGER NOT NULL CHECK (terms > 0),
          outstanding_balance_centavos INTEGER NOT NULL CHECK (outstanding_balance_centavos > 0),
          reason TEXT NOT NULL,
          created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX installment_restructures_contract_idx ON installment_restructures(contract_id, created_at);
      `)
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(39, now)
    })
    migrate()
  }

  if (applied.version < 40) {
    const migrate = db.transaction(() => {
      const now = new Date().toISOString()
      db.exec(`
        ALTER TABLE daily_reports ADD COLUMN google_drive_submitted_at TEXT;
        ALTER TABLE daily_reports ADD COLUMN telegram_submitted_at TEXT;
      `)
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(40, now)
    })
    migrate()
  }

  if (applied.version < 41) {
    const migrate = db.transaction(() => {
      const now = new Date().toISOString()
      db.exec(`
        CREATE TABLE google_sheet_branch_cache (
          spreadsheet_id TEXT NOT NULL,
          sheet_name TEXT NOT NULL,
          source_record_id TEXT NOT NULL,
          source_row INTEGER NOT NULL,
          payload_json TEXT NOT NULL,
          downloaded_at TEXT NOT NULL,
          PRIMARY KEY (spreadsheet_id, sheet_name, source_record_id)
        );
        CREATE INDEX google_sheet_branch_cache_sheet_idx
          ON google_sheet_branch_cache (spreadsheet_id, sheet_name, source_row);
      `)
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(41, now)
    })
    migrate()
  }

  if (applied.version < 42) {
    const migrate = db.transaction(() => {
      const now = new Date().toISOString()
      db.exec(`
        ALTER TABLE google_sheet_branch_cache ADD COLUMN source_branch TEXT NOT NULL DEFAULT '';
        UPDATE google_sheet_branch_cache
           SET source_branch = CASE spreadsheet_id
             WHEN '1TA2gZhlEYLvnHhtu8b1TFoStBenPCC7CsP44_GN41Ho' THEN 'Tinambac'
             WHEN '1c2plt4gWAH_w7EQskzvlqgffXVN-Wc0a3S93BZ_twug' THEN 'Tigaon'
             WHEN '1QGKuhWpwSQYwHL9hGCFsO2CaGHvNI-GIIZgMK2hzmKI' THEN 'Lagonoy'
             WHEN '1YwjbVkRFscTenRsrApQKMSypC5cvt4CC9nEYmlVn2oU' THEN 'Goa'
             ELSE ''
           END;
        CREATE INDEX google_sheet_branch_cache_branch_sheet_idx
          ON google_sheet_branch_cache (source_branch, sheet_name, source_row);
      `)
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(42, now)
    })
    migrate()
  }

  if (applied.version < 43) {
    const migrate = db.transaction(() => {
      const now = new Date().toISOString()
      db.exec(`
        CREATE TABLE google_drive_snapshots (
          branch TEXT PRIMARY KEY,
          remote_file_id TEXT,
          remote_revision TEXT,
          sha256 TEXT,
          uploaded_at TEXT,
          downloaded_at TEXT,
          last_error TEXT
        );
      `)
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(43, now)
    })
    migrate()
  }

  if (applied.version < 44) {
    const migrate = db.transaction(() => {
      const now = new Date().toISOString()
      db.exec(`
        CREATE TABLE product_catalog_items (
          description TEXT PRIMARY KEY,
          retail_price_centavos INTEGER NOT NULL CHECK (retail_price_centavos >= 0),
          imported_at TEXT NOT NULL
        );
      `)
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(44, now)
    })
    migrate()
  }

  if (applied.version < 45) {
    const migrate = db.transaction(() => {
      const now = new Date().toISOString()
      db.exec(
        'ALTER TABLE product_catalog_items ADD COLUMN cost_price_centavos INTEGER CHECK (cost_price_centavos >= 0)'
      )
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(45, now)
    })
    migrate()
  }
}
