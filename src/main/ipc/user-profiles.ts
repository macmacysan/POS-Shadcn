import { ipcMain } from 'electron'
import {
  userProfileIpcChannels,
  userProfileCreateSchema,
  userProfileUpdateSchema,
  userProfileDeleteSchema,
  userProfileResetPasswordSchema
} from '../../shared/contracts'
import { toIpcError } from '../database/errors'
import { UserProfilesService } from '../services/user-profiles-service'
export function registerUserProfilesIpc(service: UserProfilesService): void {
  ipcMain.handle(userProfileIpcChannels.list, () => {
    try {
      return service.list()
    } catch (error) {
      throw toIpcError(error)
    }
  })
  ipcMain.handle(userProfileIpcChannels.audit, () => {
    try {
      return service.audit()
    } catch (error) {
      throw toIpcError(error)
    }
  })
  ipcMain.handle(userProfileIpcChannels.create, async (_event, input: unknown) => {
    try {
      return await service.create(userProfileCreateSchema.parse(input))
    } catch (error) {
      throw toIpcError(error)
    }
  })
  ipcMain.handle(userProfileIpcChannels.update, async (_event, input: unknown) => {
    try {
      return await service.update(userProfileUpdateSchema.parse(input))
    } catch (error) {
      throw toIpcError(error)
    }
  })
  ipcMain.handle(userProfileIpcChannels.delete, async (_event, input: unknown) => {
    try {
      await service.delete(userProfileDeleteSchema.parse(input).id)
    } catch (error) {
      throw toIpcError(error)
    }
  })
  ipcMain.handle(userProfileIpcChannels.resetPassword, async (_event, input: unknown) => {
    try {
      const value = userProfileResetPasswordSchema.parse(input)
      await service.resetPassword(value.id, value.password)
    } catch (error) {
      throw toIpcError(error)
    }
  })
}
