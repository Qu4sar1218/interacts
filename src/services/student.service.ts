import axiosClient from './api';
import type { YearLevel } from '@/constants/year-level';

export interface BackendStudent {
  id: string;
  student_id_number: string;
  school_id: string | null;
  department_id: string | null;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  birthday?: string | null;
  address?: string | null;
  contactNumber?: string | null;
  email: string | null;
  yearLevel?: YearLevel | null;
  guardianContactNumber?: string | null;
  guardianEmail?: string | null;
  studentType?: 'regular' | 'irregular' | null;
  is_active: boolean;
  status?: 'pending' | 'enrolled' | 'dropped' | 'graduated';
  enrolledDate?: string | null;
  user_image_url?: string | null;
  school?: { id: string; name: string } | null;
  department?: { id: string; name: string } | null;
  current_enrollment?: StudentCurrentEnrollment | null;
}

export interface StudentCredential {
  id: string;
  student_id: string;
  credential_type: string;
  credential_data: string;
  credential_reference: string | null;
  is_primary: boolean;
  is_active: boolean;
  enrolled_date: string;
}

export interface FaceCredentialData {
  descriptors: number[][];
  quality_scores?: number[];
  model_info?: { name: string; version: string; descriptor_size: number };
  capture_dates?: string[];
}

export interface StudentCurrentEnrollment {
  school_year: string;
  course: { id: string; name: string; code: string } | null;
  section: { id: string; name: string; code: string } | null;
}

export interface StudentWithFaceCredentials extends BackendStudent {
  current_enrollment?: StudentCurrentEnrollment | null;
  credentials: Array<{
    id: string;
    credential_data: string;
    credential_reference: string | null;
    enrolled_date: string;
    is_primary: boolean;
  }>;
}

export interface StudentCreatePayload {
  firstName: string;
  lastName: string;
  middleName?: string;
  birthday?: string;
  address?: string;
  contactNumber: string;
  email: string;
  studentIdNumber: string;
  yearLevel: YearLevel;
  guardianContactNumber: string;
  guardianEmail: string;
  enrolledDate?: string;
}

export interface StudentUpdatePayload {
  firstName?: string;
  lastName?: string;
  middleName?: string;
  birthday?: string;
  address?: string;
  contactNumber?: string;
  email?: string;
  studentIdNumber?: string;
  yearLevel?: YearLevel;
  guardianContactNumber?: string;
  guardianEmail?: string;
  active?: boolean;
  status?: 'pending' | 'enrolled' | 'dropped' | 'graduated';
  enrolledDate?: string;
}

export const studentService = {
  async getStudents(): Promise<BackendStudent[]> {
    const { data } = await axiosClient.get<BackendStudent[]>('/students');
    return data;
  },

  async getEligibleStudentsForFace(params?: { q?: string; sectionId?: string }): Promise<BackendStudent[]> {
    const query: Record<string, string> = {};
    if (params?.q) query.q = params.q;
    if (params?.sectionId && params.sectionId !== 'all') query.sectionId = params.sectionId;
    const { data } = await axiosClient.get<BackendStudent[]>('/students/eligible-for-face', {
      params: { ...query, _t: Date.now() },
    });
    return data;
  },

  async getStudentById(id: string): Promise<BackendStudent> {
    const { data } = await axiosClient.get<BackendStudent>(`/students/${id}`);
    return data;
  },

  async getStudentCredentials(studentId: string): Promise<StudentCredential[]> {
    const { data } = await axiosClient.get<StudentCredential[]>(`/students/${studentId}/credentials`);
    return data;
  },

  async getStudentsWithFaceCredentials(): Promise<StudentWithFaceCredentials[]> {
    const { data } = await axiosClient.get<StudentWithFaceCredentials[]>('/students/with-face-credentials');
    return data;
  },

  async enrollFaceCredential(
    studentId: string,
    payload: {
      descriptors: number[][];
      quality_scores?: number[];
      thumbnail?: Blob | File;
    }
  ): Promise<StudentCredential> {
    const formData = new FormData();
    formData.append('descriptors', JSON.stringify(payload.descriptors));
    formData.append('quality_scores', JSON.stringify(payload.quality_scores ?? []));
    if (payload.thumbnail) {
      formData.append('thumbnail', payload.thumbnail, payload.thumbnail instanceof File ? payload.thumbnail.name : 'thumbnail.jpg');
    }
    const { data } = await axiosClient.post<StudentCredential>(`/students/${studentId}/credentials`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async replaceFaceCredential(
    studentId: string,
    payload: {
      descriptors: number[][];
      quality_scores?: number[];
      thumbnail?: Blob | File;
    }
  ): Promise<StudentCredential> {
    const formData = new FormData();
    formData.append('descriptors', JSON.stringify(payload.descriptors));
    formData.append('quality_scores', JSON.stringify(payload.quality_scores ?? []));
    if (payload.thumbnail) {
      formData.append('thumbnail', payload.thumbnail, payload.thumbnail instanceof File ? payload.thumbnail.name : 'thumbnail.jpg');
    }
    const { data } = await axiosClient.post<StudentCredential>(`/students/${studentId}/credentials/replace`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async deleteCredential(studentId: string, credentialId: string): Promise<void> {
    await axiosClient.delete(`/students/${studentId}/credentials/${credentialId}`);
  },

  async createStudent(payload: StudentCreatePayload): Promise<BackendStudent> {
    const { data } = await axiosClient.post<BackendStudent>('/students', payload);
    return data;
  },

  async updateStudent(id: string, payload: StudentUpdatePayload): Promise<BackendStudent> {
    const { data } = await axiosClient.put<BackendStudent>(`/students/${id}`, payload);
    return data;
  },
};
