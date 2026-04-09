import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { eventService, type CalendarEvent, type EventCreatePayload } from '@/services/event.service';
import {
  formatPaymentStatusLabel,
  paymentService,
  type Payment,
  type PaymentStatus,
} from '@/services/payment.service';
import { getAvatarUrl } from '@/lib/utils';
import { toast } from 'sonner';
import { Search, Plus, Pencil, CalendarDays, Loader2, ReceiptIcon } from 'lucide-react';
import { format } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { dashboardService, type EventAttendanceResponse } from '@/services/dashboard.service';
import { getApiErrorMessage } from '@/services/api';

interface EventForm {
  name: string;
  description: string;
  eventDate: string;
  startDate: string;
  endDate: string;
  timeStart: string;
  timeEnd: string;
  status: boolean;
}

const EMPTY_FORM: EventForm = {
  name: '',
  description: '',
  eventDate: '',
  startDate: '',
  endDate: '',
  timeStart: '',
  timeEnd: '',
  status: true,
};

function formatDate(dateStr: string) {
  if (!dateStr) return '-';
  try {
    return format(new Date(dateStr + 'T00:00:00'), 'MMM d, yyyy');
  } catch {
    return dateStr;
  }
}

function formatTime(timeStr: string) {
  if (!timeStr) return '-';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${m} ${ampm}`;
}

function formatPaymentAmount(amount: string) {
  const n = parseFloat(amount);
  if (Number.isNaN(n)) return amount;
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function paymentStatusBadgeVariant(status: PaymentStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'verified') return 'default';
  if (status === 'rejected') return 'destructive';
  return 'secondary';
}

function paymentStudentLabel(p: Payment) {
  const s = p.student;
  if (!s) return '—';
  return `${s.first_name} ${s.last_name}`.trim();
}

export default function Events() {
  const queryClient = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'management' | 'attendance'>('management');
  const [paymentEventFilter, setPaymentEventFilter] = useState<'all' | string>('all');
  const [paymentPreview, setPaymentPreview] = useState<Payment | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [form, setForm] = useState<EventForm>(EMPTY_FORM);
  const [attendanceFrom, setAttendanceFrom] = useState(today);
  const [attendanceTo, setAttendanceTo] = useState(today);
  const [attendancePayload, setAttendancePayload] = useState<EventAttendanceResponse | null>(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: () => eventService.getEvents(),
  });

  const { data: eventPayments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ['payments', 'admin', 'events-page', paymentEventFilter],
    queryFn: () =>
      paymentService.listPayments(
        paymentEventFilter === 'all' ? undefined : { event_id: paymentEventFilter }
      ),
  });

  const createMutation = useMutation({
    mutationFn: (payload: EventCreatePayload) => eventService.createEvent(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event created successfully');
      closeDialog();
    },
    onError: (err: Error) => toast.error('Failed to create event', { description: err.message }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<EventCreatePayload> }) =>
      eventService.updateEvent(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event updated successfully');
      closeDialog();
    },
    onError: (err: Error) => toast.error('Failed to update event', { description: err.message }),
  });

  const filtered = events.filter((e) => {
    const q = search.toLowerCase();
    return (
      e.name.toLowerCase().includes(q) ||
      (e.description ?? '').toLowerCase().includes(q) ||
      e.startDate.includes(q) ||
      e.eventDate.includes(q)
    );
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (event: CalendarEvent) => {
    setEditing(event);
    setForm({
      name: event.name,
      description: event.description ?? '',
      eventDate: event.eventDate,
      startDate: event.startDate,
      endDate: event.endDate,
      timeStart: event.timeStart,
      timeEnd: event.timeEnd,
      status: event.status,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: EventCreatePayload = {
      name: form.name,
      description: form.description || undefined,
      eventDate: form.eventDate,
      startDate: form.startDate,
      endDate: form.endDate,
      timeStart: form.timeStart,
      timeEnd: form.timeEnd,
      status: form.status,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const loadAttendance = async () => {
    setAttendanceLoading(true);
    setAttendanceError(null);
    try {
      const data = await dashboardService.getAdminActiveEventAttendance({
        from: attendanceFrom,
        to: attendanceTo,
      });
      setAttendancePayload(data);
    } catch (e) {
      setAttendanceError(getApiErrorMessage(e, 'Failed to load event attendance.'));
      setAttendancePayload(null);
    } finally {
      setAttendanceLoading(false);
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex h-[80vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="mt-4 text-muted-foreground">Loading events...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="section-spacing">
        <div className="space-y-2 md:space-y-3">
          <div>
            <h1 className="page-header">Events</h1>
          </div>
          <div className="flex justify-end">
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Event
            </Button>
          </div>
        </div>
        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            const tab = value as 'management' | 'attendance';
            setActiveTab(tab);
            if (tab === 'attendance' && !attendancePayload && !attendanceLoading) {
              void loadAttendance();
            }
          }}
          defaultValue="management"
          className="space-y-4 md:space-y-6"
        >
          <TabsList className="h-auto w-full rounded-xl border border-primary/20 bg-card/60 p-1 backdrop-blur-sm sm:w-auto">
            <TabsTrigger
              value="management"
              className="rounded-lg px-4 py-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Event Management
            </TabsTrigger>
            <TabsTrigger
              value="attendance"
              className="rounded-lg px-4 py-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Event Attendance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="management" className="mt-0 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>All Events</CardTitle>
                    <CardDescription>
                      {events.length} event{events.length !== 1 ? 's' : ''}
                    </CardDescription>
                  </div>
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, description or date..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <CalendarDays className="h-12 w-12 text-muted-foreground/30" />
                    <p className="mt-3 text-base font-medium">
                      {events.length === 0 ? 'No events yet' : 'No events found'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {events.length === 0
                        ? 'Add your first event to get started'
                        : 'Try a different search'}
                    </p>
                    {events.length === 0 && (
                      <Button className="mt-4" onClick={openCreate}>
                        <Plus className="mr-2 h-4 w-4" /> Add Event
                      </Button>
                    )}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Event Date</TableHead>
                        <TableHead>Start</TableHead>
                        <TableHead>End</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((event) => (
                        <TableRow key={event.id}>
                          <TableCell className="font-medium">{event.name}</TableCell>
                          <TableCell>{formatDate(event.eventDate)}</TableCell>
                          <TableCell>{formatDate(event.startDate)}</TableCell>
                          <TableCell>{formatDate(event.endDate)}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                            {formatTime(event.timeStart)} – {formatTime(event.timeEnd)}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-muted-foreground">
                            {event.description || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={event.status ? 'default' : 'secondary'}>
                              {event.status ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(event)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ReceiptIcon className="h-5 w-5" aria-hidden />
                      Payments by event
                    </CardTitle>
                    <CardDescription>Student payment receipts linked to events. Use the filter to narrow by event.</CardDescription>
                  </div>
                  <div className="w-full sm:w-[260px]">
                    <Label htmlFor="payment-event-filter" className="sr-only">
                      Filter by event
                    </Label>
                    <Select
                      value={paymentEventFilter}
                      onValueChange={(v) => setPaymentEventFilter(v)}
                    >
                      <SelectTrigger id="payment-event-filter">
                        <SelectValue placeholder="All Events" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Events</SelectItem>
                        {events.map((ev) => (
                          <SelectItem key={ev.id} value={ev.id}>
                            {ev.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {paymentsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading payments…
                  </div>
                ) : eventPayments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No payment submissions for this filter.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">Receipt</TableHead>
                        <TableHead>Student</TableHead>
                        <TableHead>Event</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Purpose</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Submitted</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {eventPayments.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>
                            <button
                              type="button"
                              onClick={() => setPaymentPreview(p)}
                              className="rounded-md border overflow-hidden w-16 h-16 bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                              <img
                                src={getAvatarUrl(p.image_url)}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            </button>
                          </TableCell>
                          <TableCell className="font-medium">{paymentStudentLabel(p)}</TableCell>
                          <TableCell className="max-w-[200px] whitespace-normal">
                            {p.event?.name ?? '—'}
                          </TableCell>
                          <TableCell>{formatPaymentAmount(p.amount)}</TableCell>
                          <TableCell className="max-w-[200px] whitespace-normal text-sm">{p.purpose}</TableCell>
                          <TableCell>
                            <Badge variant={paymentStatusBadgeVariant(p.status)}>
                              {formatPaymentStatusLabel(p.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                            {format(new Date(p.created_at), 'MMM d, yyyy')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="attendance" className="mt-0 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Event Attendance Viewer</CardTitle>
                <CardDescription>Current active event student logs grouped per section.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 md:flex-row md:items-end">
                <div className="space-y-1">
                  <Label htmlFor="attendance-from">From</Label>
                  <Input
                    id="attendance-from"
                    type="date"
                    value={attendanceFrom}
                    onChange={(e) => setAttendanceFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="attendance-to">To</Label>
                  <Input
                    id="attendance-to"
                    type="date"
                    value={attendanceTo}
                    onChange={(e) => setAttendanceTo(e.target.value)}
                  />
                </div>
                <Button type="button" onClick={() => void loadAttendance()} disabled={attendanceLoading}>
                  {attendanceLoading ? 'Loading...' : 'Refresh'}
                </Button>
              </CardContent>
            </Card>

            {attendanceError && <p className="text-sm text-destructive">{attendanceError}</p>}

            {attendancePayload?.active_event ? (
              <Card>
                <CardHeader>
                  <CardTitle>{attendancePayload.active_event.name}</CardTitle>
                  <CardDescription>
                    Active window: {attendancePayload.active_event.startDate} to {attendancePayload.active_event.endDate}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Badge variant="outline">Sections {attendancePayload.totals.sections}</Badge>
                  <Badge variant="outline">Students {attendancePayload.totals.students}</Badge>
                  <Badge variant="outline">Logs {attendancePayload.totals.logs}</Badge>
                  <Badge variant="outline">IN {attendancePayload.totals.time_in}</Badge>
                  <Badge variant="outline">OUT {attendancePayload.totals.time_out}</Badge>
                </CardContent>
              </Card>
            ) : null}

            {attendancePayload?.note && (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  {attendancePayload.note}
                </CardContent>
              </Card>
            )}

            {attendancePayload?.sections?.map((section) => (
              <Card key={section.section_id}>
                <CardHeader>
                  <CardTitle>
                    {section.section_name || 'Unnamed Section'}{' '}
                    <span className="font-normal text-muted-foreground">({section.section_code || '—'})</span>
                  </CardTitle>
                  <CardDescription>
                    Students {section.totals.students} · Logs {section.totals.logs} · IN {section.totals.time_in} · OUT{' '}
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
                        {section.students.map((student) => (
                          <TableRow key={student.student_id}>
                            <TableCell className="font-medium">{student.full_name}</TableCell>
                            <TableCell>{student.student_number || '—'}</TableCell>
                            <TableCell>{student.time_in_count}</TableCell>
                            <TableCell>{student.time_out_count}</TableCell>
                            <TableCell>
                              {student.last_log_type || '—'} ·{' '}
                              {student.last_log_at ? format(new Date(student.last_log_at), 'MMM d, yyyy h:mm a') : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!paymentPreview} onOpenChange={(open) => !open && setPaymentPreview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Receipt</DialogTitle>
            <DialogDescription>
              {paymentPreview?.event?.name ? `Event: ${paymentPreview.event.name}` : 'Payment receipt'}
            </DialogDescription>
          </DialogHeader>
          {paymentPreview && (
            <img
              src={getAvatarUrl(paymentPreview.image_url)}
              alt="Receipt"
              className="w-full rounded-md border"
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Event' : 'Add Event'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Update event details.' : 'Fill in the details to create a new event.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name <span className="text-destructive">*</span></Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Foundation Day"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date <span className="text-destructive">*</span></Label>
                <Input
                  id="startDate"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setForm((f) => ({
                      ...f,
                      startDate: val,
                      eventDate: f.eventDate || val,
                      endDate: f.endDate && f.endDate >= val ? f.endDate : val,
                    }));
                  }}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date <span className="text-destructive">*</span></Label>
                <Input
                  id="endDate"
                  type="date"
                  value={form.endDate}
                  min={form.startDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="eventDate">Event Date <span className="text-destructive">*</span></Label>
              <Input
                id="eventDate"
                type="date"
                value={form.eventDate}
                onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
                required
              />
              <p className="text-xs text-muted-foreground">Primary date used for calendar display</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="timeStart">Start Time <span className="text-destructive">*</span></Label>
                <Input
                  id="timeStart"
                  type="time"
                  value={form.timeStart}
                  onChange={(e) => setForm({ ...form, timeStart: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timeEnd">End Time <span className="text-destructive">*</span></Label>
                <Input
                  id="timeEnd"
                  type="time"
                  value={form.timeEnd}
                  onChange={(e) => setForm({ ...form, timeEnd: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="status"
                checked={form.status}
                onCheckedChange={(checked) => setForm({ ...form, status: checked })}
              />
              <Label htmlFor="status">Active</Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving...' : editing ? 'Save Changes' : 'Create Event'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
