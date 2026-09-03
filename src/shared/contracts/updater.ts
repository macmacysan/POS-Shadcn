import { z } from 'zod'

export const updateStateSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('checking'), currentVersion: z.string() }),
  z.object({
    type: z.literal('update-available'),
    currentVersion: z.string(),
    availableVersion: z.string()
  }),
  z.object({ type: z.literal('update-not-available'), currentVersion: z.string() }),
  z.object({
    type: z.literal('download-progress'),
    currentVersion: z.string(),
    availableVersion: z.string(),
    percent: z.number(),
    transferredBytes: z.number(),
    totalBytes: z.number()
  }),
  z.object({
    type: z.literal('update-downloaded'),
    currentVersion: z.string(),
    availableVersion: z.string()
  }),
  z.object({ type: z.literal('error'), currentVersion: z.string(), message: z.string() })
])

export type UpdateState = z.infer<typeof updateStateSchema>

export const updaterIpcChannels = {
  checkForUpdates: 'updater:check',
  downloadUpdate: 'updater:download',
  installUpdate: 'updater:install',
  getState: 'updater:state:get',
  stateChanged: 'updater:state:changed'
} as const

export type UpdaterApi = {
  updater: {
    checkForUpdates(): Promise<void>
    downloadUpdate(): Promise<void>
    installUpdate(): Promise<void>
    getState(): Promise<UpdateState | null>
    onStateChange(listener: (state: UpdateState) => void): () => void
  }
}
