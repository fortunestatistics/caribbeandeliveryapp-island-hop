import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Loader2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
const MicrosoftAuthCallback = () => {
  const navigate = useNavigate();
  const processed = useRef(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const oauthError = params.get('error_description') || params.get('error');
    const expectedState = sessionStorage.getItem('ms_oauth_state');
    sessionStorage.removeItem('ms_oauth_state');

    if (oauthError) {
      setError(typeof oauthError === 'string' ? oauthError : 'Microsoft sign-in was cancelled.');
      setTimeout(() => navigate('/login'), 2000);
      return;
    }
    if (!code) {
      setError('No sign-in code found.');
      setTimeout(() => navigate('/login'), 1500);
      return;
    }
    if (!expectedState || expectedState !== state) {
      setError('Sign-in session expired or invalid. Please try again.');
      setTimeout(() => navigate('/login'), 2000);
      return;
    }

    (async () => {
      try {
        const redirectUri = window.location.origin + '/auth/microsoft/callback';
        const res = await axios.post(`${API}/auth/social/microsoft`, { code, redirect_uri: redirectUri });
        localStorage.setItem('token', res.data.access_token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        // Full reload so AuthContext re-initializes from the new token.
        window.location.href = '/dashboard';
      } catch (err) {
        setError(err.response?.data?.detail || 'Microsoft sign-in failed. Please try again.');
        setTimeout(() => navigate('/login'), 2000);
      }
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background" data-testid="microsoft-auth-callback">
      {!error ? (
        <>
          <Loader2 className="h-8 w-8 text-gold-500 animate-spin" />
          <p className="mt-4 text-muted-foreground text-sm">Signing you in with Microsoft…</p>
        </>
      ) : (
        <p className="text-red-400 text-sm" data-testid="microsoft-auth-error">{error}</p>
      )}
    </div>
  );
};

export default MicrosoftAuthCallback;
