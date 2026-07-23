import type Database from 'better-sqlite3'

export const currentSchemaVersion = 1

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `)

  const applied = db
    .prepare('SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations')
    .get() as { version: number }

  if (applied.version > currentSchemaVersion) {
    throw new Error('Database schema is newer than this application.')
  }

  if (applied.version < 1) {
    const migrate = db.transaction(() => {
      db.exec(`
        CREATE TABLE reports (
          id TEXT PRIMARY KEY NOT NULL,
          branch_id TEXT NOT NULL,
          cashier_id TEXT NOT NULL,
          business_date TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('Draft', 'Submitted', 'Locked')),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE expenses (
          id TEXT PRIMARY KEY NOT NULL,
          report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          description TEXT NOT NULL,
          category TEXT NOT NULL,
          receipt_no TEXT NOT NULL,
          vat TEXT NOT NULL DEFAULT '',
          amount_centavos INTEGER NOT NULL CHECK (amount_centavos >= 0),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE INDEX expenses_report_created_idx
          ON expenses (report_id, created_at DESC, id DESC);
        CREATE INDEX expenses_report_type_idx
          ON expenses (report_id, type);
        CREATE INDEX expenses_report_category_idx
          ON expenses (report_id, category);
        CREATE INDEX expenses_report_vat_idx
          ON expenses (report_id, vat);
        CREATE INDEX expenses_report_receipt_no_idx
          ON expenses (report_id, receipt_no);
      `)
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(
        1,
        new Date().toISOString()
      )
    })

    migrate()
  }
}
