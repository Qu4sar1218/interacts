import { useEffect, useMemo, useState } from "react"
import { format, parseISO } from "date-fns"
import { MainLayout } from "@/components/layout/MainLayout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  dashboardService,
  type StudentAttendanceQuery,
  type StudentAttendanceRow,
  type StudentAttendanceSummary,
} from "@/services/dashboard.service"
import { getApiErrorMessage } from "@/services/api"

type StatusFilter = "all" | "PRESENT" | "LATE" | "ABSENT" | "EXCUSED"

function todayInputValue(): string {
  return format(new Date(), "yyyy-MM-dd")
}

function formatDate(value: string): string {
  try {
    return format(parseISO(value), "MMM d, yyyy")
  } catch {
    return value
  }
}

function formatTime(value: string | null): string {
  if (!value) return "—"
  try {
    return format(parseISO(value), "h:mm a")
  } catch {
    return "—"
  }
}

function statusVariant(status: StudentAttendanceRow["status"]): "default" | "secondary" | "destructive" | "outline" {
  if (status === "PRESENT") return "default"
  if (status === "LATE") return "secondary"
  if (status === "ABSENT") return "destructive"
  return "outline"
}

export default function MyAttendancePage() {
  const [fromDate, setFromDate] = useState(todayInputValue)
  const [toDate, setToDate] = useState(todayInputValue)
  const [status, setStatus] = useState<StatusFilter>("all")
  const [subjectId, setSubjectId] = useState<string>("all")

  const [rows, setRows] = useState<StudentAttendanceRow[]>([])
  const [summary, setSummary] = useState<StudentAttendanceSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const subjectOptions = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>()
    for (const row of rows) {
      if (!row.subject?.id) continue
      if (!map.has(row.subject.id)) {
        map.set(row.subject.id, {
          id: row.subject.id,
          label: row.subject.code ? `${row.subject.name} (${row.subject.code})` : (row.subject.name || "Subject")
        })
      }
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label))
  }, [rows])

  const loadAttendance = async () => {
    setLoading(true)
    setError(null)
    try {
      const params: StudentAttendanceQuery = {
        from: fromDate,
        to: toDate,
        ...(status !== "all" ? { status } : {}),
        ...(subjectId !== "all" ? { subject_id: subjectId } : {}),
      }
      const [attendanceRes, summaryRes] = await Promise.all([
        dashboardService.getStudentAttendance(params),
        dashboardService.getStudentAttendanceSummary(params),
      ])
      setRows(attendanceRes.attendance ?? [])
      setSummary(summaryRes)
    } catch (loadError) {
      setRows([])
      setSummary(null)
      setError(getApiErrorMessage(loadError, "Failed to load your attendance records."))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAttendance()
  }, [])

  return (
    <MainLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="space-y-1 sm:space-y-2">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">My Attendance</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            View your attendance history for your resolved class schedule.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg">Filters</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Narrow your records by date range, subject, and attendance status.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <Label htmlFor="from-date">From</Label>
                <Input id="from-date" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="to-date">To</Label>
                <Input id="to-date" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="PRESENT">Present</SelectItem>
                    <SelectItem value="LATE">Late</SelectItem>
                    <SelectItem value="ABSENT">Absent</SelectItem>
                    <SelectItem value="EXCUSED">Excused</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Subject</Label>
                <Select value={subjectId} onValueChange={setSubjectId}>
                  <SelectTrigger><SelectValue placeholder="All subjects" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All subjects</SelectItem>
                    {subjectOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={loadAttendance} size="sm" className="text-xs sm:text-sm">Apply Filters</Button>
            </div>
          </CardContent>
        </Card>

        {summary ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <Card><CardContent className="p-3"><p className="text-[11px] text-muted-foreground">Total</p><p className="text-lg font-semibold">{summary.total}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-[11px] text-muted-foreground">Present</p><p className="text-lg font-semibold">{summary.present}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-[11px] text-muted-foreground">Late</p><p className="text-lg font-semibold">{summary.late}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-[11px] text-muted-foreground">Absent</p><p className="text-lg font-semibold">{summary.absent}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-[11px] text-muted-foreground">Excused</p><p className="text-lg font-semibold">{summary.excused}</p></CardContent></Card>
          </div>
        ) : null}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg">Attendance Records</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Detailed logs for your recorded classes, including override-based assignments.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading attendance records...</p>
            ) : error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No attendance records found for the selected filters.</p>
            ) : (
              <>
                <div className="hidden overflow-x-auto rounded-md border md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Teacher</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Time In</TableHead>
                        <TableHead>Time Out</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{formatDate(row.attendanceDate)}</TableCell>
                          <TableCell>{row.subject?.name || "Subject"}{row.subject?.code ? ` (${row.subject.code})` : ""}</TableCell>
                          <TableCell>{row.teacher ? `${row.teacher.firstName || ""} ${row.teacher.lastName || ""}`.trim() || "—" : "—"}</TableCell>
                          <TableCell><Badge variant={statusVariant(row.status)}>{row.status}</Badge></TableCell>
                          <TableCell>{formatTime(row.timeIn)}</TableCell>
                          <TableCell>{formatTime(row.timeOut)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="space-y-2 md:hidden">
                  {rows.map((row) => (
                    <div key={row.id} className="rounded-lg border p-3">
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <p className="text-xs font-medium">{formatDate(row.attendanceDate)}</p>
                        <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                      </div>
                      <p className="text-xs">{row.subject?.name || "Subject"}{row.subject?.code ? ` (${row.subject.code})` : ""}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Teacher: {row.teacher ? `${row.teacher.firstName || ""} ${row.teacher.lastName || ""}`.trim() || "—" : "—"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Time: {formatTime(row.timeIn)} - {formatTime(row.timeOut)}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}
