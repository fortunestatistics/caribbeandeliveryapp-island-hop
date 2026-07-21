// Session token strategy (XSS hardening):
// - WEB: the real JWT is kept ONLY in an httpOnly cookie (JavaScript can't read it).
//   We store a non-secret sentinel ('cookie') in localStorage so the ~50 existing
//   `localStorage.getItem('token')` truthiness checks + `Bearer <token>` headers keep
//   working — the backend ignores the sentinel and authenticates via the cookie.
// - NATIVE (Capacitor): cross-origin WebViews can't rely on the cookie, so the real
//   JWT is stored and sent as a Bearer token, exactly as before.

export const WEB_TOKEN_SENTINEL = 'cookie';

export const isNativeApp = () => {
  try {
    return !!(
      window.Capacitor &&
      typeof window.Capacitor.isNativePlatform === 'function' &&
      window.Capacitor.isNativePlatform()
    );
  } catch (_e) {
    return false;
  }
};

// Persist a session after login / register / social / invite / impersonate.
export const storeSession = (jwt, user) => {
  try {
    localStorage.setItem('token', isNativeApp() ? (jwt || '') : WEB_TOKEN_SENTINEL);
    if (user !== undefined && user !== null) {
      localStorage.setItem('user', JSON.stringify(user));
    }
  } catch (_e) {
    /* localStorage unavailable */
  }
};

export const clearSession = () => {
  try {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  } catch (_e) {
    /* ignore */
  }
};
