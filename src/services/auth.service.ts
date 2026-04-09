import axiosClient, { setTokens, clearTokens, getAccessToken } from './api';

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  username: string;
  email: string;
  phoneNumber?: string | null;
  address?: string | null;
  birthday?: string | null;
  imageUrl?: string | null;
  roleId: string;
  schoolId: string | null;
  active: boolean;
  role?: { id: string; name: string };
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export const authService = {
  async login(username: string, password: string): Promise<LoginResponse> {
    const { data } = await axiosClient.post<LoginResponse>('/auth/login', { username, password });
    setTokens(data.accessToken, data.refreshToken);
    return data;
  },

  async logout(): Promise<void> {
    try {
      await axiosClient.post('/auth/logout');
    } finally {
      clearTokens();
    }
  },

  async getCurrentUser(): Promise<AuthUser | null> {
    const token = getAccessToken();
    if (!token) return null;
    try {
      const { data } = await axiosClient.get<AuthUser>('/auth/me');
      return data;
    } catch {
      return null;
    }
  },

  async updateProfile(formData: FormData): Promise<AuthUser> {
    const { data } = await axiosClient.put<AuthUser>('/auth/profile', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async validateToken(): Promise<boolean> {
    try {
      await axiosClient.post('/auth/validate-token');
      return true;
    } catch {
      return false;
    }
  },

  isAdmin(user: AuthUser): boolean {
    return user.role?.name === 'Admin';
  },

  getAccessToken,
  clearTokens,
};
