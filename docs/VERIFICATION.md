# Verification Rules

Use the lightest verification that can reliably validate the change.

Do not run broad test suites, Playwright, production builds, or full-project checks for small isolated changes unless the task explicitly requires them or the change affects a critical workflow.

## Verification Tiers

### Tier 1 — Small isolated change

Examples:

- copy changes
- icon changes
- spacing adjustments
- color or typography changes
- canonical Tailwind class fixes
- isolated one-file styling corrections

Required verification:

- inspect the changed file
- run formatter or lint only if the edited file requires it
- perform a targeted visual check when practical

Do not run:

- Playwright
- full test suite
- production build
- repository-wide type check

### Tier 2 — Local functional change

Examples:

- form interaction
- local state behavior
- table sorting or filtering
- reusable component changes
- drawer open or close behavior
- validation behavior

Required verification:

- run the narrowest relevant type check, test, or component check available
- inspect the affected screen or interaction

Run Playwright only when:

- the change affects a complete user workflow
- the behavior cannot be reliably checked with a smaller test
- an existing targeted Playwright test already covers the exact flow

### Tier 3 — High-risk or broad change

Examples:

- financial calculations
- authentication or authorization
- Electron IPC
- persistence
- migrations
- report submission
- destructive operations
- cross-module refactors

Required verification:

- targeted tests for affected logic
- relevant integration tests
- type checking
- failure-path verification
- Playwright only for affected end-to-end workflows
- production build only when the change affects packaging, build configuration, preload, IPC, or broad application structure

## Frontend and Theme Verification

For UI changes:

- fix avoidable `suggestCanonicalClasses` diagnostics
- confirm no unnecessary arbitrary utilities were introduced
- confirm no conflicting or duplicate classes remain
- confirm semantic theme tokens are used
- inspect only the affected viewport and component

Do not run Playwright for purely visual changes unless the task explicitly requests automated visual verification.

## Completion Criteria

A task is complete when:

- requested behavior is implemented
- the smallest appropriate verification passed
- relevant failure cases were considered
- no unrelated behavior was intentionally changed
- remaining risks or unverified areas are reported