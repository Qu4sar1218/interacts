"use client"

import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { useAuth } from "@/contexts/auth-context"
import {
  getNavItemsByRole,
  getSettingsItemByRole,
  isNavGroup,
  isRouteActive,
} from "@/components/layout/sidebar-menu-config"
import type { NavMainItem } from "@/components/nav-main"
import { cn, getAvatarUrl } from "@/lib/utils"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { Link, useLocation, useNavigate } from "react-router-dom"
import SchoolLogo from "@/assets/SchoolLogo.png"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const { setOpenMobile, state } = useSidebar()
  const isCollapsed = state === "collapsed"
  const roleName = user?.role?.name

  const navItems: NavMainItem[] = getNavItemsByRole(roleName).map((entry) => {
    if (isNavGroup(entry)) {
      const groupIsActive =
        isRouteActive(location.pathname, entry.path) ||
        entry.children.some((c) => isRouteActive(location.pathname, c.path))
      return {
        type: "group",
        title: entry.label,
        basePath: entry.path,
        icon: <entry.icon className="h-4 w-4" />,
        isActive: groupIsActive,
        children: entry.children.map((c) => ({
          title: c.label,
          url: c.path,
          isActive: isRouteActive(location.pathname, c.path),
        })),
      }
    }
    return {
      type: "flat",
      title: entry.label,
      url: entry.path,
      icon: <entry.icon className="h-4 w-4" />,
      isActive: isRouteActive(location.pathname, entry.path),
    }
  })
  const settingsItem = getSettingsItemByRole(roleName)

  const userName = user ? `${user.firstName} ${user.lastName}`.trim() : "Admin"
  const userEmail = user?.email ?? "admin@example.com"
  const userAvatar = getAvatarUrl(user?.imageUrl)

  const onLogout = () => {
    setOpenMobile(false)
    logout().then(() => navigate("/login"))
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className={cn(isCollapsed && "px-0")}>
        <div
          className={cn(
            "relative flex h-14 items-center",
            isCollapsed ? "w-full justify-center px-0" : "px-2"
          )}
        >
          <div
            className={cn(
              "flex min-w-0 items-center",
              isCollapsed ? "mx-auto" : "flex-1 gap-2"
            )}
          >
            <img
              src={SchoolLogo}
              alt="School logo"
              className={cn(
                "shrink-0 object-contain logo-sidebar-glow",
                isCollapsed ? "h-8 w-8" : "h-9 w-9"
              )}
            />
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-semibold">InterACTS</p>
              <p className="truncate text-xs text-muted-foreground">Face attendance</p>
            </div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
      </SidebarContent>
      <SidebarFooter>
        {settingsItem ? (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isRouteActive(location.pathname, settingsItem.path)}
                onClick={() => setOpenMobile(false)}
              >
                <Link to={settingsItem.path}>
                  <settingsItem.icon className="h-4 w-4" />
                  <span>{settingsItem.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        ) : null}
        <NavUser
          user={{ name: userName, email: userEmail, avatar: userAvatar }}
          onLogout={onLogout}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
