# Core database

This document owns shared identity and reference data. Other module documents may reference these tables but must not redefine them.

## Conventions

- SQLite database: `cashiers-report.db`, opened by the Electron main process with `PRAGMA foreign_keys = ON` on every connection.
- IDs are UUID or ULID strings stored as `TEXT`; monetary values are integer centavos.
- Dates are `YYYY-MM-DD`; timestamps are ISO-8601 UTC strings.
- `created_at` is the record creation timestamp. A business date or transaction date is stored separately when applicable.
- Passwords are stored only as slow, salted password hashes in `password_hash`; plaintext passwords and reversible encryption are prohibited.

## Tables

```sql
CREATE TABLE branches (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL COLLATE NOCASE UNIQUE,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
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
    updated_at TEXT NOT NULL,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL
);

CREATE INDEX idx_users_branch_id ON users(branch_id);

CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    account_number TEXT NOT NULL COLLATE NOCASE UNIQUE,
    display_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    first_name TEXT NOT NULL,
    middle_name TEXT,
    suffix TEXT,
    street_subdivision TEXT,
    barangay TEXT NOT NULL,
    city_municipality TEXT NOT NULL,
    province TEXT NOT NULL,
    occupation TEXT,
    agent TEXT,
    referred_by TEXT,
    account_type TEXT NOT NULL DEFAULT 'CUSTOMER'
        CHECK (account_type IN ('CUSTOMER', 'BUSINESS', 'OTHER')),
    status TEXT NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'BLACKLISTED')),
    blacklisted_at TEXT,
    blacklisted_by_user_id TEXT,
    blacklist_reason TEXT,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (blacklisted_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE account_contacts (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    contact_type TEXT NOT NULL CHECK (contact_type IN ('PHONE', 'EMAIL', 'ADDRESS', 'OTHER')),
    contact_value TEXT NOT NULL,
    is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
    UNIQUE (account_id, contact_type, contact_value)
);

CREATE INDEX idx_account_contacts_account_id ON account_contacts(account_id);
```

Customer names and contact details belong to `accounts` and `account_contacts`. Transaction and installment tables store `account_id`, not copied customer names. Branch and cashier ownership is obtained through the owning report, user, or contract relationship rather than repeated on every child row.

Shared audit records are owned by [`DATABASE_AUDIT.md`](DATABASE_AUDIT.md). Daily reports, expenses, income, and installments are owned by their respective documents.
