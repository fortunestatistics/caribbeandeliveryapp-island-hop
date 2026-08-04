import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { KeyRound, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

// Blocking gate: when an admin has set a temporary password (must_change_password),
// the user is forced to set their own password before using the app.
const ForcePasswordChange = () => {
  const { user, impersonation, refreshUser } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  // Don't gate an admin who is impersonating a user (they aren't the real owner).
  if (!user || !user.must_change_password || impersonation) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (next.length < 8) { toast.error('New password must be at least 8 characters'); return; }
    if (next !== confirm) { toast.error('Passwords do not match'); return; }
    setBusy(true);
    try {
      await axios.post(`${API}/auth/change-password`,
        { current_password: current, new_password: next },
        { headers: authHeaders() });
      toast.success('Password updated — you\'re all set');
      await refreshUser();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Could not update password');
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" data-testid="force-password-change">
      <div className="w-full max-w-md rounded-2xl bg-background border border-border shadow-2xl p-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-9 w-9 rounded-full flex items-center justify-center" style={{ background: '#0FA3A3' }}>
            <KeyRound className="h-5 w-5 text-white" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Set a new password</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Your account was given a temporary password by an administrator. Please choose your own password to continue.
        </p>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Temporary password</Label>
            <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="The password admin gave you" data-testid="force-pw-current" required />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">New password</Label>
            <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="At least 8 characters" data-testid="force-pw-new" required />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Confirm new password</Label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter new password" data-testid="force-pw-confirm" required />
          </div>
          <Button type="submit" className="w-full" disabled={busy} data-testid="force-pw-submit">
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <KeyRound className="h-4 w-4 mr-1" />}Update password
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ForcePasswordChange;
