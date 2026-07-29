import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  AuthApi,
  DashboardApi,
  DailyReportsApi,
  ExpensesApi,
  FinanceAccountsApi,
  InstallmentsApi
} from '../shared/contracts'

declare global {
  interface Window {
    electron: ElectronAPI
    api: ExpensesApi &
      InstallmentsApi &
      FinanceAccountsApi &
      AuthApi &
      DashboardApi &
      DailyReportsApi
  }
}
