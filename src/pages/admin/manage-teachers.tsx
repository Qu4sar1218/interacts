import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  teacherService,
  type Teacher,
  type TeacherCreatePayload,
  type TeacherSubjectListItem,
  type TeacherUpdatePayload,
} from '@/services/teacher.service';
import { departmentService } from '@/services/department.service';
import {
  formatSubjectYear,
  subjectService,
  SUBJECT_YEAR_FILTER_OPTIONS,
  type Subject,
  type SubjectYear,
} from '@/services/subject.service';
import { toast } from 'sonner';
import { Search, Plus, Pencil, GraduationCap, Link2, Loader2 } from 'lucide-react';
import {
  dashboardService,
  type TeacherAssignedSectionsResponse,
  type TeacherSectionStudent,
} from '@/services/dashboard.service';
import { useClientPagination } from '@/hooks/useClientPagination';
import { TablePaginationControls } from '@/components/TablePaginationControls';

interface CreateForm {
  firstName: string;
  lastName: string;
  middleName: string;
  username: string;
  password: string;
  email: string;
  phoneNumber: string;
  address: string;
  teacherDepartmentId: string;
}

interface EditForm {
  firstName: string;
  lastName: string;
  middleName: string;
  email: string;
  phoneNumber: string;
  address: string;
  teacherDepartmentId: string;
  active: boolean;
}

const EMPTY_CREATE: CreateForm = {
  firstName: '', lastName: '', middleName: '', username: '', password: '',
  email: '', phoneNumber: '', address: '', teacherDepartmentId: '',
};
const toEditForm = (t: Teacher): EditForm => ({
  firstName: t.firstName,
  lastName: t.lastName,
  middleName: t.middleName ?? '',
  email: t.email,
  phoneNumber: t.phoneNumber ?? '',
  address: t.address ?? '',
  teacherDepartmentId: t.teacherDepartmentId ?? '',
  active: t.active,
});

function fullName(t: Teacher) {
  return [t.firstName, t.middleName, t.lastName].filter(Boolean).join(' ');
}

function fullNameFromSubjectRow(row: TeacherSubjectListItem): string {
  const t = row.teacher;
  if (!t) return '—';
  return [t.firstName, t.middleName, t.lastName].filter(Boolean).join(' ');
}

function formatScheduleDays(days: string[] | null | undefined): string {
  if (!days?.length) return '—';
  return days.join(', ');
}

function assignedClassStatusVariant(
  status: TeacherSectionStudent['status'],
): 'default' | 'secondary' | 'outline' {
  if (status === 'enrolled') return 'default';
  if (status === 'dropped') return 'secondary';
  return 'outline';
}

function assignedClassStatusLabel(status: TeacherSectionStudent['status']): string {
  if (!status) return 'Unknown';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

type AssignmentRosterRow = NonNullable<TeacherAssignedSectionsResponse['assignmentRosters']>[number];

function groupAssignmentRostersBySection(rosters: AssignmentRosterRow[]) {
  const bySection = new Map<string, AssignmentRosterRow[]>();
  for (const r of rosters) {
    const arr = bySection.get(r.sectionId) ?? [];
    arr.push(r);
    bySection.set(r.sectionId, arr);
  }
  return [...bySection.entries()]
    .map(([sectionId, items]) => ({
      sectionId,
      sectionName: items[0]?.sectionName ?? null,
      sectionCode: items[0]?.sectionCode ?? null,
      rosters: items.slice().sort((a, b) => (a.subjectName ?? '').localeCompare(b.subjectName ?? '')),
    }))
    .sort((a, b) => (a.sectionName ?? '').localeCompare(b.sectionName ?? ''));
}

export default function ManageTeachers() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [teachersPageIndex, setTeachersPageIndex] = useState(0);
  const [teachersPageSize, setTeachersPageSize] = useState(10);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [subjectDialogOpen, setSubjectDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [subjectSearch, setSubjectSearch] = useState('');
  const [subjectYearFilter, setSubjectYearFilter] = useState<'all' | SubjectYear>('all');
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'subjects' | 'sections' | 'assigned-class'>('all');
  const [assignedClassTeacherId, setAssignedClassTeacherId] = useState<string>('');
  const [subjectListSearch, setSubjectListSearch] = useState('');
  const [sectionListSearch, setSectionListSearch] = useState('');
  const [teacherSubjectsPageIndex, setTeacherSubjectsPageIndex] = useState(0);
  const [teacherSubjectsPageSize, setTeacherSubjectsPageSize] = useState(10);
  const [sectionAssignmentsPageIndex, setSectionAssignmentsPageIndex] = useState(0);
  const [sectionAssignmentsPageSize, setSectionAssignmentsPageSize] = useState(10);
  const [postCreateConfirmOpen, setPostCreateConfirmOpen] = useState(false);
  const [postCreateTeacher, setPostCreateTeacher] = useState<Teacher | null>(null);

  const { data: teachers = [], isLoading } = useQuery({
    queryKey: ['teachers'],
    queryFn: () => teacherService.getTeachers(),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentService.getDepartments({ active: true }),
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectService.getSubjects({ active: true }),
  });

  const { data: teacherSubjectRows = [], isLoading: teacherSubjectsLoading } = useQuery({
    queryKey: ['teacher-subjects', { active: true }],
    queryFn: () => teacherService.getAllTeacherSubjects({ active: true }),
    enabled: activeTab === 'subjects',
  });

  const { data: sectionAssignments = [], isLoading: sectionAssignmentsLoading } = useQuery({
    queryKey: ['section-subject-assignments', { active: true }],
    queryFn: () => teacherService.getAllSectionSubjectAssignments({ active: true }),
    enabled: activeTab === 'sections',
  });

  const {
    data: assignedClassData,
    isLoading: assignedClassLoading,
    isError: assignedClassError,
    error: assignedClassErr,
  } = useQuery({
    queryKey: ['teacher-assigned-sections', assignedClassTeacherId],
    queryFn: () => dashboardService.getTeacherAssignedSections({ teacherId: assignedClassTeacherId }),
    enabled: activeTab === 'assigned-class' && Boolean(assignedClassTeacherId),
  });

  const assignedClassSectionsGrouped = groupAssignmentRostersBySection(
    assignedClassData?.assignmentRosters ?? [],
  );
  const assignedClassSectionSummaries = assignedClassData?.sections ?? [];

  const createMutation = useMutation({
    mutationFn: (payload: TeacherCreatePayload) => teacherService.createTeacher(payload),
    onSuccess: (createdTeacher) => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      toast.success('Teacher created successfully');
      setCreateOpen(false);
      setCreateForm(EMPTY_CREATE);
      setPostCreateTeacher(createdTeacher);
      setPostCreateConfirmOpen(true);
    },
    onError: (err: Error) => toast.error('Failed to create teacher', { description: err.message }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TeacherUpdatePayload }) =>
      teacherService.updateTeacher(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      toast.success('Teacher updated successfully');
      setEditOpen(false);
      setEditing(null);
    },
    onError: (err: Error) => toast.error('Failed to update teacher', { description: err.message }),
  });

  const assignSubjectsMutation = useMutation({
    mutationFn: ({ teacherId, subjectIds }: { teacherId: string; subjectIds: string[] }) =>
      teacherService.assignSubjectsToTeacher(teacherId, subjectIds),
    onSuccess: () => {
      toast.success('Teacher subjects updated successfully');
      closeSubjectDialog();
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-subjects'] });
      queryClient.invalidateQueries({ queryKey: ['section-subject-assignments'] });
    },
    onError: (err: Error) => toast.error('Failed to update teacher subjects', { description: err.message }),
  });

  const filtered = teachers.filter((t) => {
    const q = search.toLowerCase();
    return (
      fullName(t).toLowerCase().includes(q) ||
      t.email.toLowerCase().includes(q) ||
      (t.username ?? '').toLowerCase().includes(q)
    );
  });
  const teachersPagination = useClientPagination(filtered, teachersPageIndex, teachersPageSize);
  const filteredSubjects = subjects.filter((subject) => {
    const query = subjectSearch.trim().toLowerCase();
    const matchesSearch = query.length === 0
      || subject.name.toLowerCase().includes(query)
      || subject.code.toLowerCase().includes(query);
    const matchesYear = subjectYearFilter === 'all' || subject.year === subjectYearFilter;
    return matchesSearch && matchesYear;
  });

  const filteredTeacherSubjectRows = teacherSubjectRows.filter((row) => {
    const q = subjectListSearch.trim().toLowerCase();
    if (!q) return true;
    const name = fullNameFromSubjectRow(row).toLowerCase();
    const subj = row.subject;
    const subjText = subj
      ? `${subj.name} ${subj.code} ${formatSubjectYear(subj.year ?? null)}`.toLowerCase()
      : '';
    return name.includes(q) || subjText.includes(q) || (row.teacher?.email ?? '').toLowerCase().includes(q);
  });
  const teacherSubjectsPagination = useClientPagination(
    filteredTeacherSubjectRows,
    teacherSubjectsPageIndex,
    teacherSubjectsPageSize,
  );

  const filteredSectionAssignments = sectionAssignments.filter((row) => {
    const q = sectionListSearch.trim().toLowerCase();
    if (!q) return true;
    const teacher = row.teacher;
    const teacherName = teacher
      ? [teacher.firstName, teacher.middleName, teacher.lastName].filter(Boolean).join(' ').toLowerCase()
      : '';
    const sec = row.section;
    const secText = sec ? `${sec.name} ${sec.code}`.toLowerCase() : '';
    const subj = row.subject;
    const subjText = subj ? `${subj.name} ${subj.code}`.toLowerCase() : '';
    return teacherName.includes(q) || secText.includes(q) || subjText.includes(q);
  });
  const sectionAssignmentsPagination = useClientPagination(
    filteredSectionAssignments,
    sectionAssignmentsPageIndex,
    sectionAssignmentsPageSize,
  );

  useEffect(() => {
    setTeachersPageIndex(0);
  }, [search]);

  useEffect(() => {
    if (teachersPageIndex !== teachersPagination.pageIndex) {
      setTeachersPageIndex(teachersPagination.pageIndex);
    }
  }, [teachersPageIndex, teachersPagination.pageIndex]);

  useEffect(() => {
    setTeacherSubjectsPageIndex(0);
  }, [subjectListSearch, activeTab]);

  useEffect(() => {
    if (teacherSubjectsPageIndex !== teacherSubjectsPagination.pageIndex) {
      setTeacherSubjectsPageIndex(teacherSubjectsPagination.pageIndex);
    }
  }, [teacherSubjectsPageIndex, teacherSubjectsPagination.pageIndex]);

  useEffect(() => {
    setSectionAssignmentsPageIndex(0);
  }, [sectionListSearch, activeTab]);

  useEffect(() => {
    if (sectionAssignmentsPageIndex !== sectionAssignmentsPagination.pageIndex) {
      setSectionAssignmentsPageIndex(sectionAssignmentsPagination.pageIndex);
    }
  }, [sectionAssignmentsPageIndex, sectionAssignmentsPagination.pageIndex]);

  const teacherFromSubjectRow = (row: TeacherSubjectListItem): Teacher | null => {
    const t = row.teacher;
    if (!t) return null;
    const existing = teachers.find((x) => x.id === t.id);
    if (existing) return existing;
    return {
      id: t.id,
      firstName: t.firstName,
      lastName: t.lastName,
      middleName: t.middleName ?? null,
      username: '',
      email: t.email,
      phoneNumber: null,
      address: null,
      birthday: null,
      active: t.active,
      schoolId: null,
      teacherDepartmentId: null,
      createdAt: '',
      updatedAt: '',
    };
  };

  const closeSubjectDialog = () => {
    setSubjectDialogOpen(false);
    setSelectedTeacher(null);
    setSelectedSubjectIds([]);
    setSubjectSearch('');
    setSubjectYearFilter('all');
  };

  const openEdit = (teacher: Teacher) => {
    setEditing(teacher);
    setEditForm(toEditForm(teacher));
    setEditOpen(true);
  };

  const openSubjectDialog = async (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setSubjectDialogOpen(true);
    setSubjectSearch('');
    setSubjectYearFilter('all');
    try {
      const mappings = await teacherService.getTeacherSubjects(teacher.id, { active: true });
      setSelectedSubjectIds(mappings.map((m) => m.subjectId));
      queryClient.setQueryData(['teacher-subjects', teacher.id], mappings);
    } catch {
      toast.error('Failed to load teacher subjects');
      setSelectedSubjectIds([]);
    }
  };

  const resetPostCreateTeacherFlow = () => {
    setPostCreateConfirmOpen(false);
    setPostCreateTeacher(null);
  };

  const handleProceedToAssignSubjects = async () => {
    if (!postCreateTeacher) {
      toast.error('Could not continue to assign subjects', {
        description: 'The created teacher record is no longer available. Use Assign subjects from the list.',
      });
      resetPostCreateTeacherFlow();
      return;
    }
    const teacher = postCreateTeacher;
    resetPostCreateTeacherFlow();
    await openSubjectDialog(teacher);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: TeacherCreatePayload = {
      firstName: createForm.firstName,
      lastName: createForm.lastName,
      middleName: createForm.middleName || undefined,
      username: createForm.username,
      password: createForm.password,
      email: createForm.email,
      phoneNumber: createForm.phoneNumber || undefined,
      address: createForm.address || undefined,
      teacherDepartmentId: createForm.teacherDepartmentId || undefined,
    };
    createMutation.mutate(payload);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !editForm) return;
    const payload: TeacherUpdatePayload = {
      firstName: editForm.firstName,
      lastName: editForm.lastName,
      middleName: editForm.middleName || undefined,
      email: editForm.email,
      phoneNumber: editForm.phoneNumber || undefined,
      address: editForm.address || undefined,
      teacherDepartmentId: editForm.teacherDepartmentId || undefined,
      active: editForm.active,
    };
    updateMutation.mutate({ id: editing.id, payload });
  };

  const toggleSubject = (subject: Subject, checked: boolean | 'indeterminate') => {
    if (checked) {
      setSelectedSubjectIds((prev) => [...new Set([...prev, subject.id])]);
      return;
    }
    setSelectedSubjectIds((prev) => prev.filter((id) => id !== subject.id));
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex h-[80vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="mt-4 text-muted-foreground">Loading teachers...</p>
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
            <h1 className="page-header">Manage Teachers</h1>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Teacher
            </Button>
          </div>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'all' | 'subjects' | 'sections' | 'assigned-class')}
          className="space-y-4 md:space-y-6"
        >
          <TabsList className="h-auto w-full flex-wrap rounded-xl border border-primary/20 bg-card/60 p-1 backdrop-blur-sm sm:w-auto">
            <TabsTrigger
              value="all"
              className="rounded-lg px-4 py-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              All Teachers
            </TabsTrigger>
            <TabsTrigger
              value="subjects"
              className="rounded-lg px-4 py-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Assigned subjects
            </TabsTrigger>
            <TabsTrigger
              value="sections"
              className="rounded-lg px-4 py-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Assigned sections
            </TabsTrigger>
            <TabsTrigger
              value="assigned-class"
              className="rounded-lg px-4 py-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Assigned Class
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-0">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>All Teachers</CardTitle>
                    <CardDescription>{teachers.length} teacher{teachers.length !== 1 ? 's' : ''}</CardDescription>
                  </div>
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or email..."
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
                    <GraduationCap className="h-12 w-12 text-muted-foreground/30" />
                    <p className="mt-3 text-base font-medium">
                      {teachers.length === 0 ? 'No teachers yet' : 'No teachers found'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {teachers.length === 0 ? 'Add your first teacher to get started' : 'Try a different search'}
                    </p>
                    {teachers.length === 0 && (
                      <Button className="mt-4" onClick={() => setCreateOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" /> Add Teacher
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Username</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teachersPagination.pageItems.map((teacher) => (
                          <TableRow key={teacher.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted font-medium text-sm">
                                  {teacher.firstName.charAt(0)}{teacher.lastName.charAt(0)}
                                </div>
                                <span className="font-medium">{fullName(teacher)}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{teacher.username}</TableCell>
                            <TableCell className="text-muted-foreground">{teacher.email}</TableCell>
                            <TableCell>{teacher.department?.name ?? '-'}</TableCell>
                            <TableCell>
                              <Badge variant={teacher.active ? 'default' : 'secondary'}>
                                {teacher.active ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" onClick={() => openSubjectDialog(teacher)} title="Assign subjects">
                                <Link2 className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => openEdit(teacher)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <TablePaginationControls
                      pageIndex={teachersPagination.pageIndex}
                      pageSize={teachersPagination.pageSize}
                      totalItems={teachersPagination.totalItems}
                      onPageIndexChange={setTeachersPageIndex}
                      onPageSizeChange={(next) => {
                        setTeachersPageSize(next);
                        setTeachersPageIndex(0);
                      }}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subjects" className="mt-0">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <CardTitle>Assigned subjects</CardTitle>
                    <CardDescription>
                      Subject eligibility per teacher. Use Assign subjects on All Teachers to make changes.
                    </CardDescription>
                  </div>
                  <div className="relative w-full lg:w-72">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Filter by teacher, subject, email..."
                      value={subjectListSearch}
                      onChange={(e) => setSubjectListSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {teacherSubjectsLoading ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="mt-3 text-sm text-muted-foreground">Loading assignments…</p>
                  </div>
                ) : filteredTeacherSubjectRows.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {teacherSubjectRows.length === 0
                      ? 'No subject assignments yet.'
                      : 'No rows match your filter.'}
                  </p>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Teacher</TableHead>
                          <TableHead>Subject</TableHead>
                          <TableHead>Code</TableHead>
                          <TableHead>Year</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teacherSubjectsPagination.pageItems.map((row) => {
                          const t = teacherFromSubjectRow(row);
                          return (
                            <TableRow key={row.id}>
                              <TableCell className="font-medium">{fullNameFromSubjectRow(row)}</TableCell>
                              <TableCell>{row.subject?.name ?? '—'}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{row.subject?.code ?? '—'}</Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {row.subject?.year != null ? formatSubjectYear(row.subject.year) : '—'}
                              </TableCell>
                              <TableCell>
                                <Badge variant={row.active ? 'default' : 'secondary'}>
                                  {row.active ? 'Active' : 'Inactive'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                {t && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    title="Assign subjects"
                                    onClick={() => openSubjectDialog(t)}
                                  >
                                    <Link2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    <TablePaginationControls
                      pageIndex={teacherSubjectsPagination.pageIndex}
                      pageSize={teacherSubjectsPagination.pageSize}
                      totalItems={teacherSubjectsPagination.totalItems}
                      onPageIndexChange={setTeacherSubjectsPageIndex}
                      onPageSizeChange={(next) => {
                        setTeacherSubjectsPageSize(next);
                        setTeacherSubjectsPageIndex(0);
                      }}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sections" className="mt-0">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <CardTitle>Assigned sections</CardTitle>
                  </div>
                  <div className="relative w-full lg:w-72">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Filter by teacher, section, subject..."
                      value={sectionListSearch}
                      onChange={(e) => setSectionListSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {sectionAssignmentsLoading ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="mt-3 text-sm text-muted-foreground">Loading assignments…</p>
                  </div>
                ) : filteredSectionAssignments.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {sectionAssignments.length === 0
                      ? 'No section assignments yet.'
                      : 'No rows match your filter.'}
                  </p>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Teacher</TableHead>
                          <TableHead>Section</TableHead>
                          <TableHead>Subject</TableHead>
                          <TableHead>Days</TableHead>
                          <TableHead>Time</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sectionAssignmentsPagination.pageItems.map((row) => {
                          const teacher = row.teacher;
                          const teacherName = teacher
                            ? [teacher.firstName, teacher.middleName, teacher.lastName].filter(Boolean).join(' ')
                            : '—';
                          const timeLabel = [row.startTime, row.endTime].filter(Boolean).join(' – ') || '—';
                          return (
                            <TableRow key={row.id}>
                              <TableCell className="font-medium">{teacherName}</TableCell>
                              <TableCell>
                                <span className="text-muted-foreground">
                                  {row.section ? `${row.section.name} (${row.section.code})` : '—'}
                                </span>
                                {row.section?.yearLevel ? (
                                  <span className="ml-1 text-xs text-muted-foreground">· {row.section.yearLevel}</span>
                                ) : null}
                              </TableCell>
                              <TableCell>
                                {row.subject ? `${row.subject.name} (${row.subject.code})` : '—'}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {formatScheduleDays(row.daysOfWeek ?? undefined)}
                              </TableCell>
                              <TableCell className="font-mono text-sm">{timeLabel}</TableCell>
                              <TableCell>
                                <Badge variant={row.active ? 'default' : 'secondary'}>
                                  {row.active ? 'Active' : 'Inactive'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    <TablePaginationControls
                      pageIndex={sectionAssignmentsPagination.pageIndex}
                      pageSize={sectionAssignmentsPagination.pageSize}
                      totalItems={sectionAssignmentsPagination.totalItems}
                      onPageIndexChange={setSectionAssignmentsPageIndex}
                      onPageSizeChange={(next) => {
                        setSectionAssignmentsPageSize(next);
                        setSectionAssignmentsPageIndex(0);
                      }}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="assigned-class" className="mt-0">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <CardTitle>Assigned Class</CardTitle>
                    <CardDescription>
                      Students per section and subject for a teacher’s teaching assignments (enrollment plus irregular overrides).
                    </CardDescription>
                  </div>
                  <div className="w-full max-w-md space-y-2">
                    <Label htmlFor="assigned-class-teacher" className="text-muted-foreground">
                      Teacher
                    </Label>
                    <Select
                      value={assignedClassTeacherId || undefined}
                      onValueChange={(v) => setAssignedClassTeacherId(v)}
                    >
                      <SelectTrigger id="assigned-class-teacher" className="w-full">
                        <SelectValue placeholder="Select a teacher" />
                      </SelectTrigger>
                      <SelectContent>
                        {teachers.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {fullName(t)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {!assignedClassTeacherId ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Select a teacher to view assigned classes, sections, and student rosters per subject.
                  </p>
                ) : assignedClassLoading ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="mt-3 text-sm text-muted-foreground">Loading assigned class…</p>
                  </div>
                ) : assignedClassError ? (
                  <p className="py-8 text-center text-sm text-destructive">
                    {assignedClassErr instanceof Error ? assignedClassErr.message : 'Failed to load assigned class.'}
                  </p>
                ) : assignedClassSectionsGrouped.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No section–subject assignments or students found for this teacher.
                  </p>
                ) : (
                  <div className="space-y-8">
                    {assignedClassSectionsGrouped.map((block) => {
                      const summary = assignedClassSectionSummaries.find((s) => s.sectionId === block.sectionId);
                      const headcount = summary?.students?.length ?? null;
                      return (
                        <div key={block.sectionId} className="space-y-4">
                          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-2">
                            <div>
                              <h3 className="text-base font-semibold">
                                {block.sectionName || 'Section'}{' '}
                                {block.sectionCode ? (
                                  <span className="font-normal text-muted-foreground">({block.sectionCode})</span>
                                ) : null}
                              </h3>
                            </div>
                            {headcount != null ? (
                              <Badge variant="outline">{headcount} student{headcount !== 1 ? 's' : ''} in section</Badge>
                            ) : null}
                          </div>
                          <div className="space-y-6">
                            {block.rosters.map((roster) => {
                              const timeLabel = [roster.startTime, roster.endTime].filter(Boolean).join(' – ') || '—';
                              return (
                                <div key={roster.assignmentId} className="rounded-lg border bg-card/40 p-4">
                                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                    <div className="font-medium">
                                      {roster.subjectName || 'Subject'}{' '}
                                      {roster.subjectCode ? (
                                        <Badge variant="outline" className="ml-1 align-middle">
                                          {roster.subjectCode}
                                        </Badge>
                                      ) : null}
                                    </div>
                                    <span className="font-mono text-xs text-muted-foreground">{timeLabel}</span>
                                  </div>
                                  {roster.students.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No students in this roster.</p>
                                  ) : (
                                    <div className="overflow-x-auto rounded-md border bg-background">
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead>Student</TableHead>
                                            <TableHead>Student ID</TableHead>
                                            <TableHead>Status</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {roster.students.map((student) => (
                                            <TableRow key={`${roster.assignmentId}-${student.studentId}`}>
                                              <TableCell className="font-medium">{student.fullName}</TableCell>
                                              <TableCell>
                                                <Badge variant="outline" className="text-xs">
                                                  {student.studentIdNumber || '—'}
                                                </Badge>
                                              </TableCell>
                                              <TableCell>
                                                <Badge
                                                  variant={assignedClassStatusVariant(student.status)}
                                                  className="text-xs"
                                                >
                                                  {assignedClassStatusLabel(student.status)}
                                                </Badge>
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => { if (!open) { setCreateOpen(false); setCreateForm(EMPTY_CREATE); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Teacher</DialogTitle>
            <DialogDescription>Create a new teacher account.</DialogDescription>
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
                <Label htmlFor="c-username">Username <span className="text-destructive">*</span></Label>
                <Input id="c-username" value={createForm.username} onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-password">Password <span className="text-destructive">*</span></Label>
                <Input id="c-password" type="password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-email">Email <span className="text-destructive">*</span></Label>
              <Input id="c-email" type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-phone">Phone Number</Label>
              <Input id="c-phone" value={createForm.phoneNumber} onChange={(e) => setCreateForm({ ...createForm, phoneNumber: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-dept">Department</Label>
              <Select value={createForm.teacherDepartmentId} onValueChange={(v) => setCreateForm({ ...createForm, teacherDepartmentId: v })}>
                <SelectTrigger id="c-dept">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setCreateOpen(false); setCreateForm(EMPTY_CREATE); }}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Teacher'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={postCreateConfirmOpen}
        onOpenChange={(open) => {
          setPostCreateConfirmOpen(open);
          if (!open) {
            setPostCreateTeacher(null);
          }
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Teacher created successfully</AlertDialogTitle>
            <AlertDialogDescription>
              Would you like to assign subjects now, or do it later from the teacher list?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={resetPostCreateTeacherFlow}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { void handleProceedToAssignSubjects(); }}>
              Assign Subjects
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => { if (!open) { setEditOpen(false); setEditing(null); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Teacher</DialogTitle>
            <DialogDescription>Update teacher account details.</DialogDescription>
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
              <div className="space-y-2">
                <Label htmlFor="e-email">Email <span className="text-destructive">*</span></Label>
                <Input id="e-email" type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="e-phone">Phone Number</Label>
                <Input id="e-phone" value={editForm.phoneNumber} onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="e-dept">Department</Label>
                <Select value={editForm.teacherDepartmentId} onValueChange={(v) => setEditForm({ ...editForm, teacherDepartmentId: v })}>
                  <SelectTrigger id="e-dept">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="e-active"
                  checked={editForm.active}
                  onCheckedChange={(checked) => setEditForm({ ...editForm, active: checked })}
                />
                <Label htmlFor="e-active">Active</Label>
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

      {/* Assign Subjects Dialog */}
      <Dialog open={subjectDialogOpen} onOpenChange={(open) => { if (!open) closeSubjectDialog(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign Subjects</DialogTitle>
            <DialogDescription>
              {selectedTeacher ? `Manage subjects for ${fullName(selectedTeacher)}` : 'Manage teacher subjects'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_180px]">
            <Input
              placeholder="Search subject name or code..."
              value={subjectSearch}
              onChange={(e) => setSubjectSearch(e.target.value)}
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
          <div className="max-h-[320px] space-y-3 overflow-y-auto border p-3">
            {filteredSubjects.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">No subjects match your filters.</p>
            ) : (
              filteredSubjects.map((subject) => (
                <label key={subject.id} className="flex items-center gap-3">
                  <Checkbox
                    checked={selectedSubjectIds.includes(subject.id)}
                    onCheckedChange={(checked) => toggleSubject(subject, checked)}
                  />
                  <span className="text-sm">
                    {subject.name} ({subject.code}) - {formatSubjectYear(subject.year)}
                  </span>
                </label>
              ))
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeSubjectDialog}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!selectedTeacher || assignSubjectsMutation.isPending}
              onClick={() => selectedTeacher && assignSubjectsMutation.mutate({
                teacherId: selectedTeacher.id,
                subjectIds: selectedSubjectIds
              })}
            >
              {assignSubjectsMutation.isPending ? 'Saving...' : 'Save Subjects'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
