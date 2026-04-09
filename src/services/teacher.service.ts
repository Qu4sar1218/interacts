import axiosClient from './api';
import type { SubjectYear } from './subject.service';

export interface Teacher {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  username: string;
  email: string;
  phoneNumber: string | null;
  address: string | null;
  birthday: string | null;
  active: boolean;
  schoolId: string | null;
  teacherDepartmentId: string | null;
  createdAt: string;
  updatedAt: string;
  role?: { id: string; name: string };
  school?: { id: string; name: string; schoolCode: string } | null;
  department?: { id: string; name: string; code: string } | null;
}

export interface TeacherCreatePayload {
  firstName: string;
  lastName: string;
  middleName?: string;
  username: string;
  password: string;
  email: string;
  phoneNumber?: string;
  address?: string;
  birthday?: string;
  teacherDepartmentId?: string;
}

export interface TeacherUpdatePayload {
  firstName?: string;
  lastName?: string;
  middleName?: string;
  email?: string;
  phoneNumber?: string;
  address?: string;
  birthday?: string;
  schoolId?: string;
  teacherDepartmentId?: string;
  active?: boolean;
}

export interface TeacherSubject {
  id: string;
  teacherId: string;
  subjectId: string;
  active: boolean;
  note: string | null;
  subject?: {
    id: string;
    name: string;
    code: string;
    description?: string | null;
    active?: boolean;
    year?: SubjectYear | null;
  };
}

/** Admin list: GET /teacher-subjects (includes nested teacher + subject). */
export interface TeacherSubjectListItem {
  id: string;
  teacherId: string;
  subjectId: string;
  active: boolean;
  note: string | null;
  subject?: TeacherSubject['subject'];
  teacher?: {
    id: string;
    firstName: string;
    middleName?: string | null;
    lastName: string;
    email: string;
    active: boolean;
  };
}

export type SectionScheduleWeekday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

/** Admin list: GET /section-subject-assignments */
export interface SectionSubjectAssignmentRow {
  id: string;
  sectionId: string;
  subjectId: string;
  teacherId: string;
  active: boolean;
  daysOfWeek?: SectionScheduleWeekday[] | null;
  startTime?: string | null;
  endTime?: string | null;
  note?: string | null;
  section?: {
    id: string;
    name: string;
    code: string;
    yearLevel?: string;
    courseId?: string;
    course?: { id: string; name: string; code: string } | null;
  };
  subject?: {
    id: string;
    name: string;
    code: string;
    year?: string | null;
  };
  teacher?: TeacherSubjectListItem['teacher'];
}

export const teacherService = {
  async getTeachers(params?: { active?: boolean; subjectId?: string }): Promise<Teacher[]> {
    const { data } = await axiosClient.get<Teacher[]>('/teachers', { params });
    return data;
  },

  async getTeacherById(id: string): Promise<Teacher> {
    const { data } = await axiosClient.get<Teacher>(`/teachers/${id}`);
    return data;
  },

  async createTeacher(payload: TeacherCreatePayload): Promise<Teacher> {
    const { data } = await axiosClient.post<Teacher>('/teachers', payload);
    return data;
  },

  async updateTeacher(id: string, payload: TeacherUpdatePayload): Promise<Teacher> {
    const { data } = await axiosClient.put<Teacher>(`/teachers/${id}`, payload);
    return data;
  },

  async getAllTeacherSubjects(params?: { active?: boolean; teacherId?: string }): Promise<TeacherSubjectListItem[]> {
    const { data } = await axiosClient.get<TeacherSubjectListItem[]>('/teacher-subjects', { params });
    return data;
  },

  async getAllSectionSubjectAssignments(params?: {
    active?: boolean;
    teacherId?: string;
    courseId?: string;
    subjectId?: string;
  }): Promise<SectionSubjectAssignmentRow[]> {
    const { data } = await axiosClient.get<SectionSubjectAssignmentRow[]>('/section-subject-assignments', { params });
    return data;
  },

  async getTeacherSubjects(id: string, params?: { active?: boolean }): Promise<TeacherSubject[]> {
    const { data } = await axiosClient.get<TeacherSubject[]>(`/teachers/${id}/subjects`, { params });
    return data;
  },

  async assignSubjectsToTeacher(id: string, subjectIds: string[], note?: string): Promise<TeacherSubject[]> {
    const { data } = await axiosClient.post<TeacherSubject[]>(`/teachers/${id}/subjects`, { subjectIds, note });
    return data;
  },

  async removeTeacherSubject(id: string, subjectId: string): Promise<void> {
    await axiosClient.delete(`/teachers/${id}/subjects/${subjectId}`);
  },
};
