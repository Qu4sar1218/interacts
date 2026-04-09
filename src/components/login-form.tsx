import * as React from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { getDashboardPath, useAuth } from "@/contexts/auth-context"
import { getApiErrorMessage } from "@/services/api"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { AlertCircle, Eye, EyeOff, Lock, LogIn, Loader2, User, X } from "lucide-react"

const loginFieldClassName =
  "neu-inset h-10 min-h-10 rounded-xl border-white/20 px-4 py-2.5 text-sm text-[oklch(0.92_0.016_150)] placeholder:text-[oklch(0.70_0.02_150)] md:text-sm focus-visible:ring-2 focus-visible:ring-ring/45"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const [showPassword, setShowPassword] = React.useState(false)
  const [username, setUsername] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)

  const { login } = useAuth()
  const navigate = useNavigate()

  const clearFormError = React.useCallback(() => setFormError(null), [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!username.trim() || !password) {
      setFormError("Enter your username and password.")
      return
    }
    setFormError(null)
    setPending(true)
    try {
      const loggedInUser = await login(username.trim(), password)
      toast.success("Welcome back")
      navigate(getDashboardPath(loggedInUser.role?.name), { replace: true })
    } catch (err) {
      setFormError(getApiErrorMessage(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <form
      className={cn("flex flex-col gap-5", className)}
      onSubmit={handleSubmit}
      {...props}
    >
      <div className="flex flex-col gap-1 text-center">
        <h2
          className="text-lg font-bold tracking-tight"
          style={{ color: "oklch(0.92 0.018 150)" }}
        >
          Sign In
        </h2>
        <p className="text-xs" style={{ color: "oklch(0.62 0.02 150)" }}>
          Enter your credentials to access the system
        </p>
      </div>

      {formError ? (
        <div
          role="alert"
          aria-live="polite"
          className="animate-in fade-in-0 slide-in-from-top-1 flex gap-2.5 rounded-xl px-3.5 py-3 text-sm duration-200"
          style={{
            background:
              "linear-gradient(135deg, oklch(0.26 0.06 25 / 55%), oklch(0.20 0.045 22 / 45%))",
            border: "1px solid oklch(0.58 0.16 25 / 35%)",
            borderLeft: "3px solid oklch(0.62 0.2 22)",
            boxShadow:
              "0 0 0 1px oklch(1 0 0 / 6%) inset, 0 4px 24px oklch(0.45 0.18 22 / 18%)",
          }}
        >
          <AlertCircle
            className="mt-0.5 size-4 shrink-0"
            style={{ color: "oklch(0.78 0.14 22)" }}
            aria-hidden
          />
          <p
            className="min-w-0 flex-1 leading-snug"
            style={{ color: "oklch(0.88 0.04 95)" }}
          >
            {formError}
          </p>
          <button
            type="button"
            onClick={clearFormError}
            className="-m-1 shrink-0 rounded-lg p-1 transition-colors hover:bg-white/10"
            style={{ color: "oklch(0.72 0.04 95)" }}
            aria-label="Dismiss error"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="username"
          className="text-xs font-semibold tracking-wide uppercase"
          style={{ color: "oklch(0.72 0.022 150)" }}
        >
          Username
        </label>
        <div className="relative">
          <User
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            style={{ color: "oklch(0.64 0.018 150)" }}
            aria-hidden="true"
          />
          <Input
            id="username"
            name="username"
            type="text"
            placeholder="Username (admin)"
            required
            autoComplete="username"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value)
              clearFormError()
            }}
            disabled={pending}
            className={cn(loginFieldClassName, "pl-10")}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor="password"
            className="text-xs font-semibold tracking-wide uppercase"
            style={{ color: "oklch(0.72 0.022 150)" }}
          >
            Password
          </label>
          <a
            href="#"
            className="text-xs underline-offset-4 transition-colors duration-150 hover:underline"
            style={{ color: "oklch(0.62 0.19 145)" }}
            tabIndex={-1}
            onClick={(e) => e.preventDefault()}
          >
            Forgot password?
          </a>
        </div>
        <div className="relative">
          <Lock
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            style={{ color: "oklch(0.64 0.018 150)" }}
            aria-hidden="true"
          />
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="Enter your password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              clearFormError()
            }}
            disabled={pending}
            className={cn(loginFieldClassName, "pr-11 pl-10")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute top-1/2 right-3 -translate-y-1/2 transition-colors duration-150"
            style={{ color: "oklch(0.64 0.018 150)" }}
            tabIndex={-1}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="group relative mt-1 flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-4 py-3 text-sm font-bold tracking-wide transition-all duration-200 enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        style={{
          background:
            "linear-gradient(135deg, oklch(0.55 0.19 145), oklch(0.48 0.17 148))",
          color: "oklch(0.96 0.012 150)",
          boxShadow:
            "4px 4px 10px oklch(0 0 0 / 40%), -2px -2px 6px oklch(0.24 0.032 155 / 14%), 0 0 20px oklch(0.55 0.19 145 / 20%)",
          border: "1px solid oklch(0.62 0.19 145 / 30%)",
        }}
      >
        <span
          className="absolute inset-0 -translate-x-full skew-x-12 bg-linear-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full group-disabled:translate-x-0"
          aria-hidden="true"
        />
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <LogIn className="h-4 w-4" />
        )}
        {pending ? "Signing in…" : "Sign In"}
      </button>
    </form>
  )
}
