import axiosClient from './api';
import type { CalendarEvent } from './event.service';
import type { RawTimelog } from './timelog.service';

export type ScannerTerminalType = 'hallway' | 'classroom' | 'event';

export interface ScannerTerminalDevice {
  id: string;
  code: string;
  name: string;
  status: string;
}

export interface ScannerTerminalContext {
  device: ScannerTerminalDevice;
  class_context?: {
    assignment_id: string;
    section_id: string;
    subject_id: string;
    teacher_id: string;
  } | null;
}

export interface ScannerAttendancePayload {
  student_id: string;
  student_number?: string;
  log_datetime: string;
  /** Optional scanner mode. AUTO keeps server-side alternation rules. */
  log_type?: 'TIME_IN' | 'TIME_OUT' | 'BREAK_OUT' | 'BREAK_IN' | 'AUTO';
  verification_method: 'FINGERPRINT' | 'FACE' | 'RFID' | 'QR_CODE' | 'PIN' | 'CARD' | 'MANUAL';
  verification_score?: number;
  event_id?: string;
}

export const scannerService = {
  async getScannerContext(terminalType: ScannerTerminalType): Promise<ScannerTerminalContext> {
    const { data } = await axiosClient.get<ScannerTerminalContext>(`/scanner/context/${terminalType}`);
    return data;
  },

  async recordHallwayAttendance(payload: ScannerAttendancePayload): Promise<RawTimelog> {
    const { data } = await axiosClient.post<RawTimelog>('/scanner/hallway/record', payload);
    return data;
  },

  async recordClassroomAttendance(payload: ScannerAttendancePayload): Promise<RawTimelog> {
    const { data } = await axiosClient.post<RawTimelog>('/scanner/classroom/record', payload);
    return data;
  },

  async recordEventAttendance(payload: ScannerAttendancePayload): Promise<RawTimelog> {
    const { data } = await axiosClient.post<RawTimelog>('/scanner/event/record', payload);
    return data;
  },

  async getActiveEvents(): Promise<CalendarEvent[]> {
    const { data } = await axiosClient.get<CalendarEvent[]>('/events/active-now');
    return data;
  },
};
