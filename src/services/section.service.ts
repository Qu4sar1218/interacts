import axiosClient from './api';
import type { YearLevel } from '@/constants/year-level';

export type { YearLevel };

export interface Section {
  id: string;
  name: string;
  code: string;
  description: string | null;
  courseId: string;
  yearLevel: YearLevel;
  active: boolean;
  note: string | null;
  modifiedBy: string | null;
  createdAt: string;
  updatedAt: string;
  course?: { id: string; name: string; code: string };
}

export interface SectionPayload {
  name: string;
  code: string;
  description?: string;
  courseId: string;
  yearLevel: YearLevel;
  active?: boolean;
  note?: string;
}

export type SectionScheduleWeekday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export interface SectionSubjectTeacher {
  id: string;
  sectionId: string;
  subjectId: string;
  teacherId: string;
  active: boolean;
  note: string | null;
  daysOfWeek?: SectionScheduleWeekday[] | null;
  startTime?: string | null;
  endTime?: string | null;
  subject?: {
    id: string;
    name: string;
    code: string;
    year: string | null;
  };
  teacher?: {
    id: string;
    firstName: string;
    lastName: string;
    middleName: string | null;
    email: string;
    active: boolean;
  };
}

export interface SectionSubjectTeacherAssignmentPayload {
  assignments: Array<{
    subjectId: string;
    teachers: Array<{
      teacherId: string;
      daysOfWeek: SectionScheduleWeekday[];
      startTime: string;
      endTime: string;
    }>;
  }>;
  note?: string;
}

export const sectionService = {
  async getSections(params?: { active?: boolean; courseId?: string; yearLevel?: YearLevel }): Promise<Section[]> {
    const { data } = await axiosClient.get<Section[]>('/sections', { params });
    return data;
  },

  async getSectionById(id: string): Promise<Section> {
    const { data } = await axiosClient.get<Section>(`/sections/${id}`);
    return data;
  },

  async createSection(payload: SectionPayload): Promise<Section> {
    const { data } = await axiosClient.post<Section>('/sections', payload);
    return data;
  },

  async updateSection(id: string, payload: Partial<SectionPayload>): Promise<Section> {
    const { data } = await axiosClient.put<Section>(`/sections/${id}`, payload);
    return data;
  },

  async getSectionSubjectTeachers(id: string, params?: { active?: boolean }): Promise<SectionSubjectTeacher[]> {
    const { data } = await axiosClient.get<SectionSubjectTeacher[]>(`/sections/${id}/subject-teachers`, { params });
    return data;
  },

  async assignSectionSubjectTeachers(id: string, payload: SectionSubjectTeacherAssignmentPayload): Promise<SectionSubjectTeacher[]> {
    const { data } = await axiosClient.post<SectionSubjectTeacher[]>(`/sections/${id}/subject-teachers`, payload);
    return data;
  },

  async removeSectionSubjectTeacher(id: string, subjectId: string, teacherId: string): Promise<void> {
    await axiosClient.delete(`/sections/${id}/subject-teachers/${subjectId}/${teacherId}`);
  }
};
