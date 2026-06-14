import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Loader2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
const SocialAuthCallback = () => {
  const navigate = useNavigate();
  const processed = useRef(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const hash = window.location.hash || '';
    const match = hash.match(/session_id=([^&]+)/);
    const sessionId = match ? decodeURIComponent(match[1]) : null;

    if (!sessionId) {
      setError('No sign-in session found.');
      setTimeout(() => navigate('/login'), 1500);
      return;
    }

    (async () => {
      try {
        const res = await axios.post(`${API}/auth/social/google`, { session_id: sessionId });
        localStorage.setItem('token', res.data.access_token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        // Full reload so AuthContext re-initializes from the new token.
        window.location.href = '/dashboard';
      } catch (err) {
        setError(err.response?.data?.detail || 'Google sign-in failed. Please try again.');
        setTimeout(() => navigate('/login'), 2000);
      }
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background" data-testid="social-auth-callback">
      {!error ? (
        <>
          <Loader2 className="h-8 w-8 text-gold-500 animate-spin" />
          <p className="mt-4 text-muted-foreground text-sm">Signing you in…</p>
        </>
      ) : (
        <p className="text-red-400 text-sm" data-testid="social-auth-error">{error}</p>
      )}
    </div>
  );
};

export default SocialAuthCallback;
