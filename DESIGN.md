# Cashiers Report Design System

## 1. Atmosphere & Identity

A restrained accounting workstation: dense, calm, and optimized for scanning records and entering cashier data. The signature is clear hierarchy through compact rows, muted surfaces, and consistent semantic controls.

## 2. Color

The application uses the semantic shadcn theme tokens declared in `src/renderer/src/assets/main.css` (`background`, `card`, `muted`, `foreground`, `border`, `primary`, and status variants). New UI should use those tokens rather than raw colors.

## 3. Typography

Geist/Inter variable sans is used through the existing Tailwind font token. Body copy uses the existing text-sm and text-xs table/control scale.

## 4. Spacing & Layout

Spacing follows the existing Tailwind 4px rhythm. Dense data tables use compact 9-unit rows, 3-unit cell padding, and horizontal scrolling at narrow widths.

## 5. Components

### Report data table

- **Structure**: filter toolbar, sticky header, selectable rows, pagination footer
- **Variants**: expense, income, payment, and activity columns
- **Spacing**: compact rows and semantic shadcn table spacing
- **States**: default, hover, selected, sorted, filtered, empty, paginated
- **Accessibility**: semantic table markup, labeled controls, keyboard-reachable sorting and pagination
- **Motion**: existing short color transitions for row hover/selection
- **Layout**: flex column with an independently scrolling table region

### Report details form

- **Structure**: labeled field stack with shadcn inputs and selects
- **Variants**: fields vary by active report tab
- **States**: default, focused, invalid, and disabled states from shared primitives
- **Accessibility**: each field has an associated label and accessible select name

## 6. Motion & Interaction

Use the existing shared primitive transitions. Prefer short, state-signaling transitions and respect reduced-motion preferences.

## 7. Depth & Surface

Use the existing mixed strategy: semantic borders and muted/card tonal shifts, with no new decorative surfaces for table changes.

## 8. Accessibility Constraints & Accepted Debt

Target WCAG 2.2 AA, preserve visible focus, keyboard reachability, semantic labels, and readable table content. No new accepted debt is introduced by the expense-table update.
