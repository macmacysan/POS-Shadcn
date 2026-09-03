# Cashiers Report — Agent Instructions

## Project

Cashiers Report is an Electron desktop application built with React and TypeScript for cashier reports, reconciliation, payments, installments, users, branches, and local persistence.
Preserve existing business behavior unless the active task explicitly changes it.

## Required Reading

Read only the documents relevant to the current task:

- UI, forms, tables, responsive layout, and visual design: `docs/DESIGN.md`
- React, TypeScript, renderer components, Tailwind, shadcn/ui and reUI: `docs/FRONTEND.md`
- Electron, preload, IPC, main process, persistence, and dependencies: `docs/ARCHITECTURE.md`
- Calculations, money handling, reconciliation, and report identity: `docs/BUSINESS_RULES.md`
- Authentication, authorization, sensitive data, imports, exports, and backups: `docs/SECURITY.md`
- Testing, validation, visual checks, and completion criteria: `docs/VERIFICATION.md`
- Backlog task lifecycle and risk-based execution: `docs/WORKFLOW.md`

A nearer `AGENTS.md` may add stable rules for its subtree.

Read each applicable document once per task. Re-read only when the working scope changes or an instruction file is modified.

## Working Contract

- Use the smallest verification scope that matches the risk.
- Do not run Playwright, full test suites, production builds, or repository-wide checks by default.

1. Inspect affected code before editing.
2. Prefer symbol and reference search over broad repository scans.
3. Expand scope only when current evidence is insufficient.
4. Make the smallest complete change that satisfies the request.
5. Do not refactor unrelated code.
6. Reuse existing components, types, hooks, utilities, services, and dependencies.
7. Do not change calculations, persistence, authorization, IPC contracts, or data contracts unless explicitly requested.
8. Do not edit generated files, build output, coverage output, dependency directories, or packaged artifacts.
9. Do not claim a test, command, build, or visual check passed unless it actually completed successfully.
10. Report unrelated issues separately instead of expanding the task.

## UI Tool Use

For substantial UI work:

1. Read `docs/DESIGN.md` first. It is authoritative.
2. Inspect existing project components before adding anything.
3. Use the ReUI skill when selecting or adapting higher-level UI components.
4. Use the shadcn skill for shared primitives and implementation guidance.
5. Use `design-taste-frontend` only for visual/UX audits unless the task
   explicitly requests a redesign.
6. Do not invoke multiple visual-taste/redesign skills for the same task.

## Completion Report

Report:

- behavior changed
- main files changed
- verification performed
- unresolved risks or unverified areas