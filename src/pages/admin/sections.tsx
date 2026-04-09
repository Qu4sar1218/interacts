import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Plus, Pencil, Layers, Link2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { courseService } from '@/services/course.service';
import {
  sectionService,
  type Section,
  type SectionPayload,
  type SectionScheduleWeekday,
  type SectionSubjectTeacherAssignmentPayload,
  type YearLevel,
} from '@/services/section.service';
import {
  formatSubjectYear,
  subjectService,
  SUBJECT_YEARS,
  SUBJECT_YEAR_FILTER_OPTIONS,
  type Subject,
  type SubjectYear,
} from '@/services/subject.service';
import { teacherService, type Teacher } from '@/services/teacher.service';
import { cn } from '@/lib/utils';
import { getApiErrorMessage } from '@/services/api';
import { YEAR_LEVELS } from '@/constants/year-level';
import { useClientPagination } from '@/hooks/useClientPagination';
import { TablePaginationControls } from '@/components/TablePaginationControls';
const EMPTY_FORM: SectionPayload = { name: '', code: '', description: '', courseId: '', yearLevel: 'Year 1', active: true, note: '' };
const formatCourseOptionLabel = (course: { name: string; yearLevel?: string }) =>
  course.yearLevel ? `${course.name} - ${course.yearLevel}` : course.name;

const WEEKDAYS: SectionScheduleWeekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAY_LABELS = ['M', 'T', 'W', 'TH', 'F', 'SA', 'SU'] as const;
const OVERLAP_THRESHOLD_MINUTES = 5;

type TeacherScheduleForm = {
  daysOfWeek: SectionScheduleWeekday[];
  startTime: string;
  endTime: string;
};

type RowErrorMap = Record<string, Record<string, string>>;
type SubjectOption = Pick<Subject, 'id' | 'name' | 'code' | 'year'>;

const defaultTeacherSchedule = (): TeacherScheduleForm => ({
  daysOfWeek: ['Mon'],
  startTime: '08:00',
  endTime: '09:00',
});

const formatTimeForInput = (s: string | null | undefined): string => {
  if (!s) return '08:00';
  const t = String(s).trim();
  if (t.length >= 5) return t.slice(0, 5);
  return '08:00';
};

const getAssignmentErrorMessage = (error: unknown): string => {
  if (isAxiosError(error)) {
    const apiErr = (error.response?.data as { error?: unknown } | undefined)?.error;
    if (typeof apiErr === 'string' && apiErr.trim().length > 0) {
      return apiErr;
    }
  }
  return getApiErrorMessage(error, 'Failed to update section subject assignments');
};

const isSubjectYear = (value: string | null | undefined): value is SubjectYear =>
  Boolean(value && SUBJECT_YEARS.includes(value as SubjectYear));

export function SectionsTabContent() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [yearLevelFilter, setYearLevelFilter] = useState<'all' | YearLevel>('all');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [subjectDialogOpen, setSubjectDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Section | null>(null);
  const [selectedSection, setSelectedSection] = useState<Section | null>(null);
  const [form, setForm] = useState<SectionPayload>(EMPTY_FORM);
  const [subjectSearch, setSubjectSearch] = useState('');
  const [subjectYearFilter, setSubjectYearFilter] = useState<'all' | SubjectYear>('all');
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [assignedSubjectsById, setAssignedSubjectsById] = useState<Record<string, SubjectOption>>({});
  /** Per subject, per teacher: weekly schedule (only checked teachers have keys) */
  const [scheduleBySubject, setScheduleBySubject] = useState<Record<string, Record<string, TeacherScheduleForm>>>({});
  const [eligibleTeachersBySubject, setEligibleTeachersBySubject] = useState<Record<string, Teacher[]>>({});
  const [loadingTeachersBySubject, setLoadingTeachersBySubject] = useState<Record<string, boolean>>({});
  const [assignmentDialogError, setAssignmentDialogError] = useState<string | null>(null);
  const [rowErrorsBySubject, setRowErrorsBySubject] = useState<RowErrorMap>({});

  const clearDialogErrors = () => {
    setAssignmentDialogError(null);
    setRowErrorsBySubject({});
  };

  const clearRowError = (subjectId: string, teacherId: string) => {
    setRowErrorsBySubject((prev) => {
      if (!prev[subjectId]?.[teacherId]) return prev;
      const subjectRows = { ...(prev[subjectId] || {}) };
      delete subjectRows[teacherId];
      const next = { ...prev };
      if (Object.keys(subjectRows).length === 0) {
        delete next[subjectId];
      } else {
        next[subjectId] = subjectRows;
      }
      return next;
    });
  };

  const applyConflictMarkersFromMessage = (message: string) => {
    const markerRe = /\[(teacherId|subjectId)=([^\]]+)\]/g;
    const teacherIds = new Set<string>();
    const subjectIds = new Set<string>();
    let m: RegExpExecArray | null = markerRe.exec(message);
    while (m) {
      if (m[1] === 'teacherId') teacherIds.add(m[2]);
      if (m[1] === 'subjectId') subjectIds.add(m[2]);
      m = markerRe.exec(message);
    }
    if (teacherIds.size === 0 || subjectIds.size === 0) return;

    setRowErrorsBySubject((prev) => {
      const next: RowErrorMap = { ...prev };
      for (const subjectId of subjectIds) {
        for (const teacherId of teacherIds) {
          if (!scheduleBySubject[subjectId]?.[teacherId]) continue;
          next[subjectId] = {
            ...(next[subjectId] || {}),
            [teacherId]: message
          };
        }
      }
      return next;
    });
  };

  const toMinutes = (time: string): number => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  const hasSharedDay = (a: SectionScheduleWeekday[], b: SectionScheduleWeekday[]) => a.some((day) => b.includes(day));

  const { data: sections = [], isLoading } = useQuery({
    queryKey: ['sections', { yearLevel: yearLevelFilter }],
    queryFn: () =>
      sectionService.getSections({
        ...(yearLevelFilter !== 'all' ? { yearLevel: yearLevelFilter } : {})
      }),
  });
  const { data: courses = [] } = useQuery({
    queryKey: ['courses'],
    queryFn: () => courseService.getCourses({ active: true }),
  });
  const selectedCourseId = selectedSection?.courseId;
  const { data: courseSubjects = [] } = useQuery({
    queryKey: ['subjects', { active: true, courseId: selectedCourseId }],
    queryFn: () => subjectService.getSubjects({ active: true, courseId: selectedCourseId }),
    enabled: Boolean(subjectDialogOpen && selectedCourseId),
  });

  const createMutation = useMutation({
    mutationFn: (payload: SectionPayload) => sectionService.createSection(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sections'] });
      toast.success('Section created successfully');
      closeDialog();
    },
    onError: (err: Error) => toast.error('Failed to create section', { description: err.message }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<SectionPayload> }) => sectionService.updateSection(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sections'] });
      toast.success('Section updated successfully');
      closeDialog();
    },
    onError: (err: Error) => toast.error('Failed to update section', { description: err.message }),
  });
  const assignSectionSubjectTeachersMutation = useMutation({
    mutationFn: ({
      sectionId,
      assignments,
    }: {
      sectionId: string;
      assignments: SectionSubjectTeacherAssignmentPayload['assignments'];
    }) => sectionService.assignSectionSubjectTeachers(sectionId, { assignments }),
    onSuccess: () => {
      toast.success('Section subject assignments updated successfully');
      queryClient.invalidateQueries({ queryKey: ['sections'] });
      queryClient.invalidateQueries({ queryKey: ['section-subject-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['admin-student-subject-assignments'] });
      closeSubjectDialog();
    },
    onError: (err: unknown) => {
      const message = getAssignmentErrorMessage(err);
      setAssignmentDialogError(message);
      applyConflictMarkersFromMessage(message);
      toast.error('Failed to update section subject assignments', { description: message });
    },
  });

  const filtered = sections.filter((s) =>
    [s.name, s.code, s.course?.name ?? ''].join(' ').toLowerCase().includes(search.toLowerCase()),
  );
  const pagination = useClientPagination(filtered, pageIndex, pageSize);
  const courseScopedSubjects: SubjectOption[] = courseSubjects.map((subject) => ({
    id: subject.id,
    name: subject.name,
    code: subject.code,
    year: subject.year,
  }));
  const courseScopedSubjectIdSet = new Set(courseScopedSubjects.map((subject) => subject.id));
  const orphanAssignedSubjects = selectedSubjectIds
    .filter((subjectId) => !courseScopedSubjectIdSet.has(subjectId))
    .map((subjectId) => assignedSubjectsById[subjectId])
    .filter((subject): subject is SubjectOption => Boolean(subject));
  const availableSubjects = [...courseScopedSubjects, ...orphanAssignedSubjects];
  const orphanAssignedSubjectIdSet = new Set(orphanAssignedSubjects.map((subject) => subject.id));

  const filteredSubjects = availableSubjects.filter((subject) => {
    const query = subjectSearch.trim().toLowerCase();
    const matchesSearch = query.length === 0
      || subject.name.toLowerCase().includes(query)
      || subject.code.toLowerCase().includes(query);
    const matchesYear = subjectYearFilter === 'all' || subject.year === subjectYearFilter;
    return matchesSearch && matchesYear;
  });
  const subjectsById = availableSubjects.reduce<Record<string, SubjectOption>>((acc, subject) => {
    acc[subject.id] = subject;
    return acc;
  }, {});

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  useEffect(() => {
    setPageIndex(0);
  }, [search, yearLevelFilter]);

  useEffect(() => {
    if (pageIndex !== pagination.pageIndex) setPageIndex(pagination.pageIndex);
  }, [pageIndex, pagination.pageIndex]);

  const openEdit = (section: Section) => {
    setEditing(section);
    setForm({
      name: section.name,
      code: section.code,
      description: section.description ?? '',
      courseId: section.courseId,
      yearLevel: section.yearLevel,
      active: section.active,
      note: section.note ?? '',
    });
    setDialogOpen(true);
  };
  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  };
  const closeSubjectDialog = () => {
    setSubjectDialogOpen(false);
    setSelectedSection(null);
    setSubjectSearch('');
    setSubjectYearFilter('all');
    setSelectedSubjectIds([]);
    setAssignedSubjectsById({});
    setScheduleBySubject({});
    setEligibleTeachersBySubject({});
    setLoadingTeachersBySubject({});
    clearDialogErrors();
  };

  const loadTeachersForSubject = async (subjectId: string) => {
    setLoadingTeachersBySubject((prev) => ({ ...prev, [subjectId]: true }));
    try {
      const teachers = await teacherService.getTeachers({ active: true, subjectId });
      setEligibleTeachersBySubject((prev) => ({ ...prev, [subjectId]: teachers }));
    } catch {
      setEligibleTeachersBySubject((prev) => ({ ...prev, [subjectId]: [] }));
      const msg = 'Failed to load eligible teachers';
      setAssignmentDialogError(msg);
      toast.error(msg);
    } finally {
      setLoadingTeachersBySubject((prev) => ({ ...prev, [subjectId]: false }));
    }
  };

  const openSubjectDialog = async (section: Section) => {
    clearDialogErrors();
    setSelectedSection(section);
    setSubjectDialogOpen(true);
    setSubjectSearch('');
    setSubjectYearFilter('all');
    try {
      const mappings = await sectionService.getSectionSubjectTeachers(section.id, { active: true });
      const nextSchedule: Record<string, Record<string, TeacherScheduleForm>> = {};
      const assignedSubjects: Record<string, SubjectOption> = {};
      for (const m of mappings) {
        if (!nextSchedule[m.subjectId]) nextSchedule[m.subjectId] = {};
        if (m.subject) {
          assignedSubjects[m.subjectId] = {
            id: m.subject.id,
            name: m.subject.name,
            code: m.subject.code,
            year: isSubjectYear(m.subject.year) ? m.subject.year : null,
          };
        }
        const days: SectionScheduleWeekday[] =
          m.daysOfWeek && m.daysOfWeek.length > 0
            ? (m.daysOfWeek.filter((d): d is SectionScheduleWeekday =>
                WEEKDAYS.includes(d as SectionScheduleWeekday),
              ) as SectionScheduleWeekday[])
            : (['Mon'] as SectionScheduleWeekday[]);
        nextSchedule[m.subjectId][m.teacherId] = {
          daysOfWeek: days.length > 0 ? days : ['Mon'],
          startTime: formatTimeForInput(m.startTime),
          endTime: formatTimeForInput(m.endTime),
        };
      }
      const nextSubjectIds = [...new Set(mappings.map((m) => m.subjectId))];
      setAssignedSubjectsById(assignedSubjects);
      setScheduleBySubject(nextSchedule);
      setSelectedSubjectIds(nextSubjectIds);

      await Promise.all(nextSubjectIds.map((subjectId) => loadTeachersForSubject(subjectId)));
    } catch {
      const msg = 'Failed to load current section subject assignments';
      setAssignmentDialogError(msg);
      toast.error(msg);
      setScheduleBySubject({});
      setSelectedSubjectIds([]);
      setAssignedSubjectsById({});
    }
  };

  const toggleSubject = async (subjectId: string, checked: boolean | 'indeterminate') => {
    if (checked) {
      setSelectedSubjectIds((prev) => [...new Set([...prev, subjectId])]);
      if (!eligibleTeachersBySubject[subjectId]) {
        await loadTeachersForSubject(subjectId);
      }
      return;
    }

    setSelectedSubjectIds((prev) => prev.filter((id) => id !== subjectId));
    setScheduleBySubject((prev) => {
      const next = { ...prev };
      delete next[subjectId];
      return next;
    });
    setRowErrorsBySubject((prev) => {
      const next = { ...prev };
      delete next[subjectId];
      return next;
    });
  };

  const toggleTeacherForSubject = (subjectId: string, teacherId: string, checked: boolean | 'indeterminate') => {
    clearRowError(subjectId, teacherId);
    setAssignmentDialogError(null);
    setScheduleBySubject((prev) => {
      const subjectMap = { ...(prev[subjectId] || {}) };
      if (checked) {
        subjectMap[teacherId] = subjectMap[teacherId] ?? defaultTeacherSchedule();
      } else {
        delete subjectMap[teacherId];
      }
      return { ...prev, [subjectId]: subjectMap };
    });
  };

  const toggleWeekdayForTeacher = (subjectId: string, teacherId: string, day: SectionScheduleWeekday) => {
    clearRowError(subjectId, teacherId);
    setAssignmentDialogError(null);
    setScheduleBySubject((prev) => {
      const subjectMap = { ...(prev[subjectId] || {}) };
      const row = subjectMap[teacherId] ?? defaultTeacherSchedule();
      const has = row.daysOfWeek.includes(day);
      const days: SectionScheduleWeekday[] = has
        ? row.daysOfWeek.filter((d) => d !== day)
        : [...row.daysOfWeek, day];
      const order = (a: SectionScheduleWeekday, b: SectionScheduleWeekday) =>
        WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b);
      subjectMap[teacherId] = { ...row, daysOfWeek: [...days].sort(order) };
      return { ...prev, [subjectId]: subjectMap };
    });
  };

  const updateScheduleTime = (
    subjectId: string,
    teacherId: string,
    field: 'startTime' | 'endTime',
    value: string,
  ) => {
    clearRowError(subjectId, teacherId);
    setAssignmentDialogError(null);
    setScheduleBySubject((prev) => {
      const subjectMap = { ...(prev[subjectId] || {}) };
      const row = subjectMap[teacherId] ?? defaultTeacherSchedule();
      subjectMap[teacherId] = { ...row, [field]: value };
      return { ...prev, [subjectId]: subjectMap };
    });
  };

  const saveSectionSubjectAssignments = () => {
    if (!selectedSection) return;
    clearDialogErrors();
    if (selectedSubjectIds.length === 0) {
      assignSectionSubjectTeachersMutation.mutate({ sectionId: selectedSection.id, assignments: [] });
      return;
    }

    for (const subjectId of selectedSubjectIds) {
      const subject = subjectsById[subjectId];
      const label = subject ? `${subject.name} (${subject.code})` : 'A subject';
      const teachers = scheduleBySubject[subjectId] || {};
      const teacherEntries = Object.entries(teachers);
      if (teacherEntries.length === 0) {
        const message = `Select at least one teacher for ${label}`;
        setAssignmentDialogError(message);
        toast.error(message);
        return;
      }
      for (const [tid, sched] of teacherEntries) {
        if (sched.daysOfWeek.length === 0) {
          const t = eligibleTeachersBySubject[subjectId]?.find((x) => x.id === tid);
          const tname = t ? `${t.firstName} ${t.lastName}` : 'teacher';
          const message = `Select at least one class day for ${tname} in ${label}`;
          setAssignmentDialogError(message);
          setRowErrorsBySubject((prev) => ({
            ...prev,
            [subjectId]: { ...(prev[subjectId] || {}), [tid]: message }
          }));
          toast.error(message);
          return;
        }
        if (!sched.startTime?.trim() || !sched.endTime?.trim()) {
          const message = `Set start and end time for each teacher in ${label}`;
          setAssignmentDialogError(message);
          setRowErrorsBySubject((prev) => ({
            ...prev,
            [subjectId]: { ...(prev[subjectId] || {}), [tid]: message }
          }));
          toast.error(message);
          return;
        }
        const startM = toMinutes(sched.startTime);
        const endM = toMinutes(sched.endTime);
        if (Number.isNaN(startM) || Number.isNaN(endM) || endM <= startM) {
          const message = `End time must be after start time (${label})`;
          setAssignmentDialogError(message);
          setRowErrorsBySubject((prev) => ({
            ...prev,
            [subjectId]: { ...(prev[subjectId] || {}), [tid]: message }
          }));
          toast.error(message);
          return;
        }
      }
    }

    const scheduleEntries = selectedSubjectIds.flatMap((subjectId) =>
      Object.entries(scheduleBySubject[subjectId] || {}).map(([teacherId, sched]) => ({
        subjectId,
        teacherId,
        daysOfWeek: sched.daysOfWeek,
        startTime: sched.startTime.trim(),
        endTime: sched.endTime.trim(),
        startM: toMinutes(sched.startTime),
        endM: toMinutes(sched.endTime)
      }))
    );
    for (let i = 0; i < scheduleEntries.length; i += 1) {
      for (let j = i + 1; j < scheduleEntries.length; j += 1) {
        const a = scheduleEntries[i];
        const b = scheduleEntries[j];
        if (!hasSharedDay(a.daysOfWeek, b.daysOfWeek)) continue;
        const overlap = Math.min(a.endM, b.endM) - Math.max(a.startM, b.startM);
        if (overlap < OVERLAP_THRESHOLD_MINUTES) continue;

        const subjectA = subjectsById[a.subjectId];
        const subjectB = subjectsById[b.subjectId];
        const message =
          `Schedule conflict detected (>=${OVERLAP_THRESHOLD_MINUTES} minutes): ` +
          `${subjectA ? `${subjectA.name} (${subjectA.code})` : 'Subject'} and ` +
          `${subjectB ? `${subjectB.name} (${subjectB.code})` : 'Subject'} overlap.`;
        setAssignmentDialogError(message);
        setRowErrorsBySubject((prev) => ({
          ...prev,
          [a.subjectId]: { ...(prev[a.subjectId] || {}), [a.teacherId]: message },
          [b.subjectId]: { ...(prev[b.subjectId] || {}), [b.teacherId]: message }
        }));
        toast.error(message);
        return;
      }
    }

    const assignments = selectedSubjectIds.map((subjectId) => {
      const teachers = scheduleBySubject[subjectId] || {};
      return {
        subjectId,
        teachers: Object.entries(teachers).map(([teacherId, sched]) => ({
          teacherId,
          daysOfWeek: sched.daysOfWeek,
          startTime: sched.startTime.trim(),
          endTime: sched.endTime.trim(),
        })),
      };
    });

    assignSectionSubjectTeachersMutation.mutate({ sectionId: selectedSection.id, assignments });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload: form });
      return;
    }
    createMutation.mutate(form);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isAssigning = assignSectionSubjectTeachersMutation.isPending;

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">Loading sections...</div>;
  }

  return (
    <>
      <div className="section-spacing">
        <div className="space-y-2 md:space-y-3">
          <div>
            <h1 className="page-header">Sections</h1>
          </div>
          <div className="flex justify-end">
            <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Add Section</Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>All Sections</CardTitle>
                <CardDescription>{sections.length} section{sections.length !== 1 ? 's' : ''}</CardDescription>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search sections..." className="pl-9" />
              </div>
              <div className="w-full sm:w-56">
                <Select value={yearLevelFilter} onValueChange={(value) => setYearLevelFilter(value as 'all' | YearLevel)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Year Levels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Year Levels</SelectItem>
                    {YEAR_LEVELS.map((yearLevel) => (
                      <SelectItem key={yearLevel} value={yearLevel}>
                        {yearLevel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Layers className="h-12 w-12 text-muted-foreground/30" />
                <p className="mt-3 text-base font-medium">{sections.length === 0 ? 'No sections yet' : 'No sections found'}</p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Year Level</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagination.pageItems.map((section) => (
                      <TableRow key={section.id}>
                        <TableCell className="font-medium">{section.name}</TableCell>
                        <TableCell><Badge variant="outline">{section.code}</Badge></TableCell>
                        <TableCell>{section.course?.name ?? '-'}</TableCell>
                        <TableCell>{section.yearLevel}</TableCell>
                        <TableCell><Badge variant={section.active ? 'default' : 'secondary'}>{section.active ? 'Active' : 'Inactive'}</Badge></TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" title="Assign section subjects" onClick={() => openSubjectDialog(section)}>
                            <Link2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(section)}><Pencil className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <TablePaginationControls
                  pageIndex={pagination.pageIndex}
                  pageSize={pagination.pageSize}
                  totalItems={pagination.totalItems}
                  onPageIndexChange={setPageIndex}
                  onPageSizeChange={(next) => {
                    setPageSize(next);
                    setPageIndex(0);
                  }}
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Section' : 'Add Section'}</DialogTitle>
            <DialogDescription>{editing ? 'Update section details.' : 'Create a new section.'}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Code</Label>
              <Input id="code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required />
            </div>
            <div className="space-y-2">
              <Label>Course</Label>
              <Select value={form.courseId} onValueChange={(v) => setForm({ ...form, courseId: v })}>
                <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                <SelectContent>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {formatCourseOptionLabel(course)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Year Level</Label>
              <Select value={form.yearLevel} onValueChange={(v) => setForm({ ...form, yearLevel: v as YearLevel })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {YEAR_LEVELS.map((yearLevel) => <SelectItem key={yearLevel} value={yearLevel}>{yearLevel}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">Note</Label>
              <Input id="note" value={form.note ?? ''} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.active ?? true} onCheckedChange={(checked) => setForm({ ...form, active: checked })} id="active" />
              <Label htmlFor="active">Active</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button type="submit" disabled={isPending}>{isPending ? 'Saving...' : editing ? 'Save Changes' : 'Create Section'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={subjectDialogOpen} onOpenChange={(open) => { if (!open) closeSubjectDialog(); }}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign Section Subjects</DialogTitle>
            <DialogDescription>
              {selectedSection ? `Manage subject and teacher assignments for ${selectedSection.name}` : 'Manage subject assignments'}
            </DialogDescription>
          </DialogHeader>
          {assignmentDialogError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{assignmentDialogError}</span>
            </div>
          )}

          <div className="space-y-3">
            <Label htmlFor="subjectSearch">Subjects</Label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_180px]">
              <Input
                id="subjectSearch"
                value={subjectSearch}
                onChange={(e) => setSubjectSearch(e.target.value)}
                placeholder="Search subject name or code..."
              />
              <Select value={subjectYearFilter} onValueChange={(value) => setSubjectYearFilter(value as 'all' | SubjectYear)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Years" />
                </SelectTrigger>
                <SelectContent>
                  {SUBJECT_YEAR_FILTER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="max-h-52 space-y-2 overflow-y-auto rounded-md border p-3">
              {filteredSubjects.length === 0 ? (
                <p className="text-sm text-muted-foreground">No subjects match your filters.</p>
              ) : (
                filteredSubjects.map((subject) => (
                  <label key={subject.id} className="flex items-center gap-3 text-sm">
                    <Checkbox
                      checked={selectedSubjectIds.includes(subject.id)}
                      onCheckedChange={(checked) => void toggleSubject(subject.id, checked)}
                    />
                    <span>
                      {subject.name} ({subject.code}) - {formatSubjectYear(subject.year)}
                      {orphanAssignedSubjectIdSet.has(subject.id) ? ' - not linked to this section course' : ''}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="space-y-3">
            <Label>Teacher Assignments per Subject</Label>
            <div className="max-h-72 space-y-3 overflow-y-auto rounded-md border p-3">
              {selectedSubjectIds.length === 0 ? (
                <p className="text-sm text-muted-foreground">Select at least one subject to assign teachers.</p>
              ) : (
                selectedSubjectIds.map((subjectId) => {
                  const subject = subjectsById[subjectId];
                  const eligibleTeachers = eligibleTeachersBySubject[subjectId] || [];
                  const isTeachersLoading = loadingTeachersBySubject[subjectId];

                  return (
                    <div key={subjectId} className="rounded-md border p-3">
                      <p className="mb-2 text-sm font-medium">
                        {subject ? `${subject.name} (${subject.code})` : 'Unknown Subject'}
                      </p>
                      {isTeachersLoading ? (
                        <p className="text-sm text-muted-foreground">Loading eligible teachers...</p>
                      ) : eligibleTeachers.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No active teachers assigned to this subject.</p>
                      ) : (
                        <div className="space-y-3">
                          {eligibleTeachers.map((teacher) => {
                            const sched = scheduleBySubject[subjectId]?.[teacher.id];
                            const checked = Boolean(sched);
                            return (
                              <div key={teacher.id} className="rounded-md border bg-muted/20 p-3">
                                <label className="flex cursor-pointer items-center gap-3 text-sm">
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(c) => toggleTeacherForSubject(subjectId, teacher.id, c)}
                                  />
                                  <span className="font-medium">
                                    {teacher.firstName} {teacher.lastName}{' '}
                                    <span className="text-muted-foreground">({teacher.email})</span>
                                  </span>
                                </label>
                                {checked && sched && (
                                  <div className="mt-3 space-y-3 border-t border-border pt-3 pl-1">
                                    <div>
                                      <p className="mb-2 text-xs text-muted-foreground">Class days</p>
                                      <div className="flex flex-wrap gap-1.5">
                                        {WEEKDAYS.map((day, idx) => {
                                          const active = sched.daysOfWeek.includes(day);
                                          return (
                                            <button
                                              key={day}
                                              type="button"
                                              className={cn(
                                                'h-8 min-w-8 rounded-md border px-2 text-xs font-medium transition-colors',
                                                active
                                                  ? 'border-primary bg-primary text-primary-foreground'
                                                  : 'border-border bg-background hover:bg-muted',
                                              )}
                                              onClick={() => toggleWeekdayForTeacher(subjectId, teacher.id, day)}
                                            >
                                              {WEEKDAY_LABELS[idx]}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
                                      <div className="space-y-1">
                                        <Label className="text-xs">Start</Label>
                                        <Input
                                          type="time"
                                          value={sched.startTime}
                                          onChange={(e) =>
                                            updateScheduleTime(subjectId, teacher.id, 'startTime', e.target.value)
                                          }
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs">End</Label>
                                        <Input
                                          type="time"
                                          value={sched.endTime}
                                          onChange={(e) =>
                                            updateScheduleTime(subjectId, teacher.id, 'endTime', e.target.value)
                                          }
                                        />
                                      </div>
                                    </div>
                                    {rowErrorsBySubject[subjectId]?.[teacher.id] && (
                                      <p className="text-xs text-destructive">
                                        {rowErrorsBySubject[subjectId][teacher.id]}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeSubjectDialog}>Cancel</Button>
            <Button type="button" disabled={!selectedSection || isAssigning} onClick={saveSectionSubjectAssignments}>
              {isAssigning ? 'Saving...' : 'Save Assignments'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function Sections() {
  return (
    <MainLayout>
      <SectionsTabContent />
    </MainLayout>
  );
}
