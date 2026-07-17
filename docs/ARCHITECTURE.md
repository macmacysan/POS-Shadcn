# Architecture Rules

Applies to the Electron renderer, preload, IPC, main process, persistence, and architectural dependencies.

## Process Boundaries

- Renderer code must not directly access Node.js, the filesystem, SQLite, environment secrets, or privileged Electron APIs.
- Privileged operations and database access belong in the main process.
- Renderer components must use the established typed preload API.
- Do not bypass preload boundaries with direct imports, remote access, or unrestricted bridges.

## Preload and IPC

- Expose the smallest API surface required by the renderer.
- Use explicit typed request, response, and error contracts.
- Validate untrusted input at the IPC boundary.
- Centralize IPC channel names and shared contracts.
- Keep shared IPC and persistence contracts in a dedicated typed module used by renderer, preload, and main process.
- Return structured errors without exposing internal exceptions, paths, queries, or stack traces.
- Do not expose generic filesystem, shell, database, process, or command-execution access.

## Persistence

- Keep persistence logic outside renderer components.
- Use transactions for multi-step financial, reconciliation, or report-submission operations.
- Implement schema changes through versioned migrations.
- Do not manually alter persisted production data as a substitute for a migration.
- Destructive operations require explicit task scope, validation, and safeguards.
- Preserve existing data contracts unless the task explicitly changes them.

## Dependencies

- Prefer existing dependencies and platform capabilities.
- Add a dependency only when it materially reduces complexity, maintenance cost, or risk.
- Check the installed version and existing project usage before consulting documentation.
- Do not replace an established library without explicit task scope.
- Modify the lockfile only when dependency changes require it.