import axiosClient from './api';

export interface AppUser {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  username: string;
  email: string | null;
  phoneNumber: string | null;
  address: string | null;
  birthday: string | null;
  imageUrl: string | null;
  active: boolean;
  roleId: string;
  schoolId: string | null;
  teacherDepartmentId: string | null;
  role?: { id: string; name: string; description?: string | null } | null;
  school?: { id: string; name: string; schoolCode?: string } | null;
  createdAt: string;
  updatedAt: string;
}

export const userService = {
  async getUsers(): Promise<AppUser[]> {
    const { data } = await axiosClient.get<AppUser[]>('/users');
    return data;
  },

  async getUserById(id: string): Promise<AppUser> {
    const { data } = await axiosClient.get<AppUser>(`/users/${id}`);
    return data;
  },
};

