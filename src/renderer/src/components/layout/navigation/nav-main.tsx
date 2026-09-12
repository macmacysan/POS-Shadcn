import * as React from 'react'

import {
  CaretDownIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClipboardTextIcon,
  ClockIcon,
  CreditCardIcon,
  FileTextIcon,
  ListBulletsIcon,
  ProhibitIcon,
  SquaresFourIcon
} from '@phosphor-icons/react'

import { Badge as ReuiBadge } from '@/components/ui/reui/badge'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem
} from '@/components/ui/sidebar'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

type NavChildItem = {
  title: string
  url: string
  isActive?: boolean
  onClick?: () => void
  icon?: React.ReactNode
  badge?: number
  children?: NavChildItem[]
}

type NavGroupItem = {
  title: string
  url: string
  icon: React.ReactNode
  isActive?: boolean
  onClick?: () => void
  children: NavChildItem[]
}

type NavItem =
  | {
      title: string
      url: string
      icon: React.ReactNode
      isActive?: boolean
      onClick?: () => void
      children?: undefined
    }
  | NavGroupItem

type NavLinkItem = Exclude<NavItem, NavGroupItem>

const navigation: { navMain: NavItem[] } = {
  navMain: [
    { title: 'Dashboard', url: '#', icon: <SquaresFourIcon /> },
    { title: 'Cashier reports', url: '#', icon: <ClipboardTextIcon /> },
    { title: 'Report', url: '#', icon: <FileTextIcon /> },
    {
      title: 'In-house',
      url: '#',
      icon: <ListBulletsIcon />,
      children: [
        { title: 'Records', url: '#', icon: <ListBulletsIcon /> },
        { title: 'Active', url: '#', icon: <ClockIcon /> },
        { title: 'Closed', url: '#', icon: <CheckCircleIcon /> },
        { title: 'Blacklisted', url: '#', icon: <ProhibitIcon /> }
      ]
    },
    {
      title: 'Finance',
      url: '#',
      icon: <CreditCardIcon />,
      children: [{ title: 'Accounts', url: '#', icon: <CreditCardIcon /> }]
    },
    { title: 'Calendar', url: '#', icon: <CalendarIcon /> }
  ]
}

function isNavGroup(item: NavItem): item is NavGroupItem {
  return Array.isArray(item.children)
}

function handleNavClick(event: React.MouseEvent<HTMLElement>, onClick?: () => void): void {
  if (!onClick) return
  event.preventDefault()
  onClick()
}

function compactBadge(value?: number): string | undefined {
  if (!value || value < 1) return undefined
  return value > 99 ? '99+' : String(value)
}

function NavChildList({
  items,
  activeView
}: {
  items: NavChildItem[]
  activeView: string
}): React.JSX.Element {
  return (
    <>
      {items.map((item) =>
        item.children ? (
          <SidebarMenuSubItem
            key={item.title}
            className={item.title === 'In-house' || item.title === 'Finance' ? 'pt-2' : undefined}
          >
            <div className="flex h-8 items-center gap-2 px-2.5 text-xs font-medium text-sidebar-foreground/75">
              {item.icon && (
                <span className="flex size-4 shrink-0 items-center justify-center [&>svg]:size-4">
                  {item.icon}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate">{item.title}</span>
            </div>
            <SidebarMenuSub className="mx-0 mb-1 mt-0.5 border-0 px-0 py-0.5">
              <NavChildList items={item.children} activeView={activeView} />
            </SidebarMenuSub>
          </SidebarMenuSubItem>
        ) : (
          <SidebarMenuSubItem key={item.title}>
            <SidebarMenuSubButton
              className="h-8 rounded-md px-2.5 text-sm"
              isActive={item.isActive}
              render={
                <a href={item.url} onClick={(event) => handleNavClick(event, item.onClick)} />
              }
            >
              {item.icon}
              <span className="min-w-0 flex-1 truncate">{item.title}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <ReuiBadge
                  variant="destructive-light"
                  className="ml-auto"
                  aria-label={`${item.badge} ${item.title === 'Active' ? 'overdue accounts' : 'accounts without a paid date'}`}
                >
                  {compactBadge(item.badge)}
                </ReuiBadge>
              )}
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
        )
      )}
    </>
  )
}

function NavItemLink({ item }: { item: NavLinkItem }): React.JSX.Element {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        className="h-8 rounded-md px-2.5 text-sm font-medium"
        isActive={item.isActive}
        render={<a href={item.url} onClick={(event) => handleNavClick(event, item.onClick)} />}
      >
        {item.icon}
        <span>{item.title}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function NavGroup({
  item,
  activeView
}: {
  item: NavGroupItem
  activeView: string
}): React.JSX.Element {
  return (
    <Collapsible defaultOpen className="group/collapsible">
      <SidebarMenuItem>
        <SidebarMenuButton
          className="h-8 rounded-md px-2.5 text-sm font-medium"
          isActive={item.isActive}
          render={<CollapsibleTrigger />}
          tooltip={item.title}
        >
          {item.icon}
          <span>{item.title}</span>
          <CaretDownIcon className="ml-auto transition-transform group-data-panel-open/collapsible:rotate-180" />
        </SidebarMenuButton>
        <CollapsibleContent>
          <SidebarMenuSub className="mt-1 py-0.5">
            <NavChildList items={item.children} activeView={activeView} />
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}

export function NavMain({
  activeView,
  onDashboard,
  onCashierReports,
  onReport,
  onAllAccounts,
  onActiveAccounts,
  onClosedAccounts,
  onBlacklistedAccounts,
  onFinanceAccounts,
  onCalendar,
  overdueCount,
  unpaidFinanceCount
}: {
  activeView: string
  onDashboard?: () => void
  onCashierReports?: () => void
  onReport?: () => void
  onAllAccounts?: () => void
  onActiveAccounts?: () => void
  onClosedAccounts?: () => void
  onBlacklistedAccounts?: () => void
  onFinanceAccounts?: () => void
  onCalendar?: () => void
  overdueCount?: number
  unpaidFinanceCount?: number
}): React.JSX.Element {
  const items = navigation.navMain.map((item) => {
    if (item.title === 'Dashboard')
      return { ...item, isActive: activeView === 'dashboard', onClick: onDashboard }
    if (item.title === 'Cashier reports')
      return { ...item, isActive: activeView === 'cashier-reports', onClick: onCashierReports }
    if (item.title === 'Report')
      return { ...item, isActive: activeView === 'report', onClick: onReport }
    if (item.title === 'Calendar')
      return { ...item, isActive: activeView === 'calendar', onClick: onCalendar }
    if (!isNavGroup(item)) return item
    if (item.title === 'In-house')
      return {
        ...item,
        children: item.children.map((entry) =>
          entry.title === 'Records'
            ? { ...entry, isActive: activeView === 'in-house-accounts', onClick: onAllAccounts }
            : entry.title === 'Active'
              ? {
                  ...entry,
                  isActive: activeView === 'in-house-active-accounts',
                  badge: overdueCount,
                  onClick: onActiveAccounts
                }
              : entry.title === 'Closed'
                ? {
                    ...entry,
                    isActive: activeView === 'in-house-closed-accounts',
                    onClick: onClosedAccounts
                  }
                : {
                    ...entry,
                    isActive: activeView === 'in-house-blacklisted-accounts',
                    onClick: onBlacklistedAccounts
                  }
        )
      }
    return {
      ...item,
      children: item.children.map((entry) => ({
        ...entry,
        isActive: activeView === 'finance-accounts',
        badge: unpaidFinanceCount,
        onClick: onFinanceAccounts
      }))
    }
  }) as NavItem[]

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu className="gap-1.5">
          {items.map((item) =>
            isNavGroup(item) ? (
              <NavGroup key={item.title} item={item} activeView={activeView} />
            ) : (
              <NavItemLink key={item.title} item={item} />
            )
          )}
        </SidebarMenu>
        <SidebarMenu className="hidden gap-1.5 group-data-[collapsible=icon]:flex">
          {[
            [
              'Cashier reports',
              <ClipboardTextIcon />,
              activeView === 'cashier-reports',
              onCashierReports
            ],
            ['Report', <FileTextIcon />, activeView === 'report', onReport],
            ['Records', <ListBulletsIcon />, activeView === 'in-house-accounts', onAllAccounts],
            ['Active', <ClockIcon />, activeView === 'in-house-active-accounts', onActiveAccounts],
            [
              'Closed',
              <CheckCircleIcon />,
              activeView === 'in-house-closed-accounts',
              onClosedAccounts
            ],
            [
              'Blacklisted',
              <ProhibitIcon />,
              activeView === 'in-house-blacklisted-accounts',
              onBlacklistedAccounts
            ],
            ['Accounts', <CreditCardIcon />, activeView === 'finance-accounts', onFinanceAccounts],
            ['Calendar', <CalendarIcon />, activeView === 'calendar', onCalendar]
          ].map(([title, icon, isActive, onClick]) => (
            <SidebarMenuItem key={title as string}>
              <SidebarMenuButton
                className="relative"
                isActive={isActive as boolean}
                tooltip={title as string}
                render={
                  <a
                    href="#"
                    onClick={(event) => handleNavClick(event, onClick as (() => void) | undefined)}
                  />
                }
              >
                {icon as React.ReactNode}
                <span>{title as string}</span>
                {title === 'Active' && compactBadge(overdueCount) && (
                  <ReuiBadge
                    variant="destructive-light"
                    size="xs"
                    radius="full"
                    className="absolute -right-0.5 -top-0.5 scale-75"
                    aria-label={`${overdueCount} overdue accounts`}
                  >
                    {compactBadge(overdueCount)}
                  </ReuiBadge>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
