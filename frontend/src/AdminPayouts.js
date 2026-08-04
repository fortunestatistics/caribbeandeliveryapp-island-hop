import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Badge } from './components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './components/ui/select';
import { Banknote, RefreshCw, ChevronDown, Wrench, AlertTriangle, CreditCard, Building2, Car, FileDown, BellRing } from 'lucide-react';
import AdminPayoutsPanel from './AdminPayoutsPanel';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const cfg = () => {
  const token = localStorage.getItem('token');
  return { withCredentials: true, headers: token ? { Authorization: `Bearer ${token}` } : {} };
};

const STATUS_STYLES = {
  queued: 'bg-amber-100 text-amber-700',
  paid: 'bg-green-100 text-green-700',
  reversed: 'bg-red-100 text-red-700',
  none: 'bg-muted text-foreground',
};
const usd = (n) => `$${Number(n || 0).toFixed(2)}`;

export default function AdminPayouts() {
  const navigate = useNavigate();
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [partyType, setPartyType] = useState('all');
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [purgeText, setPurgeText] = useState('');
  const [busy, setBusy] = useState(false);
  const [cashAlerts, setCashAlerts] = useState([]);

  const fetchPayouts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ party_type: partyType, status, q });
      const r = await axios.get(`${API}/admin/payouts?${params.toString()}`, cfg());
      setPayouts(r.data?.payouts || []);
    } catch (e) { setPayouts([]); }
    finally { setLoading(false); }
  }, [partyType, status, q]);

  const fetchCashAlerts = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/admin/alerts/driver-cash`, cfg());
      setCashAlerts(r.data?.alerts || []);
    } catch (e) { setCashAlerts([]); }
  }, []);

  useEffect(() => { fetchPayouts(); }, [fetchPayouts]);
  useEffect(() => { fetchCashAlerts(); }, [fetchCashAlerts]);

  const downloadStatement = (p) => {
    const token = localStorage.getItem('token');
    const url = `${API}/admin/statements?user_id=${encodeURIComponent(p.user_id)}&party_type=${p.party_type}`;
    // trigger an authenticated download via fetch + blob (same-origin cookie also works)
    fetch(url, { credentials: 'include', headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(res => res.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `statement-${(p.party_name || p.user_id).replace(/\s+/g, '_')}.csv`;
        document.body.appendChild(a); a.click(); a.remove();
      })
      .catch(() => alert('Could not download statement'));
  };

  const markPaid = async (p) => {
    const method = window.prompt('Payment method used (stripe / paypal / bank / cash):', 'bank');
    if (method === null) return;
    const reference = window.prompt('Reference / transaction ID (optional):', '') || '';
    setBusy(true);
    try {
      await axios.post(`${API}/admin/payouts/${p.id}/mark-paid`, { method, reference }, cfg());
      await fetchPayouts();
    } catch (e) { alert(e.response?.data?.detail || 'Failed'); }
    finally { setBusy(false); }
  };

  const reverse = async (p) => {
    const reason = window.prompt('Reason for reversing this payout? (orders will re-open for settlement)');
    if (!reason) return;
    setBusy(true);
    try {
      await axios.post(`${API}/admin/payouts/${p.id}/reverse`, { reason }, cfg());
      await fetchPayouts();
    } catch (e) { alert(e.response?.data?.detail || 'Failed'); }
    finally { setBusy(false); }
  };

  const adjust = async (p) => {
    const direction = window.prompt('Adjustment type — type "credit" to add or "debit" to remove:', 'credit');
    if (!direction) return;
    const amountStr = window.prompt('Amount (USD):', '0');
    const amount = parseFloat(amountStr);
    if (!amount || amount <= 0) return;
    const reason = window.prompt('Reason for this adjustment:') || '';
    setBusy(true);
    try {
      await axios.post(`${API}/admin/payouts/adjust`, { user_id: p.user_id, amount, direction, currency: p.currency || 'USD', reason }, cfg());
      alert(`Wallet ${direction} of ${usd(amount)} applied.`);
      await fetchPayouts();
    } catch (e) { alert(e.response?.data?.detail || 'Failed'); }
    finally { setBusy(false); }
  };

  const purge = async () => {
    if (purgeText !== 'PURGE') { alert('Type PURGE to confirm.'); return; }
    if (!window.confirm('This permanently deletes ALL orders, settlements, payouts, claims and wallet transactions, and resets all wallet balances & driver cash to zero. Accounts, merchants, drivers, products and addresses are kept. Continue?')) return;
    setBusy(true);
    try {
      const r = await axios.post(`${API}/admin/purge-test-data`, { confirm: 'PURGE' }, cfg());
      const d = r.data?.deleted || {};
      alert(`Test data purged. Orders: ${d.orders || 0}, Settlements: ${d.settlements || 0}, Claims: ${d.claims || 0}. Wallets reset. You're ready for live orders.`);
      setPurgeText('');
      await fetchPayouts();
    } catch (e) { alert(e.response?.data?.detail || 'Failed'); }
    finally { setBusy(false); }
  };

  const TypeIcon = ({ t }) => t === 'merchant' ? <Building2 className="h-4 w-4" /> : t === 'driver' ? <Car className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />;

  return (
    <div className="space-y-6" data-testid="admin-payouts-panel">
      {/* Low-balance / cash-owed alerts */}
      {cashAlerts.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/50" data-testid="driver-cash-alerts">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700 text-base">
              <BellRing className="h-5 w-5" />Drivers owing large cash balances ({cashAlerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">These drivers have collected COD cash they still owe the platform. They cannot be paid out until it's settled (Orders tab). Chase remittance before it grows.</p>
            <div className="border rounded-lg divide-y bg-background">
              {cashAlerts.map((a) => (
                <div key={a.driver_id} className="flex items-center justify-between p-3 text-sm" data-testid={`cash-alert-${a.driver_id}`}>
                  <div>
                    <p className="font-medium">{a.name || a.email || a.driver_id}</p>
                    <p className="text-xs text-muted-foreground">{a.email || ''}{a.phone ? ` · ${a.phone}` : ''}</p>
                  </div>
                  <span className="font-semibold text-red-600">owes {usd(a.cash_outstanding)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Banknote className="h-5 w-5 text-gold-600" />Payout Management — Drivers & Merchants</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <Select value={partyType} onValueChange={setPartyType}>
              <SelectTrigger className="w-44" data-testid="payout-party-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All parties</SelectItem>
                <SelectItem value="merchant">Merchants</SelectItem>
                <SelectItem value="driver">Drivers</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-44" data-testid="payout-status-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="queued">Queued (to pay)</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="reversed">Reversed</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Search name or email…" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" data-testid="payout-search" />
            <Button variant="outline" onClick={fetchPayouts} data-testid="payout-refresh"><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
            <Button variant="outline" onClick={() => navigate('/admin?tab=approvals')} data-testid="payout-repair-link"><Wrench className="h-4 w-4 mr-2" />Account Repair</Button>
          </div>

          {loading ? (
            <p className="text-muted-foreground text-sm" data-testid="payout-loading">Loading payouts…</p>
          ) : payouts.length === 0 ? (
            <p className="text-muted-foreground text-sm" data-testid="payout-empty">No payouts match these filters. Run a settlement (Orders tab) to generate payouts.</p>
          ) : (
            <div className="border rounded-lg divide-y" data-testid="payout-list">
              {payouts.map((p) => (
                <div key={p.id} data-testid={`payout-row-${p.id}`}>
                  <div className="flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0 flex items-center gap-3">
                      <span className="text-muted-foreground"><TypeIcon t={p.party_type} /></span>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{p.party_name || p.party_email || p.user_id}</p>
                        <p className="text-xs text-muted-foreground">{p.party_type} · {p.order_count || 0} orders · {new Date(p.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-semibold text-gold-700">{usd(p.amount)}</span>
                      <Badge className={`${STATUS_STYLES[p.external_payout_status] || ''} border-0`}>{p.external_payout_status || 'none'}</Badge>
                      <Button size="sm" variant="ghost" onClick={() => setExpanded(expanded === p.id ? null : p.id)} data-testid={`payout-expand-${p.id}`}>
                        <ChevronDown className={`h-4 w-4 transition-transform ${expanded === p.id ? 'rotate-180' : ''}`} />
                      </Button>
                    </div>
                  </div>
                  {expanded === p.id && (
                    <div className="px-3 pb-3 bg-muted/30 text-sm" data-testid={`payout-detail-${p.id}`}>
                      <div className="grid sm:grid-cols-2 gap-3 pt-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Email</p>
                          <p>{p.party_email || '—'}</p>
                          <p className="text-xs text-muted-foreground mt-2">Wallet balance</p>
                          <p>US{usd(p.wallet_balance_usd)} · TT${Number(p.wallet_balance_ttd || 0).toFixed(2)}</p>
                          {p.party_type === 'driver' && p.remaining_cash_owed > 0 && (
                            <p className="text-xs text-red-600 mt-1">Still owes platform (cash): {usd(p.remaining_cash_owed)}</p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Bank / PayPal</p>
                          {p.paypal_email && <p>PayPal: {p.paypal_email}</p>}
                          {p.banking_info && (p.banking_info.bank_name || p.banking_info.account_number) ? (
                            <p>{p.banking_info.bank_name || 'Bank'} ····{String(p.banking_info.account_number || '').slice(-4)}<br />{p.banking_info.account_name || ''}</p>
                          ) : (!p.paypal_email && <p className="text-amber-600">No payout details on file</p>)}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {p.external_payout_status === 'queued' && p.party_type === 'driver' && p.remaining_cash_owed > 0 ? (
                          <span className="text-xs text-red-600 font-medium" data-testid={`payout-blocked-${p.id}`}>
                            Owes platform {usd(p.remaining_cash_owed)} — settle cash before payout
                          </span>
                        ) : p.external_payout_status === 'queued' && (
                          <Button size="sm" className="bg-gold-gradient text-white" disabled={busy} onClick={() => markPaid(p)} data-testid={`payout-pay-${p.id}`}>Pay now</Button>
                        )}
                        {p.external_payout_status !== 'reversed' && (
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => reverse(p)} data-testid={`payout-reverse-${p.id}`}>Reverse</Button>
                        )}
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => adjust(p)} data-testid={`payout-adjust-${p.id}`}>Adjust wallet</Button>
                        <Button size="sm" variant="outline" onClick={() => downloadStatement(p)} data-testid={`payout-statement-${p.id}`}><FileDown className="h-4 w-4 mr-1" />Statement</Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grouped payouts & payments (PayPal · bank batch · route readiness) — moved here from Approvals */}
      <AdminPayoutsPanel />

      {/* Danger zone: go-live purge */}
      <Card className="border-red-300">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600"><AlertTriangle className="h-5 w-5" />Go-Live: Purge Test Data</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Wipes ALL orders, settlements, payouts, claims and wallet transactions, and resets every wallet balance and driver cash counter to zero — giving you a clean slate for real orders. Your user accounts, merchants, drivers, products and saved addresses are kept.
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            <Input placeholder='Type PURGE to confirm' value={purgeText} onChange={(e) => setPurgeText(e.target.value)} className="w-56" data-testid="purge-confirm-input" />
            <Button variant="destructive" disabled={busy || purgeText !== 'PURGE'} onClick={purge} data-testid="purge-test-data-btn">Purge test data</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
