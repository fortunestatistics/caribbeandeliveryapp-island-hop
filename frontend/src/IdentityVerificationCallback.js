import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { ShieldCheck, Clock, AlertTriangle, Loader2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const IdentityVerificationCallback = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/drivers/identity/status`, { headers: authHeaders() });
      setStatus(res.data);
    } catch {
      setStatus({ status: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    // Poll a few times in case the webhook/processing lags slightly.
    const t = setInterval(fetchStatus, 4000);
    const stop = setTimeout(() => clearInterval(t), 24000);
    return () => { clearInterval(t); clearTimeout(stop); };
  }, [fetchStatus]);

  const verified = status?.status === 'verified';
  const pending = ['processing', 'requires_input', 'unstarted'].includes(status?.status);

  return (
    <div className="min-h-screen flex items-center justify-center bg-matte-900 p-4" data-testid="identity-callback-page">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-gold-500" />Identity Verification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {loading ? (
            <div className="py-6" data-testid="identity-loading">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-gold-500" />
              <p className="text-sm text-muted-foreground mt-2">Checking your verification…</p>
            </div>
          ) : verified ? (
            <div className="py-4" data-testid="identity-verified">
              <ShieldCheck className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <p className="font-semibold text-green-400">You're verified and approved!</p>
              <p className="text-sm text-muted-foreground mt-1">Your driver account is now active. You can go online and start accepting trips.</p>
            </div>
          ) : pending ? (
            <div className="py-4" data-testid="identity-pending">
              <Clock className="h-12 w-12 text-yellow-500 mx-auto mb-3" />
              <p className="font-semibold text-yellow-400">Verification in progress</p>
              <p className="text-sm text-muted-foreground mt-1">If you completed the check, it may take a moment. Otherwise, our team will review your application within 24–48 hours.</p>
            </div>
          ) : (
            <div className="py-4" data-testid="identity-review">
              <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-3" />
              <p className="font-semibold">Sent for manual review</p>
              <p className="text-sm text-muted-foreground mt-1">We couldn't auto-verify your identity. Our team will review your documents and get back to you shortly.</p>
            </div>
          )}
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={fetchStatus} data-testid="identity-refresh-btn">Refresh</Button>
            <Button onClick={() => navigate('/dashboard')} data-testid="identity-dashboard-btn">Go to Dashboard</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default IdentityVerificationCallback;
