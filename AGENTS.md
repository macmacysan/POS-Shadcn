# Cashiers Report — Engineering Instructions

## Project

Cashiers Report is an Electron desktop application built with React and TypeScript.

The application supports:

* daily cashier reports
* cash reconciliation
* receipts, income, expenses, and payments
* finance and in-house installments
* branches, cashiers, and administrators
* date-based report records
* local database persistence

Preserve existing business behavior unless the active task explicitly changes it.

## Instruction Scope

* This file contains repository-wide rules.
* Before editing a file, read this file and any nearer `AGENTS.md` governing that file.
* A child `AGENTS.md` may specialize rules for its subtree but must not repeat the entire parent file.
* Read applicable instructions once per task.
* Re-read them only when the working scope changes or an instruction file is modified.
* Do not recursively scan the repository merely to discover instructions.

## Task Source

For non-trivial work:

1. Read the relevant Backlog.md task.
2. Confirm its acceptance criteria, constraints, dependencies, and exclusions.
3. Implement only the requested scope.
4. Update the task with completed verification when appropriate.

Do not place temporary feature requirements or implementation history in `AGENTS.md`.

## Working Method

* Inspect before editing.
* Prefer symbol and reference search over opening complete directories.
* Use Serena to locate symbols, references, callers, types, and affected tests.
* Read only the code necessary to understand the change.
* Expand the search scope only when current evidence is insufficient.
* Do not scan the entire repository unless the task is explicitly repository-wide.
* Prefer the smallest complete change that satisfies the acceptance criteria.
* Do not refactor unrelated code during a focused task.
* Report material unrelated problems separately.

## Risk-Based Workflow

Use workflow depth proportional to the task.

### Low risk

Examples:

* copy changes
* spacing adjustments
* icon changes
* isolated styling fixes
* straightforward one-file corrections

Proceed with direct inspection, implementation, and targeted verification.

### Medium risk

Examples:

* new components
* form behavior
* table sorting and filtering
* shared state changes
* cross-component UI workflows
* reusable hooks or utilities

Inspect dependencies, identify affected flows, implement incrementally, and run targeted tests.

### High risk

Examples:

* financial calculations
* authentication or authorization
* database schema changes
* migrations
* report submission
* Electron IPC
* destructive operations
* large cross-module refactors

Use a structured Superpowers planning, implementation, debugging, and verification workflow.

Do not invoke every Superpowers skill for low-risk work.

## Architecture Boundaries

### Renderer

* Renderer components must not directly access Node.js, the filesystem, SQLite, environment secrets, or privileged Electron APIs.
* Use the established typed preload and IPC interfaces.
* Keep UI components focused on presentation and interaction.
* Move reusable business logic into dedicated modules, hooks, services, or calculation utilities.
* Avoid placing large amounts of domain logic inside page components.

### Preload and IPC

* Expose the smallest required API surface.
* Use explicit, typed request and response contracts.
* Validate untrusted input at the IPC boundary.
* Do not expose generic filesystem, shell, database, or process access to the renderer.
* Keep channel names centralized.
* Return structured errors rather than raw internal exceptions.

### Main process and persistence

* Main-process code owns privileged desktop operations.
* Database access must remain outside renderer components.
* Use transactions for multi-step financial or report-submission operations.
* Implement schema changes through migrations.
* Do not manually modify persisted production data as a substitute for a migration.
* Destructive database operations require explicit task scope and safeguards.

## Business Rules

* Treat financial calculations as business-critical.
* Keep each formula in one authoritative calculation module.
* Do not duplicate calculations in components, tables, sidebars, and submission handlers.
* Reuse the same calculation functions for display, validation, persistence, and tests.
* Preserve current rounding and money representation unless the task explicitly changes them.
* Do not silently substitute missing monetary values with assumptions that alter totals.
* Validate report identity using the established branch, cashier, and business-date rules.
* Changes to expected cash, remitted cash, ending cash, variance, deductions, or payment totals require targeted tests.
* Do not change a formula based only on visual labels; verify its defined business rule first.

## React and TypeScript

* Keep TypeScript strict and avoid unnecessary `any`.
* Prefer explicit domain types over loosely shaped objects.
* Reuse existing types before creating similar alternatives.
* Keep state as close as practical to the components that own it.
* Derive values instead of storing duplicate calculated state.
* Avoid effects for values that can be calculated during rendering.
* Avoid premature memoization.
* Memoize only when rendering cost or reference stability requires it.
* Use stable identifiers for rows; do not use array indexes as persistent keys.
* Do not mutate state directly.
* Extract large components when they contain distinct responsibilities, not merely to reduce line count.

## shadcn/ui

Use the installed shadcn skills when adding or substantially changing interface components.

### Component selection

* Search the existing project components before adding a new shadcn component.
* Prefer existing project wrappers and shared primitives.
* Use shadcn patterns as implementation foundations, not as a separate visual theme.
* Add only the specific components required by the task.
* Do not install large groups of unused components.

### Styling

* Use semantic theme tokens rather than hard-coded colors.
* Use the existing Tailwind and shadcn token system.
* Preserve light and dark theme compatibility when both are supported.
* Avoid arbitrary values when an existing spacing, radius, typography, or color token is suitable.
* Do not add inline styles unless a value is genuinely dynamic.
* Do not introduce a second theming system.
* Do not override shared shadcn primitives locally when a reusable variant is more appropriate.

### Component behavior

* Preserve keyboard navigation and visible focus states.
* Form controls require associated labels or equivalent accessible names.
* Icon-only buttons require accessible labels and tooltips when their purpose is not obvious.
* Dialogs, popovers, dropdowns, calendars, and sheets must handle focus correctly.
* Use destructive styling only for destructive actions.
* Do not use dialogs for interactions that can be completed inline.
* Avoid nested scroll containers unless the workflow requires them.

### Tables and dense workstation UI

* Optimize tables for scanning, entry speed, and monetary comparison.
* Keep monetary values right-aligned.
* Use consistent column alignment and widths.
* Keep headers distinct without excessive decoration.
* Do not hide essential actions only on hover.
* Ensure action columns remain inside the table viewport.
* Use pagination or virtualization for large datasets.
* Do not render thousands of rows directly.
* Preserve keyboard-friendly cashier workflows.
* Sorting and filtering must not modify persisted source order unless explicitly intended.

## Design System

Follow the project design-system documents when they exist.

General rules:

* Prefer a restrained accounting-workstation interface over decorative dashboard styling.
* Maintain clear visual hierarchy with minimal card nesting.
* Use consistent typography, spacing, row heights, borders, and control sizes.
* Keep primary actions obvious and secondary actions quiet.
* Avoid excessive gradients, shadows, rounded containers, badges, and competing accent colors.
* Do not invent new visual patterns when an existing project pattern solves the same problem.
* Support the project's intended minimum viewport without clipped controls or inaccessible content.
* Critical totals and reconciliation status must remain visible and readable.
* Do not reduce usability merely to fit more information on screen.

## Forms and Data Entry

* Optimize common cashier actions for minimal clicks and predictable keyboard movement.
* Maintain clear tab order.
* Use appropriate input types and formatting.
* Validate at field, form, IPC, and persistence boundaries as appropriate.
* Preserve entered data when validation fails.
* Show actionable validation messages near the relevant field.
* Disable submission only when the user can understand why.
* Prevent accidental duplicate submission.
* Do not clear a successful entry form until persistence is confirmed.
* Dates must follow the application's business-date rules rather than relying blindly on system time.

## Performance

* Measure before performing broad optimization.
* Avoid unnecessary re-renders in large tables and entry modules.
* Debounce expensive search operations where appropriate.
* Use pagination, windowing, or virtualization for large datasets.
* Keep filters and sorting deterministic.
* Move expensive transformations out of repeated render paths.
* Add database indexes only for demonstrated query patterns.
* Do not introduce complexity for negligible performance benefit.

Use performance-analysis tooling when there is measurable slowness, a regression, or a known high-volume workflow.

## Security

* Treat administrator and cashier permissions as enforced application rules, not merely hidden UI.
* Enforce authorization in privileged handlers and persistence operations.
* Do not expose secrets, raw database handles, unrestricted IPC, or filesystem access to the renderer.
* Sanitize and validate imported or externally supplied data.
* Avoid logging sensitive user or financial data.
* Review authentication, authorization, IPC, imports, exports, and backups as high-risk changes.

## Dependencies

* Prefer existing dependencies and platform capabilities.
* Add a dependency only when it materially reduces complexity or risk.
* Check the installed version and existing project usage before consulting external documentation.
* Use Context7 or official documentation only for version-sensitive or unfamiliar APIs.
* Do not replace an established library without explicit task scope.
* Do not modify the lockfile unless dependency changes require it.

## Files

Do not edit unless explicitly required:

* generated files
* build output
* coverage output
* dependency directories
* temporary files
* packaged application artifacts

Do not create duplicate components, utilities, calculation modules, or types simply to avoid understanding existing code.

## Documentation

Update documentation only when a durable contract becomes inaccurate.

Appropriate reasons include:

* architecture boundaries changed
* required commands changed
* a stable business rule changed
* a persistent workflow changed
* a directory gained materially different engineering rules
* a public IPC, data, or component contract changed

Do not update `AGENTS.md` for:

* routine implementation details
* temporary plans
* one-off UI decisions
* progress logs
* completed-task history
* personal conversation preferences
* minor code changes that do not alter durable rules

Create a child `AGENTS.md` only when a subtree has stable rules that materially differ from this file.

## Verification

Run the smallest relevant verification set.

### Always

* Review the changed diff.
* Check for unintended modifications.
* Confirm the task acceptance criteria.

### By change type

* TypeScript logic: run the existing type-check command.
* Calculation changes: run targeted unit tests.
* Form or component behavior: run relevant component or integration tests.
* Database changes: run migrations and targeted persistence tests.
* User workflow changes: run targeted Playwright tests.
* Styling changes: inspect the affected screen at supported viewport sizes.
* Broad structural changes: run lint, tests, type checking, and production build.
* High-risk changes: verify failure paths as well as successful paths.

Use Chrome DevTools when runtime layout, rendering, network, memory, or console diagnosis is required.

Use Fallow after substantial refactors or architecture changes, not after every small edit.

Do not claim that a command, test, build, or visual check passed unless it was actually completed successfully.

## Completion

A task is complete only when:

* the requested behavior is implemented
* acceptance criteria are satisfied
* relevant failure cases are handled
* applicable verification has passed
* no unrelated behavior was intentionally changed
* newly introduced warnings or errors are resolved
* remaining risks or unverified areas are reported clearly

Summarize:

* behavior changed
* main files affected
* verification performed
* unresolved risks or follow-up work

## Skills
* Always use Context7 when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask.

<!-- BACKLOG.MD GUIDELINES START -->
<!-- backlog.md-instructions-version: 1.48.0 -->
<CRITICAL_INSTRUCTION>

## Backlog.md Workflow

This project uses Backlog.md for task and project management.

**For every user request in this project, run `backlog instructions overview` before answering or taking action.**

Use the overview to decide whether to search, read, create, or update Backlog tasks.

Before task lifecycle actions, read the matching detailed guide:
- `backlog instructions task-creation` before creating or splitting tasks
- `backlog instructions task-execution` before planning, changing status or assignee, adding a plan or implementation notes, or implementing task work
- `backlog instructions task-finalization` before checking acceptance criteria, writing final summaries, or moving tasks to terminal statuses

Use `backlog <command> --help` before running unfamiliar commands. Help shows options, fields, and examples.

Do not edit Backlog task, draft, document, decision, or milestone markdown files directly. Use the `backlog` CLI so metadata, relationships, and history stay consistent.

</CRITICAL_INSTRUCTION>
<!-- BACKLOG.MD GUIDELINES END -->
