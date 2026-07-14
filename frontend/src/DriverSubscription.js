import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { useToast } from './hooks/use-toast';
import { ArrowLeft, Check, Users, Star, Crown, Loader2 } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const authHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const TIER_ICON = { standard: Users, pro: Star, premium: Crown };
const TIER_COLOR = {
  standard: 'from-gray-500 to-gray-600',
  pro: 'from-gold-300 to-orange-500',
  premium: 'from-yellow-500 to-orange-500',
};

const DriverSubscription = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [plans, setPlans] = useState([]);
  const [currentTier, setCurrentTier] = useState('standard');
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(null);

  const load = async () => {
    // Plans are public — always render them regardless of driver/auth state.
    try {
      const p = await axios.get(`${API}/driver/subscription/plans`);
      setPlans(p.data || []);
    } catch (e) {
      toast({ title: 'Could not load plans', description: e?.response?.data?.detail || 'Please try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
    // Current subscription is best-effort (needs a driver account) — never blocks plans.
    try {
      const s = await axios.get(`${API}/driver/subscription`, { headers: authHeaders() });
      setCurrentTier(s.data?.tier || 'standard');
    } catch (e) {
      console.warn('Driver current-subscription fetch failed (defaulting to standard):', e?.message);
      // Not a driver yet / not logged in — leave tier at default 'standard'.
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  const selectPlan = async (tier) => {
    setSelecting(tier);
    try {
      const res = await axios.post(`${API}/driver/subscription/select`, { tier }, { headers: authHeaders() });
      toast({ title: 'Plan updated', description: res.data?.message });
      setCurrentTier(tier);
    } catch (e) {
      toast({ title: 'Could not change plan', description: e?.response?.data?.detail || 'Please try again.', variant: 'destructive' });
    } finally {
      setSelecting(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-500/40"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8" data-testid="driver-subscription-page">
      <div className="container mx-auto px-4 max-w-5xl">
        <Button variant="ghost" onClick={() => navigate('/driver-dashboard')} className="mb-4" data-testid="driversub-back-btn">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
        </Button>

        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground">Driver Plans</h1>
          <p className="text-muted-foreground mt-2">Upgrade to keep more of every delivery fee. Tips are always 100% yours.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const Icon = TIER_ICON[plan.tier] || Users;
            const isCurrent = currentTier === plan.tier;
            const recommended = plan.tier === 'pro';
            return (
              <Card key={plan.tier} data-testid={`driver-plan-${plan.tier}`}
                className={`relative ${recommended ? 'border-4 border-gold-500/30 shadow-2xl md:scale-105' : 'border border-border'}`}>
                {recommended && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-gold-gradient text-white px-4 py-1">Most Popular</Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-6">
                  <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-r ${TIER_COLOR[plan.tier]} flex items-center justify-center`}>
                    <Icon className="h-8 w-8 text-white" />
                  </div>
                  <CardTitle className="text-2xl mb-1">{plan.name}</CardTitle>
                  <p className="text-muted-foreground text-sm mb-3">{plan.tagline}</p>
                  <div>
                    <span className="text-4xl font-bold text-foreground" data-testid={`driver-plan-price-${plan.tier}`}>
                      {plan.price_ttd > 0 ? `TT$${plan.price_ttd.toLocaleString()}` : 'Free'}
                    </span>
                    {plan.price_ttd > 0 && <span className="text-muted-foreground">/mo</span>}
                  </div>
                  <Badge variant="outline" className="mt-3 bg-green-500/10 text-green-600 border-green-500/30">
                    Keep {plan.driver_keep_pct}% of delivery fees
                  </Badge>
                </CardHeader>
                <CardContent>
                  <Button
                    className={`w-full mb-6 ${recommended ? 'bg-gold-gradient text-white' : ''}`}
                    variant={isCurrent ? 'outline' : (recommended ? 'default' : 'secondary')}
                    disabled={isCurrent || selecting === plan.tier}
                    onClick={() => selectPlan(plan.tier)}
                    data-testid={`driver-plan-select-${plan.tier}`}
                  >
                    {selecting === plan.tier && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {isCurrent ? 'Current Plan' : (plan.price_ttd === 0 ? 'Switch to Standard' : `Upgrade to ${plan.name}`)}
                  </Button>
                  <div className="space-y-3">
                    {plan.features.map((f) => (
                      <div key={f} className="flex items-start gap-2 text-sm">
                        <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-foreground/90">{f}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground text-center mt-8">
          Platform cut on delivery fees: Standard 20% · Pro 10% · Premium 0%. The customer's flat $3.00 service fee is separate and never deducted from your earnings.
        </p>
      </div>
    </div>
  );
};

export default DriverSubscription;
