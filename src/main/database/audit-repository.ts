import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'

import type {
  EntryEntityType,
  EntryHistoryAction,
  EntryHistoryRecord
} from '../../shared/contracts'

export type AuditChange = {
  field: string
  oldValue: string | null
  newValue: string | null
}

export function recordAudit(
  db: Database.Database,
  input: {
    actorUserId: string | null
    entityType: EntryEntityType
    entityId: string
    action: EntryHistoryAction
    reason?: string | null
    changes: AuditChange[]
  }
): void {
  const auditId = randomUUID()
  db.prepare(
    `INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    auditId,
    input.actorUserId,
    input.action,
    input.entityType,
    input.entityId,
    input.reason ?? null,
    new Date().toISOString()
  )
  const insertChange = db.prepare(
    `INSERT INTO audit_log_changes (id, audit_log_id, column_name, old_value, new_value)
     VALUES (?, ?, ?, ?, ?)`
  )
  for (const change of input.changes) {
    insertChange.run(
      randomUUID(),
      auditId,
      change.field,
      change.oldValue,
      change.newValue
    )
  }
}

export class AuditRepository {
  constructor(private readonly db: Database.Database) {}

  list(entityType: EntryEntityType, entityId: string): EntryHistoryRecord[] {
    const rows = this.db
      .prepare(
        `SELECT a.id, a.entity_type, a.entity_id, a.action, a.actor_user_id,
                u.display_name AS actor_name, a.reason, a.created_at,
                c.column_name, c.old_value, c.new_value
           FROM audit_logs a
           LEFT JOIN users u ON u.id = a.actor_user_id
           LEFT JOIN audit_log_changes c ON c.audit_log_id = a.id
          WHERE a.entity_type = ? AND a.entity_id = ?
          ORDER BY a.created_at DESC, a.id DESC`
      )
      .all(entityType, entityId) as Array<{
      id: string
      entity_type: EntryEntityType
      entity_id: string
      action: EntryHistoryAction
      actor_user_id: string | null
      actor_name: string | null
      reason: string | null
      created_at: string
      column_name: string | null
      old_value: string | null
      new_value: string | null
    }>

    const history = new Map<string, EntryHistoryRecord>()
    for (const row of rows) {
      const record = history.get(row.id) ?? {
        id: row.id,
        entityType: row.entity_type,
        entityId: row.entity_id,
        action: row.action,
        actorUserId: row.actor_user_id,
        actorName: row.actor_name,
        reason: row.reason,
        createdAt: row.created_at,
        changes: []
      }
      if (row.column_name) {
        record.changes.push({
          field: row.column_name,
          oldValue: row.old_value,
          newValue: row.new_value
        })
      }
      history.set(row.id, record)
    }
    return [...history.values()]
  }
}
