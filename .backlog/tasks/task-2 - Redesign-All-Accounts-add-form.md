---
id: TASK-2
title: Redesign All Accounts add form
status: In Progress
assignee: []
created_date: '2026-07-16 06:10'
updated_date: '2026-07-16 08:48'
labels:
  - frontend ui
dependencies: []
type: enhancement
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Improve the All Accounts Add Account form for clearer grouping, faster data entry, and better responsive behavior while preserving existing account fields, validation, and save behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All existing fields, validation messages, dynamic contact/email controls, and save/cancel behavior remain functional.
- [ ] #2 The form has a scrollable body and persistent action footer with accessible labels and focus states.
- [ ] #3 The redesign is verified with type checking, linting, build, and visual inspection at desktop and narrow widths.
- [ ] #4 The Add Account form uses a shadcn Drawer: right-side at desktop and bottom on narrow widths, with its grouped two-column layout stacking responsively.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Preserve the existing Add Account drawer and account data behavior. 2. Apply Activity Summary's section-heading typography, semantic colors, divided two-column rows, spacing, and value alignment to Account Summary, Address, Contact Information, and Other Information. 3. Preserve multiple contact/email values, Primary indicators, missing-value fallbacks, and the existing account header. 4. Run focused lint and renderer type-check, review the diff, and visually compare desktop and narrow account inspectors.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented grouped responsive form sections, responsive contact/email layout, wider Add Account sheet, and persistent action footer. Targeted ESLint passed. Web typecheck passed with noUnusedLocals disabled; standard typecheck and build are blocked by the pre-existing unused ArrowUpDown import in src/renderer/src/components/installment-history-table.tsx. Full visual browser inspection was not completed because the Electron dev server was stopped before a browser page could connect.

Reworked the account form, inspector, and accounts content to compose the installed shadcn Field, Select, ScrollArea, InputGroup, Empty, Card, CardHeader, CardContent, and CardFooter primitives. The domain-only src/renderer/src/lib/in-house-accounts.ts remains UI-agnostic. Targeted ESLint and web type-check pass; full repository type-check remains blocked by the pre-existing unused ArrowUpDown import in installment-history-table.tsx. Visual inspection and production build remain outstanding.

Matched the Account Summary header to Activity details by using the same text-sm font-semibold typography and title casing. Focused ESLint passed and git diff --check found no whitespace errors. Runtime visual inspection remains outstanding with the broader task.

Applied the Activity Summary body theme to all account inspector sections. Section headings now share the same semibold uppercase foreground typography and spacing; detail/contact rows use divided two-column definition lists with muted labels and right-aligned medium values. Existing account header, Primary indicators, multiple values, and missing-value fallbacks are preserved. Focused ESLint and git diff --check passed. Renderer typecheck remains blocked by pre-existing errors in installment-history-table.tsx:2 and in-house-accounts.ts:68,91,109; no error points to the inspector. Runtime visual inspection remains outstanding.
<!-- SECTION:NOTES:END -->
