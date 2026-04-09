import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  studentService,
  type BackendStudent,
  type StudentCreatePayload,
  type StudentUpdatePayload,
} from '@/services/student.service';
import {
  studentEnrollmentService,
  type StudentEnrollment,
  type StudentEnrollmentPayload,
  type EnrollmentStatus,
  type StudentType,
} from '@/services/student-enrollment.service';
import { courseService } from '@/services/course.service';
import { sectionService, type Section } from '@/services/section.service';
import { subjectService } from '@/services/subject.service';
import { teacherService, type SectionScheduleWeekday } from '@/services/teacher.service';
import {
  studentSubjectAssignmentService,
  type StudentAssignmentType,
} from '@/services/student-subject-assignment.service';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getAvatarUrl } from '@/lib/utils';
import { toast } from 'sonner';
import { Search, Plus, Pencil, Users, UserCheck, Loader2 } from 'lucide-react';
import { YEAR_LEVELS, type YearLevel } from '@/constants/year-level';
import { useClientPagination } from '@/hooks/useClientPagination';
import { TablePaginationControls } from '@/components/TablePaginationControls';

const YEAR_LEVEL_ORDER: Record<YearLevel, number> = {
  'Year 1': 1,
  'Year 2': 2,
  'Year 3': 3,
  'Year 4': 4,
  'Year 5': 5,
  'Year 6': 6,
  'Grade 11': 7,
  'Grade 12': 8,
};

const STATUS_OPTIONS = ['pending', 'enrolled', 'dropped', 'graduated'] as const;
type StudentStatus = typeof STATUS_OPTIONS[number];

const ENROLLMENT_STATUS_OPTIONS: EnrollmentStatus[] = ['enrolled', 'dropped', 'graduated'];
const STUDENT_TYPE_OPTIONS: StudentType[] = ['regular', 'irregular'];
const WEEK_DAYS: SectionScheduleWeekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const ASSIGNMENT_TYPES: StudentAssignmentType[] = ['ADD', 'REMOVE', 'REPLACE'];

function sortSectionsList(list: Section[]): Section[] {
  return [...list].sort((a, b) => {
    const yearDiff = YEAR_LEVEL_ORDER[a.yearLevel] - YEAR_LEVEL_ORDER[b.yearLevel];
    if (yearDiff !== 0) return yearDiff;
    const nameDiff = a.name.localeCompare(b.name);
    if (nameDiff !== 0) return nameDiff;
    return a.code.localeCompare(b.code);
  });
}

function toDateInputValue(iso: string | undefined): string {
  if (!iso) return '';
  return iso.length >= 10 ? iso.slice(0, 10) : '';
}

function currentDateInputValue(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function mapEnrollmentToForm(row: StudentEnrollment): EnrollmentForm {
  return {
    courseId: row.courseId,
    sectionId: row.sectionId ?? '',
    schoolYear: row.schoolYear,
    yearLevel: row.yearLevel,
    studentType: row.studentType,
    enrolledDate: toDateInputValue(row.enrolledDate),
    status: row.status,
    active: row.active,
    remarks: row.remarks ?? '',
  };
}

function backendStudentFromEnrollmentRow(e: StudentEnrollment): BackendStudent {
  const st = e.student;
  if (!st) {
    return {
      id: e.studentId,
      student_id_number: '',
      first_name: '',
      middle_name: null,
      last_name: '',
      email: null,
      is_active: true,
      user_image_url: null,
      school_id: null,
      department_id: null,
      studentType: e.studentType,
    };
  }
  return {
    id: e.studentId,
    student_id_number: st.studentIdNumber,
    first_name: st.firstName,
    middle_name: st.middleName ?? null,
    last_name: st.lastName,
    email: st.email ?? null,
    is_active: true,
    user_image_url: null,
    school_id: null,
    department_id: null,
    studentType: e.studentType,
  };
}

function fullNameFromEnrollmentRow(e: StudentEnrollment): string {
  const st = e.student;
  if (!st) return '—';
  return [st.firstName, st.middleName, st.lastName].filter(Boolean).join(' ');
}

interface CreateForm {
  firstName: string;
  lastName: string;
  middleName: string;
  birthday: string;
  address: string;
  contactNumber: string;
  email: string;
  studentIdNumber: string;
  yearLevel: YearLevel;
  guardianContactNumber: string;
  guardianEmail: string;
  enrolledDate: string;
}

interface EditForm {
  firstName: string;
  lastName: string;
  middleName: string;
  birthday: string;
  address: string;
  contactNumber: string;
  email: string;
  studentIdNumber: string;
  yearLevel: YearLevel;
  guardianContactNumber: string;
  guardianEmail: string;
  active: boolean;
  status: StudentStatus;
  enrolledDate: string;
}

interface EnrollmentForm {
  courseId: string;
  sectionId: string;
  schoolYear: string;
  yearLevel: YearLevel;
  studentType: StudentType | '';
  enrolledDate: string;
  status: EnrollmentStatus;
  active: boolean;
  remarks: string;
}

interface IrregularPlanForm {
  id?: string;
  assignmentType: StudentAssignmentType;
  baseSectionSubjectTeacherId: string;
  sectionSubjectTeacherId: string;
  subjectId: string;
  teacherId: string;
  sectionId: string;
  daysOfWeek: SectionScheduleWeekday[];
  startTime: string;
  endTime: string;
  effectiveFrom: string;
  effectiveTo: string;
  remarks: string;
}

const EMPTY_ENROLLMENT: EnrollmentForm = {
  courseId: '',
  sectionId: '',
  schoolYear: '',
  yearLevel: 'Year 1',
  studentType: 'regular',
  enrolledDate: '',
  status: 'enrolled',
  active: true,
  remarks: '',
};

const EMPTY_IRREGULAR_PLAN: IrregularPlanForm = {
  assignmentType: 'ADD',
  baseSectionSubjectTeacherId: '',
  sectionSubjectTeacherId: '',
  subjectId: '',
  teacherId: '',
  sectionId: '',
  daysOfWeek: [],
  startTime: '',
  endTime: '',
  effectiveFrom: '',
  effectiveTo: '',
  remarks: '',
};

const makeEmptyCreateForm = (): CreateForm => ({
  firstName: '', lastName: '', middleName: '', birthday: '', address: '',
  contactNumber: '', email: '', studentIdNumber: '', yearLevel: 'Year 1',
  guardianContactNumber: '', guardianEmail: '', enrolledDate: currentDateInputValue(),
});

const toEditForm = (s: BackendStudent): EditForm => ({
  firstName: s.first_name,
  lastName: s.last_name,
  middleName: s.middle_name ?? '',
  birthday: toDateInputValue(s.birthday ?? undefined),
  address: s.address ?? '',
  contactNumber: s.contactNumber ?? '',
  email: s.email ?? '',
  studentIdNumber: s.student_id_number,
  yearLevel: (s.yearLevel ?? 'Year 1') as YearLevel,
  guardianContactNumber: s.guardianContactNumber ?? '',
  guardianEmail: s.guardianEmail ?? '',
  active: s.is_active,
  status: (s.status as StudentStatus) ?? 'enrolled',
  enrolledDate: toDateInputValue(s.enrolledDate ?? undefined),
});

function fullName(s: BackendStudent) {
  return [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(' ');
}

function toMinutes(timeValue: string | null | undefined): number | null {
  if (!timeValue) return null;
  const [h, m] = String(timeValue).slice(0, 5).split(':');
  const hh = Number(h);
  const mm = Number(m);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return (hh * 60) + mm;
}

function hasOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return Math.min(aEnd, bEnd) > Math.max(aStart, bStart);
}

function formatTimeRange(startTime?: string | null, endTime?: string | null): string {
  if (!startTime || !endTime) return '—';
  return `${String(startTime).slice(0, 5)}-${String(endTime).slice(0, 5)}`;
}

export default function ManageStudents() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [studentsPageIndex, setStudentsPageIndex] = useState(0);
  const [studentsPageSize, setStudentsPageSize] = useState(10);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<BackendStudent | null>(null);
  const [createForm, setCreateForm] = useState<CreateForm>(() => makeEmptyCreateForm());
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [postCreateConfirmOpen, setPostCreateConfirmOpen] = useState(false);
  const [postCreateStudent, setPostCreateStudent] = useState<BackendStudent | null>(null);
  const [postCreateEnrollmentPrefill, setPostCreateEnrollmentPrefill] = useState<Pick<EnrollmentForm, 'yearLevel' | 'enrolledDate'> | null>(null);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollingStudent, setEnrollingStudent] = useState<BackendStudent | null>(null);
  const [editingEnrollmentId, setEditingEnrollmentId] = useState<string | null>(null);
  const [enrollOpenLoading, setEnrollOpenLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'bySection'>('all');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [sectionEnrollmentsPageIndex, setSectionEnrollmentsPageIndex] = useState(0);
  const [sectionEnrollmentsPageSize, setSectionEnrollmentsPageSize] = useState(10);
  const [enrollmentForm, setEnrollmentForm] = useState<EnrollmentForm>(EMPTY_ENROLLMENT);
  const [enrollmentActiveDirty, setEnrollmentActiveDirty] = useState(false);
  const [irregularOpen, setIrregularOpen] = useState(false);
  const [irregularForm, setIrregularForm] = useState<IrregularPlanForm>(EMPTY_IRREGULAR_PLAN);
  const [editingOverrideId, setEditingOverrideId] = useState<string | null>(null);

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['students'],
    queryFn: () => studentService.getStudents(),
  });
  const { data: courses = [] } = useQuery({
    queryKey: ['courses'],
    queryFn: () => courseService.getCourses({ active: true }),
  });
  const { data: sections = [] } = useQuery({
    queryKey: ['sections'],
    queryFn: () => sectionService.getSections({ active: true }),
  });
  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects', 'active'],
    queryFn: () => subjectService.getSubjects({ active: true }),
  });
  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers', 'active'],
    queryFn: () => teacherService.getTeachers({ active: true }),
  });
  const { data: allSectionAssignments = [] } = useQuery({
    queryKey: ['section-subject-assignments', 'active'],
    queryFn: () => teacherService.getAllSectionSubjectAssignments({ active: true }),
  });

  const sortedSections = useMemo(() => sortSectionsList(sections), [sections]);

  const { data: sectionEnrollments = [], isLoading: sectionEnrollmentsLoading } = useQuery({
    queryKey: ['student-enrollments', { sectionId: selectedSectionId, active: true }],
    queryFn: () =>
      studentEnrollmentService.getAllEnrollments({
        sectionId: selectedSectionId,
        active: true,
      }),
    enabled: !!selectedSectionId,
  });

  const createMutation = useMutation({
    mutationFn: (payload: StudentCreatePayload) => studentService.createStudent(payload),
    onSuccess: (createdStudent) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success('Student created', { description: 'A student account has been created automatically.' });
      setCreateOpen(false);
      setPostCreateStudent(createdStudent);
      setPostCreateEnrollmentPrefill({
        yearLevel: createdStudent.yearLevel ?? createForm.yearLevel,
        enrolledDate: createdStudent.enrolledDate ? toDateInputValue(createdStudent.enrolledDate) : (createForm.enrolledDate || ''),
      });
      setPostCreateConfirmOpen(true);
      setCreateForm(makeEmptyCreateForm());
    },
    onError: (err: Error) => toast.error('Failed to create student', { description: err.message }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: StudentUpdatePayload }) =>
      studentService.updateStudent(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success('Student updated', { description: 'Student and linked user account have been synced.' });
      setEditOpen(false);
      setEditing(null);
    },
    onError: (err: Error) => toast.error('Failed to update student', { description: err.message }),
  });

  const createEnrollmentMutation = useMutation({
    mutationFn: ({
      studentId,
      payload,
    }: {
      studentId: string;
      payload: {
        courseId: string;
        sectionId?: string;
        schoolYear: string;
        yearLevel: YearLevel;
        studentType: StudentType;
        enrolledDate?: string;
        status: EnrollmentStatus;
        active: boolean;
        remarks?: string;
      };
    }) => studentEnrollmentService.createStudentEnrollment(studentId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['student-enrollments'] });
      toast.success('Enrollment saved successfully');
      setEnrollOpen(false);
      setEnrollingStudent(null);
      setEditingEnrollmentId(null);
      setEnrollmentForm(EMPTY_ENROLLMENT);
      setEnrollOpenLoading(false);
    },
    onError: (err: Error) => toast.error('Failed to save enrollment', { description: err.message }),
  });

  const updateEnrollmentMutation = useMutation({
    mutationFn: ({
      enrollmentId,
      payload,
    }: {
      enrollmentId: string;
      payload: Parameters<typeof studentEnrollmentService.updateStudentEnrollment>[1];
    }) => studentEnrollmentService.updateStudentEnrollment(enrollmentId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['student-enrollments'] });
      toast.success('Enrollment updated successfully');
      setEnrollOpen(false);
      setEnrollingStudent(null);
      setEditingEnrollmentId(null);
      setEnrollmentForm(EMPTY_ENROLLMENT);
      setEnrollOpenLoading(false);
    },
    onError: (err: Error) => toast.error('Failed to update enrollment', { description: err.message }),
  });

  const { data: studentOverridesData, isLoading: overridesLoading } = useQuery({
    queryKey: ['student-subject-assignments', enrollingStudent?.id],
    queryFn: () => studentSubjectAssignmentService.getStudentSubjectAssignments(enrollingStudent!.id, { active: true }),
    enabled: irregularOpen && !!enrollingStudent?.id,
  });
  const { data: finalScheduleData, isLoading: finalScheduleLoading } = useQuery({
    queryKey: ['student-final-schedule', enrollingStudent?.id],
    queryFn: () => studentSubjectAssignmentService.getStudentFinalSchedule(enrollingStudent!.id),
    enabled: irregularOpen && !!enrollingStudent?.id,
  });

  const createOverrideMutation = useMutation({
    mutationFn: () => {
      if (!enrollingStudent?.id) throw new Error('Student is required');
      return studentSubjectAssignmentService.createStudentSubjectAssignment(enrollingStudent.id, {
        assignmentType: irregularForm.assignmentType,
        baseSectionSubjectTeacherId: irregularForm.baseSectionSubjectTeacherId || undefined,
        sectionSubjectTeacherId: irregularForm.sectionSubjectTeacherId || undefined,
        subjectId: irregularForm.subjectId || undefined,
        teacherId: irregularForm.teacherId || undefined,
        sectionId: irregularForm.sectionId || undefined,
        daysOfWeek: irregularForm.daysOfWeek.length > 0 ? irregularForm.daysOfWeek : undefined,
        startTime: irregularForm.startTime || undefined,
        endTime: irregularForm.endTime || undefined,
        effectiveFrom: irregularForm.effectiveFrom || undefined,
        effectiveTo: irregularForm.effectiveTo || undefined,
        remarks: irregularForm.remarks || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-subject-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['student-final-schedule'] });
      queryClient.invalidateQueries({ queryKey: ['admin-student-subject-assignments'] });
      setIrregularForm(EMPTY_IRREGULAR_PLAN);
      setEditingOverrideId(null);
      toast.success('Override added');
    },
    onError: (err: Error) => toast.error('Failed to add override', { description: err.message }),
  });

  const updateOverrideMutation = useMutation({
    mutationFn: () => {
      if (!editingOverrideId) throw new Error('Override is required');
      return studentSubjectAssignmentService.updateStudentSubjectAssignment(editingOverrideId, {
        assignmentType: irregularForm.assignmentType,
        baseSectionSubjectTeacherId: irregularForm.baseSectionSubjectTeacherId || undefined,
        sectionSubjectTeacherId: irregularForm.sectionSubjectTeacherId || undefined,
        subjectId: irregularForm.subjectId || undefined,
        teacherId: irregularForm.teacherId || undefined,
        sectionId: irregularForm.sectionId || undefined,
        daysOfWeek: irregularForm.daysOfWeek.length > 0 ? irregularForm.daysOfWeek : undefined,
        startTime: irregularForm.startTime || undefined,
        endTime: irregularForm.endTime || undefined,
        effectiveFrom: irregularForm.effectiveFrom || undefined,
        effectiveTo: irregularForm.effectiveTo || undefined,
        remarks: irregularForm.remarks || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-subject-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['student-final-schedule'] });
      queryClient.invalidateQueries({ queryKey: ['admin-student-subject-assignments'] });
      setIrregularForm(EMPTY_IRREGULAR_PLAN);
      setEditingOverrideId(null);
      toast.success('Override updated');
    },
    onError: (err: Error) => toast.error('Failed to update override', { description: err.message }),
  });

  const deleteOverrideMutation = useMutation({
    mutationFn: (id: string) => studentSubjectAssignmentService.deleteStudentSubjectAssignment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-subject-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['student-final-schedule'] });
      queryClient.invalidateQueries({ queryKey: ['admin-student-subject-assignments'] });
      toast.success('Override removed');
    },
    onError: (err: Error) => toast.error('Failed to remove override', { description: err.message }),
  });

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    return (
      fullName(s).toLowerCase().includes(q) ||
      s.student_id_number.toLowerCase().includes(q) ||
      (s.email ?? '').toLowerCase().includes(q)
    );
  });
  const studentsPagination = useClientPagination(filtered, studentsPageIndex, studentsPageSize);
  const sectionEnrollmentsPagination = useClientPagination(
    sectionEnrollments,
    sectionEnrollmentsPageIndex,
    sectionEnrollmentsPageSize,
  );

  useEffect(() => {
    setStudentsPageIndex(0);
  }, [search, activeTab]);

  useEffect(() => {
    if (studentsPageIndex !== studentsPagination.pageIndex) {
      setStudentsPageIndex(studentsPagination.pageIndex);
    }
  }, [studentsPageIndex, studentsPagination.pageIndex]);

  useEffect(() => {
    setSectionEnrollmentsPageIndex(0);
  }, [selectedSectionId, activeTab]);

  useEffect(() => {
    if (sectionEnrollmentsPageIndex !== sectionEnrollmentsPagination.pageIndex) {
      setSectionEnrollmentsPageIndex(sectionEnrollmentsPagination.pageIndex);
    }
  }, [sectionEnrollmentsPageIndex, sectionEnrollmentsPagination.pageIndex]);

  const openEdit = (student: BackendStudent) => {
    setEditing(student);
    setEditForm(toEditForm(student));
    setEditOpen(true);
  };

  const openEditByStudentId = async (studentId: string) => {
    const fromCache = students.find((s) => s.id === studentId);
    if (fromCache) {
      openEdit(fromCache);
      return;
    }
    try {
      const full = await studentService.getStudentById(studentId);
      openEdit(full);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load student';
      toast.error('Could not open student', { description: message });
    }
  };

  const openEnroll = async (
    student: BackendStudent,
    prefill?: Pick<EnrollmentForm, 'yearLevel' | 'enrolledDate'>
  ) => {
    const initialForm: EnrollmentForm = {
      ...EMPTY_ENROLLMENT,
      yearLevel: prefill?.yearLevel ?? EMPTY_ENROLLMENT.yearLevel,
      enrolledDate: prefill?.enrolledDate ?? currentDateInputValue(),
    };
    setEnrollingStudent(student);
    setEditingEnrollmentId(null);
    setEnrollmentForm(initialForm);
    setEnrollmentActiveDirty(false);
    setEnrollOpen(true);
    setEnrollOpenLoading(true);
    try {
      const rows = await studentEnrollmentService.getStudentEnrollments(student.id, { active: true });
      const row = rows.find((r) => r.active);
      if (row) {
        setEditingEnrollmentId(row.id);
        setEnrollmentForm(mapEnrollmentToForm(row));
        setEnrollmentActiveDirty(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load enrollment';
      toast.error('Could not load enrollment', { description: message });
      setEditingEnrollmentId(null);
      setEnrollmentForm(initialForm);
      setEnrollmentActiveDirty(false);
    } finally {
      setEnrollOpenLoading(false);
    }
  };

  const resetPostCreateFlow = () => {
    setPostCreateConfirmOpen(false);
    setPostCreateStudent(null);
    setPostCreateEnrollmentPrefill(null);
  };

  const handleProceedToEnroll = async () => {
    if (!postCreateStudent) {
      toast.error('Could not continue to enrollment', {
        description: 'The created student record is no longer available. Please use Enroll from the list.',
      });
      resetPostCreateFlow();
      return;
    }

    const student = postCreateStudent;
    const prefill = postCreateEnrollmentPrefill ?? undefined;
    resetPostCreateFlow();
    await openEnroll(student, prefill);
  };

  const closeEnrollDialog = () => {
    setEnrollOpen(false);
    setEnrollingStudent(null);
    setEditingEnrollmentId(null);
    setEnrollmentForm(EMPTY_ENROLLMENT);
    setEnrollmentActiveDirty(false);
    setEnrollOpenLoading(false);
  };

  const sectionAssignmentOptions = useMemo(() => {
    if (!editingEnrollmentId) return allSectionAssignments;
    const sectionId = enrollmentForm.sectionId || studentOverridesData?.enrollment?.sectionId || null;
    if (!sectionId) return allSectionAssignments;
    return allSectionAssignments.filter((row) => row.sectionId === sectionId);
  }, [allSectionAssignments, editingEnrollmentId, enrollmentForm.sectionId, studentOverridesData?.enrollment?.sectionId]);

  const requiresBaseAssignment = irregularForm.assignmentType === 'REMOVE' || irregularForm.assignmentType === 'REPLACE';
  const needsScheduleFields = irregularForm.assignmentType !== 'REMOVE';

  const finalScheduleConflicts = useMemo(() => {
    const rows = finalScheduleData?.rows ?? [];
    const issues: string[] = [];
    for (let i = 0; i < rows.length; i += 1) {
      for (let j = i + 1; j < rows.length; j += 1) {
        const a = rows[i];
        const b = rows[j];
        const sharedDays = (a.daysOfWeek || []).filter((d) => (b.daysOfWeek || []).includes(d));
        if (sharedDays.length === 0) continue;
        const aStart = toMinutes(a.startTime);
        const aEnd = toMinutes(a.endTime);
        const bStart = toMinutes(b.startTime);
        const bEnd = toMinutes(b.endTime);
        if (aStart === null || aEnd === null || bStart === null || bEnd === null) continue;
        if (hasOverlap(aStart, aEnd, bStart, bEnd)) {
          issues.push(
            `${a.subject?.name ?? 'Subject A'} overlaps with ${b.subject?.name ?? 'Subject B'} on ${sharedDays.join(', ')}.`
          );
        }
      }
    }
    return issues;
  }, [finalScheduleData?.rows]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: StudentCreatePayload = {
      firstName: createForm.firstName,
      lastName: createForm.lastName,
      middleName: createForm.middleName || undefined,
      birthday: createForm.birthday || undefined,
      address: createForm.address || undefined,
      contactNumber: createForm.contactNumber,
      email: createForm.email,
      studentIdNumber: createForm.studentIdNumber,
      yearLevel: createForm.yearLevel,
      guardianContactNumber: createForm.guardianContactNumber,
      guardianEmail: createForm.guardianEmail,
      enrolledDate: createForm.enrolledDate || undefined,
    };
    createMutation.mutate(payload);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !editForm) return;
    const payload: StudentUpdatePayload = {
      firstName: editForm.firstName,
      lastName: editForm.lastName,
      middleName: editForm.middleName || undefined,
      birthday: editForm.birthday || undefined,
      address: editForm.address || undefined,
      contactNumber: editForm.contactNumber,
      email: editForm.email,
      studentIdNumber: editForm.studentIdNumber,
      yearLevel: editForm.yearLevel,
      guardianContactNumber: editForm.guardianContactNumber,
      guardianEmail: editForm.guardianEmail,
      active: editForm.active,
      status: editForm.status,
      enrolledDate: editForm.enrolledDate || undefined,
    };
    updateMutation.mutate({ id: editing.id, payload });
  };

  const handleEnrollment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollingStudent || enrollOpenLoading) return;
    if (!enrollmentForm.studentType) {
      toast.error('Student type is required');
      return;
    }
    const studentType = enrollmentForm.studentType as StudentType;
    if (editingEnrollmentId) {
      const updatePayload: Partial<StudentEnrollmentPayload> = {
        courseId: enrollmentForm.courseId,
        sectionId: enrollmentForm.sectionId || undefined,
        schoolYear: enrollmentForm.schoolYear,
        yearLevel: enrollmentForm.yearLevel,
        studentType,
        enrolledDate: enrollmentForm.enrolledDate || undefined,
        status: enrollmentForm.status,
        remarks: enrollmentForm.remarks || undefined,
      };
      if (enrollmentActiveDirty) {
        updatePayload.active = enrollmentForm.active;
      }
      updateEnrollmentMutation.mutate({
        enrollmentId: editingEnrollmentId,
        payload: updatePayload,
      });
    } else {
      createEnrollmentMutation.mutate({
        studentId: enrollingStudent.id,
        payload: {
          courseId: enrollmentForm.courseId,
          sectionId: enrollmentForm.sectionId || undefined,
          schoolYear: enrollmentForm.schoolYear,
          yearLevel: enrollmentForm.yearLevel,
          studentType,
          enrolledDate: enrollmentForm.enrolledDate || undefined,
          status: enrollmentForm.status,
          active: enrollmentForm.active,
          remarks: enrollmentForm.remarks || undefined,
        },
      });
    }
  };

  const handleCreateOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollingStudent?.id) return;
    if (requiresBaseAssignment && !irregularForm.baseSectionSubjectTeacherId) {
      toast.error('Base section assignment is required for REMOVE/REPLACE');
      return;
    }
    if (needsScheduleFields && !irregularForm.sectionSubjectTeacherId && !irregularForm.subjectId) {
      toast.error('Provide either an existing assignment or a subject');
      return;
    }
    if (needsScheduleFields && (irregularForm.startTime || irregularForm.endTime || irregularForm.daysOfWeek.length > 0)) {
      if (!irregularForm.startTime || !irregularForm.endTime || irregularForm.daysOfWeek.length === 0) {
        toast.error('Days, start time, and end time are required when setting a custom schedule');
        return;
      }
      const start = toMinutes(irregularForm.startTime);
      const end = toMinutes(irregularForm.endTime);
      if (start === null || end === null || end <= start) {
        toast.error('Invalid schedule time range');
        return;
      }
    }
    if (irregularForm.effectiveFrom && irregularForm.effectiveTo && irregularForm.effectiveTo < irregularForm.effectiveFrom) {
      toast.error('Effective To must be on or after Effective From');
      return;
    }
    if (editingOverrideId) {
      updateOverrideMutation.mutate();
    } else {
      createOverrideMutation.mutate();
    }
  };

  const startEditOverride = (row: NonNullable<typeof studentOverridesData>['rows'][number]) => {
    setEditingOverrideId(row.id);
    setIrregularForm({
      id: row.id,
      assignmentType: row.assignmentType,
      baseSectionSubjectTeacherId: row.baseSectionSubjectTeacherId ?? '',
      sectionSubjectTeacherId: row.sectionSubjectTeacherId ?? '',
      subjectId: row.subjectId ?? '',
      teacherId: row.teacherId ?? '',
      sectionId: row.sectionId ?? '',
      daysOfWeek: row.daysOfWeek ?? [],
      startTime: row.startTime ? String(row.startTime).slice(0, 5) : '',
      endTime: row.endTime ? String(row.endTime).slice(0, 5) : '',
      effectiveFrom: row.effectiveFrom ?? '',
      effectiveTo: row.effectiveTo ?? '',
      remarks: row.remarks ?? '',
    });
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex h-[80vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="mt-4 text-muted-foreground">Loading students...</p>
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
            <h1 className="page-header">Manage Students</h1>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Student
            </Button>
          </div>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'all' | 'bySection')}
          className="space-y-4 md:space-y-6"
        >
          <TabsList className="h-auto w-full rounded-xl border border-primary/20 bg-card/60 p-1 backdrop-blur-sm sm:w-auto">
            <TabsTrigger
              value="all"
              className="rounded-lg px-4 py-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              All Students
            </TabsTrigger>
            <TabsTrigger
              value="bySection"
              className="rounded-lg px-4 py-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              By Section
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-0">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>All Students</CardTitle>
                    <CardDescription>{students.length} student{students.length !== 1 ? 's' : ''}</CardDescription>
                  </div>
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, ID, or email..."
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
                    <Users className="h-12 w-12 text-muted-foreground/30" />
                    <p className="mt-3 text-base font-medium">
                      {students.length === 0 ? 'No students yet' : 'No students found'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {students.length === 0 ? 'Add your first student to get started' : 'Try a different search'}
                    </p>
                    {students.length === 0 && (
                      <Button className="mt-4" onClick={() => setCreateOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" /> Add Student
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Student ID</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Student Type</TableHead>
                          <TableHead>Active</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {studentsPagination.pageItems.map((student) => (
                          <TableRow key={student.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9 rounded-full">
                                  <AvatarImage src={getAvatarUrl(student.user_image_url)} alt={fullName(student)} />
                                  <AvatarFallback className="rounded-full text-sm font-medium">{student.first_name.charAt(0)}{student.last_name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <span className="font-medium">{fullName(student)}</span>
                              </div>
                            </TableCell>
                            <TableCell><Badge variant="outline">{student.student_id_number}</Badge></TableCell>
                            <TableCell className="text-muted-foreground">{student.email || '-'}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {student.studentType ? `${student.studentType.charAt(0).toUpperCase()}${student.studentType.slice(1)}` : '—'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={student.is_active ? 'default' : 'secondary'}>
                                {student.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  (student.status ?? 'pending') === 'enrolled'
                                    ? 'default'
                                    : (student.status ?? 'pending') === 'pending'
                                      ? 'secondary'
                                      : 'outline'
                                }
                              >
                                {(student.status ?? 'pending').charAt(0).toUpperCase() + (student.status ?? 'pending').slice(1)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => void openEnroll(student)}
                                title={student.status === 'enrolled' ? 'View or edit enrollment' : 'Enroll student'}
                              >
                                <UserCheck className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => openEdit(student)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <TablePaginationControls
                      pageIndex={studentsPagination.pageIndex}
                      pageSize={studentsPagination.pageSize}
                      totalItems={studentsPagination.totalItems}
                      onPageIndexChange={setStudentsPageIndex}
                      onPageSizeChange={(next) => {
                        setStudentsPageSize(next);
                        setStudentsPageIndex(0);
                      }}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bySection" className="mt-0">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle>Enrolled by section</CardTitle>
                    <CardDescription>
                      Select a section to see active enrollments for that section.
                    </CardDescription>
                  </div>
                  <div className="w-full space-y-2 sm:w-80">
                    <Label htmlFor="section-filter">Section</Label>
                    <Select value={selectedSectionId || 'none'} onValueChange={(v) => setSelectedSectionId(v === 'none' ? '' : v)}>
                      <SelectTrigger id="section-filter">
                        <SelectValue placeholder="Choose a section" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Select a section…</SelectItem>
                        {sortedSections.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} ({s.code}) — {s.yearLevel}
                            {s.course?.name ? ` · ${s.course.name}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {!selectedSectionId ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                    <Users className="h-10 w-10 opacity-30" />
                    <p className="mt-3 text-sm">Choose a section to list enrolled students.</p>
                  </div>
                ) : sectionEnrollmentsLoading ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="mt-3 text-sm text-muted-foreground">Loading enrollments…</p>
                  </div>
                ) : sectionEnrollments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                    <p className="text-sm">No active enrollments for this section.</p>
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Student ID</TableHead>
                          <TableHead>Course</TableHead>
                          <TableHead>School year</TableHead>
                          <TableHead>Year level</TableHead>
                          <TableHead>Student Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sectionEnrollmentsPagination.pageItems.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium">{fullNameFromEnrollmentRow(row)}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{row.student?.studentIdNumber ?? '—'}</Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{row.course?.name ?? '—'}</TableCell>
                            <TableCell>{row.schoolYear}</TableCell>
                            <TableCell>{row.yearLevel}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {row.studentType.charAt(0).toUpperCase() + row.studentType.slice(1)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={row.status === 'enrolled' ? 'default' : 'secondary'}>
                                {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => void openEnroll(backendStudentFromEnrollmentRow(row))}
                                title="View or edit enrollment"
                              >
                                <UserCheck className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => void openEditByStudentId(row.studentId)}
                                title="Edit student"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <TablePaginationControls
                      pageIndex={sectionEnrollmentsPagination.pageIndex}
                      pageSize={sectionEnrollmentsPagination.pageSize}
                      totalItems={sectionEnrollmentsPagination.totalItems}
                      onPageIndexChange={setSectionEnrollmentsPageIndex}
                      onPageSizeChange={(next) => {
                        setSectionEnrollmentsPageSize(next);
                        setSectionEnrollmentsPageIndex(0);
                      }}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => { if (!open) { setCreateOpen(false); setCreateForm(makeEmptyCreateForm()); } }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Student</DialogTitle>
            <DialogDescription>
              A student user account will be created automatically. The default password is the student ID plus the last name with spaces removed, all lowercase (e.g. 00152 + Dela Cruz → 00152delacruz).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="c-firstName">First Name <span className="text-destructive">*</span></Label>
                <Input id="c-firstName" value={createForm.firstName} onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-lastName">Last Name <span className="text-destructive">*</span></Label>
                <Input id="c-lastName" value={createForm.lastName} onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-middleName">Middle Name</Label>
              <Input id="c-middleName" value={createForm.middleName} onChange={(e) => setCreateForm({ ...createForm, middleName: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="c-studentId">Student ID Number <span className="text-destructive">*</span></Label>
                <Input id="c-studentId" value={createForm.studentIdNumber} onChange={(e) => setCreateForm({ ...createForm, studentIdNumber: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-yearLevel">Year Level <span className="text-destructive">*</span></Label>
                <Select value={createForm.yearLevel} onValueChange={(v) => setCreateForm({ ...createForm, yearLevel: v as YearLevel })}>
                  <SelectTrigger id="c-yearLevel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {YEAR_LEVELS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="c-email">Email <span className="text-destructive">*</span></Label>
                <Input id="c-email" type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-contact">Contact Number <span className="text-destructive">*</span></Label>
                <Input id="c-contact" value={createForm.contactNumber} onChange={(e) => setCreateForm({ ...createForm, contactNumber: e.target.value })} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="c-birthday">Birthday</Label>
                <Input id="c-birthday" type="date" value={createForm.birthday} onChange={(e) => setCreateForm({ ...createForm, birthday: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-enrolledDate">Enrolled Date</Label>
                <Input id="c-enrolledDate" type="date" value={createForm.enrolledDate} onChange={(e) => setCreateForm({ ...createForm, enrolledDate: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-address">Address</Label>
              <Input id="c-address" value={createForm.address} onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })} />
            </div>
            <div className="border-t pt-4">
              <p className="mb-3 text-sm font-medium text-muted-foreground">Guardian Information</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="c-guardianContact">Guardian Contact <span className="text-destructive">*</span></Label>
                  <Input id="c-guardianContact" value={createForm.guardianContactNumber} onChange={(e) => setCreateForm({ ...createForm, guardianContactNumber: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-guardianEmail">Guardian Email <span className="text-destructive">*</span></Label>
                  <Input id="c-guardianEmail" type="email" value={createForm.guardianEmail} onChange={(e) => setCreateForm({ ...createForm, guardianEmail: e.target.value })} required />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setCreateOpen(false); setCreateForm(makeEmptyCreateForm()); }}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Student'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => { if (!open) { setEditOpen(false); setEditing(null); } }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
            <DialogDescription>
              Updating this student will also sync the linked user account.
            </DialogDescription>
          </DialogHeader>
          {editForm && (
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="e-firstName">First Name <span className="text-destructive">*</span></Label>
                  <Input id="e-firstName" value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="e-lastName">Last Name <span className="text-destructive">*</span></Label>
                  <Input id="e-lastName" value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="e-middleName">Middle Name</Label>
                <Input id="e-middleName" value={editForm.middleName} onChange={(e) => setEditForm({ ...editForm, middleName: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="e-studentId">Student ID Number <span className="text-destructive">*</span></Label>
                  <Input id="e-studentId" value={editForm.studentIdNumber} onChange={(e) => setEditForm({ ...editForm, studentIdNumber: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="e-yearLevel">Year Level <span className="text-destructive">*</span></Label>
                  <Select value={editForm.yearLevel} onValueChange={(v) => setEditForm({ ...editForm, yearLevel: v as YearLevel })}>
                    <SelectTrigger id="e-yearLevel">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {YEAR_LEVELS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="e-email">Email <span className="text-destructive">*</span></Label>
                  <Input id="e-email" type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="e-contact">Contact Number <span className="text-destructive">*</span></Label>
                  <Input id="e-contact" value={editForm.contactNumber} onChange={(e) => setEditForm({ ...editForm, contactNumber: e.target.value })} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="e-birthday">Birthday</Label>
                  <Input id="e-birthday" type="date" value={editForm.birthday} onChange={(e) => setEditForm({ ...editForm, birthday: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="e-enrolledDate">Enrolled Date</Label>
                  <Input id="e-enrolledDate" type="date" value={editForm.enrolledDate} onChange={(e) => setEditForm({ ...editForm, enrolledDate: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="e-address">Address</Label>
                <Input id="e-address" value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
              </div>
              <div className="border-t pt-4">
                <p className="mb-3 text-sm font-medium text-muted-foreground">Guardian Information</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="e-guardianContact">Guardian Contact <span className="text-destructive">*</span></Label>
                    <Input id="e-guardianContact" value={editForm.guardianContactNumber} onChange={(e) => setEditForm({ ...editForm, guardianContactNumber: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="e-guardianEmail">Guardian Email <span className="text-destructive">*</span></Label>
                    <Input id="e-guardianEmail" type="email" value={editForm.guardianEmail} onChange={(e) => setEditForm({ ...editForm, guardianEmail: e.target.value })} required />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 border-t pt-4">
                <div className="space-y-2">
                  <Label htmlFor="e-status">Status</Label>
                  <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v as StudentStatus })}>
                    <SelectTrigger id="e-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end pb-1">
                  <div className="flex items-center gap-3">
                    <Switch
                      id="e-active"
                      checked={editForm.active}
                      onCheckedChange={(checked) => setEditForm({ ...editForm, active: checked })}
                    />
                    <Label htmlFor="e-active">Active</Label>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setEditOpen(false); setEditing(null); }}>Cancel</Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={postCreateConfirmOpen}
        onOpenChange={(open) => {
          setPostCreateConfirmOpen(open);
          if (!open) {
            setPostCreateStudent(null);
            setPostCreateEnrollmentPrefill(null);
          }
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Student created successfully</AlertDialogTitle>
            <AlertDialogDescription>
              Would you like to open the enrollment dialog now, or do it later from the student list?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={resetPostCreateFlow}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { void handleProceedToEnroll(); }}>
              Proceed to enrollment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={enrollOpen} onOpenChange={(open) => { if (!open) closeEnrollDialog(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingEnrollmentId ? 'Edit enrollment' : 'Enroll student'}</DialogTitle>
            <DialogDescription>
              {enrollingStudent
                ? editingEnrollmentId
                  ? `View or update enrollment for ${fullName(enrollingStudent)}`
                  : `Create enrollment record for ${fullName(enrollingStudent)}`
                : 'Enrollment record'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEnrollment} className="relative space-y-4">
            {enrollOpenLoading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg bg-background/80 backdrop-blur-sm">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Loading enrollment…</span>
              </div>
            )}
            <div className="space-y-2">
              <Label>Course <span className="text-destructive">*</span></Label>
              <Select
                value={enrollmentForm.courseId}
                onValueChange={(v) => setEnrollmentForm({ ...enrollmentForm, courseId: v, sectionId: '' })}
                disabled={enrollOpenLoading}
              >
                <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                <SelectContent>
                  {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Section</Label>
              <Select
                value={enrollmentForm.sectionId || 'none'}
                onValueChange={(v) => setEnrollmentForm({ ...enrollmentForm, sectionId: v === 'none' ? '' : v })}
                disabled={enrollOpenLoading}
              >
                <SelectTrigger><SelectValue placeholder="Optional section" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {sortedSections
                    .filter((s) => !enrollmentForm.courseId || s.courseId === enrollmentForm.courseId)
                    .map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.code}) - {s.yearLevel}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>School Year <span className="text-destructive">*</span></Label>
                <Input
                  value={enrollmentForm.schoolYear}
                  onChange={(e) => setEnrollmentForm({ ...enrollmentForm, schoolYear: e.target.value })}
                  placeholder="2026-2027"
                  required
                  disabled={enrollOpenLoading}
                />
              </div>
              <div className="space-y-2">
                <Label>Year Level <span className="text-destructive">*</span></Label>
                <Select
                  value={enrollmentForm.yearLevel}
                  onValueChange={(v) => setEnrollmentForm({ ...enrollmentForm, yearLevel: v as YearLevel })}
                  disabled={enrollOpenLoading}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {YEAR_LEVELS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Enrolled Date</Label>
                <Input
                  type="date"
                  value={enrollmentForm.enrolledDate}
                  onChange={(e) => setEnrollmentForm({ ...enrollmentForm, enrolledDate: e.target.value })}
                  disabled={enrollOpenLoading}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={enrollmentForm.status}
                  onValueChange={(v) => setEnrollmentForm({ ...enrollmentForm, status: v as EnrollmentStatus })}
                  disabled={enrollOpenLoading}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ENROLLMENT_STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Student Type <span className="text-destructive">*</span></Label>
              <Select
                value={enrollmentForm.studentType || 'none'}
                onValueChange={(v) => setEnrollmentForm({ ...enrollmentForm, studentType: v === 'none' ? '' : (v as StudentType) })}
                disabled={enrollOpenLoading}
              >
                <SelectTrigger><SelectValue placeholder="Select student type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select student type</SelectItem>
                  {STUDENT_TYPE_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Remarks</Label>
              <Input
                value={enrollmentForm.remarks}
                onChange={(e) => setEnrollmentForm({ ...enrollmentForm, remarks: e.target.value })}
                disabled={enrollOpenLoading}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={enrollmentForm.active}
                onCheckedChange={(checked) => {
                  setEnrollmentForm({ ...enrollmentForm, active: checked });
                  setEnrollmentActiveDirty(true);
                }}
                id="enroll-active"
                disabled={enrollOpenLoading}
              />
              <Label htmlFor="enroll-active">Set as active enrollment</Label>
            </div>
            <DialogFooter>
              {editingEnrollmentId && enrollmentForm.studentType === 'irregular' && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIrregularOpen(true)}
                  disabled={enrollOpenLoading}
                >
                  Manage irregular plan
                </Button>
              )}
              <Button type="button" variant="outline" onClick={closeEnrollDialog}>Cancel</Button>
              <Button
                type="submit"
                disabled={
                  enrollOpenLoading
                  || createEnrollmentMutation.isPending
                  || updateEnrollmentMutation.isPending
                }
              >
                {createEnrollmentMutation.isPending || updateEnrollmentMutation.isPending
                  ? 'Saving...'
                  : editingEnrollmentId
                    ? 'Update enrollment'
                    : 'Save enrollment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={irregularOpen} onOpenChange={(open) => { if (!open) { setIrregularOpen(false); setIrregularForm(EMPTY_IRREGULAR_PLAN); setEditingOverrideId(null); } }}>
        <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Irregular Subject Plan</DialogTitle>
            <DialogDescription>
              Add or remove subject schedule overrides for {enrollingStudent ? fullName(enrollingStudent) : 'student'}.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Active Overrides</CardTitle>
              </CardHeader>
              <CardContent>
                {overridesLoading ? (
                  <p className="text-sm text-muted-foreground">Loading overrides...</p>
                ) : (studentOverridesData?.rows?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">No active overrides.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Teacher</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {studentOverridesData?.rows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.assignmentType}</TableCell>
                          <TableCell>{row.subject?.name ?? row.assignment?.subject?.name ?? '—'}</TableCell>
                          <TableCell>
                            {row.teacher
                              ? `${row.teacher.firstName} ${row.teacher.lastName}`
                              : (row.assignment?.teacher ? `${row.assignment.teacher.firstName} ${row.assignment.teacher.lastName}` : '—')}
                          </TableCell>
                          <TableCell>{row.startTime && row.endTime ? `${String(row.startTime).slice(0, 5)}-${String(row.endTime).slice(0, 5)}` : '—'}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              className="mr-2"
                              onClick={() => startEditOverride(row)}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteOverrideMutation.mutate(row.id)}
                              disabled={deleteOverrideMutation.isPending}
                            >
                              Remove
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
                <CardTitle className="text-base">{editingOverrideId ? 'Edit Override' : 'Add Override'}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateOverride} className="space-y-3">
                  <div className="space-y-2">
                    <Label>Assignment Type</Label>
                    <Select
                      value={irregularForm.assignmentType}
                      onValueChange={(v) => setIrregularForm({ ...irregularForm, assignmentType: v as StudentAssignmentType })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ASSIGNMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Base Section Assignment (for REMOVE/REPLACE)</Label>
                    <Select
                      value={irregularForm.baseSectionSubjectTeacherId || 'none'}
                      onValueChange={(v) => setIrregularForm({ ...irregularForm, baseSectionSubjectTeacherId: v === 'none' ? '' : v })}
                    >
                      <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {sectionAssignmentOptions.map((row) => (
                          <SelectItem key={`base-${row.id}`} value={row.id}>
                            {row.subject?.name ?? row.subjectId} - {row.teacher ? `${row.teacher.firstName} ${row.teacher.lastName}` : row.teacherId} ({formatTimeRange(row.startTime, row.endTime)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {requiresBaseAssignment && !irregularForm.baseSectionSubjectTeacherId && (
                      <p className="text-xs text-destructive">Required for {irregularForm.assignmentType}.</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Reuse Existing Assignment (optional)</Label>
                    <Select
                      value={irregularForm.sectionSubjectTeacherId || 'none'}
                      onValueChange={(v) => setIrregularForm({ ...irregularForm, sectionSubjectTeacherId: v === 'none' ? '' : v })}
                    >
                      <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {allSectionAssignments.map((row) => (
                          <SelectItem key={`linked-${row.id}`} value={row.id}>
                            {row.section?.name ?? row.sectionId} - {row.subject?.name ?? row.subjectId} ({formatTimeRange(row.startTime, row.endTime)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Subject</Label>
                      <Select
                        value={irregularForm.subjectId || 'none'}
                        onValueChange={(v) => setIrregularForm({ ...irregularForm, subjectId: v === 'none' ? '' : v })}
                        disabled={irregularForm.assignmentType === 'REMOVE'}
                      >
                        <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Teacher</Label>
                      <Select
                        value={irregularForm.teacherId || 'none'}
                        onValueChange={(v) => setIrregularForm({ ...irregularForm, teacherId: v === 'none' ? '' : v })}
                        disabled={irregularForm.assignmentType === 'REMOVE'}
                      >
                        <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {teachers.map((t) => <SelectItem key={t.id} value={t.id}>{t.firstName} {t.lastName}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Effective From</Label>
                      <Input
                        type="date"
                        value={irregularForm.effectiveFrom}
                        onChange={(e) => setIrregularForm({ ...irregularForm, effectiveFrom: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Effective To</Label>
                      <Input
                        type="date"
                        value={irregularForm.effectiveTo}
                        onChange={(e) => setIrregularForm({ ...irregularForm, effectiveTo: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Days of Week</Label>
                    <div className="flex flex-wrap gap-2">
                      {WEEK_DAYS.map((d) => {
                        const selected = irregularForm.daysOfWeek.includes(d);
                        return (
                          <Button
                            key={d}
                            type="button"
                            size="sm"
                            variant={selected ? 'default' : 'outline'}
                            disabled={!needsScheduleFields}
                            onClick={() => {
                              setIrregularForm((prev) => ({
                                ...prev,
                                daysOfWeek: prev.daysOfWeek.includes(d)
                                  ? prev.daysOfWeek.filter((x) => x !== d)
                                  : [...prev.daysOfWeek, d],
                              }));
                            }}
                          >
                            {d}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Start Time</Label>
                      <Input
                        type="time"
                        value={irregularForm.startTime}
                        onChange={(e) => setIrregularForm({ ...irregularForm, startTime: e.target.value })}
                        disabled={!needsScheduleFields}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>End Time</Label>
                      <Input
                        type="time"
                        value={irregularForm.endTime}
                        onChange={(e) => setIrregularForm({ ...irregularForm, endTime: e.target.value })}
                        disabled={!needsScheduleFields}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Remarks</Label>
                    <Input
                      value={irregularForm.remarks}
                      onChange={(e) => setIrregularForm({ ...irregularForm, remarks: e.target.value })}
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    {editingOverrideId && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setEditingOverrideId(null);
                          setIrregularForm(EMPTY_IRREGULAR_PLAN);
                        }}
                      >
                        Cancel edit
                      </Button>
                    )}
                    <Button type="submit" disabled={createOverrideMutation.isPending || updateOverrideMutation.isPending}>
                      {createOverrideMutation.isPending || updateOverrideMutation.isPending
                        ? 'Saving...'
                        : editingOverrideId
                          ? 'Update override'
                          : 'Add override'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resolved Final Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              {finalScheduleConflicts.length > 0 && (
                <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/5 p-3">
                  <p className="text-sm font-medium text-destructive">Potential schedule conflicts detected:</p>
                  <ul className="mt-1 text-xs text-destructive">
                    {finalScheduleConflicts.map((issue) => (
                      <li key={issue}>- {issue}</li>
                    ))}
                  </ul>
                </div>
              )}
              {finalScheduleLoading ? (
                <p className="text-sm text-muted-foreground">Loading final schedule...</p>
              ) : (finalScheduleData?.rows?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">No schedule rows resolved.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Teacher</TableHead>
                      <TableHead>Days</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {finalScheduleData?.rows.map((row) => (
                      <TableRow key={`${row.source}-${row.assignmentId ?? row.overrideId ?? row.subjectId ?? 'row'}`}>
                        <TableCell>{row.source}</TableCell>
                        <TableCell>{row.section?.name ?? '—'}</TableCell>
                        <TableCell>{row.subject?.name ?? '—'}</TableCell>
                        <TableCell>{row.teacher ? `${row.teacher.firstName} ${row.teacher.lastName}` : '—'}</TableCell>
                        <TableCell>{(row.daysOfWeek || []).join(', ') || '—'}</TableCell>
                        <TableCell>{row.startTime && row.endTime ? `${row.startTime}-${row.endTime}` : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
