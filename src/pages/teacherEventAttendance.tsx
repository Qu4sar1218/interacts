import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  dashboardService,
  type EventAttendanceResponse,
  type EventAttendanceStudentRow,
} from "@/services/dashboard.service";
import { getApiErrorMessage } from "@/services/api";

function todayInputValue(): string {
  return format(new Date(), "yyyy-MM-dd");
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return format(new Date(value), "MMM d, yyyy h:mm a");
}

export default function TeacherEventAttendance() {
  const [fromDate, setFromDate] = useState(todayInputValue);
  const [toDate, setToDate] = useState(todayInputValue);
  const [payload, setPayload] = useState<EventAttendanceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await dashboardService.getTeacherActiveEventAttendance({
        from: fromDate,
        to: toDate,
      });
      setPayload(data);
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to load event attendance."));
      setPayload(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalStudents = useMemo(() => payload?.totals.students ?? 0, [payload]);

  return (
    <MainLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="space-y-1 sm:space-y-2">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Event Attendance</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Active event attendance logs for your assigned section(s).
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Default is today. Adjust range then refresh.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="space-y-1">
              <label className="text-sm font-medium">From</label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">To</label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
            <Button type="button" onClick={() => void load()} disabled={loading}>
              {loading ? "Loading..." : "Refresh"}
            </Button>
          </CardContent>
        </Card>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {payload?.active_event ? (
          <Card>
            <CardHeader>
              <CardTitle>{payload.active_event.name}</CardTitle>
              <CardDescription>
                Active event range: {payload.active_event.startDate} to {payload.active_event.endDate}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Badge variant="outline">Sections {payload.totals.sections}</Badge>
              <Badge variant="outline">Students {totalStudents}</Badge>
              <Badge variant="outline">Logs {payload.totals.logs}</Badge>
              <Badge variant="outline">IN {payload.totals.time_in}</Badge>
              <Badge variant="outline">OUT {payload.totals.time_out}</Badge>
            </CardContent>
          </Card>
        ) : null}

        {payload?.note && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">{payload.note}</CardContent>
          </Card>
        )}

        {payload?.sections?.map((section) => (
          <Card key={section.section_id}>
            <CardHeader>
              <CardTitle>
                {section.section_name || "Unnamed Section"}{" "}
                <span className="text-muted-foreground font-normal">({section.section_code || "—"})</span>
              </CardTitle>
              <CardDescription>
                Students {section.totals.students} · Logs {section.totals.logs} · IN {section.totals.time_in} · OUT{" "}
                {section.totals.time_out}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {section.students.length === 0 ? (
                <p className="text-sm text-muted-foreground">No student logs in this section.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>IN</TableHead>
                      <TableHead>OUT</TableHead>
                      <TableHead>Last log</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {section.students.map((student: EventAttendanceStudentRow) => (
                      <TableRow key={student.student_id}>
                        <TableCell className="font-medium">{student.full_name}</TableCell>
                        <TableCell>{student.student_number || "—"}</TableCell>
                        <TableCell>{student.time_in_count}</TableCell>
                        <TableCell>{student.time_out_count}</TableCell>
                        <TableCell>
                          {student.last_log_type || "—"} · {formatDateTime(student.last_log_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </MainLayout>
  );
}
