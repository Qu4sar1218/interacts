import { useCallback, useEffect, useMemo, useState } from "react"
import { TeacherAttendanceGridView } from "@/components/dashboard/teacher-attendance/TeacherAttendanceGridView"
import { format, parseISO } from "date-fns"
import { MainLayout } from "@/components/layout/MainLayout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  dashboardService,
  type TeacherAttendanceRow,
  type TeacherAttendanceSummary,
  type TeacherSectionStudent,
  type TeacherTeachingAssignment,
} from "@/services/dashboard.service"
import { timelogService, type RawTimelog } from "@/services/timelog.service"
import { getApiErrorMessage } from "@/services/api"
import { cn, getAvatarUrl } from "@/lib/utils"
import { useClientPagination } from "@/hooks/useClientPagination"
import { TablePaginationControls } from "@/components/TablePaginationControls"
import { LayoutGrid, List, ListTree, Search } from "lucide-react"

function getNameInitials(name: string | null | undefined): string {
  const safeName = (name || "").trim()
  if (!safeName) return "S"
  return safeName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

function todayInputValue(): string {
  return format(new Date(), "yyyy-MM-dd")
}

function dateKey(value: string | null | undefined): string {
  if (!value) return ""
  return value.slice(0, 10)
}

function statusBadgeVariant(
  status: TeacherAttendanceRow["status"]
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "PRESENT") return "default"
  if (status === "LATE") return "secondary"
  if (status === "ABSENT") return "destructive"
  return "outline"
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—"
  try {
    return format(parseISO(value), "h:mm a")
  } catch {
    return "—"
  }
}

function formatTime(value: string | null | undefined): string {
  return formatDateTime(value)
}

function formatDisplayDate(value: string | null | undefined): string {
  if (!value) return "—"
  try {
    return format(parseISO(dateKey(value)), "MMM d, yyyy")
  } catch {
    return "—"
  }
}

function formatLogLine(value: string): string {
  try {
    return format(parseISO(value), "MMM d, yyyy · h:mm a")
  } catch {
    return value
  }
}

function formatScheduleTime(value: string | null | undefined): string {
  if (!value) return "—"
  return value.slice(0, 5)
}

type StatusFilter = "all" | TeacherAttendanceRow["status"]

function aggregateByStudent(attendance: TeacherAttendanceRow[]) {
  const map = new Map<
    string,
    {
      records: TeacherAttendanceRow[]
      latest: TeacherAttendanceRow | null
    }
  >()
  for (const row of attendance) {
    const sid = row.student?.id
    if (!sid) continue
    const cur = map.get(sid) ?? { records: [], latest: null }
    cur.records.push(row)
    if (!cur.latest || dateKey(row.attendanceDate) > dateKey(cur.latest.attendanceDate)) {
      cur.latest = row
    }
    map.set(sid, cur)
  }
  return map
}

function countStatuses(records: TeacherAttendanceRow[]) {
  let present = 0
  let late = 0
  let absent = 0
  let excused = 0
  for (const r of records) {
    if (r.status === "PRESENT") present += 1
    else if (r.status === "LATE") late += 1
    else if (r.status === "ABSENT") absent += 1
    else if (r.status === "EXCUSED") excused += 1
  }
  return { present, late, absent, excused }
}

function matchesStudentSearch(student: TeacherSectionStudent, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const name = (student.fullName ?? "").toLowerCase()
  const idNum = (student.studentIdNumber ?? "").toLowerCase()
  const sid = String(student.studentId ?? "").toLowerCase()
  return name.includes(q) || idNum.includes(q) || sid.includes(q)
}

const TEACHER_ATTENDANCE_VIEW_KEY = "teacher-attendance-view-mode"

function readTeacherAttendanceViewPreference(): "list" | "grid" {
  try {
    if (typeof window === "undefined") return "grid"
    const v = window.localStorage.getItem(TEACHER_ATTENDANCE_VIEW_KEY)
    if (v === "list") return "list"
    return "grid"
  } catch {
    return "grid"
  }
}

export default function TeacherAttendance() {
  const [assignments, setAssignments] = useState<TeacherTeachingAssignment[]>([])
  const [assignmentStudentsById, setAssignmentStudentsById] = useState<Map<string, TeacherSectionStudent[]>>(new Map())
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadingBase, setLoadingBase] = useState(true)

  const [assignmentId, setAssignmentId] = useState<string>("")
  const [fromDate, setFromDate] = useState(todayInputValue)
  const [toDate, setToDate] = useState(todayInputValue)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

  const [attendance, setAttendance] = useState<TeacherAttendanceRow[]>([])
  const [summary, setSummary] = useState<TeacherAttendanceSummary | null>(null)
  const [loadingAttendance, setLoadingAttendance] = useState(false)
  const [attendanceError, setAttendanceError] = useState<string | null>(null)

  const [logsOpen, setLogsOpen] = useState(false)
  const [logsStudent, setLogsStudent] = useState<TeacherSectionStudent | null>(null)
  const [logsAssignment, setLogsAssignment] = useState<TeacherTeachingAssignment | null>(null)
  const [logsRows, setLogsRows] = useState<RawTimelog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsError, setLogsError] = useState<string | null>(null)
  const [manualOverrideStudentId, setManualOverrideStudentId] = useState<string | null>(null)
  const [studentSearchQuery, setStudentSearchQuery] = useState("")
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [studentViewPreference, setStudentViewPreference] = useState<"list" | "grid">(() =>
    readTeacherAttendanceViewPreference()
  )

  const selectedAssignment = useMemo(
    () => assignments.find((a) => a.assignmentId === assignmentId) ?? null,
    [assignments, assignmentId]
  )

  const roster: TeacherSectionStudent[] = useMemo(() => {
    if (!selectedAssignment) return []
    return assignmentStudentsById.get(selectedAssignment.assignmentId) ?? []
  }, [selectedAssignment, assignmentStudentsById])

  const isSingleDay = fromDate === toDate

  const effectiveStudentView: "list" | "grid" = isSingleDay ? studentViewPreference : "list"

  const setStudentViewPreferencePersist = useCallback((mode: "list" | "grid") => {
    setStudentViewPreference(mode)
    try {
      localStorage.setItem(TEACHER_ATTENDANCE_VIEW_KEY, mode)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoadingBase(true)
      setLoadError(null)
      try {
        const [assignRes, sectionsRes] = await Promise.all([
          dashboardService.getTeacherTeachingAssignments(),
          dashboardService.getTeacherAssignedSections(),
        ])
        if (!mounted) return
        const list = assignRes.assignments ?? []
        setAssignments(list)
        if (list.length > 0) {
          setAssignmentId((prev) => (prev && list.some((a) => a.assignmentId === prev) ? prev : list[0].assignmentId))
        }
        const m = new Map<string, TeacherSectionStudent[]>()
        const assignmentRosters = sectionsRes.assignmentRosters ?? []
        const bySection = new Map<string, TeacherSectionStudent[]>()
        for (const s of sectionsRes.sections ?? []) {
          bySection.set(s.sectionId, s.students ?? [])
        }
        if (assignmentRosters.length > 0) {
          for (const a of assignmentRosters) {
            m.set(a.assignmentId, a.students ?? [])
          }
        } else {
          for (const a of list) {
            m.set(a.assignmentId, bySection.get(a.sectionId) ?? [])
          }
        }
        setAssignmentStudentsById(m)
      } catch (e) {
        if (!mounted) return
        setLoadError(getApiErrorMessage(e, "Failed to load teaching assignments."))
      } finally {
        if (mounted) setLoadingBase(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  const fetchAttendanceBlock = useCallback(async () => {
    if (!selectedAssignment) return
    setLoadingAttendance(true)
    setAttendanceError(null)
    try {
      const params = {
        from: fromDate,
        to: toDate,
        section_id: selectedAssignment.sectionId,
        subject_id: selectedAssignment.subjectId,
        assignment_id: selectedAssignment.assignmentId,
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
      }
      const [attRes, sumRes] = await Promise.all([
        dashboardService.getTeacherAttendance(params),
        dashboardService.getTeacherAttendanceSummary(params),
      ])
      setAttendance(attRes.attendance ?? [])
      setSummary(sumRes)
    } catch (e) {
      setAttendanceError(getApiErrorMessage(e, "Failed to load attendance."))
      setAttendance([])
      setSummary(null)
    } finally {
      setLoadingAttendance(false)
    }
  }, [selectedAssignment, fromDate, toDate, statusFilter])

  useEffect(() => {
    if (!selectedAssignment) return
    fetchAttendanceBlock()
  }, [selectedAssignment, fetchAttendanceBlock])

  const agg = useMemo(() => aggregateByStudent(attendance), [attendance])

  const openLogs = async (student: TeacherSectionStudent, assignment: TeacherTeachingAssignment) => {
    setLogsStudent(student)
    setLogsAssignment(assignment)
    setLogsOpen(true)
    setLogsError(null)
    setLogsRows([])
    setLogsLoading(true)
    try {
      const start = `${fromDate}T00:00:00.000Z`
      const end = `${toDate}T23:59:59.999Z`
      const rows = await timelogService.getTimelogs({
        classroom_scope: "teacher",
        section_id: assignment.sectionId,
        subject_id: assignment.subjectId,
        student_id: student.studentId,
        start_date: start,
        end_date: end,
        limit: 80,
      })
      setLogsRows(rows ?? [])
    } catch (e) {
      setLogsError(getApiErrorMessage(e, "Failed to load scan logs."))
    } finally {
      setLogsLoading(false)
    }
  }

  const handleManualPresentOverride = useCallback(
    async (student: TeacherSectionStudent, assignment: TeacherTeachingAssignment) => {
      if (!isSingleDay) return
      setManualOverrideStudentId(student.studentId)
      setAttendanceError(null)
      try {
        await dashboardService.manualClassroomPresentOverride({
          student_id: student.studentId,
          assignment_id: assignment.assignmentId,
          attendance_date: fromDate,
        })
        await fetchAttendanceBlock()
      } catch (e) {
        setAttendanceError(getApiErrorMessage(e, "Failed to mark student as present."))
      } finally {
        setManualOverrideStudentId(null)
      }
    },
    [isSingleDay, fromDate, fetchAttendanceBlock]
  )

  const handleManualAbsentOverride = useCallback(
    async (student: TeacherSectionStudent, assignment: TeacherTeachingAssignment) => {
      if (!isSingleDay) return
      setManualOverrideStudentId(student.studentId)
      setAttendanceError(null)
      try {
        await dashboardService.manualClassroomAbsentOverride({
          student_id: student.studentId,
          assignment_id: assignment.assignmentId,
          attendance_date: fromDate,
        })
        await fetchAttendanceBlock()
      } catch (e) {
        setAttendanceError(getApiErrorMessage(e, "Failed to mark student as absent."))
      } finally {
        setManualOverrideStudentId(null)
      }
    },
    [isSingleDay, fromDate, fetchAttendanceBlock]
  )

  const tableRowsSingleDay = useMemo(() => {
    const day = fromDate
    return roster.map((student) => {
      const list = agg.get(student.studentId)?.records.filter((r) => dateKey(r.attendanceDate) === day) ?? []
      const row = list[0] ?? null
      return { student, row, hasRecord: !!row }
    })
  }, [roster, agg, fromDate])

  const tableRowsRange = useMemo(() => {
    return roster.map((student) => {
      const block = agg.get(student.studentId)
      const records = block?.records ?? []
      const counts = countStatuses(records)
      const latest = block?.latest ?? null
      return { student, records, counts, latest }
    })
  }, [roster, agg])

  const filteredTableRowsSingleDay = useMemo(() => {
    if (!studentSearchQuery.trim()) return tableRowsSingleDay
    return tableRowsSingleDay.filter((e) => matchesStudentSearch(e.student, studentSearchQuery))
  }, [tableRowsSingleDay, studentSearchQuery])

  const filteredTableRowsRange = useMemo(() => {
    if (!studentSearchQuery.trim()) return tableRowsRange
    return tableRowsRange.filter((e) => matchesStudentSearch(e.student, studentSearchQuery))
  }, [tableRowsRange, studentSearchQuery])

  const filteredRowsForMode = isSingleDay ? filteredTableRowsSingleDay : filteredTableRowsRange
  const paginationSingleDay = useClientPagination(filteredTableRowsSingleDay, pageIndex, pageSize)
  const paginationRange = useClientPagination(filteredTableRowsRange, pageIndex, pageSize)
  const pagination = isSingleDay ? paginationSingleDay : paginationRange

  const rosterStudentCount = roster.length
  const hasSearchNoMatch =
    rosterStudentCount > 0 && filteredRowsForMode.length === 0 && studentSearchQuery.trim() !== ""

  useEffect(() => {
    setPageIndex(0)
  }, [studentSearchQuery, assignmentId, fromDate, toDate, statusFilter])

  useEffect(() => {
    if (pageIndex !== pagination.pageIndex) setPageIndex(pagination.pageIndex)
  }, [pageIndex, pagination.pageIndex])

  return (
    <MainLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="space-y-1 sm:space-y-2">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Attendance</h1>
        </div>

        {loadingBase ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
        ) : assignments.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No assignments</CardTitle>
              <CardDescription>You have no active section–subject assignments yet.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg">Class attendance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end md:gap-4">
                <div className="grid gap-2 sm:grid-cols-2 md:flex md:flex-1 md:flex-wrap md:gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="from-date">From</Label>
                    <Input
                      id="from-date"
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="w-full min-w-[10rem] md:w-auto"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="to-date">To</Label>
                    <Input
                      id="to-date"
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="w-full min-w-[10rem] md:w-auto"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2 md:col-span-1 md:min-w-[11rem]">
                    <Label>Status filter</Label>
                    <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="PRESENT">Present</SelectItem>
                        <SelectItem value="LATE">Late</SelectItem>
                        <SelectItem value="ABSENT">Absent</SelectItem>
                        <SelectItem value="EXCUSED">Excused</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {summary && (
                <div className="flex flex-wrap gap-1.5 rounded-lg border bg-muted/30 p-2.5 text-xs sm:gap-2 sm:p-3 sm:text-sm">
                  <span className="text-muted-foreground">Summary:</span>
                  <Badge variant="outline">Total records {summary.total}</Badge>
                  <Badge variant="default">Present {summary.present}</Badge>
                  <Badge variant="secondary">Late {summary.late}</Badge>
                  <Badge variant="destructive">Absent {summary.absent}</Badge>
                  <Badge variant="outline">Excused {summary.excused}</Badge>
                </div>
              )}

              <div className="md:hidden">
                <Label className="mb-2 block">Class</Label>
                <Select value={assignmentId} onValueChange={setAssignmentId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignments.map((a) => (
                      <SelectItem key={a.assignmentId} value={a.assignmentId}>
                        {(a.sectionName || "Section") + " · " + (a.subjectName || "Subject")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Tabs value={assignmentId} onValueChange={setAssignmentId} className="space-y-2.5 sm:space-y-3">
                <TabsList className="hidden h-auto w-full justify-start gap-1 overflow-x-auto whitespace-nowrap rounded-md md:flex">
                  {assignments.map((a) => (
                    <TabsTrigger
                      key={a.assignmentId}
                      value={a.assignmentId}
                      className="max-w-[14rem] shrink-0 truncate"
                      title={`${a.sectionName ?? ""} · ${a.subjectName ?? ""} | ${formatScheduleTime(a.startTime)} - ${formatScheduleTime(a.endTime)}`}
                    >
                      <span className="truncate">{a.sectionName || "Section"}</span>
                      <span className="text-muted-foreground"> · </span>
                      <span className="truncate">{a.subjectName || "Subject"}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-3">
                  <div className="relative min-w-0 flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or student ID…"
                      value={studentSearchQuery}
                      onChange={(e) => setStudentSearchQuery(e.target.value)}
                      className="pl-9"
                      aria-label="Search students"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 sm:shrink-0">
                    <div
                      className="flex items-center gap-1 rounded-md border bg-muted/30 p-0.5"
                      role="group"
                      aria-label="Student list layout"
                    >
                      <Button
                        type="button"
                        variant={effectiveStudentView === "list" ? "default" : "ghost"}
                        size="sm"
                        className="gap-1.5 px-2.5"
                        onClick={() => setStudentViewPreferencePersist("list")}
                        aria-pressed={effectiveStudentView === "list"}
                      >
                        <List className="h-4 w-4 shrink-0" aria-hidden />
                        List
                      </Button>
                      <Button
                        type="button"
                        variant={effectiveStudentView === "grid" ? "default" : "ghost"}
                        size="sm"
                        className="gap-1.5 px-2.5"
                        disabled={!isSingleDay}
                        title={
                          !isSingleDay
                            ? "Grid view is available when From and To are the same day."
                            : undefined
                        }
                        onClick={() => isSingleDay && setStudentViewPreferencePersist("grid")}
                        aria-pressed={effectiveStudentView === "grid"}
                      >
                        <LayoutGrid className="h-4 w-4 shrink-0" aria-hidden />
                        Grid
                      </Button>
                    </div>
                    {!isSingleDay ? (
                      <p className="text-xs text-muted-foreground sm:max-w-[14rem]">
                        Grid view is available when From and To are the same day.
                      </p>
                    ) : null}
                  </div>
                </div>

                {assignments.map((a) => (
                  <TabsContent key={a.assignmentId} value={a.assignmentId} className="mt-1.5 space-y-2.5 sm:mt-2 sm:space-y-3">
                    {attendanceError && assignmentId === a.assignmentId ? (
                      <p className="text-sm text-destructive">{attendanceError}</p>
                    ) : null}
                    {loadingAttendance && assignmentId === a.assignmentId ? (
                      <p className="text-sm text-muted-foreground">Loading attendance…</p>
                    ) : selectedAssignment?.assignmentId !== a.assignmentId ? null : (
                      <>
                        {!isSingleDay ? (
                          <p className="text-xs text-muted-foreground">
                            Date range mode: per-student counts are for records in this range. Use a single day to see
                            time-in/out for that day.
                          </p>
                        ) : null}

                        {hasSearchNoMatch ? (
                          <p className="rounded-md border border-dashed bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
                            No students match your search.
                          </p>
                        ) : (
                          <>
                        {isSingleDay && effectiveStudentView === "grid" ? (
                          <TeacherAttendanceGridView
                            entries={paginationSingleDay.pageItems}
                            assignment={a}
                            manualOverrideStudentId={manualOverrideStudentId}
                            onToggleAttendance={(entry, assignment) => {
                              const showMarkAbsent =
                                entry.hasRecord &&
                                entry.row &&
                                (entry.row.status === "PRESENT" || entry.row.status === "LATE")
                              if (showMarkAbsent) {
                                void handleManualAbsentOverride(entry.student, assignment)
                              } else {
                                void handleManualPresentOverride(entry.student, assignment)
                              }
                            }}
                            onLogs={openLogs}
                          />
                        ) : (
                          <>
                        {/* Desktop table */}
                        <div className="hidden md:block overflow-x-auto rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Student</TableHead>
                                <TableHead>Student ID</TableHead>
                                {isSingleDay ? (
                                  <>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Time in</TableHead>
                                    <TableHead>Time out</TableHead>
                                    <TableHead>First scan</TableHead>
                                    <TableHead>Last scan</TableHead>
                                  </>
                                ) : (
                                  <>
                                    <TableHead>P</TableHead>
                                    <TableHead>L</TableHead>
                                    <TableHead>A</TableHead>
                                    <TableHead>E</TableHead>
                                    <TableHead>Latest</TableHead>
                                  </>
                                )}
                                <TableHead className="w-[100px]">Logs</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {isSingleDay
                                ? paginationSingleDay.pageItems.map((entry) => {
                                    const { student, row, hasRecord } = entry
                                    const isMarking = manualOverrideStudentId === student.studentId
                                    const showMarkAbsent =
                                      hasRecord && row && (row.status === "PRESENT" || row.status === "LATE")
                                    return (
                                      <TableRow key={student.studentId}>
                                        <TableCell>
                                          <div className="flex items-center gap-2">
                                            <Avatar className="h-8 w-8">
                                              <AvatarImage src={getAvatarUrl(student.imageUrl)} alt={student.fullName} />
                                              <AvatarFallback>{getNameInitials(student.fullName)}</AvatarFallback>
                                            </Avatar>
                                            <span className="font-medium">{student.fullName}</span>
                                          </div>
                                        </TableCell>
                                        <TableCell>
                                          <Badge variant="outline">{student.studentIdNumber || "—"}</Badge>
                                        </TableCell>
                                        <TableCell>
                                          {hasRecord && row ? (
                                            <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>
                                          ) : (
                                            <Badge variant="destructive">ABSENT</Badge>
                                          )}
                                        </TableCell>
                                        <TableCell>{hasRecord && row ? formatTime(row.timeIn) : "—"}</TableCell>
                                        <TableCell>{hasRecord && row ? formatTime(row.timeOut) : "—"}</TableCell>
                                        <TableCell>{hasRecord && row ? formatDateTime(row.firstScanAt) : "—"}</TableCell>
                                        <TableCell>{hasRecord && row ? formatDateTime(row.lastScanAt) : "—"}</TableCell>
                                        <TableCell>
                                          <div className="flex items-center gap-2">
                                            <Button
                                              type="button"
                                              variant={showMarkAbsent ? "destructive" : "default"}
                                              size="sm"
                                              disabled={isMarking}
                                              onClick={() =>
                                                showMarkAbsent
                                                  ? handleManualAbsentOverride(student, a)
                                                  : handleManualPresentOverride(student, a)
                                              }
                                            >
                                              {isMarking ? "Saving..." : showMarkAbsent ? "Mark Absent" : "Mark Present"}
                                            </Button>
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              className="gap-1"
                                              onClick={() => openLogs(student, a)}
                                            >
                                              <ListTree className="h-3.5 w-3.5" />
                                              Logs
                                            </Button>
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    )
                                  })
                                : paginationRange.pageItems.map((rangeEntry) => (
                                    <TableRow key={rangeEntry.student.studentId}>
                                      <TableCell>
                                        <div className="flex items-center gap-2">
                                          <Avatar className="h-8 w-8">
                                            <AvatarImage
                                              src={getAvatarUrl(rangeEntry.student.imageUrl)}
                                              alt={rangeEntry.student.fullName}
                                            />
                                            <AvatarFallback>{getNameInitials(rangeEntry.student.fullName)}</AvatarFallback>
                                          </Avatar>
                                          <span className="font-medium">{rangeEntry.student.fullName}</span>
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <Badge variant="outline">{rangeEntry.student.studentIdNumber || "—"}</Badge>
                                      </TableCell>
                                      <TableCell>{rangeEntry.counts.present}</TableCell>
                                      <TableCell>{rangeEntry.counts.late}</TableCell>
                                      <TableCell>{rangeEntry.counts.absent}</TableCell>
                                      <TableCell>{rangeEntry.counts.excused}</TableCell>
                                      <TableCell>
                                        {rangeEntry.latest ? (
                                          <div className="flex flex-col gap-0.5">
                                            <Badge variant={statusBadgeVariant(rangeEntry.latest.status)}>
                                              {rangeEntry.latest.status}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground">
                                              {formatDisplayDate(rangeEntry.latest.attendanceDate)}
                                            </span>
                                          </div>
                                        ) : (
                                          <span className="text-muted-foreground">—</span>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          className="gap-1"
                                          onClick={() => openLogs(rangeEntry.student, a)}
                                        >
                                          <ListTree className="h-3.5 w-3.5" />
                                          Logs
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                            </TableBody>
                          </Table>
                        </div>

                        {/* Mobile cards */}
                        <div className="flex flex-col gap-3 md:hidden">
                          {isSingleDay
                            ? paginationSingleDay.pageItems.map((entry) => {
                                const { student, row, hasRecord } = entry
                                const isMarking = manualOverrideStudentId === student.studentId
                                const showMarkAbsent =
                                  hasRecord && row && (row.status === "PRESENT" || row.status === "LATE")
                                return (
                                  <div
                                    key={student.studentId}
                                    className="flex flex-col gap-2.5 rounded-lg border bg-card p-3 shadow-xs"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <Avatar className="h-9 w-9 shrink-0 sm:h-10 sm:w-10">
                                          <AvatarImage src={getAvatarUrl(student.imageUrl)} alt={student.fullName} />
                                          <AvatarFallback>{getNameInitials(student.fullName)}</AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0">
                                          <p className="font-medium leading-tight truncate">{student.fullName}</p>
                                          <p className="text-xs text-muted-foreground">
                                            ID {student.studentIdNumber || "—"}
                                          </p>
                                        </div>
                                      </div>
                                      {hasRecord && row ? (
                                        <Badge className="shrink-0" variant={statusBadgeVariant(row.status)}>
                                          {row.status}
                                        </Badge>
                                      ) : (
                                        <Badge className="shrink-0" variant="destructive">
                                          ABSENT
                                        </Badge>
                                      )}
                                    </div>
                                    {hasRecord && row ? (
                                      <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                                        <dt className="text-muted-foreground">Time in</dt>
                                        <dd>{formatTime(row.timeIn)}</dd>
                                        <dt className="text-muted-foreground">Time out</dt>
                                        <dd>{formatTime(row.timeOut)}</dd>
                                        <dt className="text-muted-foreground">First scan</dt>
                                        <dd>{formatDateTime(row.firstScanAt)}</dd>
                                        <dt className="text-muted-foreground">Last scan</dt>
                                        <dd>{formatDateTime(row.lastScanAt)}</dd>
                                      </dl>
                                    ) : null}
                                    <div className="flex flex-col gap-2">
                                      <Button
                                        type="button"
                                        variant={showMarkAbsent ? "destructive" : "default"}
                                        size="sm"
                                        className="w-full text-xs sm:text-sm"
                                        disabled={isMarking}
                                        onClick={() =>
                                          showMarkAbsent
                                            ? handleManualAbsentOverride(student, a)
                                            : handleManualPresentOverride(student, a)
                                        }
                                      >
                                        {isMarking ? "Saving..." : showMarkAbsent ? "Mark Absent" : "Mark Present"}
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        className="w-full gap-1 text-xs sm:text-sm"
                                        onClick={() => openLogs(student, a)}
                                      >
                                        <ListTree className="h-3.5 w-3.5" />
                                        View scan logs
                                      </Button>
                                    </div>
                                  </div>
                                )
                              })
                            : paginationRange.pageItems.map((rangeEntry) => (
                                <div
                                  key={rangeEntry.student.studentId}
                                  className="flex flex-col gap-2.5 rounded-lg border bg-card p-3 shadow-xs"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <Avatar className="h-9 w-9 shrink-0 sm:h-10 sm:w-10">
                                        <AvatarImage
                                          src={getAvatarUrl(rangeEntry.student.imageUrl)}
                                          alt={rangeEntry.student.fullName}
                                        />
                                        <AvatarFallback>{getNameInitials(rangeEntry.student.fullName)}</AvatarFallback>
                                      </Avatar>
                                      <div className="min-w-0">
                                        <p className="font-medium leading-tight truncate">{rangeEntry.student.fullName}</p>
                                        <p className="text-xs text-muted-foreground">
                                          ID {rangeEntry.student.studentIdNumber || "—"}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5 text-xs">
                                    <Badge variant="default">P {rangeEntry.counts.present}</Badge>
                                    <Badge variant="secondary">L {rangeEntry.counts.late}</Badge>
                                    <Badge variant="destructive">A {rangeEntry.counts.absent}</Badge>
                                    <Badge variant="outline">E {rangeEntry.counts.excused}</Badge>
                                  </div>
                                  {rangeEntry.latest ? (
                                    <p className="text-xs text-muted-foreground">
                                      Latest:{" "}
                                      <span className="font-medium text-foreground">
                                        {rangeEntry.latest.status} · {formatDisplayDate(rangeEntry.latest.attendanceDate)}
                                      </span>
                                    </p>
                                  ) : (
                                    <p className="text-xs text-muted-foreground">No attendance in range</p>
                                  )}
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    className="w-full gap-1 text-xs sm:text-sm"
                                    onClick={() => openLogs(rangeEntry.student, a)}
                                  >
                                    <ListTree className="h-3.5 w-3.5" />
                                    View scan logs
                                  </Button>
                                </div>
                              ))}
                        </div>
                          </>
                        )}

                        <TablePaginationControls
                          pageIndex={pagination.pageIndex}
                          pageSize={pagination.pageSize}
                          totalItems={pagination.totalItems}
                          onPageIndexChange={setPageIndex}
                          onPageSizeChange={(next) => {
                            setPageSize(next)
                            setPageIndex(0)
                          }}
                        />
                          </>
                        )}
                      </>
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>

      <Sheet open={logsOpen} onOpenChange={setLogsOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Matched scan logs</SheetTitle>
            <SheetDescription>
              Raw timelogs linked to attendance for{" "}
              <span className="font-medium text-foreground">{logsStudent?.fullName ?? "student"}</span>
              {logsAssignment
                ? ` · ${logsAssignment.sectionName ?? ""} / ${logsAssignment.subjectName ?? ""}`
                : ""}
              .
            </SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-6">
            {logsLoading ? (
              <p className="text-sm text-muted-foreground">Loading logs…</p>
            ) : logsError ? (
              <p className="text-sm text-destructive">{logsError}</p>
            ) : logsRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No matched logs in this range.</p>
            ) : (
              <ul className="space-y-2">
                {logsRows.map((log) => (
                  <li
                    key={log.id}
                    className={cn("rounded-md border p-3 text-sm", "bg-muted/20")}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline">{log.log_type}</Badge>
                      <span className="text-xs text-muted-foreground">{formatLogLine(log.log_datetime)}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{log.verification_method}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </MainLayout>
  )
}
