import axiosClient from './api';

export interface HallwayWeekDay {
  date: string;
  label: string;
  /** Distinct students with ≥1 hallway scan that day (multiple scans count once). */
  hallway_students: number;
}

export interface HallwayWeekStats {
  week_start: string;
  week_end: string;
  today: string;
  enrolled_total: number;
  days: HallwayWeekDay[];
}

export interface TeacherScheduleItem {
  assignmentId: string;
  sectionId: string;
  sectionName: string | null;
  sectionCode: string | null;
  subjectId: string;
  subjectName: string | null;
  subjectCode: string | null;
  startTime: string | null;
  endTime: string | null;
  note: string | null;
}

export interface StudentScheduleItem {
  assignmentId: string | null;
  sectionId: string;
  sectionName: string | null;
  sectionCode: string | null;
  subjectId: string;
  subjectName: string | null;
  subjectCode: string | null;
  teacherId: string | null;
  teacherName: string | null;
  startTime: string | null;
  endTime: string | null;
  note: string | null;
  source?: 'SECTION' | 'OVERRIDE';
}

export interface StudentWeeklyScheduleDay {
  day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
  items: StudentScheduleItem[];
}

export interface StudentScheduleSection {
  id: string;
  name: string | null;
  code: string | null;
}

export interface StudentWeeklySchedule {
  student: {
    id: string | null;
    firstName: string | null;
    lastName: string | null;
    studentIdNumber: string | null;
  };
  section: StudentScheduleSection | null;
  weeklySchedule: StudentWeeklyScheduleDay[];
  unscheduled: StudentScheduleItem[];
}

export interface StudentTodaySchedule extends StudentWeeklySchedule {
  today: {
    date: string;
    day: "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";
    items: StudentScheduleItem[];
  };
}

export interface TeacherWeeklyScheduleDay {
  day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
  items: TeacherScheduleItem[];
}

export interface TeacherWeeklySchedule {
  teacher: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  };
  weeklySchedule: TeacherWeeklyScheduleDay[];
  unscheduled: TeacherScheduleItem[];
}

export interface TeacherSectionStudent {
  studentId: string;
  fullName: string;
  studentIdNumber: string | null;
  status: 'enrolled' | 'dropped' | 'graduated' | null;
  imageUrl: string | null;
}

export interface TeacherAssignedSection {
  sectionId: string;
  sectionName: string | null;
  sectionCode: string | null;
  students: TeacherSectionStudent[];
}

export interface TeacherAssignedSectionsResponse {
  sections: TeacherAssignedSection[];
  assignmentRosters?: Array<{
    assignmentId: string;
    sectionId: string;
    sectionName: string | null;
    sectionCode: string | null;
    subjectId: string;
    subjectName: string | null;
    subjectCode: string | null;
    startTime: string | null;
    endTime: string | null;
    daysOfWeek?: string[];
    students: TeacherSectionStudent[];
  }>;
}

export interface AdminDashboardStats {
  date: string;
  checks_in_hallway: number;
  checks_out_hallway: number;
  total_attended_event: number;
  active_event_id: string | null;
  active_event_name: string | null;
  event_note: string | null;
}

export interface TeacherTeachingAssignment {
  assignmentId: string;
  sectionId: string;
  sectionName: string | null;
  sectionCode: string | null;
  subjectId: string;
  subjectName: string | null;
  subjectCode: string | null;
  startTime: string | null;
  endTime: string | null;
}

export interface TeacherTeachingAssignmentsResponse {
  assignments: TeacherTeachingAssignment[];
}

export interface TeacherAttendanceRef {
  id: string;
  name: string | null;
  code: string | null;
}

export interface TeacherAttendanceRow {
  id: string;
  attendanceDate: string;
  status: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';
  student: {
    id: string;
    fullName: string;
    studentIdNumber: string | null;
  } | null;
  section: TeacherAttendanceRef | null;
  subject: TeacherAttendanceRef | null;
  firstScanAt: string | null;
  lastScanAt: string | null;
  timeIn: string | null;
  timeOut: string | null;
}

export interface TeacherAttendanceResponse {
  attendance: TeacherAttendanceRow[];
}

export interface TeacherAttendanceSummary {
  total: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
}

export interface TeacherAttendanceQuery {
  from?: string;
  to?: string;
  section_id?: string;
  subject_id?: string;
  /** When set with a single-day range, enables implicit-absent count after the class session ends. */
  assignment_id?: string;
  status?: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';
}

export interface TeacherAttendanceMetricsQuery {
  from: string;
  to: string;
}

export interface TeacherAttendanceMetricsAssignment {
  assignmentId: string;
  sectionId: string;
  sectionName: string | null;
  subjectId: string;
  subjectName: string | null;
  startTime: string | null;
  endTime: string | null;
  enrolledTotal: number;
  presentDistinct: number;
  lateDistinct: number;
  absentDistinct: number;
  excusedDistinct: number;
  /** Past scheduled class sessions × roster; used for radar when > 0. */
  presentSlots?: number;
  lateSlots?: number;
  absentSlots?: number;
  excusedSlots?: number;
  expectedSlots?: number;
}

export interface TeacherAttendanceMetricsResponse {
  period: { from: string; to: string };
  assignments: TeacherAttendanceMetricsAssignment[];
}

export interface StudentAttendanceRef {
  id: string;
  name: string | null;
  code: string | null;
}

export interface StudentAttendanceRow {
  id: string;
  attendanceDate: string;
  status: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';
  section: StudentAttendanceRef | null;
  subject: StudentAttendanceRef | null;
  teacher: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  firstScanAt: string | null;
  lastScanAt: string | null;
  timeIn: string | null;
  timeOut: string | null;
}

export interface StudentAttendanceQuery {
  from?: string;
  to?: string;
  subject_id?: string;
  status?: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';
}

export interface StudentAttendanceResponse {
  student: {
    id: string | null;
    firstName: string | null;
    lastName: string | null;
    studentIdNumber: string | null;
  };
  section: StudentScheduleSection | null;
  attendance: StudentAttendanceRow[];
}

export interface StudentAttendanceSummary {
  student: {
    id: string | null;
    firstName: string | null;
    lastName: string | null;
    studentIdNumber: string | null;
  };
  section: StudentScheduleSection | null;
  total: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
}

export interface ManualPresentOverridePayload {
  student_id: string;
  assignment_id: string;
  attendance_date: string;
}

export interface ManualPresentOverrideResponse {
  attendance: {
    id: string;
    attendance_date: string;
    status: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';
    source: 'AUTO' | 'MANUAL';
    time_in: string | null;
    time_out: string | null;
    first_scan_at: string | null;
    last_scan_at: string | null;
    section_id: string;
    subject_id: string;
    teacher_id: string;
  };
}

export interface ManualAbsentOverrideResponse {
  action: 'MARK_ABSENT';
  deletedAttendance: number;
  deletedRawTimelogs: number;
  studentId: string;
  assignmentId: string;
  attendanceDate: string;
}

export interface EventAttendanceActiveEvent {
  id: string;
  name: string;
  eventDate: string;
  startDate: string;
  endDate: string;
  timeStart: string;
  timeEnd: string;
}

export interface EventAttendanceStudentRow {
  student_id: string;
  student_number: string | null;
  full_name: string;
  image_url: string | null;
  time_in_count: number;
  time_out_count: number;
  last_log_type: 'TIME_IN' | 'TIME_OUT' | null;
  last_log_at: string | null;
}

export interface EventAttendanceSectionRow {
  section_id: string;
  section_name: string | null;
  section_code: string | null;
  totals: {
    students: number;
    logs: number;
    time_in: number;
    time_out: number;
  };
  students: EventAttendanceStudentRow[];
}

export interface EventAttendanceResponse {
  active_event: EventAttendanceActiveEvent | null;
  device: { id: string; code: string; name: string } | null;
  range: { from: string; to: string } | null;
  totals: {
    sections: number;
    students: number;
    logs: number;
    time_in: number;
    time_out: number;
  };
  sections: EventAttendanceSectionRow[];
  note: string | null;
}

export interface EventAttendanceQuery {
  from?: string;
  to?: string;
}

export interface StudentTerminalDeviceRef {
  id: string;
  code: string;
  name: string;
}

export interface StudentTerminalDateSummaryPoint {
  date: string;
  label: string;
  time_in_scans: number;
  time_out_scans: number;
  total_scans: number;
}

export interface StudentTerminalSubjectSummaryPoint {
  subject_id: string | null;
  subject_name: string | null;
  subject_code: string | null;
  label: string;
  time_in_scans: number;
  time_out_scans: number;
  total_scans: number;
}

export interface StudentTerminalTimelogSummaryResponse {
  date: string;
  student: {
    id: string | null;
    firstName: string | null;
    lastName: string | null;
    studentIdNumber: string | null;
  };
  section: StudentScheduleSection | null;
  hallway: {
    device: StudentTerminalDeviceRef | null;
    series: StudentTerminalDateSummaryPoint[];
    note: string | null;
  };
  classroom: {
    device: StudentTerminalDeviceRef | null;
    series: StudentTerminalSubjectSummaryPoint[];
    note: string | null;
  };
  event: {
    device: StudentTerminalDeviceRef | null;
    event: { id: string; name: string } | null;
    series: StudentTerminalDateSummaryPoint[];
    note: string | null;
  };
}

export const dashboardService = {
  async getAdminStats(): Promise<AdminDashboardStats> {
    const { data } = await axiosClient.get<AdminDashboardStats>('/dashboard/admin-stats');
    return data;
  },
  async getHallwayWeek(): Promise<HallwayWeekStats> {
    const { data } = await axiosClient.get<HallwayWeekStats>('/dashboard/hallway-week');
    return data;
  },
  async getTeacherWeeklySchedule(): Promise<TeacherWeeklySchedule> {
    const { data } = await axiosClient.get<TeacherWeeklySchedule>('/dashboard/teacher-weekly-schedule');
    return data;
  },
  async getStudentWeeklySchedule(): Promise<StudentWeeklySchedule> {
    const { data } = await axiosClient.get<StudentWeeklySchedule>("/dashboard/student-weekly-schedule");
    return data;
  },
  async getStudentTodaySchedule(): Promise<StudentTodaySchedule> {
    const { data } = await axiosClient.get<StudentTodaySchedule>("/dashboard/student-today-schedule");
    return data;
  },
  async getTeacherAssignedSections(params?: { teacherId?: string }): Promise<TeacherAssignedSectionsResponse> {
    const { data } = await axiosClient.get<TeacherAssignedSectionsResponse>('/dashboard/teacher-assigned-sections', {
      params: params?.teacherId ? { teacherId: params.teacherId } : undefined,
    });
    return data;
  },
  async getTeacherTeachingAssignments(): Promise<TeacherTeachingAssignmentsResponse> {
    const { data } = await axiosClient.get<TeacherTeachingAssignmentsResponse>(
      '/dashboard/teacher-teaching-assignments'
    );
    return data;
  },
  async getTeacherAttendance(params?: TeacherAttendanceQuery): Promise<TeacherAttendanceResponse> {
    const { data } = await axiosClient.get<TeacherAttendanceResponse>('/dashboard/teacher-attendance', {
      params,
    });
    return data;
  },
  async getTeacherAttendanceSummary(params?: TeacherAttendanceQuery): Promise<TeacherAttendanceSummary> {
    const { data } = await axiosClient.get<TeacherAttendanceSummary>('/dashboard/teacher-attendance-summary', {
      params,
    });
    return data;
  },
  async getTeacherAttendanceMetrics(
    params: TeacherAttendanceMetricsQuery
  ): Promise<TeacherAttendanceMetricsResponse> {
    const { data } = await axiosClient.get<TeacherAttendanceMetricsResponse>(
      '/dashboard/teacher-attendance-metrics',
      { params }
    );
    return data;
  },
  async getStudentAttendance(params?: StudentAttendanceQuery): Promise<StudentAttendanceResponse> {
    const { data } = await axiosClient.get<StudentAttendanceResponse>('/dashboard/student-attendance', {
      params,
    });
    return data;
  },
  async getStudentAttendanceSummary(params?: StudentAttendanceQuery): Promise<StudentAttendanceSummary> {
    const { data } = await axiosClient.get<StudentAttendanceSummary>('/dashboard/student-attendance-summary', {
      params,
    });
    return data;
  },
  async getStudentTerminalTimelogSummary(params?: {
    date?: string;
  }): Promise<StudentTerminalTimelogSummaryResponse> {
    const { data } = await axiosClient.get<StudentTerminalTimelogSummaryResponse>(
      '/dashboard/student-terminal-timelog-summary',
      { params }
    );
    return data;
  },
  async manualClassroomPresentOverride(
    payload: ManualPresentOverridePayload
  ): Promise<ManualPresentOverrideResponse> {
    const { data } = await axiosClient.post<ManualPresentOverrideResponse>(
      '/scanner/classroom/manual-present-override',
      payload
    );
    return data;
  },
  async manualClassroomAbsentOverride(
    payload: ManualPresentOverridePayload
  ): Promise<ManualAbsentOverrideResponse> {
    const { data } = await axiosClient.post<ManualAbsentOverrideResponse>(
      '/scanner/classroom/manual-absent-override',
      payload
    );
    return data;
  },
  async getAdminActiveEventAttendance(params?: EventAttendanceQuery): Promise<EventAttendanceResponse> {
    const { data } = await axiosClient.get<EventAttendanceResponse>(
      '/dashboard/admin-active-event-attendance',
      { params }
    );
    return data;
  },
  async getTeacherActiveEventAttendance(params?: EventAttendanceQuery): Promise<EventAttendanceResponse> {
    const { data } = await axiosClient.get<EventAttendanceResponse>(
      '/dashboard/teacher-active-event-attendance',
      { params }
    );
    return data;
  },
};
