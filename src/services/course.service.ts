import axiosClient from './api';
import type { YearLevel } from '@/constants/year-level';

export type { YearLevel };

export interface Course {
  id: string;
  name: string;
  code: string;
  yearLevel: YearLevel;
  description: string | null;
  active: boolean;
  modifiedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CoursePayload {
  name: string;
  code: string;
  yearLevel: YearLevel;
  description?: string;
  active?: boolean;
}

export interface CourseSubject {
  id: string;
  courseId: string;
  subjectId: string;
  active: boolean;
  note: string | null;
  subject?: {
    id: string;
    name: string;
    code: string;
    description?: string | null;
    active?: boolean;
  };
}

export const courseService = {
  async getCourses(params?: { active?: boolean; yearLevel?: YearLevel }): Promise<Course[]> {
    const { data } = await axiosClient.get<Course[]>('/courses', { params });
    return data;
  },

  async getCourseById(id: string): Promise<Course> {
    const { data } = await axiosClient.get<Course>(`/courses/${id}`);
    return data;
  },

  async createCourse(payload: CoursePayload): Promise<Course> {
    const { data } = await axiosClient.post<Course>('/courses', payload);
    return data;
  },

  async updateCourse(id: string, payload: Partial<CoursePayload>): Promise<Course> {
    const { data } = await axiosClient.put<Course>(`/courses/${id}`, payload);
    return data;
  },

  async getCourseSubjects(id: string, params?: { active?: boolean }): Promise<CourseSubject[]> {
    const { data } = await axiosClient.get<CourseSubject[]>(`/courses/${id}/subjects`, { params });
    return data;
  },

  async assignSubjectsToCourse(id: string, subjectIds: string[], note?: string): Promise<CourseSubject[]> {
    const { data } = await axiosClient.post<CourseSubject[]>(`/courses/${id}/subjects`, { subjectIds, note });
    return data;
  },

  async removeCourseSubject(id: string, subjectId: string): Promise<void> {
    await axiosClient.delete(`/courses/${id}/subjects/${subjectId}`);
  },
};
