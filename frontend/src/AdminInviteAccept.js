import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdminInviteAccept = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadInvite = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/auth/invite/${token}`);
      setInvite(r.data);
    } catch (e) {
      setError(e.response?.data?.detail || 'Invalid or expired invite');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadInvite(); }, [loadInvite]);

  const accept = async () => {
    setSubmitting(true);
    try {
      const r = await axios.post(`${API}/auth/invite/accept`, { token, name, password });
      localStorage.setItem('token', r.data.access_token);
      toast.success('Welcome to the IslandHop team!');
      window.location.href = '/admin';
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not accept invite');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-matte-900 p-4" data-testid="invite-accept-page">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-gold-500" />Join the IslandHop Team</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="py-6 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-gold-500" /></div>
          ) : error ? (
            <div className="py-4 text-center" data-testid="invite-error">
              <p className="text-red-400">{error}</p>
              <Button className="mt-4" onClick={() => navigate('/login')}>Go to Login</Button>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                You're invited as <strong className="text-foreground">{invite.role}</strong> for <strong className="text-foreground">{invite.email}</strong>. Set your password to continue.
              </p>
              <Input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} data-testid="invite-name-input" />
              <Input type="password" placeholder="Choose a password (min 8 chars)" value={password} onChange={(e) => setPassword(e.target.value)} data-testid="invite-password-input" />
              <Button className="w-full" onClick={accept} disabled={!name || password.length < 8 || submitting} data-testid="invite-accept-btn">
                {submitting ? 'Activating…' : 'Activate my account'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminInviteAccept;
