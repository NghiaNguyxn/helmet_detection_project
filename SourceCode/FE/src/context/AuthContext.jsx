/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { logoutApi } from '../services/api';
import socketService from '../services/websocket';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  const clearClientSession = useCallback(() => {
    socketService.disconnect();
    localStorage.removeItem('token');
    localStorage.removeItem('helmet_session_stats');
    localStorage.removeItem('helmet_processed_ids');
    localStorage.removeItem('helmet_session_start');
    localStorage.removeItem('helmet_cam_active');
    setToken(null);
    setUser(null);
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } catch (error) {
      console.error('Logout request failed:', error);
    }
    clearClientSession();
  }, [clearClientSession]);

  const fetchUserProfile = useCallback(async () => {
    try {
      const response = await api.get('/users/me');
      if (response.data.code === 200) {
        setUser(response.data.result);
      }
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      logout();
    } finally {
      setLoading(false);
    }
  }, [logout]);

  const login = (newToken) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
  };

  useEffect(() => {
    if (token) {
      fetchUserProfile();
    } else {
      setLoading(false);
    }
  }, [token, fetchUserProfile]);

  useEffect(() => {
    const handleUnauthorized = () => {
      clearClientSession();
      setLoading(false);
    };
    const handleTokenRefreshed = (event) => {
      setToken(event.detail.token);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    window.addEventListener('auth:token-refreshed', handleTokenRefreshed);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
      window.removeEventListener('auth:token-refreshed', handleTokenRefreshed);
    };
  }, [clearClientSession]);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, fetchUserProfile, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
