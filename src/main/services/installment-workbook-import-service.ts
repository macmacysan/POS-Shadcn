import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'

import * as XLSX from 'xlsx'
import type Database from 'better-sqlite3'

type Issue = { sheet: string; row: number; code: string; detail: string }
export type InstallmentWorkbookImportReport = {
  sourceSha256: string
  imported: boolean
  accounts: number
  loans: number
  items: number
  payments: number
  issues: Issue[]
}

type Row = Record<string, unknown>

const sheets = ['Accounts', 'Active', 'Closed', 'Blacklisted', 'Items', 'Payments'] as const
const value = (row: Row, key: string): string => String(row[key] ?? '').trim()
const amount = (row: Row, key: string): number => {
  const parsed = Number(value(row, key).replace(/[^0-9.-]/g, '').replace(/,/g, ''))
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
}
const date = (row: Row, key: string, fallback: string): string => {
  const raw = value(row, key)
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString().slice(0, 10)
}
const frequency = (raw: string): 'Weekly' | 'Bi-weekly' | 'Monthly' =>
  raw.toLowerCase().includes('week') ? 'Weekly' : raw.toLowerCase().includes('bi') ? 'Bi-weekly' : 'Monthly'
const branch = (raw: string): { id: string; code: string; name: string } => {
  const source = raw.trim().toUpperCase() || 'IMPORT'
  const code = ({ LAGONOY: 'LAG', TIGAON: 'TIG', TINAMBAC: 'TIN', PASACAO: 'PAS' } as Record<string, string>)[source] ?? source
  const names: Record<string, string> = { GOA: 'Goa', LAG: 'Lagonoy', TIG: 'Tigaon', TIN: 'Tinambac', PAS: 'Pasacao' }
  return { id: `import-branch-${code.toLowerCase()}`, code, name: names[code] ?? code }
}
const nameParts = (raw: string): [string, string] => {
  const [last = '', first = ''] = raw.split(',', 2)
  return [last.trim(), first.trim()]
}

export class InstallmentWorkbookImportService {
  constructor(private readonly db: Database.Database) {}

  importIfPresent(path: string): InstallmentWorkbookImportReport | undefined {
    return existsSync(path) ? this.import(path) : undefined
  }

  import(path: string): InstallmentWorkbookImportReport {
    const source = readFileSync(path)
    const sourceSha256 = createHash('sha256').update(source).digest('hex')
    const previous = this.db
      .prepare('SELECT report_json FROM installment_import_runs WHERE source_sha256 = ?')
      .get(sourceSha256) as { report_json: string } | undefined
    if (previous) return { ...(JSON.parse(previous.report_json) as InstallmentWorkbookImportReport), imported: false }

    const workbook = XLSX.read(source, { type: 'buffer', cellDates: true })
    const rows = Object.fromEntries(
      sheets.map((sheet) => [sheet, XLSX.utils.sheet_to_json<Row>(workbook.Sheets[sheet], { defval: '', raw: false })])
    ) as Record<(typeof sheets)[number], Row[]>
    const missingSheets = sheets.filter((sheet) => !workbook.Sheets[sheet])
    if (missingSheets.length) throw new Error(`Missing workbook sheets: ${missingSheets.join(', ')}`)

    const issues: Issue[] = []
    const addIssue = (sheet: string, row: number, code: string, detail: string): void => {
      issues.push({ sheet, row, code, detail })
    }
    const accountIds = new Set<string>()
    const seenAccountIds = new Set<string>()
    for (const [index, row] of rows.Accounts.entries()) {
      const idcode = value(row, 'idcode')
      if (!idcode) addIssue('Accounts', index + 2, 'MISSING_ACCOUNT_ID', 'Accounts.idcode is blank.')
      else if (seenAccountIds.has(idcode)) addIssue('Accounts', index + 2, 'DUPLICATE_ACCOUNT_ID', idcode)
      else { seenAccountIds.add(idcode); accountIds.add(idcode) }
    }

    const now = new Date().toISOString()
    const today = now.slice(0, 10)
    let accounts = 0
    let loans = 0
    let items = 0
    let payments = 0
    const run = this.db.transaction(() => {
      const insertRun = this.db.prepare(
        'INSERT INTO installment_import_runs (source_sha256, source_path, imported_at, report_json) VALUES (?, ?, ?, ?)'
      )
      const upsertAccount = this.db.prepare(
        `INSERT INTO accounts (id, account_number, display_name, last_name, first_name, middle_name, suffix, street_subdivision, barangay, city_municipality, province, occupation, agent, referred_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET account_number = excluded.account_number, display_name = excluded.display_name, last_name = excluded.last_name, first_name = excluded.first_name, middle_name = excluded.middle_name, suffix = excluded.suffix, street_subdivision = excluded.street_subdivision, barangay = excluded.barangay, city_municipality = excluded.city_municipality, province = excluded.province, occupation = excluded.occupation, agent = excluded.agent, referred_by = excluded.referred_by, updated_at = excluded.updated_at`
      )
      const ensureAccount = this.db.prepare(
        `INSERT OR IGNORE INTO accounts (id, account_number, display_name, last_name, first_name, barangay, city_municipality, province, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, '', '', '', ?, ?)`
      )
      const ensureBranch = this.db.prepare(
        'INSERT OR IGNORE INTO branches (id, code, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
      )
      const findBranch = this.db.prepare('SELECT id FROM branches WHERE code = ? COLLATE NOCASE')
      const findLoan = this.db.prepare('SELECT account_id FROM installment_contracts WHERE id = ?')
      const upsertLoan = this.db.prepare(
        `INSERT INTO installment_contracts (id, account_id, branch_id, installment_type_id, contract_number, contract_date, date_released, start_date, first_due_date, payment_frequency, terms, principal_centavos, interest_centavos, down_payment_centavos, fees_centavos, installment_amount_centavos, financed_amount_centavos, total_payable_centavos, status, remarks, created_at, updated_at)
         VALUES (?, ?, ?, 'installment-type-in-house', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET account_id = excluded.account_id, branch_id = excluded.branch_id, contract_number = excluded.contract_number, contract_date = excluded.contract_date, date_released = excluded.date_released, start_date = excluded.start_date, first_due_date = excluded.first_due_date, payment_frequency = excluded.payment_frequency, terms = excluded.terms, principal_centavos = excluded.principal_centavos, interest_centavos = excluded.interest_centavos, down_payment_centavos = excluded.down_payment_centavos, fees_centavos = excluded.fees_centavos, installment_amount_centavos = excluded.installment_amount_centavos, financed_amount_centavos = excluded.financed_amount_centavos, total_payable_centavos = excluded.total_payable_centavos, status = excluded.status, remarks = excluded.remarks, updated_at = excluded.updated_at`
      )
      const insertItem = this.db.prepare(
        'INSERT OR IGNORE INTO installment_items (id, contract_id, description, quantity, unit_price_centavos, item_total_centavos, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      const insertPayment = this.db.prepare(
        `INSERT OR IGNORE INTO in_house_payments (id, contract_id, submission_id, payment_date, amount_centavos, reference_number, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )

      for (const row of rows.Accounts) {
        const idcode = value(row, 'idcode')
        if (!idcode || !accountIds.has(idcode)) continue
        const last = value(row, 'LAST NAME')
        const first = value(row, 'FIRST NAME')
        upsertAccount.run(idcode, idcode, `${last}, ${first}`.replace(/^,\s*/, ''), last, first, value(row, 'MIDDLE NAME') || null, value(row, 'SUFFIX') || null, value(row, 'STREET/SUBD') || null, value(row, 'BARANGAY'), value(row, 'CITY/MUNI'), value(row, 'PROVINCE'), value(row, 'OCCUPATION') || null, value(row, 'AGENT') || null, value(row, 'REFFERED BY') || null, now, now)
        accounts++
      }

      const loanIds = new Set<string>()
      for (const [sheet, status] of [['Active', 'ACTIVE'], ['Closed', 'CLOSED'], ['Blacklisted', 'DEFAULTED']] as const) {
        for (const [index, row] of rows[sheet].entries()) {
          const rowNumber = index + 2
          const idcode = value(row, 'idcode')
          const loanid = value(row, 'loanid')
          if (!idcode) { addIssue(sheet, rowNumber, 'MISSING_ACCOUNT_ID', 'idcode is blank.'); continue }
          if (!loanid) { addIssue(sheet, rowNumber, 'MISSING_LOAN_ID', 'loanid is blank.'); continue }
          if (!accountIds.has(idcode)) addIssue(sheet, rowNumber, 'ACCOUNT_NOT_ON_ACCOUNTS_SHEET', idcode)
          const existing = findLoan.get(loanid) as { account_id: string } | undefined
          if (existing && existing.account_id !== idcode) { addIssue(sheet, rowNumber, 'CONFLICTING_ACCOUNT_LOAN_RELATION', `${loanid}: ${existing.account_id} != ${idcode}`); continue }
          if (loanIds.has(loanid)) addIssue(sheet, rowNumber, 'DUPLICATE_LOAN_STATUS', loanid)
          loanIds.add(loanid)
          const [last, first] = nameParts(value(row, 'NAME'))
          ensureAccount.run(idcode, idcode, `${last}, ${first}`.replace(/^,\s*/, ''), last, first, now, now)
          const branchValue = branch(value(row, 'BRANCH'))
          ensureBranch.run(branchValue.id, branchValue.code, branchValue.name, now, now)
          const branchId = (findBranch.get(branchValue.code) as { id: string } | undefined)?.id
          if (!branchId) throw new Error(`Could not create branch ${branchValue.code}.`)
          const released = date(row, 'DATEREL', today)
          const grandTotal = amount(row, 'GRANDTOTAL')
          const downPayment = amount(row, 'DOWNPAYMENT')
          upsertLoan.run(loanid, idcode, branchId, loanid, released, released, date(row, 'STARTDATE', released), date(row, 'NEXTDUE', released), frequency(value(row, 'FREQUENCY')), value(row, 'TERMS') || '1', grandTotal, amount(row, 'INTEREST'), downPayment, amount(row, 'REQUIREDFEE'), amount(row, 'TOTALINS'), Math.max(0, grandTotal - downPayment), grandTotal, status, value(row, 'NOTE') || null, now, now)
          loans++
        }
      }

      const importChildren = (sheet: 'Items' | 'Payments'): void => {
        for (const [index, row] of rows[sheet].entries()) {
          const rowNumber = index + 2
          const idcode = value(row, 'idcode')
          const loanid = value(row, 'loanid')
          if (!idcode) { addIssue(sheet, rowNumber, 'MISSING_ACCOUNT_ID', 'idcode is blank.'); continue }
          if (!loanid) { addIssue(sheet, rowNumber, 'MISSING_LOAN_ID', 'loanid is blank.'); continue }
          const loan = findLoan.get(loanid) as { account_id: string } | undefined
          if (!loan || loan.account_id !== idcode) { addIssue(sheet, rowNumber, sheet === 'Items' ? 'ORPHAN_ITEM_ROW' : 'ORPHAN_PAYMENT_ROW', `${idcode}/${loanid}`); continue }
          const key = createHash('sha256').update(`${sourceSha256}:${sheet}:${rowNumber}`).digest('hex')
          if (sheet === 'Items') {
            const quantity = Math.max(1, Math.round(Number(value(row, 'QTY')) || 1))
            const price = amount(row, 'UNITPRICE') || amount(row, 'COST')
            insertItem.run(key, loanid, value(row, 'ITEM') || 'Imported item', quantity, price, quantity * price, now, now)
            items++
          } else {
            const paid = amount(row, 'Amount Paid')
            if (paid <= 0) { addIssue(sheet, rowNumber, 'INVALID_PAYMENT_AMOUNT', value(row, 'Amount Paid')); continue }
            insertPayment.run(key, loanid, key, date(row, 'Date of Payment (M/D/YY)', today), paid, value(row, 'OR#') || null, now, now)
            payments++
          }
        }
      }
      importChildren('Items')
      importChildren('Payments')

      const report: InstallmentWorkbookImportReport = { sourceSha256, imported: true, accounts, loans, items, payments, issues }
      insertRun.run(sourceSha256, path, now, JSON.stringify(report))
      const insertIssue = this.db.prepare('INSERT INTO installment_import_issues (source_sha256, sheet_name, row_number, code, detail) VALUES (?, ?, ?, ?, ?)')
      for (const issue of issues) insertIssue.run(sourceSha256, issue.sheet, issue.row, issue.code, issue.detail)
    })
    run()
    return { sourceSha256, imported: true, accounts, loans, items, payments, issues }
  }
}
