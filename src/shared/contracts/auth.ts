import { z } from 'zod'

import { financeBranchValues } from './finance-accounts'

export const userRoleValues = ['CASHIER', 'ADMIN'] as const
export const userRoleSchema = z.enum(userRoleValues)

export const loginRequestSchema = z.object({
  branch: z.enum(financeBranchValues),
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(200)
})

export type UserRole = z.infer<typeof userRoleSchema>
export type LoginRequest = z.infer<typeof loginRequestSchema>
export type FinanceBranch = (typeof financeBranchValues)[number]
export type AuthenticatedUser = {
  id: string
  displayName: string
  role: UserRole
  branchId: string
  branch?: FinanceBranch
}

export const authIpcChannels = {
  login: 'auth:login',
  logout: 'auth:logout'
} as const

export type AuthApi = {
  auth: {
    login(request: LoginRequest): Promise<AuthenticatedUser>
    logout(): Promise<void>
  }
}
