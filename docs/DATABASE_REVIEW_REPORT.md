# Database Documentation Review

## Executive Summary

- Overall result: the documentation is now consolidated into one normalized, SQLite-compatible design for one physical `cashiers-report.db` database.
- Files reviewed: 8 existing task-scope files (the requested `DATABASE_INSTALLM.md` did not exist; the legacy file was `DATABASE_INSTALL.MD`).
- Files changed or created: 10.
- Files renamed: 3 (`DATABASE_DAILY_REPORTS.md`, `DATABASE_EXPENSES.md`, `DATABASE_INSTALLMENTS.md`).
- Major issues fixed: 12 categories, including duplicate ownership, missing schemas, non-centavo amounts, copied identity data, unsafe deletion semantics, ambiguous dates, generic payment naming, and persisted calculated totals.
- Remaining owner confirmation: confirm the exact bcrypt/Argon2 password-hash library and the business policy for whether an external-provider contract may also receive in-house payments. Neither blocks the documented schema.

## Files Changed

- `DATABASE.md` — created the concise index, conventions, relationships, and migration order; owns no tables.
- `DATABASE_CORE.md` — added `branches`, `users`, `accounts`, and `account_contacts`; defined text IDs, secure `password_hash`, role checks, and account ownership.
- `DATABASE_DAILY_REPORTS.md` — renamed from `DATABASE_DAILYREPORTS.md`; moved all daily-report ownership here, including receipt totals, report-specific non-cash payments, cash-outs, deductions, denominations, and counts; documented reconciliation formulas.
- `DATABASE_EXPENSES.md` — renamed from `DATABASE_EXP.md`; replaced the UI/sidebar draft with `expense_categories` and `expense_entries`, VAT fields, centavo amounts, and voiding.
- `DATABASE_INCOME.md` — kept the canonical income tables; clarified that collections, other income, and finance income are category groups and added voiding/index guidance.
- `DATABASE_INSTALLMENTS.md` — renamed from the legacy `DATABASE_INSTALL.MD`; added configurable `installment_types`, contracts, items, serial numbers, in-house schedules/payments, allocations, settlements, and activity history.
- `DATABASE_AUDIT.md` — added `audit_logs` and field-level `audit_log_changes` with actor, timestamp, status, void, and old/new value rules.
- `DATABASE_REVIEW_REPORT.md` — recorded the audit findings, ownership map, relationships, calculations, readiness, and validation results.
- `ARCHITECTURE.md` — aligned persistence rules with SQLite, `better-sqlite3`, foreign keys, centavos, UTC timestamps, and voiding.
- `BUSINESS_RULES.md` — aligned date semantics and authoritative calculation formulas with the database index.

## Conflicts Resolved

- Conflicting ownership: expense tables were incorrectly in the daily-report document. Chosen: expenses own expense tables; daily reports own only report reconciliation and report-specific entries.
- Incomplete legacy draft versus SQL draft: the old expense and installment/sidebar documents were replaced by implementation-ready schemas.
- Duplicate or ambiguous payment concepts: daily-report non-cash records are `daily_report_payment_entries`; in-house installment records are `in_house_payments`; provider records are `financing_settlements`.
- Copied identity fields: child financial rows no longer require copied `branch_id`, `cashier_id`, or customer names; ownership follows foreign-key relationships.
- Hardcoded financing providers: `installment_types` supports In-house, Home Credit, Salmon, Skyro, and administrator-created types.
- Hardcoded receipt/payment fields: `receipt_types` and `report_payment_methods` are reference tables with child rows.
- Fixed-column/sidebar totals: receipt, income, expense, deduction, cash, and installment totals are calculated from source rows.
- Money representation: every monetary column is named `_centavos` and uses SQLite `INTEGER` with non-negative/positive checks.
- Dates and timestamps: `business_date`, `transaction_date`, contract/payment dates, and `created_at` are distinct.
- Deletion semantics: posted income, expenses, report payments, cash-outs, installment payments, and settlements are `POSTED`/`VOIDED`; foreign keys use `RESTRICT` for financial parents.
- Terminology: canonical terms are `loan_id` where a loan identifier is needed, `referred_by`, `balance_paid_date`, and `EE` for employee contribution. No legacy misspellings remain in database docs.
- Audit values: old/new values use one row per changed column rather than JSON or multi-value fields.

## Tables and Ownership

| Table | Owning document | Primary purpose |
|---|---|---|
| `branches` | `DATABASE_CORE.md` | Branch master data |
| `users` | `DATABASE_CORE.md` | Authenticated actors and roles |
| `accounts` | `DATABASE_CORE.md` | Customer/account identity |
| `account_contacts` | `DATABASE_CORE.md` | Multiple account contact values |
| `daily_reports` | `DATABASE_DAILY_REPORTS.md` | Branch/cashier/business-day report |
| `receipt_types` | `DATABASE_DAILY_REPORTS.md` | Configurable receipt types |
| `daily_receipt_totals` | `DATABASE_DAILY_REPORTS.md` | Per-report receipt quantity/amount |
| `report_payment_methods` | `DATABASE_DAILY_REPORTS.md` | Configurable report payment methods |
| `daily_report_payment_entries` | `DATABASE_DAILY_REPORTS.md` | Check/transfer/GCash/e-wallet report entries |
| `cash_out_entries` | `DATABASE_DAILY_REPORTS.md` | Report cash-outs |
| `deduction_types` | `DATABASE_DAILY_REPORTS.md` | ER/EE/EE-loan deduction reference data |
| `daily_report_deductions` | `DATABASE_DAILY_REPORTS.md` | Report deduction amounts |
| `cash_denominations` | `DATABASE_DAILY_REPORTS.md` | Supported cash denominations |
| `daily_report_cash_counts` | `DATABASE_DAILY_REPORTS.md` | Physical denomination counts |
| `expense_categories` | `DATABASE_EXPENSES.md` | Expense classification |
| `expense_entries` | `DATABASE_EXPENSES.md` | Posted/voided expenses |
| `income_categories` | `DATABASE_INCOME.md` | Collection/other/finance grouping |
| `income_entries` | `DATABASE_INCOME.md` | Posted/voided income |
| `installment_types` | `DATABASE_INSTALLMENTS.md` | Configurable financing providers |
| `installment_contracts` | `DATABASE_INSTALLMENTS.md` | Account financing contract and stored terms |
| `installment_items` | `DATABASE_INSTALLMENTS.md` | Contract goods and item totals |
| `installment_item_serial_numbers` | `DATABASE_INSTALLMENTS.md` | One-to-many serial values |
| `in_house_schedules` | `DATABASE_INSTALLMENTS.md` | Contract due schedule |
| `in_house_payments` | `DATABASE_INSTALLMENTS.md` | Posted/voided in-house payments |
| `installment_payment_allocations` | `DATABASE_INSTALLMENTS.md` | Payment-to-schedule allocation |
| `financing_settlements` | `DATABASE_INSTALLMENTS.md` | Provider settlement records |
| `installment_activity_history` | `DATABASE_INSTALLMENTS.md` | Contract activity timeline |
| `audit_logs` | `DATABASE_AUDIT.md` | Append-only audit event |
| `audit_log_changes` | `DATABASE_AUDIT.md` | Field-level old/new values |

## Relationship Review

- `branches` 1-to-many `users`, `daily_reports`, and `installment_contracts`.
- `accounts` 1-to-many `account_contacts` and `installment_contracts`.
- `users` 1-to-many reports, created/voided financial rows, settlements, and audit events.
- `daily_reports` 1-to-many receipt totals, non-cash payment entries, cash-outs, deductions, cash counts, expenses, and income.
- `receipt_types`, `report_payment_methods`, `deduction_types`, and `cash_denominations` are reference parents with report child rows.
- `installment_types` 1-to-many `installment_contracts`; one account may have many contracts.
- `installment_contracts` 1-to-many items, serial numbers through items, schedules, payments, settlements, and activity history.
- `in_house_payments` and `in_house_schedules` are joined many-to-many through `installment_payment_allocations`.
- `audit_logs` 1-to-many `audit_log_changes`; audit target relationships are validated polymorphically by the main-process service.

## Calculated Versus Stored Values

Stored values include report opening cash and actual cash remitted, contract terms and item prices, transaction amounts, schedule due amounts, payment/settlement amounts, and physical denomination quantities. Calculated values include item totals where derived for validation, financed/contract balances, provider balance, total paid, next due, due amount remaining, receipt/income/expense/deduction totals, expected cash, physical cash counted, and cash variance. The authoritative formulas are in the module documents and `BUSINESS_RULES.md`; sidebar displays do not create stored totals.

## Remaining Questions

- Which installed password-hashing implementation should the future authentication code standardize on (Argon2id or bcrypt)?
- Should an external-provider contract ever accept `in_house_payments`, or should the application reject that combination? The schema and service layer need one explicit policy before payment workflows are implemented.

## Implementation Readiness

| Module | Status |
|---|---|
| Core | Ready with minor decisions |
| Daily reports | Ready |
| Expenses | Ready |
| Income | Ready |
| Installments | Ready with minor decisions |
| Audit | Ready |

## Validation Performed

- Duplicate-table check: extracted every `CREATE TABLE` declaration from the database docs; each table appears once in its owning document.
- Internal-link check: checked all Markdown links introduced by the index and module cross-links against files in `docs`.
- Foreign-key consistency check: reviewed every `REFERENCES` target against the ownership table and migration order; all targets are defined once.
- Naming consistency check: checked for legacy `load_id`, `reffered_by`, `balancedpaid_date`, `cashierid`, `branchid`, and employee `EC` terminology in database docs.
- SQLite syntax review: used SQLite-compatible `TEXT`, `INTEGER`, `CHECK`, `UNIQUE`, `FOREIGN KEY`, `ON DELETE`, and index syntax; no JSON, array, boolean, floating-money, or unsafe table syntax remains.
- Business-rule consistency review: reconciled business/transaction/creation dates, centavo calculations, voiding, report identity, cash reconciliation, account/contract cardinality, and separate daily-report versus installment payment ownership.
