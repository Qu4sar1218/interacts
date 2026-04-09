import axios from 'axios';
import axiosClient from './api';

export type PaymentStatus = 'pending' | 'rejected' | 'verified';

/** Display labels (API still uses `verified` for approved payments). */
export function formatPaymentStatusLabel(status: PaymentStatus): string {
  const labels: Record<PaymentStatus, string> = {
    pending: 'Pending',
    rejected: 'Rejected',
    verified: 'Approved',
  };
  return labels[status];
}

export interface PaymentStudentSnippet {
  id: string;
  first_name: string;
  last_name: string;
  student_id_number: string;
  email: string;
  user: { id: string; image_url: string | null } | null;
}

export interface Payment {
  id: string;
  student_id: string;
  event_id: string;
  amount: string;
  purpose: string;
  image_url: string;
  status: PaymentStatus;
  remarks: string | null;
  created_at: string;
  updated_at: string;
  event?: {
    id: string;
    name: string;
    event_date: string;
    start_date: string;
    end_date: string;
    time_start: string;
    time_end: string;
    status: boolean;
  } | null;
  student?: PaymentStudentSnippet | null;
}

export interface PaymentAdminUpdatePayload {
  status?: PaymentStatus;
  remarks?: string | null;
}

function apiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const msg = (error.response?.data as { error?: string } | undefined)?.error;
    if (msg) return msg;
  }
  if (error instanceof Error) return error.message;
  return 'Request failed';
}

export const paymentService = {
  async createPayment(payload: { event_id: string; purpose: string; receipt: File }): Promise<Payment> {
    const formData = new FormData();
    formData.append('event_id', payload.event_id);
    formData.append('purpose', payload.purpose);
    formData.append('receipt', payload.receipt);
    try {
      const { data } = await axiosClient.post<Payment>('/payments', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    } catch (e) {
      throw new Error(apiErrorMessage(e));
    }
  },

  async listMyPayments(): Promise<Payment[]> {
    const { data } = await axiosClient.get<Payment[]>('/payments/me');
    return data;
  },

  async listPayments(params?: { status?: PaymentStatus; event_id?: string }): Promise<Payment[]> {
    const { data } = await axiosClient.get<Payment[]>('/payments', { params });
    return data;
  },

  async getPayment(id: string): Promise<Payment> {
    const { data } = await axiosClient.get<Payment>(`/payments/${id}`);
    return data;
  },

  async updatePayment(id: string, payload: PaymentAdminUpdatePayload): Promise<Payment> {
    try {
      const { data } = await axiosClient.patch<Payment>(`/payments/${id}`, payload);
      return data;
    } catch (e) {
      throw new Error(apiErrorMessage(e));
    }
  },
};
