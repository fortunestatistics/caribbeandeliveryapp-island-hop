import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Wallet, ArrowDownToLine, ArrowUpFromLine, Plus, Trash2, Loader2,
  Clock, CheckCircle2, XCircle, Building2, ArrowLeft, RefreshCw,
} from 'lucide-react';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Card, CardContent } from './components/ui/card';
import { Badge } from './components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from './components/ui/dialog';
import { useCurrency } from './CurrencyContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CREDIT_TYPES = ['deposit', 'refund', 'p2p_receive', 'driver_settlement', 'merchant_settlement', 'payout_in', 'payout_reversed', 'settlement_reversed', 'admin_adjustment', 'promoter_reward', 'tip_in'];
const isCredit = (t) => CREDIT_TYPES.includes(t);
const txnIcon = (t) => (isCredit(t)
  ? <ArrowDownToLine className="h-4 w-4 text-green-600" />
  : <ArrowUpFromLine className="h-4 w-4 text-red-500" />);

const StatusBadge = ({ status }) => {
  const map = {
    pending: { cls: 'bg-amber-500/15 text-amber-600', icon: Clock, label: 'Pending' },
    approved: { cls: 'bg-green-500/15 text-green-600', icon: CheckCircle2, label: 'Approved' },
    rejected: { cls: 'bg-red-500/15 text-red-500', icon: XCircle, label: 'Rejected' },
  };
  const m = map[status] || map.pending;
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${m.cls}`}>
      <Icon className="h-3 w-3" />{m.label}
    </span>
  );
};

const WalletPage = () => {
  const navigate = useNavigate();
  const { format, currency, rate } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState({ balances: { USD: 0 } });
  const [txns, setTxns] = useState([]);
  const [methods, setMethods] = useState([]);
  const [requests, setRequests] = useState([]);
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [methodOpen, setMethodOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [w, t, m, r] = await Promise.all([
        axios.get(`${API}/wallet`),
        axios.get(`${API}/wallet/transactions`),
        axios.get(`${API}/wallet/payment-methods`),
        axios.get(`${API}/wallet/funding-requests`),
      ]);
      setWallet(w.data || { balances: { USD: 0 } });
      setTxns(Array.isArray(t.data) ? t.data : []);
      setMethods(m.data?.payment_methods || []);
      setRequests(r.data?.requests || []);
    } catch (e) {
      toast.error('Could not load your wallet. Please sign in and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const balanceUSD = Number(wallet?.balances?.USD || 0);

  // Convert a TT$ (or US$) amount typed by the user into the USD ledger amount.
  const toUSD = (val) => {
    const n = Number(val) || 0;
    return currency === 'USD' ? n : n / rate;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-matte-900 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-gold-500/30 border-t-gold-500 rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-matte-900 py-10" data-testid="wallet-page">
      <div className="container mx-auto px-4 max-w-4xl">
        <button onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" data-testid="wallet-back-btn">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {/* Balance */}
        <Card className="border-gold-500/40 bg-gradient-to-br from-gold-500/10 to-transparent overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Wallet className="h-5 w-5 text-gold-500" />
                  <span className="text-sm font-medium">Wallet balance</span>
                </div>
                <p className="text-4xl font-bold text-foreground" data-testid="wallet-balance">{format(balanceUSD)}</p>
                <p className="text-xs text-muted-foreground mt-1">Earnings, refunds and deposits land here. {currency === 'TTD' ? '≈ ' + format(balanceUSD) : ''}</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setDepositOpen(true)} data-testid="wallet-deposit-btn" className="bg-gold-gradient text-white">
                  <ArrowDownToLine className="h-4 w-4 mr-1" /> Deposit
                </Button>
                <Button onClick={() => setWithdrawOpen(true)} variant="outline" data-testid="wallet-withdraw-btn">
                  <ArrowUpFromLine className="h-4 w-4 mr-1" /> Withdraw
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pending requests */}
        {requests.filter((r) => r.status === 'pending').length > 0 && (
          <Card className="mt-4 border-amber-500/40 bg-amber-500/5">
            <CardContent className="p-4">
              <p className="text-sm font-semibold text-foreground mb-2">Pending requests</p>
              <div className="space-y-2" data-testid="wallet-pending-requests">
                {requests.filter((r) => r.status === 'pending').map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-sm">
                    <span className="capitalize text-muted-foreground">{r.direction} · {r.method}</span>
                    <span className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{format(r.amount)}</span>
                      <StatusBadge status={r.status} />
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment methods */}
        <Card className="mt-4">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-foreground">Payout destinations</p>
              <Button size="sm" variant="outline" onClick={() => setMethodOpen(true)} data-testid="wallet-add-method-btn">
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
            {methods.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bank account or PayPal saved yet. Add one to withdraw your money.</p>
            ) : (
              <div className="space-y-2" data-testid="wallet-methods-list">
                {methods.map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-lg border border-border bg-background p-2.5">
                    <span className="flex items-center gap-2 text-sm text-foreground">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="capitalize">{m.type === 'paypal' ? 'PayPal' : 'Bank'}</span> · {m.label}
                    </span>
                    <button onClick={() => deleteMethod(m.id)} className="text-muted-foreground hover:text-red-500" data-testid={`wallet-delete-method-${m.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transactions */}
        <Card className="mt-4">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-foreground">Recent activity</p>
              <button onClick={load} className="text-muted-foreground hover:text-foreground" data-testid="wallet-refresh-btn"><RefreshCw className="h-4 w-4" /></button>
            </div>
            {txns.length === 0 ? (
              <p className="text-sm text-muted-foreground">No transactions yet.</p>
            ) : (
              <div className="divide-y divide-border" data-testid="wallet-transactions">
                {txns.map((t) => (
                  <div key={t.id} className="flex items-center justify-between py-2.5">
                    <span className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">{txnIcon(t.type)}</span>
                      <span>
                        <span className="block text-sm font-medium text-foreground capitalize">{(t.type || '').replace(/_/g, ' ')}</span>
                        <span className="block text-xs text-muted-foreground">{t.note || (t.created_at ? new Date(t.created_at).toLocaleDateString() : '')}</span>
                      </span>
                    </span>
                    <span className={`text-sm font-semibold ${isCredit(t.type) ? 'text-green-600' : 'text-red-500'}`}>
                      {isCredit(t.type) ? '+' : '−'}{format(Math.abs(Number(t.amount) || 0))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <DepositDialog open={depositOpen} onClose={() => setDepositOpen(false)} toUSD={toUSD} format={format} onDone={load} busy={busy} setBusy={setBusy} />
      <WithdrawDialog open={withdrawOpen} onClose={() => setWithdrawOpen(false)} toUSD={toUSD} format={format} methods={methods} balanceUSD={balanceUSD} onDone={load} onAddMethod={() => { setWithdrawOpen(false); setMethodOpen(true); }} busy={busy} setBusy={setBusy} />
      <AddMethodDialog open={methodOpen} onClose={() => setMethodOpen(false)} onDone={load} busy={busy} setBusy={setBusy} />
    </div>
  );

  async function deleteMethod(id) {
    try {
      await axios.delete(`${API}/wallet/payment-methods/${id}`);
      toast.success('Removed');
      load();
    } catch (e) { toast.error('Could not remove'); }
  }
};

const DepositDialog = ({ open, onClose, toUSD, format, onDone, busy, setBusy }) => {
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const usd = toUSD(amount);

  const payWithPayPal = async () => {
    if (usd <= 0) { toast.error('Enter an amount'); return; }
    setBusy(true);
    try {
      const r = await axios.post(`${API}/payments/paypal/create-order`, {
        amount: Number(usd.toFixed(2)), currency: 'USD', purpose: 'wallet_deposit', origin_url: window.location.origin,
      });
      if (r.data?.approve_url) { window.location.href = r.data.approve_url; return; }
      toast.error('Could not start PayPal checkout');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'PayPal is unavailable right now. Try a bank transfer instead.');
    } finally { setBusy(false); }
  };

  const requestBank = async () => {
    if (usd <= 0) { toast.error('Enter an amount'); return; }
    setBusy(true);
    try {
      await axios.post(`${API}/wallet/funding-request`, {
        direction: 'deposit', method: 'bank', amount: Number(usd.toFixed(2)), currency: 'USD', reference,
      });
      toast.success('Deposit request submitted. We will credit your wallet once the transfer is confirmed.');
      onClose(); onDone();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not submit request');
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="wallet-deposit-dialog">
        <DialogHeader>
          <DialogTitle>Add money to your wallet</DialogTitle>
          <DialogDescription>Pay instantly with PayPal, or send a bank transfer and we'll top you up once confirmed.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="dep-amt">Amount</Label>
            <Input id="dep-amt" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 100" data-testid="wallet-deposit-amount" />
            {usd > 0 && <p className="text-xs text-muted-foreground mt-1">You'll be charged {format(usd)}</p>}
          </div>
          <div>
            <Label htmlFor="dep-ref">Bank transfer reference (optional)</Label>
            <Input id="dep-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Transfer / proof reference" data-testid="wallet-deposit-reference" />
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={requestBank} disabled={busy} data-testid="wallet-deposit-bank-btn">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4 mr-1" />} Bank transfer
          </Button>
          <Button onClick={payWithPayPal} disabled={busy} className="bg-gold-gradient text-white" data-testid="wallet-deposit-paypal-btn">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Pay with PayPal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const WithdrawDialog = ({ open, onClose, toUSD, format, methods, balanceUSD, onDone, onAddMethod, busy, setBusy }) => {
  const [amount, setAmount] = useState('');
  const [methodId, setMethodId] = useState('');
  const usd = toUSD(amount);

  const submit = async () => {
    if (usd <= 0) { toast.error('Enter an amount'); return; }
    if (usd > balanceUSD + 0.001) { toast.error('Amount exceeds your balance'); return; }
    if (!methodId) { toast.error('Choose where to send the money'); return; }
    const m = methods.find((x) => x.id === methodId);
    setBusy(true);
    try {
      await axios.post(`${API}/wallet/funding-request`, {
        direction: 'withdraw', method: m?.type === 'paypal' ? 'paypal' : 'bank',
        amount: Number(usd.toFixed(2)), currency: 'USD', payment_method_id: methodId, destination: m?.label,
      });
      toast.success('Withdrawal requested. We will send it to your account shortly.');
      onClose(); onDone();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not submit withdrawal');
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="wallet-withdraw-dialog">
        <DialogHeader>
          <DialogTitle>Withdraw to your bank or PayPal</DialogTitle>
          <DialogDescription>Available: {format(balanceUSD)}. Withdrawals are reviewed and sent by our team.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="wd-amt">Amount</Label>
            <Input id="wd-amt" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 50" data-testid="wallet-withdraw-amount" />
            {usd > 0 && <p className="text-xs text-muted-foreground mt-1">We'll send {format(usd)}</p>}
          </div>
          <div>
            <Label>Send to</Label>
            {methods.length === 0 ? (
              <Button variant="outline" className="w-full mt-1" onClick={onAddMethod} data-testid="wallet-withdraw-add-method">
                <Plus className="h-4 w-4 mr-1" /> Add a bank account or PayPal
              </Button>
            ) : (
              <div className="space-y-2 mt-1" data-testid="wallet-withdraw-methods">
                {methods.map((m) => (
                  <button key={m.id} onClick={() => setMethodId(m.id)} data-testid={`wallet-withdraw-method-${m.id}`}
                    className={`w-full flex items-center gap-2 rounded-lg border p-2.5 text-left text-sm ${methodId === m.id ? 'border-gold-500 bg-gold-500/10' : 'border-border bg-background'}`}>
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="capitalize">{m.type === 'paypal' ? 'PayPal' : 'Bank'}</span> · {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy} className="bg-gold-gradient text-white" data-testid="wallet-withdraw-submit-btn">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Request withdrawal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const AddMethodDialog = ({ open, onClose, onDone, busy, setBusy }) => {
  const [type, setType] = useState('bank_account');
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [branch, setBranch] = useState('');
  const [paypalEmail, setPaypalEmail] = useState('');

  const submit = async () => {
    const details = type === 'paypal'
      ? { email: paypalEmail }
      : { bank_name: bankName, account_name: accountName, account_number: accountNumber, branch };
    if (type === 'paypal' && !paypalEmail) { toast.error('Enter your PayPal email'); return; }
    if (type === 'bank_account' && !accountNumber) { toast.error('Enter your account number'); return; }
    setBusy(true);
    try {
      await axios.post(`${API}/wallet/payment-methods`, { type, details });
      toast.success('Saved');
      onClose(); onDone();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not save');
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="wallet-add-method-dialog">
        <DialogHeader>
          <DialogTitle>Add a payout destination</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2 mb-2">
          <Button size="sm" variant={type === 'bank_account' ? 'default' : 'outline'} onClick={() => setType('bank_account')} data-testid="wallet-method-type-bank">Bank</Button>
          <Button size="sm" variant={type === 'paypal' ? 'default' : 'outline'} onClick={() => setType('paypal')} data-testid="wallet-method-type-paypal">PayPal</Button>
        </div>
        {type === 'paypal' ? (
          <div>
            <Label htmlFor="pp-email">PayPal email</Label>
            <Input id="pp-email" type="email" value={paypalEmail} onChange={(e) => setPaypalEmail(e.target.value)} placeholder="you@email.com" data-testid="wallet-method-paypal-email" />
          </div>
        ) : (
          <div className="space-y-2">
            <div><Label>Bank name</Label><Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. Republic Bank" data-testid="wallet-method-bank-name" /></div>
            <div><Label>Account holder name</Label><Input value={accountName} onChange={(e) => setAccountName(e.target.value)} data-testid="wallet-method-account-name" /></div>
            <div><Label>Account number</Label><Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} data-testid="wallet-method-account-number" /></div>
            <div><Label>Branch (optional)</Label><Input value={branch} onChange={(e) => setBranch(e.target.value)} data-testid="wallet-method-branch" /></div>
          </div>
        )}
        <DialogFooter>
          <Button onClick={submit} disabled={busy} className="bg-gold-gradient text-white" data-testid="wallet-method-save-btn">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WalletPage;
