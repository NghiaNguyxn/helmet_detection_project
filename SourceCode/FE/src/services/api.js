import axios from 'axios';
import toast from 'react-hot-toast';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const VERIFY_EMAIL_MESSAGE = 'Please verify your email before using this feature.';
const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please sign in again.';
let lastVerifyEmailToastAt = 0;
let lastSessionExpiredToastAt = 0;
let refreshPromise = null;

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const authApi = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const notifyUnauthorized = () => {
  localStorage.removeItem('token');
  const now = Date.now();
  if (now - lastSessionExpiredToastAt > 2500) {
    toast.error(SESSION_EXPIRED_MESSAGE);
    lastSessionExpiredToastAt = now;
  }
  window.dispatchEvent(new CustomEvent('auth:unauthorized', {
    detail: { reason: 'session_expired' },
  }));
};

const getApiErrorData = (error) => error?.response?.data || {};

const getApiErrorMessage = (error, fallback = 'Request failed. Please try again.') => {
  const data = getApiErrorData(error);
  const detail = data.detail;

  if (typeof data.message === 'string' && data.message.trim()) {
    return data.message;
  }

  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }

  if (Array.isArray(data.errors) && data.errors.length > 0) {
    return data.errors
      .map((item) => item?.message || item?.msg)
      .filter(Boolean)
      .join(', ') || fallback;
  }

  if (Array.isArray(detail) && detail.length > 0) {
    return detail
      .map((item) => item?.msg)
      .filter(Boolean)
      .join(', ') || fallback;
  }

  return fallback;
};

const getApiFieldErrors = (error) => {
  const data = getApiErrorData(error);
  const errors = Array.isArray(data.errors) ? data.errors : [];
  return errors.reduce((fields, item) => {
    if (item?.field && item?.message) {
      fields[item.field] = item.message;
    }
    return fields;
  }, {});
};

const refreshAccessToken = async () => {
  if (!refreshPromise) {
    refreshPromise = authApi.post('/auth/refresh')
      .then((response) => {
        const newToken = response.data?.access_token;
        if (!newToken) {
          throw new Error('Refresh response did not include an access token.');
        }

        localStorage.setItem('token', newToken);
        window.dispatchEvent(new CustomEvent('auth:token-refreshed', {
          detail: { token: newToken },
        }));
        return newToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

// Add auth interceptor if token exists
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const errorCode = error.response?.data?.error_code;
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      errorCode === 'NOT_AUTHENTICATED' &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.skipAuthRefresh
    ) {
      originalRequest._retry = true;

      try {
        const newToken = await refreshAccessToken();
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        notifyUnauthorized();
        return Promise.reject(refreshError);
      }
    }

    if (error.response?.status === 401 && errorCode === 'NOT_AUTHENTICATED') {
      notifyUnauthorized();
    }

    if (errorCode === 'USER_NOT_VERIFIED') {
      const now = Date.now();
      if (now - lastVerifyEmailToastAt > 2500) {
        toast.error(VERIFY_EMAIL_MESSAGE);
        lastVerifyEmailToastAt = now;
      }
    }

    return Promise.reject(error);
  }
);

const loginApi = (username, password) => {
  const formData = new URLSearchParams();
  formData.append('username', username);
  formData.append('password', password);

  return api.post('/auth/login', formData, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
};

const logoutApi = () => api.post('/auth/logout', null, { skipAuthRefresh: true });

export default api;
export { API_BASE_URL, getApiErrorData, getApiErrorMessage, getApiFieldErrors, loginApi, logoutApi };
