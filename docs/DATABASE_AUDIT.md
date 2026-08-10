# Audit database

This document owns the append-oriented audit trail for sensitive financial and authorization changes. It references `users` from [`DATABASE_CORE.md`](DATABASE_CORE.md); no other database document redefines audit tables.

```sql
CREATE TABLE audit_logs (
    id TEXT PRIMARY KEY,
    actor_user_id TEXT,
    action TEXT NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'VOID', 'STATUS_CHANGE', 'LOGIN', 'LOGOUT', 'RESTORE')),
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    reason TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_actor_time ON audit_logs(actor_user_id, created_at);

CREATE TABLE audit_log_changes (
    id TEXT PRIMARY KEY,
    audit_log_id TEXT NOT NULL,
    column_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    FOREIGN KEY (audit_log_id) REFERENCES audit_logs(id) ON DELETE RESTRICT,
    UNIQUE (audit_log_id, column_name)
);
```

`old_value` and `new_value` contain one scalar value rendered using the field's canonical text representation; they are not JSON arrays, comma-separated lists, or replacement copies of a full row. If a change needs multiple fields, it has one `audit_log_changes` row per column.

Audit rows are append-only: application code must not update or delete them. Void events and status changes record the actor, UTC timestamp, affected entity, and reason where required. `entity_type`/`entity_id` is intentionally polymorphic so the audit log can cover tables owned by other modules; the main-process service must validate that the target entity exists before writing the event.
