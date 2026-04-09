import axiosClient from './api';

export interface AttendancePolicyPayload {
  on_time_grace_minutes: number;
  late_until_minutes: number;
  absent_after_late_window: boolean;
  early_arrival_allowance_minutes: number;
  late_checkout_grace_minutes: number;
}

export interface AttendancePolicyRecord {
  id: string;
  school_id: string;
  section_subject_teacher_id: string | null;
  on_time_grace_minutes: number;
  late_until_minutes: number;
  absent_after_late_window: boolean;
  early_arrival_allowance_minutes: number;
  late_checkout_grace_minutes: number;
}

export interface TeacherAssignmentPolicyRow {
  assignmentId: string;
  sectionId: string;
  sectionName: string | null;
  sectionCode: string | null;
  subjectId: string;
  subjectName: string | null;
  subjectCode: string | null;
  hasAssignmentOverride: boolean;
  effectivePolicy: AttendancePolicyPayload;
  assignmentPolicy: Omit<AttendancePolicyRecord, 'school_id' | 'section_subject_teacher_id'> | null;
  schoolDefaultPolicy: AttendancePolicyPayload | null;
}

export interface MyAssignmentsPoliciesResponse {
  assignments: TeacherAssignmentPolicyRow[];
  schoolDefault: AttendancePolicyPayload;
}

export const attendancePolicyService = {
  async getSchoolDefault(): Promise<{ policy: AttendancePolicyRecord | null }> {
    const { data } = await axiosClient.get<{ policy: AttendancePolicyRecord | null }>(
      '/attendance-policies/school-default'
    );
    return data;
  },

  async putSchoolDefault(payload: AttendancePolicyPayload): Promise<{ policy: AttendancePolicyRecord }> {
    const { data } = await axiosClient.put<{ policy: AttendancePolicyRecord }>(
      '/attendance-policies/school-default',
      payload
    );
    return data;
  },

  async getMyAssignments(): Promise<MyAssignmentsPoliciesResponse> {
    const { data } = await axiosClient.get<MyAssignmentsPoliciesResponse>(
      '/attendance-policies/my-assignments'
    );
    return data;
  },

  async putAssignmentPolicy(
    assignmentId: string,
    payload: AttendancePolicyPayload
  ): Promise<{ policy: AttendancePolicyRecord }> {
    const { data } = await axiosClient.put<{ policy: AttendancePolicyRecord }>(
      `/attendance-policies/assignments/${assignmentId}`,
      payload
    );
    return data;
  },
};
