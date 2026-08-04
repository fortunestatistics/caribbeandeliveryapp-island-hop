import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { Mail, Phone, MapPin, RefreshCw, Loader2, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const token = () => localStorage.getItem('token');
const authHeaders = () => ({ Authorization: `Bearer ${token()}` });

/**
 * Lists driver applicants who started but did NOT finish / submit their form.
 * These are captured as status="incomplete" so admins can follow up.
 * Rendered under the admin Users tab.
 */
const IncompleteApplications = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [nudging, setNudging] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/records/drivers`, {
        headers: authHeaders(), params: { status: 'incomplete', limit: 200 },
      });
      setRows(Array.isArray(res.data?.records) ? res.data.records : []);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to load incomplete applications');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const nudge = async (row) => {
    if (!row.email) { toast.error('This applicant has no email on file.'); return; }
    setNudging(row.id);
    try {
      await axios.post(`${API}/admin/applicants/${row.id}/remind`, {}, { headers: authHeaders() });
      toast.success(`Reminder sent to ${row.name || row.email}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not send reminder');
    } finally {
      setNudging(null);
    }
  };

  return (
    <Card className="mb-6 border-l-4 border-l-amber-500" data-testid="incomplete-applications-card">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-amber-500" />
            Incomplete Applications ({rows.length})
          </CardTitle>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} data-testid="incomplete-refresh-btn">
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />} Refresh
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          People who started a driver application but haven&apos;t finished. Nudge them to complete it — they also appear in Approvals → Driver Applications.
        </p>
      </CardHeader>
      <CardContent>
        {!loading && rows.length === 0 && (
          <p className="text-sm text-muted-foreground" data-testid="incomplete-empty">No incomplete applications right now. 🎉</p>
        )}
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3" data-testid={`incomplete-row-${r.id}`}>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium truncate">{r.name || 'Unnamed applicant'}</p>
                  <Badge variant="secondary" className="capitalize text-xs">{String(r.status || 'incomplete').replace(/_/g, ' ')}</Badge>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {r.email && <span className="flex items-center gap-1 truncate"><Mail className="h-3.5 w-3.5" />{r.email}</span>}
                  {r.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{r.phone}</span>}
                  {r.city && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{r.city}</span>}
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => nudge(r)}
                disabled={nudging === r.id}
                data-testid={`incomplete-nudge-${r.id}`}
              >
                {nudging === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send reminder'}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default IncompleteApplications;
