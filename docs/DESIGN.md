# Design Rules

Applies to layout, forms, drawers, tables, visual hierarchy, responsive behavior, and shared UI patterns.

## Product Direction

Design the application as a compact financial workstation, not a generic admin dashboard.

Directional references:

- **Stripe:** restrained hierarchy, clean financial tables, subtle borders, and clear primary actions
- **Linear:** compact density, minimal controls, lightweight navigation, and keyboard-friendly workflows

Use these products as inspiration only. Do not copy branding, proprietary layouts, colors, or components.

## Component Priority

### Shared control rules

- Use the shared `Button`; do not add button colors, typography, height, padding, radius, or icon sizing inline.
- Primary buttons use zinc; `outline` uses white with a zinc border; `ghost` is for low-emphasis actions.
- Button sizes are `sm` (h-8) and default (h-9); all buttons use rounded-md, text-[13px], font-medium, and gap-1.5.
- Use the shared `Input` or `SearchInput`; inputs are h-9, rounded-md, zinc bordered, and use zinc-400 placeholders.
- Use `FilterButton` for filters; do not create a separately styled filter trigger.
- Use the shared `Badge` color variants: amber, blue, emerald, or zinc. Do not style badges inline.

Use components in this order:

1. Existing project components
2. Existing ReUI components
3. Install a compatible ReUI component
4. Existing shadcn/ui components
5. Install a required shadcn/ui component
6. Build a custom component only when no suitable reusable component exists

Do not replace a stable component solely to use ReUI.

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

## Layout

- Keep **Today’s Summary** on the left and the primary workspace on the right.
- Do not move the summary above the workspace at narrow desktop widths.
- Prefer internal scrolling over page-level scrolling or layout stacking.
- Use `min-h-0` and `min-w-0` in constrained flex and grid layouts.
- Opening an overlay must not resize or restructure the main workspace.

## Form Placement

Choose form placement based on workflow size.

### Right-side drawer

Use a right-side drawer for:

- short create and edit forms
- table-row editing
- focused tasks that do not require the full workspace
- quick account, expense, income, payment, or installment entry

Prefer the shared project drawer component using ReUI first, with shadcn `Sheet` as the fallback.

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
- Use progressive disclosure for optional or advanced fields.
- Use sticky actions for long workflows.
- Avoid nested scrolling.

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
- Secondary actions use outline, ghost, or muted styling.
- Group related fields and separate major sections consistently.
- Show validation directly below the affected field using semantic destructive styling.

## Table Design

- Use shared table primitives, theme tokens, density, and interaction patterns.
- Use the shared table shell for Cashier Reports, Installment History, and Active Accounts so search, filters, table framing, empty states, loading, and pagination remain visually consistent.
- Keep table surfaces compact and workstation-oriented: readable values, restrained row padding, sticky headers, subtle separators, and no decorative card treatment inside the table viewport.
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
