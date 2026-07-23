import type Database from 'better-sqlite3'

export const currentSchemaVersion = 3

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

      db.prepare('INSERT OR IGNORE INTO branches (id, code, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run('development-lagonoy', 'LAG', 'Lagonoy', now, now)

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
}
