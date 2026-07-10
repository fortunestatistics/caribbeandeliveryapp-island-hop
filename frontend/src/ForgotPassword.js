import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Mail, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { authAPI } from './services/api';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authAPI.forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4" data-testid="forgot-password-page">
      <Card className="w-full max-w-md">
        <CardHeader>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            data-testid="forgot-back-to-login"
          >
            <ArrowLeft className="h-4 w-4" /> Back to login
          </button>
          <CardTitle className="text-2xl">Forgot your password?</CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter your account email and we'll send you a link to reset it.
          </p>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="text-center space-y-3 py-4" data-testid="forgot-success">
              <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto" />
              <p className="text-foreground font-medium">Check your inbox</p>
              <p className="text-sm text-muted-foreground">
                If an account exists for <span className="font-medium">{email}</span>, a password reset
                link is on its way. The link expires in 1 hour.
              </p>
              <Button className="w-full mt-2" onClick={() => navigate('/login')} data-testid="forgot-done-btn">
                Return to login
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-3 h-5 w-5 text-muted-foreground/70" />
                  <Input
                    id="email"
                    type="email"
                    required
                    placeholder="you@example.com"
                    className="pl-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    data-testid="forgot-email-input"
                  />
                </div>
              </div>
              {error && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-sm text-red-400" role="alert" data-testid="forgot-error">
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full" disabled={loading} data-testid="forgot-submit-btn">
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Send reset link
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ForgotPassword;
