import { app, BrowserWindow, ipcMain } from 'electron'
import electronUpdater from 'electron-updater'

import { type UpdateState, updaterIpcChannels } from '../../shared/contracts'

const { autoUpdater } = electronUpdater
let state: UpdateState | null = null
let availableVersion: string | undefined
let updateDownloaded = false
let lastError: unknown
let lastProgressLogPercent = -1

function currentVersion(): string {
  return app.getVersion()
}

function publish(nextState: UpdateState): void {
  state = nextState
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send(updaterIpcChannels.stateChanged, nextState)
  }
}

function reportError(error: unknown): void {
  if (error === lastError) return
  lastError = error
  console.error('[Updater] Error.', error)
  publish({
    type: 'error',
    currentVersion: currentVersion(),
    message: 'Unable to update. Please try again.'
  })
}

async function checkForUpdates(): Promise<void> {
  try {
    await autoUpdater.checkForUpdates()
  } catch (error) {
    reportError(error)
  }
}

async function downloadUpdate(): Promise<void> {
  if (!availableVersion || updateDownloaded) return

  console.info(`[Updater] Download started: ${availableVersion}.`)
  try {
    await autoUpdater.downloadUpdate()
  } catch (error) {
    reportError(error)
  }
}

function installUpdate(): void {
  if (!updateDownloaded) {
    publish({
      type: 'error',
      currentVersion: currentVersion(),
      message: 'Download the update before installing.'
    })
    return
  }

  console.info('[Updater] Install requested.')
  autoUpdater.quitAndInstall()
}

export function registerUpdaterIpc(): void {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  console.info('[Updater] Initialized.')

  autoUpdater.on('checking-for-update', () => {
    lastError = undefined
    console.info('[Updater] Checking for updates.')
    publish({ type: 'checking', currentVersion: currentVersion() })
  })
  autoUpdater.on('update-available', (info) => {
    availableVersion = info.version
    updateDownloaded = false
    lastProgressLogPercent = -1
    console.info(`[Updater] Update available: ${info.version}.`)
    publish({
      type: 'update-available',
      currentVersion: currentVersion(),
      availableVersion: info.version
    })
  })
  autoUpdater.on('update-not-available', () => {
    availableVersion = undefined
    updateDownloaded = false
    console.info('[Updater] No update available.')
    publish({ type: 'update-not-available', currentVersion: currentVersion() })
  })
  autoUpdater.on('download-progress', (progress) => {
    if (!availableVersion) return
    const progressPercent = Math.floor(progress.percent)
    if (
      progressPercent === 100 ||
      (progressPercent % 10 === 0 && progressPercent !== lastProgressLogPercent)
    ) {
      lastProgressLogPercent = progressPercent
      console.info(`[Updater] Download progress: ${progressPercent}%.`)
    }
    publish({
      type: 'download-progress',
      currentVersion: currentVersion(),
      availableVersion,
      percent: progress.percent,
      transferredBytes: progress.transferred,
      totalBytes: progress.total
    })
  })
  autoUpdater.on('update-downloaded', (info) => {
    availableVersion = info.version
    updateDownloaded = true
    console.info(`[Updater] Update downloaded: ${info.version}.`)
    publish({
      type: 'update-downloaded',
      currentVersion: currentVersion(),
      availableVersion: info.version
    })
  })
  autoUpdater.on('error', reportError)

  ipcMain.handle(updaterIpcChannels.checkForUpdates, checkForUpdates)
  ipcMain.handle(updaterIpcChannels.downloadUpdate, downloadUpdate)
  ipcMain.handle(updaterIpcChannels.installUpdate, installUpdate)
  ipcMain.handle(updaterIpcChannels.getState, () => state)

  setTimeout(() => void checkForUpdates(), 1_000)
}
