import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { Megaphone, ShieldCheck, ShieldOff, Clock, Wallet, CheckCircle2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const ENTITY_LABEL = {
  customer: 'Customer', driver: 'Driver',
  merchant: 'Business/Merchant', supplier: 'Supplier',
};

const REWARD_STATUS = {
  pending_first_order: { label: 'Pending First Order', className: 'bg-amber-500/15 text-amber-700 border-amber-500/30', icon: Clock },
  held: { label: 'Ready for Payout', className: 'bg-blue-500/15 text-blue-700 border-blue-500/30', icon: Wallet },
  paid: { label: 'Paid', className: 'bg-green-500/15 text-green-700 border-green-500/30', icon: CheckCircle2 },
};

const fmtDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
};

const AdminPromoters = () => {
  const [promoters, setPromoters] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [counts, setCounts] = useState({});
  const [currency, setCurrency] = useState('USD');
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [pRes, rRes] = await Promise.all([
        axios.get(`${API}/admin/promoters`, { headers: authHeaders() }),
        axios.get(`${API}/admin/promo-rewards`, { headers: authHeaders() }),
      ]);
      setPromoters(pRes.data.promoters || []);
      setRewards(rRes.data.rewards || []);
      setCounts(rRes.data.counts || {});
      setCurrency(rRes.data.currency || 'USD');
    } catch (err) {
      console.error('Failed to load promoters:', err);
      toast.error('Failed to load promoter data');
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const toggleAmbassador = async (p) => {
    const path = p.is_promoter ? 'revoke' : 'approve';
    try {
      const res = await axios.post(`${API}/admin/promoters/${path}`, { user_id: p.id }, { headers: authHeaders() });
      toast.success(p.is_promoter ? 'Ambassador revoked' : `Ambassador approved${res.data?.released_rewards ? ` · ${res.data.released_rewards} held reward(s) paid out` : ''}`);
      fetchAll();
    } catch (err) {
      console.error('Toggle ambassador failed:', err);
      toast.error('Action failed');
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-muted-foreground">Loading promoters…</div>;
  }

  const summaryCards = [
    { key: 'pending_first_order', label: 'Pending First Order', icon: Clock, color: 'text-amber-600' },
    { key: 'held', label: 'Ready for Payout', icon: Wallet, color: 'text-blue-600' },
    { key: 'paid', label: 'Paid Out', icon: CheckCircle2, color: 'text-green-600' },
  ];

  return (
    <div className="space-y-6" data-testid="admin-promoters">
      {/* Reward-state summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {summaryCards.map(({ key, label, icon: Icon, color }) => (
          <Card key={key} data-testid={`promo-summary-${key}`}>
            <CardContent className="flex items-center gap-3 py-4">
              <Icon className={`h-6 w-6 ${color}`} />
              <div>
                <div className="text-2xl font-bold">{counts[key] ?? 0}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Referral rewards ledger */}
      <Card data-testid="admin-referral-rewards">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-gold-500" /> Referral Rewards
          </CardTitle>
          <Button size="sm" variant="outline" onClick={fetchAll} data-testid="promo-rewards-refresh">
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Driver, Business/Merchant &amp; Supplier rewards are held in escrow until the referred entity completes their first order.
          </p>
          {rewards.length === 0 ? (
            <p className="text-center text-muted-foreground py-10" data-testid="no-rewards">No referral rewards yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-2 pr-3">Referred By (Promoter)</th>
                    <th className="py-2 pr-3">Referred Entity</th>
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">Signed Up</th>
                    <th className="py-2 pr-3">First Order</th>
                    <th className="py-2 pr-3">Reward</th>
                    <th className="py-2 pr-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rewards.map((r) => {
                    const st = REWARD_STATUS[r.status] || { label: r.status, className: 'text-muted-foreground', icon: Clock };
                    const StIcon = st.icon;
                    return (
                      <tr key={r.id} className="border-b border-border/60" data-testid={`reward-row-${r.id}`}>
                        <td className="py-2 pr-3">
                          <div className="font-medium text-foreground">{r.promoter_name || '—'}</div>
                          <div className="text-xs text-muted-foreground">{r.promoter_email}</div>
                        </td>
                        <td className="py-2 pr-3">{r.referred_name || '—'}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{ENTITY_LABEL[r.referred_entity_type] || r.referred_entity_type}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{fmtDate(r.signup_date)}</td>
                        <td className="py-2 pr-3 text-muted-foreground" data-testid={`reward-first-order-${r.id}`}>{fmtDate(r.first_order_at)}</td>
                        <td className="py-2 pr-3 font-semibold">{currency} {Number(r.amount || 0).toFixed(2)}</td>
                        <td className="py-2 pr-3">
                          <Badge className={st.className} data-testid={`reward-status-${r.id}`}>
                            <StIcon className="h-3 w-3 mr-1" />{st.label}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Promoters / ambassadors */}
      <Card data-testid="admin-promoters-list">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-gold-500" /> Promoters &amp; Ambassadors
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
    </div>
  );
};

export default AdminPromoters;
