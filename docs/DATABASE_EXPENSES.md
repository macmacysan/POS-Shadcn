# Expenses database

This document owns expense categories and expense entries. A row may be included in a daily report, but the daily-report document owns report identity and reconciliation.

```sql
CREATE TABLE expense_categories (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL COLLATE NOCASE UNIQUE,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE,
    is_system INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0, 1)),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_by_user_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE expense_entries (
    id TEXT PRIMARY KEY,
    daily_report_id TEXT NOT NULL,
    category_id TEXT NOT NULL,
    transaction_date TEXT NOT NULL,
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
    voided_by_user_id TEXT,
    void_reason TEXT,
    created_by_user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (daily_report_id) REFERENCES daily_reports(id) ON DELETE RESTRICT,
    FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON DELETE RESTRICT,
    FOREIGN KEY (voided_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
    CHECK (length(transaction_date) = 10),
    CHECK (vat_amount_centavos <= gross_amount_centavos)
);

CREATE INDEX idx_expense_entries_report ON expense_entries(daily_report_id);
CREATE INDEX idx_expense_entries_category ON expense_entries(category_id);
```

`gross_amount_centavos` is the stored amount charged. `vat_amount_centavos` is the stored VAT component when applicable; net amount is calculated as gross minus VAT and is not duplicated. Expense category, branch, and cashier are obtained through the foreign-key chain rather than copied into the entry.

Expense entries use `transaction_date` for the business transaction date and `created_at` for insertion time. `status = 'VOIDED'` requires `voided_at`, `voided_by_user_id`, and `void_reason` at the application validation boundary. Posted or voided rows are never physically deleted.
