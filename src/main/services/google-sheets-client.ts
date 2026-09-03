import { createSign } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

type ServiceAccount = { client_email: string; private_key: string; token_uri?: string }
type Spreadsheet = { sheets?: Array<{ properties?: { title?: string } }> }
type SheetValues = { values?: string[][] }
type SheetWrite = { range: string; values: Array<Array<string | number | null>> }
export type DriveFile = {
  id: string
  name: string
  version: string
  size?: string
  appProperties?: Record<string, string>
}

const scope = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive'
function encode(value: string): string {
  return Buffer.from(value).toString('base64url')
}

export class GoogleSheetsClient {
  private accessToken: string | undefined
  private tokenExpiresAt = 0

  async ensureTabs(spreadsheetId: string, tabs: readonly string[]): Promise<string[]> {
    const spreadsheet = await this.request<Spreadsheet>(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties.title`
    )
    const existing = new Set(
      (spreadsheet.sheets ?? [])
        .map((sheet) => sheet.properties?.title?.trim().toLocaleLowerCase())
        .filter(Boolean)
    )
    const requested = new Set<string>()
    const missing = tabs.filter((title) => {
      const key = title.trim().toLocaleLowerCase()
      if (existing.has(key) || requested.has(key)) return false
      requested.add(key)
      return true
    })
    if (missing.length) {
      await this.request(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
        {
          method: 'POST',
          body: JSON.stringify({
            requests: missing.map((title) => ({ addSheet: { properties: { title } } }))
          })
        }
      )
    }
    return missing
  }

  async values(spreadsheetId: string, range: string): Promise<string[][]> {
    const result = await this.request<SheetValues>(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`
    )
    return result.values ?? []
  }

  async updateValues(
    spreadsheetId: string,
    range: string,
    values: Array<Array<string | number | null>>
  ): Promise<void> {
    await this.request(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
      { method: 'PUT', body: JSON.stringify({ range, majorDimension: 'ROWS', values }) }
    )
  }

  async updateValuesBatch(spreadsheetId: string, data: SheetWrite[]): Promise<void> {
    if (!data.length) return
    await this.request(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`,
      { method: 'POST', body: JSON.stringify({ valueInputOption: 'RAW', data }) }
    )
  }

  async appendImportStatus(spreadsheetId: string, row: string[]): Promise<void> {
    await this.request(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/IMPORT_STATUS:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { method: 'POST', body: JSON.stringify({ values: [row] }) }
    )
  }

  async uploadFile(fileName: string, data: Buffer, folderId: string): Promise<string> {
    const boundary = `cashiers-${Date.now()}`
    const metadata = JSON.stringify({ name: fileName, parents: [folderId] })
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`
      ),
      Buffer.from(`--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`),
      data,
      Buffer.from(`\r\n--${boundary}--`)
    ])
    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await this.token()}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body
      }
    )
    if (!response.ok) throw new Error(`Google Drive upload failed: ${response.status}`)
    const result = (await response.json()) as { id?: string }
    if (!result.id) throw new Error('Google Drive upload returned no file id.')
    return result.id
  }

  /** Finds the one stable snapshot owned by a branch in the configured folder. */
  async findDriveFile(folderId: string, name: string): Promise<DriveFile | undefined> {
    const query = `'${folderId.replace(/'/g, "\\'")}' in parents and name = '${name.replace(/'/g, "\\'")}' and trashed = false`
    const result = await this.driveRequest<{ files?: DriveFile[] }>(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&spaces=drive&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,version,appProperties)`
    )
    return result.files?.[0]
  }

  async listDriveFiles(folderId: string, query = ''): Promise<DriveFile[]> {
    const parent = `'${folderId.replace(/'/g, "\\'")}' in parents`
    const result = await this.driveRequest<{ files?: DriveFile[] }>(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`${parent} and trashed = false${query ? ` and ${query}` : ''}`)}&spaces=drive&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,version,size,appProperties)`
    )
    return result.files ?? []
  }

  async deleteDriveFile(file: Pick<DriveFile, 'id'>): Promise<void> {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?supportsAllDrives=true`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${await this.token()}` } }
    )
    if (!response.ok && response.status !== 404)
      throw new Error(`Google Drive deletion failed: ${response.status}`)
  }

  /** Returns the existing Drive folder containing a branch's configured spreadsheet. */
  async parentDriveFolder(fileId: string): Promise<string> {
    const result = await this.driveRequest<{ parents?: string[] }>(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true&fields=parents`
    )
    const folder = result.parents?.[0]
    if (!folder)
      throw new Error('The configured branch spreadsheet has no accessible Drive folder.')
    return folder
  }

  async downloadDriveFile(file: Pick<DriveFile, 'id'>): Promise<Buffer> {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${await this.token()}` } }
    )
    if (!response.ok) throw new Error(`Google Drive download failed: ${response.status}`)
    return Buffer.from(await response.arrayBuffer())
  }

  /** Replaces bytes in-place, retaining the Drive file ID. If no file exists it creates one. */
  async replaceDriveFile(input: {
    folderId: string
    name: string
    data: Buffer
    file?: Pick<DriveFile, 'id'>
    appProperties: Record<string, string>
  }): Promise<DriveFile> {
    const boundary = `cashiers-${Date.now()}`
    const metadata = JSON.stringify({
      name: input.name,
      parents: input.file ? undefined : [input.folderId],
      appProperties: input.appProperties
    })
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`
      ),
      Buffer.from(`--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`),
      input.data,
      Buffer.from(`\r\n--${boundary}--`)
    ])
    const url = input.file
      ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(input.file.id)}?uploadType=multipart&supportsAllDrives=true&fields=id,name,version,appProperties`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,version,appProperties'
    const response = await fetch(url, {
      method: input.file ? 'PATCH' : 'POST',
      headers: {
        Authorization: `Bearer ${await this.token()}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body
    })
    console.info(
      `[Google Drive] ${input.file ? 'Updated' : 'Created'} snapshot: ${response.status}.`
    )
    if (response.status === 412)
      throw new Error('Google Drive snapshot changed remotely; retrying is required.')
    if (!response.ok) throw new Error(`Google Drive snapshot upload failed: ${response.status}`)
    return (await response.json()) as DriveFile
  }

  private async driveRequest<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${await this.token()}` }
    })
    console.info(`[Google Drive] ${new URL(url).pathname}: ${response.status}.`)
    if (!response.ok) {
      const body = await response.text()
      let detail = ''
      try {
        const parsed = JSON.parse(body) as { error?: { message?: string } }
        detail = parsed.error?.message?.slice(0, 300) ?? ''
      } catch {
        // Google did not provide a structured, user-safe explanation.
      }
      throw new Error(
        `Google Drive request failed: ${response.status}${detail ? `: ${detail}` : ''}`
      )
    }
    return (await response.json()) as T
  }

  private async request<T>(url: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${await this.token()}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {})
      }
    })
    const body = await response.text()
    if (!response.ok) {
      let detail = ''
      try {
        const parsed = JSON.parse(body) as { error?: { message?: string } }
        detail = parsed.error?.message ? ` ${parsed.error.message}` : ''
      } catch {
        detail = ''
      }
      throw new Error(`Google Sheets request failed: ${response.status}.${detail}`)
    }
    return JSON.parse(body) as T
  }

  private async token(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60_000) return this.accessToken
    const configuredPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
    const localPath = join(process.cwd(), 'credentials', 'appcashierreport-d2e89141daa9.json')
    const resourcesPath =
      'resourcesPath' in process && typeof process.resourcesPath === 'string'
        ? process.resourcesPath
        : undefined
    const installedPath = resourcesPath
      ? join(resourcesPath, 'credentials', 'appcashierreport-d2e89141daa9.json')
      : undefined
    const credentialPath = [configuredPath, installedPath, localPath].find(
      (path) => path && existsSync(path)
    )
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
      ? process.env.GOOGLE_SERVICE_ACCOUNT_JSON
      : credentialPath
        ? readFileSync(credentialPath, 'utf8')
        : undefined
    if (!raw)
      throw new Error(
        configuredPath
          ? 'The configured Google service-account file was not found.'
          : 'A Google service-account credential is required.'
      )
    const account = JSON.parse(raw) as ServiceAccount
    const now = Math.floor(Date.now() / 1000)
    const assertion = `${encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${encode(JSON.stringify({ iss: account.client_email, scope, aud: account.token_uri ?? 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }))}`
    const signer = createSign('RSA-SHA256')
    signer.update(assertion)
    const signed = `${assertion}.${signer.sign(account.private_key, 'base64url')}`
    const response = await fetch(account.token_uri ?? 'https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: signed
      })
    })
    if (!response.ok) throw new Error('Google authentication failed.')
    const result = (await response.json()) as { access_token?: string; expires_in?: number }
    if (!result.access_token) throw new Error('Google authentication returned no access token.')
    this.accessToken = result.access_token
    this.tokenExpiresAt = Date.now() + (result.expires_in ?? 3600) * 1000
    return result.access_token
  }
}
