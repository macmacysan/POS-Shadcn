# Design Rules

Applies to layout, forms, drawers, tables, visual hierarchy, responsive behavior, and shared UI patterns.

## Layout

- Keep **Today’s Summary** on the left and the primary workspace on the right.
- Do not move the summary above the workspace at narrow desktop widths.
- Prefer internal scrolling over page-level scrolling or layout stacking.
- Use `min-h-0` and `min-w-0` in height- or width-constrained flex and grid layouts.
- Opening a form must not resize, move, or restructure the main workspace.

## Form Presentation

- All create and edit forms must open in a shared right-side shadcn `Sheet`.
- Do not place forms inside tables, below the workspace, in permanent columns, or in centered dialogs unless explicitly required.
- Use one shared drawer shell where practical.
- Drawer structure:
  1. fixed header
  2. scrollable form body
  3. fixed action footer
- The drawer overlays the workspace and preserves the page layout behind it.
- Protect unsaved changes when closing.

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
- Entered values must be more prominent than placeholders.
- Use one primary action per form footer.
- Secondary actions use outline, ghost, or muted styling.
- Group related fields and separate major sections consistently.
- Validation appears directly below the affected field using semantic destructive styling.