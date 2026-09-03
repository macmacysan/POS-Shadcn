# Frontend Rules

Applies to React, TypeScript, renderer components, hooks, forms, tables, Tailwind, and shadcn/ui.

## React and TypeScript

- Keep TypeScript strict and avoid unnecessary `any`.
- Reuse existing domain types, components, hooks, and utilities before creating alternatives.
- Keep state near its owner and derive values instead of storing duplicate calculated state.
- Avoid effects for values that can be computed during rendering.
- Memoize only when rendering cost or reference stability requires it.
- Do not mutate state.
- Use stable record identifiers; do not use array indexes as persistent keys.
- Extract components by responsibility, not merely by line count.

## Components

- Inspect existing project components before adding new ones.
- Keep UI components focused on presentation and interaction.
- Move reusable business logic into hooks, services, or calculation modules.
- Preserve keyboard navigation, visible focus states, labels, and accessible names.

## Tailwind and Universal Theming

- Use canonical Tailwind utilities whenever an exact equivalent exists.
- Use arbitrary values only when no canonical utility or project token represents the requirement.
- Treat `src/renderer/src/assets/main.css` as the visual theme source of truth.
- Use semantic utilities backed by global CSS variables, including:
  - `bg-background`
  - `bg-card`
  - `text-foreground`
  - `text-muted-foreground`
  - `border-border`
  - `bg-primary`
  - `text-primary-foreground`
  - `text-destructive`
  - `ring-ring`
- Do not hard-code theme-sensitive colors, typography, radii, or shadows when a global token exists.
- Add reusable visual values as global semantic tokens before using them in components.
- App customization must update global CSS variables, not individual component styles.
- Do not introduce page-specific or component-local theme systems.
- Use `cn()` for conditional class composition.
- Do not construct Tailwind classes dynamically from partial strings.

## shadcn/ui

- Prefer existing shadcn components and project wrappers over custom primitives.
- Preserve the local shadcn API and styling conventions.
- Use reusable variants instead of repeated local overrides.
- Use shadcn as an implementation foundation, not as a separate theme.

## Forms

- Follow `docs/DESIGN.md` for form hierarchy and drawer behavior.
- Use the shared right-side shadcn `Sheet` for create and edit forms unless explicitly overridden.
- Reuse existing form logic and avoid duplicated drawer implementations.
- Opening a form must not alter the primary workspace layout.

## Tables

- Follow `docs/DESIGN.md` for table hierarchy and emphasis.
- Right-align monetary values.
- Keep essential actions visible and inside the table viewport.
- Use pagination or virtualization for high-volume datasets.
- Do not render thousands of rows directly.
- Sorting and filtering must not mutate persisted source order unless explicitly intended.

## Performance

- Measure before broad optimization.
- Avoid unnecessary re-renders in high-volume workflows.
- Debounce expensive searches when appropriate.
- Move expensive transformations out of repeated render paths.