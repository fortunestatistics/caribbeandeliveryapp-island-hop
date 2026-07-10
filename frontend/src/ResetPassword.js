import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Lock, Eye, EyeOff, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import { authAPI } from './services/api';

const ResetPassword = () => {
  const navigate = useNavigate();
  const token = (() => {
    try { return new URLSearchParams(window.location.search).get('token') || ''; }
    catch (_e) { return ''; }
  })();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      await authAPI.resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err?.response?.data?.detail || 'This reset link is invalid or has expired. Please request a new one.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4" data-testid="reset-password-page">
        <Card className="w-full max-w-md">
          <CardContent className="text-center space-y-3 py-8" data-testid="reset-no-token">
            <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
            <p className="text-foreground font-medium">Invalid reset link</p>
            <p className="text-sm text-muted-foreground">This link is missing its token. Please request a new password reset.</p>
            <Button className="w-full" onClick={() => navigate('/forgot-password')} data-testid="reset-request-new-btn">
              Request a new link
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4" data-testid="reset-password-page">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Set a new password</CardTitle>
          <p className="text-sm text-muted-foreground">Choose a strong password you haven't used before.</p>
        </CardHeader>
        <CardContent>
          {done ? (
            <div className="text-center space-y-3 py-4" data-testid="reset-success">
              <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto" />
              <p className="text-foreground font-medium">Password updated</p>
              <p className="text-sm text-muted-foreground">Redirecting you to login…</p>
              <Button className="w-full mt-2" onClick={() => navigate('/login')} data-testid="reset-go-login-btn">
                Go to login
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label htmlFor="password">New password</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground/70" />
                  <Input
                    id="password"
                    type={show ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    className="pl-10 pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    data-testid="reset-password-input"
                  />
                  <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-3 text-muted-foreground/70" data-testid="reset-toggle-visibility">
                    {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              <div>
                <Label htmlFor="confirm">Confirm new password</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground/70" />
                  <Input
                    id="confirm"
                    type={show ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    className="pl-10"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    data-testid="reset-confirm-input"
                  />
                </div>
              </div>
              {error && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-sm text-red-400" role="alert" data-testid="reset-error">
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full" disabled={loading} data-testid="reset-submit-btn">
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Update password
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
