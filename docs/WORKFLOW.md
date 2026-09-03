# Workflow Rules

## Task Scope

For non-trivial work:

1. Read the relevant Backlog task when one exists or the user explicitly references it.
2. Confirm acceptance criteria, constraints, dependencies, and exclusions.
3. Implement only the requested scope.
4. Update the task only when task lifecycle work is part of the request.

Do not place temporary requirements, progress logs, implementation history, or completed-task notes in `AGENTS.md`.

## Backlog.md

Use the Backlog CLI for Backlog records.

Do not directly edit Backlog task, draft, decision, milestone, or document markdown files.

Before using an unfamiliar Backlog command, run:

```bash
backlog <command> --help