import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

import {
  expenseIpcChannels,
  authIpcChannels,
  catalogOptionIpcChannels,
  dashboardIpcChannels,
  dailyReportIpcChannels,
  financeAccountIpcChannels,
  geocodingIpcChannels,
  installmentIpcChannels,
  reportIpcChannels,
  pdfExportIpcChannels,
  type ExpenseCreateInput,
  type ExpenseListRequest,
  type ExpenseUpdateInput,
  type ExpensesApi,
  type EntryHistoryApi,
  entryHistoryIpcChannels,
  type AuthApi,
  type CatalogOptionsApi,
  type DashboardApi,
  type DailyReportsApi,
  type FinanceAccountsApi,
  type GeocodingApi,
  type InstallmentsApi,
  type InstallmentRulesApi,
  installmentRulesIpcChannels,
  type ReportRecord,
  type PdfExportApi,
  type ProductCatalogApi,
  productCatalogIpcChannels,
  windowIpcChannels,
  type WindowControlsApi,
  type GoogleSyncApi,
  googleSyncIpcChannels,
  googleSyncProgressSchema,
  type BackupsApi,
  backupIpcChannels,
  type UserProfilesApi,
  userProfileIpcChannels
} from '../shared/contracts'

// Custom APIs for renderer
const api: ExpensesApi &
  EntryHistoryApi &
  InstallmentsApi &
  InstallmentRulesApi &
  FinanceAccountsApi &
  AuthApi &
  CatalogOptionsApi &
  DashboardApi &
  DailyReportsApi &
  GeocodingApi &
  PdfExportApi &
  ProductCatalogApi &
  GoogleSyncApi &
  BackupsApi &
  UserProfilesApi = {
  productCatalog: {
    list: () => ipcRenderer.invoke(productCatalogIpcChannels.list)
  },
  catalogOptions: {
    list: (request) => ipcRenderer.invoke(catalogOptionIpcChannels.list, request),
    create: (request) => ipcRenderer.invoke(catalogOptionIpcChannels.create, request),
    rename: (request) => ipcRenderer.invoke(catalogOptionIpcChannels.rename, request),
    retire: (request) => ipcRenderer.invoke(catalogOptionIpcChannels.retire, request),
    restore: (request) => ipcRenderer.invoke(catalogOptionIpcChannels.restore, request)
  },
  auth: {
    login: (request) => ipcRenderer.invoke(authIpcChannels.login, request),
    createAccount: (request) => ipcRenderer.invoke(authIpcChannels.createAccount, request),
    getMode: () => ipcRenderer.invoke(authIpcChannels.getMode),
    switchBranch: (request) => ipcRenderer.invoke(authIpcChannels.switchBranch, request),
    getCashierLoginBranch: () => ipcRenderer.invoke(authIpcChannels.getCashierLoginBranch),
    setCashierLoginBranch: (branch) =>
      ipcRenderer.invoke(authIpcChannels.setCashierLoginBranch, branch),
    getInitialRecoveryStatus: () => ipcRenderer.invoke(authIpcChannels.getInitialRecoveryStatus),
    restoreInitialBranchSnapshot: (branch) =>
      ipcRenderer.invoke(authIpcChannels.restoreInitialBranchSnapshot, branch),
    logout: () => ipcRenderer.invoke(authIpcChannels.logout),
    onAccountSyncCompleted: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, count: unknown): void => {
        if (typeof count === 'number') listener(count)
      }
      ipcRenderer.on(authIpcChannels.accountSyncCompleted, handler)
      return () => ipcRenderer.removeListener(authIpcChannels.accountSyncCompleted, handler)
    }
  },
  dashboard: {
    get: (request) => ipcRenderer.invoke(dashboardIpcChannels.get, request),
    getPdfCharts: (request) => ipcRenderer.invoke(dashboardIpcChannels.pdfCharts, request)
  },
  dailyReports: {
    resolveActive: (request) => ipcRenderer.invoke(dailyReportIpcChannels.resolveActive, request),
    listCalendar: (request) => ipcRenderer.invoke(dailyReportIpcChannels.listCalendar, request),
    getSnapshot: (request) => ipcRenderer.invoke(dailyReportIpcChannels.getSnapshot, request),
    updateSummary: (request) => ipcRenderer.invoke(dailyReportIpcChannels.updateSummary, request),
    updateNote: (request) => ipcRenderer.invoke(dailyReportIpcChannels.updateNote, request),
    markDelivery: (request) => ipcRenderer.invoke(dailyReportIpcChannels.markDelivery, request),
    listIncome: (request) => ipcRenderer.invoke(dailyReportIpcChannels.listIncome, request),
    createIncome: (request) => ipcRenderer.invoke(dailyReportIpcChannels.createIncome, request),
    updateIncome: (request) => ipcRenderer.invoke(dailyReportIpcChannels.updateIncome, request),
    voidIncome: (request) => ipcRenderer.invoke(dailyReportIpcChannels.voidIncome, request),
    listPayments: (request) => ipcRenderer.invoke(dailyReportIpcChannels.listPayments, request),
    createPayment: (request) => ipcRenderer.invoke(dailyReportIpcChannels.createPayment, request),
    updatePayment: (request) => ipcRenderer.invoke(dailyReportIpcChannels.updatePayment, request),
    voidPayment: (request) => ipcRenderer.invoke(dailyReportIpcChannels.voidPayment, request),
    createReceiptType: (request) =>
      ipcRenderer.invoke(dailyReportIpcChannels.createReceiptType, request),
    deleteReceiptType: (request) =>
      ipcRenderer.invoke(dailyReportIpcChannels.deleteReceiptType, request),
    listReceiptTypes: () => ipcRenderer.invoke(dailyReportIpcChannels.listReceiptTypes),
    restoreReceiptType: (request) =>
      ipcRenderer.invoke(dailyReportIpcChannels.restoreReceiptType, request)
  },
  reports: {
    getById: (reportId: string): Promise<ReportRecord | null> =>
      ipcRenderer.invoke(reportIpcChannels.getById, { reportId }),
    upsertReconciliation: (request) =>
      ipcRenderer.invoke(reportIpcChannels.upsertReconciliation, request),
    expenses: {
      list: (request: ExpenseListRequest) => ipcRenderer.invoke(expenseIpcChannels.list, request),
      getById: (id: string) => ipcRenderer.invoke(expenseIpcChannels.getById, { id }),
      create: (input: ExpenseCreateInput) => ipcRenderer.invoke(expenseIpcChannels.create, input),
      update: (input: ExpenseUpdateInput) => ipcRenderer.invoke(expenseIpcChannels.update, input),
      void: (input: { ids: string[]; reason: string }) =>
        ipcRenderer.invoke(expenseIpcChannels.void, input),
      summaryTotals: (reportId: string) =>
        ipcRenderer.invoke(expenseIpcChannels.summaryTotals, { reportId })
    }
  },
  entryHistory: {
    list: (request) => ipcRenderer.invoke(entryHistoryIpcChannels.list, request)
  },
  installments: {
    list: (request) => ipcRenderer.invoke(installmentIpcChannels.list, request),
    bootstrap: (request) => ipcRenderer.invoke(installmentIpcChannels.bootstrap, request),
    updateLoan: (request) => ipcRenderer.invoke(installmentIpcChannels.updateLoan, request),
    restructureLoan: (request) =>
      ipcRenderer.invoke(installmentIpcChannels.restructureLoan, request),
    closeContract: (request) => ipcRenderer.invoke(installmentIpcChannels.closeContract, request),
    blacklistAccount: (request) =>
      ipcRenderer.invoke(installmentIpcChannels.blacklistAccount, request),
    restoreStatus: (request) => ipcRenderer.invoke(installmentIpcChannels.restoreStatus, request),
    void: (request) => ipcRenderer.invoke(installmentIpcChannels.void, request),
    unvoid: (request) => ipcRenderer.invoke(installmentIpcChannels.unvoid, request),
    voidPayments: (request) => ipcRenderer.invoke(installmentIpcChannels.voidPayments, request),
    getPaymentWorkspace: (request) =>
      ipcRenderer.invoke(installmentIpcChannels.paymentWorkspace, request),
    listHistory: (request) => ipcRenderer.invoke(installmentIpcChannels.history, request),
    createPayment: (request) => ipcRenderer.invoke(installmentIpcChannels.createPayment, request),
    adjustPayment: (request) => ipcRenderer.invoke(installmentIpcChannels.adjustPayment, request)
  },
  installmentRules: {
    getActive: () => ipcRenderer.invoke(installmentRulesIpcChannels.getActive),
    list: () => ipcRenderer.invoke(installmentRulesIpcChannels.list),
    save: (input) => ipcRenderer.invoke(installmentRulesIpcChannels.save, input)
  },
  financeAccounts: {
    list: (request) => ipcRenderer.invoke(financeAccountIpcChannels.list, request),
    create: (request) => ipcRenderer.invoke(financeAccountIpcChannels.create, request),
    update: (request) => ipcRenderer.invoke(financeAccountIpcChannels.update, request),
    void: (request) => ipcRenderer.invoke(financeAccountIpcChannels.void, request),
    unvoid: (request) => ipcRenderer.invoke(financeAccountIpcChannels.unvoid, request),
    transfer: (request) => ipcRenderer.invoke(financeAccountIpcChannels.transfer, request)
  },
  geocoding: {
    forward: (request) => ipcRenderer.invoke(geocodingIpcChannels.forward, request)
  },
  pdfExport: {
    preview: (request) => ipcRenderer.invoke(pdfExportIpcChannels.preview, request),
    save: (request) => ipcRenderer.invoke(pdfExportIpcChannels.save, request),
    sendTelegram: (request) => ipcRenderer.invoke(pdfExportIpcChannels.sendTelegram, request),
    saveExcel: (request) => ipcRenderer.invoke(pdfExportIpcChannels.saveExcel, request)
  },
  googleSync: {
    sync: (request) => ipcRenderer.invoke(googleSyncIpcChannels.sync, request),
    onProgress: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, value: unknown): void => {
        const result = googleSyncProgressSchema.safeParse(value)
        if (result.success) listener(result.data)
      }
      ipcRenderer.on(googleSyncIpcChannels.progress, handler)
      return () => ipcRenderer.removeListener(googleSyncIpcChannels.progress, handler)
    },
    records: () => ipcRenderer.invoke(googleSyncIpcChannels.records),
    blacklisted: () => ipcRenderer.invoke(googleSyncIpcChannels.blacklisted)
  },
  backups: {
    create: () => ipcRenderer.invoke(backupIpcChannels.create),
    restore: (request) => ipcRenderer.invoke(backupIpcChannels.restore, request),
    listOnlineRevisions: (request) =>
      ipcRenderer.invoke(backupIpcChannels.listOnlineRevisions, request),
    restoreOnlineRevision: (request) =>
      ipcRenderer.invoke(backupIpcChannels.restoreOnlineRevision, request)
  },
  userProfiles: {
    list: () => ipcRenderer.invoke(userProfileIpcChannels.list),
    create: (request) => ipcRenderer.invoke(userProfileIpcChannels.create, request),
    update: (request) => ipcRenderer.invoke(userProfileIpcChannels.update, request),
    delete: (request) => ipcRenderer.invoke(userProfileIpcChannels.delete, request),
    resetPassword: (request) => ipcRenderer.invoke(userProfileIpcChannels.resetPassword, request),
    audit: () => ipcRenderer.invoke(userProfileIpcChannels.audit)
  }
}

const windowControls: WindowControlsApi | undefined =
  process.platform === 'win32'
    ? {
        minimize: () => ipcRenderer.invoke(windowIpcChannels.minimize),
        toggleMaximize: () => ipcRenderer.invoke(windowIpcChannels.toggleMaximize),
        close: () => ipcRenderer.invoke(windowIpcChannels.close),
        isMaximized: () => ipcRenderer.invoke(windowIpcChannels.isMaximized),
        showSystemMenu: () => ipcRenderer.invoke(windowIpcChannels.showSystemMenu),
        onMaximizedChange: (listener) => {
          const handler = (_event: Electron.IpcRendererEvent, isMaximized: unknown): void => {
            if (typeof isMaximized === 'boolean') listener(isMaximized)
          }
          ipcRenderer.on(windowIpcChannels.maximizedChanged, handler)
          return () => ipcRenderer.removeListener(windowIpcChannels.maximizedChanged, handler)
        }
      }
    : undefined

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    if (windowControls) contextBridge.exposeInMainWorld('windowControls', windowControls)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
  // @ts-ignore (define in dts)
  window.windowControls = windowControls
}
