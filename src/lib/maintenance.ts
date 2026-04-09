const MAINTENANCE_ENABLED = import.meta.env.VITE_MAINTENANCE_ENABLED === "true"
const MAINTENANCE_START = import.meta.env.VITE_MAINTENANCE_START as string | undefined
const MAINTENANCE_END = import.meta.env.VITE_MAINTENANCE_END as string | undefined
const MAINTENANCE_MESSAGE = import.meta.env.VITE_MAINTENANCE_MESSAGE as string | undefined

function parseDate(value?: string): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const maintenanceStartDate = parseDate(MAINTENANCE_START)
const maintenanceEndDate = parseDate(MAINTENANCE_END)

if (MAINTENANCE_ENABLED && MAINTENANCE_START && !maintenanceStartDate) {
  console.warn("Invalid VITE_MAINTENANCE_START value. Expected ISO date string.")
}

if (MAINTENANCE_ENABLED && MAINTENANCE_END && !maintenanceEndDate) {
  console.warn("Invalid VITE_MAINTENANCE_END value. Expected ISO date string.")
}

export function isMaintenanceActive(now: Date = new Date()): boolean {
  if (!MAINTENANCE_ENABLED) return false

  if (!maintenanceStartDate && !maintenanceEndDate) {
    // Enabled without dates means block until config is changed.
    return true
  }

  if (maintenanceStartDate && now < maintenanceStartDate) {
    return false
  }

  if (maintenanceEndDate && now > maintenanceEndDate) {
    return false
  }

  return true
}

export function getMaintenanceMessage(): string {
  return MAINTENANCE_MESSAGE?.trim() || "System maintenance is in progress. Please try again later."
}

export function getMaintenanceEndDate(): Date | null {
  return maintenanceEndDate
}
