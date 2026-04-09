"use client"

import { Toaster as Sonner } from "sonner"

export function Toaster() {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast border shadow-lg group-[.toaster]:bg-white group-[.toaster]:text-slate-900 group-[.toaster]:border-slate-200",
          success:
            "border-emerald-300 bg-emerald-50 text-emerald-900 [&_[data-icon]]:text-emerald-600",
          error:
            "border-rose-300 bg-rose-50 text-rose-900 [&_[data-icon]]:text-rose-600",
          warning:
            "border-amber-300 bg-amber-50 text-amber-900 [&_[data-icon]]:text-amber-600",
          description: "text-slate-600",
          actionButton:
            "border border-slate-300 bg-slate-900 text-white hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-slate-400",
          cancelButton:
            "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-300",
        },
      }}
      position="top-center"
    />
  )
}

// Re-export for call sites that prefer `@/components/ui/sonner`
// eslint-disable-next-line react-refresh/only-export-components -- toast is stable API from sonner
export { toast } from "sonner"
