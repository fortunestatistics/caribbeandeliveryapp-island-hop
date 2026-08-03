import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { Banknote, ShieldCheck, ExternalLink, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const authHeaders = () => {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
};

<<<<<<< HEAD
const money = (n) => `$${Number(n || 0).toFixed(2)}`;

const VendorStripeConnect = () => {
  const [status, setStatus] = useState(null);
  const [payouts, setPayouts] = useState(null);
=======
const VendorStripeConnect = () => {
  const [status, setStatus] = useState(null);
>>>>>>> cb805eb
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/vendor/connect/status`, { headers: authHeaders() });
      setStatus(res.data);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to load Stripe status');
    } finally {
      setLoading(false);
    }
<<<<<<< HEAD
    try {
      const pr = await axios.get(`${API}/merchant/payouts`, { headers: authHeaders() });
      setPayouts(pr.data);
    } catch (e) {
      /* payouts are best-effort; ignore */
    }
=======
>>>>>>> cb805eb
  };

  useEffect(() => { refresh(); }, []);

  const startOnboarding = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await axios.post(
        `${API}/vendor/connect/onboarding`,
        { return_url: window.location.origin },
        { headers: authHeaders() }
      );
      window.location.href = res.data.onboarding_url;
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to start onboarding');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold-500" />
      </div>
    );
  }

  const payoutsEnabled = status?.payouts_enabled;
  const onboardingComplete = status?.onboarding_complete;

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Banking & Payouts</h1>
        <p className="text-muted-foreground mb-8">Connect your Stripe account to receive deposits from IslandHop directly to your bank.</p>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2"><Banknote className="h-5 w-5 text-gold-500" /> Stripe Connect</span>
              {status?.connected ? (
                payoutsEnabled ? (
                  <Badge className="bg-green-100 text-green-800" data-testid="connect-status-active">Active</Badge>
                ) : onboardingComplete ? (
                  <Badge className="bg-gold-500/15 text-gold-700" data-testid="connect-status-pending">Pending review</Badge>
                ) : (
                  <Badge className="bg-gold-500/15 text-gold-700" data-testid="connect-status-incomplete">Incomplete</Badge>
                )
              ) : (
                <Badge className="bg-matte-800 text-foreground" data-testid="connect-status-disconnected">Not connected</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div className="bg-background rounded-lg p-4">
                <p className="text-muted-foreground">Charges enabled</p>
                <p className="text-lg font-semibold">{status?.charges_enabled ? 'Yes' : 'No'}</p>
              </div>
              <div className="bg-background rounded-lg p-4">
                <p className="text-muted-foreground">Payouts enabled</p>
                <p className="text-lg font-semibold">{payoutsEnabled ? 'Yes' : 'No'}</p>
              </div>
            </div>

            <div className="flex items-start gap-2 bg-neon-cyan/10 border border-neon-cyan/30 rounded-lg p-4 text-sm text-teal-700">
              <ShieldCheck className="h-5 w-5 text-teal-700 flex-shrink-0 mt-0.5" />
              <p>
                You enter your bank details on Stripe&apos;s secure hosted page — IslandHop never sees or stores them.
                Stripe handles KYC, compliance, and the actual money movement.
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700" data-testid="connect-error">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /> {error}
              </div>
            )}

            {payoutsEnabled ? (
              <div className="flex items-center gap-2 text-green-700 text-sm">
                <CheckCircle2 className="h-5 w-5" />
<<<<<<< HEAD
                You&apos;re all set — each order&apos;s share is sent to your Stripe account automatically and paid to your bank on Stripe&apos;s payout schedule.
=======
                You&apos;re all set — payouts will arrive automatically at 02:00 UTC daily.
>>>>>>> cb805eb
              </div>
            ) : (
              <Button
                onClick={startOnboarding}
                disabled={submitting}
                className="w-full bg-gold-gradient hover:bg-gold-gradient-hover text-white"
                data-testid="connect-start-btn"
              >
                {submitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Redirecting to Stripe…</>
                ) : (
                  <>{status?.connected ? 'Continue onboarding' : 'Connect bank account'} <ExternalLink className="h-4 w-4 ml-2" /></>
                )}
              </Button>
            )}

            {status?.connected && (
              <Button variant="outline" onClick={refresh} className="w-full" data-testid="connect-refresh-btn">
                Refresh status
              </Button>
            )}
          </CardContent>
        </Card>
<<<<<<< HEAD

        {payouts && (
          <Card className="mt-8" data-testid="merchant-payouts-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Banknote className="h-5 w-5 text-gold-500" /> Your earnings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div className="bg-background rounded-lg p-4 border border-border">
                  <p className="text-muted-foreground">Paid out to you</p>
                  <p className="text-2xl font-bold text-green-700" data-testid="payout-total-paid">{money(payouts.summary?.total_paid_out)}</p>
                </div>
                <div className="bg-background rounded-lg p-4 border border-border">
                  <p className="text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold text-gold-600" data-testid="payout-total-pending">{money(payouts.summary?.pending_amount)}</p>
                </div>
                <div className="bg-background rounded-lg p-4 border border-border">
                  <p className="text-muted-foreground">Paid orders</p>
                  <p className="text-2xl font-bold">{payouts.summary?.orders_count || 0}</p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">{payouts.payout_note}</p>

              {payouts.orders?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="payout-orders-table">
                    <thead>
                      <tr className="text-left text-muted-foreground border-b border-border">
                        <th className="py-2 pr-3">Order</th>
                        <th className="py-2 pr-3">Customer paid</th>
                        <th className="py-2 pr-3">Platform fee</th>
                        <th className="py-2 pr-3">Tax</th>
                        <th className="py-2 pr-3">Your net</th>
                        <th className="py-2">Payout</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payouts.orders.map((o, i) => (
                        <tr key={o.order_id || i} className="border-b border-border/50" data-testid={`payout-order-row-${i}`}>
                          <td className="py-2 pr-3 font-mono text-xs">{String(o.order_id).slice(0, 8)}</td>
                          <td className="py-2 pr-3">{money(o.customer_total)}</td>
                          <td className="py-2 pr-3 text-muted-foreground">-{money(o.platform_fee)}</td>
                          <td className="py-2 pr-3 text-muted-foreground">{money(o.tax)}</td>
                          <td className="py-2 pr-3 font-semibold text-green-700">{money(o.your_net)}</td>
                          <td className="py-2">
                            <Badge className={o.payout_status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-gold-500/15 text-gold-700'}>
                              {o.payout_status === 'paid' ? 'Sent' : 'Pending'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-2">No paid orders yet — your earnings will show here.</p>
              )}
            </CardContent>
          </Card>
        )}
=======
>>>>>>> cb805eb
      </div>
    </div>
  );
};

export default VendorStripeConnect;
