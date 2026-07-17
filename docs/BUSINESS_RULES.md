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

## Rule Changes

- Verify the authoritative business definition before changing a formula based on a label, layout, or user-interface request.
- Changes to expected cash, remitted cash, ending cash, variance, deductions, payments, or reconciliation totals must update the authoritative calculation module.
- Keep display, validation, persistence, and reporting behavior consistent after any rule change.