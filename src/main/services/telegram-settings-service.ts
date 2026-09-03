import { AppError } from '../database/errors'
import type { GoogleSheetsClient } from './google-sheets-client'

const telegramConfigRange = 'TELEGRAM_config!B2:C7'
const chatIdPattern = /^-?\d{1,20}$/
const tokenPattern = /^\d{6,20}:[A-Za-z0-9_-]{20,}$/

export class TelegramSettingsService {
  constructor(
    private readonly sheets: Pick<GoogleSheetsClient, 'values'>,
    private readonly spreadsheetId: string
  ) {}

  async forDelivery(): Promise<{ token: string; chatIds: string[] }> {
    let values: string[][]
    try {
      values = await this.sheets.values(this.spreadsheetId, telegramConfigRange)
    } catch {
      throw new AppError('DATABASE_ERROR', 'Telegram configuration could not be read from Google Sheets.')
    }
    const chatIds = values.map((row) => String(row[0] ?? '').trim()).filter(Boolean)
    const token = String(values[0]?.[1] ?? '').trim()
    if (!chatIds.length || chatIds.some((chatId) => !chatIdPattern.test(chatId)) || !tokenPattern.test(token))
      throw new AppError(
        'FORBIDDEN',
        'Telegram configuration is missing or invalid in Google Sheets.'
      )
    return { chatIds, token }
  }
}
