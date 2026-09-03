import type Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import type {
  GoogleSyncBranch,
  GoogleSyncProgress,
  GoogleSyncResponse,
  InstallmentAccountRecord,
  InstallmentListResult
} from '../../shared/contracts'
import { AppError } from '../database/errors'
import { googleSheetSources } from '../config/google-sheets'
import { GoogleSheetsClient } from './google-sheets-client'
import { AuthService } from './auth-service'

const normalize = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
const asRow = (headers: string[], values: string[]): Record<string, string> =>
  Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))
const number = (value: string): number => Number(value) || 0
const json = <T>(value: string, fallback: T): T => {
  try {
    return value ? (JSON.parse(value) as T) : fallback
  } catch {
    return fallback
  }
}
const recordFromSheet = (
  row: Record<string, string>,
  branch: GoogleSyncBranch
): InstallmentAccountRecord | undefined => {
  const accountId = row['account.id']
  const contractId = row.contractId || row.id
  if (!accountId || !contractId) return undefined
  return {
    account: {
      id: accountId,
      branch: row['account.branch'] || branch,
      lastName: row['account.lastName'] || '',
      firstName: row['account.firstName'] || '',
      middleName: row['account.middleName'] || undefined,
      suffix: row['account.suffix'] || undefined,
      streetSubdivision: row['account.streetSubdivision'] || undefined,
      landmarkRemarks: row['account.landmarkRemarks'] || undefined,
      latitude: row['account.latitude'] ? number(row['account.latitude']) : undefined,
      longitude: row['account.longitude'] ? number(row['account.longitude']) : undefined,
      barangay: row['account.barangay'] || '',
      cityMunicipality: row['account.cityMunicipality'] || '',
      province: row['account.province'] || '',
      occupation: row['account.occupation'] || undefined,
      civilStatus: row['account.civilStatus'] || undefined,
      contacts: json(row['account.contacts'], []),
      emails: json(row['account.emails'], []),
      agent: row['account.agent'] || undefined,
      referredBy: row['account.referredBy'] || undefined,
      createdAt: row['account.createdAt'] || '',
      updatedAt: row['account.updatedAt'] || ''
    },
    loan: {
      id: row['loan.id'] || contractId,
      customerId: row['loan.customerId'] || accountId,
      dateReleased: row['loan.dateReleased'] || '',
      startDate: row['loan.startDate'] || '',
      firstDueDate: row['loan.firstDueDate'] || '',
      paymentFrequency: row['loan.paymentFrequency'] || '',
      terms: row['loan.terms'] || '',
      principal: number(row['loan.principal']),
      interest: number(row['loan.interest']),
      downPayment: number(row['loan.downPayment']),
      fees: number(row['loan.fees']),
      installmentAmount: number(row['loan.installmentAmount']),
      grandTotal: number(row['loan.grandTotal']),
      items: json(row['loan.items'], []),
      remarks: row['loan.remarks'] || undefined,
      createdAt: row['loan.createdAt'] || '',
      updatedAt: row['loan.updatedAt'] || ''
    },
    accountStatus: row.accountStatus === 'BLACKLISTED' ? 'BLACKLISTED' : 'ACTIVE',
    contractStatus: ['DRAFT', 'ACTIVE', 'CLOSED', 'VOIDED', 'DEFAULTED'].includes(
      row.contractStatus
    )
      ? (row.contractStatus as InstallmentAccountRecord['contractStatus'])
      : 'ACTIVE',
    contractId,
    statusRemarks: row.statusRemarks || undefined,
    meta: {
      status: [
        'active',
        'due-today',
        'due-soon',
        'delayed',
        'overdue',
        'closed',
        'blacklisted',
        'fully-paid'
      ].includes(row['meta.status'])
        ? (row['meta.status'] as InstallmentAccountRecord['meta']['status'])
        : 'active',
      nextDue: row['meta.nextDue'] || undefined,
      outstandingBalance: row['meta.outstandingBalance']
        ? number(row['meta.outstandingBalance'])
        : undefined,
      paymentFrequency: row['meta.paymentFrequency'] || undefined,
      lastPayment: row['meta.lastPayment'] || undefined,
      delayedDays: row['meta.delayedDays'] ? number(row['meta.delayedDays']) : undefined,
      terms: row['meta.terms'] || undefined,
      installmentAmount: row['meta.installmentAmount']
        ? number(row['meta.installmentAmount'])
        : undefined,
      missedPayments: row['meta.missedPayments'] ? number(row['meta.missedPayments']) : undefined,
      dateReleased: row['meta.dateReleased'] || undefined,
      startDate: row['meta.startDate'] || undefined,
      endDate: row['meta.endDate'] || undefined,
      requiredFee: row['meta.requiredFee'] ? number(row['meta.requiredFee']) : undefined,
      grandTotal: row['meta.grandTotal'] ? number(row['meta.grandTotal']) : undefined,
      principal: row['meta.principal'] ? number(row['meta.principal']) : undefined,
      interest: row['meta.interest'] ? number(row['meta.interest']) : undefined,
      totalInterest: row['meta.totalInterest'] ? number(row['meta.totalInterest']) : undefined,
      downPayment: row['meta.downPayment'] ? number(row['meta.downPayment']) : undefined,
      totalPaid: row['meta.totalPaid'] ? number(row['meta.totalPaid']) : undefined
    }
  }
}
const childTables = [
  {
    sheet: 'INCOME',
    table: 'income_entries',
    columns: [
      'id',
      'daily_report_id',
      'category_id',
      'transaction_date',
      'particular',
      'receipt_number',
      'remarks',
      'amount_centavos',
      'status',
      'voided_at',
      'voided_by_user_id',
      'void_reason',
      'created_by_user_id',
      'created_at',
      'updated_at'
    ],
    numeric: ['amount_centavos']
  },
  {
    sheet: 'PAYMENTS',
    table: 'daily_report_payment_entries',
    columns: [
      'id',
      'daily_report_id',
      'payment_method_id',
      'transaction_date',
      'amount_centavos',
      'reference_number',
      'bank_name',
      'payer_name',
      'remarks',
      'status',
      'voided_at',
      'voided_by_user_id',
      'void_reason',
      'created_by_user_id',
      'created_at',
      'updated_at'
    ],
    numeric: ['amount_centavos']
  },
  {
    sheet: 'EXPENSES',
    table: 'expense_entries',
    columns: [
      'id',
      'daily_report_id',
      'category_id',
      'transaction_date',
      'description',
      'receipt_number',
      'vat_type',
      'vat_amount_centavos',
      'gross_amount_centavos',
      'payment_method_code',
      'reference_number',
      'remarks',
      'status',
      'voided_at',
      'voided_by_user_id',
      'void_reason',
      'created_by_user_id',
      'created_at',
      'updated_at'
    ],
    numeric: ['vat_amount_centavos', 'gross_amount_centavos']
  },
  {
    sheet: 'RECEIPTS',
    table: 'daily_receipt_totals',
    columns: [
      'id',
      'daily_report_id',
      'receipt_type_id',
      'quantity',
      'amount_centavos',
      'created_at',
      'updated_at'
    ],
    numeric: ['quantity', 'amount_centavos']
  },
  {
    sheet: 'CASH_COUNTS',
    table: 'daily_report_cash_counts',
    columns: ['id', 'daily_report_id', 'denomination_id', 'quantity', 'created_at', 'updated_at'],
    numeric: ['quantity']
  }
] as const

const branchDataSheets = [
  'Income',
  'Expenses',
  'Payment',
  'Records',
  'Payments',
  'Finance'
] as const
type BranchDataSheet = (typeof branchDataSheets)[number]
type CachedSheet = { sheet: BranchDataSheet; values: string[][]; loaded: boolean }
type ProgressPhase = GoogleSyncProgress['phase']

export class GoogleSheetSyncService {
  constructor(
    private readonly database: Database.Database,
    private readonly sheets: GoogleSheetsClient,
    private readonly auth: AuthService,
    private readonly onProgress?: (progress: GoogleSyncProgress) => void
  ) {}

  async syncBranch(branch: GoogleSyncBranch): Promise<GoogleSyncResponse> {
    this.auth.requireCashierWorkspace()
    const spreadsheetId = googleSheetSources[branch]
    let completed = 0
    let total = branchDataSheets.length + 1
    const report = (
      sheet: string,
      phase: ProgressPhase,
      options: { rowCount?: number; message?: string; terminal?: boolean } = {}
    ): void => {
      if (options.terminal) completed += 1
      this.onProgress?.({
        branch,
        sheet,
        phase,
        completed,
        total,
        ...(options.rowCount === undefined ? {} : { rowCount: options.rowCount }),
        ...(options.message ? { message: options.message } : {})
      })
    }
    const download = async (sheet: BranchDataSheet): Promise<CachedSheet> => {
      report(sheet, 'downloading')
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          const values = await this.sheets.values(spreadsheetId, `${sheet}!A:ZZ`)
          const rowCount = Math.max(0, values.length - 1)
          console.info(`[Google sync] ${branch} ${sheet}: downloaded ${rowCount} row(s).`)
          report(sheet, 'completed', { rowCount, terminal: true })
          return { sheet, values, loaded: true }
        } catch {
          if (attempt === 1) {
            console.info(`[Google sync] ${branch} ${sheet}: retrying download.`)
            report(sheet, 'retrying', { message: 'Retrying download.' })
            continue
          }
        }
      }
      console.warn(`[Google sync] ${branch} ${sheet}: download failed; retained cached data.`)
      report(sheet, 'failed', {
        message: 'Could not download this sheet. Cached data was kept.',
        terminal: true
      })
      return { sheet, values: [], loaded: false }
    }
    console.info(`[Google sync] ${branch}: starting download.`)
    const branchData = await Promise.all(branchDataSheets.map(download))
    this.cacheBranchData(spreadsheetId, branch, branchData)
    report('REPORTS', 'downloading')
    const values = await this.sheets.values(spreadsheetId, 'REPORTS!A:Z').catch(() => undefined)
    const result = { branch, imported: 0, duplicates: 0, conflicts: 0, invalid: 0, missingTabs: [] }
    if (!values?.length) {
      console.info(`[Google sync] ${branch} REPORTS: no legacy report data to import.`)
      report('REPORTS', 'completed', { rowCount: 0, terminal: true })
      console.info(`[Google sync] ${branch}: completed ${completed}/${total} sheet operation(s).`)
      return result
    }
    total += childTables.length
    const headers = values[0].map(normalize)
    const run = this.database.transaction(() => {
      const branchRow = this.database
        .prepare('SELECT id FROM branches WHERE name = ? AND is_active = 1')
        .get(branch) as { id: string } | undefined
      if (!branchRow) throw new AppError('NOT_FOUND', 'Branch was not found.')
      for (let index = 1; index < values.length; index += 1) {
        const row = asRow(headers, values[index])
        const id = row.id
        const sourceUpdatedAt = row.updated_at
        const businessDate = row.business_date
        const cashier = row.cashier_user_id
          ? this.database
              .prepare(
                'SELECT u.id FROM users u JOIN user_branch_assignments uba ON uba.user_id = u.id WHERE u.id = ? AND uba.branch_id = ? AND u.is_active = 1'
              )
              .get(row.cashier_user_id, branchRow.id)
          : undefined
        const validStatus = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REOPENED', 'VOIDED'].includes(
          row.status || 'DRAFT'
        )
        if (
          !id ||
          !sourceUpdatedAt ||
          !cashier ||
          !validStatus ||
          !/^\d{4}-\d{2}-\d{2}$/.test(businessDate) ||
          Number.isNaN(Date.parse(sourceUpdatedAt))
        ) {
          result.invalid += 1
          this.recordImport(
            spreadsheetId,
            'REPORTS',
            index + 1,
            id || `row-${index + 1}`,
            sourceUpdatedAt || '',
            'INVALID',
            'Missing id, updated_at, or valid business_date'
          )
          continue
        }
        const local = this.database
          .prepare('SELECT updated_at FROM daily_reports WHERE id = ?')
          .get(id) as { updated_at: string } | undefined
        const imported = this.database
          .prepare(
            'SELECT 1 FROM google_sheet_imports WHERE spreadsheet_id = ? AND sheet_name = ? AND source_record_id = ? AND source_updated_at = ?'
          )
          .get(spreadsheetId, 'REPORTS', id, sourceUpdatedAt)
        if (imported) {
          result.duplicates += 1
          continue
        }
        if (local && local.updated_at > sourceUpdatedAt) {
          result.conflicts += 1
          this.database
            .prepare(
              'INSERT INTO google_sheet_conflicts (id, spreadsheet_id, sheet_name, source_row, source_record_id, local_updated_at, source_updated_at, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
            )
            .run(
              randomUUID(),
              spreadsheetId,
              'REPORTS',
              index + 1,
              id,
              local.updated_at,
              sourceUpdatedAt,
              JSON.stringify(row),
              new Date().toISOString()
            )
          this.recordImport(
            spreadsheetId,
            'REPORTS',
            index + 1,
            id,
            sourceUpdatedAt,
            'CONFLICT',
            'Local record is newer than source row'
          )
          continue
        }
        const fields = [
          branchRow.id,
          row.cashier_user_id,
          businessDate,
          Number(row.opening_cash_centavos || 0),
          row.cash_remitted_centavos ? Number(row.cash_remitted_centavos) : null,
          row.status || 'DRAFT',
          row.submitted_at || null,
          row.approved_at || null,
          row.approved_by_user_id || null,
          row.created_at || sourceUpdatedAt,
          sourceUpdatedAt,
          id
        ]
        if (local)
          this.database
            .prepare(
              'UPDATE daily_reports SET branch_id = ?, cashier_user_id = ?, business_date = ?, opening_cash_centavos = ?, cash_remitted_centavos = ?, status = ?, submitted_at = ?, approved_at = ?, approved_by_user_id = ?, created_at = ?, updated_at = ? WHERE id = ?'
            )
            .run(...fields)
        else
          this.database
            .prepare(
              'INSERT INTO daily_reports (branch_id, cashier_user_id, business_date, opening_cash_centavos, cash_remitted_centavos, status, submitted_at, approved_at, approved_by_user_id, created_at, updated_at, id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            )
            .run(...fields)
        result.imported += 1
        this.recordImport(
          spreadsheetId,
          'REPORTS',
          index + 1,
          id,
          sourceUpdatedAt,
          'IMPORTED',
          null
        )
      }
    })
    run()
    for (const definition of childTables) {
      report(definition.sheet, 'importing')
      const childValues = await this.sheets
        .values(spreadsheetId, `${definition.sheet}!A:Z`)
        .catch(() => undefined)
      if (!childValues) {
        console.warn(`[Google sync] ${branch} ${definition.sheet}: import failed.`)
        report(definition.sheet, 'failed', {
          message: 'Could not import this sheet.',
          terminal: true
        })
        continue
      }
      const importedBefore = result.imported
      this.importChildren(spreadsheetId, definition, childValues, result)
      const rowCount = Math.max(0, childValues.length - 1)
      console.info(
        `[Google sync] ${branch} ${definition.sheet}: imported ${result.imported - importedBefore}/${rowCount} row(s).`
      )
      report(definition.sheet, 'completed', { rowCount, terminal: true })
    }
    report('REPORTS', 'completed', { rowCount: Math.max(0, values.length - 1), terminal: true })
    console.info(`[Google sync] ${branch}: completed ${completed}/${total} sheet operation(s).`)
    return result
  }

  async listRecords(): Promise<InstallmentListResult> {
    return this.listAccountSheet('Records')
  }

  async listBlacklisted(): Promise<InstallmentListResult> {
    return this.listAccountSheet('Records', true)
  }

  private async listAccountSheet(
    sheet: 'Records',
    onlyBlacklisted = false
  ): Promise<InstallmentListResult> {
    this.auth.requireCashierWorkspace()
    const rows = this.database
      .prepare(
        'SELECT payload_json, source_branch FROM google_sheet_branch_cache WHERE sheet_name = ? AND source_branch <> ?'
      )
      .all(sheet, '') as Array<{ payload_json: string; source_branch: GoogleSyncBranch }>
    const records = rows.flatMap(({ payload_json, source_branch }) => {
      const payload = json<InstallmentAccountRecord | Record<string, string>>(payload_json, {})
      const record: InstallmentAccountRecord | undefined =
        'account' in payload && 'loan' in payload
          ? (payload as InstallmentAccountRecord)
          : recordFromSheet(payload, source_branch)
      if (!record || (onlyBlacklisted && record.accountStatus !== 'BLACKLISTED')) return []
      return [record]
    })
    return {
      rows: [...new Map(records.map((record) => [record.contractId, record])).values()]
    }
  }

  private importChildren(
    spreadsheetId: string,
    definition: (typeof childTables)[number],
    values: string[][],
    result: GoogleSyncResponse
  ): void {
    if (values.length < 2) return
    const headers = values[0].map(normalize)
    const run = this.database.transaction(() => {
      for (let index = 1; index < values.length; index += 1) {
        const row = asRow(headers, values[index])
        const id = row.id
        const sourceUpdatedAt = row.updated_at
        const report = row.daily_report_id
          ? this.database
              .prepare('SELECT id FROM daily_reports WHERE id = ?')
              .get(row.daily_report_id)
          : undefined
        if (!id || !sourceUpdatedAt || !report || Number.isNaN(Date.parse(sourceUpdatedAt))) {
          result.invalid += 1
          this.recordImport(
            spreadsheetId,
            definition.sheet,
            index + 1,
            id || `row-${index + 1}`,
            sourceUpdatedAt || '',
            'INVALID',
            'Missing id, updated_at, or local report'
          )
          continue
        }
        if (
          this.database
            .prepare(
              'SELECT 1 FROM google_sheet_imports WHERE spreadsheet_id = ? AND sheet_name = ? AND source_record_id = ? AND source_updated_at = ?'
            )
            .get(spreadsheetId, definition.sheet, id, sourceUpdatedAt)
        ) {
          result.duplicates += 1
          continue
        }
        const local = this.database
          .prepare(`SELECT updated_at FROM ${definition.table} WHERE id = ?`)
          .get(id) as { updated_at: string } | undefined
        if (local && local.updated_at > sourceUpdatedAt) {
          result.conflicts += 1
          this.database
            .prepare(
              'INSERT INTO google_sheet_conflicts (id, spreadsheet_id, sheet_name, source_row, source_record_id, local_updated_at, source_updated_at, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
            )
            .run(
              randomUUID(),
              spreadsheetId,
              definition.sheet,
              index + 1,
              id,
              local.updated_at,
              sourceUpdatedAt,
              JSON.stringify(row),
              new Date().toISOString()
            )
          this.recordImport(
            spreadsheetId,
            definition.sheet,
            index + 1,
            id,
            sourceUpdatedAt,
            'CONFLICT',
            'Local record is newer than source row'
          )
          continue
        }
        const actorId = row.created_by_user_id || this.auth.requireSession().id
        const valuesForColumns = definition.columns.map((column) => {
          if (column === 'created_by_user_id') return actorId
          if (column === 'created_at') return row[column] || sourceUpdatedAt
          if (column === 'updated_at') return sourceUpdatedAt
          if (column === 'status') return row[column] || 'POSTED'
          if (definition.numeric.includes(column as never)) return Number(row[column] || 0)
          return row[column] || null
        })
        try {
          if (local) {
            const assignments = definition.columns
              .filter((column) => column !== 'id')
              .map((column) => `${column} = ?`)
              .join(', ')
            this.database
              .prepare(`UPDATE ${definition.table} SET ${assignments} WHERE id = ?`)
              .run(
                ...valuesForColumns.filter(
                  (_, columnIndex) => definition.columns[columnIndex] !== 'id'
                ),
                id
              )
          } else {
            this.database
              .prepare(
                `INSERT INTO ${definition.table} (${definition.columns.join(', ')}) VALUES (${definition.columns.map(() => '?').join(', ')})`
              )
              .run(...valuesForColumns)
          }
          result.imported += 1
          this.recordImport(
            spreadsheetId,
            definition.sheet,
            index + 1,
            id,
            sourceUpdatedAt,
            'IMPORTED',
            null
          )
        } catch {
          result.invalid += 1
          this.recordImport(
            spreadsheetId,
            definition.sheet,
            index + 1,
            id,
            sourceUpdatedAt,
            'INVALID',
            'Row failed SQLite validation'
          )
        }
      }
    })
    run()
  }

  private cacheBranchData(
    spreadsheetId: string,
    branch: GoogleSyncBranch,
    sheets: ReadonlyArray<CachedSheet>
  ): void {
    const downloadedAt = new Date().toISOString()
    const replaceSheet = this.database.prepare(
      'DELETE FROM google_sheet_branch_cache WHERE spreadsheet_id = ? AND sheet_name = ?'
    )
    const insert = this.database.prepare(
      'INSERT INTO google_sheet_branch_cache (spreadsheet_id, sheet_name, source_record_id, source_row, payload_json, downloaded_at, source_branch) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    this.database.transaction(() => {
      for (const { sheet, values, loaded } of sheets) {
        if (!loaded) continue
        replaceSheet.run(spreadsheetId, sheet)
        if (values.length < 2) continue
        const headers = values[0]
        for (let index = 1; index < values.length; index += 1) {
          const row = asRow(headers, values[index])
          insert.run(
            spreadsheetId,
            sheet,
            row.id || `row-${index + 1}`,
            index + 1,
            JSON.stringify(row),
            downloadedAt,
            branch
          )
        }
      }
    })()
  }

  private recordImport(
    spreadsheetId: string,
    sheetName: string,
    sourceRow: number,
    sourceRecordId: string,
    sourceUpdatedAt: string,
    status: string,
    detail: string | null
  ): void {
    this.database
      .prepare(
        'INSERT OR IGNORE INTO google_sheet_imports (id, spreadsheet_id, sheet_name, source_row, source_record_id, source_updated_at, status, detail, imported_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        randomUUID(),
        spreadsheetId,
        sheetName,
        sourceRow,
        sourceRecordId,
        sourceUpdatedAt,
        status,
        detail,
        new Date().toISOString()
      )
  }
}
