import axiosClient from './api';
import type { SectionScheduleWeekday } from './section.service';

export type StudentAssignmentType = 'ADD' | 'REMOVE' | 'REPLACE';

export interface StudentSubjectAssignment {
  id: string;
  studentEnrollmentId: string;
  assignmentType: StudentAssignmentType;
  baseSectionSubjectTeacherId: string | null;
  sectionSubjectTeacherId: string | null;
  subjectId: string | null;
  teacherId: string | null;
  sectionId: string | null;
  daysOfWeek: SectionScheduleWeekday[] | null;
  startTime: string | null;
  endTime: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  active: boolean;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
  subject?: { id: string; name: string; code: string } | null;
  teacher?: { id: string; firstName: string; lastName: string } | null;
  section?: { id: string; name: string; code: string } | null;
  assignment?: {
    id: string;
    subject?: { id: string; name: string; code: string } | null;
    teacher?: { id: string; firstName: string; lastName: string } | null;
  } | null;
}

export interface StudentFinalScheduleRow {
  source: 'SECTION' | 'OVERRIDE';
  overrideId?: string;
  assignmentType?: StudentAssignmentType;
  assignmentId?: string | null;
  sectionId: string | null;
  subjectId: string | null;
  teacherId: string | null;
  daysOfWeek: SectionScheduleWeekday[];
  startTime: string | null;
  endTime: string | null;
  subject?: { id: string; name: string; code: string } | null;
  teacher?: { id: string; firstName: string; lastName: string } | null;
  section?: { id: string; name: string; code: string } | null;
}

export interface StudentAssignmentCollectionResponse {
  enrollment: { id: string; sectionId: string | null; studentType: 'regular' | 'irregular' } | null;
  rows: StudentSubjectAssignment[];
}

export interface StudentFinalScheduleResponse {
  enrollment: { id: string; sectionId: string | null; studentType: 'regular' | 'irregular' } | null;
  rows: StudentFinalScheduleRow[];
}

/** Admin list: GET /student-subject-assignments */
export interface AdminStudentSubjectAssignmentRow {
  id: string;
  studentEnrollmentId: string;
  assignmentType: StudentAssignmentType;
  baseSectionSubjectTeacherId: string | null;
  sectionSubjectTeacherId: string | null;
  subjectId: string | null;
  teacherId: string | null;
  sectionId: string | null;
  daysOfWeek: SectionScheduleWeekday[] | null;
  startTime: string | null;
  endTime: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  active: boolean;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
  enrollment?: {
    id: string;
    courseId: string;
    sectionId: string | null;
    schoolYear?: string;
    yearLevel?: string;
    studentType?: string;
    status?: string;
    student?: { id: string; firstName: string; middleName?: string | null; lastName: string };
    course?: { id: string; name: string; code: string } | null;
    section?: { id: string; name: string; code: string; yearLevel?: string } | null;
  };
  subject?: { id: string; name: string; code: string } | null;
  teacher?: { id: string; firstName: string; middleName?: string | null; lastName: string } | null;
  section?: { id: string; name: string; code: string } | null;
  baseAssignment?: {
    id: string;
    sectionId: string;
    subjectId: string;
    teacherId: string;
    daysOfWeek?: SectionScheduleWeekday[] | null;
    startTime?: string | null;
    endTime?: string | null;
  } | null;
  assignment?: {
    id: string;
    sectionId: string;
    subjectId: string;
    teacherId: string;
    daysOfWeek?: SectionScheduleWeekday[] | null;
    startTime?: string | null;
    endTime?: string | null;
  } | null;
}

export interface StudentSubjectAssignmentPayload {
  assignmentType: StudentAssignmentType;
  baseSectionSubjectTeacherId?: string;
  sectionSubjectTeacherId?: string;
  subjectId?: string;
  teacherId?: string;
  sectionId?: string;
  daysOfWeek?: SectionScheduleWeekday[];
  startTime?: string;
  endTime?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  active?: boolean;
  remarks?: string;
}

export const studentSubjectAssignmentService = {
  async listForAdmin(params?: {
    active?: boolean;
    courseId?: string;
    teacherId?: string;
    subjectId?: string;
  }): Promise<AdminStudentSubjectAssignmentRow[]> {
    const { data } = await axiosClient.get<AdminStudentSubjectAssignmentRow[]>('/student-subject-assignments', {
      params,
    });
    return data;
  },

  async getStudentSubjectAssignments(
    studentId: string,
    params?: { active?: boolean; date?: string }
  ): Promise<StudentAssignmentCollectionResponse> {
    const { data } = await axiosClient.get<StudentAssignmentCollectionResponse>(
      `/students/${studentId}/subject-assignments`,
      { params }
    );
    return data;
  },

  async createStudentSubjectAssignment(
    studentId: string,
    payload: StudentSubjectAssignmentPayload
  ): Promise<StudentSubjectAssignment> {
    const { data } = await axiosClient.post<StudentSubjectAssignment>(
      `/students/${studentId}/subject-assignments`,
      payload
    );
    return data;
  },

  async updateStudentSubjectAssignment(
    id: string,
    payload: Partial<StudentSubjectAssignmentPayload>
  ): Promise<StudentSubjectAssignment> {
    const { data } = await axiosClient.patch<StudentSubjectAssignment>(`/student-subject-assignments/${id}`, payload);
    return data;
  },

  async deleteStudentSubjectAssignment(id: string): Promise<void> {
    await axiosClient.delete(`/student-subject-assignments/${id}`);
  },

  async getStudentFinalSchedule(
    studentId: string,
    params?: { date?: string; teacherId?: string }
  ): Promise<StudentFinalScheduleResponse> {
    const { data } = await axiosClient.get<StudentFinalScheduleResponse>(`/students/${studentId}/final-schedule`, { params });
    return data;
  }
};
