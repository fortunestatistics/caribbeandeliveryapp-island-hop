import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent } from './components/ui/card';
import { Button } from './components/ui/button';
import { Package, UserPlus, Truck, Store, Boxes, ArrowRight } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const OPTIONS = [
  { key: 'customer', title: 'Order as a Customer', desc: 'Food, groceries, pharmacy, courier & rides.', icon: UserPlus },
  { key: 'driver', title: 'Become a Driver', desc: 'Earn money delivering across the islands.', icon: Truck },
  { key: 'merchant', title: 'List my Business', desc: 'Restaurants, shops & pharmacies — reach more customers.', icon: Store },
  { key: 'supplier', title: 'Become a Supplier', desc: 'Supply goods to the IslandHop network.', icon: Boxes },
];

const JoinLanding = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const c = (code || '').trim().toUpperCase();
    if (c) localStorage.setItem('promo_ref', c);
    axios.get(`${API}/promoter/resolve/${c}`)
      .then((res) => setInfo(res.data))
      .catch((err) => { console.error('Promoter resolve failed:', err); setInfo({ valid: false }); })
      .finally(() => setLoading(false));
  }, [code]);

  const choose = (intent) => {
    const c = (code || '').trim().toUpperCase();
    navigate(`/signup?ref=${encodeURIComponent(c)}&intent=${intent}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-500/40"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center py-12" data-testid="join-landing-page">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-gold-500/15 px-4 py-1.5 text-sm font-semibold text-gold-700 mb-4">
            <Package className="h-4 w-4" /> IslandHop
          </div>
          <h1 className="font-heading text-3xl md:text-4xl font-bold text-secondary">
            {info?.valid
              ? <>You&apos;re invited by <span className="text-gold-gradient">{info.promoter_name}</span></>
              : <>Welcome to <span className="text-gold-gradient">IslandHop</span></>}
          </h1>
          <p className="text-muted-foreground mt-3">How would you like to get started?</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {OPTIONS.map((o) => {
            const Icon = o.icon;
            return (
              <Card
                key={o.key}
                onClick={() => choose(o.key)}
                className="cursor-pointer border-border hover:border-gold-500/50 hover:shadow-card-hover transition-all group"
                data-testid={`join-option-${o.key}`}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold-gradient text-white">
                      <Icon className="h-6 w-6" />
                    </span>
                    <div>
                      <h3 className="font-heading text-lg font-bold text-secondary flex items-center gap-1">
                        {o.title}
                        <ArrowRight className="h-4 w-4 text-gold-500 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">{o.desc}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          Already have an account?{' '}
          <button onClick={() => navigate('/login')} className="text-gold-500 font-semibold hover:underline" data-testid="join-login-link">
            Log in
          </button>
        </p>
      </div>
    </div>
  );
};

export default JoinLanding;
