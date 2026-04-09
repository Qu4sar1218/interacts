import axiosClient from './api';
import type { YearLevel } from './section.service';

export type EnrollmentStatus = 'enrolled' | 'dropped' | 'graduated';
export type StudentType = 'regular' | 'irregular';

export interface StudentEnrollment {
  id: string;
  studentId: string;
  courseId: string;
  sectionId: string | null;
  schoolYear: string;
  yearLevel: YearLevel;
  studentType: StudentType;
  enrolledDate: string;
  status: EnrollmentStatus;
  active: boolean;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
  course?: { id: string; name: string; code: string };
  section?: { id: string; name: string; code: string; courseId: string; yearLevel: YearLevel } | null;
  student?: {
    id: string;
    firstName: string;
    middleName?: string | null;
    lastName: string;
    studentIdNumber: string;
    email: string;
  };
}

export interface StudentEnrollmentPayload {
  courseId: string;
  sectionId?: string;
  schoolYear: string;
  yearLevel: YearLevel;
  studentType: StudentType;
  enrolledDate?: string;
  status?: EnrollmentStatus;
  active?: boolean;
  remarks?: string;
}

export const studentEnrollmentService = {
  async getAllEnrollments(params?: {
    status?: string;
    active?: boolean;
    sectionId?: string;
    courseId?: string;
  }): Promise<StudentEnrollment[]> {
    const { data } = await axiosClient.get<StudentEnrollment[]>('/student-enrollments', { params });
    return data;
  },

  async getStudentEnrollments(studentId: string, params?: { active?: boolean }): Promise<StudentEnrollment[]> {
    const { data } = await axiosClient.get<StudentEnrollment[]>(`/students/${studentId}/enrollments`, { params });
    return data;
  },

  async createStudentEnrollment(studentId: string, payload: StudentEnrollmentPayload): Promise<StudentEnrollment> {
    const { data } = await axiosClient.post<StudentEnrollment>(`/students/${studentId}/enrollments`, payload);
    return data;
  },

  async updateStudentEnrollment(id: string, payload: Partial<StudentEnrollmentPayload>): Promise<StudentEnrollment> {
    const { data } = await axiosClient.patch<StudentEnrollment>(`/student-enrollments/${id}`, payload);
    return data;
  },
};
