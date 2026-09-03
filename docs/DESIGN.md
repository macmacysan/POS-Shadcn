# Product Design Contract

This is the single authoritative product design contract for Cashiers Report. It applies to layout, forms, drawers, tables, visual hierarchy, responsive behavior, and shared UI patterns. Component-library defaults and skill preferences support this contract; they do not override it.

## Product Direction

Design the application as a compact financial workstation, not a generic admin dashboard.

Directional references:

- **Stripe:** restrained hierarchy, clean financial tables, subtle borders, and clear primary actions
- **Linear:** compact density, minimal controls, lightweight navigation, and keyboard-friendly workflows

Use these products as inspiration only. Do not copy branding, proprietary layouts, colors, or components.

## Component Priority

### Reuse order

Use components in this order:

1. Existing project shared components
2. Existing compatible ReUI components
3. Install a compatible ReUI component when justified
4. Existing shadcn/ui components
5. Install a compatible shadcn/ui component when justified
6. Custom implementation only when no suitable reusable component exists

Do not replace a stable component solely to use ReUI or shadcn/ui. Use ReUI for suitable higher-level components and shadcn/ui for primitives; both must follow this contract and the project theme tokens.

### Shared component rules

- Use the shared `Button`; do not add button colors, typography, height, padding, radius, or icon sizing inline.
- Use default or `primary` for the one main action, `outline` or `secondary` for supporting actions, `ghost` for low-emphasis actions, and `destructive` only for destructive actions.
- Button sizes are `sm` (h-8) and default (h-9); use h-8 only for compact table and toolbar controls.
- Use the shared `Input`, `SearchInput`, and `Select` primitives. Standard form controls are h-9; compact h-8 controls are limited to dense table and toolbar rows. Do not create locally styled input, select, or filter triggers.
- Use `FilterButton` for filters; do not create a separately styled filter trigger.
- Use shared `Badge` semantic variants—zinc, amber, blue, emerald, or destructive—and do not style badges inline.
- Reuse `TaskSheet` for standard short-form drawers, `WorkstationShell` and `WorkstationSurface` for desktop workspaces, and `UniversalDataTable` for compatible data tables.

All components must follow the project theme tokens, typography, spacing, accessibility, and Electron requirements.

## Visual Principles

- Prefer compact workstation layouts over large dashboard cards.
- Give primary workflows and data tables most of the available space.
- Use spacing and typography before adding borders or containers.
- Use subtle separators, restrained status colors, and minimal shadows.
- Keep search and primary actions prominent.
- Move advanced filters and secondary actions into popovers, menus, dialogs, or drawers.
- Preserve clear hierarchy between primary data, secondary metadata, and supporting labels.
- Avoid gradients, decorative cards, oversized headings, excessive pills, and unnecessary shadows.
- Do not reduce usability merely to make the interface smaller.

## Typography and Spacing

- Use the global font tokens: the sans/monospace body treatment for dense operational data and `font-heading` for page, workspace, dialog, drawer, and section titles.
- Page and workspace titles use `text-base` or `text-lg` with medium emphasis; section titles use `text-sm` with medium emphasis; labels, table data, and controls use `text-[13px]` or `text-sm`; metadata and helper text use `text-xs` or `text-sm` with `text-muted-foreground`.
- Preserve entered values as stronger than labels, placeholders, and secondary metadata. Do not use oversized display type.
- Use the 4px spacing rhythm. Default gaps are 8px within a control group, 12px between adjacent workspace elements, 16px within form sections, and 24px between major form sections.
- Use `rounded-md` for controls, badges, and small surfaces; reserve `rounded-lg` or `rounded-xl` for workspace and dialog surfaces already provided by shared components. Do not introduce page-specific radii.

## Layout

- Keep **Today’s Summary** on the left and the primary workspace on the right.
- Do not move the summary above the workspace at narrow desktop widths.
- Prefer internal scrolling over page-level scrolling or layout stacking.
- Use `min-h-0` and `min-w-0` in constrained flex and grid layouts.
- Opening an overlay must not resize or restructure the main workspace.
- Workspace headers use a compact title and optional muted description on the left, with primary action then secondary actions on the right. Keep the header, toolbar, and footer outside the scrolling data body when the workspace scrolls.

## Form Placement

Choose form placement based on workflow size.

### Right-side drawer

Use a right-side drawer for:

- short create and edit forms
- table-row editing
- focused tasks that do not require the full workspace
- quick account, expense, income, payment, or installment entry

Use `TaskSheet` when it fits the task; it provides the standard project wrapper over the shared `Sheet`. Use another compatible shared component only when the task requires it.

Drawer structure:

1. fixed header
2. scrollable form body
3. fixed action footer

The drawer must overlay the workspace, preserve the underlying layout, and protect unsaved changes.

Do not place drawer forms inside tables, below the workspace, or in permanent columns.

### Center workspace

Use the center workspace for:

- large or multi-section workflows
- multi-step forms
- complex financial configuration
- workflows requiring wide tables, previews, or side-by-side comparison

Do not force substantial workflows into a narrow drawer.

## Form Layout

- Use at most two columns for short, related fields.
- Use one column for addresses, remarks, long inputs, and complex financial sections.
- Group fields by task and meaning.
- Use `FieldGroup`, `Field`, labels, descriptions, and inline `FieldError` where compatible rather than reproducing their spacing and states.
- Separate related fields by 16px and major sections by 24px. Section headings stay with the first field and use a subtle separator only when grouping would otherwise be unclear.
- Use progressive disclosure for optional or advanced fields.
- Use sticky actions for long workflows.
- Avoid nested scrolling.

## Dialogs and Wizards

- Use dialogs for confirmation, destructive decisions, and short focused choices; use drawers or the center workspace for data-entry workflows.
- Dialogs follow the shared `DialogHeader`, scroll-safe content area when needed, and `DialogFooter`. Put cancel or secondary actions before the single primary action; destructive confirmation uses the destructive action last.
- Use the shared ReUI `Stepper` for multi-step workflows when it fits. A wizard has a persistent title and step context, one scrollable step body, visible Back and Next/Save actions in a fixed footer, and preserves entered values while navigating.

## Form Visual Hierarchy

Use this emphasis order:

1. form title
2. primary action
3. section titles
4. field labels and entered values
5. helper text, placeholders, metadata, and secondary actions

Rules:

- Form titles use strong foreground emphasis.
- Descriptions and helper text use `text-muted-foreground`.
- Section titles are distinct but less prominent than the form title.
- Entered values are more prominent than placeholders.
- Use one primary action per form footer.
- Align footer actions to the end; place cancel and secondary actions before the primary action, with the primary action last.
- Secondary actions use outline, ghost, or muted styling.
- Group related fields and separate major sections consistently.
- Show validation directly below the affected field using semantic destructive styling.

## Table Design

- Use shared table primitives, theme tokens, density, and interaction patterns.
- Use the shared table shell for Cashier Reports, Installment History, and Active Accounts so search, filters, table framing, empty states, loading, and pagination remain visually consistent.
- Keep table surfaces compact and workstation-oriented: readable values, restrained row padding, sticky headers, subtle separators, and no decorative card treatment inside the table viewport.
- Use the shared table density: compact header and row heights, `text-xs` table content, and 8–12px horizontal cell padding. Do not create a denser per-screen table variant.
- Keep the primary table toolbar minimal: one prominent search field, one Filters control for advanced filters, and only the highest-value quick filters visible beside it.
- Keep Description and Amount visually prominent.
- Use muted styling for supporting metadata such as Category, Receipt No., VAT, and secondary identifiers.
- Right-align monetary values.
- Keep essential actions visible and inside the table viewport.
- Keep headers, toolbars, and pagination visible while the table body scrolls.
- Use pagination or virtualization for high-volume datasets.
- Prefer virtualized rows for datasets that may grow beyond 1,000 records; keep filtering and sorting memoized and preserve stable record identifiers.
- Use shadcn/ReUI skeleton rows during table loading so column geometry remains stable and the workspace does not jump.
- Do not compress columns until values become unreadable.
- Use the shared `Empty` composition for no-data states, skeleton rows that preserve table geometry for loading, and an actionable inline error state with a retry when recovery is possible. Do not replace a workspace with a toast-only error.

## Notifications and alerts

Use the shared notification provider for transient operation outcomes across login and the authenticated workspace.

- Place notifications at the top center of the window, above dialogs and drawers, with a responsive width of `min(28rem, calc(100vw - 2rem))` and safe-area-aware top spacing.
- Use success and informational notifications for 3 seconds; keep warnings and errors visible for 6 seconds. Always provide a close button.
- Show at most three notifications at once, newest first, and deduplicate identical active messages.
- Animate notifications with a short top-center slide and fade; respect `prefers-reduced-motion`.
- Use notifications for load, save, create, update, delete, restore, submit, and authentication outcomes.
- Keep field-level validation inline and adjacent to its field. Use both inline validation and a notification when a failed operation also needs correction.
- Keep destructive confirmations in dialogs; show a notification only for the completed action result.
- Convert backend failures to user-safe copy before notifying. Never display raw database, IPC, or stack details.
- Expose notifications through the typed shared notification API rather than page-specific toast implementations.

## Branch Badges

Use the shared `AccountBranchBadge` for every account branch label. Do not create page-specific
branch colors or substitute text-only branch labels.

| Branch   | Code  | Color  |
| -------- | ----- | ------ |
| Goa      | `GOA` | Blue   |
| Tinambac | `TIN` | Violet |
| Tigaon   | `TIG` | Amber  |
| Lagonoy  | `LAG` | Green  |

Branch colors are global semantic tokens defined in `src/renderer/src/assets/main.css`. Apply them
only through `AccountBranchBadge` so the color code remains consistent in tables, inspectors, and
future account views.

## Truncated Content

- When text is intentionally truncated with ellipsis, reveal the complete value using the shared tooltip on hover and keyboard focus.
- Use tooltips only when content is actually clipped where practical.
- Do not use the native `title` attribute when the shared tooltip component is available.
- Do not hide validation, required instructions, or essential actions inside tooltips.

## Responsive Behavior

- Treat the application as a desktop workstation.
- Prioritize the active table or form workspace.
- Collapse secondary inspectors before compressing primary content.
- Move advanced filters into a drawer on constrained widths.
- Prevent clipped labels and unintended page-level horizontal scrolling.
- Allow wide tables to scroll inside their container.
- Do not solve responsive issues by globally reducing font sizes.
- Desktop widths remain the primary target. Preserve the two-column workstation shell, allow the primary workspace and wide tables to scroll internally, and reduce or collapse secondary inspectors, quick filters, and secondary actions before reducing control density or wrapping essential labels.
