# Cashiers Report design contract

Cashiers Report is a local-first financial workstation. A cashier closing a report needs to identify the branch, cashier and business date, compare cash figures, resolve exceptions and find the next permitted action. Give the active ledger or form the most space. Use Linearâ€™s compact navigation, Attioâ€™s alignment of comparable records and Stripeâ€™s clarity around financial outcomes as references. Use Cashiers Reportâ€™s own components, copy and theme.

## Ownership

- This contract governs presentation. Preserve calculations, precision, conditional fields and rows, permissions, branch and ownership boundaries, IPC, persistence, data contracts and workflow order. Use existing action eligibility and confirmation paths, including voiding posted financial entries. See [business rules](BUSINESS_RULES.md).
- Follow the projectâ€™s reuse order: shared project component â†’ existing compatible ReUI component â†’ justified ReUI installation â†’ existing shadcn/ui component â†’ justified shadcn/ui installation â†’ custom implementation if none fits. Retain stable components. Check API fit, keyboard behavior and theme support before adopting a library example.
- Shared components own visual variants, sizes and states. Features own their content and composition. Extend a shared variant for a recurring need. Keep one-off color, type, radius and control-size overrides out of feature code. See [frontend conventions](FRONTEND.md).

## Theme, typography and density

Use the active global variables from `src/renderer/src/assets/main.css` in both light and dark mode, including sidebar, menus, dialogs and notification portals. Geist is the bundled default sans; components use the active font tokens so a TweakCN font preset replaces it without component edits. Pair surface roles with their foregrounds (for example, `bg-popover text-popover-foreground` and `bg-primary text-primary-foreground`). Use workspace aliases for panes, input and ring tokens for controls, and status and branch tokens for domain meaning. Define project-only roles centrally for both modes. Bind font, tracking, spacing, radius and shadow utilities to the active variables. A TweakCN preset change must propagate without component edits or a reload of the view. Fix a failing pair at its shared owner. Feature-local palettes, literal theme colors and fixed font families bypass this contract.

| Role | Type size / line height at default scale | Treatment |
| --- | --- | --- |
| Page title | `text-lg`, 18/24px | Theme heading family, semibold |
| Dialog or drawer title | `text-base`, 16/24px | Heading, semibold |
| Pane or section title | `text-sm`, 14/20px | Heading, medium |
| Field label, control, entered value | `text-sm`, 14/20px | Theme sans, foreground for values, muted placeholders |
| Table cell, metadata, helper | `text-xs`, 12/16px | Foreground for primary data, muted foreground for supporting text |

Use `tabular-nums` for comparable figures and the theme mono face for identifiers that need fixed widths. Use spacing units 1/2/3/4/6 (4/8/12/16/24px at the default theme) for label-to-field, within a control group, between workspace elements, between fields and between major sections respectively. Financial summary rows are 24â€“28px, compact table rows 28â€“32px and interactive rows 32â€“36px. Let controls and rows grow for content and text enlargement.

## Surface roles

- Use the active background and foreground for workspace panes, ledgers, toolbars and pagination. Keep a sticky table header opaque. The title bar and table headers use the subtle workspace role, a restrained mix of the background and muted tokens. Use borders for separation.
- Navigation uses the preset sidebar pair, independent cards use the card pair, and floating layers use the popover pair. Keep monetary amounts in the foreground, use weight for totals and reserve status text for meaningful exceptions.

## Workspace and navigation

- The authenticated root workspace is full-bleed: it fills the available window content with no inset margin, rounded outer corners, surrounding border or shadow. Do not wrap the root app in a card or `WorkstationSurface`. Integrate the sidebar, title bar and workspace directly, separated only by semantic borders. Keep `WorkstationShell` for page-level layout and `WorkstationSurface` for independent work areas. Independent panes and dialogs may use one rounded boundary (`rounded-xl`), standalone surfaces such as sign-in may use `rounded-2xl`, and controls use `rounded-md`; all radii follow the global token. Preserve native window controls and drag regions.
- Inside a pane, group related amounts in aligned rows with a single separator before a total. Use spacing before adding borders. Reserve elevation for overlapping layers. KPI cards are suitable for independent dashboard metrics, not related amounts in a calculation or reconciliation. Omit decorative gradients, hero headings, repeated card frames and badges on ordinary attributes. Include explanatory copy only when it identifies data, explains a decision or helps complete a task.
- In Cashier Reports keep Todayâ€™s Summary on the left and the active workspace on the right at desktop widths. Use one compact page-title header with actions on the right and the primary action first; omit product-name breadcrumbs when navigation already provides context. Keep the header, toolbar and footer outside the scrolling body. Use subtle token borders between the sidebar, title bar and workspace; never put the authenticated root workspace inside a rounded or bordered container. Use `min-w-0` and `min-h-0` on constrained grid and flex children.
- Retain role-appropriate navigation order and labels. Mark the current destination visually and programmatically, for example with `aria-current="page"` on the active link. Collapsed controls retain accessible names and keyboard access. Interactive title-bar controls use a non-draggable region.
- When width runs short, collapse the secondary inspector, move advanced filters into a drawer and group secondary actions in a menu. Keep search, the main action and row-action access visible. Wide tables scroll inside their viewport. Opening an overlay preserves the underlying paneâ€™s size and scroll position.

## Financial records and tables

- Identify account workspaces by customer, branch and business contract number where available. Keep internal record identifiers in detailed contract views for lookup.
- Keep report identity visible in context, including on past business dates. Label business date, transaction date and creation time according to their distinct meanings. Present existing model values. Format integer centavos through `formatCentavos`, preserving two decimal places, the sign and the userâ€™s peso-sign setting. Preserve each fieldâ€™s missing-value semantics and conditional visibility.
- In a reconciliation footer, show the variance status separately from its signed amount, including a formatted zero when balanced. Keep the amount on the same right edge as the figures above it.
- Right-align monetary headers, values and totals on one edge. Show complete, readable amounts and signs. Never silently truncate, clip or replace monetary values with an ellipsis. Show expected cash, physical cash, remittance and variance under their own labels wherever the workflow exposes them. Emphasize totals with weight and a separator. Signed figures or explicit shortage/overage text must convey variance without color.
- Use the shared table shell for Cashier Reports, Installment History and Active Accounts, and `UniversalDataTable` where compatible. Use sticky headers, 12px cell text and 8â€“12px horizontal cell padding. At default spacing use a 28px header and 28â€“32px compact rows. Interactive rows are 32â€“36px and grow to fit content and targets. Keep density in the shared table. Align Description left and Amount right, with category, receipt number, VAT and secondary identifiers muted.
- Where supported, keep one search field and one `FilterButton` for advanced filters. Keep active filters discoverable and indicate sort direction on the sorted header. Preserve stable record IDs and source order. Paginate or virtualize high-volume data.
- Use equal column geometry for skeletons and loaded rows, shared `Empty` for no records, clear filters for a filtered-empty result and an inline retry for recoverable load failures. If descriptive text is clipped, expose the full text via the shared tooltip on hover and keyboard focus. Amounts, required instructions and actions must be available directly.
- Use shared `Badge` variants for states that affect interpretation or action. Include the state in text. Use `AccountBranchBadge` for every account branch label, with its existing code, accessible name and global color mapping: Goa GOA blue, Tinambac TIN violet, Tigaon TIG amber, Lagonoy LAG green.

## Controls, forms and overlays

- Use shared `Button`, `Input`, `SearchInput` and `Select`. Default to `h-9` (36px) in forms and `h-8` (32px) in compact toolbars and table controls. Give each task header or footer at most one primary action. Use outline or secondary for supporting actions, ghost for low emphasis, and destructive for a destructive decision. Name the action by its outcome.
- Hover and pressed feedback must preserve legibility. Focus has a visible ring independent of selection. Expose selection, expansion, invalidity and disabled state through the controlâ€™s semantics. Explain a blocking condition at its point of correction. A pending commit gives in-place feedback and prevents duplicate activation.
- Group related fields with `FieldGroup` and `Field`. Associate persistent labels, descriptions and inline `FieldError` with their controls. Use up to two columns for short related fields and one for long or complex entries. Keep section headings with their first field. Disclose optional detail within existing workflow conditions. Preserve entered values after validation fails.
- Short create/edit tasks use the right-side `TaskSheet`: fixed header, one scrolling body, fixed footer and unsaved-change protection. Use the central workspace for wide comparisons and multi-section entry. A wizard keeps its title, step context and Back and Next/Save actions visible and retains values between steps. Use the shared ReUI `Stepper` when compatible.
- Use shared dialogs for focused choices and confirmations. Use the shared header and footer for the chosen dialog primitive. Name the affected record and consequence before a destructive decision. End-align form and dialog footer actions, Cancel or secondary first and the committing action last.

## Notifications

Use the typed shared provider for operation outcomes across login and the authenticated workspace. For a failed operation requiring correction, announce the outcome once and keep corrective detail beside the field or in the workspace. Use user-safe copy for backend and unexpected errors. Keep destructive confirmation in the dialog and notify after the operation finishes.

Position notifications top center above overlays, with safe-area spacing and width `min(28rem, calc(100vw - 2rem))`. Show at most three, newest first. Deduplicate identical active messages and provide a named close button. Defaults are 3 seconds for success/info and 6 seconds for warning/error. Announce without moving focus. Use a brief slide/fade only when motion is enabled.

## Acceptance for affected UI

Use the smallest applicable checks in [verification rules](VERIFICATION.md). Record the view, role, theme and window size for any visual finding.

1. **Theme and contrast.** For a theme or shared style change, inspect the affected component under the default and one visibly different TweakCN preset, each in light and dark. Change palette, font, spacing and radius on the open view. Check a portaled surface when affected. Compare computed styles with active tokens. Normal text must reach 4.5:1 against its rendered background, including muted text and button labels. Essential control boundaries, state indicators and focus rings must reach 3:1 against adjacent colors.
2. **Keyboard and targets.** Complete the affected task using the keyboard, including row actions and recovery from an error. Focus stays visible and unobscured. Modal focus enters the dialog, stays inside and returns to the trigger or logical successor. Escape respects unsaved-change protection. Inspect accessible names, labels, errors, current/sort state and announcements. Pointer targets must be at least 24 Ã— 24 CSS px or satisfy the WCAG 2.2 target-spacing exception.
3. **Fit.** Use 1300 Ã— 670 and 1024 Ã— 670 CSS px as desktop review sizes. Repeat the affected entry or comparison with text enlarged to 200%. Pass with zero page-level horizontal overflow, clipped amounts, obscured errors or unreachable controls. Scroll a long body and open its overlay. The pane keeps its width and task actions stay reachable.
4. **Financial parity.** Compare the same role, branch, record and business date before and after a presentation change. Check displayed amounts to the centavo, zero, missing and both variance directions where applicable, plus visible rows, fields and permitted actions. Check the longest representative description and amount. All digits and signs remain readable and comparable.
5. **Feedback.** Exercise applicable loading, empty, filtered-empty, error, pending and completed states. Check column alignment before and after loading, keyboard access to recovery, and equivalent outcomes with reduced motion enabled.
