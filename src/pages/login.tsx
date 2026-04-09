import { Navigate } from "react-router-dom"

import SchoolLogo from "@/assets/SchoolLogo.png"
import SchoolBuilding from "@/assets/SchoolBuilding.png"
import { LoginForm } from "@/components/login-form"
import { getDashboardPath, useAuth } from "@/contexts/auth-context"

export function LoginPage() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div
          className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
          aria-hidden
        />
      </div>
    )
  }

  if (user) {
    return <Navigate to={getDashboardPath(user.role?.name)} replace />
  }

  return (
    <div className="relative flex min-h-dvh w-full overflow-hidden">
      {/* ── Background: school building image with dark green overlay ── */}
      <div className="absolute inset-0 z-0">
        <img
          src={SchoolBuilding}
          alt="ACTS Computer College"
          className="h-full w-full object-cover object-center"
        />
        {/* Multi-layer dark green gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, oklch(0.12 0.03 155 / 84%) 0%, oklch(0.16 0.025 160 / 80%) 50%, oklch(0.14 0.028 148 / 86%) 100%)",
          }}
        />
        {/* Subtle noise/texture overlay for depth */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(ellipse at 20% 50%, oklch(0.62 0.19 145 / 12%) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, oklch(0.50 0.16 148 / 10%) 0%, transparent 50%)",
          }}
        />
      </div>

      {/* ── Desktop: Left panel with building info ── */}
      <div className="relative z-10 hidden lg:flex lg:w-1/2 lg:flex-col lg:items-start lg:justify-end lg:p-12">
        <div className="max-w-md">
          <div
            className="mb-4 inline-block rounded-full px-3 py-1 text-xs font-semibold tracking-widest uppercase"
            style={{
              background: "oklch(0.62 0.19 145 / 15%)",
              border: "1px solid oklch(0.62 0.19 145 / 30%)",
              color: "oklch(0.75 0.18 145)",
            }}
          >
            Est. 1987
          </div>
          <h2
            className="mb-3 text-4xl font-black leading-tight tracking-tight"
            style={{ color: "oklch(0.93 0.018 150)" }}
          >
            ACTS Computer College
          </h2>
          <p
            className="text-base leading-relaxed"
            style={{ color: "oklch(0.68 0.022 150)" }}
          >
            Santa Cruz, Laguna
          </p>
          <div
            className="mt-6 h-px w-16"
            style={{
              background:
                "linear-gradient(90deg, oklch(0.62 0.19 145 / 70%), transparent)",
            }}
          />
          {/* System description — desktop left panel */}
          <p
            className="mt-5 text-sm font-semibold uppercase leading-relaxed tracking-widest"
            style={{ color: "oklch(0.62 0.025 150)" }}
          >
            A Web-Based Multi-Mode
            <br />
            Face Recognition Attendance
            <br />
            &amp; Monitoring System
            <br />
            <span
              className="font-medium normal-case tracking-wide"
              style={{ color: "oklch(0.50 0.020 150)" }}
            >
              for Educational Management
            </span>
          </p>
          <p
            className="mt-4 text-sm leading-relaxed"
            style={{ color: "oklch(0.55 0.02 150)" }}
          >
            Empowering education through technology since 1987.
          </p>
        </div>
      </div>

      {/* ── Main content: vertically centered on mobile; top-center on desktop ── */}
      <div className="relative z-10 flex w-full flex-col items-center justify-center px-3 py-8 sm:px-4 sm:py-10 lg:w-1/2 lg:justify-start lg:px-12 lg:pt-12 lg:pb-10">
        <div className="w-full max-w-sm">
          {/* ── Logo + App Identity ── */}
          <div className="mb-6 flex flex-col items-center text-center sm:mb-8">
            {/* School logo — large, no circular frame */}
            <img
              src={SchoolLogo}
              alt="ACTS Computer College Logo"
              className="mb-4 h-20 w-20 object-contain sm:mb-5 sm:h-32 sm:w-32 lg:h-40 lg:w-40"
              style={{
                filter:
                  "drop-shadow(0 4px 20px oklch(0 0 0 / 45%)) drop-shadow(0 0 14px oklch(0.62 0.19 145 / 35%))",
              }}
            />

            {/* App name */}
            <h1
              className="mb-1 text-3xl font-black tracking-tight md:text-4xl"
              style={{
                background:
                  "linear-gradient(135deg, oklch(0.80 0.20 145), oklch(0.65 0.19 148), oklch(0.72 0.18 142))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                filter: "drop-shadow(0 0 8px oklch(0.62 0.19 145 / 30%))",
              }}
            >
              InterACTS
            </h1>

            {/* Decorative divider */}
            <div className="mt-4 flex items-center gap-2">
              <div
                className="h-px w-12"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, oklch(0.62 0.19 145 / 40%))",
                }}
              />
              <div
                className="h-1 w-1 rounded-full"
                style={{ background: "oklch(0.62 0.19 145 / 50%)" }}
              />
              <div
                className="h-px w-12"
                style={{
                  background:
                    "linear-gradient(90deg, oklch(0.62 0.19 145 / 40%), transparent)",
                }}
              />
            </div>
          </div>

          {/* ── Login Card (glass + neumorphic) ── */}
          <div
            className="rounded-2xl p-4 sm:p-6"
            style={{
              background: "oklch(0.20 0.025 155 / 50%)",
              backdropFilter: "blur(20px) saturate(1.6)",
              WebkitBackdropFilter: "blur(20px) saturate(1.6)",
              border: "1px solid oklch(1 0 0 / 9%)",
              boxShadow:
                "8px 8px 20px oklch(0 0 0 / 50%), -5px -5px 14px oklch(0.24 0.032 155 / 16%), inset 0 1px 0 oklch(1 0 0 / 6%)",
            }}
          >
            <LoginForm />
          </div>

          {/* ── Footer info (mobile only — desktop shows in left panel) ── */}
          <div className="mt-6 flex flex-col items-center gap-1 text-center lg:hidden">
            <p
              className="text-xs font-semibold tracking-wide"
              style={{ color: "oklch(0.55 0.02 150)" }}
            >
              ACTS Computer College
            </p>
            <p
              className="text-xs"
              style={{ color: "oklch(0.42 0.016 150)" }}
            >
              Santa Cruz, Laguna &nbsp;·&nbsp; Est. 1987
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
