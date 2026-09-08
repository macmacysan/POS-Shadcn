-- Read-only schema export from the startup-derived cashiers-report.db.
-- No production data is included.
-- Source: C:\Users\Admin-PC\AppData\Roaming\cashiers-report\cashiers-report.db
PRAGMA foreign_keys = ON;

CREATE TABLE account_contacts (
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

CREATE TABLE accounts (
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
          updated_at TEXT NOT NULL, civil_status TEXT, latitude REAL, longitude REAL, landmark_remarks TEXT, branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
          FOREIGN KEY (blacklisted_by_user_id) REFERENCES users(id) ON DELETE SET NULL
        );

CREATE TABLE app_settings (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

CREATE TABLE audit_log_changes (
          id TEXT PRIMARY KEY,
          audit_log_id TEXT NOT NULL,
          column_name TEXT NOT NULL,
          old_value TEXT,
          new_value TEXT,
          FOREIGN KEY (audit_log_id) REFERENCES audit_logs(id) ON DELETE RESTRICT,
          UNIQUE (audit_log_id, column_name)
        );

CREATE TABLE audit_logs (
          id TEXT PRIMARY KEY,
          actor_user_id TEXT,
          action TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          reason TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
        );

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

CREATE TABLE branches (
          id TEXT PRIMARY KEY,
          code TEXT NOT NULL COLLATE NOCASE UNIQUE,
          name TEXT NOT NULL COLLATE NOCASE UNIQUE,
          is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

CREATE TABLE cash_denominations (
          id TEXT PRIMARY KEY NOT NULL,
          value_centavos INTEGER NOT NULL UNIQUE CHECK (value_centavos > 0),
          is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
          sort_order INTEGER NOT NULL DEFAULT 0
        );

CREATE TABLE cash_out_entries (
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

CREATE TABLE daily_receipt_totals (
          id TEXT PRIMARY KEY NOT NULL,
          daily_report_id TEXT NOT NULL REFERENCES daily_reports(id) ON DELETE RESTRICT,
          receipt_type_id TEXT NOT NULL REFERENCES receipt_types(id) ON DELETE RESTRICT,
          quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
          amount_centavos INTEGER NOT NULL DEFAULT 0 CHECK (amount_centavos >= 0),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL, receipt_name TEXT NOT NULL DEFAULT '', receipt_short_name TEXT NOT NULL DEFAULT '',
          UNIQUE (daily_report_id, receipt_type_id)
        );

CREATE TABLE daily_report_cash_counts (
          id TEXT PRIMARY KEY NOT NULL,
          daily_report_id TEXT NOT NULL REFERENCES daily_reports(id) ON DELETE RESTRICT,
          denomination_id TEXT NOT NULL REFERENCES cash_denominations(id) ON DELETE RESTRICT,
          quantity INTEGER NOT NULL CHECK (quantity >= 0),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE (daily_report_id, denomination_id)
        );

CREATE TABLE daily_report_deductions (
          id TEXT PRIMARY KEY NOT NULL,
          daily_report_id TEXT NOT NULL REFERENCES daily_reports(id) ON DELETE RESTRICT,
          deduction_type_id TEXT NOT NULL REFERENCES deduction_types(id) ON DELETE RESTRICT,
          amount_centavos INTEGER NOT NULL CHECK (amount_centavos >= 0),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE (daily_report_id, deduction_type_id)
        );

CREATE TABLE daily_report_payment_entries (
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
        , payment_method_name TEXT NOT NULL DEFAULT '');

CREATE TABLE daily_reports (
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
          updated_at TEXT NOT NULL, updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL, note TEXT, google_drive_submitted_at TEXT, telegram_submitted_at TEXT,
          UNIQUE (branch_id, cashier_user_id, business_date)
        );

CREATE TABLE deduction_types (
          id TEXT PRIMARY KEY NOT NULL,
          code TEXT NOT NULL COLLATE NOCASE UNIQUE,
          name TEXT NOT NULL COLLATE NOCASE UNIQUE,
          contribution_code TEXT NOT NULL CHECK (contribution_code IN ('ER', 'EE', 'EE_LOAN')),
          is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

CREATE TABLE expense_categories (
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

CREATE TABLE expense_entries (
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
        , status TEXT NOT NULL DEFAULT 'POSTED'
          CHECK (status IN ('POSTED', 'VOIDED')), voided_at TEXT, voided_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL, void_reason TEXT, created_by_user_id TEXT REFERENCES users(id));

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
        , status TEXT NOT NULL DEFAULT 'POSTED'
          CHECK (status IN ('POSTED', 'VOIDED')), voided_at TEXT, voided_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL, void_reason TEXT);

CREATE TABLE google_drive_snapshots (
          branch TEXT PRIMARY KEY,
          remote_file_id TEXT,
          remote_revision TEXT,
          sha256 TEXT,
          uploaded_at TEXT,
          downloaded_at TEXT,
          last_error TEXT
        );

CREATE TABLE google_sheet_branch_cache (
          spreadsheet_id TEXT NOT NULL,
          sheet_name TEXT NOT NULL,
          source_record_id TEXT NOT NULL,
          source_row INTEGER NOT NULL,
          payload_json TEXT NOT NULL,
          downloaded_at TEXT NOT NULL, source_branch TEXT NOT NULL DEFAULT '',
          PRIMARY KEY (spreadsheet_id, sheet_name, source_record_id)
        );

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

CREATE TABLE google_sheet_sources (
          key TEXT PRIMARY KEY NOT NULL,
          spreadsheet_id TEXT NOT NULL,
          branch TEXT,
          updated_at TEXT NOT NULL
        );

CREATE TABLE in_house_payments (
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
          updated_at TEXT NOT NULL, submission_id TEXT, replaces_payment_id TEXT, penalty_centavos INTEGER NOT NULL DEFAULT 0 CHECK (penalty_centavos >= 0),
          FOREIGN KEY (contract_id) REFERENCES installment_contracts(id) ON DELETE RESTRICT,
          FOREIGN KEY (voided_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
          FOREIGN KEY (received_by_user_id) REFERENCES users(id) ON DELETE SET NULL
        );

CREATE TABLE in_house_schedules (
          id TEXT PRIMARY KEY,
          contract_id TEXT NOT NULL,
          installment_number INTEGER NOT NULL CHECK (installment_number > 0),
          due_date TEXT NOT NULL,
          due_amount_centavos INTEGER NOT NULL CHECK (due_amount_centavos > 0),
          status TEXT NOT NULL DEFAULT 'DUE'
            CHECK (status IN ('DUE', 'PARTIALLY_PAID', 'PAID', 'WAIVED')),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL, is_restructured INTEGER NOT NULL DEFAULT 0 CHECK (is_restructured IN (0, 1)), restructure_id TEXT,
          FOREIGN KEY (contract_id) REFERENCES installment_contracts(id) ON DELETE RESTRICT,
          UNIQUE (contract_id, installment_number)
        );

CREATE TABLE income_categories (
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

CREATE TABLE income_entries (
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

CREATE TABLE installment_activity_history (
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

CREATE TABLE installment_contracts (
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
          updated_at TEXT NOT NULL, schedule_frequency TEXT NOT NULL DEFAULT '', configuration_version_id TEXT, end_date TEXT, interest_rate_bps INTEGER, required_down_payment_rate_bps INTEGER, daily_required_fee_factor INTEGER, payment_amount_centavos INTEGER, required_fee_centavos INTEGER, previous_status TEXT, down_payment_applied_centavos INTEGER NOT NULL DEFAULT 0,
          FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
          FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
          FOREIGN KEY (installment_type_id) REFERENCES installment_types(id) ON DELETE RESTRICT,
          FOREIGN KEY (closed_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
          FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
        );

CREATE TABLE installment_import_issues (
          source_sha256 TEXT NOT NULL REFERENCES installment_import_runs(source_sha256) ON DELETE CASCADE,
          sheet_name TEXT NOT NULL,
          row_number INTEGER NOT NULL,
          code TEXT NOT NULL,
          detail TEXT NOT NULL,
          PRIMARY KEY (source_sha256, sheet_name, row_number, code)
        );

CREATE TABLE installment_import_runs (
          source_sha256 TEXT PRIMARY KEY,
          source_path TEXT NOT NULL,
          imported_at TEXT NOT NULL,
          report_json TEXT NOT NULL
        );

CREATE TABLE installment_items (
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

CREATE TABLE installment_payment_allocations (
          id TEXT PRIMARY KEY,
          payment_id TEXT NOT NULL,
          schedule_id TEXT NOT NULL,
          allocated_amount_centavos INTEGER NOT NULL CHECK (allocated_amount_centavos > 0),
          created_at TEXT NOT NULL, penalty_centavos INTEGER NOT NULL DEFAULT 0 CHECK (penalty_centavos >= 0),
          FOREIGN KEY (payment_id) REFERENCES in_house_payments(id) ON DELETE RESTRICT,
          FOREIGN KEY (schedule_id) REFERENCES in_house_schedules(id) ON DELETE RESTRICT,
          UNIQUE (payment_id, schedule_id)
        );

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

CREATE TABLE installment_rule_terms (
          version_id TEXT NOT NULL,
          frequency TEXT NOT NULL CHECK (frequency IN ('Daily', 'Weekly', 'Semi', 'Monthly')),
          terms INTEGER NOT NULL CHECK (terms > 0),
          interest_rate_bps INTEGER,
          required_fee_payments INTEGER,
          PRIMARY KEY (version_id, frequency, terms),
          FOREIGN KEY (version_id) REFERENCES installment_rule_versions(id) ON DELETE RESTRICT
        );

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

CREATE TABLE installment_types (
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

CREATE TABLE product_catalog_items (
          description TEXT PRIMARY KEY,
          retail_price_centavos INTEGER NOT NULL CHECK (retail_price_centavos >= 0),
          imported_at TEXT NOT NULL
        , cost_price_centavos INTEGER CHECK (cost_price_centavos >= 0));

CREATE TABLE receipt_types (
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
        , short_name TEXT NOT NULL DEFAULT '');

CREATE TABLE report_payment_methods (
          id TEXT PRIMARY KEY NOT NULL,
          code TEXT NOT NULL COLLATE NOCASE UNIQUE,
          name TEXT NOT NULL COLLATE NOCASE UNIQUE,
          is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

CREATE TABLE report_reconciliations (
          report_id TEXT PRIMARY KEY NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
          physical_cash_centavos INTEGER NOT NULL,
          cash_remitted_centavos INTEGER NOT NULL CHECK (cash_remitted_centavos >= 0),
          cash_variance_centavos INTEGER NOT NULL,
          updated_at TEXT NOT NULL
        );

CREATE TABLE reports (
          id TEXT PRIMARY KEY NOT NULL,
          branch_id TEXT NOT NULL,
          cashier_id TEXT NOT NULL,
          business_date TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('Draft', 'Submitted', 'Locked')),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

CREATE TABLE schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

CREATE TABLE user_branch_assignments (
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
          PRIMARY KEY (user_id, branch_id)
        );

CREATE TABLE users (
          id TEXT PRIMARY KEY,
          branch_id TEXT,
          username TEXT NOT NULL COLLATE NOCASE UNIQUE,
          password_hash TEXT NOT NULL,
          display_name TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('CASHIER', 'ADMIN', 'SUPERVISOR', 'AUDITOR')),
          is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
          last_login_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL, must_change_password INTEGER NOT NULL DEFAULT 0 CHECK (must_change_password IN (0, 1)), first_name TEXT NOT NULL DEFAULT '', last_name TEXT NOT NULL DEFAULT '',
          FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL
        );

CREATE INDEX accounts_branch_idx ON accounts (branch_id);

CREATE INDEX backup_records_created_idx ON backup_records (created_at DESC);

CREATE INDEX catalog_options_kind_active_idx ON catalog_options (kind, is_active, value);

CREATE INDEX expenses_report_category_idx
          ON expenses (report_id, category);

CREATE INDEX expenses_report_created_idx
          ON expenses (report_id, created_at DESC, id DESC);

CREATE INDEX expenses_report_receipt_no_idx
          ON expenses (report_id, receipt_no);

CREATE INDEX expenses_report_status_idx ON expenses (report_id, status);

CREATE INDEX expenses_report_type_idx
          ON expenses (report_id, type);

CREATE INDEX expenses_report_vat_idx
          ON expenses (report_id, vat);

CREATE INDEX finance_account_items_account_sort_idx
          ON finance_account_items (finance_account_id, sort_order);

CREATE INDEX finance_accounts_branch_date_idx
          ON finance_accounts (branch, date_released DESC, created_at DESC);

CREATE INDEX finance_accounts_status_idx ON finance_accounts (status);

CREATE INDEX google_sheet_branch_cache_branch_sheet_idx
          ON google_sheet_branch_cache (source_branch, sheet_name, source_row);

CREATE INDEX google_sheet_branch_cache_sheet_idx
          ON google_sheet_branch_cache (spreadsheet_id, sheet_name, source_row);

CREATE INDEX google_sheet_imports_record_idx
          ON google_sheet_imports (source_record_id, source_updated_at);

CREATE INDEX idx_accounts_status ON accounts(status);

CREATE INDEX idx_cash_out_entries_report
          ON cash_out_entries (daily_report_id);

CREATE INDEX idx_contracts_account ON installment_contracts(account_id);

CREATE INDEX idx_contracts_branch ON installment_contracts(branch_id);

CREATE INDEX idx_contracts_due_date ON installment_contracts(first_due_date);

CREATE INDEX idx_contracts_status ON installment_contracts(status);

CREATE INDEX idx_daily_receipt_totals_report
          ON daily_receipt_totals (daily_report_id);

CREATE INDEX idx_daily_report_cash_counts_report
          ON daily_report_cash_counts (daily_report_id);

CREATE INDEX idx_daily_report_deductions_report
          ON daily_report_deductions (daily_report_id);

CREATE INDEX idx_daily_report_payments_method_date
          ON daily_report_payment_entries (payment_method_id, transaction_date);

CREATE INDEX idx_daily_report_payments_report
          ON daily_report_payment_entries (daily_report_id);

CREATE UNIQUE INDEX idx_daily_reports_branch_business_date ON daily_reports (branch_id, business_date);

CREATE INDEX idx_daily_reports_business_date
          ON daily_reports (branch_id, business_date);

CREATE INDEX idx_expense_entries_category ON expense_entries (category_id);

CREATE INDEX idx_expense_entries_report ON expense_entries (daily_report_id);

CREATE INDEX idx_income_entries_category ON income_entries (category_id);

CREATE INDEX idx_income_entries_report ON income_entries (daily_report_id);

CREATE INDEX in_house_payments_contract_idx ON in_house_payments (contract_id);

CREATE INDEX in_house_payments_replaces_payment_idx
          ON in_house_payments (replaces_payment_id)
          WHERE replaces_payment_id IS NOT NULL;

CREATE UNIQUE INDEX in_house_payments_submission_idx
          ON in_house_payments (contract_id, submission_id)
          WHERE submission_id IS NOT NULL;

CREATE INDEX installment_import_issues_code_idx ON installment_import_issues (source_sha256, code);

CREATE INDEX installment_items_contract_idx ON installment_items (contract_id);

CREATE INDEX installment_restructures_contract_idx ON installment_restructures(contract_id, created_at);

CREATE UNIQUE INDEX installment_rule_versions_active_idx ON installment_rule_versions(is_active) WHERE is_active = 1;

CREATE INDEX report_reconciliations_updated_idx
          ON report_reconciliations (updated_at DESC);

