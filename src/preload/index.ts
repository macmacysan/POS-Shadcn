import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

import {
  expenseIpcChannels,
  installmentIpcChannels,
  reportIpcChannels,
  type ExpenseCreateInput,
  type ExpenseListRequest,
  type ExpenseUpdateInput,
  type ExpensesApi,
  type InstallmentsApi,
  type ReportRecord
} from '../shared/contracts'

// Custom APIs for renderer
const api: ExpensesApi & InstallmentsApi = {
  reports: {
    getById: (reportId: string): Promise<ReportRecord | null> =>
      ipcRenderer.invoke(reportIpcChannels.getById, { reportId }),
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
      ipcRenderer.invoke(installmentIpcChannels.blacklistAccount, request)
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
