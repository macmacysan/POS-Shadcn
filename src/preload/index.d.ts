import { ElectronAPI } from '@electron-toolkit/preload'
import type { ExpensesApi } from '../shared/contracts'

declare global {
  interface Window {
    electron: ElectronAPI
    api: ExpensesApi
  }
}
