import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const MODES = {
  CUSTOMER: 'customer',
  DRIVER: 'driver',
  MERCHANT: 'merchant',
  ADMIN: 'admin',
};

const STORAGE_KEY = 'islandhop.mode';

const ModeContext = createContext(null);

export const useMode = () => {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error('useMode must be used inside <ModeProvider>');
  return ctx;
};

/**
 * Global mode (customer / driver / merchant / admin) provider.
 * - Persists the active mode in localStorage.
 * - Fetches authorized modes from /api/auth/me/modes (everyone gets customer).
 * - Falls back to 'customer' if the persisted mode isn't authorized.
 */
export const ModeProvider = ({ children }) => {
  const [mode, _setMode] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || MODES.CUSTOMER;
    } catch (_e) {
      return MODES.CUSTOMER;
    }
  });
  const [authorizedModes, setAuthorizedModes] = useState({ customer: true });
  const [modesLoading, setModesLoading] = useState(true);

  const refreshModes = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setAuthorizedModes({ customer: true });
      setModesLoading(false);
      return { customer: true };
    }
    try {
      const res = await axios.get(`${API}/auth/me/modes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAuthorizedModes(res.data);
      return res.data;
    } catch (err) {
      console.error('Failed to fetch authorized modes:', err);
      setAuthorizedModes({ customer: true });
      return { customer: true };
    } finally {
      setModesLoading(false);
    }
  }, []);

  // On mount: load authorized modes. If the user hasn't explicitly picked a mode
  // yet, default to their highest-privilege role (so a merchant/driver/admin isn't
  // shown as "Customer"). If a persisted mode is no longer authorized, fall back.
  useEffect(() => {
    refreshModes().then((modes) => {
      let persisted;
      try { persisted = localStorage.getItem(STORAGE_KEY); } catch (_e) { persisted = null; }
      if (!persisted) {
        // No explicit choice yet — pick the most relevant authorized role.
        const best = [MODES.ADMIN, MODES.MERCHANT, MODES.DRIVER, MODES.CUSTOMER].find((m) => modes[m]);
        if (best && best !== MODES.CUSTOMER) _setMode(best);
      } else if (persisted !== MODES.CUSTOMER && !modes[persisted]) {
        _setMode(MODES.CUSTOMER);
        try { localStorage.setItem(STORAGE_KEY, MODES.CUSTOMER); } catch (e) { console.warn('localStorage unavailable:', e); }
      }
    });
  }, [refreshModes]);

  const setMode = useCallback((newMode) => {
    _setMode(newMode);
    try { localStorage.setItem(STORAGE_KEY, newMode); } catch (e) { console.warn('localStorage unavailable:', e); }
  }, []);

  // Convenience flags
  const isCustomer = mode === MODES.CUSTOMER;
  const isDriver = mode === MODES.DRIVER;
  const isMerchant = mode === MODES.MERCHANT;
  const isAdmin = mode === MODES.ADMIN;

  const value = useMemo(() => ({
    mode,
    setMode,
    authorizedModes,
    modesLoading,
    refreshModes,
    isCustomer,
    isDriver,
    isMerchant,
    isAdmin,
  }), [mode, setMode, authorizedModes, modesLoading, refreshModes, isCustomer, isDriver, isMerchant, isAdmin]);

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
};
