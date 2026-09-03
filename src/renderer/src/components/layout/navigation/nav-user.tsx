import { CaretUpDownIcon, GearSixIcon, MoonIcon, SignOutIcon, SunIcon } from '@phosphor-icons/react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar
} from '@/components/ui/sidebar'
import { Badge } from '@/components/ui/badge'
import { AccountBranchBadge } from '@/features/in-house-accounts/components/account-badges'
import { loginBranchValues, type LoginBranch } from '@/../../shared/contracts'

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'U'
  )
}

export function NavUser({
  user,
  isDark,
  onOpenSettings,
  onToggleTheme,
  onLogout,
  isAdmin,
  settingsOnly = false,
  onBranchChange
}: {
  user: {
    name: string
    role: string
    branch: 'All Branch' | 'Goa' | 'Tinambac' | 'Tigaon' | 'Lagonoy'
  }
  isDark: boolean
  onOpenSettings: () => void
  onToggleTheme: () => void
  onLogout: () => void
  isAdmin: boolean
  settingsOnly?: boolean
  onBranchChange: (branch: LoginBranch) => void
}): React.JSX.Element {
  const { isMobile } = useSidebar()
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />}
          >
            <Avatar>
              <AvatarFallback>{initials(user.name)}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs text-sidebar-foreground/65">{user.role}</span>
            </div>
            <CaretUpDownIcon className="ml-auto" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            align="start"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-1 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar>
                    <AvatarFallback>{initials(user.name)}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium text-foreground">{user.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{user.role}</span>
                  </div>
                </div>
                <div className="px-1 pb-1">
                  {user.branch === 'All Branch' ? (
                    <Badge variant="outline">All branches</Badge>
                  ) : (
                    <AccountBranchBadge branch={user.branch} />
                  )}
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            {isAdmin && !settingsOnly && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Active branch</DropdownMenuLabel>
                  {loginBranchValues.map((branch) => (
                    <DropdownMenuCheckboxItem
                      key={branch}
                      checked={user.branch === branch}
                      onClick={() => onBranchChange(branch)}
                    >
                      {branch === 'All Branch' ? 'All branches' : branch}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuGroup>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={onOpenSettings}>
                <GearSixIcon />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onToggleTheme}>
                {isDark ? <SunIcon /> : <MoonIcon />}
                {isDark ? 'Light mode' : 'Dark mode'}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem variant="destructive" onClick={onLogout}>
                <SignOutIcon />
                Log out
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
