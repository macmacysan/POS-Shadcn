import type { IpcErrorPayload } from '../../shared/contracts'
import { z } from 'zod'

export class AppError extends Error {
  constructor(
    public readonly code: IpcErrorPayload['code'],
    message: string
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function toIpcError(error: unknown): IpcErrorPayload {
  if (error instanceof AppError) return { code: error.code, message: error.message }
  if (error instanceof z.ZodError) {
    return { code: 'VALIDATION_ERROR', message: 'The request data is invalid.' }
  }
  return { code: 'DATABASE_ERROR', message: 'The local database operation failed.' }
}
