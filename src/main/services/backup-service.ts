import Database from 'better-sqlite3'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync
} from 'node:fs'
import { join } from 'node:path'
import { gzipSync, gunzipSync } from 'node:zlib'
import type { AppDatabase } from '../database/database'
import { currentSchemaVersion } from '../database/migrations'
import { GoogleSheetsClient } from './google-sheets-client'

type BackupEnvelope = { iv: string; tag: string; data: string }

const portableRequiredTables = [
  'schema_migrations',
  'branches',
  'users',
  'daily_reports',
  'expenses',
  'accounts',
  'installment_contracts',
  'in_house_payments',
  'installment_payment_allocations',
  'finance_accounts',
  'audit_logs'
] as const

export type PortableDatabaseValidation = { schemaVersion: number }

export class BackupService {
  constructor(
    private readonly database: AppDatabase,
    private readonly sourcePath: string,
    private readonly google?: GoogleSheetsClient
  ) {}

  async createManaged(destinationDirectory: string): Promise<{ filePath: string; sha256: string }> {
    const result = await this.create(this.sourcePath, destinationDirectory)
    const folderId = process.env.GOOGLE_SHARED_DRIVE_FOLDER_ID
    if (folderId && this.google) {
      const remotePath = await this.google.uploadFile(
        result.filePath.split(/[\\/]/).pop() ?? 'backup.db.gz.enc',
        readFileSync(result.filePath),
        folderId
      )
      this.database
        .prepare('UPDATE backup_records SET remote_path = ? WHERE local_path = ?')
        .run(remotePath, result.filePath)
    }
    return result
  }

  restoreManaged(id: string): string {
    const record = this.database
      .prepare('SELECT local_path FROM backup_records WHERE id = ?')
      .get(id) as { local_path: string } | undefined
    if (!record) throw new Error('Backup was not found.')
    return this.restoreValidated(record.local_path, this.sourcePath)
  }

  async create(
    sourcePath: string,
    destinationDirectory: string
  ): Promise<{ filePath: string; sha256: string }> {
    mkdirSync(destinationDirectory, { recursive: true })
    const temporaryPath = join(destinationDirectory, `.backup-${randomBytes(8).toString('hex')}.db`)
    try {
      const source = new Database(sourcePath, { readonly: true })
      await source.backup(temporaryPath)
      source.close()
      const encrypted = this.encrypt(gzipSync(readFileSync(temporaryPath)))
      const fileName = `cashiers-report-${new Date().toISOString().replace(/[:.]/g, '-')}.db.gz.enc`
      const filePath = join(destinationDirectory, fileName)
      writeFileSync(filePath, encrypted)
      const sha256 = createHash('sha256').update(encrypted).digest('hex')
      this.database
        .prepare(
          `INSERT INTO backup_records (id, file_name, local_path, sha256, size_bytes, encrypted, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)`
        )
        .run(
          randomBytes(16).toString('hex'),
          fileName,
          filePath,
          sha256,
          encrypted.length,
          new Date().toISOString()
        )
      return { filePath, sha256 }
    } finally {
      if (existsSync(temporaryPath)) unlinkSync(temporaryPath)
    }
  }

  async exportPortable(
    destinationDirectory: string
  ): Promise<{ filePath: string; schemaVersion: number }> {
    mkdirSync(destinationDirectory, { recursive: true })
    const filePath = join(
      destinationDirectory,
      `cashiers-report-portable-${new Date().toISOString().replace(/[:.]/g, '-')}.db`
    )
    return this.exportPortableFile(filePath)
  }

  async exportPortableFile(filePath: string): Promise<{ filePath: string; schemaVersion: number }> {
    await this.snapshot(this.sourcePath, filePath)
    const validation = this.validatePortable(filePath)
    this.removeWalSidecars(filePath)
    return { filePath, schemaVersion: validation.schemaVersion }
  }

  /** Copies an external portable DB to a local staging path and validates it without opening the live DB. */
  preparePortableImport(
    sourcePath: string,
    stagingDirectory: string
  ): {
    stagedPath: string
    schemaVersion: number
  } {
    if (!existsSync(sourcePath)) throw new Error('Portable database file was not found.')
    mkdirSync(stagingDirectory, { recursive: true })
    const stagedPath = join(
      stagingDirectory,
      `.portable-import-${randomBytes(8).toString('hex')}.db`
    )
    try {
      copyFileSync(sourcePath, stagedPath)
      const validation = this.validatePortable(stagedPath)
      this.removeWalSidecars(stagedPath)
      return { stagedPath, schemaVersion: validation.schemaVersion }
    } catch (error) {
      if (existsSync(stagedPath)) unlinkSync(stagedPath)
      throw error
    }
  }

  validatePortable(filePath: string): PortableDatabaseValidation {
    let database: Database.Database | undefined
    try {
      database = new Database(filePath, { readonly: true, fileMustExist: true })
      if (database.pragma('integrity_check', { simple: true }) !== 'ok')
        throw new Error('Portable database integrity check failed.')
      const foreignKeyErrors = database.pragma('foreign_key_check') as unknown[]
      if (foreignKeyErrors.length) throw new Error('Portable database has foreign-key violations.')
      const found = new Set(
        (
          database
            .prepare(
              `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${portableRequiredTables.map(() => '?').join(', ')})`
            )
            .all(...portableRequiredTables) as Array<{ name: string }>
        ).map((row) => row.name)
      )
      const missing = portableRequiredTables.filter((table) => !found.has(table))
      if (missing.length)
        throw new Error(`Portable database is missing required tables: ${missing.join(', ')}.`)
      const row = database
        .prepare('SELECT MAX(version) AS version FROM schema_migrations')
        .get() as { version: number | null }
      if (!Number.isInteger(row.version) || !row.version || row.version > currentSchemaVersion)
        throw new Error('Portable database has an unsupported schema version.')
      return { schemaVersion: row.version }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Portable database')) throw error
      throw new Error('Portable database is not a valid Cashiers Report database.')
    } finally {
      database?.close()
    }
  }

  installPortable(stagedPath: string, targetPath: string): string {
    this.validatePortable(stagedPath)
    const recoveryPath = `${targetPath}.recovery-${new Date().toISOString().replace(/[:.]/g, '-')}`
    const moved = new Set<string>()
    try {
      if (existsSync(targetPath)) {
        renameSync(targetPath, recoveryPath)
        moved.add('')
      }
      for (const suffix of ['-wal', '-shm']) {
        const current = `${targetPath}${suffix}`
        if (!existsSync(current)) continue
        renameSync(current, `${recoveryPath}${suffix}`)
        moved.add(suffix)
      }
      renameSync(stagedPath, targetPath)
      return recoveryPath
    } catch (error) {
      if (!existsSync(targetPath) && moved.has('')) renameSync(recoveryPath, targetPath)
      for (const suffix of ['-wal', '-shm']) {
        if (moved.has(suffix) && !existsSync(`${targetPath}${suffix}`))
          renameSync(`${recoveryPath}${suffix}`, `${targetPath}${suffix}`)
      }
      throw error
    }
  }

  restoreValidated(backupPath: string, targetPath: string): string {
    const stagedPath = `${targetPath}.restore-${randomBytes(8).toString('hex')}.db`
    this.restoreToValidated(backupPath, stagedPath)
    if (existsSync(targetPath)) {
      copyFileSync(
        targetPath,
        `${targetPath}.damaged-${new Date().toISOString().replace(/[:.]/g, '-')}`
      )
      unlinkSync(targetPath)
    }
    renameSync(stagedPath, targetPath)
    return targetPath
  }

  /** Decodes an encrypted backup into a new path without replacing a live database. */
  restoreToValidated(backupPath: string, targetPath: string): void {
    const temporaryPath = `${targetPath}.restore-${randomBytes(8).toString('hex')}.db`
    try {
      writeFileSync(temporaryPath, gunzipSync(this.decrypt(readFileSync(backupPath))))
      const restored = new Database(temporaryPath, { readonly: true })
      const integrity = restored.pragma('integrity_check', { simple: true }) as string
      restored.close()
      if (integrity !== 'ok') throw new Error('Backup integrity validation failed.')
      if (existsSync(targetPath)) unlinkSync(targetPath)
      renameSync(temporaryPath, targetPath)
    } catch (error) {
      if (existsSync(temporaryPath)) unlinkSync(temporaryPath)
      throw error
    }
  }

  private key(): Buffer {
    const developmentKeyPath = join(process.cwd(), 'credentials', 'cashiers-backup-key.txt')
    const packagedKeyPath =
      'resourcesPath' in process && typeof process.resourcesPath === 'string'
        ? join(process.resourcesPath, 'credentials', 'cashiers-backup-key.txt')
        : undefined
    const localKeyPath = [developmentKeyPath, packagedKeyPath].find((path): path is string =>
      Boolean(path && existsSync(path))
    )
    const value =
      process.env.CASHIERS_BACKUP_KEY ||
      (localKeyPath ? readFileSync(localKeyPath, 'utf8').trim() : undefined)
    if (!value) throw new Error('CASHIERS_BACKUP_KEY is required for encrypted backups.')
    return createHash('sha256').update(value).digest()
  }

  private async snapshot(sourcePath: string, targetPath: string): Promise<void> {
    const source = new Database(sourcePath, { readonly: true })
    try {
      await source.backup(targetPath)
    } finally {
      source.close()
    }
    const target = new Database(targetPath)
    try {
      target.pragma('wal_checkpoint(TRUNCATE)')
    } finally {
      target.close()
    }
    this.removeWalSidecars(targetPath)
  }

  private removeWalSidecars(filePath: string): void {
    for (const suffix of ['-wal', '-shm']) {
      const sidecar = `${filePath}${suffix}`
      if (existsSync(sidecar)) unlinkSync(sidecar)
    }
  }

  private encrypt(data: Buffer): Buffer {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv)
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()])
    const envelope: BackupEnvelope = {
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      data: encrypted.toString('base64')
    }
    return Buffer.from(JSON.stringify(envelope))
  }

  private decrypt(data: Buffer): Buffer {
    const envelope = JSON.parse(data.toString('utf8')) as BackupEnvelope
    const decipher = createDecipheriv('aes-256-gcm', this.key(), Buffer.from(envelope.iv, 'base64'))
    decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'))
    return Buffer.concat([decipher.update(Buffer.from(envelope.data, 'base64')), decipher.final()])
  }
}
