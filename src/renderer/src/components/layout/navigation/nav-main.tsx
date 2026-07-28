import * as React from 'react'

import { Badge as ReuiBadge } from '@/components/ui/reui/badge'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem
} from '@/components/ui/sidebar'

type NavChildItem = {
  title: string
  url: string
  isActive?: boolean
  onClick?: () => void
  icon?: React.ReactNode
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

type NavSectionItem = {
  title: string
  section: true
  children?: NavChildItem[]
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
  | NavSectionItem

type NavLinkItem = Exclude<NavItem, NavGroupItem | NavSectionItem>

function isNavGroup(item: NavItem): item is NavGroupItem {
  return Array.isArray(item.children)
}

function isNavSection(item: NavItem): item is NavSectionItem {
  return 'section' in item && item.section === true
}

function hasActiveDescendant(item: NavChildItem): boolean {
  return Boolean(item.isActive || item.children?.some(hasActiveDescendant))
}

function handleNavClick(event: React.MouseEvent<HTMLElement>, onClick?: () => void): void {
  if (!onClick) return
  event.preventDefault()
  onClick()
}

function NavChildList({ items }: { items: NavChildItem[] }): React.JSX.Element {
  return (
    <>
      {items.map((item) =>
        item.children ? (
          <SidebarMenuSubItem key={item.title}>
            <div className="flex h-7 items-center gap-2 px-2 text-[11px] font-medium text-sidebar-foreground/75">
              {item.icon}
              <span className="min-w-0 flex-1 truncate">{item.title}</span>
              <ReuiBadge
                variant="outline"
                size="xs"
                aria-label={`${item.children.length} destinations`}
              >
                {item.children.length}
              </ReuiBadge>
            </div>
            <SidebarMenuSub className="mb-1 mt-0 border-sidebar-border/50 py-0">
              <NavChildList items={item.children} />
            </SidebarMenuSub>
          </SidebarMenuSubItem>
        ) : (
          <SidebarMenuSubItem key={item.title}>
            <SidebarMenuSubButton
              isActive={item.isActive}
              render={
                <a href={item.url} onClick={(event) => handleNavClick(event, item.onClick)} />
              }
            >
              {item.icon}
              <span>{item.title}</span>
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
        isActive={item.isActive}
        render={<a href={item.url} onClick={(event) => handleNavClick(event, item.onClick)} />}
      >
        {item.icon}
        <span>{item.title}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function NavGroup({ item }: { item: NavGroupItem }): React.JSX.Element {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={item.isActive || item.children.some(hasActiveDescendant)}
        render={<a href={item.url} onClick={(event) => handleNavClick(event, item.onClick)} />}
      >
        {item.icon}
        <span>{item.title}</span>
      </SidebarMenuButton>
      <SidebarMenuSub className="mt-0.5 py-0">
        <NavChildList items={item.children} />
      </SidebarMenuSub>
    </SidebarMenuItem>
  )
}

export function NavMain({ items }: { items: NavItem[] }): React.JSX.Element {
  return (
    <SidebarMenu className="gap-1">
      {items.map((item) =>
        isNavSection(item) ? (
          <SidebarMenuItem key={item.title} className="pt-2">
            <div className="px-2 pb-1 text-[10px] font-medium uppercase tracking-[0.08em] text-sidebar-foreground/55">
              {item.title}
            </div>
            {item.children && (
              <SidebarMenuSub className="mx-0 border-sidebar-border/50 px-1 py-0">
                <NavChildList items={item.children} />
              </SidebarMenuSub>
            )}
          </SidebarMenuItem>
        ) : isNavGroup(item) ? (
          <NavGroup key={item.title} item={item} />
        ) : (
          <NavItemLink key={item.title} item={item} />
        )
      )}
    </SidebarMenu>
  )
}
