import axios, { isAxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import Cookies from 'js-cookie';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3030/api';

const ACCESS_TOKEN_COOKIE = 'access_token';
const REFRESH_TOKEN_COOKIE = 'refresh_token';

/** Decode the `exp` claim from a JWT without verifying the signature. */
function getJwtExpDate(token: string): Date | undefined {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof payload.exp === 'number') return new Date(payload.exp * 1000);
  } catch {
    // malformed token — fall through
  }
  return undefined;
}

export function getAccessToken(): string | undefined {
  return Cookies.get(ACCESS_TOKEN_COOKIE);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  const accessExpires = getJwtExpDate(accessToken);
  const refreshExpires = getJwtExpDate(refreshToken);
  Cookies.set(ACCESS_TOKEN_COOKIE, accessToken, { expires: accessExpires, path: '/', sameSite: 'lax' });
  Cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, { expires: refreshExpires, path: '/', sameSite: 'lax' });
}

export function clearTokens(): void {
  Cookies.remove(ACCESS_TOKEN_COOKIE, { path: '/' });
  Cookies.remove(REFRESH_TOKEN_COOKIE, { path: '/' });
}

export function hasTokens(): boolean {
  return !!(Cookies.get(ACCESS_TOKEN_COOKIE) && Cookies.get(REFRESH_TOKEN_COOKIE));
}

const DEFAULT_API_ERROR_MESSAGE = 'Sign in failed. Please try again.';

/** Prefer API `message` from error responses; avoids Axios generic "Request failed with status code …". */
export function getApiErrorMessage(error: unknown, fallback = DEFAULT_API_ERROR_MESSAGE): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as { message?: unknown; error?: unknown } | undefined;
    const message = data?.message;
    if (typeof message === 'string' && message.trim().length > 0) return message;
    const legacyError = data?.error;
    if (typeof legacyError === 'string' && legacyError.trim().length > 0) return legacyError;
  }
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  return fallback;
}

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: Error) => void }> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else if (token) prom.resolve(token);
  });
  failedQueue = [];
};

const axiosClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

axiosClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** Returns true when the error is recoverable via a token refresh. */
function needsRefresh(error: { response?: { status?: number; data?: { code?: string } } }): boolean {
  const status = error.response?.status;
  const code = error.response?.data?.code;
  if (status === 403 && code === 'INVALID_TOKEN') return true;
  // Access cookie expired/cleared but refresh cookie still present
  if (status === 401 && code === 'NO_TOKEN' && !!Cookies.get(REFRESH_TOKEN_COOKIE)) return true;
  return false;
}

axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (needsRefresh(error) && !originalRequest._retry) {
      if (isRefreshing) {
        try {
          const token = await new Promise<string>((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          });
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return axiosClient(originalRequest);
        } catch (e) {
          return Promise.reject(e);
        }
      }

      originalRequest._retry = true;
      isRefreshing = true;
      const refreshToken = Cookies.get(REFRESH_TOKEN_COOKIE);

      if (!refreshToken) {
        clearTokens();
        processQueue(new Error('No refresh token'), null);
        isRefreshing = false;
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh-token`, { refreshToken }, { withCredentials: true });
        const { accessToken } = data;
        setTokens(accessToken, data.refreshToken || refreshToken);
        processQueue(null, accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return axiosClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as Error, null);
        clearTokens();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    if (error.response?.status === 403 && ['TOKEN_INVALIDATED', 'USER_INACTIVE', 'ACCOUNT_LOCKED'].includes(error.response?.data?.code)) {
      clearTokens();
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

export default axiosClient;
