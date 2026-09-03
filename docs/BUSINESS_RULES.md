# Business and Financial Rules

Applies to calculations, report identity, reconciliation, payments, deductions, and persisted financial totals.

## Financial Calculations

- Treat all financial calculations as business-critical.
- Keep each formula in one authoritative calculation module.
- Reuse the same calculation functions for display, validation, persistence, and reporting.
- Do not duplicate formulas in components, tables, sidebars, forms, or submission handlers.
- Preserve the established money representation, precision, and rounding rules unless explicitly changed.
- Perform rounding only at the defined business-rule boundary; do not introduce component-specific rounding.
- Do not silently substitute missing monetary values with assumptions that alter totals.
- Do not derive persisted financial totals from formatted display strings.

## Business Identity

- Validate reports using the established branch, cashier, and business-date identity rules.
- Do not rely on visual labels or UI state as the authoritative source of report identity.
- Preserve existing uniqueness and ownership rules unless the task explicitly changes them.
- A report `business_date` identifies the cashier's reporting day. A financial row's `transaction_date` identifies when the transaction occurred. `created_at` identifies when the row was persisted; these values must not be substituted for one another.

## Database calculation contract

- All money persisted in SQLite is integer centavos. IDs are `TEXT` UUID/ULID values; dates are `YYYY-MM-DD`; timestamps are ISO-8601 UTC strings.
- Item total = quantity × unit price. Contract-level financed amount and total payable are stored at contract creation; installment balance, provider balance, total paid, next due, and due amount are calculated from active contract rows, posted payments, allocations, schedules, and settlements.
- Expected cash = opening cash + posted cash receipts + posted cash income − posted deductions − posted cash-outs.
- Physical cash counted = sum of denomination value × counted quantity. Cash variance = physical cash counted − expected cash. Cash remitted is the stored amount actually remitted and is distinct from both expected and physical cash.
- Sidebar totals are projections of these calculations and are not independent database fields.
- Posted income, expenses, daily-report payment entries, installment payments, and settlements are voided rather than deleted. Void rows are excluded from calculations.

## Rule Changes

- Verify the authoritative business definition before changing a formula based on a label, layout, or user-interface request.
- Changes to expected cash, remitted cash, ending cash, variance, deductions, payments, or reconciliation totals must update the authoritative calculation module.
- Keep display, validation, persistence, and reporting behavior consistent after any rule change.

## Calculations

# Cash Receipts Summary Sidebar
Total Cash Receipts = SUM ((Sum of Cash Receipts Amount), Collections, Other Income, Financing Downpayment)
Total Cash Paid Out = SUM (Company Expenses, Deductions, Drawings, Purchases, Receivables)
Total Payments Received = SUM (Bank Check, Bank Transfer, GCash, Other e-wallet, e.g)
Expected Cash = Total Cash Receipts - Total Cash Paid Out - Total Payments Received
Cash Variance = SUM(Cash Denominations) - Expected Cash

