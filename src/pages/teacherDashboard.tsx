import { Link } from "react-router-dom"
import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MainLayout } from "@/components/layout/MainLayout"
import { useAuth } from "@/contexts/auth-context"
import { ScanFace } from "lucide-react"
import {
  dashboardService,
  type TeacherAttendanceMetricsResponse,
  type TeacherWeeklySchedule,
} from "@/services/dashboard.service"
import { getApiErrorMessage } from "@/services/api"
import { format, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns"
import { TeacherSubjectAttendanceChart } from "@/components/dashboard/TeacherSubjectAttendanceChart"

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

function toSortableMinutes(value: string | null): number {
  if (!value) return Number.MAX_SAFE_INTEGER
  const [h, m] = value.split(":")
  const hours = Number(h)
  const minutes = Number(m)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return Number.MAX_SAFE_INTEGER
  return (hours * 60) + minutes
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const

function normalizeDayLabel(value: string): string {
  return value.trim().slice(0, 3).toLowerCase()
}

type PeriodPreset = "day" | "week" | "month"

function toYmd(date: Date): string {
  return format(date, "yyyy-MM-dd")
}

function computeRange(preset: PeriodPreset, baseDate: Date) {
  if (preset === "day") {
    const ymd = toYmd(baseDate)
    return { from: ymd, to: ymd }
  }
  if (preset === "month") {
    return {
      from: toYmd(startOfMonth(baseDate)),
      to: toYmd(endOfMonth(baseDate)),
    }
  }
  // week (default) — Monday start for school calendars
  return {
    from: toYmd(startOfWeek(baseDate, { weekStartsOn: 1 })),
    to: toYmd(endOfWeek(baseDate, { weekStartsOn: 1 })),
  }
}

export default function TeacherDashboard() {
  const { user } = useAuth()
  const displayName = user ? `${user.firstName} ${user.lastName}`.trim() : "Teacher"
  const [schedule, setSchedule] = useState<TeacherWeeklySchedule | null>(null)
  const [loadingSchedule, setLoadingSchedule] = useState(true)
  const [scheduleError, setScheduleError] = useState<string | null>(null)

  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("week")
  const [metrics, setMetrics] = useState<TeacherAttendanceMetricsResponse | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(true)
  const [metricsError, setMetricsError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const loadSchedule = async () => {
      setLoadingSchedule(true)
      setScheduleError(null)
      try {
        const data = await dashboardService.getTeacherWeeklySchedule()
        if (!isMounted) return
        setSchedule(data)
      } catch (error) {
        if (!isMounted) return
        setScheduleError(getApiErrorMessage(error, "Failed to load your weekly schedule."))
      } finally {
        if (isMounted) {
          setLoadingSchedule(false)
        }
      }
    }

    loadSchedule()
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setMetricsLoading(true)
      setMetricsError(null)
      try {
        const today = new Date()
        const range = computeRange(periodPreset, today)
        const data = await dashboardService.getTeacherAttendanceMetrics(range)
        if (!mounted) return
        setMetrics(data)
      } catch (error) {
        if (!mounted) return
        setMetrics(null)
        setMetricsError(getApiErrorMessage(error, "Failed to load attendance metrics."))
      } finally {
        if (mounted) setMetricsLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [periodPreset])

  const hasAssignments = useMemo(() => {
    if (!schedule) return false
    const scheduledCount = schedule.weeklySchedule.reduce((sum, day) => sum + day.items.length, 0)
    return scheduledCount > 0 || schedule.unscheduled.length > 0
  }, [schedule])
  const scheduledDays = useMemo(
    () =>
      (schedule?.weeklySchedule ?? [])
        .filter((day) => day.items.length > 0)
        .map((day) => ({
          ...day,
          items: [...day.items].sort((a, b) => {
            const byStart = toSortableMinutes(a.startTime) - toSortableMinutes(b.startTime)
            if (byStart !== 0) return byStart
            const byEnd = toSortableMinutes(a.endTime) - toSortableMinutes(b.endTime)
            if (byEnd !== 0) return byEnd
            return (a.subjectName || "").localeCompare(b.subjectName || "")
          }),
        })),
    [schedule]
  )
  const todayLabel = useMemo(() => WEEKDAY_LABELS[new Date().getDay()], [])
  const normalizedTodayLabel = useMemo(() => normalizeDayLabel(todayLabel), [todayLabel])

  return (
    <MainLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="space-y-1 sm:space-y-2">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Teacher Dashboard</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Welcome, {displayName}. You are signed in as Teacher.
          </p>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle>Attendance overview</CardTitle>
            <CardDescription>
              Enrolled students vs distinct attendance (official attendance rows) for your assigned subjects.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={periodPreset === "day" ? "default" : "outline"}
                onClick={() => setPeriodPreset("day")}
              >
                Day
              </Button>
              <Button
                type="button"
                size="sm"
                variant={periodPreset === "week" ? "default" : "outline"}
                onClick={() => setPeriodPreset("week")}
              >
                Week
              </Button>
              <Button
                type="button"
                size="sm"
                variant={periodPreset === "month" ? "default" : "outline"}
                onClick={() => setPeriodPreset("month")}
              >
                Month
              </Button>
              <span className="text-xs text-muted-foreground">
                {metrics?.period ? `${metrics.period.from} → ${metrics.period.to}` : null}
              </span>
            </div>

            {metricsLoading ? (
              <p className="text-sm text-muted-foreground">Loading metrics…</p>
            ) : metricsError ? (
              <p className="text-sm text-destructive">{metricsError}</p>
            ) : !metrics || metrics.assignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No assignments found for this period.</p>
            ) : (
              <TeacherSubjectAttendanceChart assignments={metrics.assignments} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>My Weekly Teaching Schedule</CardTitle>
            <CardDescription>
              Your assigned classes grouped by day, section, and subject.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            {loadingSchedule ? (
              <p className="text-sm text-muted-foreground">Loading weekly schedule...</p>
            ) : scheduleError ? (
              <p className="text-sm text-destructive">{scheduleError}</p>
            ) : !hasAssignments || !schedule ? (
              <p className="text-sm text-muted-foreground">
                No class schedule assigned yet. Please contact an administrator.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 md:grid-cols-3 xl:grid-cols-4">
                  {scheduledDays.map((day) => (
                    <div
                      key={day.day}
                      className={`rounded-md border p-2 ${
                        normalizeDayLabel(day.day) === normalizedTodayLabel
                          ? "border-primary/70 bg-primary/20 ring-1 ring-primary/40"
                          : ""
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-1.5 sm:mb-1.5 sm:gap-2">
                        <h3 className="text-xs font-semibold uppercase tracking-wide">{day.day}</h3>
                        {normalizeDayLabel(day.day) === normalizedTodayLabel ? (
                          <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                            Today
                          </span>
                        ) : null}
                      </div>
                      <div className="space-y-1.5">
                        {day.items.map((item) => (
                          <div key={`${day.day}-${item.assignmentId}`} className="rounded border bg-muted/30 p-1.5">
                            <p className="text-[11px] font-medium leading-tight sm:text-xs">
                              {toDisplayTime(item.startTime)} - {toDisplayTime(item.endTime)}
                            </p>
                            <p className="text-xs leading-tight">{item.subjectName || "Subject"}</p>
                            <p className="text-[11px] leading-tight text-muted-foreground sm:text-xs">
                              {item.sectionName || "Section"}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {schedule.unscheduled.length > 0 ? (
                  <div className="rounded-md border p-2.5">
                    <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide sm:text-sm sm:normal-case sm:tracking-normal">
                      Unscheduled Assignments
                    </h3>
                    <div className="space-y-1.5 sm:space-y-2">
                      {schedule.unscheduled.map((item) => (
                        <div key={`unscheduled-${item.assignmentId}`} className="rounded border bg-muted/30 p-1.5">
                          <p className="text-xs sm:text-sm">{item.subjectName || "Subject"}</p>
                          <p className="text-[11px] text-muted-foreground sm:text-xs">{item.sectionName || "Section"}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Classroom Face Terminal</CardTitle>
            <CardDescription>
              Open the classroom scanner to record face attendance for enrolled students.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm" className="text-xs sm:text-sm">
              <Link to="/scanner/classroom">
                <ScanFace className="mr-2 h-4 w-4" />
                Open Classroom Face Terminal
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}
