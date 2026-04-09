import { useEffect, useState } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  subjectService,
  SUBJECT_YEAR_FILTER_OPTIONS,
  SUBJECT_YEAR_LABELS,
  SUBJECT_YEARS,
  type Subject,
  type SubjectPayload,
  type SubjectYear,
} from '@/services/subject.service';
import { courseService } from '@/services/course.service';
import { teacherService, type Teacher } from '@/services/teacher.service';
import { getApiErrorMessage } from '@/services/api';
import { toast } from 'sonner';
import { Search, Plus, Pencil, FileText, Link2 } from 'lucide-react';
import { useClientPagination } from '@/hooks/useClientPagination';
import { TablePaginationControls } from '@/components/TablePaginationControls';
const EMPTY_FORM: SubjectPayload = { name: '', code: '', year: '1st_year', description: '', active: true };

export function SubjectsTabContent() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState<'all' | string>('all');
  const [yearFilter, setYearFilter] = useState<'all' | SubjectYear>('all');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [form, setForm] = useState<SubjectPayload>(EMPTY_FORM);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [assignSearch, setAssignSearch] = useState('');

  const { data: courses = [] } = useQuery({
    queryKey: ['courses', { active: true }],
    queryFn: () => courseService.getCourses({ active: true }),
  });

  const { data: subjects = [], isLoading } = useQuery({
    queryKey: ['subjects', { courseId: courseFilter, year: yearFilter }],
    queryFn: () =>
      subjectService.getSubjects({
        ...(courseFilter !== 'all' ? { courseId: courseFilter } : {}),
        ...(yearFilter !== 'all' ? { year: yearFilter } : {}),
      }),
  });
  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers', { active: true }],
    queryFn: () => teacherService.getTeachers({ active: true }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: SubjectPayload) => subjectService.createSubject(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      toast.success('Subject created successfully');
      closeDialog();
    },
    onError: (err: Error) => toast.error('Failed to create subject', { description: err.message }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<SubjectPayload> }) =>
      subjectService.updateSubject(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      toast.success('Subject updated successfully');
      closeDialog();
    },
    onError: (err: Error) => toast.error('Failed to update subject', { description: err.message }),
  });
  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTeacherId) throw new Error('Please select a teacher.');
      if (selectedSubjectIds.length === 0) throw new Error('Please select at least one subject.');
      return teacherService.assignSubjectsToTeacher(selectedTeacherId, selectedSubjectIds);
    },
    onSuccess: () => {
      toast.success('Subjects assigned to teacher successfully');
      setAssignDialogOpen(false);
      setSelectedTeacherId('');
      setSelectedSubjectIds([]);
      setAssignSearch('');
      queryClient.invalidateQueries({ queryKey: ['teacher-subjects'] });
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      queryClient.invalidateQueries({ queryKey: ['section-subject-assignments'] });
    },
    onError: (err: unknown) => toast.error('Failed to assign subjects', {
      description: getApiErrorMessage(err, 'Unable to assign selected subjects to this teacher.'),
    }),
  });

  const filtered = subjects.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase()),
  );
  const pagination = useClientPagination(filtered, pageIndex, pageSize);

  useEffect(() => {
    setPageIndex(0);
  }, [search, courseFilter, yearFilter]);

  useEffect(() => {
    if (pageIndex !== pagination.pageIndex) setPageIndex(pagination.pageIndex);
  }, [pageIndex, pagination.pageIndex]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (subject: Subject) => {
    setEditing(subject);
    setForm({
      name: subject.name,
      code: subject.code,
      year: subject.year ?? '1st_year',
      description: subject.description ?? '',
      active: subject.active,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  };
  const closeAssignDialog = () => {
    setAssignDialogOpen(false);
    setSelectedTeacherId('');
    setSelectedSubjectIds([]);
    setAssignSearch('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload: form });
    } else {
      createMutation.mutate(form);
    }
  };
  const handleAssignSubmit = () => {
    assignMutation.mutate();
  };
  const toggleSubjectForAssign = (subjectId: string, checked: boolean | 'indeterminate') => {
    setSelectedSubjectIds((prev) => {
      if (checked) return [...new Set([...prev, subjectId])];
      return prev.filter((id) => id !== subjectId);
    });
  };
  const filteredAssignableSubjects = subjects.filter((subject) => {
    const q = assignSearch.trim().toLowerCase();
    if (!q) return true;
    return subject.name.toLowerCase().includes(q) || subject.code.toLowerCase().includes(q);
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-4 text-muted-foreground">Loading subjects...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="section-spacing">
        <div className="space-y-2 md:space-y-3">
          <div>
            <h1 className="page-header">Subjects</h1>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAssignDialogOpen(true)}>
              <Link2 className="mr-2 h-4 w-4" />
              Assign Subject
            </Button>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Subject
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3">
              <div>
                <CardTitle>All Subjects</CardTitle>
                <CardDescription>{subjects.length} subject{subjects.length !== 1 ? 's' : ''}</CardDescription>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <Select value={courseFilter} onValueChange={setCourseFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by course" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Courses</SelectItem>
                    {courses.map((course) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.code} - {course.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={yearFilter}
                  onValueChange={(value) => setYearFilter(value as 'all' | SubjectYear)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by year" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBJECT_YEAR_FILTER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or code..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/30" />
                <p className="mt-3 text-base font-medium">
                  {subjects.length === 0 ? 'No subjects yet' : 'No subjects found'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {subjects.length === 0 ? 'Add your first subject to get started' : 'Try a different search'}
                </p>
                {subjects.length === 0 && (
                  <Button className="mt-4" onClick={openCreate}>
                    <Plus className="mr-2 h-4 w-4" /> Add Subject
                  </Button>
                )}
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Year</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagination.pageItems.map((subject) => (
                      <TableRow key={subject.id}>
                        <TableCell className="font-medium">{subject.name}</TableCell>
                        <TableCell><Badge variant="outline">{subject.code}</Badge></TableCell>
                        <TableCell>{subject.year ? SUBJECT_YEAR_LABELS[subject.year] : '-'}</TableCell>
                        <TableCell className="text-muted-foreground">{subject.description || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={subject.active ? 'default' : 'secondary'}>
                            {subject.active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(subject)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
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
            <DialogTitle>{editing ? 'Edit Subject' : 'Add Subject'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Update subject details.' : 'Fill in the details to create a new subject.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name <span className="text-destructive">*</span></Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Mathematics"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Code <span className="text-destructive">*</span></Label>
              <Input
                id="code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="e.g. MATH101"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={form.description ?? ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="year">Year <span className="text-destructive">*</span></Label>
              <Select
                value={form.year ?? '1st_year'}
                onValueChange={(value) => setForm({ ...form, year: value as SubjectYear })}
              >
                <SelectTrigger id="year">
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {SUBJECT_YEARS.map((year) => (
                    <SelectItem key={year} value={year}>
                      {SUBJECT_YEAR_LABELS[year]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="active"
                checked={form.active ?? true}
                onCheckedChange={(checked) => setForm({ ...form, active: checked })}
              />
              <Label htmlFor="active">Active</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving...' : editing ? 'Save Changes' : 'Create Subject'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={assignDialogOpen} onOpenChange={(open) => { if (!open) closeAssignDialog(); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assign Subject</DialogTitle>
            <DialogDescription>
              Select one teacher and assign one or more subjects in bulk.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Teacher <span className="text-destructive">*</span></Label>
              <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select teacher" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {teachers.map((teacher: Teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {[teacher.firstName, teacher.middleName, teacher.lastName].filter(Boolean).join(' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Subjects <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Search subjects..."
                value={assignSearch}
                onChange={(e) => setAssignSearch(e.target.value)}
              />
              <div className="max-h-72 space-y-2 overflow-auto rounded-md border p-3">
                {filteredAssignableSubjects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No subjects available for the current search.</p>
                ) : (
                  filteredAssignableSubjects.map((subject) => (
                    <label key={subject.id} className="flex items-start gap-3 rounded-md border p-2">
                      <Checkbox
                        checked={selectedSubjectIds.includes(subject.id)}
                        onCheckedChange={(checked) => toggleSubjectForAssign(subject.id, checked)}
                      />
                      <div>
                        <div className="font-medium">{subject.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {subject.code}{subject.year ? ` • ${SUBJECT_YEAR_LABELS[subject.year]}` : ''}
                        </div>
                      </div>
                    </label>
                  ))
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedSubjectIds.length} subject{selectedSubjectIds.length !== 1 ? 's' : ''} selected.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeAssignDialog}>Cancel</Button>
            <Button type="button" onClick={handleAssignSubmit} disabled={assignMutation.isPending}>
              {assignMutation.isPending ? 'Assigning...' : 'Assign Subjects'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function Subjects() {
  return (
    <MainLayout>
      <SubjectsTabContent />
    </MainLayout>
  );
}
