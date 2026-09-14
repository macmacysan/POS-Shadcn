---
target: entire renderer UI
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:E:\\Development\\POS-Shadcn\\src\\renderer\\src"
timestamp: 2026-09-14T03-26-35Z
slug: src-renderer-src
---
## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of system status | 3 | Strong skeletons and notifications, but some raw error copy persists. |
| 2 | Match system / real world | 3 | Financial language fits, but information architecture drifts in places. |
| 3 | User control and freedom | 3 | Cancel and confirmations exist; common edits lack undo. |
| 4 | Consistency and standards | 3 | Good shared table base; feature-level surface and control deviations remain. |
| 5 | Error prevention | 3 | Validation and destructive confirmations are present; review decisions need stronger guardrails. |
| 6 | Recognition rather than recall | 3 | Labels, tooltips, and visible data help; dense workspaces retain too much context. |
| 7 | Flexibility and efficiency | 2 | Sorting, filters, and column controls exist; no discoverable shortcuts or broad bulk flow. |
| 8 | Aesthetic and minimalist design | 2 | Compact tables work, but pastel framing, hard shadows, repeated cards, and badges compete. |
| 9 | Error recovery | 3 | Table retry and field errors are strong; recovery is uneven elsewhere. |
| 10 | Help and documentation | 1 | No contextual help for reconciliation or finance terminology. |
| **Total** | | **26/40** | **Acceptable — functionally strong, visually and operationally inconsistent.** |

## Design Specificity Verdict

The renderer is partly authored for cashier reconciliation: persistent summaries, compact tables, branch/status cues, and ledger workflows are product-specific. But its global visual language is conflicted. `main.css` uses pastel pink/yellow/teal surfaces and hard 3px offset shadows, which reads as a playful neo-brutalist template rather than the restrained financial workstation described in `docs/DESIGN.md`.

The deterministic scan found one warning and no errors: `side-tab` at `src/renderer/src/features/dashboard/components/dashboard-content.tsx:217` (`border-l-4`). It may be an intentional status accent; the detector cannot establish visual intent. Browser evidence was unavailable: this Electron renderer has no running, reachable local renderer URL and no fixed configured port. No overlay or live server was used.

## What's Working

- `UniversalDataTable` is genuinely workstation-appropriate: compact geometry, sticky headers, stable skeletons, pagination, truncated-value affordances, and row actions.
- The dashboard's cash position makes physical cash, expected cash, remitted cash, and variance adjacent and scannable.
- Cashier reports handle interruption and failure thoughtfully with dirty-tab protection, delivery progress, retry, review, and export paths.

## Priority Issues

1. **[P1] Art direction contradicts the product contract.** The global pink borders and hard-offset shadows in `main.css` undermine financial trust and contradict the specified subtle borders and minimal shadows. **Fix:** rebase background, card, border, and shadow tokens to near-neutral surfaces with low-contrast separators; preserve branch/status color only as sparse semantic cues. **Suggested command:** `$impeccable colorize` followed by `$impeccable polish`.
2. **[P1] Cash risk has no dominant resolution path.** `DashboardContent` can flag variance, but Export and Refresh remain more immediate than a clearly labeled reconciliation action. **Fix:** when variance is non-zero or a report is pending, show one primary action such as “Review cashier reports” beside cash position; demote ancillary actions. **Suggested command:** `$impeccable shape`.
3. **[P2] Shared workstation conventions are bypassed.** `WorkstationShell`, `WorkstationSurface`, and `TaskSheet` coexist with bespoke grids, cards, raw sheets, and dialogs. This drifts spacing, radius, headers, and action footers. **Fix:** standardize compatible surfaces and short forms around the existing wrappers; keep genuinely complex workspaces distinct. **Suggested command:** `$impeccable extract`.
4. **[P2] Too many controls are persistent at once.** Cashier reports and account records combine tabs, badges, filters, columns, calculators, export, drawers, and activity actions in the same visual tier. **Fix:** retain one state-dependent primary action; put low-frequency controls into one overflow; keep only risk state and active filters persistent. **Suggested command:** `$impeccable distill`.
5. **[P2] High-stakes recovery and explanation are uneven.** Tables retry well, but `InstallmentOverviewContent` only renders an error and raw caught messages can surface. Domain terms have no situated explanation. **Fix:** use safe error-copy mapping plus inline Retry everywhere; explain variance, restructure, and report-delivery scope where the decision occurs. **Suggested command:** `$impeccable harden` and `$impeccable clarify`.

## Persona Red Flags

- **Alex (power user):** no source evidence of keyboard shortcuts, command access, or broad bulk workflows. Daily tasks rely on pointer-heavy tabs, dialogs, and row actions.
- **Jordan (first-timer):** variance, remitted cash, restructure, and status terms are correct but unexplained. The risk state does not always say what safe next action is required.
- **Sam (accessibility-dependent):** many controls have labels and focus support, but hover-driven cashier-tab preview, compact controls, color/status reliance, and unverified async announcements are risks.

## Minor Observations

- The generic `Documents` breadcrumb in `App.tsx` weakens location clarity for specialized finance views.
- Poppins paired with decorative hard shadows does not support the compact, trustworthy operational tone.
- Some metric cards reveal clickability chiefly through hover/focus instead of visible affordance.
- The installment overview is noticeably more card-heavy than the rest of the workstation.

## Questions to Consider

- If the dashboard's main question is “Can today’s cash close safely?”, why are Export and Refresh more immediate than resolving a variance?
- Which status cues require color, and which would be clearer through language, ordering, and one risk queue?
- Can Cashier Reports be a calm reconciliation queue first and an entry editor second?
