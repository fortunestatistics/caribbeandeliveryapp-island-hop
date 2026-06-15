import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Badge } from './components/ui/badge';
import { UserPlus, Mail, Shield, Trash2, KeyRound, Copy } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const AdminTeam = () => {
  const [team, setTeam] = useState([]);
  const [promoteEmail, setPromoteEmail] = useState('');
  const [promoteRole, setPromoteRole] = useState('admin');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('admin');
  const [pwd, setPwd] = useState({ current_password: '', new_password: '' });

  const loadTeam = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/admin/team`, { headers: authHeaders() });
      setTeam(r.data.team || []);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load team');
    }
  }, []);

  useEffect(() => { loadTeam(); }, [loadTeam]);

  const promote = async () => {
    try {
      await axios.post(`${API}/admin/team/promote`, { email: promoteEmail, role: promoteRole }, { headers: authHeaders() });
      toast.success(`${promoteEmail} is now ${promoteRole}`);
      setPromoteEmail('');
      loadTeam();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Promote failed');
    }
  };

  const invite = async () => {
    try {
      const r = await axios.post(`${API}/admin/team/invite`, { email: inviteEmail, role: inviteRole }, { headers: authHeaders() });
      setInviteEmail('');
      if (r.data.emailed) {
        toast.success(`Invite emailed to ${r.data.email}`);
      } else {
        try {
          await navigator.clipboard?.writeText(r.data.invite_link);
        } catch (clipErr) {
          // Clipboard permission denied (preview/headless); still show the link in the toast description.
        }
        toast.success('Invite link copied (email not configured here)', { description: r.data.invite_link });
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Invite failed');
    }
  };

  const revoke = async (member) => {
    if (!window.confirm(`Revoke ${member.email}'s access?`)) return;
    try {
      await axios.post(`${API}/admin/team/revoke`, { user_id: member.id }, { headers: authHeaders() });
      toast.success(`Revoked ${member.email}`);
      loadTeam();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Revoke failed');
    }
  };

  const changePassword = async () => {
    try {
      await axios.post(`${API}/auth/change-password`, pwd, { headers: authHeaders() });
      toast.success('Password updated');
      setPwd({ current_password: '', new_password: '' });
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not change password');
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-team-content">
      {/* Add members */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><UserPlus className="h-4 w-4 text-gold-500" />Promote existing user</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="user@email.com" value={promoteEmail} onChange={(e) => setPromoteEmail(e.target.value)} data-testid="promote-email-input" />
            <select value={promoteRole} onChange={(e) => setPromoteRole(e.target.value)} className="w-full bg-matte-900 border border-border rounded-md px-3 py-2 text-sm" data-testid="promote-role-select">
              <option value="admin">Admin (full access)</option>
              <option value="agent">Support Agent (limited)</option>
            </select>
            <Button onClick={promote} disabled={!promoteEmail} className="w-full" data-testid="promote-btn">Make {promoteRole}</Button>
            <p className="text-xs text-muted-foreground">The person must have signed up already.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Mail className="h-4 w-4 text-gold-500" />Invite by email</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="newteammate@email.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} data-testid="invite-email-input" />
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="w-full bg-matte-900 border border-border rounded-md px-3 py-2 text-sm" data-testid="invite-role-select">
              <option value="admin">Admin (full access)</option>
              <option value="agent">Support Agent (limited)</option>
            </select>
            <Button onClick={invite} disabled={!inviteEmail} className="w-full" data-testid="invite-btn"><Copy className="h-4 w-4 mr-1" />Send invite</Button>
            <p className="text-xs text-muted-foreground">They get a link to set their own password.</p>
          </CardContent>
        </Card>
      </div>

      {/* Team list */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Shield className="h-4 w-4 text-gold-500" />Current team ({team.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2" data-testid="team-list">
            {team.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-3 rounded-lg bg-matte-900/40 border border-border" data-testid={`team-member-${m.id}`}>
                <div>
                  <div className="font-medium flex items-center gap-1">{m.name || m.email} {m.is_owner && <Badge className="bg-gold-500/20 text-gold-500">Owner</Badge>}</div>
                  <p className="text-xs text-muted-foreground">{m.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={m.user_type === 'admin' ? 'bg-green-600/20 text-green-400' : 'bg-blue-600/20 text-blue-400'}>{m.user_type}</Badge>
                  {!m.is_owner && (
                    <Button size="sm" variant="ghost" onClick={() => revoke(m)} data-testid={`revoke-btn-${m.id}`}><Trash2 className="h-4 w-4 text-red-400" /></Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Change my password */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4 text-gold-500" />Change my password</CardTitle></CardHeader>
        <CardContent className="space-y-3 max-w-md">
          <Input type="password" placeholder="Current password" value={pwd.current_password} onChange={(e) => setPwd({ ...pwd, current_password: e.target.value })} data-testid="current-password-input" />
          <Input type="password" placeholder="New password (min 8 chars)" value={pwd.new_password} onChange={(e) => setPwd({ ...pwd, new_password: e.target.value })} data-testid="new-password-input" />
          <Button onClick={changePassword} disabled={!pwd.current_password || !pwd.new_password} data-testid="change-password-btn">Update password</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminTeam;
