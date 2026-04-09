import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { loadModels, isModelsLoaded } from '@/lib/faceApi';
import { studentEnrollmentService } from '@/services/student-enrollment.service';
import { dashboardService, type HallwayWeekStats, type AdminDashboardStats } from '@/services/dashboard.service';
import { HallwayWeekChart } from '@/components/dashboard/HallwayWeekChart';
import { teacherService, type Teacher } from '@/services/teacher.service';
import { eventService, type CalendarEvent } from '@/services/event.service';
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isSameMonth, addMonths, subMonths } from 'date-fns';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const EVENT_COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
];

function getEventColor(index: number) {
  return EVENT_COLORS[index % EVENT_COLORS.length];
}

interface CalendarProps {
  events: CalendarEvent[];
}

function MonthCalendar({ events }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const today = new Date();

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const startPadding = getDay(monthStart);

  const eventsForDay = (day: Date) =>
    events.filter((e) => {
      const start = new Date(e.startDate + 'T00:00:00');
      const end = new Date(e.endDate + 'T00:00:00');
      return day >= start && day <= end;
    });

  return (
    <div className="flex flex-col gap-3">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold">
          {format(currentMonth, 'MMMM yyyy')}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 text-center">
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-[10px] font-medium text-muted-foreground py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px rounded-md bg-border/70 p-px">
        {/* Leading empty cells */}
        {Array.from({ length: startPadding }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}

        {days.map((day) => {
          const dayEvents = eventsForDay(day);
          const isToday = isSameDay(day, today);
          const isCurrentMonth = isSameMonth(day, currentMonth);

          return (
            <div
              key={day.toISOString()}
              className={`min-h-[52px] rounded-sm border border-border/70 bg-card p-1 flex flex-col gap-0.5 ${
                isToday
                  ? 'ring-2 ring-primary bg-primary/5'
                  : isCurrentMonth
                  ? 'hover:bg-muted/50'
                  : 'opacity-40'
              }`}
            >
              <span
                className={`text-xs font-medium leading-none mb-0.5 ${
                  isToday ? 'text-primary' : 'text-foreground'
                }`}
              >
                {format(day, 'd')}
              </span>
              {dayEvents.slice(0, 2).map((e, idx) => (
                <div
                  key={e.id}
                  title={`${e.name}${e.timeStart ? ' · ' + e.timeStart.slice(0, 5) : ''}`}
                  className={`truncate rounded px-1 text-[9px] leading-4 text-white ${getEventColor(idx)}`}
                >
                  {e.name}
                </div>
              ))}
              {dayEvents.length > 2 && (
                <span className="text-[9px] text-muted-foreground leading-none">
                  +{dayEvents.length - 2} more
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend: upcoming events this month */}
      {events.length > 0 && (
        <div className="mt-1 space-y-1 border-t pt-2">
          <p className="text-xs font-medium text-muted-foreground">Upcoming this month</p>
          {events
            .filter((e) => {
              const start = new Date(e.startDate + 'T00:00:00');
              return isSameMonth(start, currentMonth) && start >= today;
            })
            .slice(0, 4)
            .map((e, idx) => (
              <div key={e.id} className="flex items-center gap-2 text-xs">
                <span className={`h-2 w-2 rounded-full shrink-0 ${getEventColor(idx)}`} />
                <span className="truncate font-medium">{e.name}</span>
                <span className="ml-auto text-muted-foreground whitespace-nowrap">
                  {format(new Date(e.startDate + 'T00:00:00'), 'MMM d')}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [enrolledCount, setEnrolledCount] = useState(0);
  const [adminStats, setAdminStats] = useState<AdminDashboardStats | null>(null);
  const [hallwayWeek, setHallwayWeek] = useState<HallwayWeekStats | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [modelsReady, setModelsReady] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const today = new Date();
        const monthStart = format(startOfMonth(today), 'yyyy-MM-dd');
        const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd');

        const [enrollments, teacherList, eventList, stats] = await Promise.all([
          studentEnrollmentService.getAllEnrollments({ status: 'enrolled', active: true }),
          teacherService.getTeachers(),
          eventService.getEvents({ start_date: monthStart, end_date: monthEnd }),
          dashboardService.getAdminStats(),
        ]);

        try {
          const weekStats = await dashboardService.getHallwayWeek();
          setHallwayWeek(weekStats);
        } catch (weekErr) {
          console.error('Error loading hallway week stats:', weekErr);
          setHallwayWeek(null);
        }

        setEnrolledCount(enrollments.length);
        setAdminStats(stats);

        setTeachers(teacherList.filter((t) => t.active));
        setEvents(eventList);

        if (!isModelsLoaded()) {
          loadModels().then(() => setModelsReady(true));
        } else {
          setModelsReady(true);
        }
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const checksInHallway = adminStats?.checks_in_hallway ?? 0;
  const checksOutHallway = adminStats?.checks_out_hallway ?? 0;
  const totalAttendedEvent = adminStats?.total_attended_event ?? 0;

  if (loading) {
    return (
      <MainLayout>
        <div className="flex h-[80vh] items-center justify-center">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
            <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="section-spacing">
        {/* Header */}
        <div>
          <h1 className="page-header">Dashboard</h1>
          <p className="text-muted-foreground">
            InterACTS — Face recognition attendance &amp; monitoring
          </p>
        </div>

        {/* Model Status */}
        {!modelsReady && (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="flex items-center gap-3 py-4">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-warning border-t-transparent" />
              <p className="text-sm text-warning">
                Loading face detection models... Please wait before scanning.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-2 md:gap-4 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Students Enrolled</CardTitle>
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="stat-value">{enrolledCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Checks In Hallway</CardTitle>
              <UserCheck className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="stat-value">{checksInHallway}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Checks Out Hallway</CardTitle>
              <Clock className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="stat-value">{checksOutHallway}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Attended Event</CardTitle>
              <UserX className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="stat-value">{totalAttendedEvent}</div>
            </CardContent>
          </Card>
        </div>

        {/* Calendar & Recent Activity */}
        <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
          {/* Monthly Activity Calendar */}
          <Card>
            <CardHeader>
              <CardTitle>Activity Calendar</CardTitle>
              <CardDescription>Scheduled classes, events &amp; activities</CardDescription>
            </CardHeader>
            <CardContent>
              <MonthCalendar events={events} />
            </CardContent>
          </Card>

          <HallwayWeekChart stats={hallwayWeek} />
        </div>

        {/* Active Teachers */}
        <Card>
          <CardHeader>
            <CardTitle>Active Teachers</CardTitle>
            <CardDescription>
              {teachers.length} teacher{teachers.length !== 1 ? 's' : ''} currently active
            </CardDescription>
          </CardHeader>
          <CardContent>
            {teachers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Users className="h-12 w-12 text-muted-foreground/30" />
                <p className="mt-2 text-sm text-muted-foreground">No active teachers found</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {teachers.map((teacher) => {
                  const initials = [teacher.firstName?.[0], teacher.lastName?.[0]]
                    .filter(Boolean)
                    .join('')
                    .toUpperCase();
                  return (
                    <div
                      key={teacher.id}
                      className="flex items-center gap-3 rounded-lg border p-3"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {teacher.firstName} {teacher.lastName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {teacher.department?.name ?? '—'}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{teacher.email}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
