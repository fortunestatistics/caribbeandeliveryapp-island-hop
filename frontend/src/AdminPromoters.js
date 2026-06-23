import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { Megaphone, ShieldCheck, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const AdminPromoters = () => {
  const [promoters, setPromoters] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPromoters = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/promoters`, { headers: authHeaders() });
      setPromoters(res.data.promoters || []);
    } catch (err) {
      console.error('Failed to load promoters:', err);
      toast.error('Failed to load promoters');
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchPromoters(); }, [fetchPromoters]);

  const toggleAmbassador = async (p) => {
    const path = p.is_promoter ? 'revoke' : 'approve';
    try {
      const res = await axios.post(`${API}/admin/promoters/${path}`, { user_id: p.id }, { headers: authHeaders() });
      toast.success(p.is_promoter ? 'Ambassador revoked' : `Ambassador approved${res.data?.released_rewards ? ` · ${res.data.released_rewards} held reward(s) paid out` : ''}`);
      fetchPromoters();
    } catch (err) {
      console.error('Toggle ambassador failed:', err);
      toast.error('Action failed');
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-muted-foreground">Loading promoters…</div>;
  }

  return (
    <Card data-testid="admin-promoters">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-gold-500" /> Promoters &amp; Ambassadors
        </CardTitle>
      </CardHeader>
      <CardContent>
        {promoters.length === 0 ? (
          <p className="text-center text-muted-foreground py-10" data-testid="no-promoters">No promoter activity yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Onboards</th>
                  <th className="py-2 pr-3">Paid</th>
                  <th className="py-2 pr-3">Held</th>
                  <th className="py-2 pr-3">Ambassador</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {promoters.map((p) => (
                  <tr key={p.id} className="border-b border-border/60" data-testid={`promoter-row-${p.id}`}>
                    <td className="py-2 pr-3">
                      <div className="font-medium text-foreground">{p.name || '—'}</div>
                      <div className="text-xs text-muted-foreground">{p.email}</div>
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{p.user_type}</td>
                    <td className="py-2 pr-3">{p.onboards}</td>
                    <td className="py-2 pr-3 font-semibold text-green-600">{p.paid}</td>
                    <td className="py-2 pr-3 font-semibold text-gold-700">{p.held}</td>
                    <td className="py-2 pr-3">
                      {p.is_promoter
                        ? <Badge className="bg-green-500/15 text-green-700 border-green-500/30">Approved</Badge>
                        : <Badge variant="outline" className="text-muted-foreground">No</Badge>}
                    </td>
                    <td className="py-2 pr-3">
                      <Button
                        size="sm"
                        variant={p.is_promoter ? 'outline' : 'default'}
                        onClick={() => toggleAmbassador(p)}
                        data-testid={`toggle-ambassador-${p.id}`}
                      >
                        {p.is_promoter ? <><ShieldOff className="h-4 w-4 mr-1" />Revoke</> : <><ShieldCheck className="h-4 w-4 mr-1" />Approve</>}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminPromoters;
