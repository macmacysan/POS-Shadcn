import { ipcMain } from 'electron'
import { googlePublishIpcChannels, googlePublishRequestSchema } from '../../shared/contracts'
import { AppError, toIpcError } from '../database/errors'
import { AuthService } from '../services/auth-service'
import { GoogleSheetPublishService } from '../services/google-sheet-publish-service'

export function registerGooglePublishIpc(service: GoogleSheetPublishService, auth: AuthService): void {
  ipcMain.handle(googlePublishIpcChannels.publish, async (_event, input: unknown) => {
    try {
      const user = auth.requireCashierWorkspace()
      const request = googlePublishRequestSchema.parse(input)
      if (user.role !== 'ADMIN' && user.branch !== request.branch)
        throw new AppError('FORBIDDEN', 'You can only publish reports for your assigned branch.')
      return await service.publish(request)
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Google '))
        throw new AppError('DATABASE_ERROR', error.message)
      throw toIpcError(error)
    }
  })
}
