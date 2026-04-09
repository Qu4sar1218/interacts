import axiosClient from './api';

export interface TimelogDevice {
  id: string;
  school_id: string;
  device_type_id: string;
  code: string;
  name: string;
  serial_number?: string | null;
  mac_address?: string | null;
  ip_address?: string | null;
  location_name: string | null;
  department_id: string | null;
  address?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  timezone: string;
  is_entry_only?: boolean;
  is_exit_only?: boolean;
  status: string;
  settings?: Record<string, unknown> | null;
  remarks?: string | null;
  installed_date?: string | null;
  last_sync_date?: string | null;
  last_online_date?: string | null;
  created_at?: string;
  updated_at?: string;
  school?: { id: string; name: string };
  device_type?: { id: string; code: string; name: string };
  department?: { id: string; name: string } | null;
}

export interface TimelogDeviceUpdatePayload {
  name: string;
  code: string;
  device_type_id: string;
  department_id: string | null;
  serial_number: string | null;
  mac_address: string | null;
  ip_address: string | null;
  location_name: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  is_entry_only: boolean;
  is_exit_only: boolean;
  status: 'Active' | 'Inactive' | 'Maintenance' | 'Offline';
  settings: Record<string, unknown> | null;
  remarks: string | null;
  installed_date: string | null;
}

export const timelogDeviceService = {
  async getDevices(): Promise<TimelogDevice[]> {
    const { data } = await axiosClient.get<TimelogDevice[]>('/timelog-devices');
    return data;
  },

  async getDeviceById(id: string): Promise<TimelogDevice> {
    const { data } = await axiosClient.get<TimelogDevice>(`/timelog-devices/${id}`);
    return data;
  },

  async updateDevice(id: string, payload: TimelogDeviceUpdatePayload): Promise<TimelogDevice> {
    const { data } = await axiosClient.put<TimelogDevice>(`/timelog-devices/${id}`, payload);
    return data;
  },
};
