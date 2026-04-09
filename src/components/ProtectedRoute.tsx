import { Navigate, Outlet } from "react-router-dom"

import { useAuth } from "@/contexts/auth-context"

export function ProtectedRoute() {
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

  return <Outlet />
}
