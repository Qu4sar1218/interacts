import * as React from "react"

import { cn } from "@/lib/utils"

const NATIVE_DATE_LIKE_TYPES = new Set([
  "date",
  "datetime-local",
  "time",
  "month",
  "week",
])

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  const usesNativePicker = type != null && NATIVE_DATE_LIKE_TYPES.has(type)

  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-none border border-border bg-input px-2.5 py-1 text-xs text-foreground transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-xs file:font-medium file:text-foreground placeholder:text-input-placeholder focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20 md:text-xs dark:bg-input dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        usesNativePicker && "[color-scheme:dark]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
