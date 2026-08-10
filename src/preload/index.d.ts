import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  AuthApi,
  CatalogOptionsApi,
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
      CatalogOptionsApi &
      DashboardApi &
      DailyReportsApi
  }
}
