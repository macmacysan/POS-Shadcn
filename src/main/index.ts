import { app, shell, BrowserWindow } from 'electron'
import { copyFileSync, existsSync } from 'fs'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

import { openDatabase } from './database/database'
import { ExpenseRepository } from './database/expense-repository'
import { ReportRepository } from './database/report-repository'
import { registerExpenseIpc } from './ipc/expenses'
import { registerReportIpc } from './ipc/reports'
import { ExpenseService } from './services/expense-service'
import { ReportService } from './services/report-service'
import { InstallmentRepository } from './database/installment-repository'
import { InstallmentService } from './services/installment-service'
import { registerInstallmentIpc } from './ipc/installments'

let database: ReturnType<typeof openDatabase> | undefined

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  try {
    const databasePath = join(app.getPath('userData'), 'cashiers-report.db')
    const legacyDatabasePath = join(app.getPath('userData'), 'cashiers-report.sqlite')
    if (!existsSync(databasePath) && existsSync(legacyDatabasePath)) {
      copyFileSync(legacyDatabasePath, databasePath)
    }
    database = openDatabase(databasePath, {
      seedDevelopmentData: is.dev
    })
    registerExpenseIpc(new ExpenseService(new ExpenseRepository(database)))
    registerReportIpc(new ReportService(new ReportRepository(database)))
    registerInstallmentIpc(new InstallmentService(new InstallmentRepository(database)))
  } catch (error) {
    console.error('Database initialization failed.', error)
    app.quit()
    return
  }

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  database?.close()
  database = undefined
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
