import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  AuthApi,
  CatalogOptionsApi,
  DashboardApi,
  DailyReportsApi,
  ExpensesApi,
  FinanceAccountsApi,
  GeocodingApi,
  InstallmentsApi,
  WindowControlsApi
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
      DailyReportsApi &
      GeocodingApi
    windowControls?: WindowControlsApi
  }
}
