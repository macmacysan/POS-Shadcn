# Installments database

This document owns configurable financing types, contracts, contract items and serial numbers, in-house schedules and payments, allocations, provider settlements, and installment activity history. Customer data is owned by [`DATABASE_CORE.md`](DATABASE_CORE.md).

## Tables

```sql
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

CREATE TABLE installment_contracts (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    branch_id TEXT NOT NULL,
    installment_type_id TEXT NOT NULL,
    contract_number TEXT NOT NULL COLLATE NOCASE UNIQUE,
    contract_date TEXT NOT NULL,
    financed_amount_centavos INTEGER NOT NULL CHECK (financed_amount_centavos >= 0),
    total_payable_centavos INTEGER NOT NULL CHECK (total_payable_centavos >= financed_amount_centavos),
    term_count INTEGER NOT NULL CHECK (term_count > 0),
    term_unit TEXT NOT NULL CHECK (term_unit IN ('DAY', 'WEEK', 'MONTH')),
    status TEXT NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('DRAFT', 'ACTIVE', 'CLOSED', 'VOIDED', 'DEFAULTED')),
    closed_at TEXT,
    closed_by_user_id TEXT,
    close_reason TEXT,
    created_by_user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
    FOREIGN KEY (installment_type_id) REFERENCES installment_types(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
    CHECK (length(contract_date) = 10)
);

CREATE INDEX idx_installment_contracts_account ON installment_contracts(account_id);
CREATE INDEX idx_installment_contracts_branch ON installment_contracts(branch_id);

CREATE TABLE installment_items (
    id TEXT PRIMARY KEY,
    contract_id TEXT NOT NULL,
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price_centavos INTEGER NOT NULL CHECK (unit_price_centavos >= 0),
    item_total_centavos INTEGER NOT NULL CHECK (item_total_centavos = quantity * unit_price_centavos),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (contract_id) REFERENCES installment_contracts(id) ON DELETE RESTRICT
);

CREATE TABLE installment_item_serial_numbers (
    id TEXT PRIMARY KEY,
    installment_item_id TEXT NOT NULL,
    serial_number TEXT NOT NULL COLLATE NOCASE UNIQUE,
    created_at TEXT NOT NULL,
    FOREIGN KEY (installment_item_id) REFERENCES installment_items(id) ON DELETE RESTRICT
);

CREATE TABLE in_house_schedules (
    id TEXT PRIMARY KEY,
    contract_id TEXT NOT NULL,
    installment_number INTEGER NOT NULL CHECK (installment_number > 0),
    due_date TEXT NOT NULL,
    due_amount_centavos INTEGER NOT NULL CHECK (due_amount_centavos > 0),
    status TEXT NOT NULL DEFAULT 'DUE' CHECK (status IN ('DUE', 'PARTIALLY_PAID', 'PAID', 'WAIVED')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (contract_id) REFERENCES installment_contracts(id) ON DELETE RESTRICT,
    UNIQUE (contract_id, installment_number),
    CHECK (length(due_date) = 10)
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
    received_by_user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (contract_id) REFERENCES installment_contracts(id) ON DELETE RESTRICT,
    FOREIGN KEY (voided_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (received_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
    CHECK (length(payment_date) = 10)
);

CREATE TABLE installment_payment_allocations (
    id TEXT PRIMARY KEY,
    payment_id TEXT NOT NULL,
    schedule_id TEXT NOT NULL,
    allocated_amount_centavos INTEGER NOT NULL CHECK (allocated_amount_centavos > 0),
    created_at TEXT NOT NULL,
    FOREIGN KEY (payment_id) REFERENCES in_house_payments(id) ON DELETE RESTRICT,
    FOREIGN KEY (schedule_id) REFERENCES in_house_schedules(id) ON DELETE RESTRICT,
    UNIQUE (payment_id, schedule_id)
);

CREATE TABLE financing_settlements (
    id TEXT PRIMARY KEY,
    contract_id TEXT NOT NULL,
    settlement_date TEXT NOT NULL,
    provider_reference TEXT,
    amount_centavos INTEGER NOT NULL CHECK (amount_centavos > 0),
    status TEXT NOT NULL DEFAULT 'POSTED' CHECK (status IN ('POSTED', 'VOIDED')),
    voided_at TEXT,
    voided_by_user_id TEXT,
    void_reason TEXT,
    settled_by_user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (contract_id) REFERENCES installment_contracts(id) ON DELETE RESTRICT,
    FOREIGN KEY (voided_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (settled_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
    CHECK (length(settlement_date) = 10)
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
```

The seeded financing types are `IN_HOUSE`, `HOME_CREDIT`, `SALMON`, and `SKYRO`; administrators may add more rows without schema changes. `installment_type_id` is the provider relationship, and must not be replaced with a hardcoded provider column.

An account may have many contracts; a contract may have many items, schedules, payments, allocations, settlements, and history rows. Only in-house contracts use `in_house_schedules` and `in_house_payments`; external-provider transactions are represented by `financing_settlements`. A payment and schedule must belong to the same contract; enforce that invariant in the transaction/service layer because SQLite cannot express a cross-table equality `CHECK`.

## Stored versus calculated values

- Stored at contract creation: item unit price, quantity, item total, financed amount, total payable, term, and contract date. `item_total_centavos = quantity * unit_price_centavos` is validated on write.
- Calculated: total paid (posted allocations), installment balance (`total_payable_centavos - total paid`), provider balance (provider obligation less posted settlements), next due, and due amount remaining on the next unpaid schedule. These are not duplicate contract columns.
- Account-wide blacklisting is stored on `accounts.status` in [`DATABASE_CORE.md`](DATABASE_CORE.md). Blacklisting blocks new contracts and hides the account from Active, but does not close or delete existing contracts.
- Closing a contract requires a zero calculated balance and stores `closed_at`, `closed_by_user_id`, and `close_reason`; the transition is also written to the audit log.
- Payments and settlements are voided, not deleted. Void rows are excluded from balances.
