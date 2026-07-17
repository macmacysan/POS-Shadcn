# Cashiers Report — Engineering Instructions

# Cashiers Report — Agent Instructions

## Project

Electron desktop application using React and TypeScript for cashier reports, reconciliation, payments, installments, users, branches, and local persistence.

Preserve existing business behavior unless the active task explicitly changes it.

## Required Reading

Read only the documents relevant to the files and risk involved in the current task:

- UI, forms, tables, responsive layout: `docs/DESIGN.md`
- React, TypeScript, renderer components: `docs/FRONTEND.md`
- Electron, preload, IPC, persistence: `docs/ARCHITECTURE.md`
- Calculations, money, report rules: `docs/BUSINESS_RULES.md`
- Security, permissions, sensitive data: `docs/SECURITY.md`
- Testing and completion checks: `docs/VERIFICATION.md`
- Backlog task lifecycle work: `docs/WORKFLOW.md`

A nearer `AGENTS.md` may add rules for its subtree. Do not reread documents unless the task scope changes.

## Working Contract

1. Inspect the affected code before editing.
2. Use symbol/reference search first; expand scope only when evidence is insufficient.
3. Make the smallest complete change that satisfies the request.
4. Do not refactor unrelated code.
5. Reuse existing components, types, utilities, and dependencies.
6. Do not change calculations, persistence, authorization, or data contracts unless explicitly requested.
7. Do not edit generated files, build output, coverage, dependencies, or packaged artifacts.
8. Never claim a test, build, command, or visual check passed unless it actually ran successfully.

## Tool Use

- Use the installed shadcn skill for substantial UI component work.
- Use Serena when symbol/reference analysis is useful; do not invoke it for trivial edits.
- Use Context7 or official documentation only for unfamiliar or version-sensitive APIs.
- Use planning/debugging workflows in proportion to task risk, not automatically.

## Completion Report

Report:

- behavior changed
- main files changed
- verification performed
- unresolved risks or unverified areas

<!-- BACKLOG.MD GUIDELINES START -->
<!-- backlog.md-instructions-version: 1.48.0 -->
<CRITICAL_INSTRUCTION>

## Backlog.md Workflow

This project uses Backlog.md for task and project management.

**For every user request in this project, run `backlog instructions overview` before answering or taking action.**

Use the overview to decide whether to search, read, create, or update Backlog tasks.

Before task lifecycle actions, read the matching detailed guide:
- `backlog instructions task-creation` before creating or splitting tasks
- `backlog instructions task-execution` before planning, changing status or assignee, adding a plan or implementation notes, or implementing task work
- `backlog instructions task-finalization` before checking acceptance criteria, writing final summaries, or moving tasks to terminal statuses

Use `backlog <command> --help` before running unfamiliar commands. Help shows options, fields, and examples.

Do not edit Backlog task, draft, document, decision, or milestone markdown files directly. Use the `backlog` CLI so metadata, relationships, and history stay consistent.

</CRITICAL_INSTRUCTION>
<!-- BACKLOG.MD GUIDELINES END -->