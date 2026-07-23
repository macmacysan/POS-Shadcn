# Daily reports database

This document owns daily cashier reports, receipt totals, report payment entries, cash-out entries, deductions, cash counts, and reconciliation rules. It references [`DATABASE_CORE.md`](DATABASE_CORE.md), [`DATABASE_EXPENSES.md`](DATABASE_EXPENSES.md), and [`DATABASE_INCOME.md`](DATABASE_INCOME.md) without redefining their tables.

## Tables

```sql
CREATE TABLE daily_reports (
    id TEXT PRIMARY KEY,
    branch_id TEXT NOT NULL,
    cashier_user_id TEXT NOT NULL,
    business_date TEXT NOT NULL,
    opening_cash_centavos INTEGER NOT NULL DEFAULT 0 CHECK (opening_cash_centavos >= 0),
    cash_remitted_centavos INTEGER CHECK (cash_remitted_centavos IS NULL OR cash_remitted_centavos >= 0),
    status TEXT NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REOPENED', 'VOIDED')),
    submitted_at TEXT,
    approved_at TEXT,
    approved_by_user_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
    FOREIGN KEY (cashier_user_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (approved_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE (branch_id, cashier_user_id, business_date),
    CHECK (length(business_date) = 10)
);

CREATE INDEX idx_daily_reports_business_date ON daily_reports(branch_id, business_date);

CREATE TABLE receipt_types (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL COLLATE NOCASE UNIQUE,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE,
    is_system INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0, 1)),
    is_default_visible INTEGER NOT NULL DEFAULT 0 CHECK (is_default_visible IN (0, 1)),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_by_user_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE daily_receipt_totals (
    id TEXT PRIMARY KEY,
    daily_report_id TEXT NOT NULL,
    receipt_type_id TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    amount_centavos INTEGER NOT NULL DEFAULT 0 CHECK (amount_centavos >= 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (daily_report_id) REFERENCES daily_reports(id) ON DELETE RESTRICT,
    FOREIGN KEY (receipt_type_id) REFERENCES receipt_types(id) ON DELETE RESTRICT,
    UNIQUE (daily_report_id, receipt_type_id)
);

CREATE TABLE report_payment_methods (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL COLLATE NOCASE UNIQUE,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE daily_report_payment_entries (
    id TEXT PRIMARY KEY,
    daily_report_id TEXT NOT NULL,
    payment_method_id TEXT NOT NULL,
    transaction_date TEXT NOT NULL,
    amount_centavos INTEGER NOT NULL CHECK (amount_centavos > 0),
    reference_number TEXT,
    bank_name TEXT,
    payer_name TEXT,
    remarks TEXT,
    status TEXT NOT NULL DEFAULT 'POSTED' CHECK (status IN ('POSTED', 'VOIDED')),
    voided_at TEXT,
    voided_by_user_id TEXT,
    void_reason TEXT,
    created_by_user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (daily_report_id) REFERENCES daily_reports(id) ON DELETE RESTRICT,
    FOREIGN KEY (payment_method_id) REFERENCES report_payment_methods(id) ON DELETE RESTRICT,
    FOREIGN KEY (voided_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
    CHECK (length(transaction_date) = 10)
);

CREATE INDEX idx_daily_report_payments_report ON daily_report_payment_entries(daily_report_id);

CREATE TABLE cash_out_entries (
    id TEXT PRIMARY KEY,
    daily_report_id TEXT NOT NULL,
    transaction_date TEXT NOT NULL,
    description TEXT NOT NULL,
    amount_centavos INTEGER NOT NULL CHECK (amount_centavos > 0),
    status TEXT NOT NULL DEFAULT 'POSTED' CHECK (status IN ('POSTED', 'VOIDED')),
    voided_at TEXT,
    voided_by_user_id TEXT,
    void_reason TEXT,
    created_by_user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (daily_report_id) REFERENCES daily_reports(id) ON DELETE RESTRICT,
    FOREIGN KEY (voided_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE deduction_types (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL COLLATE NOCASE UNIQUE,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE,
    contribution_code TEXT NOT NULL CHECK (contribution_code IN ('ER', 'EE', 'EE_LOAN')),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE daily_report_deductions (
    id TEXT PRIMARY KEY,
    daily_report_id TEXT NOT NULL,
    deduction_type_id TEXT NOT NULL,
    amount_centavos INTEGER NOT NULL CHECK (amount_centavos >= 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (daily_report_id) REFERENCES daily_reports(id) ON DELETE RESTRICT,
    FOREIGN KEY (deduction_type_id) REFERENCES deduction_types(id) ON DELETE RESTRICT,
    UNIQUE (daily_report_id, deduction_type_id)
);

CREATE TABLE cash_denominations (
    id TEXT PRIMARY KEY,
    value_centavos INTEGER NOT NULL UNIQUE CHECK (value_centavos > 0),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE daily_report_cash_counts (
    id TEXT PRIMARY KEY,
    daily_report_id TEXT NOT NULL,
    denomination_id TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity >= 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (daily_report_id) REFERENCES daily_reports(id) ON DELETE RESTRICT,
    FOREIGN KEY (denomination_id) REFERENCES cash_denominations(id) ON DELETE RESTRICT,
    UNIQUE (daily_report_id, denomination_id)
);
```

`daily_report_payment_entries` is specifically for non-cash entries recorded on a daily report. It is not installment payment data; installment payments are owned by [`DATABASE_INSTALLMENTS.md`](DATABASE_INSTALLMENTS.md). Seed or administer report methods for check, bank transfer, GCash, and other e-wallets through `report_payment_methods`; do not add one fixed column per method.

## Dates, statuses, and calculations

- `business_date` identifies the report and is not a timestamp. A child `transaction_date` records when a payment, expense, income, or cash-out occurred. `created_at` records insertion time.
- Posted financial rows are voided with actor, timestamp, and reason; they are not deleted. Void rows are excluded from totals.
- Expected cash = opening cash + posted cash receipts + posted cash income − posted cash deductions − posted cash-outs.
- Physical cash counted = sum of `value_centavos * quantity` in `daily_report_cash_counts`.
- Cash variance = physical cash counted − expected cash.
- `cash_remitted_centavos` is the stored amount actually remitted. It is not the same as physical cash counted; remittance variance, if displayed, is calculated.
- Sidebar totals for collections, other income, finance, expenses, deductions, drawings, purchases, receivables, payment methods, and cash variance are live aggregates over owned rows. They are not columns on `daily_reports`.
