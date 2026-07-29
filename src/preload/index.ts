import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

import {
  expenseIpcChannels,
  authIpcChannels,
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
  type DashboardApi,
  type DailyReportsApi,
  type FinanceAccountsApi,
  type InstallmentsApi,
  type ReportRecord
} from '../shared/contracts'

// Custom APIs for renderer
const api: ExpensesApi &
  InstallmentsApi &
  FinanceAccountsApi &
  AuthApi &
  DashboardApi &
  DailyReportsApi = {
  auth: {
    login: (request) => ipcRenderer.invoke(authIpcChannels.login, request),
    logout: () => ipcRenderer.invoke(authIpcChannels.logout)
  },
  dashboard: {
    get: (request) => ipcRenderer.invoke(dashboardIpcChannels.get, request)
  },
  dailyReports: {
    resolveActive: (request) => ipcRenderer.invoke(dailyReportIpcChannels.resolveActive, request),
    getSnapshot: (request) => ipcRenderer.invoke(dailyReportIpcChannels.getSnapshot, request),
    updateSummary: (request) => ipcRenderer.invoke(dailyReportIpcChannels.updateSummary, request),
    listIncome: (request) => ipcRenderer.invoke(dailyReportIpcChannels.listIncome, request),
    createIncome: (request) => ipcRenderer.invoke(dailyReportIpcChannels.createIncome, request),
    updateIncome: (request) => ipcRenderer.invoke(dailyReportIpcChannels.updateIncome, request),
    voidIncome: (request) => ipcRenderer.invoke(dailyReportIpcChannels.voidIncome, request),
    listPayments: (request) => ipcRenderer.invoke(dailyReportIpcChannels.listPayments, request),
    createPayment: (request) => ipcRenderer.invoke(dailyReportIpcChannels.createPayment, request),
    updatePayment: (request) => ipcRenderer.invoke(dailyReportIpcChannels.updatePayment, request),
    voidPayment: (request) => ipcRenderer.invoke(dailyReportIpcChannels.voidPayment, request)
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
    getPaymentWorkspace: (request) =>
      ipcRenderer.invoke(installmentIpcChannels.paymentWorkspace, request),
    createPayment: (request) => ipcRenderer.invoke(installmentIpcChannels.createPayment, request),
    adjustPayment: (request) => ipcRenderer.invoke(installmentIpcChannels.adjustPayment, request)
  },
  financeAccounts: {
    list: (request) => ipcRenderer.invoke(financeAccountIpcChannels.list, request),
    create: (request) => ipcRenderer.invoke(financeAccountIpcChannels.create, request),
    update: (request) => ipcRenderer.invoke(financeAccountIpcChannels.update, request)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
