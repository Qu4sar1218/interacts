import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CoursesTabContent,
  DepartmentsTabContent,
  SchedulesTabContent,
  SectionsTabContent,
  SubjectsTabContent,
} from '@/components/admin/academics';

type AcademicsTab = 'courses' | 'subjects' | 'sections' | 'schedules' | 'departments';

const DEFAULT_TAB: AcademicsTab = 'courses';

const isAcademicsTab = (value: string | null): value is AcademicsTab =>
  value === 'courses'
  || value === 'subjects'
  || value === 'sections'
  || value === 'schedules'
  || value === 'departments';

export default function ManageAcademics() {
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = useMemo<AcademicsTab>(() => {
    const tab = searchParams.get('tab');
    return isAcademicsTab(tab) ? tab : DEFAULT_TAB;
  }, [searchParams]);

  const setActiveTab = (nextTab: AcademicsTab) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', nextTab);
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <MainLayout>
      <div className="section-spacing">
        <div className="space-y-2 md:space-y-3">
          <div>
            <h1 className="page-header">Manage Academics</h1>
          </div>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as AcademicsTab)}
          className="space-y-4 md:space-y-6"
        >
          <TabsList className="h-auto w-full flex-wrap rounded-xl border border-primary/20 bg-card/60 p-1 backdrop-blur-sm sm:w-auto">
            <TabsTrigger
              value="courses"
              className="rounded-lg px-4 py-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Courses
            </TabsTrigger>
            <TabsTrigger
              value="subjects"
              className="rounded-lg px-4 py-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Subjects
            </TabsTrigger>
            <TabsTrigger
              value="sections"
              className="rounded-lg px-4 py-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Sections
            </TabsTrigger>
            <TabsTrigger
              value="schedules"
              className="rounded-lg px-4 py-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Schedules
            </TabsTrigger>
            <TabsTrigger
              value="departments"
              className="rounded-lg px-4 py-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Departments
            </TabsTrigger>
          </TabsList>

          <TabsContent value="courses" className="mt-0">
            <CoursesTabContent />
          </TabsContent>

          <TabsContent value="subjects" className="mt-0">
            <SubjectsTabContent />
          </TabsContent>

          <TabsContent value="sections" className="mt-0">
            <SectionsTabContent />
          </TabsContent>

          <TabsContent value="schedules" className="mt-0">
            <SchedulesTabContent />
          </TabsContent>

          <TabsContent value="departments" className="mt-0">
            <DepartmentsTabContent />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
