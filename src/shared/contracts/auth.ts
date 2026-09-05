import { z } from '../zod'

import { financeBranchValues } from './finance-accounts'

export const userRoleValues = ['CASHIER', 'ADMIN'] as const
export const userRoleSchema = z.enum(userRoleValues)
export const authModeValues = ['local'] as const
export const authModeSchema = z.enum(authModeValues)

export const loginBranchValues = ['All Branch', ...financeBranchValues] as const
export const loginBranchSchema = z.enum(loginBranchValues)

export const loginRequestSchema = z.object({
  username: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(200)
})
export const switchBranchRequestSchema = z.object({ branch: loginBranchSchema })
export const cashierLoginBranchSchema = loginBranchSchema.exclude(['All Branch'])
export const createAccountRequestSchema = z.object({
  username: z.string().trim().min(3).max(100),
  password: z.string().min(6).max(200),
  branch: cashierLoginBranchSchema,
  role: userRoleSchema
})
export type UserRole = z.infer<typeof userRoleSchema>
export type AuthMode = z.infer<typeof authModeSchema>
export type LoginRequest = z.infer<typeof loginRequestSchema>
export type CreateAccountRequest = z.infer<typeof createAccountRequestSchema>
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
  createAccount: 'auth:create-account',
  getMode: 'auth:get-mode',
  switchBranch: 'auth:switch-branch',
  getCashierLoginBranch: 'auth:get-cashier-login-branch',
  setCashierLoginBranch: 'auth:set-cashier-login-branch',
  getInitialRecoveryStatus: 'auth:get-initial-recovery-status',
  restoreInitialBranchSnapshot: 'auth:restore-initial-branch-snapshot',
  logout: 'auth:logout',
  accountSyncCompleted: 'auth:account-sync-completed'
} as const

export type AuthApi = {
  auth: {
    login(request: LoginRequest): Promise<AuthenticatedUser>
    createAccount(request: CreateAccountRequest): Promise<void>
    getMode(): Promise<AuthMode>
    switchBranch(request: z.infer<typeof switchBranchRequestSchema>): Promise<AuthenticatedUser>
    getCashierLoginBranch(): Promise<FinanceBranch | undefined>
    setCashierLoginBranch(branch: FinanceBranch): Promise<FinanceBranch>
    getInitialRecoveryStatus(): Promise<{ required: boolean }>
    restoreInitialBranchSnapshot(branch: FinanceBranch): Promise<void>
    logout(): Promise<void>
    onAccountSyncCompleted(listener: (count: number) => void): () => void
  }
}
