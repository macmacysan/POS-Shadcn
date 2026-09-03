import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import type {
  GoogleSyncBranch,
  GoogleSyncProgress,
  GoogleSyncResponse,
  InstallmentListResult
} from '../../shared/contracts'
import type { AppDatabase } from '../database/database'
import { AppError } from '../database/errors'
import { InstallmentRepository } from '../database/installment-repository'
import { googleDriveSnapshotFolders } from '../config/google-sheets'
import { AuthService } from './auth-service'
import { BackupService } from './backup-service'
import { GoogleSheetsClient } from './google-sheets-client'

const branches = ['Goa', 'Tinambac', 'Tigaon', 'Lagonoy'] as const
const fileName = (branch: GoogleSyncBranch): string =>
  `cashiers-report-${branch.toLowerCase()}.db.gz.enc`

/** Replicates immutable encrypted database snapshots; it never writes remote rows into local business tables. */
export class GoogleDriveSnapshotService {
  private uploading: Promise<void> | undefined

  constructor(
    private readonly database: AppDatabase,
    private readonly databasePath: string,
    private readonly cacheDirectory: string,
    private readonly backup: BackupService,
    private readonly drive: GoogleSheetsClient,
    private readonly auth: AuthService,
    private readonly onProgress?: (progress: GoogleSyncProgress) => void,
    private readonly legacyReadModels?: {
      listRecords(): Promise<InstallmentListResult>
      listBlacklisted(): Promise<InstallmentListResult>
    }
  ) {}

  async uploadActiveBranch(): Promise<void> {
    const user = this.auth.requireCashierWorkspace()
    if (this.uploading) return this.uploading
    this.uploading = this.upload(user.branch as GoogleSyncBranch).finally(() => {
      this.uploading = undefined
    })
    return this.uploading
  }

  /** Background writes must never surface as unhandled promise rejections. */
  queueActiveBranchUpload(): void {
    void this.uploadActiveBranch().catch(() => undefined)
  }

  async syncBranch(branch: GoogleSyncBranch): Promise<GoogleSyncResponse> {
    const user = this.auth.requireCashierWorkspace()
    if (user.branch === branch) {
      await this.uploadActiveBranch()
      return this.result(branch)
    }
    this.progress(branch, 'snapshot', 'downloading')
    try {
      const remote = await this.drive.findDriveFile(await this.folderId(branch), fileName(branch))
      if (!remote) throw new Error('No branch snapshot is available yet.')
      if (remote.appProperties?.branch !== branch)
        throw new Error('Snapshot branch identity does not match its Drive file.')
      const known = this.database
        .prepare('SELECT remote_revision FROM google_drive_snapshots WHERE branch = ?')
        .get(branch) as { remote_revision: string | null } | undefined
      const recordsCached = this.database
        .prepare(
          "SELECT 1 FROM google_sheet_branch_cache WHERE source_branch = ? AND sheet_name = 'Records' LIMIT 1"
        )
        .get(branch)
      if (known?.remote_revision === remote.version && recordsCached) return this.result(branch)
      const encrypted = await this.drive.downloadDriveFile(remote)
      const checksum = createHash('sha256').update(encrypted).digest('hex')
      if (remote.appProperties?.sha256 && remote.appProperties.sha256 !== checksum)
        throw new Error('Snapshot checksum validation failed.')
      this.progress(branch, 'snapshot', 'validating')
      mkdirSync(this.cacheDirectory, { recursive: true })
      const encryptedPath = join(this.cacheDirectory, `${branch}.db.gz.enc`)
      const sqlitePath = join(this.cacheDirectory, `${branch}.db`)
      writeFileSync(encryptedPath, encrypted)
      this.backup.restoreToValidated(encryptedPath, sqlitePath)
      const source = new Database(sqlitePath, { readonly: true })
      try {
        const sourceBranch = source.prepare('SELECT name FROM branches WHERE name = ?').get(branch)
        if (!sourceBranch) throw new Error('Snapshot does not contain its declared branch.')
        this.progress(branch, 'snapshot', 'importing')
        const imported = this.importReadModels(source, branch, remote.id)
        console.info(`[Google Drive] ${branch}: imported ${imported} cached record(s).`)
        this.database
          .prepare(
            `INSERT INTO google_drive_snapshots (branch, remote_file_id, remote_revision, sha256, downloaded_at, last_error)
          VALUES (?, ?, ?, ?, ?, NULL)
          ON CONFLICT(branch) DO UPDATE SET remote_file_id = excluded.remote_file_id, remote_revision = excluded.remote_revision, sha256 = excluded.sha256, downloaded_at = excluded.downloaded_at, last_error = NULL`
          )
          .run(branch, remote.id, remote.version, checksum, new Date().toISOString())
        this.progress(branch, 'snapshot', 'completed', imported)
      } finally {
        source.close()
      }
      return this.result(branch)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Snapshot download failed.'
      this.database
        .prepare(
          `INSERT INTO google_drive_snapshots (branch, last_error) VALUES (?, ?) ON CONFLICT(branch) DO UPDATE SET last_error = excluded.last_error`
        )
        .run(branch, message)
      this.progress(branch, 'snapshot', 'failed', undefined, message)
      throw new AppError('DATABASE_ERROR', message)
    }
  }

  async syncOtherBranches(): Promise<void> {
    const active = this.auth.requireCashierWorkspace().branch
    await Promise.all(
      branches
        .filter((branch) => branch !== active)
        .map((branch) => this.syncBranch(branch).catch(() => undefined))
    )
  }

  async listRecords(): Promise<InstallmentListResult> {
    if (!this.legacyReadModels) return { rows: [] }
    return this.legacyReadModels.listRecords()
  }

  async listBlacklisted(): Promise<InstallmentListResult> {
    if (!this.legacyReadModels) return { rows: [] }
    return this.legacyReadModels.listBlacklisted()
  }

  /** Downloads and validates a branch snapshot without changing the live database. */
  async prepareInitialRestore(branch: GoogleSyncBranch): Promise<string | undefined> {
    const remote = await this.drive.findDriveFile(this.folderId(branch), fileName(branch))
    if (!remote) return undefined
    if (remote.appProperties?.branch !== branch)
      throw new Error('Snapshot branch identity does not match its Drive file.')
    const encrypted = await this.drive.downloadDriveFile(remote)
    const checksum = createHash('sha256').update(encrypted).digest('hex')
    if (remote.appProperties?.sha256 && remote.appProperties.sha256 !== checksum)
      throw new Error('Snapshot checksum validation failed.')
    mkdirSync(this.cacheDirectory, { recursive: true })
    const encryptedPath = join(this.cacheDirectory, `${branch}.initial.db.gz.enc`)
    const sqlitePath = join(
      this.cacheDirectory,
      `${branch}.initial-${randomBytes(8).toString('hex')}.db`
    )
    writeFileSync(encryptedPath, encrypted)
    try {
      this.backup.restoreToValidated(encryptedPath, sqlitePath)
      const source = new Database(sqlitePath)
      try {
        const sourceBranch = source.prepare('SELECT name FROM branches WHERE name = ?').get(branch)
        if (!sourceBranch) throw new Error('Snapshot does not contain its declared branch.')
        const cashierLoginBranch = source
          .prepare("SELECT value FROM app_settings WHERE key = 'cashier_login_branch'")
          .get() as { value: string } | undefined
        if (!cashierLoginBranch?.value.trim())
          source
            .prepare(
              `INSERT INTO app_settings (key, value, updated_at) VALUES ('cashier_login_branch', ?, ?)
               ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
            )
            .run(branch, new Date().toISOString())
      } finally {
        source.close()
      }
      return sqlitePath
    } catch (error) {
      if (existsSync(sqlitePath)) unlinkSync(sqlitePath)
      throw error
    }
  }

  private async upload(branch: GoogleSyncBranch): Promise<void> {
    this.progress(branch, 'snapshot', 'uploading')
    try {
      console.info(`[Google Drive] ${branch}: creating encrypted snapshot.`)
      const snapshot = await this.backup.create(this.databasePath, this.cacheDirectory)
      const data = readFileSync(snapshot.filePath)
      const sha256 = createHash('sha256').update(data).digest('hex')
      const folderId = await this.folderId(branch)
      const previous = await this.drive.findDriveFile(folderId, fileName(branch))
      if (previous?.appProperties?.branch && previous.appProperties.branch !== branch)
        throw new Error('Refusing to overwrite a snapshot owned by another branch.')
      const remote = await this.drive.replaceDriveFile({
        folderId,
        name: fileName(branch),
        data,
        file: previous,
        appProperties: { branch, sha256, format: 'cashiers-report-sqlite-v1' }
      })
      this.database
        .prepare(
          `INSERT INTO google_drive_snapshots (branch, remote_file_id, remote_revision, sha256, uploaded_at, last_error)
        VALUES (?, ?, ?, ?, ?, NULL)
        ON CONFLICT(branch) DO UPDATE SET remote_file_id = excluded.remote_file_id, remote_revision = excluded.remote_revision, sha256 = excluded.sha256, uploaded_at = excluded.uploaded_at, last_error = NULL`
        )
        .run(branch, remote.id, remote.version, sha256, new Date().toISOString())
      console.info(`[Google Drive] ${branch}: snapshot upload completed.`)
      this.progress(branch, 'snapshot', 'uploaded')
    } catch (error) {
      console.warn(`[Google Drive] ${branch}: snapshot upload failed.`)
      const message = error instanceof Error ? error.message : 'Snapshot upload failed.'
      this.database
        .prepare(
          `INSERT INTO google_drive_snapshots (branch, last_error) VALUES (?, ?) ON CONFLICT(branch) DO UPDATE SET last_error = excluded.last_error`
        )
        .run(branch, message)
      this.progress(branch, 'snapshot', 'retrying', undefined, message)
      throw new AppError('DATABASE_ERROR', message)
    }
  }

  private importReadModels(
    source: Database.Database,
    branch: GoogleSyncBranch,
    remoteFileId: string
  ): number {
    const rows: Array<{ sheet: string; id: string; payload: unknown }> = []
    const collect = (sheet: string, sql: string): void => {
      for (const row of source.prepare(sql).all(branch) as Array<Record<string, unknown>>)
        rows.push({ sheet, id: String(row.id), payload: row })
    }
    collect(
      'Income',
      `SELECT i.*, dr.business_date AS businessDate, dr.cashier_user_id AS cashierUserId, u.display_name AS createdByName, COALESCE(NULLIF(u.first_name, ''), u.display_name) AS createdByFirstName FROM income_entries i JOIN daily_reports dr ON dr.id=i.daily_report_id JOIN branches b ON b.id=dr.branch_id LEFT JOIN users u ON u.id=i.created_by_user_id WHERE b.name=?`
    )
    collect(
      'Expenses',
      `SELECT e.*, e.report_id AS reportId, dr.business_date AS businessDate, dr.cashier_user_id AS cashierUserId, u.display_name AS createdByName, COALESCE(NULLIF(u.first_name, ''), u.display_name) AS createdByFirstName FROM expenses e JOIN daily_reports dr ON dr.id=e.report_id JOIN branches b ON b.id=dr.branch_id LEFT JOIN users u ON u.id=e.created_by_user_id WHERE b.name=?`
    )
    collect(
      'Payment',
      `SELECT p.*, p.daily_report_id AS dailyReportId, u.display_name AS createdByName, COALESCE(NULLIF(u.first_name, ''), u.display_name) AS createdByFirstName FROM daily_report_payment_entries p JOIN daily_reports dr ON dr.id=p.daily_report_id JOIN branches b ON b.id=dr.branch_id LEFT JOIN users u ON u.id=p.created_by_user_id WHERE b.name=?`
    )
    collect(
      'Finance',
      `SELECT f.id, f.branch, f.provider, f.date_released AS dateReleased, f.terms_months AS termsMonths, f.last_name AS lastName, f.first_name AS firstName, f.middle_name AS middleName, f.suffix, f.downpayment_centavos AS downpaymentCentavos, f.grand_total_centavos AS grandTotalCentavos, f.balance_centavos AS balanceCentavos, f.or_number AS orNumber, f.or_date AS orDate, f.paid_date AS paidDate, f.remarks, f.created_at AS createdAt, f.updated_at AS updatedAt, f.status, f.voided_at AS voidedAt, f.voided_by_user_id AS voidedByUserId, f.void_reason AS voidReason, json_group_array(json_object('id', i.id, 'item', i.item, 'serialNo', i.serial_no, 'quantity', i.quantity, 'itemPriceCentavos', i.item_price_centavos, 'totalCentavos', i.total_centavos)) AS items FROM finance_accounts f LEFT JOIN finance_account_items i ON i.finance_account_id=f.id WHERE f.branch=? GROUP BY f.id`
    )
    const records = new InstallmentRepository(source).list({
      view: 'records',
      search: '',
      branch,
      includeVoided: false
    }).rows
    rows.push(
      ...records.map((record) => ({
        sheet: 'Records',
        id: record.contractId || record.account.id,
        payload: record
      }))
    )
    const now = new Date().toISOString()
    const replace = this.database.transaction(() => {
      this.database
        .prepare('DELETE FROM google_sheet_branch_cache WHERE source_branch = ?')
        .run(branch)
      const insert = this.database.prepare(
        'INSERT INTO google_sheet_branch_cache (spreadsheet_id, sheet_name, source_record_id, source_row, payload_json, downloaded_at, source_branch) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      rows.forEach((row, index) =>
        insert.run(
          remoteFileId,
          row.sheet,
          row.id,
          index + 1,
          JSON.stringify(row.payload),
          now,
          branch
        )
      )
    })
    replace()
    return rows.length
  }

  private folderId(branch: GoogleSyncBranch): string {
    return googleDriveSnapshotFolders[branch]
  }

  private result(branch: GoogleSyncBranch): GoogleSyncResponse {
    return { branch, imported: 0, duplicates: 0, conflicts: 0, invalid: 0, missingTabs: [] }
  }
  private progress(
    branch: GoogleSyncBranch,
    sheet: string,
    phase: GoogleSyncProgress['phase'],
    rowCount?: number,
    message?: string
  ): void {
    this.onProgress?.({
      branch,
      sheet,
      phase,
      completed: 1,
      total: 1,
      ...(rowCount === undefined ? {} : { rowCount }),
      ...(message ? { message } : {})
    })
  }
}
