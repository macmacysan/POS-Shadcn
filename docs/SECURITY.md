# Security Rules

Applies to authentication, authorization, IPC, imports, exports, backups, and sensitive records.

## Authorization

- Enforce administrator and cashier permissions in privileged handlers and persistence operations, not only in the UI.
- Treat hidden or disabled UI controls as presentation only, not as security enforcement.
- Apply least privilege to roles, IPC handlers, and data access.
- Do not trust renderer-supplied roles, branch IDs, cashier IDs, or ownership claims without server-side or main-process validation.

## Sensitive Access

- Do not expose secrets, raw database handles, unrestricted IPC, filesystem access, shell access, or process control to the renderer.
- Expose only the minimum typed preload API required by the current workflow.
- Do not return internal stack traces, SQL details, filesystem paths, or sensitive implementation details to the renderer.

## Input and Data Handling

- Validate untrusted input at the boundary where it enters the application.
- Sanitize imported, external, or user-supplied data before storage or execution.
- Validate file type, size, structure, and required fields for imports and restores.
- Treat exports and backups as sensitive data operations.
- Avoid logging passwords, tokens, personal data, financial details, or full sensitive payloads.

## Data Protection

- Preserve existing authorization, ownership, branch, and cashier boundaries unless explicitly changed.
- Destructive or sensitive operations must require explicit scope and appropriate safeguards.
- Do not weaken validation, authorization, or audit behavior to simplify UI implementation.