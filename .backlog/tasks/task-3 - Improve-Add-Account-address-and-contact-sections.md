---
id: TASK-3
title: Improve Add Account address and contact sections
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-16 07:01'
updated_date: '2026-07-16 08:38'
labels:
  - frontend accounts psgc
dependencies: []
priority: medium
type: enhancement
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace free-text geographic fields with offline PSGC-backed cascading searchable comboboxes while preserving the existing account submission workflow. Add deferred optional telephone rows without changing existing contact business rules.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Region, Province, City/Municipality, and Barangay use searchable cascading comboboxes backed by bundled official Philippine PSGC data.
- [ ] #2 Each selected geographic value preserves both PSGC code and display name in the saved payload, and existing saved records still render correctly.
- [ ] #3 Parent changes clear incompatible child selections and child comboboxes remain disabled until their parent is selected.
- [ ] #4 Street/Subdivision remains a free-text field in a responsive two-column address layout.
- [ ] #5 Telephone is optional, initially hidden behind '+ Add telephone number', removable per row, and absent/null values do not block submission; multiple existing telephone values remain supported.
- [ ] #6 Targeted verification confirms cascading resets, barangay search/empty state, offline data availability, payload codes/names, and unchanged account creation behavior.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Preserve the existing Task-3 address and contact behavior while limiting this follow-up to the Add Account UI. 2. Consolidate Add Contact, Add telephone, and Add Email into one responsive single-line action row with semantic button hierarchy. 3. Remove the visible side-drawer bleed using the drawer's local bleed-background variable. 4. Run renderer typecheck, lint the touched files, review the focused diff, and visually verify desktop/mobile drawer behavior.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Removed the Region entry field; Province now searches the full PSGC province set and derives the saved region. Corrected Base UI combobox item filtering and collection rendering, with first-match keyboard highlighting enabled.

Add Account drawer polish: consolidated Add Contact, Add telephone, and Add Email into one non-wrapping action row; emphasized Add Contact with the existing link variant while optional actions inherit muted semantic text; made the drawer bleed background transparent to remove the white side strip. Verification: focused ESLint exited 0 with one pre-existing Prettier warning at in-house-account-form.tsx:400; git diff --check found no whitespace errors. Renderer typecheck remains blocked by pre-existing errors in installment-history-table.tsx:2 and in-house-accounts.ts:68,91,109. Runtime visual verification was not available in this session, so no acceptance criteria were checked.
<!-- SECTION:NOTES:END -->
