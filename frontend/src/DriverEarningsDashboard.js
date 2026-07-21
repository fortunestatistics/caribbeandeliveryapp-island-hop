import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { Separator } from './components/ui/separator';
import {
  TrendingUp, Clock, CheckCircle, Wallet, CreditCard, Info, Loader2, Inbox,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DriverEarningsDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState({
    balance: 0, pending: 0, totalEarned: 0, completed: 0, transactions: [],
  });

  useEffect(() => {
    const load = async () => {
      const token = localStorage.getItem('token');
      const cfg = { withCredentials: true, headers: token ? { Authorization: `Bearer ${token}` } : {} };
      try {
        const me = await axios.get(`${API}/drivers/me`, cfg);
        const driverId = me.data?.id;
        if (!driverId) { setError('No driver profile found for this account.'); return; }
        const [wallet, orders] = await Promise.all([
          axios.get(`${API}/drivers/${driverId}/wallet`, cfg),
          axios.get(`${API}/drivers/${driverId}/completed-orders`, cfg).catch(() => ({ data: [] })),
        ]);
        const txns = (orders.data || []).map((o) => ({
          id: o.id,
          date: o.delivered_at || o.updated_at || o.created_at,
          type: o.service_type || 'Delivery',
          earnings: Number(o.driver_earnings || 0),
          orderTotal: Number(o.total || 0),
          tip: Number(o.tip || 0),
          status: o.driver_payout_status === 'paid' ? 'Paid' : 'Pending',
        }));
        setData({
          balance: Number(wallet.data?.available_balance || 0),
          pending: Number(wallet.data?.pending_earnings || 0),
          totalEarned: Number(wallet.data?.total_earned || 0),
          completed: txns.length,
          transactions: txns,
        });
      } catch (e) {
        setError(e?.response?.data?.detail || 'Could not load your earnings.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const money = (n) => `$${Number(n || 0).toFixed(2)}`;

  return (
    <div className="min-h-screen bg-background py-8" data-testid="driver-earnings-page">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="mb-8">
          <Button variant="ghost" onClick={() => navigate('/driver-dashboard')} className="mb-4">
            ← Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold text-foreground mb-2">Driver Earnings</h1>
          <p className="text-muted-foreground">Track your real earnings, fees, and payouts</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground" data-testid="earnings-loading">
            <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading your earnings…
          </div>
        ) : error ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground" data-testid="earnings-error">{error}</CardContent></Card>
        ) : (
          <>
            {/* Summary Cards — real data */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <Card data-testid="earnings-balance">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center"><Wallet className="h-6 w-6 text-green-600" /></div>
                    <Badge className="bg-green-100 text-green-700">Available</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">Current Balance</p>
                  <h3 className="text-2xl font-bold text-foreground">{money(data.balance)}</h3>
                </CardContent>
              </Card>
              <Card data-testid="earnings-pending">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-gold-500/15 rounded-lg flex items-center justify-center"><Clock className="h-6 w-6 text-yellow-600" /></div>
                    <Badge className="bg-gold-500/15 text-yellow-700">Processing</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">Pending Earnings</p>
                  <h3 className="text-2xl font-bold text-foreground">{money(data.pending)}</h3>
                </CardContent>
              </Card>
              <Card data-testid="earnings-total">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-gold-500/15 rounded-lg flex items-center justify-center"><TrendingUp className="h-6 w-6 text-gold-500" /></div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">Total Earned</p>
                  <h3 className="text-2xl font-bold text-foreground">{money(data.totalEarned)}</h3>
                </CardContent>
              </Card>
              <Card data-testid="earnings-completed">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-gold-500/15 rounded-lg flex items-center justify-center"><CheckCircle className="h-6 w-6 text-gold-500" /></div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">Completed Deliveries</p>
                  <h3 className="text-2xl font-bold text-foreground">{data.completed}</h3>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                {/* Fee structure — real policy info */}
                <Card className="border-2 border-gold-500/30">
                  <CardHeader>
                    <CardTitle className="flex items-center"><Info className="h-5 w-5 mr-2 text-gold-500" />How Your Earnings Work</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-lg border border-matte-700 p-3" data-testid="tier-standard">
                        <p className="font-semibold text-foreground">Standard</p>
                        <p className="text-xs text-gold-600 font-semibold mb-1">Free</p>
                        <p className="text-2xl font-bold text-green-600">80%</p>
                        <p className="text-xs text-muted-foreground">of delivery fees + 100% of tips.</p>
                      </div>
                      <div className="rounded-lg border-2 border-gold-500/40 bg-gold-500/10 p-3" data-testid="tier-pro">
                        <p className="font-semibold text-foreground">Pro</p>
                        <p className="text-xs text-gold-600 font-semibold mb-1">TT$700/mo</p>
                        <p className="text-2xl font-bold text-green-600">90%</p>
                        <p className="text-xs text-muted-foreground">of delivery fees + 100% of tips.</p>
                      </div>
                      <div className="rounded-lg border-2 border-yellow-500/40 bg-yellow-500/10 p-3" data-testid="tier-premium">
                        <p className="font-semibold text-foreground">Premium</p>
                        <p className="text-xs text-gold-600 font-semibold mb-1">TT$1,400/mo</p>
                        <p className="text-2xl font-bold text-green-600">100%</p>
                        <p className="text-xs text-muted-foreground">of delivery fees + 100% of tips.</p>
                      </div>
                    </div>
                    <Separator className="my-3" />
                    <p className="text-sm text-muted-foreground italic">The flat $3.00 service fee is paid by the customer and never deducted from you. All tiers keep 100% of tips.</p>
                  </CardContent>
                </Card>

                {/* Real transactions */}
                <Card>
                  <CardHeader><CardTitle>Recent Deliveries</CardTitle></CardHeader>
                  <CardContent>
                    {data.transactions.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground" data-testid="earnings-empty">
                        <Inbox className="h-10 w-10 mb-3 opacity-50" />
                        <p className="font-medium">No deliveries yet</p>
                        <p className="text-sm">Your completed deliveries and earnings will appear here.</p>
                      </div>
                    ) : (
                      <div className="space-y-4" data-testid="earnings-transactions">
                        {data.transactions.map((t) => (
                          <div key={t.id} className="border rounded-lg p-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-semibold text-foreground capitalize">{t.type}</h4>
                                  <Badge className={t.status === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-gold-500/15 text-yellow-700'}>{t.status}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">{t.date ? new Date(t.date).toLocaleString() : ''}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xl font-bold text-green-600">+{money(t.earnings)}</p>
                                <p className="text-xs text-muted-foreground">Your earnings</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Payout / banking — real setup prompts */}
              <div className="space-y-6">
                <Card>
                  <CardHeader><CardTitle className="flex items-center"><CreditCard className="h-5 w-5 mr-2 text-gold-500" />Payouts</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">Earnings are paid out weekly to your registered payout account. Your available balance above reflects funds ready for your next payout.</p>
                    <Button variant="outline" className="w-full" onClick={() => navigate('/driver/subscription')} data-testid="manage-plan-btn">
                      Manage your plan
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DriverEarningsDashboard;
