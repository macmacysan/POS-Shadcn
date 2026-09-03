import { googleSheetSources } from '../config/google-sheets'
import { AppError } from '../database/errors'
import type { GooglePublishRequest, GooglePublishResponse } from '../../shared/contracts'
import type { GoogleSheetsClient } from './google-sheets-client'

type Cell = string | number | null

export class GoogleSheetPublishService {
  constructor(private readonly sheets: GoogleSheetsClient) {}

  async publish(request: GooglePublishRequest): Promise<GooglePublishResponse> {
    const spreadsheetId = googleSheetSources[request.branch]
    await this.sheets.ensureTabs(spreadsheetId, request.tabs.map((tab) => tab.name))
    let updatedRows = 0
    let appendedRows = 0
    const writes: Array<{ range: string; values: Array<Array<Cell>> }> = []

    for (const tab of request.tabs) {
      const existing = await this.sheets.values(spreadsheetId, `${tab.name}!A:ZZ`)
      const headers = [...new Set(tab.rows.flatMap((row) => Object.keys(row)))]
      if (!headers.length) continue
      const existingHeaders = existing[0] ?? []
      const allHeaders = [...new Set([...existingHeaders, ...headers])]
      const idColumn = allHeaders.indexOf('id')
      if (idColumn < 0) throw new AppError('VALIDATION_ERROR', `Google tab ${tab.name} requires an id column.`)
      const rowsById = new Map<string, number>()
      for (let index = 1; index < existing.length; index += 1) {
        const id = existing[index]?.[idColumn]
        if (id) rowsById.set(id, index + 1)
      }
      if (!existing.length || existingHeaders.join('\u0000') !== allHeaders.join('\u0000')) {
        writes.push({ range: `${tab.name}!A1`, values: [allHeaders] })
      }
      for (const row of tab.rows) {
        const values = allHeaders.map((header) => row[header] ?? null) as Cell[]
        const rowNumber = rowsById.get(String(row.id))
        if (rowNumber) {
          writes.push({ range: `${tab.name}!A${rowNumber}`, values: [values] })
          updatedRows += 1
        } else {
          const nextRow = Math.max(existing.length + appendedRows + 1, 2)
          writes.push({ range: `${tab.name}!A${nextRow}`, values: [values] })
          appendedRows += 1
        }
      }
    }
    await this.sheets.updateValuesBatch(spreadsheetId, writes)
    return { branch: request.branch, businessDate: request.businessDate, updatedRows, appendedRows }
  }
}
