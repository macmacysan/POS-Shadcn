import Database from 'better-sqlite3'

import { runMigrations } from './migrations'

export type AppDatabase = Database.Database

export function openDatabase(filePath: string): AppDatabase {
  console.info('[Database] Opening local database.')
  const db = new Database(filePath, { timeout: 5000 })

  try {
    db.pragma('foreign_keys = ON')
    db.pragma('journal_mode = WAL')
    db.pragma('busy_timeout = 5000')
    runMigrations(db)
    console.info('[Database] Ready; foreign keys and WAL are enabled.')
    return db
  } catch (error) {
    db.close()
    throw error
  }
}
