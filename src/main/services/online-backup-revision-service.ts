import { createHash, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import type { GoogleSyncBranch, OnlineBackupRevision } from '../../shared/contracts'
import type { AppDatabase } from '../database/database'
import { BackupService } from './backup-service'
import { type DriveFile, GoogleSheetsClient } from './google-sheets-client'
import { googleDriveSnapshotFolders } from '../config/google-sheets'

const revisionType = 'online-revision'
const dateKey = (date = new Date()): string =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-')
const weekKey = (date: Date): string => {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  local.setDate(local.getDate() + 4 - (local.getDay() || 7))
  const year = local.getFullYear()
  const start = new Date(year, 0, 1)
  return `${year}-${String(Math.ceil(((local.getTime() - start.getTime()) / 86400000 + 1) / 7)).padStart(2, '0')}`
}
const monthKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

export class OnlineBackupRevisionService {
  private readonly creating = new Map<GoogleSyncBranch, Promise<void>>()

  constructor(
    private readonly database: AppDatabase,
    private readonly databasePath: string,
    private readonly cacheDirectory: string,
    private readonly backup: BackupService,
    private readonly drive: GoogleSheetsClient
  ) {}

  queueDailyRevision(branch: GoogleSyncBranch): void {
    if (this.creating.has(branch)) return
    const task = this.createDailyRevision(branch)
      .catch(() => undefined)
      .finally(() => {
        this.creating.delete(branch)
      })
    this.creating.set(branch, task)
  }

  async createDailyRevision(branch: GoogleSyncBranch): Promise<void> {
    const key = `online_backup_revision:${branch}`
    if (
      (
        this.database.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as
          { value?: string } | undefined
      )?.value === dateKey()
    )
      return
    mkdirSync(this.cacheDirectory, { recursive: true })
    const snapshot = await this.backup.create(this.databasePath, this.cacheDirectory)
    const staged = join(this.cacheDirectory, `.revision-${randomBytes(8).toString('hex')}.db`)
    try {
      this.backup.restoreToValidated(snapshot.filePath, staged)
      this.assertBranch(staged, branch)
      const data = readFileSync(snapshot.filePath)
      const sha256 = createHash('sha256').update(data).digest('hex')
      const createdAt = new Date().toISOString()
      const remote = await this.drive.replaceDriveFile({
        folderId: googleDriveSnapshotFolders[branch],
        name: `cashiers-report-${branch.toLowerCase()}-revision-${createdAt.replace(/[:.]/g, '-')}.db.gz.enc`,
        data,
        appProperties: {
          branch,
          backup_type: revisionType,
          created_at: createdAt,
          sha256,
          verified: 'pending'
        }
      })
      await this.validateRemote(remote, branch)
      const verified = await this.drive.replaceDriveFile({
        folderId: googleDriveSnapshotFolders[branch],
        name: remote.name,
        data,
        file: remote,
        appProperties: {
          branch,
          backup_type: revisionType,
          created_at: createdAt,
          sha256,
          verified: 'true'
        }
      })
      await this.validateRemote(verified, branch)
      this.database
        .prepare(
          `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
        )
        .run(key, dateKey(), new Date().toISOString())
      await this.applyRetention(branch)
    } finally {
      if (existsSync(staged)) unlinkSync(staged)
    }
  }

  async list(branch: GoogleSyncBranch): Promise<OnlineBackupRevision[]> {
    const files = await this.revisions(branch)
    return files
      .map((file) => ({
        id: file.id,
        createdAt: file.appProperties!.created_at,
        sizeBytes: Number(file.size ?? 0),
        verified: file.appProperties!.verified === 'true'
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async stageRestore(id: string, branch: GoogleSyncBranch): Promise<string> {
    const revision = (await this.revisions(branch)).find((file) => file.id === id)
    if (!revision) throw new Error('Online backup revision was not found.')
    const data = await this.validateRemote(revision, branch)
    mkdirSync(this.cacheDirectory, { recursive: true })
    const encrypted = join(this.cacheDirectory, `.restore-${randomBytes(8).toString('hex')}.enc`)
    const staged = join(this.cacheDirectory, `.restore-${randomBytes(8).toString('hex')}.db`)
    writeFileSync(encrypted, data)
    try {
      this.backup.restoreToValidated(encrypted, staged)
      this.assertBranch(staged, branch)
      return staged
    } catch (error) {
      if (existsSync(staged)) unlinkSync(staged)
      throw error
    } finally {
      if (existsSync(encrypted)) unlinkSync(encrypted)
    }
  }

  private async revisions(branch: GoogleSyncBranch): Promise<DriveFile[]> {
    const files = await this.drive.listDriveFiles(
      googleDriveSnapshotFolders[branch],
      `appProperties has { key='backup_type' and value='${revisionType}' }`
    )
    return files.filter(
      (file) =>
        file.appProperties?.branch === branch &&
        file.appProperties.created_at &&
        file.appProperties.sha256 &&
        file.appProperties.verified === 'true'
    )
  }

  private async validateRemote(file: DriveFile, branch: GoogleSyncBranch): Promise<Buffer> {
    if (
      file.appProperties?.branch !== branch ||
      file.appProperties.backup_type !== revisionType ||
      !file.appProperties.sha256
    )
      throw new Error('Online backup revision identity does not match its Drive file.')
    const data = await this.drive.downloadDriveFile(file)
    if (createHash('sha256').update(data).digest('hex') !== file.appProperties.sha256)
      throw new Error('Online backup checksum validation failed.')
    const encrypted = join(this.cacheDirectory, `.validate-${randomBytes(8).toString('hex')}.enc`)
    const staged = join(this.cacheDirectory, `.validate-${randomBytes(8).toString('hex')}.db`)
    mkdirSync(this.cacheDirectory, { recursive: true })
    writeFileSync(encrypted, data)
    try {
      this.backup.restoreToValidated(encrypted, staged)
      this.assertBranch(staged, branch)
    } finally {
      if (existsSync(encrypted)) unlinkSync(encrypted)
      if (existsSync(staged)) unlinkSync(staged)
    }
    return data
  }

  private assertBranch(path: string, branch: GoogleSyncBranch): void {
    const database = new Database(path, { readonly: true })
    try {
      if (!database.prepare('SELECT 1 FROM branches WHERE name = ?').get(branch))
        throw new Error('Online backup does not contain its declared branch.')
    } finally {
      database.close()
    }
  }

  private async applyRetention(branch: GoogleSyncBranch): Promise<void> {
    const files = await this.revisions(branch)
    const sorted = [...files].sort((a, b) =>
      b.appProperties!.created_at.localeCompare(a.appProperties!.created_at)
    )
    const keep = new Set<string>()
    const periodKeys = (
      key: (date: Date) => string,
      limit: number,
      step: (date: Date) => void
    ): Set<string> => {
      const date = new Date()
      const keys = new Set<string>()
      for (let index = 0; index < limit; index += 1) {
        keys.add(key(date))
        step(date)
      }
      return keys
    }
    const newest = (key: (date: Date) => string, periods: Set<string>): void => {
      const seen = new Set<string>()
      for (const file of sorted) {
        const keyValue = key(new Date(file.appProperties!.created_at))
        if (periods.has(keyValue) && !seen.has(keyValue)) {
          seen.add(keyValue)
          keep.add(file.id)
        }
      }
    }
    newest(
      dateKey,
      periodKeys(dateKey, 14, (date) => date.setDate(date.getDate() - 1))
    )
    newest(
      weekKey,
      periodKeys(weekKey, 8, (date) => date.setDate(date.getDate() - 7))
    )
    newest(
      monthKey,
      periodKeys(monthKey, 12, (date) => date.setMonth(date.getMonth() - 1))
    )
    await Promise.all(
      sorted.filter((file) => !keep.has(file.id)).map((file) => this.drive.deleteDriveFile(file))
    )
  }
}
