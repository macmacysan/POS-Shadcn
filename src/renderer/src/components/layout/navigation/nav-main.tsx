import * as React from 'react'
import { ChevronRightIcon } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar
} from '@/components/ui/sidebar'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

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

function NavFlyoutItem({ item }: { item: NavChildItem }): React.JSX.Element {
  if (item.children) {
    return (
      <DropdownMenuSub>
        <DropdownMenuSubTrigger className="gap-2">
          {item.icon}
          <span>{item.title}</span>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="min-w-48">
          {item.children.map((child) => (
            <NavFlyoutItem key={child.title} item={child} />
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    )
  }

  return (
    <DropdownMenuItem
      className="gap-2"
      data-active={item.isActive}
      render={<a href={item.url} onClick={(event) => handleNavClick(event, item.onClick)} />}
    >
      {item.icon}
      <span>{item.title}</span>
    </DropdownMenuItem>
  )
}

function NavChildLink({ item }: { item: NavChildItem }): React.JSX.Element {
  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton
        isActive={item.isActive}
        render={<a href={item.url} onClick={(event) => handleNavClick(event, item.onClick)} />}
      >
        <span>{item.title}</span>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  )
}

function NavChildList({ items }: { items: NavChildItem[] }): React.JSX.Element {
  const initiallyOpenGroup = items.find((item) => item.children && hasActiveDescendant(item))?.title
  const [openGroup, setOpenGroup] = React.useState<string | undefined>(initiallyOpenGroup)

  return (
    <>
      {items.map((item) =>
        item.children ? (
          <Collapsible
            key={item.title}
            open={openGroup === item.title}
            onOpenChange={(open) => setOpenGroup(open ? item.title : undefined)}
            className="group/collapsible"
          >
            <SidebarMenuSubItem>
              <CollapsibleTrigger
                render={
                  <SidebarMenuSubButton className="group-data-panel-open/collapsible:bg-muted/50" />
                }
              >
                {item.icon}
                <span>{item.title}</span>
                <ChevronRightIcon
                  className="ml-auto transition-transform duration-200 group-data-panel-open/collapsible:rotate-90"
                  aria-hidden="true"
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  <NavChildList items={item.children} />
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuSubItem>
          </Collapsible>
        ) : (
          <NavChildLink key={item.title} item={item} />
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
        tooltip={item.title}
        render={<a href={item.url} onClick={(event) => handleNavClick(event, item.onClick)} />}
      >
        {item.icon}
        <span>{item.title}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function NavGroupFlyout({ item }: { item: NavGroupItem }): React.JSX.Element {
  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <SidebarMenuButton
              isActive={hasActiveDescendant(item)}
              tooltip={item.title}
              className="group-data-[collapsible=icon]:justify-center"
            />
          }
        >
          {item.icon}
          <span>{item.title}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="min-w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {item.title}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {item.children.map((child) => (
              <NavFlyoutItem key={child.title} item={child} />
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )
}

export function NavMain({ items }: { items: NavItem[] }): React.JSX.Element {
  const { state, isMobile } = useSidebar()
  const isCollapsed = state === 'collapsed' && !isMobile
  const initiallyOpenGroup = items.find(
    (item): item is NavGroupItem => isNavGroup(item) && hasActiveDescendant(item)
  )?.title
  const [openGroup, setOpenGroup] = React.useState<string | undefined>(initiallyOpenGroup)

  const handleGroupOpenChange = (title: string, open: boolean): void => {
    setOpenGroup(open ? title : undefined)
  }

  return (
    <SidebarMenu className="gap-1">
      {items.map((item) =>
        isNavSection(item) ? (
          <SidebarMenuItem key={item.title}>
            <div className="px-2 py-1.5 text-xs font-light text-sidebar-foreground/70">
              {item.title}
            </div>
            {item.children && (
              <SidebarMenuSub>
                <NavChildList items={item.children} />
              </SidebarMenuSub>
            )}
          </SidebarMenuItem>
        ) : isNavGroup(item) && isCollapsed ? (
          <NavGroupFlyout key={item.title} item={item} />
        ) : isNavGroup(item) ? (
          <Collapsible
            key={item.title}
            open={openGroup === item.title}
            onOpenChange={(open) => handleGroupOpenChange(item.title, open)}
            className="group/collapsible"
          >
            <SidebarMenuItem>
              <CollapsibleTrigger
                render={
                  <SidebarMenuButton className="group-data-panel-open/collapsible:bg-muted/50" />
                }
              >
                {item.icon}
                <span>{item.title}</span>
                <ChevronRightIcon
                  className="ml-auto transition-transform duration-200 group-data-panel-open/collapsible:rotate-90"
                  aria-hidden="true"
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  <NavChildList items={item.children} />
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        ) : (
          <NavItemLink key={item.title} item={item} />
        )
      )}
    </SidebarMenu>
  )
}
