import { useEffect, useMemo, useState } from "react"
import { Clock3, UserRound } from "lucide-react"
import { MainLayout } from "@/components/layout/MainLayout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { dashboardService, type StudentWeeklySchedule } from "@/services/dashboard.service"
import { getApiErrorMessage } from "@/services/api"

function toDisplayTime(value: string | null): string {
  if (!value) return "TBA"
  const [h, m] = value.split(":")
  const hours = Number(h)
  const minutes = Number(m)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return value

  const period = hours >= 12 ? "PM" : "AM"
  const hour12 = hours % 12 || 12
  return `${hour12}:${String(minutes).padStart(2, "0")} ${period}`
}

function toMinutes(value: string | null): number {
  if (!value) return Number.MAX_SAFE_INTEGER
  const [h, m] = value.split(":")
  const hours = Number(h)
  const minutes = Number(m)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return Number.MAX_SAFE_INTEGER
  return (hours * 60) + minutes
}

export default function MyClassSchedulePage() {
  const [schedule, setSchedule] = useState<StudentWeeklySchedule | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const loadSchedule = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await dashboardService.getStudentWeeklySchedule()
        if (!isMounted) return
        setSchedule(data)
      } catch (loadError) {
        if (!isMounted) return
        setError(getApiErrorMessage(loadError, "Failed to load your weekly class schedule."))
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadSchedule()
    return () => {
      isMounted = false
    }
  }, [])

  const sortedDays = useMemo(
    () => (schedule?.weeklySchedule ?? []).map((day) => ({
      ...day,
      items: [...day.items].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime)),
    })),
    [schedule]
  )

  const hasSchedule = useMemo(
    () => sortedDays.some((day) => day.items.length > 0) || (schedule?.unscheduled.length ?? 0) > 0,
    [sortedDays, schedule]
  )

  return (
    <MainLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="space-y-1 sm:space-y-2">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">My Class Schedule</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Your weekly classes with subjects, schedule time, and assigned teachers.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg">Weekly Schedule</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {schedule?.section
                ? `${schedule.section.name || "Section"}${schedule.section.code ? ` (${schedule.section.code})` : ""}`
                  : "Resolved student schedule (including overrides)"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading weekly schedule...</p>
            ) : error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : !hasSchedule ? (
              <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground sm:p-4 sm:text-sm">
                No weekly schedule available yet.
              </div>
            ) : (
              <div className="grid gap-2.5 sm:gap-3 md:grid-cols-2 xl:grid-cols-3">
                {sortedDays.map((day) => (
                  <div key={day.day} className="rounded-xl border bg-muted/20 p-2.5 sm:p-3">
                    <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide sm:mb-2 sm:text-sm">{day.day}</h3>
                    {day.items.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No classes</p>
                    ) : (
                      <div className="space-y-1.5 sm:space-y-2">
                        {day.items.map((item) => (
                          <div key={`${day.day}-${item.assignmentId}`} className="rounded-lg border bg-background p-2">
                            <p className="text-xs font-medium sm:text-sm">{item.subjectName || "Subject"}</p>
                            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground sm:text-xs">
                              <Clock3 className="h-3.5 w-3.5" />
                              {toDisplayTime(item.startTime)} - {toDisplayTime(item.endTime)}
                            </p>
                            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground sm:text-xs">
                              <UserRound className="h-3.5 w-3.5" />
                              {item.teacherName || "Teacher TBA"}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!loading && !error && (schedule?.unscheduled.length ?? 0) > 0 ? (
              <div className="rounded-lg border p-2.5 sm:p-3">
                <h3 className="mb-1.5 text-xs font-semibold sm:mb-2 sm:text-sm">Unscheduled Subjects</h3>
                <div className="space-y-1.5">
                  {schedule?.unscheduled.map((item) => (
                    <p key={`unscheduled-${item.assignmentId}`} className="text-xs text-muted-foreground sm:text-sm">
                      {item.subjectName || "Subject"} - {item.teacherName || "Teacher TBA"}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}
