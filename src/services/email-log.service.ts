import axiosClient from './api';

export type EmailLogStatus = 'PENDING' | 'SENT' | 'FAILED';
export type EmailLogType = 'HALLWAY_CHECKOUT' | 'EVENT_SCAN_TIME_IN' | 'EVENT_SCAN_TIME_OUT';

export interface EmailLogStudent {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  studentIdNumber: string;
  guardianEmail: string;
}

export interface EmailLogRecord {
  id: string;
  studentId: string;
  rawTimelogId: string;
  recipientEmail: string;
  emailType: EmailLogType;
  subject: string;
  status: EmailLogStatus;
  errorMessage: string | null;
  emailContent: string | null;
  smtpResponse: string | null;
  messageId: string | null;
  attendanceDate: string;
  hallwayTimeIn: string | null;
  hallwayTimeOut: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
  student?: EmailLogStudent | null;
}

export interface EmailLogListResponse {
  rows: EmailLogRecord[];
  count: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface EmailLogListParams {
  page?: number;
  limit?: number;
  student_id?: string;
  status?: EmailLogStatus;
  attendance_date?: string;
  email_type?: EmailLogType;
  search?: string;
}

export const emailLogService = {
  async getEmailLogs(params: EmailLogListParams = {}): Promise<EmailLogListResponse> {
    const { data } = await axiosClient.get<EmailLogListResponse>('/email-logs', { params });
    return data;
  },

  async getEmailLogById(id: string): Promise<EmailLogRecord> {
    const { data } = await axiosClient.get<EmailLogRecord>(`/email-logs/${id}`);
    return data;
  },
};
