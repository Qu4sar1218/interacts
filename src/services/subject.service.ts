import axiosClient from './api';
import type { YearLevel } from '@/constants/year-level';

export type SubjectYear =
  | '1st_year'
  | '2nd_year'
  | '3rd_year'
  | '4th_year'
  | 'grade_11'
  | 'grade_12';

export const SUBJECT_YEARS: SubjectYear[] = [
  '1st_year',
  '2nd_year',
  '3rd_year',
  '4th_year',
  'grade_11',
  'grade_12',
];

export const SUBJECT_YEAR_LABELS: Record<SubjectYear, string> = {
  '1st_year': '1st Year',
  '2nd_year': '2nd Year',
  '3rd_year': '3rd Year',
  '4th_year': '4th Year',
  grade_11: 'Grade 11',
  grade_12: 'Grade 12',
};

export function formatSubjectYear(year: SubjectYear | null | undefined): string {
  if (!year) return 'N/A';
  return SUBJECT_YEAR_LABELS[year];
}

/** For admin filters: All Years + each curriculum year. */
export const SUBJECT_YEAR_FILTER_OPTIONS: Array<{ value: 'all' | SubjectYear; label: string }> = [
  { value: 'all', label: 'All Years' },
  ...SUBJECT_YEARS.map((y) => ({ value: y, label: SUBJECT_YEAR_LABELS[y] })),
];

const COURSE_YEAR_LEVEL_TO_SUBJECT_YEAR: Partial<Record<YearLevel, SubjectYear>> = {
  'Year 1': '1st_year',
  'Year 2': '2nd_year',
  'Year 3': '3rd_year',
  'Year 4': '4th_year',
  'Grade 11': 'grade_11',
  'Grade 12': 'grade_12',
};

/** Default subject-year filter when assigning subjects to a course (Year 5/6 → all years). */
export function defaultSubjectYearFilterForCourse(yearLevel: YearLevel): 'all' | SubjectYear {
  return COURSE_YEAR_LEVEL_TO_SUBJECT_YEAR[yearLevel] ?? 'all';
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  year: SubjectYear | null;
  description: string | null;
  active: boolean;
  modifiedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubjectPayload {
  name: string;
  code: string;
  year?: SubjectYear;
  description?: string;
  active?: boolean;
}

export const subjectService = {
  async getSubjects(params?: { active?: boolean; courseId?: string; year?: SubjectYear }): Promise<Subject[]> {
    const { data } = await axiosClient.get<Subject[]>('/subjects', { params });
    return data;
  },

  async getSubjectById(id: string): Promise<Subject> {
    const { data } = await axiosClient.get<Subject>(`/subjects/${id}`);
    return data;
  },

  async createSubject(payload: SubjectPayload): Promise<Subject> {
    const { data } = await axiosClient.post<Subject>('/subjects', payload);
    return data;
  },

  async updateSubject(id: string, payload: Partial<SubjectPayload>): Promise<Subject> {
    const { data } = await axiosClient.put<Subject>(`/subjects/${id}`, payload);
    return data;
  },
};
