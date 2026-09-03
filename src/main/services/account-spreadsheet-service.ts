import type { UserRepository } from '../database/user-repository'
import { googleSheetSources } from '../config/google-sheets'
import { GoogleSheetsClient } from './google-sheets-client'

const branches = ['Goa', 'Lagonoy', 'Tigaon', 'Tinambac'] as const
type AccountRow = {
  active: boolean
  role: 'ADMIN' | 'CASHIER'
  firstName: string
  lastName: string
  username: string
  password?: string
  branches: string[]
}
const key = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
const truthy = (value: string | undefined): boolean =>
  ['active', 'true', 'yes', '1'].includes((value ?? '').trim().toLowerCase())

export class AccountSpreadsheetService {
  constructor(
    private readonly users: UserRepository,
    private readonly sheets: GoogleSheetsClient
  ) {}

  async sync(): Promise<number | undefined> {
    try {
      await this.sheets.ensureTabs(googleSheetSources.credentials, [
        'ACCOUNTS',
        'TELEGRAM'
      ])
      const values = await this.sheets.values(googleSheetSources.credentials, 'ACCOUNTS!A:Z')
      if (!values.length) throw new Error('ACCOUNTS sheet is empty')
      const headers = values[0].map(key)
      const rows: AccountRow[] = values
        .slice(1)
        .map((cells) => {
          const row = Object.fromEntries(
            headers.map((header, index) => [header, cells[index] ?? ''])
          )
          const assigned = branches.filter((branch) =>
            truthy(row[key(branch)] || row[`${key(branch)}_branch`])
          )
          const listedBranch = String(row.branch || row.branch_name || '')
            .trim()
            .toLowerCase()
          for (const branch of branches) {
            if (listedBranch === branch.toLowerCase() && !assigned.includes(branch))
              assigned.push(branch)
          }
          if (truthy(row.all_branches) || truthy(row.all))
            assigned.splice(0, assigned.length, ...branches)
          return {
            active: truthy(row.active || row.status),
            role: (String(row.role).trim().toUpperCase() === 'ADMIN'
              ? 'ADMIN'
              : 'CASHIER') as AccountRow['role'],
            firstName: String(row.first_name || row.firstname).trim(),
            lastName: String(row.last_name || row.lastname).trim(),
            username: String(row.username || row.user).trim(),
            password: String(row.password || row.pass || row.credential || '').trim() || undefined,
            branches: assigned
          }
        })
        .filter((row) => row.username)
      this.users.syncSpreadsheetUsers(rows)
      return rows.length
    } catch (error) {
      console.error('Account spreadsheet sync skipped; using local accounts.', error)
      return undefined
    }
  }
}
