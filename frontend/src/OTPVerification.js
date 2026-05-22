import React, { useState } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Phone, ShieldCheck } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

/**
 * OTP verification widget.
 * Props:
 *  - phone: phone number to verify
 *  - purpose: 'signup' | 'login' | 'verify'
 *  - onVerified(code): callback with the verified code
 *  - onCancel(): optional cancel callback
 */
const OTPVerification = ({ phone, purpose = 'signup', onVerified, onCancel }) => {
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const sendCode = async () => {
    setError('');
    setSubmitting(true);
    try {
      const res = await axios.post(`${API}/otp/send`, { phone, purpose });
      setSent(true);
      if (res.data.dev_code) {
        setDevCode(res.data.dev_code);
        setCode(res.data.dev_code); // auto-fill the controlled input
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send OTP');
    } finally {
      setSubmitting(false);
    }
  };

  const verifyCode = async () => {
    if (!code.trim()) {
      setError('Enter the 6-digit code');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await axios.post(`${API}/otp/verify`, { phone, code: code.trim(), purpose });
      onVerified && onVerified(code.trim());
    } catch (err) {
      setError(err.response?.data?.detail || 'Verification failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card data-testid="otp-verification-card" className="border-gold-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-gold-500" />
          Verify Your Phone
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          We'll send a 6-digit code to <span className="text-foreground font-mono">{phone}</span>
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!sent ? (
          <Button
            data-testid="otp-send-btn"
            onClick={sendCode}
            disabled={submitting || !phone}
            className="w-full bg-gold-gradient text-white"
          >
            <Phone className="h-4 w-4 mr-2" />
            {submitting ? 'Sending…' : 'Send Code'}
          </Button>
        ) : (
          <>
            {devCode && (
              <div className="bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan text-xs rounded-md p-3" data-testid="otp-dev-banner">
                Dev mode: your code is <strong>{devCode}</strong> (auto-filled)
              </div>
            )}
            <div>
              <Label htmlFor="otp-input">Verification Code</Label>
              <Input
                id="otp-input"
                data-testid="otp-input"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                maxLength={6}
                className="mt-1 text-center text-2xl tracking-[0.5em] font-mono"
              />
            </div>
            <div className="flex gap-2">
              <Button
                data-testid="otp-verify-btn"
                onClick={verifyCode}
                disabled={submitting}
                className="flex-1 bg-gold-gradient text-white"
              >
                {submitting ? 'Verifying…' : 'Verify Code'}
              </Button>
              <Button
                data-testid="otp-resend-btn"
                variant="outline"
                onClick={sendCode}
                disabled={submitting}
              >
                Resend
              </Button>
            </div>
            {onCancel && (
              <Button data-testid="otp-cancel-btn" variant="ghost" onClick={onCancel} className="w-full">
                Cancel
              </Button>
            )}
          </>
        )}
        {error && (
          <p className="text-sm text-red-500" data-testid="otp-error">{error}</p>
        )}
      </CardContent>
    </Card>
  );
};

export default OTPVerification;
