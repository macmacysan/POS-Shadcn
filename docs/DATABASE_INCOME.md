# Income database

This document owns income categories and income entries. Collections, other income, and finance income are category values, not separate duplicated tables.

```sql
CREATE TABLE income_categories (
    id TEXT PRIMARY KEY,
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
    id TEXT PRIMARY KEY,
    daily_report_id TEXT NOT NULL,
    category_id TEXT NOT NULL,
    transaction_date TEXT NOT NULL,
    particular TEXT NOT NULL,
    receipt_number TEXT,
    remarks TEXT,
    amount_centavos INTEGER NOT NULL CHECK (amount_centavos > 0),
    status TEXT NOT NULL DEFAULT 'POSTED' CHECK (status IN ('POSTED', 'VOIDED')),
    voided_at TEXT,
    voided_by_user_id TEXT,
    void_reason TEXT,
    created_by_user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (daily_report_id) REFERENCES daily_reports(id) ON DELETE RESTRICT,
    FOREIGN KEY (category_id) REFERENCES income_categories(id) ON DELETE RESTRICT,
    FOREIGN KEY (voided_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
    CHECK (length(transaction_date) = 10)
);

CREATE INDEX idx_income_entries_report ON income_entries(daily_report_id);
CREATE INDEX idx_income_entries_category ON income_entries(category_id);
```

An income entry has one category and one amount. Its collection/other-income/finance grouping comes from `income_categories.summary_group`. Totals are calculated from posted entries; sidebar totals are not persisted. Income entries are voided, not deleted, and a void requires actor, UTC timestamp, and reason.

`transaction_date` is distinct from the parent report's `business_date` and from `created_at`. The report relationship supplies branch and cashier ownership.
