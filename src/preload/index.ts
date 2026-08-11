import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

import {
  expenseIpcChannels,
  authIpcChannels,
  catalogOptionIpcChannels,
  dashboardIpcChannels,
  dailyReportIpcChannels,
  financeAccountIpcChannels,
  installmentIpcChannels,
  reportIpcChannels,
  type ExpenseCreateInput,
  type ExpenseListRequest,
  type ExpenseUpdateInput,
  type ExpensesApi,
  type AuthApi,
  type CatalogOptionsApi,
  type DashboardApi,
  type DailyReportsApi,
  type FinanceAccountsApi,
  type InstallmentsApi,
  type ReportRecord,
  windowIpcChannels,
  type WindowControlsApi
} from '../shared/contracts'

// Custom APIs for renderer
const api: ExpensesApi &
  InstallmentsApi &
  FinanceAccountsApi &
  AuthApi &
  CatalogOptionsApi &
  DashboardApi &
  DailyReportsApi = {
  catalogOptions: {
    list: (request) => ipcRenderer.invoke(catalogOptionIpcChannels.list, request),
    create: (request) => ipcRenderer.invoke(catalogOptionIpcChannels.create, request),
    rename: (request) => ipcRenderer.invoke(catalogOptionIpcChannels.rename, request),
    retire: (request) => ipcRenderer.invoke(catalogOptionIpcChannels.retire, request),
    restore: (request) => ipcRenderer.invoke(catalogOptionIpcChannels.restore, request)
  },
  auth: {
    login: (request) => ipcRenderer.invoke(authIpcChannels.login, request),
    logout: () => ipcRenderer.invoke(authIpcChannels.logout)
  },
  dashboard: {
    get: (request) => ipcRenderer.invoke(dashboardIpcChannels.get, request)
  },
  dailyReports: {
    resolveActive: (request) => ipcRenderer.invoke(dailyReportIpcChannels.resolveActive, request),
    listCalendar: (request) => ipcRenderer.invoke(dailyReportIpcChannels.listCalendar, request),
    getSnapshot: (request) => ipcRenderer.invoke(dailyReportIpcChannels.getSnapshot, request),
    updateSummary: (request) => ipcRenderer.invoke(dailyReportIpcChannels.updateSummary, request),
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
      remove: (input: { ids: string[] }) => ipcRenderer.invoke(expenseIpcChannels.remove, input),
      summaryTotals: (reportId: string) =>
        ipcRenderer.invoke(expenseIpcChannels.summaryTotals, { reportId })
    }
  },
  installments: {
    list: (request) => ipcRenderer.invoke(installmentIpcChannels.list, request),
    bootstrap: (request) => ipcRenderer.invoke(installmentIpcChannels.bootstrap, request),
    closeContract: (request) => ipcRenderer.invoke(installmentIpcChannels.closeContract, request),
    blacklistAccount: (request) =>
      ipcRenderer.invoke(installmentIpcChannels.blacklistAccount, request),
    delete: (request) => ipcRenderer.invoke(installmentIpcChannels.delete, request),
    getPaymentWorkspace: (request) =>
      ipcRenderer.invoke(installmentIpcChannels.paymentWorkspace, request),
    listHistory: (request) => ipcRenderer.invoke(installmentIpcChannels.history, request),
    createPayment: (request) => ipcRenderer.invoke(installmentIpcChannels.createPayment, request),
    adjustPayment: (request) => ipcRenderer.invoke(installmentIpcChannels.adjustPayment, request)
  },
  financeAccounts: {
    list: (request) => ipcRenderer.invoke(financeAccountIpcChannels.list, request),
    create: (request) => ipcRenderer.invoke(financeAccountIpcChannels.create, request),
    update: (request) => ipcRenderer.invoke(financeAccountIpcChannels.update, request),
    delete: (request) => ipcRenderer.invoke(financeAccountIpcChannels.delete, request)
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
