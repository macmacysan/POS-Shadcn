import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  AuthApi,
  CatalogOptionsApi,
  DashboardApi,
  DailyReportsApi,
  ExpensesApi,
  EntryHistoryApi,
  FinanceAccountsApi,
  GeocodingApi,
  InstallmentsApi,
  InstallmentRulesApi,
  PdfExportApi,
  TelegramSettingsApi,
  UserProfilesApi,
  WindowControlsApi
} from '../shared/contracts'

declare global {
  interface Window {
    electron: ElectronAPI
    api: ExpensesApi &
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
      TelegramSettingsApi &
      UserProfilesApi
    windowControls?: WindowControlsApi
  }
}
