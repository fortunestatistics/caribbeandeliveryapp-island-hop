import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Card, CardContent } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Badge } from './components/ui/badge';
import { useToast } from './hooks/use-toast';
import { Send, RefreshCw, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

// Admin: send earnings to merchants/drivers who chose PayPal payouts (real PayPal Payouts API).
export default function AdminPayPalPayouts() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [recipients, setRecipients] = useState([]);
  const [open, setOpen] = useState(false);
  const [amounts, setAmounts] = useState({});
  const [sending, setSending] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/admin/payouts/paypal/recipients`, { headers: authHeaders() });
      setRecipients(r.data?.results || []);
    } catch (_) {
      setRecipients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const pay = async (rcpt) => {
    const key = `${rcpt.collection}-${rcpt.entity_id}`;
    const amount = Number(amounts[key]);
    if (!amount || amount <= 0) {
      toast({ title: 'Enter an amount', description: 'Type the payout amount first.', variant: 'destructive' });
      return;
    }
    setSending(key);
    try {
      const res = await axios.post(`${API}/admin/paypal/payout`, {
        email: rcpt.paypal_email, amount, currency: 'USD',
        note: `IslandHop payout to ${rcpt.name}`,
      }, { headers: authHeaders() });
      toast({ title: 'Payout sent', description: `$${amount.toFixed(2)} to ${rcpt.paypal_email} (${res.data?.status || 'PENDING'})` });
      setAmounts((a) => ({ ...a, [key]: '' }));
    } catch (e) {
      toast({ title: 'Payout failed', description: e?.response?.data?.detail || 'Please try again.', variant: 'destructive' });
    } finally {
      setSending('');
    }
  };

  const count = recipients.length;

  return (
    <Card className="mb-4 border-l-4 border-l-[#003087]" data-testid="paypal-payouts-card">
      <CardContent className="p-4">
        <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between gap-3 text-left" data-testid="paypal-payouts-toggle">
          <div className="flex items-center gap-2">
            <Send className="h-5 w-5 text-[#003087]" />
            <div>
              <p className="font-semibold text-sm flex items-center gap-2">
                PayPal Payouts
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : (
                  <Badge className="bg-[#003087]/10 text-[#003087]" data-testid="paypal-payouts-count">{count} recipient{count === 1 ? '' : 's'}</Badge>
                )}
              </p>
              <p className="text-xs text-muted-foreground">Send earnings to merchants & drivers who chose PayPal payouts.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); load(); }} data-testid="paypal-payouts-refresh" />
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </div>
        </button>

        {open && (
          <div className="mt-3 space-y-2" data-testid="paypal-payouts-list">
            {count === 0 && !loading && (
              <p className="text-sm text-muted-foreground">No one has selected PayPal payouts yet.</p>
            )}
            {recipients.map((r) => {
              const key = `${r.collection}-${r.entity_id}`;
              return (
                <div key={key} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2 text-sm" data-testid={`paypal-recipient-${r.entity_id}`}>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{r.name} <span className="text-xs text-muted-foreground capitalize">· {r.type}</span></p>
                    <p className="text-xs text-muted-foreground truncate">{r.paypal_email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">$</span>
                    <Input
                      type="number" min="0" step="0.01" placeholder="0.00"
                      value={amounts[key] || ''}
                      onChange={(e) => setAmounts((a) => ({ ...a, [key]: e.target.value }))}
                      className="w-28"
                      data-testid={`paypal-amount-${r.entity_id}`}
                    />
                    <Button size="sm" className="bg-[#003087] text-white hover:bg-[#00256b]" onClick={() => pay(r)} disabled={sending === key} data-testid={`paypal-pay-${r.entity_id}`}>
                      {sending === key ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-1" /> Pay</>}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
