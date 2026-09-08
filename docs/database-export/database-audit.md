# Database audit

This report compares a read-only inspection of the startup-derived production/local SQLite database with an isolated in-memory execution of the current migrations. No production data was altered.

## Actual database

- **Path:** `C:\Users\Admin-PC\AppData\Roaming\cashiers-report\cashiers-report.db`
- **Size:** 2056192 bytes
- **Current source migration version:** 46
- **Actual tables:** 48
- **Actual declared indexes:** 40
- **Actual foreign-key relationships:** 61
- **Actual PRAGMA journal_mode:** wal
- **Actual PRAGMA foreign_keys (read-only inspection connection):** 1
- **Actual database_list:** `[{"seq":0,"name":"main","file":"C:\\Users\\Admin-PC\\AppData\\Roaming\\cashiers-report\\cashiers-report.db"}]`

## schema_migrations

| Version | Applied at |
|---:|---|
| 1 | 2026-08-23T00:17:04.437Z |
| 2 | 2026-08-23T00:17:04.439Z |
| 3 | 2026-08-23T00:17:04.439Z |
| 4 | 2026-08-23T00:17:04.439Z |
| 5 | 2026-08-23T00:17:04.440Z |
| 6 | 2026-08-23T00:17:04.440Z |
| 7 | 2026-08-23T00:17:04.441Z |
| 8 | 2026-08-23T00:17:04.441Z |
| 9 | 2026-08-23T00:17:04.441Z |
| 10 | 2026-08-23T00:17:04.443Z |
| 11 | 2026-08-23T00:17:04.450Z |
| 12 | 2026-08-23T00:17:04.450Z |
| 13 | 2026-08-23T00:17:04.450Z |
| 14 | 2026-08-23T00:17:04.450Z |
| 15 | 2026-08-23T00:17:04.450Z |
| 16 | 2026-08-23T00:17:04.451Z |
| 17 | 2026-08-23T00:17:04.453Z |
| 18 | 2026-08-23T00:17:04.454Z |
| 19 | 2026-08-23T00:17:04.454Z |
| 20 | 2026-08-23T00:17:04.455Z |
| 21 | 2026-08-23T00:17:04.456Z |
| 22 | 2026-08-23T00:17:04.458Z |
| 23 | 2026-08-23T00:17:04.458Z |
| 24 | 2026-08-23T00:17:04.463Z |
| 25 | 2026-08-23T00:17:04.464Z |
| 26 | 2026-08-23T00:17:04.465Z |
| 27 | 2026-08-23T00:17:04.465Z |
| 28 | 2026-08-23T00:17:04.466Z |
| 29 | 2026-08-23T00:17:04.467Z |
| 30 | 2026-08-23T00:17:04.468Z |
| 31 | 2026-09-03T04:26:22.910Z |
| 32 | 2026-09-03T04:26:23.385Z |
| 33 | 2026-09-03T04:26:23.387Z |
| 34 | 2026-09-03T04:26:23.387Z |
| 35 | 2026-09-03T04:26:23.388Z |
| 36 | 2026-09-03T04:26:23.389Z |
| 37 | 2026-09-03T04:26:23.393Z |
| 38 | 2026-09-03T04:26:23.393Z |
| 39 | 2026-09-03T04:26:23.394Z |
| 40 | 2026-09-03T04:26:23.397Z |
| 41 | 2026-09-03T04:26:23.399Z |
| 42 | 2026-09-03T04:26:23.399Z |
| 43 | 2026-09-03T04:26:23.400Z |
| 44 | 2026-09-03T04:26:23.400Z |
| 45 | 2026-09-03T04:26:23.400Z |
| 46 | 2026-09-08T02:23:01.591Z |

Actual migration version: **46**.

## Schema comparison

| Classification | Object | Finding |
|---|---|---|
| MATCH | account_contacts | Columns, foreign keys, and declared indexes match current migrations. |
| MATCH | accounts | Columns, foreign keys, and declared indexes match current migrations. |
| MATCH | app_settings | Columns, foreign keys, and declared indexes match current migrations. |
| MATCH | audit_log_changes | Columns, foreign keys, and declared indexes match current migrations. |
| MATCH | audit_logs | Columns, foreign keys, and declared indexes match current migrations. |
| MATCH | backup_records | Columns, foreign keys, and declared indexes match current migrations. |
| MATCH | branches | Columns, foreign keys, and declared indexes match current migrations. |
| MATCH | cash_denominations | Columns, foreign keys, and declared indexes match current migrations. |
| MATCH | cash_out_entries | Columns, foreign keys, and declared indexes match current migrations. |
| MATCH | catalog_options | Columns, foreign keys, and declared indexes match current migrations. |
| MATCH | daily_receipt_totals | Columns, foreign keys, and declared indexes match current migrations. |
| MATCH | daily_report_cash_counts | Columns, foreign keys, and declared indexes match current migrations. |
| MATCH | daily_report_deductions | Columns, foreign keys, and declared indexes match current migrations. |
| MATCH | daily_report_payment_entries | Columns, foreign keys, and declared indexes match current migrations. |
| MATCH | daily_reports | Columns, foreign keys, and declared indexes match current migrations. |
| MATCH | deduction_types | Columns, foreign keys, and declared indexes match current migrations. |
| MATCH | expense_categories | Columns, foreign keys, and declared indexes match current migrations. |
| MATCH | expense_entries | Columns, foreign keys, and declared indexes match current migrations. |
| MATCH | expenses | Columns, foreign keys, and declared indexes match current migrations. |
| MATCH | finance_account_items | Columns, foreign keys, and declared indexes match current migrations. |
| MATCH | finance_accounts | Columns, foreign keys, and declared indexes match current migrations. |
| MATCH | google_drive_snapshots | Columns, foreign keys, and declared indexes match current migrations. |
| MATCH | google_sheet_branch_cache | Columns, foreign keys, and declared indexes match current migrations. |
| MATCH | google_sheet_conflicts | Columns, foreign keys, and declared indexes match current migrations. |
| MATCH | google_sheet_imports | Columns, foreign keys, and declared indexes match current migrations. |
| MATCH | google_sheet_sources | Columns, foreign keys, and declared indexes match current migrations. |
| MATCH | in_house_payments | Columns, foreign keys, and declared indexes match current migrations. |
| MATCH | in_house_schedules | Columns, foreign keys, and declared indexes match current migrations. |
| MATCH | income_categories | Columns, foreign keys, and declared indexes match current migrations. |
| MATCH | income_entries | Columns, foreign keys, and declared indexes match current migrations. |
| MATCH | installment_activity_history | Columns, foreign keys, and declared indexes match current migrations. |
| MATCH | installment_contracts | Columns, foreign keys, and declared indexes match current migrations. |
| MATCH | installment_import_issues | Columns, foreign keys, and declared indexes match current migrations. |
| MATCH | installment_import_runs | Columns, foreign keys, and declared indexes match current migrations. |
| MATCH | installment_items | Columns, foreign keys, and declared indexes match current migrations. |
| MATCH | installment_payment_allocations | Columns, foreign keys, and declared indexes match current migrations. |
| MATCH | installment_restructures | Columns, foreign keys, and declared indexes match current migrations. |
| MATCH | installment_rule_terms | Columns, foreign keys, and declared indexes match current migrations. |
| MATCH | installment_rule_versions | Columns, foreign keys, and declared indexes match current migrations. |
| MATCH | installment_types | Columns, foreign keys, and declared indexes match current migrations. |
| MATCH | product_catalog_items | Columns, foreign keys, and declared indexes match current migrations. |
| MATCH | receipt_types | Columns, foreign keys, and declared indexes match current migrations. |
| MATCH | report_payment_methods | Columns, foreign keys, and declared indexes match current migrations. |
| MATCH | report_reconciliations | Columns, foreign keys, and declared indexes match current migrations. |
| MATCH | reports | Columns, foreign keys, and declared indexes match current migrations. |
| MATCH | schema_migrations | Columns, foreign keys, and declared indexes match current migrations. |
| MATCH | user_branch_assignments | Columns, foreign keys, and declared indexes match current migrations. |
| MATCH | users | Columns, foreign keys, and declared indexes match current migrations. |
| UNUSED | expense_categories | No non-migration TypeScript source reference found; static-analysis candidate only. |
| POSSIBLE REDUNDANCY | finance_account_items | Stored calculated/denormalized candidate(s): total_centavos. Confirm against service calculations before removal. |
| POSSIBLE REDUNDANCY | finance_accounts | Stored calculated/denormalized candidate(s): grand_total_centavos, balance_centavos. Confirm against service calculations before removal. |
| UNUSED | google_sheet_sources | No non-migration TypeScript source reference found; static-analysis candidate only. |
| UNUSED | income_categories | No non-migration TypeScript source reference found; static-analysis candidate only. |
| POSSIBLE REDUNDANCY | installment_contracts | Stored calculated/denormalized candidate(s): total_payable_centavos, down_payment_applied_centavos. Confirm against service calculations before removal. |
| POSSIBLE REDUNDANCY | installment_items | Stored calculated/denormalized candidate(s): item_total_centavos. Confirm against service calculations before removal. |
| POSSIBLE REDUNDANCY | installment_restructures | Stored calculated/denormalized candidate(s): outstanding_balance_centavos. Confirm against service calculations before removal. |
| UNUSED | installment_types | No non-migration TypeScript source reference found; static-analysis candidate only. |
| POSSIBLE REDUNDANCY | report_reconciliations | Stored calculated/denormalized candidate(s): cash_variance_centavos. Confirm against service calculations before removal. |
| UNUSED | schema_migrations | No non-migration TypeScript source reference found; static-analysis candidate only. |

## Views, triggers, and virtual tables

- Views: none.
- Triggers: none.
- Virtual tables: none.

## Standalone tables / relationship-orphan candidates

These tables have no declared incoming or outgoing foreign key. They are not necessarily unused or corrupt; most are independent configuration, synchronization, cache, backup, or migration metadata.

- `app_settings`
- `backup_records`
- `catalog_options`
- `google_drive_snapshots`
- `google_sheet_branch_cache`
- `google_sheet_conflicts`
- `google_sheet_imports`
- `google_sheet_sources`
- `product_catalog_items`
- `schema_migrations`

## Important schema risks

- SQLite enforces foreign keys only while each connection enables `PRAGMA foreign_keys = ON`; the app does so in `src/main/database/database.ts`.
- WAL mode uses `cashiers-report.db-wal` and `cashiers-report.db-shm` sidecars while active; copy/backup procedures must include them or use SQLite backup APIs.
- Several monetary totals are persisted alongside detailed rows. They are deliberate snapshots in some flows but are possible denormalization risks and must be reconciled through the business-rule calculation services.
- `audit_logs.entity_id` is polymorphic and has no foreign key, so it cannot prevent dangling entity references.
- Text identifiers are application/import generated; SQLite does not provide AUTOINCREMENT UUID generation.
