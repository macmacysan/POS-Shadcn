import { safeStorage } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

import type { TelegramSettingsResponse, TelegramSettingsSaveRequest } from '../../shared/contracts'
import { AppError } from '../database/errors'
import { AuthService } from './auth-service'

type StoredTelegramSettings = { chatId: string; encryptedToken: string }

export class TelegramSettingsService {
  constructor(
    private readonly auth: AuthService,
    private readonly filePath: string
  ) {}

  async get(): Promise<TelegramSettingsResponse> {
    this.auth.requireAdmin()
    const settings = await this.read()
    return settings ? { configured: true, chatId: settings.chatId } : { configured: false }
  }

  async save(request: TelegramSettingsSaveRequest): Promise<TelegramSettingsResponse> {
    this.auth.requireAdmin()
    if (!safeStorage.isEncryptionAvailable()) {
      throw new AppError('DATABASE_ERROR', 'Secure credential storage is unavailable on this device.')
    }
    const current = await this.read()
    const token = request.token ?? (current && safeStorage.decryptString(Buffer.from(current.encryptedToken, 'base64')))
    if (!token) throw new AppError('VALIDATION_ERROR', 'Enter a Telegram bot token.')
    await mkdir(dirname(this.filePath), { recursive: true })
    await writeFile(
      this.filePath,
      JSON.stringify({
        chatId: request.chatId,
        encryptedToken: safeStorage.encryptString(token).toString('base64')
      } satisfies StoredTelegramSettings),
      'utf8'
    )
    return { configured: true, chatId: request.chatId }
  }

  async forDelivery(): Promise<{ token: string; chatId: string }> {
    const settings = await this.read()
    if (!settings) throw new AppError('FORBIDDEN', 'Telegram delivery is not configured.')
    if (!safeStorage.isEncryptionAvailable()) {
      throw new AppError('DATABASE_ERROR', 'Secure credential storage is unavailable on this device.')
    }
    return { chatId: settings.chatId, token: safeStorage.decryptString(Buffer.from(settings.encryptedToken, 'base64')) }
  }

  private async read(): Promise<StoredTelegramSettings | undefined> {
    try {
      const value: unknown = JSON.parse(await readFile(this.filePath, 'utf8'))
      if (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as StoredTelegramSettings).chatId === 'string' &&
        typeof (value as StoredTelegramSettings).encryptedToken === 'string'
      ) {
        return value as StoredTelegramSettings
      }
      throw new AppError('DATABASE_ERROR', 'Telegram settings could not be read.')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
      if (error instanceof AppError) throw error
      throw new AppError('DATABASE_ERROR', 'Telegram settings could not be read.')
    }
  }
}
