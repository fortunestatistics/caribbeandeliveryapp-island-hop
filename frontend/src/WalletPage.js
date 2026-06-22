import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import WalletFunding from './WalletFunding';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Badge } from './components/ui/badge';
import {
  Wallet as WalletIcon, ArrowDownToLine, ArrowUpFromLine, Send, Link2, Link2Off,
  Loader2, AlertCircle, CheckCircle2, History, X, HandCoins, Check, Ban,
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const authHeaders = () => {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
};

const CURRENCY_LABELS = {
  USD: 'US Dollar', JMD: 'Jamaican Dollar', TTD: 'Trinidad & Tobago Dollar',
  BBD: 'Barbadian Dollar', GHS: 'Ghanaian Cedi', NGN: 'Nigerian Naira', ZAR: 'South African Rand',
};

const TXN_TYPE_LABEL = {
  deposit: 'Deposit from CariPay', withdraw: 'Withdraw to CariPay',
  p2p_send: 'Sent to user', p2p_receive: 'Received from user',
  order_payment: 'Paid order', refund: 'Refund', tip_in: 'Tip received', payout_in: 'Payout received',
};

const TXN_SIGN = { deposit: '+', withdraw: '−', p2p_send: '−', p2p_receive: '+',
  order_payment: '−', refund: '+', tip_in: '+', payout_in: '+' };

const TXN_COLOR = { deposit: 'text-green-700', withdraw: 'text-rose-700',
  p2p_send: 'text-rose-700', p2p_receive: 'text-green-700',
  order_payment: 'text-rose-700', refund: 'text-green-700', tip_in: 'text-green-700', payout_in: 'text-green-700' };

const formatAmt = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const Modal = ({ open, onClose, title, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-lg w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground/70 hover:text-foreground/90">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};

const WalletPage = () => {
  const [wallet, setWallet] = useState(null);
  const [txns, setTxns] = useState([]);
  const [requests, setRequests] = useState({ incoming: [], outgoing: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeModal, setActiveModal] = useState(null); // 'deposit' | 'withdraw' | 'send' | 'link' | 'request'
  const [busy, setBusy] = useState(false);

  // Form state
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [note, setNote] = useState('');
  const [linkHandle, setLinkHandle] = useState('');
  const [linkCountry, setLinkCountry] = useState('JM');

  const refresh = useCallback(async () => {
    try {
      const [w, t, r] = await Promise.all([
        axios.get(`${API}/wallet`, { headers: authHeaders() }),
        axios.get(`${API}/wallet/transactions`, { headers: authHeaders() }),
        axios.get(`${API}/wallet/requests`, { headers: authHeaders() }),
      ]);
      setWallet(w.data);
      setTxns(t.data);
      setRequests(r.data);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to load wallet');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const closeModal = () => {
    setActiveModal(null);
    setAmount(''); setRecipientEmail(''); setNote(''); setLinkHandle('');
    setError(''); setSuccess('');
  };

  const flash = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 4000); };

  const submitLink = async () => {
    if (!linkHandle.trim()) { setError('Enter your CariPay handle'); return; }
    setBusy(true); setError('');
    try {
      await axios.post(`${API}/wallet/link`, { handle: linkHandle.trim(), country: linkCountry }, { headers: authHeaders() });
      flash('CariPay linked!');
      closeModal();
      await refresh();
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to link');
    } finally { setBusy(false); }
  };

  const unlink = async () => {
    if (!window.confirm('Unlink CariPay from this wallet?')) return;
    try {
      await axios.delete(`${API}/wallet/link`, { headers: authHeaders() });
      flash('CariPay unlinked');
      await refresh();
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to unlink');
    }
  };

  const submitTransfer = async (path) => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError('Enter a valid amount'); return; }
    setBusy(true); setError('');
    try {
      const body = path === 'send'
        ? { recipient_email: recipientEmail.trim(), amount: amt, currency, note: note || null }
        : { amount: amt, currency, note: note || null };
      const res = await axios.post(`${API}/wallet/${path}`, body, { headers: authHeaders() });
      flash(res.data?.transaction ? `${path.charAt(0).toUpperCase() + path.slice(1)} successful` : 'Done');
      closeModal();
      await refresh();
    } catch (e) {
      setError(e?.response?.data?.detail || `Failed to ${path}`);
    } finally { setBusy(false); }
  };

  const submitRequest = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError('Enter a valid amount'); return; }
    if (!recipientEmail.trim()) { setError('Enter the payer\'s email'); return; }
    setBusy(true); setError('');
    try {
      await axios.post(`${API}/wallet/requests`,
        { payer_email: recipientEmail.trim(), amount: amt, currency, note: note || null },
        { headers: authHeaders() });
      flash('Request sent!');
      closeModal();
      await refresh();
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to send request');
    } finally { setBusy(false); }
  };

  const resolveRequest = async (id, action) => {
    setBusy(true); setError('');
    try {
      if (action === 'cancel') {
        await axios.delete(`${API}/wallet/requests/${id}`, { headers: authHeaders() });
      } else {
        await axios.post(`${API}/wallet/requests/${id}/${action}`, {}, { headers: authHeaders() });
      }
      const flashByAction = { approve: 'Request paid', decline: 'Request declined' };
      flash(flashByAction[action] || 'Request cancelled');
      await refresh();
    } catch (e) {
      setError(e?.response?.data?.detail || `Failed to ${action}`);
    } finally { setBusy(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold-500" />
      </div>
    );
  }

  const linked = Boolean(wallet?.caripay_handle);
  const balances = wallet?.balances || {};
  // Trinidad launch market — TTD shown first, then USD, then any other currencies
  const baseCurrencies = ['TTD', 'USD'];
  const extras = Object.keys(balances).filter((c) => !baseCurrencies.includes(c));
  const currencies = [...baseCurrencies, ...extras];

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <WalletIcon className="h-7 w-7 text-gold-500" />
          <h1 className="text-3xl font-bold">Wallet</h1>
        </div>
        <p className="text-muted-foreground mb-8">Hold balance, pay for orders, send money to other users, and move funds with CariPay.</p>

        {success && (
          <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-3 text-sm" data-testid="wallet-success">
            <CheckCircle2 className="h-4 w-4" /> {success}
          </div>
        )}
        {error && (
          <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm" data-testid="wallet-error">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        )}

        {/* Balances */}
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          {currencies.map((c, i) => (
            <Card key={c} className={i === 0 ? 'bg-gold-gradient text-matte-900 border-0 shadow-gold-glow' : ''}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-medium ${i === 0 ? 'text-matte-900/80' : 'text-muted-foreground'}`}>{CURRENCY_LABELS[c] || c}</span>
                  <span className={`text-xs font-mono ${i === 0 ? 'text-matte-900/80' : 'text-muted-foreground/70'}`}>{c}</span>
                </div>
                <div className={`text-3xl font-bold ${i === 0 ? 'text-matte-900' : 'text-foreground'}`} data-testid={`wallet-balance-${c}`}>
                  ${formatAmt(balances[c])}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* CariPay link card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-base">
                {linked ? <Link2 className="h-5 w-5 text-green-600" /> : <Link2Off className="h-5 w-5 text-muted-foreground/70" />}
                CariPay
              </span>
              {linked ? (
                <Badge className="bg-green-100 text-green-800" data-testid="caripay-status-linked">Linked</Badge>
              ) : (
                <Badge className="bg-matte-800 text-foreground/90" data-testid="caripay-status-unlinked">Not linked</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {linked ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Linked account</p>
                  <p className="font-mono" data-testid="caripay-handle">{wallet.caripay_handle}</p>
                  <p className="text-xs text-muted-foreground mt-1">Country: {wallet.caripay_country || '—'}</p>
                </div>
                <Button variant="outline" onClick={unlink} data-testid="caripay-unlink-btn">Unlink</Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Link your CariPay account to deposit and withdraw funds.</p>
                <Button onClick={() => setActiveModal('link')} className="bg-gold-gradient hover:bg-gold-gradient-hover text-white" data-testid="caripay-link-btn">
                  Link CariPay
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <Button
            variant="outline"
            disabled={!linked}
            onClick={() => setActiveModal('deposit')}
            className="h-auto py-4 flex-col gap-2"
            data-testid="wallet-deposit-btn"
          >
            <ArrowDownToLine className="h-6 w-6 text-green-600" />
            <span className="text-sm font-semibold">Deposit</span>
            <span className="text-xs text-muted-foreground">From CariPay</span>
          </Button>
          <Button
            variant="outline"
            disabled={!linked}
            onClick={() => setActiveModal('withdraw')}
            className="h-auto py-4 flex-col gap-2"
            data-testid="wallet-withdraw-btn"
          >
            <ArrowUpFromLine className="h-6 w-6 text-gold-500" />
            <span className="text-sm font-semibold">Withdraw</span>
            <span className="text-xs text-muted-foreground">To CariPay</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => setActiveModal('send')}
            className="h-auto py-4 flex-col gap-2"
            data-testid="wallet-send-btn"
          >
            <Send className="h-6 w-6 text-gold-500" />
            <span className="text-sm font-semibold">Send</span>
            <span className="text-xs text-muted-foreground">To IslandHop user</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => setActiveModal('request')}
            className="h-auto py-4 flex-col gap-2"
            data-testid="wallet-request-btn"
          >
            <HandCoins className="h-6 w-6 text-teal-700" />
            <span className="text-sm font-semibold">Request</span>
            <span className="text-xs text-muted-foreground">Ask for money</span>
          </Button>
        </div>

        {/* Pending money requests */}
        {(requests.incoming.length > 0 || requests.outgoing.length > 0) && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <HandCoins className="h-5 w-5 text-teal-700" /> Money requests
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {requests.incoming.filter((r) => r.status === 'pending').length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Incoming · they want money from you</p>
                  <div className="divide-y" data-testid="wallet-incoming-requests">
                    {requests.incoming.filter((r) => r.status === 'pending').map((r) => (
                      <div key={r.id} className="py-3 flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{r.requester_email}</p>
                          <p className="text-xs text-muted-foreground truncate">{r.note || 'No note'} · {new Date(r.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">${formatAmt(r.amount)} {r.currency}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => resolveRequest(r.id, 'approve')} disabled={busy} className="bg-green-600 hover:bg-green-700 text-white" data-testid={`approve-${r.id}`}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => resolveRequest(r.id, 'decline')} disabled={busy} data-testid={`decline-${r.id}`}>
                            <Ban className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {requests.outgoing.filter((r) => r.status === 'pending').length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Outgoing · you asked for money</p>
                  <div className="divide-y" data-testid="wallet-outgoing-requests">
                    {requests.outgoing.filter((r) => r.status === 'pending').map((r) => (
                      <div key={r.id} className="py-3 flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">To: {r.payer_email}</p>
                          <p className="text-xs text-muted-foreground truncate">{r.note || 'No note'} · {new Date(r.created_at).toLocaleDateString()}</p>
                        </div>
                        <p className="font-semibold text-right">${formatAmt(r.amount)} {r.currency}</p>
                        <Button size="sm" variant="outline" onClick={() => resolveRequest(r.id, 'cancel')} disabled={busy} data-testid={`cancel-${r.id}`}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Add & Withdraw funds (bank / PayPal) */}
        <WalletFunding
          currencies={Object.keys(wallet?.balances || { USD: 0, TTD: 0 })}
          onChanged={refresh}
        />

        {/* History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-5 w-5" /> Recent activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {txns.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No transactions yet.</p>
            ) : (
              <div className="divide-y" data-testid="wallet-txn-list">
                {txns.map((t) => (
                  <div key={t.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{TXN_TYPE_LABEL[t.type] || t.type}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.counterparty_handle ? `via ${t.counterparty_handle} · ` : ''}
                        {new Date(t.created_at).toLocaleString()}
                        {t.note ? ` · ${t.note}` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${TXN_COLOR[t.type] || 'text-foreground/90'}`}>
                        {TXN_SIGN[t.type] || ''}${formatAmt(t.amount)} {t.currency}
                      </p>
                      <Badge className={t.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gold-500/15 text-gold-700'}>
                        {t.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Link modal */}
      <Modal open={activeModal === 'link'} onClose={closeModal} title="Link your CariPay account">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Enter your CariPay phone number, email, or account ID. We&apos;ll use it to deposit and withdraw funds.</p>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">CariPay handle</label>
            <Input value={linkHandle} onChange={(e) => setLinkHandle(e.target.value)} placeholder="+1 876 555 1234" data-testid="link-handle-input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Country</label>
            <select value={linkCountry} onChange={(e) => setLinkCountry(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm" data-testid="link-country-select">
              <option value="TT">🇹🇹 Trinidad & Tobago</option>
              <option value="JM">🇯🇲 Jamaica</option>
              <option value="BB">🇧🇧 Barbados</option>
              <option value="GH">🇬🇭 Ghana</option>
              <option value="NG">🇳🇬 Nigeria</option>
              <option value="ZA">🇿🇦 South Africa</option>
            </select>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <Button onClick={submitLink} disabled={busy} className="w-full bg-gold-gradient hover:bg-gold-gradient-hover text-white" data-testid="link-submit-btn">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Link account'}
          </Button>
        </div>
      </Modal>

      {/* Deposit / Withdraw modal */}
      <Modal open={activeModal === 'deposit' || activeModal === 'withdraw'} onClose={closeModal}
             title={activeModal === 'deposit' ? 'Deposit from CariPay' : 'Withdraw to CariPay'}>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Amount</label>
              <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" data-testid="transfer-amount-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm" data-testid="transfer-currency-select">
                <option value="USD">USD</option><option value="JMD">JMD</option>
                <option value="TTD">TTD</option><option value="BBD">BBD</option>
                <option value="GHS">GHS</option><option value="NGN">NGN</option><option value="ZAR">ZAR</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Note (optional)</label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Grocery money" />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <Button onClick={() => submitTransfer(activeModal)} disabled={busy} className="w-full bg-gold-gradient hover:bg-gold-gradient-hover text-white" data-testid="transfer-submit-btn">
            {busy
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : (activeModal === 'deposit' ? 'Deposit' : 'Withdraw')}
          </Button>
        </div>
      </Modal>

      {/* Send modal */}
      <Modal open={activeModal === 'send'} onClose={closeModal} title="Send to another IslandHop user">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Recipient email</label>
            <Input type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} placeholder="friend@example.com" data-testid="send-recipient-input" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Amount</label>
              <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" data-testid="send-amount-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm">
                <option value="USD">USD</option><option value="JMD">JMD</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Note (optional)</label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Thanks for lunch!" />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <Button onClick={() => submitTransfer('send')} disabled={busy} className="w-full bg-gold-gradient hover:bg-gold-gradient-hover text-white" data-testid="send-submit-btn">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send money'}
          </Button>
        </div>
      </Modal>

      {/* Request modal */}
      <Modal open={activeModal === 'request'} onClose={closeModal} title="Request money from another user">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Payer email</label>
            <Input type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} placeholder="friend@example.com" data-testid="request-payer-input" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Amount</label>
              <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" data-testid="request-amount-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm">
                <option value="USD">USD</option><option value="JMD">JMD</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Note (optional)</label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Split the dinner bill" />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <Button onClick={submitRequest} disabled={busy} className="w-full bg-neon-cyan hover:bg-neon-cyan/80 text-white" data-testid="request-submit-btn">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send request'}
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default WalletPage;
