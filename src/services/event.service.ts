import axiosClient from './api';

export interface CalendarEvent {
  id: string;
  name: string;
  description: string | null;
  eventDate: string;
  startDate: string;
  endDate: string;
  timeStart: string;
  timeEnd: string;
  status: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EventCreatePayload {
  name: string;
  description?: string;
  eventDate: string;
  startDate: string;
  endDate: string;
  timeStart: string;
  timeEnd: string;
  status?: boolean;
}

export const eventService = {
  async getEvents(params?: { start_date?: string; end_date?: string; status?: boolean }): Promise<CalendarEvent[]> {
    const { data } = await axiosClient.get<CalendarEvent[]>('/events', { params });
    return data;
  },

  /** Events active for today (same rules as Event Face Terminal). */
  async getActiveEventsNow(): Promise<CalendarEvent[]> {
    const { data } = await axiosClient.get<CalendarEvent[]>('/events/active-now');
    return data;
  },

  async getEventById(id: string): Promise<CalendarEvent> {
    const { data } = await axiosClient.get<CalendarEvent>(`/events/${id}`);
    return data;
  },

  async createEvent(payload: EventCreatePayload): Promise<CalendarEvent> {
    const { data } = await axiosClient.post<CalendarEvent>('/events', payload);
    return data;
  },

  async updateEvent(id: string, payload: Partial<EventCreatePayload>): Promise<CalendarEvent> {
    const { data } = await axiosClient.put<CalendarEvent>(`/events/${id}`, payload);
    return data;
  },
};
