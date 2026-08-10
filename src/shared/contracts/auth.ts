import { z } from 'zod'

import { financeBranchValues } from './finance-accounts'

export const userRoleValues = ['CASHIER', 'ADMIN'] as const
export const userRoleSchema = z.enum(userRoleValues)

export const loginBranchValues = ['All Branch', ...financeBranchValues] as const
export const loginBranchSchema = z.enum(loginBranchValues)

export const loginRequestSchema = z.object({
  branch: loginBranchSchema,
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(200)
})

export type UserRole = z.infer<typeof userRoleSchema>
export type LoginRequest = z.infer<typeof loginRequestSchema>
export type FinanceBranch = (typeof financeBranchValues)[number]
export type LoginBranch = (typeof loginBranchValues)[number]
export type AuthenticatedUser = {
  id: string
  displayName: string
  role: UserRole
  branchId: string
  branch: LoginBranch
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
