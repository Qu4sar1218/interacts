import axiosClient from './api';

export type ReportTerminal = 'hallway' | 'classroom' | 'event';
export type ReportGranularity = 'daily' | 'weekly' | 'monthly';

export interface TerminalAnalyticsSeriesPoint {
  period_key: string;
  label: string;
  /** Backward-compatible alias for distinct_time_in_students. */
  distinct_students: number;
  distinct_time_in_students: number;
  distinct_time_out_students: number;
  time_in_scans: number;
  time_out_scans: number;
  total_scans: number;
}

export interface TerminalAnalyticsResponse {
  terminal: ReportTerminal;
  granularity: ReportGranularity;
  from: string;
  to: string;
  device: { id: string; code: string; name: string } | null;
  event: { id: string; name: string } | null;
  series: TerminalAnalyticsSeriesPoint[];
  note: string | null;
}

export interface SectionAttendanceCourse {
  id: string;
  name: string;
  code: string;
}

export interface SectionAttendanceHeader {
  id: string;
  name: string;
  code: string;
  course: SectionAttendanceCourse | null;
}

export interface SectionAttendanceRow {
  id: string;
  attendance_date: string;
  status: string;
  first_scan_at: string | null;
  last_scan_at: string | null;
  time_in: string | null;
  time_out: string | null;
  student: {
    id: string;
    full_name: string;
    student_id_number: string | null;
    image_url: string | null;
  } | null;
  subject: { id: string; name: string; code: string } | null;
  teacher: { id: string; full_name: string } | null;
  assignment: {
    id: string;
    start_time: string | null;
    end_time: string | null;
  } | null;
}

export interface SectionAttendanceResponse {
  section: SectionAttendanceHeader;
  date: string;
  rows: SectionAttendanceRow[];
}

export interface HallwayDailyComparisonResponse {
  date: string;
  enrolled_total: number;
  distinct_check_ins: number;
  /** Distinct students with at least one TIME_OUT at hallway device that day. */
  distinct_check_outs: number;
  not_scanned_in_hallway: number;
}

export interface SectionAttendanceBySubjectRow {
  subject_id: string;
  subject_name: string | null;
  subject_code: string | null;
  enrolled_count: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  records: number;
  present_or_late: number;
}

export interface SectionAttendanceBySubjectResponse {
  section_id: string;
  section_name: string;
  section_code: string;
  date: string;
  enrolled_in_section: number;
  subjects: SectionAttendanceBySubjectRow[];
}

export interface SectionAttendanceTrendPoint {
  date: string;
  label: string;
  present: number;
  late: number;
  absent: number;
  excused: number;
  records: number;
  present_or_late: number;
}

export interface SectionAttendanceTrendResponse {
  section_id: string;
  from: string;
  to: string;
  series: SectionAttendanceTrendPoint[];
}

function filenameFromContentDisposition(headerValue: string | undefined): string | null {
  if (!headerValue) return null;
  const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);
  const quotedMatch = headerValue.match(/filename="([^"]+)"/i);
  if (quotedMatch?.[1]) return quotedMatch[1];
  const plainMatch = headerValue.match(/filename=([^;]+)/i);
  if (plainMatch?.[1]) return plainMatch[1].trim();
  return null;
}

async function getCsvDownload(
  url: string,
  params: Record<string, string | undefined>,
  fallbackFilename: string
): Promise<{ blob: Blob; filename: string }> {
  const response = await axiosClient.get<Blob>(url, {
    params,
    responseType: 'blob',
  });
  const disposition = response.headers?.['content-disposition'] as string | undefined;
  const filename = filenameFromContentDisposition(disposition) || fallbackFilename;
  return { blob: response.data, filename };
}

export const reportsService = {
  async getTerminalAnalytics(params: {
    terminal: ReportTerminal;
    from: string;
    to: string;
    granularity: ReportGranularity;
    event_id?: string;
  }): Promise<TerminalAnalyticsResponse> {
    const { data } = await axiosClient.get<TerminalAnalyticsResponse>('/reports/terminal-analytics', {
      params: {
        terminal: params.terminal,
        from: params.from,
        to: params.to,
        granularity: params.granularity,
        event_id: params.event_id,
      },
    });
    return data;
  },

  async getSectionAttendance(params: { sectionId: string; date: string }): Promise<SectionAttendanceResponse> {
    const { data } = await axiosClient.get<SectionAttendanceResponse>('/reports/section-attendance', {
      params: { section_id: params.sectionId, date: params.date },
    });
    return data;
  },

  async getHallwayDailyComparison(params: { date: string }): Promise<HallwayDailyComparisonResponse> {
    const { data } = await axiosClient.get<HallwayDailyComparisonResponse>('/reports/hallway-daily-comparison', {
      params: { date: params.date },
    });
    return data;
  },

  async getSectionAttendanceBySubject(params: {
    sectionId: string;
    date: string;
  }): Promise<SectionAttendanceBySubjectResponse> {
    const { data } = await axiosClient.get<SectionAttendanceBySubjectResponse>(
      '/reports/section-attendance-by-subject',
      { params: { section_id: params.sectionId, date: params.date } }
    );
    return data;
  },

  async getSectionAttendanceTrend(params: {
    sectionId: string;
    from: string;
    to: string;
  }): Promise<SectionAttendanceTrendResponse> {
    const { data } = await axiosClient.get<SectionAttendanceTrendResponse>('/reports/section-attendance-trend', {
      params: { section_id: params.sectionId, from: params.from, to: params.to },
    });
    return data;
  },

  async exportHallwayCsv(params: { from: string; to: string }): Promise<{ blob: Blob; filename: string }> {
    return getCsvDownload(
      '/reports/export-hallway-csv',
      { from: params.from, to: params.to },
      `hallway_timelogs_${params.from}_${params.to}.csv`
    );
  },

  async exportClassroomCsv(params: { from: string; to: string }): Promise<{ blob: Blob; filename: string }> {
    return getCsvDownload(
      '/reports/export-classroom-csv',
      { from: params.from, to: params.to },
      `classroom_timelogs_${params.from}_${params.to}.csv`
    );
  },

  async exportEventCsv(params: {
    from: string;
    to: string;
    eventId?: string;
  }): Promise<{ blob: Blob; filename: string }> {
    return getCsvDownload(
      '/reports/export-event-csv',
      { from: params.from, to: params.to, event_id: params.eventId },
      `event_timelogs_${params.from}_${params.to}.csv`
    );
  },
};
