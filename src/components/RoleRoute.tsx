import { Navigate, Outlet } from "react-router-dom"

import { getDashboardPath, useAuth } from "@/contexts/auth-context"

type RoleRouteProps = {
  allowedRoles: string[]
}

export function RoleRoute({ allowedRoles }: RoleRouteProps) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div
          className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
          aria-hidden
        />
        <span className="sr-only">Loading…</span>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!allowedRoles.includes(user.role?.name ?? "")) {
    return <Navigate to={getDashboardPath(user.role?.name)} replace />
  }

  return <Outlet />
}
