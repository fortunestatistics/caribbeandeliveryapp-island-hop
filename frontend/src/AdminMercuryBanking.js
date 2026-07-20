import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { Banknote, RefreshCw, CheckCircle2, AlertTriangle, Landmark, Link2Off } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const fmtMoney = (amount, currency = 'USD') => {
  try {
    return Number(amount || 0).toLocaleString(undefined, { style: 'currency', currency });
  } catch {
    return `$${Number(amount || 0).toFixed(2)}`;
  }
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString(); } catch { return iso; }
};

const AdminMercuryBanking = () => {
  const [status, setStatus] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [recon, setRecon] = useState(null);
  const [days, setDays] = useState(30);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [loadingRecon, setLoadingRecon] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/admin/mercury/status`, { headers: authHeaders() });
      setStatus(r.data);
    } catch {
      setStatus({ configured: false, connected: false });
    }
  }, []);

  const loadAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const r = await axios.get(`${API}/admin/mercury/accounts`, { headers: authHeaders() });
      setAccounts(r.data.accounts || []);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load Mercury accounts');
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  const loadReconciliation = useCallback(async (windowDays) => {
    setLoadingRecon(true);
    try {
      const r = await axios.get(`${API}/admin/mercury/reconciliation?days=${windowDays}`, { headers: authHeaders() });
      setRecon(r.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to run reconciliation');
    } finally {
      setLoadingRecon(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    loadAccounts();
    loadReconciliation(30);
  }, [loadStatus, loadAccounts, loadReconciliation]);

  const refreshRecon = () => loadReconciliation(days);

  return (
    <div className="space-y-6" data-testid="admin-mercury-content">
      {/* Status bar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2"><Landmark className="h-5 w-5 text-gold-500" />Mercury Business Banking</span>
            {status && (
              status.connected ? (
                <Badge className="bg-green-600/20 text-green-400 border-green-600/30" data-testid="mercury-status-connected">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Connected
                </Badge>
              ) : (
                <Badge variant="destructive" data-testid="mercury-status-disconnected">
                  <Link2Off className="h-3.5 w-3.5 mr-1" />{status.configured ? 'Disconnected' : 'Not Configured'}
                </Badge>
              )
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Read-only view of your Mercury accounts and automatic reconciliation of Stripe payouts against bank deposits.
            {status?.detail && <span className="block text-yellow-500 mt-1">{status.detail}</span>}
          </p>
        </CardContent>
      </Card>

      {/* Accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2"><Banknote className="h-5 w-5 text-gold-500" />Accounts</span>
            <Button variant="outline" size="sm" onClick={loadAccounts} disabled={loadingAccounts} data-testid="mercury-refresh-accounts-btn">
              <RefreshCw className={`h-4 w-4 ${loadingAccounts ? 'animate-spin' : ''}`} />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-center text-muted-foreground py-6" data-testid="mercury-no-accounts">No accounts to display.</p>
          ) : (
            <div className="grid md:grid-cols-3 gap-4" data-testid="mercury-accounts-grid">
              {accounts.map((a) => (
                <div key={a.id} className="p-4 rounded-lg bg-matte-900/40 border border-border" data-testid={`mercury-account-${a.id}`}>
                  <p className="font-medium">{a.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{a.kind} • {a.status}</p>
                  <p className="text-2xl font-bold text-gold-500 mt-2">{fmtMoney(a.available_balance)}</p>
                  <p className="text-xs text-muted-foreground">Current: {fmtMoney(a.current_balance)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reconciliation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Stripe Payout Reconciliation</span>
            <div className="flex items-center gap-2">
              <select
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="bg-matte-900 border border-border rounded-md px-2 py-1 text-sm"
                data-testid="mercury-recon-window-select"
              >
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
              <Button variant="outline" size="sm" onClick={refreshRecon} disabled={loadingRecon} data-testid="mercury-run-recon-btn">
                <RefreshCw className={`h-4 w-4 mr-1 ${loadingRecon ? 'animate-spin' : ''}`} />Run
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recon && (
            <div className="grid grid-cols-3 gap-3 mb-4" data-testid="mercury-recon-summary">
              <div className="p-3 rounded-lg bg-matte-900/40 text-center">
                <p className="text-2xl font-bold">{recon.summary.total_payouts}</p>
                <p className="text-xs text-muted-foreground">Stripe Payouts</p>
              </div>
              <div className="p-3 rounded-lg bg-green-600/10 text-center">
                <p className="text-2xl font-bold text-green-400">{recon.summary.matched}</p>
                <p className="text-xs text-muted-foreground">Matched</p>
              </div>
              <div className="p-3 rounded-lg bg-yellow-600/10 text-center">
                <p className="text-2xl font-bold text-yellow-400">{recon.summary.unmatched}</p>
                <p className="text-xs text-muted-foreground">Unmatched</p>
              </div>
            </div>
          )}

          {!recon || recon.reconciliation.length === 0 ? (
            <p className="text-center text-muted-foreground py-8" data-testid="mercury-no-payouts">
              No Stripe payouts found in this window.
            </p>
          ) : (
            <div className="space-y-2" data-testid="mercury-recon-list">
              {recon.reconciliation.map((r) => (
                <div key={r.payout_id} className="flex items-center justify-between p-3 rounded-lg bg-matte-900/40 border border-border" data-testid={`mercury-recon-row-${r.payout_id}`}>
                  <div>
                    <p className="font-medium">{fmtMoney(r.amount, r.currency)}</p>
                    <p className="text-xs text-muted-foreground">Arrived {fmtDate(r.arrival_date)} • {r.status}</p>
                  </div>
                  {r.reconciled ? (
                    <Badge className="bg-green-600/20 text-green-400 border-green-600/30">
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Matched
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <AlertTriangle className="h-3.5 w-3.5 mr-1" />Unmatched
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminMercuryBanking;
