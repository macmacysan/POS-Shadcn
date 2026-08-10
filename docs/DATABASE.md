# Database index

## Engine and location

The application uses one SQLite database file, `cashiers-report.db`, in the Electron app's managed user-data directory. SQLite access belongs to the main process through `better-sqlite3`; the renderer uses typed preload/IPC APIs.

## Shared conventions

- IDs are UUID or ULID values stored as `TEXT`.
- Money is integer centavos (`INTEGER`), never floating point or formatted text.
- Dates are `YYYY-MM-DD`; timestamps are ISO-8601 UTC strings.
- Every connection enables `PRAGMA foreign_keys = ON`.
- Posted financial records are voided, not deleted. Calculated totals are queried or calculated from source rows, not manually duplicated.
- Customer data stays in `accounts`; configurable business types use reference tables.

## Modules

- [Core](DATABASE_CORE.md): branches, users, accounts, and contacts.
- [Daily reports](DATABASE_DAILY_REPORTS.md): reports, receipts, report payment entries, cash counts, deductions, cash-outs, and reconciliation.
- [Expenses](DATABASE_EXPENSES.md): expense categories and entries.
- [Income](DATABASE_INCOME.md): income categories and entries for collections, other income, and finance income.
- [Installments](DATABASE_INSTALLMENTS.md): financing types, contracts, items, schedules, payments, allocations, settlements, and history.
- [Audit](DATABASE_AUDIT.md): audit events and field-level old/new values.

## Relationship overview

Branches own users and daily reports. A daily report belongs to one branch and cashier and has receipt totals, report payment entries, deductions, cash-outs, and cash counts. Expenses and income entries belong to a daily report. Accounts may have many installment contracts; a contract belongs to one branch, financing type, and account, and has many items, schedules, payments, allocations, settlements, and activity rows. Audit events reference actors and polymorphic target entities.

## Migration order

Create core tables first, then daily-report reference tables and reports, followed by expenses and income, then installment reference and transaction tables, and finally audit tables and indexes. Future schema changes must use versioned migrations as required by [ARCHITECTURE.md](ARCHITECTURE.md).
