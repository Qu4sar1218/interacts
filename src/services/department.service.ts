import axiosClient from './api';

export interface Department {
  id: string;
  name: string;
  code: string;
  description: string | null;
  active: boolean;
  modifiedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentPayload {
  name: string;
  code: string;
  description?: string;
  active?: boolean;
}

export const departmentService = {
  async getDepartments(params?: { active?: boolean }): Promise<Department[]> {
    const { data } = await axiosClient.get<Department[]>('/departments', { params });
    return data;
  },

  async getDepartmentById(id: string): Promise<Department> {
    const { data } = await axiosClient.get<Department>(`/departments/${id}`);
    return data;
  },

  async createDepartment(payload: DepartmentPayload): Promise<Department> {
    const { data } = await axiosClient.post<Department>('/departments', payload);
    return data;
  },

  async updateDepartment(id: string, payload: Partial<DepartmentPayload>): Promise<Department> {
    const { data } = await axiosClient.put<Department>(`/departments/${id}`, payload);
    return data;
  },
};
