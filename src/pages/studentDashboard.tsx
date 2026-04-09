import { Link } from "react-router-dom"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowRight, Clock3, RefreshCcw, UserRound } from "lucide-react"
import { format } from "date-fns"
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MainLayout } from "@/components/layout/MainLayout"
import { useAuth } from "@/contexts/auth-context"
import {
  dashboardService,
  type StudentScheduleItem,
  type StudentTerminalTimelogSummaryResponse,
  type StudentTodaySchedule
} from "@/services/dashboard.service"
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

function getScheduleStatus(item: StudentScheduleItem): "ongoing" | "upcoming" | "ended" | "tba" {
  const start = toMinutes(item.startTime)
  const end = toMinutes(item.endTime)
  if (start === Number.MAX_SAFE_INTEGER || end === Number.MAX_SAFE_INTEGER) return "tba"

  const now = new Date()
  const currentMinutes = (now.getHours() * 60) + now.getMinutes()
  if (currentMinutes >= start && currentMinutes <= end) return "ongoing"
  if (currentMinutes < start) return "upcoming"
  return "ended"
}

function statusClass(status: ReturnType<typeof getScheduleStatus>): string {
  if (status === "ongoing") return "bg-emerald-100 text-emerald-700"
  if (status === "upcoming") return "bg-blue-100 text-blue-700"
  if (status === "ended") return "bg-slate-200 text-slate-700"
  return "bg-amber-100 text-amber-700"
}

function currentDateInputValue(): string {
  return format(new Date(), "yyyy-MM-dd")
}

function toInOutBars(point: { time_in_scans: number; time_out_scans: number } | null) {
  if (!point) return []
  return [
    { name: "Time In", value: point.time_in_scans },
    { name: "Time Out", value: point.time_out_scans }
  ]
}

export default function StudentDashboard() {
  const { user } = useAuth()
  const displayName = user ? `${user.firstName} ${user.lastName}`.trim() : "Student"
  const [schedule, setSchedule] = useState<StudentTodaySchedule | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [terminalDate, setTerminalDate] = useState(currentDateInputValue)
  const [terminalSummary, setTerminalSummary] = useState<StudentTerminalTimelogSummaryResponse | null>(null)
  const [terminalLoading, setTerminalLoading] = useState(true)
  const [terminalError, setTerminalError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const loadTodaySchedule = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await dashboardService.getStudentTodaySchedule()
        if (!isMounted) return
        setSchedule(data)
      } catch (loadError) {
        if (!isMounted) return
        setError(getApiErrorMessage(loadError, "Failed to load your class schedule for today."))
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadTodaySchedule()
    return () => {
      isMounted = false
    }
  }, [])

  const loadTerminalSummary = useCallback(async () => {
    setTerminalLoading(true)
    setTerminalError(null)
    try {
      const data = await dashboardService.getStudentTerminalTimelogSummary({ date: terminalDate })
      setTerminalSummary(data)
    } catch (loadError) {
      setTerminalError(getApiErrorMessage(loadError, "Failed to load terminal timelog summary."))
      setTerminalSummary(null)
    } finally {
      setTerminalLoading(false)
    }
  }, [terminalDate])

  useEffect(() => {
    void loadTerminalSummary()
  }, [loadTerminalSummary])

  const sortedItems = useMemo(
    () => [...(schedule?.today.items ?? [])].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime)),
    [schedule]
  )

  const hallwayPoint = terminalSummary?.hallway.series?.[0] ?? null
  const eventPoint = terminalSummary?.event.series?.[0] ?? null
  const hallwayInOutData = useMemo(() => toInOutBars(hallwayPoint), [hallwayPoint])
  const eventInOutData = useMemo(() => toInOutBars(eventPoint), [eventPoint])
  const classroomChartData = useMemo(
    () =>
      (terminalSummary?.classroom.series ?? []).map((entry) => ({
        name: (entry.subject_code || entry.subject_name || "Unmatched").slice(0, 14),
        fullName: entry.subject_name || entry.subject_code || "Unmatched",
        timeIn: entry.time_in_scans,
        timeOut: entry.time_out_scans
      })),
    [terminalSummary]
  )

  return (
    <MainLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="space-y-1 sm:space-y-2">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Student Dashboard</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Welcome, {displayName}. You are signed in as Student.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div>
                <CardTitle className="text-base sm:text-lg">Today's Schedule</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  {schedule ? `${schedule.today.day} classes from your resolved schedule` : "Your classes and teachers for today."}
                </CardDescription>
              </div>
              <Button asChild variant="outline" size="sm" className="self-start text-xs sm:text-sm">
                <Link to="/my-class-schedule">
                  My Class Schedule
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5 sm:space-y-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading today's classes...</p>
            ) : error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : sortedItems.length === 0 ? (
              <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground sm:p-4 sm:text-sm">
                No classes scheduled for today yet.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {sortedItems.map((item) => {
                  const status = getScheduleStatus(item)

                  return (
                    <div
                      key={item.assignmentId}
                      className="rounded-xl border bg-linear-to-br from-background to-muted/30 p-3 shadow-sm sm:p-4"
                    >
                      <div className="mb-1.5 flex items-start justify-between gap-2 sm:mb-2">
                        <p className="text-sm font-semibold sm:text-base">{item.subjectName || "Subject"}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize sm:py-1 sm:text-xs ${statusClass(status)}`}>
                          {status}
                        </span>
                      </div>
                      <div className="space-y-1 text-xs sm:space-y-1.5 sm:text-sm">
                        <p className="flex items-center gap-1.5 text-muted-foreground sm:gap-2">
                          <Clock3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          {toDisplayTime(item.startTime)} - {toDisplayTime(item.endTime)}
                        </p>
                        <p className="flex items-center gap-1.5 text-muted-foreground sm:gap-2">
                          <UserRound className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          {item.teacherName || "Teacher TBA"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.sectionName || "Section"}{item.sectionCode ? ` (${item.sectionCode})` : ""}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <CardTitle className="text-base sm:text-lg">Your terminal timelog summary</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Your hallway, classroom, and event TIME_IN / TIME_OUT scan counts for the selected date (not school-wide totals).
                </CardDescription>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="space-y-1">
                  <label htmlFor="student-terminal-date" className="text-xs text-muted-foreground">
                    Date
                  </label>
                  <input
                    id="student-terminal-date"
                    type="date"
                    className="flex h-9 w-full min-w-44 rounded-md border border-input bg-background px-3 py-2 text-xs sm:w-auto sm:text-sm"
                    value={terminalDate}
                    onChange={(event) => setTerminalDate(event.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => void loadTerminalSummary()}
                  disabled={terminalLoading}
                >
                  <RefreshCcw className="mr-2 h-3.5 w-3.5" />
                  {terminalLoading ? "Loading..." : "Refresh"}
                </Button>
              </div>
            </div>
            {terminalError && (
              <p className="text-xs text-destructive sm:text-sm">{terminalError}</p>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Hallway</CardTitle>
                  <CardDescription className="text-xs">
                    Date {terminalSummary?.date || terminalDate}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {terminalLoading ? (
                    <p className="text-xs text-muted-foreground">Loading hallway chart...</p>
                  ) : hallwayInOutData.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {terminalSummary?.hallway.note || "No hallway data for selected date."}
                    </p>
                  ) : (
                    <div className="h-52 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={hallwayInOutData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Bar dataKey="value" name="Scans" fill="oklch(0.55 0.18 145)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Classroom</CardTitle>
                  <CardDescription className="text-xs">
                    Subjects with time in and out counts
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {terminalLoading ? (
                    <p className="text-xs text-muted-foreground">Loading classroom chart...</p>
                  ) : classroomChartData.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {terminalSummary?.classroom.note || "No classroom data for selected date."}
                    </p>
                  ) : (
                    <div className="h-52 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={classroomChartData} margin={{ top: 8, right: 8, left: -10, bottom: 35 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 10 }}
                            interval={0}
                            angle={-20}
                            textAnchor="end"
                            height={46}
                          />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                          <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ""} />
                          <Legend />
                          <Bar dataKey="timeIn" name="Time In" fill="oklch(0.55 0.18 145)" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="timeOut" name="Time Out" fill="oklch(0.58 0.17 250)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Event</CardTitle>
                  <CardDescription className="text-xs">
                    {terminalSummary?.event.event ? terminalSummary.event.event.name : "Date summary"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {terminalLoading ? (
                    <p className="text-xs text-muted-foreground">Loading event chart...</p>
                  ) : eventInOutData.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {terminalSummary?.event.note || "No event data for selected date."}
                    </p>
                  ) : (
                    <div className="h-52 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={eventInOutData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Bar dataKey="value" name="Scans" fill="oklch(0.58 0.17 250)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}
