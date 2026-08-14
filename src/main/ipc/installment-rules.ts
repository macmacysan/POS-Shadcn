import { ipcMain } from 'electron'
import { installmentRulesIpcChannels, installmentRulesSaveRequestSchema } from '../../shared/contracts'
import { toIpcError } from '../database/errors'
import { InstallmentRulesService } from '../services/installment-rules-service'

export function registerInstallmentRulesIpc(service: InstallmentRulesService): void {
  ipcMain.handle(installmentRulesIpcChannels.getActive, () => { try { return service.getActive() } catch (error) { throw toIpcError(error) } })
  ipcMain.handle(installmentRulesIpcChannels.list, () => { try { return service.list() } catch (error) { throw toIpcError(error) } })
  ipcMain.handle(installmentRulesIpcChannels.save, (_event, input: unknown) => { try { return service.save(installmentRulesSaveRequestSchema.parse(input)) } catch (error) { throw toIpcError(error) } })
}
