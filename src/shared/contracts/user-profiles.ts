import { z } from 'zod'

import { loginBranchSchema, userRoleSchema } from './auth'

const id = z.string().uuid()
const password = z.string().min(8).max(200)
const profile = z.object({
  displayName: z.string().trim().min(1).max(100),
  username: z.string().trim().min(3).max(100),
  role: userRoleSchema,
  branch: loginBranchSchema.exclude(['All Branch']),
  isActive: z.boolean()
})
export const userProfileCreateSchema = profile.extend({ password })
export const userProfileUpdateSchema = profile.extend({ id })
export const userProfileResetPasswordSchema = z.object({ id, password })
export const userProfileRecordSchema = profile.extend({ id, lastLoginAt: z.string().nullable() })
export const userProfileAuditRecordSchema = z.object({ id, actorName: z.string(), targetName: z.string(), action: z.string(), summary: z.string(), createdAt: z.string() })
export type UserProfileCreate = z.infer<typeof userProfileCreateSchema>
export type UserProfileUpdate = z.infer<typeof userProfileUpdateSchema>
export type UserProfileRecord = z.infer<typeof userProfileRecordSchema>
export const userProfileIpcChannels = { list: 'user-profiles:list', create: 'user-profiles:create', update: 'user-profiles:update', resetPassword: 'user-profiles:reset-password', audit: 'user-profiles:audit' } as const
export type UserProfilesApi = { userProfiles: { list(): Promise<UserProfileRecord[]>; create(request: UserProfileCreate): Promise<UserProfileRecord>; update(request: UserProfileUpdate): Promise<UserProfileRecord>; resetPassword(request: z.infer<typeof userProfileResetPasswordSchema>): Promise<void>; audit(): Promise<z.infer<typeof userProfileAuditRecordSchema>[]> } }
