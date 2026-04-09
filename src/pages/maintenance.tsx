import { getMaintenanceEndDate, getMaintenanceMessage } from "@/lib/maintenance"

function formatDate(date: Date | null): string | null {
  if (!date) return null

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "full",
    timeStyle: "short",
  }).format(date)
}

export default function MaintenancePage() {
  const endDateText = formatDate(getMaintenanceEndDate())

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg rounded-xl border bg-card p-8 text-center shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          InterACTS
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Scheduled Maintenance</h1>
        <p className="mt-4 text-muted-foreground">{getMaintenanceMessage()}</p>
        {endDateText ? (
          <p className="mt-6 text-sm text-muted-foreground">
            Estimated return: <span className="font-medium text-foreground">{endDateText}</span>
          </p>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">
            No return time is set yet. Please check back later.
          </p>
        )}
      </div>
    </div>
  )
}
