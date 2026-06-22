import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Badge } from './components/ui/badge';
import { Landmark, Wallet, Plus, Trash2, ArrowDownToLine, ArrowUpFromLine, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const STATUS_STYLE = {
  pending: 'bg-amber-500/15 text-amber-500',
  approved: 'bg-green-500/15 text-green-500',
  rejected: 'bg-rose-500/15 text-rose-500',
};

export const WalletFunding = ({ currencies = ['USD', 'TTD'], onChanged }) => {
  const [methods, setMethods] = useState([]);
  const [reqs, setReqs] = useState([]);
  const [tab, setTab] = useState('deposit'); // 'deposit' | 'withdraw'
  const [form, setForm] = useState({ method: 'bank', amount: '', currency: currencies[0] || 'USD', reference: '', destination: '' });
  const [pm, setPm] = useState({ type: 'bank_account', email: '', bank_name: '', account_name: '', account_number: '', branch: '' });
  const [busy, setBusy] = useState(false);
  const [showAddPm, setShowAddPm] = useState(false);

  const load = useCallback(async () => {
    try {
      const [m, r] = await Promise.all([
        axios.get(`${API}/wallet/payment-methods`, { headers: authHeaders() }),
        axios.get(`${API}/wallet/funding-requests`, { headers: authHeaders() }),
      ]);
      setMethods(m.data.payment_methods || []);
      setReqs(r.data.requests || []);
    } catch (e) { console.error('Failed to load wallet funding data:', e); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addMethod = async () => {
    const details = pm.type === 'paypal'
      ? { email: pm.email }
      : { bank_name: pm.bank_name, account_name: pm.account_name, account_number: pm.account_number, branch: pm.branch };
    setBusy(true);
    try {
      await axios.post(`${API}/wallet/payment-methods`, { type: pm.type, details }, { headers: authHeaders() });
      toast.success('Payment method added');
      setShowAddPm(false);
      setPm({ type: 'bank_account', email: '', bank_name: '', account_name: '', account_number: '', branch: '' });
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed to add'); } finally { setBusy(false); }
  };

  const removeMethod = async (id) => {
    try { await axios.delete(`${API}/wallet/payment-methods/${id}`, { headers: authHeaders() }); load(); }
    catch (e) { toast.error('Failed to remove'); }
  };

  const submitRequest = async () => {
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return; }
    // PayPal deposits go through real PayPal Checkout (not manual review).
    if (tab === 'deposit' && form.method === 'paypal') {
      setBusy(true);
      try {
        const res = await axios.post(`${API}/payments/paypal/create-order`, {
          amount, currency: form.currency, purpose: 'wallet_deposit', origin_url: window.location.origin,
        }, { headers: authHeaders() });
        if (res.data.approve_url) {
          window.location.href = res.data.approve_url;
          return;
        }
        toast.error('Could not start PayPal checkout');
      } catch (e) { toast.error(e?.response?.data?.detail || 'PayPal checkout failed'); }
      finally { setBusy(false); }
      return;
    }
    setBusy(true);
    try {
      const res = await axios.post(`${API}/wallet/funding-request`, {
        direction: tab, method: form.method, amount, currency: form.currency,
        reference: tab === 'deposit' ? form.reference : undefined,
        destination: tab === 'withdraw' ? form.destination : undefined,
      }, { headers: authHeaders() });
      toast.success(res.data.message || 'Request submitted');
      setForm({ ...form, amount: '', reference: '', destination: '' });
      load(); onChanged && onChanged();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Request failed'); } finally { setBusy(false); }
  };

  return (
    <Card className="mb-6" data-testid="wallet-funding-section">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Landmark className="h-5 w-5 text-gold-500" /> Add &amp; Withdraw Funds
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Deposit / Withdraw toggle */}
        <div className="flex gap-2">
          <Button size="sm" variant={tab === 'deposit' ? 'default' : 'outline'} onClick={() => setTab('deposit')} data-testid="funding-tab-deposit">
            <ArrowDownToLine className="h-4 w-4 mr-1" /> Deposit
          </Button>
          <Button size="sm" variant={tab === 'withdraw' ? 'default' : 'outline'} onClick={() => setTab('withdraw')} data-testid="funding-tab-withdraw">
            <ArrowUpFromLine className="h-4 w-4 mr-1" /> Withdraw
          </Button>
        </div>

        {/* Request form */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase">Method</label>
            <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}
              className="w-full mt-1 bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground" data-testid="funding-method-select">
              <option value="bank">Bank transfer</option>
              <option value="paypal">PayPal</option>
              <option value="wipay">WiPay (Trinidad)</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase">Currency</label>
            <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}
              className="w-full mt-1 bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground" data-testid="funding-currency-select">
              {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase">Amount</label>
            <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0.00" className="mt-1" data-testid="funding-amount-input" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase">
              {tab === 'deposit' ? 'Transfer reference (optional)' : 'Send to (PayPal email / account)'}
            </label>
            <Input value={tab === 'deposit' ? form.reference : form.destination}
              onChange={(e) => setForm({ ...form, [tab === 'deposit' ? 'reference' : 'destination']: e.target.value })}
              placeholder={tab === 'deposit' ? 'e.g. bank transfer ref' : 'e.g. you@paypal.com'} className="mt-1" data-testid="funding-detail-input" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {tab === 'deposit'
            ? (form.method === 'paypal'
                ? "You'll be redirected to PayPal to pay securely. Your wallet is credited instantly once payment completes."
                : 'Submit your deposit and our team verifies it before crediting your wallet.')
            : 'Withdrawals are reviewed by our team and paid out to your bank/PayPal.'}
        </p>
        <Button onClick={submitRequest} disabled={busy} data-testid="funding-submit-btn">
          {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {tab === 'deposit'
            ? (form.method === 'paypal' ? 'Continue to PayPal' : 'Submit deposit')
            : 'Request withdrawal'}
        </Button>

        {/* Saved payment methods */}
        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2"><Wallet className="h-4 w-4" /> Saved payment methods</p>
            <Button size="sm" variant="outline" onClick={() => setShowAddPm((v) => !v)} data-testid="add-payment-method-btn">
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
          {methods.length === 0 && <p className="text-xs text-muted-foreground">No saved methods yet.</p>}
          {methods.map((m) => (
            <div key={m.id} className="flex items-center justify-between py-2 border-b border-border/50" data-testid={`payment-method-${m.id}`}>
              <span className="text-sm text-foreground">{m.type === 'paypal' ? '🅿️ ' : '🏦 '}{m.label}</span>
              <button onClick={() => removeMethod(m.id)} className="text-rose-500 hover:text-rose-400" data-testid={`remove-method-${m.id}`}><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          {showAddPm && (
            <div className="mt-3 space-y-2 bg-matte-900/40 p-3 rounded-lg">
              <select value={pm.type} onChange={(e) => setPm({ ...pm, type: e.target.value })}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground" data-testid="pm-type-select">
                <option value="bank_account">Bank account</option>
                <option value="paypal">PayPal</option>
              </select>
              {pm.type === 'paypal' ? (
                <Input placeholder="PayPal email" value={pm.email} onChange={(e) => setPm({ ...pm, email: e.target.value })} data-testid="pm-paypal-email" />
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Bank name" value={pm.bank_name} onChange={(e) => setPm({ ...pm, bank_name: e.target.value })} data-testid="pm-bank-name" />
                  <Input placeholder="Account name" value={pm.account_name} onChange={(e) => setPm({ ...pm, account_name: e.target.value })} />
                  <Input placeholder="Account number" value={pm.account_number} onChange={(e) => setPm({ ...pm, account_number: e.target.value })} data-testid="pm-account-number" />
                  <Input placeholder="Branch" value={pm.branch} onChange={(e) => setPm({ ...pm, branch: e.target.value })} />
                </div>
              )}
              <Button size="sm" onClick={addMethod} disabled={busy} data-testid="pm-save-btn">Save method</Button>
            </div>
          )}
        </div>

        {/* My funding requests */}
        {reqs.length > 0 && (
          <div className="border-t border-border pt-4">
            <p className="text-sm font-semibold text-foreground mb-2">Recent requests</p>
            <div className="space-y-2">
              {reqs.slice(0, 6).map((r) => (
                <div key={r.id} className="flex items-center justify-between text-sm" data-testid={`funding-request-${r.id}`}>
                  <span className="text-foreground/90">
                    {r.direction === 'deposit' ? '+' : '−'}{r.amount} {r.currency} · {r.method}
                  </span>
                  <Badge className={`text-[10px] ${STATUS_STYLE[r.status] || ''}`}>{r.status}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WalletFunding;
