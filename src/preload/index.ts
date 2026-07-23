import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

import {
  expenseIpcChannels,
  reportIpcChannels,
  type ExpenseCreateInput,
  type ExpenseListRequest,
  type ExpenseUpdateInput,
  type ExpensesApi,
  type ReportRecord
} from '../shared/contracts'

// Custom APIs for renderer
const api: ExpensesApi = {
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
