import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

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

  const checkAuth = async () => {
    try {
      const token = (typeof localStorage !== 'undefined') ? localStorage.getItem('token') : null;
      applyAuthToken(token);
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(`${API}/auth/me`, {
        withCredentials: false,
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

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, { withCredentials: false });
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

  const value = useMemo(() => ({ user, logout, loading }), [user, loading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
