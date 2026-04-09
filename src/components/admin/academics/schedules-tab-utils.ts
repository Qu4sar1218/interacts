import type {
  SectionScheduleWeekday,
  SectionSubjectTeacher,
  SectionSubjectTeacherAssignmentPayload,
} from '@/services/section.service';

export type ScheduleSlot = {
  daysOfWeek: SectionScheduleWeekday[];
  startTime: string;
  endTime: string;
};

type SectionTeacherRow = Pick<
  SectionSubjectTeacher,
  'subjectId' | 'teacherId' | 'daysOfWeek' | 'startTime' | 'endTime'
>;

/** Nested subject → teacher → slot, matching the bulk-assign API shape. */
export type GroupedSectionSchedules = Record<string, Record<string, ScheduleSlot>>;

export function buildGroupedFromSectionTeachers(existing: SectionTeacherRow[]): GroupedSectionSchedules {
  const grouped: GroupedSectionSchedules = {};
  for (const row of existing) {
    if (!grouped[row.subjectId]) grouped[row.subjectId] = {};
    grouped[row.subjectId][row.teacherId] = {
      daysOfWeek: (row.daysOfWeek && row.daysOfWeek.length > 0 ? row.daysOfWeek : ['Mon']) as SectionScheduleWeekday[],
      startTime: (row.startTime || '08:00').slice(0, 5),
      endTime: (row.endTime || '09:00').slice(0, 5),
    };
  }
  return grouped;
}

export function mergeScheduleIntoGrouped(
  grouped: GroupedSectionSchedules,
  subjectId: string,
  teacherId: string,
  schedule: ScheduleSlot,
): void {
  if (!grouped[subjectId]) grouped[subjectId] = {};
  grouped[subjectId][teacherId] = schedule;
}

export function assignmentsPayloadFromGrouped(
  grouped: GroupedSectionSchedules,
): SectionSubjectTeacherAssignmentPayload['assignments'] {
  return Object.entries(grouped).map(([subjectIdKey, teachersById]) => ({
    subjectId: subjectIdKey,
    teachers: Object.entries(teachersById).map(([teacherIdKey, sched]) => ({
      teacherId: teacherIdKey,
      daysOfWeek: sched.daysOfWeek,
      startTime: sched.startTime,
      endTime: sched.endTime,
    })),
  }));
}
