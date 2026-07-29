/goal

Use the UI Designer and UX Architect to audit and improve the entire Cashiers Report application from visual design through data integration.

The goal is to make the application enterprise-grade, consistent, reliable, and directionally inspired by Linear and Stripe while preserving the project’s own branding and workflows.

Do not treat this as a visual-only redesign. Review and fix the full implementation chain:

- page structure
- shared UI components
- navigation
- tables
- forms
- drawers and Sheets
- responsive behaviour
- accessibility
- frontend state
- IPC contracts
- repository usage
- database connections
- loading states
- empty states
- error handling
- data refresh
- persistence
- transactional writes
- business-rule enforcement

## Required Roles

Use only:

- UI Designer
- UX Architect

The UI Designer owns:

- visual hierarchy
- layout consistency
- typography
- spacing
- colour use
- borders
- density
- component styling
- responsive presentation
- cross-page consistency

The UX Architect owns:

- information architecture
- workflow clarity
- navigation
- page relationships
- account and payment flows
- table interactions
- form behaviour
- data dependencies
- loading and error states
- consistency between UI actions and backend behaviour

Do not use unrelated branding, marketing, copywriting, research, or product-strategy agents.

## Component Rules

All UI must use this priority:

1. Existing shared project components
2. Existing ReUI components
3. Install a compatible ReUI component when required
4. Existing shadcn/ui components
5. Custom implementation only when no suitable shared, ReUI, or shadcn component exists

Do not create custom versions of components already available in ReUI or shadcn.

Do not create duplicate systems for:

- Data Grid
- Table
- Sheet
- Drawer
- Dialog
- Tabs
- Accordion
- Dropdown Menu
- Select
- Combobox
- Date Picker
- Tooltip
- Badge
- Pagination
- Empty State
- Loading State
- Currency Input
- Confirmation Dialog

Use the installed ReUI and shadcn skills before editing.

Do not invent component APIs. Inspect existing project usage and official skill guidance first.

## Design Direction

The application should feel like a compact enterprise financial workstation.

Use Linear and Stripe only as directional references for:

- restrained hierarchy
- dense information layout
- subtle borders
- neutral surfaces
- compact controls
- clear primary actions
- efficient keyboard-friendly workflows
- reliable financial tables

Do not copy branding, proprietary layouts, or exact visual assets.

## Global Design Requirements

Standardise the application around:

- neutral white and grey surfaces
- restrained blue primary actions
- red only for destructive, overdue, blacklisted, or invalid states
- amber only for warnings
- green only for successful or reconciled states
- subtle borders
- minimal shadows
- fewer nested cards
- compact typography
- tabular financial values
- consistent row heights
- consistent spacing scale
- consistent panel radius
- consistent selected-row behaviour
- consistent empty, loading, and error states

Use shared typography tokens rather than page-specific font sizes.

Use shared spacing tokens rather than arbitrary local values.

Use shared money and date formatters across all pages.

## Pages and Areas to Audit

Audit and fix all implemented areas, including:

- Dashboard
- Daily Cashier Report
- Expenses
- Income
- Payments
- Installment History
- In-house Records
- Active Accounts
- Closed Accounts
- Blacklisted Accounts
- Finance Installments
- Account Details
- Add Account
- Add Loan
- Record Payment
- Installment Payment Workspace
- Reports
- Branches
- Cashiers
- Settings
- navigation sidebar
- summary sidebar
- shared tables
- forms
- Sheets
- dialogs
- pagination
- filters
- row actions

Do not redesign unimplemented modules without first confirming their required data model and entry points.

## Shared UI System

Consolidate repeated UI into shared components.

At minimum, review and standardise:

- application shell
- page header
- section header
- toolbar
- UniversalDataTable
- column sizing
- row actions
- selected-row state
- pagination
- table empty state
- table loading state
- Account Details panel
- form layout
- Sheet layout
- sticky Sheet footer
- money input
- date input
- status badge
- confirmation dialog
- error state
- not-found state
- loading skeleton

Prefer shared corrections over page-specific patches.

## Table Requirements

All major tables must use the shared ReUI Data Grid system.

Standardise:

- column headers
- column sizing
- row height
- borders
- hover state
- selected state
- sorting
- filters
- column visibility
- pagination
- virtualisation where needed
- internal scrolling
- right-aligned financial values
- fixed Actions column
- ellipsis and tooltip behaviour
- responsive horizontal scrolling

Do not create page-specific plain HTML tables when the shared Data Grid is appropriate.

## Workflow Requirements

Review the full user journey for:

- creating a customer
- creating a loan
- viewing an account
- recording a payment
- viewing a ledger
- closing an account
- blacklisting an account
- reopening or restoring an account when supported
- adding expenses
- adding income
- reconciling daily cash
- filtering and exporting records

Each visible action must:

- connect to a real route, Sheet, dialog, or backend action
- have loading and failure feedback
- respect current account status
- prevent duplicate submission
- preserve data integrity
- refresh affected views after success

Do not leave visible actions that are disconnected, placeholder-only, or unsupported by the backend.

## Dashboard and Summary Connections

Audit every dashboard and summary value.

For each displayed number, identify:

- source table
- repository query
- IPC method
- renderer hook or selector
- refresh trigger
- empty state
- error state
- date and branch scope
- account-status scope
- whether the value is stored or derived

Fix any values that are:

- hardcoded
- duplicated
- stale
- calculated differently across pages
- not filtered by branch
- not filtered by date
- not updated after writes
- sourced from browser-only state
- disconnected from SQLite

Use a single source of truth for shared financial calculations.

Do not duplicate business calculations in multiple renderer components.

## Database and IPC Audit

Inspect:

- database documentation
- migrations
- SQLite schema
- repositories
- transaction boundaries
- IPC handlers
- preload bridge
- shared contracts
- renderer data hooks
- refresh and invalidation behaviour

Confirm that:

- all money uses integer centavos
- IDs follow the project standard
- foreign keys are enforced
- indexes exist for major filters and joins
- writes are transactional
- duplicate submissions are idempotent where required
- soft-deleted, voided, closed, and blacklisted states are handled consistently
- renderer types match backend contracts
- no page relies on localStorage for authoritative business data
- no visible totals are manually maintained when they can be derived safely
- no disconnected mock data remains in production paths

Do not modify the database schema unless a clear, documented gap requires it.

Any schema change must include:

- migration
- repository update
- typed contract update
- IPC update
- renderer integration
- targeted verification
- documentation update

## Error, Loading, and Empty States

Every data-backed page must have distinct states for:

- loading
- empty
- not found
- generic load failure
- permission or status restriction
- save in progress
- save failure
- retry

Do not show a generic error for not-found records.

Do not leave blank panels when data is missing.

## Responsive Behaviour

Verify at minimum:

- 1366×768
- 900×670

Requirements:

- no page-level overflow
- tables scroll internally
- important monetary columns remain visible
- right-side panels become Sheets when necessary
- sticky headers and footers remain accessible
- forms remain usable without clipped fields
- navigation hierarchy remains clear

Do not convert enterprise tables into mobile cards.

## Accessibility

Verify:

- keyboard navigation
- visible focus states
- semantic labels
- accessible icon buttons
- tooltip support for truncated values
- colour contrast
- status communication that does not rely only on colour
- dialog and Sheet focus management
- correct button disabled states
- table selection behaviour

## Implementation Strategy

Do not attempt an uncontrolled full-app rewrite.

First produce one consolidated audit containing:

1. Shared-system issues
2. Page-specific issues
3. Broken or missing data connections
4. Database and IPC risks
5. The highest-impact inconsistencies
6. Exact shared components to change
7. Exact pages affected
8. Required backend changes, if any
9. Verification plan

Then create a phased implementation plan.

Use no more than six phases.

Recommended phase order:

1. Shared design tokens and application shell
2. Shared Data Grid, pagination, and row interactions
3. Shared forms, Sheets, dialogs, and Account Details
4. Dashboard and Daily Cashier Report data connections
5. Installment account and payment workflows
6. Remaining pages, responsive polish, and final consistency audit

Implement one phase at a time.

Do not start the next phase until the current phase passes targeted verification.

## Verification Rules

For each phase, run only relevant checks:

- TypeScript typecheck
- focused ESLint and formatting
- targeted repository or IPC tests
- targeted Electron Playwright tests
- Electron visual inspection at supported sizes

Do not run the full Playwright suite for every small change.

Run the full suite only:

- after a major shared-system change
- when targeted tests reveal a wider regression
- at the final application-wide verification stage

## Completion Criteria

The work is complete only when:

- all implemented pages use a consistent shared UI system
- all major UI actions are connected
- all dashboard and summary values come from real data
- all tables use the shared ReUI Data Grid where appropriate
- all forms use ReUI or shadcn components
- all writes have loading, validation, and error handling
- all financial values use shared centavo-safe calculations
- all relevant pages pass targeted Electron validation
- no disconnected mocks, placeholders, or dead controls remain
- database, IPC, renderer, and documentation remain aligned

Do not make unrelated changes.

Do not rewrite verified business logic without a documented defect.

Return a concise report after each phase with:

- files changed
- shared components changed
- data connections fixed
- backend changes
- verification performed
- remaining issues