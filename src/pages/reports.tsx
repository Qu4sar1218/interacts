import { useCallback, useEffect, useMemo, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { studentService } from '@/services/student.service';
import {
  reportsService,
  type ReportGranularity,
  type ReportTerminal,
  type SectionAttendanceResponse,
  type TerminalAnalyticsResponse,
} from '@/services/reports.service';
import { sectionService, type Section, type SectionSubjectTeacher } from '@/services/section.service';
import { format, parseISO, startOfMonth, subDays, subMonths } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart as RechartsLineChart,
  Line,
} from 'recharts';
import { Download, Layers, LineChart, Users } from 'lucide-react';
import { HallwayDailyRadialChart } from '@/components/reports/HallwayDailyRadialChart';
import { HallwayInOutDonutChart } from '@/components/reports/HallwayInOutDonutChart';
import type {
  HallwayDailyComparisonResponse,
  SectionAttendanceBySubjectResponse,
  SectionAttendanceTrendResponse,
} from '@/services/reports.service';

const TERMINAL_TABS: { value: ReportTerminal; label: string }[] = [
  { value: 'hallway', label: 'Hallway' },
  { value: 'classroom', label: 'Classroom' },
  { value: 'event', label: 'Event' },
];

const GRANULARITY_OPTIONS: { value: ReportGranularity; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

function defaultDateRange() {
  const to = new Date();
  const from = startOfMonth(subMonths(to, 0));
  return {
    from: format(from, 'yyyy-MM-dd'),
    to: format(to, 'yyyy-MM-dd'),
  };
}

function statusBadgeVariant(
  status: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  const s = status?.toUpperCase();
  if (s === 'PRESENT') return 'default';
  if (s === 'LATE') return 'secondary';
  if (s === 'ABSENT') return 'destructive';
  if (s === 'EXCUSED') return 'outline';
  return 'secondary';
}

/** Minutes since midnight from schedule start (HH:mm or HH:mm:ss). Unknown sorts last. */
function minutesFromScheduleStart(t: string | null | undefined): number {
  if (!t || typeof t !== 'string') return 24 * 60;
  const head = t.trim().slice(0, 5);
  const m = head.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return 24 * 60;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (Number.isNaN(h) || Number.isNaN(min)) return 24 * 60;
  return h * 60 + min;
}

export default function Reports() {
  const [mainTab, setMainTab] = useState('terminal');
  const [terminal, setTerminal] = useState<ReportTerminal>('hallway');
  const [granularity, setGranularity] = useState<ReportGranularity>('daily');
  const [range, setRange] = useState(defaultDateRange);
  const [terminalData, setTerminalData] = useState<TerminalAnalyticsResponse | null>(null);
  const [terminalLoading, setTerminalLoading] = useState(false);
  const [terminalError, setTerminalError] = useState<string | null>(null);

  const [studentCount, setStudentCount] = useState<number | null>(null);

  const [sections, setSections] = useState<Section[]>([]);
  const [sectionId, setSectionId] = useState<string>('');
  const [sectionDate, setSectionDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [sectionData, setSectionData] = useState<SectionAttendanceResponse | null>(null);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [sectionError, setSectionError] = useState<string | null>(null);

  const [hallwayRadialDate, setHallwayRadialDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [hallwayComparison, setHallwayComparison] = useState<HallwayDailyComparisonResponse | null>(null);
  const [hallwayComparisonLoading, setHallwayComparisonLoading] = useState(false);

  const [subjectSummary, setSubjectSummary] = useState<SectionAttendanceBySubjectResponse | null>(null);
  const [sectionTrend, setSectionTrend] = useState<SectionAttendanceTrendResponse | null>(null);
  const [sectionChartsLoading, setSectionChartsLoading] = useState(false);

  const [sectionSubjectAssignments, setSectionSubjectAssignments] = useState<SectionSubjectTeacher[]>([]);
  /** `'all'` or subject UUID */
  const [sectionSubjectFilter, setSectionSubjectFilter] = useState<string>('all');

  useEffect(() => {
    studentService
      .getStudentsWithFaceCredentials()
      .then((list) => setStudentCount(Array.isArray(list) ? list.length : 0))
      .catch(() => setStudentCount(0));
  }, []);

  useEffect(() => {
    sectionService
      .getSections({ active: true })
      .then((list) => {
        setSections(list);
        if (list.length) setSectionId((prev) => prev || list[0].id);
      })
      .catch(() => setSections([]));
  }, []);

  useEffect(() => {
    if (!sectionId) {
      setSectionSubjectAssignments([]);
      return;
    }
    sectionService
      .getSectionSubjectTeachers(sectionId, { active: true })
      .then((list) => setSectionSubjectAssignments(Array.isArray(list) ? list : []))
      .catch(() => setSectionSubjectAssignments([]));
  }, [sectionId]);

  useEffect(() => {
    setSectionSubjectFilter('all');
  }, [sectionId, sectionDate]);

  const loadTerminal = useCallback(async () => {
    setTerminalLoading(true);
    setTerminalError(null);
    try {
      const data = await reportsService.getTerminalAnalytics({
        terminal,
        from: range.from,
        to: range.to,
        granularity,
      });
      setTerminalData(data);
    } catch (e: unknown) {
      setTerminalError(e instanceof Error ? e.message : 'Failed to load terminal analytics');
      setTerminalData(null);
    } finally {
      setTerminalLoading(false);
    }
  }, [terminal, range.from, range.to, granularity]);

  useEffect(() => {
    if (mainTab !== 'terminal') return;
    void loadTerminal();
  }, [mainTab, loadTerminal]);

  const loadHallwayComparison = useCallback(async () => {
    setHallwayComparisonLoading(true);
    try {
      const data = await reportsService.getHallwayDailyComparison({ date: hallwayRadialDate });
      setHallwayComparison(data);
    } catch {
      setHallwayComparison(null);
    } finally {
      setHallwayComparisonLoading(false);
    }
  }, [hallwayRadialDate]);

  useEffect(() => {
    if (mainTab !== 'terminal' || terminal !== 'hallway') return;
    void loadHallwayComparison();
  }, [mainTab, terminal, hallwayRadialDate, loadHallwayComparison]);

  const loadSection = useCallback(async () => {
    if (!sectionId) return;
    setSectionLoading(true);
    setSectionChartsLoading(true);
    setSectionError(null);
    try {
      const trendFrom = format(subDays(parseISO(sectionDate + 'T12:00:00'), 6), 'yyyy-MM-dd');
      const [detail, bySubject, trend] = await Promise.all([
        reportsService.getSectionAttendance({ sectionId, date: sectionDate }),
        reportsService.getSectionAttendanceBySubject({ sectionId, date: sectionDate }),
        reportsService.getSectionAttendanceTrend({
          sectionId,
          from: trendFrom,
          to: sectionDate,
        }),
      ]);
      setSectionData(detail);
      setSubjectSummary(bySubject);
      setSectionTrend(trend);
    } catch (e: unknown) {
      setSectionError(e instanceof Error ? e.message : 'Failed to load section attendance');
      setSectionData(null);
      setSubjectSummary(null);
      setSectionTrend(null);
    } finally {
      setSectionLoading(false);
      setSectionChartsLoading(false);
    }
  }, [sectionId, sectionDate]);

  useEffect(() => {
    if (mainTab !== 'section') return;
    void loadSection();
  }, [mainTab, loadSection]);

  const chartData = useMemo(() => {
    if (!terminalData?.series?.length) return [];
    return terminalData.series.map((p) => ({
      name: p.label,
      distinct: p.distinct_students,
      key: p.period_key,
    }));
  }, [terminalData]);

  const peakDistinct = useMemo(() => {
    if (!terminalData?.series?.length) return 0;
    return Math.max(...terminalData.series.map((s) => s.distinct_students), 0);
  }, [terminalData]);

  const subjectBarData = useMemo(() => {
    if (!subjectSummary?.subjects?.length) return [];
    return subjectSummary.subjects.map((s) => ({
      name: (s.subject_code || s.subject_name || '—').slice(0, 14),
      fullName: s.subject_name || s.subject_code || '—',
      Present: s.present,
      Late: s.late,
      Absent: s.absent,
      Excused: s.excused,
      enrolled: s.enrolled_count,
      presentOrLate: s.present_or_late,
    }));
  }, [subjectSummary]);

  const trendLineData = useMemo(() => {
    if (!sectionTrend?.series?.length) return [];
    return sectionTrend.series.map((p) => ({
      ...p,
      shortLabel: format(parseISO(p.date + 'T12:00:00'), 'MMM d'),
    }));
  }, [sectionTrend]);

  const sectionSubjectTabs = useMemo(() => {
    type TabItem = { id: string; label: string };
    const rows = sectionData?.rows ?? [];

    function minScheduleForSubject(subjectId: string): number {
      let m = 24 * 60;
      for (const a of sectionSubjectAssignments) {
        if (a.subjectId === subjectId && a.startTime) {
          m = Math.min(m, minutesFromScheduleStart(a.startTime));
        }
      }
      for (const r of rows) {
        if (r.subject?.id === subjectId) {
          m = Math.min(m, minutesFromScheduleStart(r.assignment?.start_time));
        }
      }
      return m;
    }

    const byId = new Map<string, TabItem>();
    const sortedAssignments = [...sectionSubjectAssignments].sort(
      (a, b) => minutesFromScheduleStart(a.startTime) - minutesFromScheduleStart(b.startTime)
    );
    for (const a of sortedAssignments) {
      if (byId.has(a.subjectId)) continue;
      byId.set(a.subjectId, {
        id: a.subjectId,
        label: a.subject?.name ?? a.subject?.code ?? 'Subject',
      });
    }
    for (const r of rows) {
      const sid = r.subject?.id;
      if (!sid || byId.has(sid)) continue;
      byId.set(sid, {
        id: sid,
        label: r.subject?.name ?? r.subject?.code ?? 'Subject',
      });
    }

    const list = [...byId.values()];
    list.sort((a, b) => minScheduleForSubject(a.id) - minScheduleForSubject(b.id));
    return list;
  }, [sectionSubjectAssignments, sectionData]);

  const sectionAttendanceDisplayRows = useMemo(() => {
    if (!sectionData?.rows?.length) return [];
    let rows = [...sectionData.rows];
    if (sectionSubjectFilter !== 'all') {
      rows = rows.filter((r) => r.subject?.id === sectionSubjectFilter);
    }
    rows.sort((a, b) => {
      const ta = minutesFromScheduleStart(a.assignment?.start_time);
      const tb = minutesFromScheduleStart(b.assignment?.start_time);
      if (ta !== tb) return ta - tb;
      return (a.student?.full_name ?? '').localeCompare(b.student?.full_name ?? '', undefined, {
        sensitivity: 'base',
      });
    });
    return rows;
  }, [sectionData, sectionSubjectFilter]);

  const exportTerminalCsv = async () => {
    if (!range.from || !range.to) return;
    try {
      setTerminalError(null);
      const params = { from: range.from, to: range.to };
      const file =
        terminal === 'hallway'
          ? await reportsService.exportHallwayCsv(params)
          : terminal === 'classroom'
            ? await reportsService.exportClassroomCsv(params)
            : await reportsService.exportEventCsv({
                ...params,
                eventId: terminalData?.event?.id,
              });
      const a = document.createElement('a');
      const href = URL.createObjectURL(file.blob);
      a.href = href;
      a.download = file.filename;
      a.click();
      URL.revokeObjectURL(href);
    } catch (e: unknown) {
      setTerminalError(e instanceof Error ? e.message : 'Failed to export terminal CSV');
    }
  };

  const exportSectionCsv = () => {
    if (!sectionAttendanceDisplayRows.length) return;
    if (!sectionData) return;
    const header = [
      'Student',
      'Subject',
      'Teacher',
      'Status',
      'Time in',
      'Time out',
      'Class window',
    ];
    const rows = sectionAttendanceDisplayRows.map((r) => [
      r.student?.full_name ?? '',
      r.subject?.name ?? '',
      r.teacher?.full_name ?? '',
      r.status,
      r.time_in ? format(new Date(r.time_in), 'HH:mm') : '',
      r.time_out ? format(new Date(r.time_out), 'HH:mm') : '',
      r.assignment?.start_time && r.assignment?.end_time
        ? `${r.assignment.start_time}-${r.assignment.end_time}`
        : '',
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const subjectSuffix =
      sectionSubjectFilter !== 'all'
        ? `_${sectionSubjectTabs.find((t) => t.id === sectionSubjectFilter)?.label?.replace(/\s+/g, '_') ?? 'subject'}`
        : '';
    a.download = `section_${sectionData.section.code}_${sectionData.date}${subjectSuffix}.csv`;
    a.click();
  };

  return (
    <MainLayout>
      <div className="section-spacing">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <h1 className="page-header">Reports and Analytics</h1>
            <p className="text-muted-foreground">
              Terminal scan trends (distinct students per period) and official per-subject section attendance.
            </p>
          </div>
        </div>

        <Tabs value={mainTab} onValueChange={setMainTab} className="mt-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="terminal" className="gap-2">
              <LineChart className="h-4 w-4" />
              Terminal analytics
            </TabsTrigger>
            <TabsTrigger value="section" className="gap-2">
              <Layers className="h-4 w-4" />
              Section attendance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="terminal" className="mt-6 space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Students (face registered)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-2xl font-semibold tabular-nums">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    {studentCount ?? '—'}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Peak distinct (range)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold tabular-nums">{terminalLoading ? '…' : peakDistinct}</div>
                  <p className="text-xs text-muted-foreground">Max distinct students in any bucket</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Device</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm font-medium leading-tight">
                    {terminalData?.device?.name ?? '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">{terminalData?.device?.code ?? ''}</p>
                </CardContent>
              </Card>
            </div>

            {terminal === 'hallway' && (
              <div className="space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="hallway-radial-date">Hallway snapshot date</Label>
                      <input
                        id="hallway-radial-date"
                        type="date"
                        className="flex h-10 w-full min-w-48 rounded-md border border-input bg-background px-3 py-2 text-sm sm:w-auto"
                        value={hallwayRadialDate}
                        onChange={(e) => setHallwayRadialDate(e.target.value)}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-fit"
                      onClick={() => void loadHallwayComparison()}
                      disabled={hallwayComparisonLoading}
                    >
                      {hallwayComparisonLoading ? 'Loading…' : 'Refresh snapshot'}
                    </Button>
                  </div>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <HallwayDailyRadialChart data={hallwayComparison} loading={hallwayComparisonLoading} />
                  <HallwayInOutDonutChart data={hallwayComparison} loading={hallwayComparisonLoading} />
                </div>
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Filters</CardTitle>
                <CardDescription>
                  Distinct students with at least one TIME_IN scan per bucket (same basis as admin dashboard
                  hallway stats).
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-2" role="tablist" aria-label="Terminal type">
                  {TERMINAL_TABS.map((t) => (
                    <Button
                      key={t.value}
                      type="button"
                      size="sm"
                      variant={terminal === t.value ? 'default' : 'outline'}
                      className={cn(terminal === t.value && 'shadow-sm')}
                      onClick={() => setTerminal(t.value)}
                    >
                      {t.label}
                    </Button>
                  ))}
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="from-date">From</Label>
                    <input
                      id="from-date"
                      type="date"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={range.from}
                      onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="to-date">To</Label>
                    <input
                      id="to-date"
                      type="date"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={range.to}
                      onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Granularity</Label>
                    <Select
                      value={granularity}
                      onValueChange={(v) => setGranularity(v as ReportGranularity)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GRANULARITY_OPTIONS.map((g) => (
                          <SelectItem key={g.value} value={g.value}>
                            {g.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-fit"
                      onClick={() => void loadTerminal()}
                      disabled={terminalLoading}
                    >
                      {terminalLoading ? 'Loading…' : 'Apply'}
                    </Button>
                  </div>
                </div>

                {terminalData?.event && (
                  <p className="text-sm text-muted-foreground">
                    Event filter: <span className="font-medium">{terminalData.event.name}</span>
                  </p>
                )}
                {terminalData?.note && (
                  <p className="text-sm text-amber-600 dark:text-amber-500">{terminalData.note}</p>
                )}
                {terminalError && (
                  <p className="text-sm text-destructive">{terminalError}</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle>Distinct students by period</CardTitle>
                  <CardDescription>
                    {terminalData
                      ? `${terminalData.from} → ${terminalData.to} · ${terminalData.granularity}`
                      : 'Select range and apply'}
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void exportTerminalCsv()}
                  disabled={terminalLoading || !range.from || !range.to}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                {terminalLoading ? (
                  <div className="flex h-[360px] items-center justify-center text-muted-foreground">
                    Loading chart…
                  </div>
                ) : chartData.length === 0 ? (
                  <div className="flex h-[360px] items-center justify-center text-muted-foreground">
                    No data for this range. Try widening dates or another terminal.
                  </div>
                ) : (
                  <div className="h-[380px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-35} textAnchor="end" height={70} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="distinct" name="Distinct students" fill="oklch(0.55 0.18 145)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="section" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Section attendance (per subject)</CardTitle>
                <CardDescription>
                  Official attendance rows for the selected section and date—one row per class/subject.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Section</Label>
                    <Select value={sectionId} onValueChange={setSectionId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose section" />
                      </SelectTrigger>
                      <SelectContent>
                        {sections.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} ({s.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="section-date">Date</Label>
                    <input
                      id="section-date"
                      type="date"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={sectionDate}
                      onChange={(e) => setSectionDate(e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-fit"
                  onClick={() => void loadSection()}
                  disabled={sectionLoading || !sectionId}
                >
                  {sectionLoading ? 'Loading…' : 'Refresh'}
                </Button>
                {sectionError && <p className="text-sm text-destructive">{sectionError}</p>}
              </CardContent>
            </Card>

            {sectionId && (sectionChartsLoading || subjectSummary || sectionTrend) && (
              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>By subject ({sectionDate})</CardTitle>
                    <CardDescription>
                      Stacked attendance counts per class. Enrolled in section:{' '}
                      <span className="font-medium text-foreground">
                        {subjectSummary?.enrolled_in_section ?? '—'}
                      </span>{' '}
                      students (same baseline for each subject).
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {sectionChartsLoading && !subjectSummary ? (
                      <div className="flex h-[320px] items-center justify-center text-muted-foreground">
                        Loading…
                      </div>
                    ) : subjectBarData.length === 0 ? (
                      <div className="flex h-[320px] items-center justify-center text-muted-foreground">
                        No subject assignments for this section.
                      </div>
                    ) : (
                      <div className="h-[340px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={subjectBarData} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis
                              dataKey="name"
                              tick={{ fontSize: 10 }}
                              interval={0}
                              angle={-30}
                              textAnchor="end"
                              height={56}
                            />
                            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                            <Tooltip
                              formatter={(value: number, name: string) => [value, name]}
                              labelFormatter={(_, payload) =>
                                payload?.[0]?.payload?.fullName ?? ''
                              }
                            />
                            <Legend />
                            <Bar dataKey="Present" stackId="s" fill="oklch(0.55 0.18 145)" radius={[0, 0, 0, 0]} />
                            <Bar dataKey="Late" stackId="s" fill="oklch(0.72 0.14 85)" />
                            <Bar dataKey="Absent" stackId="s" fill="oklch(0.55 0.2 25)" />
                            <Bar dataKey="Excused" stackId="s" fill="oklch(0.55 0.05 250)" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Attendance trend (7 days)</CardTitle>
                    <CardDescription>
                      Totals from official attendance rows for each day ending on the selected date.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {sectionChartsLoading && !sectionTrend ? (
                      <div className="flex h-[320px] items-center justify-center text-muted-foreground">
                        Loading…
                      </div>
                    ) : trendLineData.length === 0 ? (
                      <div className="flex h-[320px] items-center justify-center text-muted-foreground">
                        No trend data.
                      </div>
                    ) : (
                      <div className="h-[340px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <RechartsLineChart data={trendLineData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="shortLabel" tick={{ fontSize: 11 }} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey="present_or_late"
                              name="Present + late"
                              stroke="oklch(0.55 0.18 145)"
                              strokeWidth={2}
                              dot={{ r: 3 }}
                            />
                            <Line
                              type="monotone"
                              dataKey="records"
                              name="Total records"
                              stroke="oklch(0.45 0.12 200)"
                              strokeWidth={2}
                              dot={{ r: 3 }}
                            />
                          </RechartsLineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {mainTab === 'section' && sectionLoading && !sectionData && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Loading section attendance…
                </CardContent>
              </Card>
            )}

            {sectionData && (
              <Card>
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle>
                      {sectionData.section.name}{' '}
                      <span className="text-muted-foreground font-normal">({sectionData.section.code})</span>
                      {sectionLoading && (
                        <span className="ml-2 text-sm font-normal text-muted-foreground">Updating…</span>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {sectionData.section.course?.name ?? 'Course'} · {format(new Date(sectionData.date + 'T12:00:00'), 'EEEE, MMMM d, yyyy')}
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={exportSectionCsv}
                    disabled={!sectionAttendanceDisplayRows.length}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export CSV
                  </Button>
                </CardHeader>
                <CardContent>
                  {sectionLoading ? (
                    <p className="text-muted-foreground py-8 text-center">Loading…</p>
                  ) : sectionData.rows.length === 0 ? (
                    <p className="text-muted-foreground py-8 text-center">
                      No attendance records for this section on this date. Scans may not have been recorded yet.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {sectionSubjectTabs.length > 0 && (
                        <Tabs
                          value={sectionSubjectFilter}
                          onValueChange={setSectionSubjectFilter}
                          className="w-full"
                        >
                          <div className="overflow-x-auto pb-1">
                            <TabsList className="inline-flex h-auto w-max max-w-full flex-wrap justify-start gap-1 bg-muted/50 p-1">
                              <TabsTrigger value="all" className="shrink-0 px-3 text-xs sm:text-sm">
                                All subjects
                              </TabsTrigger>
                              {sectionSubjectTabs.map((t) => (
                                <TabsTrigger
                                  key={t.id}
                                  value={t.id}
                                  className="max-w-[min(100%,14rem)] shrink-0 truncate px-3 text-xs sm:text-sm"
                                  title={t.label}
                                >
                                  {t.label}
                                </TabsTrigger>
                              ))}
                            </TabsList>
                          </div>
                        </Tabs>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Rows are ordered by earliest class start time, then student name.
                        {sectionSubjectFilter !== 'all' && (
                          <span className="font-medium text-foreground">
                            {' '}
                            Showing one subject only.
                          </span>
                        )}
                      </p>
                      {sectionAttendanceDisplayRows.length === 0 ? (
                        <p className="text-muted-foreground py-6 text-center text-sm">
                          No attendance rows for this subject on this date.
                        </p>
                      ) : (
                        <div className="max-h-[480px] overflow-auto rounded-md border scrollbar-thin">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Student</TableHead>
                                <TableHead>Subject</TableHead>
                                <TableHead>Teacher</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Time in</TableHead>
                                <TableHead>Time out</TableHead>
                                <TableHead>Schedule</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {sectionAttendanceDisplayRows.map((r) => (
                                <TableRow key={r.id}>
                                  <TableCell className="font-medium">{r.student?.full_name ?? '—'}</TableCell>
                                  <TableCell>{r.subject?.name ?? '—'}</TableCell>
                                  <TableCell>{r.teacher?.full_name ?? '—'}</TableCell>
                                  <TableCell>
                                    <Badge variant={statusBadgeVariant(r.status)}>{r.status}</Badge>
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">
                                    {r.time_in ? format(new Date(r.time_in), 'HH:mm') : '—'}
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">
                                    {r.time_out ? format(new Date(r.time_out), 'HH:mm') : '—'}
                                  </TableCell>
                                  <TableCell className="text-muted-foreground text-sm">
                                    {r.assignment?.start_time && r.assignment?.end_time
                                      ? `${r.assignment.start_time} – ${r.assignment.end_time}`
                                      : '—'}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
