import Database from 'better-sqlite3'

import { runMigrations } from './migrations'
import { seedDevelopmentData } from './development-seed'

export type AppDatabase = Database.Database

export function openDatabase(
  filePath: string,
  options: { seedDevelopmentData?: boolean } = {}
): AppDatabase {
  const db = new Database(filePath, { timeout: 5000 })

  try {
    db.pragma('foreign_keys = ON')
    db.pragma('journal_mode = WAL')
    db.pragma('busy_timeout = 5000')
    runMigrations(db)
    if (options.seedDevelopmentData) seedDevelopmentData(db)
    return db
  } catch (error) {
    db.close()
    throw error
  }
}
