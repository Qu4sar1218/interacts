import axiosClient from './api';

export interface RawTimelogPayload {
  device_id: string;
  source_type?: 'DEVICE' | 'MANUAL' | 'MOBILE_APP' | 'WEB_PORTAL' | 'IMPORT' | 'API';
  student_id: string;
  event_id?: string;
  student_number?: string;
  log_datetime: string;
  log_type: 'TIME_IN' | 'TIME_OUT' | 'BREAK_OUT' | 'BREAK_IN' | 'AUTO';
  verification_method: 'FINGERPRINT' | 'FACE' | 'RFID' | 'QR_CODE' | 'PIN' | 'CARD' | 'MANUAL';
  verification_score?: number;
  location_name?: string;
  latitude?: number;
  longitude?: number;
}

export interface RawTimelogStudent {
  id: string;
  first_name: string;
  last_name: string;
  image_url?: string | null;
}

export interface RawTimelog {
  id: string;
  student_id?: string;
  event_id?: string;
  student_number?: string;
  source_type?: 'DEVICE' | 'MANUAL' | 'MOBILE_APP' | 'WEB_PORTAL' | 'IMPORT' | 'API';
  log_datetime: string;
  log_type: 'TIME_IN' | 'TIME_OUT' | 'BREAK_OUT' | 'BREAK_IN' | 'AUTO';
  verification_method?: RawTimelogPayload['verification_method'];
  student?: RawTimelogStudent | null;
}

export const timelogService = {
  async recordAttendance(payload: RawTimelogPayload): Promise<unknown> {
    const { data } = await axiosClient.post('/raw-timelogs', {
      ...payload,
      source_type: payload.source_type ?? 'WEB_PORTAL',
      log_datetime: payload.log_datetime || new Date().toISOString(),
    });
    return data;
  },

  async getTimelogs(params?: {
    device_id?: string;
    student_id?: string;
    event_id?: string;
    teacher_id?: string;
    section_id?: string;
    subject_id?: string;
    classroom_scope?: 'teacher' | '1';
    start_date?: string;
    end_date?: string;
    processing_status?: string;
    limit?: number;
  }): Promise<RawTimelog[]> {
    const { data } = await axiosClient.get<RawTimelog[]>('/raw-timelogs', { params });
    return data;
  },
};
