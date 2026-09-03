import Database from 'better-sqlite3'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync, gunzipSync } from 'node:zlib'
import type { AppDatabase } from '../database/database'
import { GoogleSheetsClient } from './google-sheets-client'

type BackupEnvelope = { iv: string; tag: string; data: string }

export class BackupService {
  constructor(private readonly database: AppDatabase, private readonly sourcePath: string, private readonly google?: GoogleSheetsClient) {}

  async createManaged(destinationDirectory: string): Promise<{ filePath: string; sha256: string }> {
    const result = await this.create(this.sourcePath, destinationDirectory)
    const folderId = process.env.GOOGLE_SHARED_DRIVE_FOLDER_ID
    if (folderId && this.google) {
      const remotePath = await this.google.uploadFile(result.filePath.split(/[\\/]/).pop() ?? 'backup.db.gz.enc', readFileSync(result.filePath), folderId)
      this.database.prepare('UPDATE backup_records SET remote_path = ? WHERE local_path = ?').run(remotePath, result.filePath)
    }
    return result
  }

  restoreManaged(id: string): string {
    const record = this.database.prepare('SELECT local_path FROM backup_records WHERE id = ?').get(id) as { local_path: string } | undefined
    if (!record) throw new Error('Backup was not found.')
    return this.restoreValidated(record.local_path, this.sourcePath)
  }

  async create(sourcePath: string, destinationDirectory: string): Promise<{ filePath: string; sha256: string }> {
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
      this.database.prepare(`INSERT INTO backup_records (id, file_name, local_path, sha256, size_bytes, encrypted, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)`).run(randomBytes(16).toString('hex'), fileName, filePath, sha256, encrypted.length, new Date().toISOString())
      return { filePath, sha256 }
    } finally {
      if (existsSync(temporaryPath)) unlinkSync(temporaryPath)
    }
  }

  restoreValidated(backupPath: string, targetPath: string): string {
    const stagedPath = `${targetPath}.restore-${randomBytes(8).toString('hex')}.db`
    this.restoreToValidated(backupPath, stagedPath)
    if (existsSync(targetPath)) {
      copyFileSync(targetPath, `${targetPath}.damaged-${new Date().toISOString().replace(/[:.]/g, '-')}`)
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
    const localKeyPath = [developmentKeyPath, packagedKeyPath].find(
      (path): path is string => Boolean(path && existsSync(path))
    )
    const value = process.env.CASHIERS_BACKUP_KEY ||
      (localKeyPath ? readFileSync(localKeyPath, 'utf8').trim() : undefined)
    if (!value) throw new Error('CASHIERS_BACKUP_KEY is required for encrypted backups.')
    return createHash('sha256').update(value).digest()
  }

  private encrypt(data: Buffer): Buffer {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv)
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()])
    const envelope: BackupEnvelope = { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: encrypted.toString('base64') }
    return Buffer.from(JSON.stringify(envelope))
  }

  private decrypt(data: Buffer): Buffer {
    const envelope = JSON.parse(data.toString('utf8')) as BackupEnvelope
    const decipher = createDecipheriv('aes-256-gcm', this.key(), Buffer.from(envelope.iv, 'base64'))
    decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'))
    return Buffer.concat([decipher.update(Buffer.from(envelope.data, 'base64')), decipher.final()])
  }
}
