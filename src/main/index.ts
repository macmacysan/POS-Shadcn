import { app, shell, BrowserWindow } from 'electron'
import { copyFileSync, existsSync, mkdirSync, renameSync, unlinkSync, writeFileSync } from 'fs'
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
import { InstallmentService } from './services/installment-service'
import { registerInstallmentIpc } from './ipc/installments'
import { FinanceAccountService } from './services/finance-account-service'
import { registerFinanceAccountIpc } from './ipc/finance-accounts'
import { UserRepository } from './database/user-repository'
import { AuthService } from './services/auth-service'
import { registerAuthIpc } from './ipc/auth'
import { DashboardRepository } from './database/dashboard-repository'
import { DashboardService } from './services/dashboard-service'
import { registerDashboardIpc } from './ipc/dashboard'
import { DailyReportRepository } from './database/daily-report-repository'
import { DailyReportService } from './services/daily-report-service'
import { registerDailyReportIpc } from './ipc/daily-reports'
import { CatalogOptionRepository } from './database/catalog-option-repository'
import { CatalogOptionService } from './services/catalog-option-service'
import { registerCatalogOptionIpc } from './ipc/catalog-options'
import { registerWindowIpc, showWindowMenu } from './ipc/window'
import { registerGeocodingIpc } from './ipc/geocoding'
import { registerPdfExportIpc } from './ipc/pdf-export'
import { registerGoogleSyncIpc } from './ipc/google-sync'
import { registerBackupIpc } from './ipc/backups'
import { registerProductCatalogIpc } from './ipc/product-catalog'
import { registerEntryHistoryIpc } from './ipc/entry-history'
import { AuditRepository } from './database/audit-repository'
import { EntryHistoryService } from './services/entry-history-service'
import { InstallmentRulesRepository } from './database/installment-rules-repository'
import { InstallmentRulesService } from './services/installment-rules-service'
import { registerInstallmentRulesIpc } from './ipc/installment-rules'
import { GeocodingService } from './services/geocoding-service'
import { TelegramSettingsService } from './services/telegram-settings-service'
import { registerUserProfilesIpc } from './ipc/user-profiles'
import { registerUpdaterIpc } from './ipc/updater'
import { UserProfilesService } from './services/user-profiles-service'
import { AccountSpreadsheetService } from './services/account-spreadsheet-service'
import { FinanceAccountRepository } from './database/finance-account-repository'
import { ProductCatalogRepository } from './database/product-catalog-repository'
import { GoogleSheetsClient } from './services/google-sheets-client'
import { googleSheetSources } from './config/google-sheets'
import { GoogleSheetSyncService } from './services/google-sheet-sync-service'
import { GoogleDriveSnapshotService } from './services/google-drive-snapshot-service'
import { ProductCatalogService } from './services/product-catalog-service'
import { BackupService } from './services/backup-service'
import { OnlineBackupRevisionService } from './services/online-backup-revision-service'
import { InstallmentRepository } from './database/installment-repository'
import {
  authIpcChannels,
  googleSyncIpcChannels,
  type GoogleSyncProgress,
  windowIpcChannels
} from '../shared/contracts'

let database: ReturnType<typeof openDatabase> | undefined
let accountSpreadsheet: AccountSpreadsheetService | undefined
let googleSheets: GoogleSheetsClient | undefined
let initialRecoveryRequired = false

function sendGoogleSyncProgress(progress: GoogleSyncProgress): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send(googleSyncIpcChannels.progress, progress)
  }
}

function copyDatabaseWithWal(sourcePath: string, targetPath: string): void {
  copyFileSync(sourcePath, targetPath)
  for (const suffix of ['-wal', '-shm']) {
    const sourceSidecar = `${sourcePath}${suffix}`
    if (existsSync(sourceSidecar)) copyFileSync(sourceSidecar, `${targetPath}${suffix}`)
  }
}

function installInitialDatabase(
  stagedPath: string,
  databasePath: string,
  preserveCurrent = false
): void {
  database?.close()
  database = undefined
  const datedPath = `${databasePath}.${preserveCurrent ? 'recovery' : 'uninitialized'}-${new Date().toISOString().replace(/[:.]/g, '-')}`
  if (existsSync(databasePath)) renameSync(databasePath, datedPath)
  for (const suffix of ['-wal', '-shm']) {
    const sidecar = `${databasePath}${suffix}`
    if (existsSync(sidecar)) {
      if (preserveCurrent) renameSync(sidecar, `${datedPath}${suffix}`)
      else unlinkSync(sidecar)
    }
  }
  renameSync(stagedPath, databasePath)
}

function createWindow(): BrowserWindow {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1300,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    frame: process.platform !== 'win32',
    transparent: process.platform === 'win32',
    backgroundColor: process.platform === 'win32' ? '#00000000' : undefined,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.maximize()
    mainWindow.show()
  })
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send(windowIpcChannels.maximizedChanged, true)
  })
  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send(windowIpcChannels.maximizedChanged, false)
  })
  if (process.platform === 'win32') {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown' && input.alt && input.key === ' ') {
        event.preventDefault()
        showWindowMenu(mainWindow)
      }
    })
  }

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev) {
    mainWindow.webContents.on('console-message', (event) => {
      const output = `[Renderer] ${event.sourceId}:${event.lineNumber} ${event.message}`
      if (event.level === 'error') console.error(output)
      else console.info(output)
    })
  }

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return mainWindow
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  try {
    const previousUserDataPath = app.getPath('userData')
    const stableUserDataPath = join(app.getPath('appData'), 'cashiers-report')
    mkdirSync(stableUserDataPath, { recursive: true })
    app.setPath('userData', stableUserDataPath)

    const databasePath = join(stableUserDataPath, 'cashiers-report.db')
    const initialRecoveryPath = join(stableUserDataPath, 'initial-recovery.json')
    const legacyDatabasePaths = [
      join(stableUserDataPath, 'cashiers-report.sqlite'),
      join(previousUserDataPath, 'cashiers-report.db'),
      join(previousUserDataPath, 'cashiers-report.sqlite')
    ]
    const legacyDatabasePath = legacyDatabasePaths.find(
      (candidate) => candidate !== databasePath && existsSync(candidate)
    )
    if (!existsSync(databasePath) && legacyDatabasePath) {
      copyDatabaseWithWal(legacyDatabasePath, databasePath)
    }
    if (!existsSync(databasePath) && !legacyDatabasePath)
      writeFileSync(initialRecoveryPath, JSON.stringify({ required: true }))
    initialRecoveryRequired = existsSync(initialRecoveryPath)
    database = openDatabase(databasePath)
    const userRepository = new UserRepository(database)
    const authService = new AuthService(userRepository)
    googleSheets = new GoogleSheetsClient()
    accountSpreadsheet = new AccountSpreadsheetService(userRepository, googleSheets)
    const legacyGoogleSync = new GoogleSheetSyncService(
      database,
      googleSheets,
      authService,
      sendGoogleSyncProgress
    )
    const googleSync = new GoogleDriveSnapshotService(
      database,
      databasePath,
      join(stableUserDataPath, 'drive-snapshots'),
      new BackupService(database, databasePath),
      googleSheets,
      authService,
      sendGoogleSyncProgress,
      legacyGoogleSync
    )
    const onlineBackupRevisions = new OnlineBackupRevisionService(
      database,
      databasePath,
      join(stableUserDataPath, 'online-backup-revisions'),
      new BackupService(database, databasePath),
      googleSheets
    )
    registerGoogleSyncIpc(googleSync)
    registerBackupIpc(
      new BackupService(database, databasePath, googleSheets),
      onlineBackupRevisions,
      authService,
      (stagedPath) => {
        installInitialDatabase(stagedPath, databasePath, true)
        app.relaunch()
        app.quit()
      }
    )
    registerCatalogOptionIpc(
      new CatalogOptionService(new CatalogOptionRepository(database), authService)
    )
    registerProductCatalogIpc(
      new ProductCatalogService(new ProductCatalogRepository(database), googleSheets)
    )
    registerInstallmentRulesIpc(
      new InstallmentRulesService(new InstallmentRulesRepository(database), authService)
    )
    registerExpenseIpc(new ExpenseService(new ExpenseRepository(database), authService), () =>
      googleSync.queueActiveBranchUpload()
    )
    registerReportIpc(new ReportService(new ReportRepository(database), authService), () =>
      googleSync.queueActiveBranchUpload()
    )
    registerDailyReportIpc(
      new DailyReportService(new DailyReportRepository(database), authService),
      () => googleSync.queueActiveBranchUpload()
    )
    registerDashboardIpc(new DashboardService(new DashboardRepository(database), authService))
    registerInstallmentIpc(
      new InstallmentService(new InstallmentRepository(database), authService),
      authService,
      () => googleSync.queueActiveBranchUpload()
    )
    registerFinanceAccountIpc(
      new FinanceAccountService(new FinanceAccountRepository(database), authService),
      authService,
      () => googleSync.queueActiveBranchUpload()
    )
    registerGeocodingIpc(new GeocodingService())
    const telegramSettings = new TelegramSettingsService(
      googleSheets,
      googleSheetSources.credentials
    )
    registerUserProfilesIpc(new UserProfilesService(userRepository, authService))
    registerAuthIpc(
      authService,
      async (user) => {
        if (user.role === 'ADMIN') return
        if (initialRecoveryRequired) return
        onlineBackupRevisions.queueDailyRevision(
          user.branch as 'Goa' | 'Tinambac' | 'Tigaon' | 'Lagonoy'
        )
        const branches = ['Goa', 'Tinambac', 'Tigaon', 'Lagonoy'] as const
        await Promise.all(
          branches.map((branch) =>
            branch === user.branch
              ? googleSync.uploadActiveBranch().catch(() => undefined)
              : googleSync.syncBranch(branch).catch(() => undefined)
          )
        )
      },
      async () => {
        await accountSpreadsheet?.sync()
      },
      {
        required: () => initialRecoveryRequired,
        restore: async (branch) => {
          const stagedPath = await googleSync.prepareInitialRestore(branch)
          if (stagedPath) installInitialDatabase(stagedPath, databasePath)
          else authService.setCashierLoginBranch(branch)
          unlinkSync(initialRecoveryPath)
          initialRecoveryRequired = false
          app.relaunch()
          app.quit()
        }
      }
    )
    registerPdfExportIpc(telegramSettings)
    registerEntryHistoryIpc(
      new EntryHistoryService(
        new AuditRepository(database),
        new ExpenseRepository(database),
        new DailyReportRepository(database),
        authService
      )
    )
    registerWindowIpc()
  } catch (error) {
    console.error('Database initialization failed.', error)
    app.quit()
    return
  }

  const accountSyncCount = await accountSpreadsheet?.sync()
  const mainWindow = createWindow()
  registerUpdaterIpc()
  mainWindow.webContents.once('did-finish-load', () => {
    mainWindow.webContents.send(authIpcChannels.accountSyncCompleted, accountSyncCount ?? -1)
  })

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
