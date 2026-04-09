"use client"

import * as React from "react"
import { ChevronRight } from "lucide-react"
import { Link, useLocation } from "react-router-dom"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

export type NavMainFlatItem = {
  type: "flat"
  title: string
  url: string
  icon?: React.ReactNode
  isActive?: boolean
}

export type NavMainGroupItem = {
  type: "group"
  title: string
  basePath: string
  icon?: React.ReactNode
  isActive?: boolean
  children: { title: string; url: string; isActive: boolean }[]
}

export type NavMainItem = NavMainFlatItem | NavMainGroupItem

function NavGroupExpanded({ item }: { item: NavMainGroupItem }) {
  const { setOpenMobile } = useSidebar()
  const pathname = useLocation().pathname

  const isRouteWithinGroup = React.useCallback(() => {
    if (pathname.startsWith(item.basePath)) return true
    return item.children.some((c) => c.isActive)
  }, [pathname, item.basePath, item.children])

  const [open, setOpen] = React.useState(() => isRouteWithinGroup())

  React.useEffect(() => {
    if (isRouteWithinGroup()) {
      setOpen(true)
    }
  }, [isRouteWithinGroup])

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            tooltip={item.title}
            isActive={item.isActive}
            className="pr-7"
          >
            {item.icon}
            <span>{item.title}</span>
            <ChevronRight
              className={cn(
                "ml-auto transition-transform duration-200",
                open && "rotate-90"
              )}
            />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.children.map((child) => (
              <SidebarMenuSubItem key={child.url}>
                <SidebarMenuSubButton asChild isActive={child.isActive}>
                  <Link to={child.url} onClick={() => setOpenMobile(false)}>
                    <span>{child.title}</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}

function NavGroupIconRail({ item }: { item: NavMainGroupItem }) {
  const { setOpenMobile } = useSidebar()

  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton tooltip={item.title} isActive={item.isActive}>
            {item.icon}
            <span className="group-data-[collapsible=icon]:hidden">
              {item.title}
            </span>
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="min-w-56 rounded-lg"
          side="right"
          align="start"
          sideOffset={8}
        >
          {item.children.map((child) => (
            <DropdownMenuItem key={child.url} asChild>
              <Link
                to={child.url}
                className="cursor-pointer"
                onClick={() => setOpenMobile(false)}
              >
                {child.title}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )
}

export function NavMain({ items }: { items: NavMainItem[] }) {
  const { state, isMobile, setOpenMobile } = useSidebar()
  const isIconRail = state === "collapsed"

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          if (item.type === "flat") {
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  tooltip={item.title}
                  isActive={item.isActive}
                  onClick={() => setOpenMobile(false)}
                >
                  <Link to={item.url}>
                    {item.icon}
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          }

          if (isIconRail && !isMobile) {
            return <NavGroupIconRail key={item.title} item={item} />
          }

          return <NavGroupExpanded key={item.title} item={item} />
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
