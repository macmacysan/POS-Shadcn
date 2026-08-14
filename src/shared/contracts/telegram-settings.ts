import { z } from 'zod'

const telegramChatIdSchema = z.string().trim().regex(/^-?\d{1,20}$/)
const telegramTokenSchema = z.string().trim().regex(/^\d{6,20}:[A-Za-z0-9_-]{20,}$/)

export const telegramSettingsSaveRequestSchema = z.object({
  token: z.preprocess((value) => (value === '' ? undefined : value), telegramTokenSchema.optional()),
  chatId: telegramChatIdSchema
})

export const telegramSettingsResponseSchema = z.object({
  configured: z.boolean(),
  chatId: telegramChatIdSchema.optional()
})

export type TelegramSettingsSaveRequest = z.infer<typeof telegramSettingsSaveRequestSchema>
export type TelegramSettingsResponse = z.infer<typeof telegramSettingsResponseSchema>

export const telegramSettingsIpcChannels = {
  get: 'telegram-settings:get',
  save: 'telegram-settings:save'
} as const

export type TelegramSettingsApi = {
  telegramSettings: {
    get(): Promise<TelegramSettingsResponse>
    save(request: TelegramSettingsSaveRequest): Promise<TelegramSettingsResponse>
  }
}
