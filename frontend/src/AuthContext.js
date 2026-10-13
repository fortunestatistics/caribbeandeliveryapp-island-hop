import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Send the httpOnly auth cookie on EVERY axios request (web relies on it; the real
// JWT is no longer kept in localStorage). Runs at module load, before any request.
axios.defaults.withCredentials = true;

// Attach the stored JWT to ALL axios requests globally so components using the raw
// `axios` import (driver/vendor dashboards, etc.) are authenticated. Runs at module
// load, before any component mounts.
export const applyAuthToken = (token) => {
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common['Authorization'];
  }
};
try {
  applyAuthToken(typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null);
} catch (e) { /* localStorage unavailable */ }

export const AuthContext = React.createContext();

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [impersonation, setImpersonation] = useState(() => {
    try {
      const raw = localStorage.getItem('impersonation');
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  });

  const checkAuth = async () => {
    try {
      const token = (typeof localStorage !== 'undefined') ? localStorage.getItem('token') : null;
      applyAuthToken(token);
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(`${API}/auth/me`, {
        withCredentials: true,
        headers,
        validateStatus: (status) => status < 500,
      });
      if (response.status === 200) {
        setUser(response.data);
      } else {
        setUser(null);
      }
    } catch (error) {
      if (error.response?.status >= 500) {
        console.error('Auth check error:', error);
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // Force Re-login: re-fetch the current user (called on a WS 'session_refresh' after an admin repair).
  const refreshUser = async () => { await checkAuth(); };

  // Admin impersonation (read-only): swap this tab's Bearer to the target's token so the
  // admin sees the user's own dashboard. The admin cookie stays but the backend prefers the
  // impersonation Bearer. Writes are blocked server-side.
  const impersonate = async (userId, targetName, edit = false) => {
    const res = await axios.post(`${API}/admin/impersonate/${userId}`, {}, { params: edit ? { edit: 1 } : {}, withCredentials: true });
    const impToken = res.data.token;
    const readonly = res.data.readonly !== false;
    try {
      const admin = localStorage.getItem('token');
      if (admin) localStorage.setItem('admin_token_backup', admin);
      localStorage.setItem('token', impToken);
      const info = { targetName: targetName || res.data.user?.name || res.data.user?.email, readonly, userType: res.data.user?.user_type };
      localStorage.setItem('impersonation', JSON.stringify(info));
      setImpersonation(info);
    } catch (e) { /* localStorage unavailable */ }
    applyAuthToken(impToken);
    await checkAuth();
    return res.data.user;
  };

  const exitImpersonation = async () => {
    try {
      const admin = localStorage.getItem('admin_token_backup');
      if (admin) { localStorage.setItem('token', admin); } else { localStorage.removeItem('token'); }
      localStorage.removeItem('admin_token_backup');
      localStorage.removeItem('impersonation');
    } catch (e) { /* localStorage unavailable */ }
    applyAuthToken((typeof localStorage !== 'undefined') ? localStorage.getItem('token') : null);
    setImpersonation(null);
    await checkAuth();
  };

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
    } catch (error) {
      console.error('Logout request failed:', error);
    }
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } catch (e) { console.warn('localStorage unavailable during logout:', e); }
    applyAuthToken(null);
    setUser(null);
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const value = useMemo(() => ({ user, logout, loading, impersonation, impersonate, exitImpersonation, refreshUser }), [user, loading, impersonation]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
