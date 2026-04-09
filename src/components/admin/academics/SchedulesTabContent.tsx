import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { Badge } from '@/components/ui/badge';
import { FilterX, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { courseService } from '@/services/course.service';
import { teacherService, type SectionSubjectAssignmentRow } from '@/services/teacher.service';
import { subjectService, formatSubjectYear } from '@/services/subject.service';
import {
  studentSubjectAssignmentService,
  type AdminStudentSubjectAssignmentRow,
} from '@/services/student-subject-assignment.service';
import { useClientPagination } from '@/hooks/useClientPagination';
import { TablePaginationControls } from '@/components/TablePaginationControls';
import { Input } from '@/components/ui/input';
import { sectionService, type SectionScheduleWeekday } from '@/services/section.service';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { getApiErrorMessage } from '@/services/api';
import {
  assignmentsPayloadFromGrouped,
  buildGroupedFromSectionTeachers,
  mergeScheduleIntoGrouped,
  type ScheduleSlot,
} from '@/components/admin/academics/schedules-tab-utils';

function formatScheduleDays(days: string[] | null | undefined): string {
  if (!days?.length) return '—';
  return days.join(', ');
}

function teacherName(t: { firstName: string; middleName?: string | null; lastName: string } | null | undefined): string {
  if (!t) return '—';
  return [t.firstName, t.middleName, t.lastName].filter(Boolean).join(' ');
}

function studentDisplayName(
  s: { firstName: string; middleName?: string | null; lastName: string } | null | undefined,
): string {
  if (!s) return '—';
  return [s.firstName, s.middleName, s.lastName].filter(Boolean).join(' ');
}

function scheduleLine(row: {
  daysOfWeek?: string[] | null;
  startTime?: string | null;
  endTime?: string | null;
}): string {
  const days = formatScheduleDays(row.daysOfWeek ?? undefined);
  const t =
    row.startTime && row.endTime ? `${row.startTime}–${row.endTime}` : row.startTime || row.endTime || '—';
  if (days === '—' && t === '—') return '—';
  return `${days} · ${t}`;
}

function sanitizeScheduleErrorMessage(message: string): string {
  if (!message) return message;
  const withoutMarkers = message.replace(/\[(conflictType|subjectId|teacherId)=[^\]]+\]/g, '').trim();
  return withoutMarkers.replace(/\s{2,}/g, ' ');
}

type FilterKey = 'all' | string;
const WEEKDAYS: SectionScheduleWeekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type AddScheduleForm = {
  teacherId: string;
  sectionId: string;
  subjectId: string;
  daysOfWeek: SectionScheduleWeekday[];
  startTime: string;
  endTime: string;
};

const EMPTY_ADD_FORM: AddScheduleForm = {
  teacherId: '',
  sectionId: '',
  subjectId: '',
  daysOfWeek: ['Mon'],
  startTime: '08:00',
  endTime: '09:00',
};

const EMPTY_EDIT_SCHEDULE: ScheduleSlot = {
  daysOfWeek: ['Mon'],
  startTime: '08:00',
  endTime: '09:00',
};

const toMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

function buildScheduleQueryParams(courseId: FilterKey, teacherId: FilterKey, subjectId: FilterKey) {
  const params: {
    active: boolean;
    courseId?: string;
    teacherId?: string;
    subjectId?: string;
  } = { active: true };
  if (courseId !== 'all') params.courseId = courseId;
  if (teacherId !== 'all') params.teacherId = teacherId;
  if (subjectId !== 'all') params.subjectId = subjectId;
  return params;
}

export function SchedulesTabContent() {
  const queryClient = useQueryClient();
  const [courseId, setCourseId] = useState<FilterKey>('all');
  const [teacherId, setTeacherId] = useState<FilterKey>('all');
  const [subjectId, setSubjectId] = useState<FilterKey>('all');
  const [subjectSearch, setSubjectSearch] = useState('');
  const [addScheduleOpen, setAddScheduleOpen] = useState(false);
  const [addForm, setAddForm] = useState<AddScheduleForm>(EMPTY_ADD_FORM);
  const [addFormError, setAddFormError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<SectionSubjectAssignmentRow | null>(null);
  const [editScheduleOpen, setEditScheduleOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SectionSubjectAssignmentRow | null>(null);
  const [editForm, setEditForm] = useState<ScheduleSlot>(EMPTY_EDIT_SCHEDULE);
  const [editFormError, setEditFormError] = useState<string | null>(null);

  const [sectionPageIndex, setSectionPageIndex] = useState(0);
  const [sectionPageSize, setSectionPageSize] = useState(10);
  const [overridePageIndex, setOverridePageIndex] = useState(0);
  const [overridePageSize, setOverridePageSize] = useState(10);

  const scheduleParams = useMemo(
    () => buildScheduleQueryParams(courseId, teacherId, subjectId),
    [courseId, teacherId, subjectId],
  );

  const { data: courses = [] } = useQuery({
    queryKey: ['courses', { active: true }],
    queryFn: () => courseService.getCourses({ active: true }),
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers', { active: true }],
    queryFn: () => teacherService.getTeachers({ active: true }),
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects', { active: true }],
    queryFn: () => subjectService.getSubjects({ active: true }),
  });
  const { data: sections = [] } = useQuery({
    queryKey: ['sections', { active: true }],
    queryFn: () => sectionService.getSections({ active: true }),
  });

  const { data: sectionRows = [], isLoading: sectionLoading } = useQuery({
    queryKey: ['section-subject-assignments', 'schedules-tab', scheduleParams],
    queryFn: () => teacherService.getAllSectionSubjectAssignments(scheduleParams),
  });

  const { data: overrideRows = [], isLoading: overrideLoading } = useQuery({
    queryKey: ['admin-student-subject-assignments', scheduleParams],
    queryFn: () => studentSubjectAssignmentService.listForAdmin(scheduleParams),
  });

  const selectedSection = useMemo(
    () => sections.find((s) => s.id === addForm.sectionId) || null,
    [sections, addForm.sectionId],
  );

  const { data: sectionScopedSubjects = [] } = useQuery({
    queryKey: ['subjects', { active: true, courseId: selectedSection?.courseId }],
    queryFn: () => subjectService.getSubjects({ active: true, courseId: selectedSection!.courseId }),
    enabled: addScheduleOpen && Boolean(selectedSection?.courseId),
  });

  const invalidateScheduleQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['section-subject-assignments'] });
    queryClient.invalidateQueries({ queryKey: ['admin-student-subject-assignments'] });
    queryClient.invalidateQueries({ queryKey: ['sections'] });
  };

  const removeSectionScheduleMutation = useMutation({
    mutationFn: ({ sectionId, subjectId: sid, teacherId: tid }: { sectionId: string; subjectId: string; teacherId: string }) =>
      sectionService.removeSectionSubjectTeacher(sectionId, sid, tid),
    onSuccess: () => {
      toast.success('Section schedule removed');
      setRemoveTarget(null);
      invalidateScheduleQueries();
    },
    onError: (err: unknown) => {
      const message = sanitizeScheduleErrorMessage(
        getApiErrorMessage(err, 'Unable to remove section schedule.'),
      );
      toast.error('Failed to remove schedule', { description: message });
    },
  });

  const addScheduleMutation = useMutation({
    mutationFn: async (form: AddScheduleForm) => {
      const existing = await sectionService.getSectionSubjectTeachers(form.sectionId, { active: true });
      const grouped = buildGroupedFromSectionTeachers(existing);
      mergeScheduleIntoGrouped(grouped, form.subjectId, form.teacherId, {
        daysOfWeek: form.daysOfWeek,
        startTime: form.startTime,
        endTime: form.endTime,
      });
      const assignments = assignmentsPayloadFromGrouped(grouped);
      return sectionService.assignSectionSubjectTeachers(form.sectionId, { assignments });
    },
    onSuccess: () => {
      toast.success('Schedule added');
      setAddScheduleOpen(false);
      setAddForm(EMPTY_ADD_FORM);
      setAddFormError(null);
      invalidateScheduleQueries();
    },
    onError: (err: unknown) => {
      const message = sanitizeScheduleErrorMessage(
        getApiErrorMessage(err, 'Unable to add section schedule.'),
      );
      setAddFormError(message);
      toast.error('Failed to add schedule', { description: message });
    },
  });

  const editScheduleMutation = useMutation({
    mutationFn: async ({ row, schedule }: { row: SectionSubjectAssignmentRow; schedule: ScheduleSlot }) => {
      const existing = await sectionService.getSectionSubjectTeachers(row.sectionId, { active: true });
      const grouped = buildGroupedFromSectionTeachers(existing);
      mergeScheduleIntoGrouped(grouped, row.subjectId, row.teacherId, schedule);
      const assignments = assignmentsPayloadFromGrouped(grouped);
      return sectionService.assignSectionSubjectTeachers(row.sectionId, { assignments });
    },
    onSuccess: () => {
      toast.success('Schedule updated');
      setEditScheduleOpen(false);
      setEditTarget(null);
      setEditForm(EMPTY_EDIT_SCHEDULE);
      setEditFormError(null);
      invalidateScheduleQueries();
    },
    onError: (err: unknown) => {
      const message = sanitizeScheduleErrorMessage(
        getApiErrorMessage(err, 'Unable to update section schedule.'),
      );
      setEditFormError(message);
      toast.error('Failed to update schedule', { description: message });
    },
  });

  const scheduleMutationPending = addScheduleMutation.isPending || editScheduleMutation.isPending;

  useEffect(() => {
    setSectionPageIndex(0);
    setOverridePageIndex(0);
  }, [courseId, teacherId, subjectId]);

  const filteredSubjects = useMemo(() => {
    const q = subjectSearch.trim().toLowerCase();
    if (!q) return subjects;
    return subjects.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        (formatSubjectYear(s.year ?? null) || '').toLowerCase().includes(q),
    );
  }, [subjects, subjectSearch]);

  const sectionPagination = useClientPagination(sectionRows, sectionPageIndex, sectionPageSize);
  const overridePagination = useClientPagination(overrideRows, overridePageIndex, overridePageSize);

  useEffect(() => {
    if (sectionPageIndex !== sectionPagination.pageIndex) setSectionPageIndex(sectionPagination.pageIndex);
  }, [sectionPageIndex, sectionPagination.pageIndex]);

  useEffect(() => {
    if (overridePageIndex !== overridePagination.pageIndex) setOverridePageIndex(overridePagination.pageIndex);
  }, [overridePageIndex, overridePagination.pageIndex]);

  const clearFilters = () => {
    setCourseId('all');
    setTeacherId('all');
    setSubjectId('all');
    setSubjectSearch('');
  };

  const hasActiveFilters = courseId !== 'all' || teacherId !== 'all' || subjectId !== 'all';

  const clearAddFormError = () => setAddFormError(null);

  const toggleAddDay = (day: SectionScheduleWeekday, checked: boolean | 'indeterminate') => {
    clearAddFormError();
    setAddForm((prev) => {
      const has = prev.daysOfWeek.includes(day);
      let nextDays = prev.daysOfWeek;
      if (checked && !has) nextDays = [...prev.daysOfWeek, day];
      if (!checked && has) nextDays = prev.daysOfWeek.filter((d) => d !== day);
      return { ...prev, daysOfWeek: nextDays };
    });
  };

  const clearEditFormError = () => setEditFormError(null);

  const toggleEditDay = (day: SectionScheduleWeekday, checked: boolean | 'indeterminate') => {
    clearEditFormError();
    setEditForm((prev) => {
      const has = prev.daysOfWeek.includes(day);
      let nextDays = prev.daysOfWeek;
      if (checked && !has) nextDays = [...prev.daysOfWeek, day];
      if (!checked && has) nextDays = prev.daysOfWeek.filter((d) => d !== day);
      return { ...prev, daysOfWeek: nextDays };
    });
  };

  const openEditSchedule = (row: SectionSubjectAssignmentRow) => {
    setEditTarget(row);
    setEditForm({
      daysOfWeek: (row.daysOfWeek && row.daysOfWeek.length > 0 ? row.daysOfWeek : ['Mon']) as SectionScheduleWeekday[],
      startTime: (row.startTime || '08:00').slice(0, 5),
      endTime: (row.endTime || '09:00').slice(0, 5),
    });
    setEditFormError(null);
    setEditScheduleOpen(true);
  };

  const submitEditSchedule = () => {
    clearEditFormError();
    if (!editTarget) {
      setEditFormError('No schedule selected.');
      return;
    }
    if (editForm.daysOfWeek.length === 0) {
      setEditFormError('Please select at least one class day.');
      return;
    }
    if (!editForm.startTime || !editForm.endTime) {
      setEditFormError('Please set both start and end time.');
      return;
    }
    const startM = toMinutes(editForm.startTime);
    const endM = toMinutes(editForm.endTime);
    if (Number.isNaN(startM) || Number.isNaN(endM) || endM <= startM) {
      setEditFormError('End time must be later than start time.');
      return;
    }
    editScheduleMutation.mutate({ row: editTarget, schedule: { ...editForm } });
  };

  const submitAddSchedule = () => {
    clearAddFormError();
    if (!addForm.teacherId) {
      setAddFormError('Please select a teacher.');
      return;
    }
    if (!addForm.sectionId) {
      setAddFormError('Please select a section.');
      return;
    }
    if (!addForm.subjectId) {
      setAddFormError('Please select a subject.');
      return;
    }
    if (addForm.daysOfWeek.length === 0) {
      setAddFormError('Please select at least one class day.');
      return;
    }
    if (!addForm.startTime || !addForm.endTime) {
      setAddFormError('Please set both start and end time.');
      return;
    }
    const startM = toMinutes(addForm.startTime);
    const endM = toMinutes(addForm.endTime);
    if (Number.isNaN(startM) || Number.isNaN(endM) || endM <= startM) {
      setAddFormError('End time must be later than start time.');
      return;
    }
    addScheduleMutation.mutate(addForm);
  };

  return (
    <div className="section-spacing space-y-6">
      <div className="space-y-2 md:space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="page-header">Schedules</h1>
          </div>
          <Button type="button" onClick={() => setAddScheduleOpen(true)} disabled={scheduleMutationPending}>
            <Plus className="mr-2 h-4 w-4" />
            Add Schedule
          </Button>
        </div>
      </div>

      <Card className="border-primary/15">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Filter both tables by course, teacher, and subject.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <span className="text-sm font-medium">Course</span>
              <Select value={courseId} onValueChange={(v) => setCourseId(v as FilterKey)}>
                <SelectTrigger>
                  <SelectValue placeholder="All courses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All courses</SelectItem>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium">Teacher</span>
              <Select value={teacherId} onValueChange={(v) => setTeacherId(v as FilterKey)}>
                <SelectTrigger>
                  <SelectValue placeholder="All teachers" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="all">All teachers</SelectItem>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {teacherName(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2 lg:col-span-1">
              <span className="text-sm font-medium">Subject</span>
              <Select value={subjectId} onValueChange={(v) => setSubjectId(v as FilterKey)}>
                <SelectTrigger>
                  <SelectValue placeholder="All subjects" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <div className="sticky top-0 z-10 border-b bg-popover p-2">
                    <Input
                      placeholder="Search subjects…"
                      value={subjectSearch}
                      onChange={(e) => setSubjectSearch(e.target.value)}
                      className="h-8"
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                  <SelectItem value="all">All subjects</SelectItem>
                  {filteredSubjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.code}){s.year ? ` · ${formatSubjectYear(s.year)}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {hasActiveFilters && (
            <div>
              <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                <FilterX className="mr-2 h-4 w-4" />
                Clear filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Section class schedules</CardTitle>
          <CardDescription>
            Active assignments from section subject teachers ({sectionRows.length} row
            {sectionRows.length !== 1 ? 's' : ''}).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sectionLoading ? (
            <p className="text-sm text-muted-foreground">Loading section schedules…</p>
          ) : sectionRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {hasActiveFilters
                ? 'No section schedules match the current filters.'
                : 'No section schedules have been configured yet.'}
            </p>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Course</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Teacher</TableHead>
                      <TableHead>Days</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sectionPagination.pageItems.map((row: SectionSubjectAssignmentRow) => (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap">
                          {row.section?.course?.name ?? '—'}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{row.section?.name ?? '—'}</div>
                          <div className="text-xs text-muted-foreground">{row.section?.code}</div>
                        </TableCell>
                        <TableCell>
                          <div>{row.subject?.name ?? '—'}</div>
                          <div className="text-xs text-muted-foreground">{row.subject?.code}</div>
                        </TableCell>
                        <TableCell>{teacherName(row.teacher)}</TableCell>
                        <TableCell className="max-w-[140px] text-sm">
                          {formatScheduleDays(row.daysOfWeek ?? undefined)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {row.startTime && row.endTime ? `${row.startTime}–${row.endTime}` : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => openEditSchedule(row)}
                              disabled={scheduleMutationPending || removeSectionScheduleMutation.isPending}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              onClick={() => setRemoveTarget(row)}
                              disabled={scheduleMutationPending || removeSectionScheduleMutation.isPending}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Remove
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <TablePaginationControls
                pageIndex={sectionPagination.pageIndex}
                pageSize={sectionPagination.pageSize}
                totalItems={sectionPagination.totalItems}
                onPageIndexChange={setSectionPageIndex}
                onPageSizeChange={(size) => {
                  setSectionPageSize(size);
                  setSectionPageIndex(0);
                }}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Student schedule overrides</CardTitle>
          <CardDescription>
            Irregular / ADD, REMOVE, and REPLACE rules ({overrideRows.length} row
            {overrideRows.length !== 1 ? 's' : ''}).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {overrideLoading ? (
            <p className="text-sm text-muted-foreground">Loading student overrides…</p>
          ) : overrideRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {hasActiveFilters
                ? 'No student overrides match the current filters.'
                : 'No active student schedule overrides.'}
            </p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Teacher</TableHead>
                      <TableHead>Schedule</TableHead>
                      <TableHead>Effective</TableHead>
                      <TableHead>Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overridePagination.pageItems.map((row: AdminStudentSubjectAssignmentRow) => (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap font-medium">
                          {studentDisplayName(row.enrollment?.student)}
                        </TableCell>
                        <TableCell className="max-w-[160px]">
                          {row.enrollment?.course?.name ?? '—'}
                        </TableCell>
                        <TableCell>
                          <div>{row.enrollment?.section?.name ?? row.section?.name ?? '—'}</div>
                          <div className="text-xs text-muted-foreground">
                            {row.enrollment?.section?.code ?? row.section?.code ?? ''}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={row.assignmentType === 'REMOVE' ? 'destructive' : 'secondary'}>
                            {row.assignmentType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>{row.subject?.name ?? '—'}</div>
                          <div className="text-xs text-muted-foreground">{row.subject?.code ?? ''}</div>
                        </TableCell>
                        <TableCell>{teacherName(row.teacher)}</TableCell>
                        <TableCell className="max-w-[200px] text-sm">
                          {scheduleLine(row)}
                          {row.baseAssignment && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              Base: {scheduleLine(row.baseAssignment)}
                            </div>
                          )}
                          {row.assignment && row.assignmentType === 'REPLACE' && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              Target SST: {scheduleLine(row.assignment)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {row.effectiveFrom ?? '—'} → {row.effectiveTo ?? '—'}
                        </TableCell>
                        <TableCell className="max-w-[200px] text-sm text-muted-foreground">
                          {row.remarks ?? '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <TablePaginationControls
                pageIndex={overridePagination.pageIndex}
                pageSize={overridePagination.pageSize}
                totalItems={overridePagination.totalItems}
                onPageIndexChange={setOverridePageIndex}
                onPageSizeChange={(size) => {
                  setOverridePageSize(size);
                  setOverridePageIndex(0);
                }}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={addScheduleOpen}
        onOpenChange={(open) => {
          setAddScheduleOpen(open);
          if (!open) {
            setAddForm(EMPTY_ADD_FORM);
            setAddFormError(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Section Schedule</DialogTitle>
            <DialogDescription>
              Teacher-first method: choose teacher, section, subject, days, and time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Teacher</Label>
                <Select
                  value={addForm.teacherId}
                  onValueChange={(v) => {
                    clearAddFormError();
                    setAddForm((prev) => ({ ...prev, teacherId: v }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select teacher" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {teachers.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {teacherName(t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Section</Label>
                <Select
                  value={addForm.sectionId}
                  onValueChange={(v) => {
                    clearAddFormError();
                    setAddForm((prev) => ({
                      ...prev,
                      sectionId: v,
                      subjectId: '',
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select section" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {sections.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Subject</Label>
              <Select
                value={addForm.subjectId}
                onValueChange={(v) => {
                  clearAddFormError();
                  setAddForm((prev) => ({ ...prev, subjectId: v }));
                }}
                disabled={!selectedSection}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedSection ? 'Select subject' : 'Select section first'} />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {sectionScopedSubjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.code}){s.year ? ` · ${formatSubjectYear(s.year)}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedSection && sectionScopedSubjects.length === 0 && (
                <p className="text-xs text-muted-foreground">No active subjects are linked to this section course.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Days</Label>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-7">
                {WEEKDAYS.map((day) => (
                  <label
                    key={day}
                    className="flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs leading-none sm:text-sm"
                  >
                    <Checkbox
                      checked={addForm.daysOfWeek.includes(day)}
                      onCheckedChange={(checked) => toggleAddDay(day, checked)}
                    />
                    <span className="font-medium">{day}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Start time</Label>
                <Input
                  type="time"
                  value={addForm.startTime}
                  onChange={(e) => {
                    clearAddFormError();
                    setAddForm((prev) => ({ ...prev, startTime: e.target.value }));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>End time</Label>
                <Input
                  type="time"
                  value={addForm.endTime}
                  onChange={(e) => {
                    clearAddFormError();
                    setAddForm((prev) => ({ ...prev, endTime: e.target.value }));
                  }}
                />
              </div>
            </div>

            {addFormError && (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {addFormError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddScheduleOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={submitAddSchedule} disabled={scheduleMutationPending}>
              {addScheduleMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editScheduleOpen}
        onOpenChange={(open) => {
          setEditScheduleOpen(open);
          if (!open) {
            setEditTarget(null);
            setEditForm(EMPTY_EDIT_SCHEDULE);
            setEditFormError(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit section schedule</DialogTitle>
            <DialogDescription>
              Update class days and time. Section, subject, and teacher stay the same.
            </DialogDescription>
          </DialogHeader>
          {editTarget && (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Section: </span>
                  <span className="font-medium">{editTarget.section?.name ?? '—'}</span>
                  {editTarget.section?.code ? (
                    <span className="text-muted-foreground"> ({editTarget.section.code})</span>
                  ) : null}
                </div>
                <div className="mt-1">
                  <span className="text-muted-foreground">Subject: </span>
                  <span className="font-medium">{editTarget.subject?.name ?? '—'}</span>
                  {editTarget.subject?.code ? (
                    <span className="text-muted-foreground"> ({editTarget.subject.code})</span>
                  ) : null}
                </div>
                <div className="mt-1">
                  <span className="text-muted-foreground">Teacher: </span>
                  <span className="font-medium">{teacherName(editTarget.teacher)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Days</Label>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-7">
                  {WEEKDAYS.map((day) => (
                    <label
                      key={day}
                      className="flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs leading-none sm:text-sm"
                    >
                      <Checkbox
                        checked={editForm.daysOfWeek.includes(day)}
                        onCheckedChange={(checked) => toggleEditDay(day, checked)}
                      />
                      <span className="font-medium">{day}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Start time</Label>
                  <Input
                    type="time"
                    value={editForm.startTime}
                    onChange={(e) => {
                      clearEditFormError();
                      setEditForm((prev) => ({ ...prev, startTime: e.target.value }));
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End time</Label>
                  <Input
                    type="time"
                    value={editForm.endTime}
                    onChange={(e) => {
                      clearEditFormError();
                      setEditForm((prev) => ({ ...prev, endTime: e.target.value }));
                    }}
                  />
                </div>
              </div>

              {editFormError && (
                <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {editFormError}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditScheduleOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={submitEditSchedule} disabled={!editTarget || editScheduleMutation.isPending}>
              {editScheduleMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(removeTarget)} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove section schedule?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the active schedule mapping for{' '}
              <strong>{removeTarget?.subject?.name ?? 'subject'}</strong>{' '}
              and <strong>{teacherName(removeTarget?.teacher)}</strong> in{' '}
              <strong>{removeTarget?.section?.name ?? 'this section'}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeSectionScheduleMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (!removeTarget) return;
                removeSectionScheduleMutation.mutate({
                  sectionId: removeTarget.sectionId,
                  subjectId: removeTarget.subjectId,
                  teacherId: removeTarget.teacherId,
                });
              }}
              disabled={removeSectionScheduleMutation.isPending}
            >
              {removeSectionScheduleMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
