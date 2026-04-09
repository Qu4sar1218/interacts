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
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { courseService, type Course, type CoursePayload } from '@/services/course.service';
import {
  defaultSubjectYearFilterForCourse,
  formatSubjectYear,
  SUBJECT_YEAR_FILTER_OPTIONS,
  type SubjectYear,
  subjectService
} from '@/services/subject.service';
import { toast } from 'sonner';
import { Search, Plus, Pencil, BookOpen, Link2 } from 'lucide-react';
import { YEAR_LEVELS, type YearLevel } from '@/constants/year-level';
import { useClientPagination } from '@/hooks/useClientPagination';
import { TablePaginationControls } from '@/components/TablePaginationControls';
const EMPTY_FORM: CoursePayload = { name: '', code: '', yearLevel: 'Year 1', description: '', active: true };

export function CoursesTabContent() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [yearLevelFilter, setYearLevelFilter] = useState<'all' | YearLevel>('all');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [subjectDialogOpen, setSubjectDialogOpen] = useState(false);
  const [postCreateConfirmOpen, setPostCreateConfirmOpen] = useState(false);
  const [postCreateCourse, setPostCreateCourse] = useState<Course | null>(null);
  const [editing, setEditing] = useState<Course | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [subjectYearFilter, setSubjectYearFilter] = useState<'all' | SubjectYear>('all');
  const [form, setForm] = useState<CoursePayload>(EMPTY_FORM);

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['courses', { yearLevel: yearLevelFilter }],
    queryFn: () =>
      courseService.getCourses({
        ...(yearLevelFilter !== 'all' ? { yearLevel: yearLevelFilter } : {})
      }),
  });
  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectService.getSubjects({ active: true }),
  });

  const resetPostCreateFlow = () => {
    setPostCreateConfirmOpen(false);
    setPostCreateCourse(null);
  };

  const createMutation = useMutation({
    mutationFn: (payload: CoursePayload) => courseService.createCourse(payload),
    onSuccess: (createdCourse) => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      toast.success('Course created successfully');
      closeDialog();
      setPostCreateCourse(createdCourse);
      setPostCreateConfirmOpen(true);
    },
    onError: (err: Error) => toast.error('Failed to create course', { description: err.message }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CoursePayload> }) =>
      courseService.updateCourse(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      toast.success('Course updated successfully');
      closeDialog();
    },
    onError: (err: Error) => toast.error('Failed to update course', { description: err.message }),
  });

  const assignSubjectsMutation = useMutation({
    mutationFn: ({ courseId, subjectIds }: { courseId: string; subjectIds: string[] }) =>
      courseService.assignSubjectsToCourse(courseId, subjectIds),
    onSuccess: () => {
      toast.success('Course subjects updated successfully');
      setSubjectDialogOpen(false);
      setSelectedCourse(null);
      setSelectedSubjectIds([]);
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
    onError: (err: Error) => toast.error('Failed to update course subjects', { description: err.message }),
  });

  const filtered = courses.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase()),
  );
  const pagination = useClientPagination(filtered, pageIndex, pageSize);
  const filteredSubjects = subjects.filter((subject) =>
    subjectYearFilter === 'all' ? true : subject.year === subjectYearFilter
  );

  useEffect(() => {
    setPageIndex(0);
  }, [search, yearLevelFilter]);

  useEffect(() => {
    if (pageIndex !== pagination.pageIndex) setPageIndex(pagination.pageIndex);
  }, [pageIndex, pagination.pageIndex]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (course: Course) => {
    setEditing(course);
    setForm({
      name: course.name,
      code: course.code,
      yearLevel: course.yearLevel,
      description: course.description ?? '',
      active: course.active
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const openSubjectDialog = async (course: Course) => {
    setSelectedCourse(course);
    setSubjectDialogOpen(true);
    setSubjectYearFilter(defaultSubjectYearFilterForCourse(course.yearLevel));
    try {
      const mappings = await courseService.getCourseSubjects(course.id, { active: true });
      setSelectedSubjectIds(mappings.map((m) => m.subjectId));
    } catch {
      toast.error('Failed to load course subjects');
      setSelectedSubjectIds([]);
    }
  };

  const handleAssignSubjectsAfterCreate = async () => {
    if (!postCreateCourse) {
      toast.error('Could not open Assign Subjects', {
        description: 'The created course is no longer available. Please use the Assign Subjects action from the table.',
      });
      resetPostCreateFlow();
      return;
    }

    const course = postCreateCourse;
    resetPostCreateFlow();
    await openSubjectDialog(course);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isAssigning = assignSubjectsMutation.isPending;

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-4 text-muted-foreground">Loading courses...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="section-spacing">
        <div className="space-y-2 md:space-y-3">
          <div>
            <h1 className="page-header">Courses</h1>
          </div>
          <div className="flex justify-end">
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Course
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>All Courses</CardTitle>
                <CardDescription>{courses.length} course{courses.length !== 1 ? 's' : ''}</CardDescription>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name or code..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
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
                <BookOpen className="h-12 w-12 text-muted-foreground/30" />
                <p className="mt-3 text-base font-medium">
                  {courses.length === 0 ? 'No courses yet' : 'No courses found'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {courses.length === 0 ? 'Add your first course to get started' : 'Try a different search'}
                </p>
                {courses.length === 0 && (
                  <Button className="mt-4" onClick={openCreate}>
                    <Plus className="mr-2 h-4 w-4" /> Add Course
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
                      <TableHead>Year Level</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagination.pageItems.map((course) => (
                      <TableRow key={course.id}>
                        <TableCell className="font-medium">{course.name}</TableCell>
                        <TableCell><Badge variant="outline">{course.code}</Badge></TableCell>
                        <TableCell>{course.yearLevel}</TableCell>
                        <TableCell className="text-muted-foreground">{course.description || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={course.active ? 'default' : 'secondary'}>
                            {course.active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => openSubjectDialog(course)} title="Assign subjects">
                            <Link2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(course)}>
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
            <DialogTitle>{editing ? 'Edit Course' : 'Add Course'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Update course details.' : 'Fill in the details to create a new course.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name <span className="text-destructive">*</span></Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Bachelor of Science in Computer Science"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Code <span className="text-destructive">*</span></Label>
              <Input
                id="code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="e.g. BSCS"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="yearLevel">Year Level <span className="text-destructive">*</span></Label>
              <Select
                value={form.yearLevel}
                onValueChange={(value) => setForm({ ...form, yearLevel: value as CoursePayload['yearLevel'] })}
              >
                <SelectTrigger id="yearLevel">
                  <SelectValue placeholder="Select year level" />
                </SelectTrigger>
                <SelectContent>
                  {YEAR_LEVELS.map((yearLevel) => (
                    <SelectItem key={yearLevel} value={yearLevel}>
                      {yearLevel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                {isPending ? 'Saving...' : editing ? 'Save Changes' : 'Create Course'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={subjectDialogOpen} onOpenChange={(open) => { if (!open) setSubjectDialogOpen(false); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign Subjects</DialogTitle>
            <DialogDescription>
              {selectedCourse ? `Manage subjects for ${selectedCourse.name}` : 'Manage course subjects'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="subject-year-filter">Year Level</Label>
            <Select
              value={subjectYearFilter}
              onValueChange={(value) => setSubjectYearFilter(value as 'all' | SubjectYear)}
            >
              <SelectTrigger id="subject-year-filter">
                <SelectValue placeholder="All Years" />
              </SelectTrigger>
              <SelectContent>
                {SUBJECT_YEAR_FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="max-h-[320px] space-y-3 overflow-y-auto border p-3">
            {filteredSubjects.map((subject) => (
              <label key={subject.id} className="flex items-center gap-3">
                <Checkbox
                  checked={selectedSubjectIds.includes(subject.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedSubjectIds((prev) => [...prev, subject.id]);
                    } else {
                      setSelectedSubjectIds((prev) => prev.filter((id) => id !== subject.id));
                    }
                  }}
                />
                <span className="text-sm">{subject.name} ({subject.code}) - {formatSubjectYear(subject.year)}</span>
              </label>
            ))}
            {filteredSubjects.length === 0 && (
              <p className="text-sm text-muted-foreground">No subjects found for the selected year level.</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSubjectDialogOpen(false)}>Cancel</Button>
            <Button
              type="button"
              disabled={!selectedCourse || isAssigning}
              onClick={() => selectedCourse && assignSubjectsMutation.mutate({ courseId: selectedCourse.id, subjectIds: selectedSubjectIds })}
            >
              {isAssigning ? 'Saving...' : 'Save Subjects'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={postCreateConfirmOpen}
        onOpenChange={(open) => {
          setPostCreateConfirmOpen(open);
          if (!open) setPostCreateCourse(null);
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Course created successfully</AlertDialogTitle>
            <AlertDialogDescription>
              Would you like to assign subjects now, or assign them later?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={resetPostCreateFlow}>Assign later</AlertDialogCancel>
            <AlertDialogAction onClick={() => { void handleAssignSubjectsAfterCreate(); }}>
              Assign subjects
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function Courses() {
  return (
    <MainLayout>
      <CoursesTabContent />
    </MainLayout>
  );
}
