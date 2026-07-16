---
id: TASK-1
title: Redesign Activity as Installment History
status: In Progress
assignee: []
created_date: '2026-07-16 02:19'
updated_date: '2026-07-16 02:20'
labels:
  - frontend
  - audit
  - installments
dependencies: []
priority: high
type: feature
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace the existing Activity report tab with a read-only Installment History audit view for In-house Installment and Home Credit records. Preserve the existing persisted tab identifier where applicable and use a typed UI adapter until audit persistence exists.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The tab is labeled Installment History while preserving compatibility with the existing Activity identifier.
- [ ] #2 The table shows exactly Date & Time, Action, Source, Account, Activity, Amount, and Balance as primary columns with newest-first sorting.
- [ ] #3 Rows support mouse and keyboard selection, selected-row styling, and a full right-side detail inspector.
- [ ] #4 New, Edited, Deleted, payment-related, empty, loading, missing-value, long-text, and responsive states are represented.
- [ ] #5 Type checking, linting, relevant tests, and minimum-viewport visual inspection are completed.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extract a typed Installment History model and mock adapter for new, edited, deleted, and payment events; keep Activity as the internal tab value for compatibility. 2. Build a dedicated read-only history table with TanStack sorting/filtering, action/source filters, stable row selection, keyboard interaction, loading/empty/no-results states, truncation tooltips, and shared currency/date formatting. 3. Build a shadcn detail inspector with summary, event-specific snapshots/comparisons/payment details, independent scrolling, and responsive Sheet fallback. 4. Integrate the tab into the existing three-region report layout without changing other tabs or editable-entry behavior. 5. Add focused tests for sorting, selection, inspector content, edited changes, empty states, and money formatting; run typecheck, lint, tests, build, and visual QA at the minimum viewport.
<!-- SECTION:PLAN:END -->
