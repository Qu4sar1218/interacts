/* eslint-disable react-refresh/only-export-components -- useAuth is a hook paired with AuthProvider */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authService, type AuthUser } from '@/services/auth.service';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isAdmin: boolean;
  isTeacher: boolean;
  isStudent: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function getDashboardPath(roleName?: string): string {
  if (roleName === 'Teacher') return '/teacher-dashboard';
  if (roleName === 'Student') return '/student-dashboard';
  return '/';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const u = await authService.getCurrentUser();
    setUser(u);
    return;
  }, []);

  useEffect(() => {
    let mounted = true;
    authService.getCurrentUser().then((u) => {
      if (mounted) {
        setUser(u);
        setIsLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const data = await authService.login(username, password);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  const value: AuthContextValue = {
    user,
    isLoading,
    login,
    logout,
    refreshUser,
    isAdmin: user ? authService.isAdmin(user) : false,
    isTeacher: user?.role?.name === 'Teacher',
    isStudent: user?.role?.name === 'Student',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
