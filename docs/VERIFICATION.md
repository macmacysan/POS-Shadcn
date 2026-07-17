# Verification Rules

Use verification proportional to the change.

## By Change Type

- TypeScript logic: run the project type-check command.
- Calculation changes: run targeted unit tests.
- Form or component behavior: run relevant component or integration tests.
- Database changes: run migrations and targeted persistence tests.
- User workflow changes: run targeted Playwright tests.
- Styling changes: inspect affected screens at supported viewport sizes.
- Broad structural changes: run lint, tests, type checking, and the production build.
- High-risk changes: verify both success and failure paths.

## Frontend and Theme Verification

For UI changes:

- Fix avoidable `suggestCanonicalClasses` diagnostics.
- Confirm canonical Tailwind utilities are used where exact equivalents exist.
- Confirm no unnecessary arbitrary utilities were introduced.
- Confirm no conflicting, duplicated, or redundant classes remain.
- Confirm semantic theme tokens are used instead of hard-coded theme-sensitive values.
- Confirm changed components respond to global theme-variable changes.
- Run the configured formatter or Tailwind class sorter when available.
- Inspect affected screens at supported viewport sizes.

Use Chrome DevTools when runtime layout, rendering, console, network, or performance diagnosis is required.

## Completion Criteria

A task is complete only when:

- requested behavior is implemented
- acceptance criteria are satisfied
- relevant failure cases are handled
- applicable verification has passed
- no unrelated behavior was intentionally changed
- newly introduced warnings or errors are resolved
- remaining risks or unverified areas are reported