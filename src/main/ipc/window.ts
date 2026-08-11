import { BrowserWindow, ipcMain, Menu } from 'electron'

import { windowIpcChannels } from '../../shared/contracts'

export function toggleMaximize(window: BrowserWindow): void {
  if (window.isMaximized()) window.unmaximize()
  else window.maximize()
}

export function showWindowMenu(window: BrowserWindow): void {
  Menu.buildFromTemplate([
    {
      label: window.isMaximized() ? 'Restore' : 'Maximize',
      click: () => toggleMaximize(window)
    },
    { label: 'Minimize', click: () => window.minimize() },
    { type: 'separator' },
    { label: 'Close', click: () => window.close() }
  ]).popup({ window })
}

export function registerWindowIpc(): void {
  ipcMain.handle(windowIpcChannels.minimize, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })
  ipcMain.handle(windowIpcChannels.toggleMaximize, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (window) toggleMaximize(window)
  })
  ipcMain.handle(windowIpcChannels.close, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })
  ipcMain.handle(windowIpcChannels.isMaximized, (event) => {
    return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false
  })
  ipcMain.handle(windowIpcChannels.showSystemMenu, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return
    showWindowMenu(window)
  })
}
