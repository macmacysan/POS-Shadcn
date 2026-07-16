import * as React from 'react'
import { ChevronRightIcon } from 'lucide-react'

import {
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
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

function isNavGroup(item: NavItem): item is NavGroupItem {
  return Array.isArray(item.children)
}

function hasActiveDescendant(item: NavChildItem): boolean {
  return Boolean(item.isActive || item.children?.some(hasActiveDescendant))
}

function NavChildLink({ item }: { item: NavChildItem }): React.JSX.Element {
  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton
        isActive={item.isActive}
        onClick={item.onClick}
        render={<a href={item.url} />}
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
                render={<SidebarMenuSubButton isActive={hasActiveDescendant(item)} />}
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

function NavItemLink({ item }: { item: NavItem }): React.JSX.Element {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={item.isActive}
        onClick={item.onClick}
        render={<a href={item.url} />}
      >
        {item.icon}
        <span>{item.title}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

export function NavMain({ items }: { items: NavItem[] }): React.JSX.Element {
  const initiallyOpenGroup = items.find(
    (item): item is NavGroupItem => isNavGroup(item) && hasActiveDescendant(item)
  )?.title
  const [openGroup, setOpenGroup] = React.useState<string | undefined>(initiallyOpenGroup)

  const handleGroupOpenChange = (title: string, open: boolean): void => {
    setOpenGroup(open ? title : undefined)
  }

  return (
    <SidebarMenu>
      {items.map((item) =>
        isNavGroup(item) ? (
          <Collapsible
            key={item.title}
            open={openGroup === item.title}
            onOpenChange={(open) => handleGroupOpenChange(item.title, open)}
            className="group/collapsible"
          >
            <SidebarMenuItem>
              <CollapsibleTrigger
                render={<SidebarMenuButton isActive={hasActiveDescendant(item)} />}
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
