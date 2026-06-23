import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Megaphone, Wallet, Clock, Users, Trophy } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const AnalyticsPromotions = () => {
  const [promoters, setPromoters] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [currency, setCurrency] = useState('USD');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [p, l] = await Promise.all([
        axios.get(`${API}/admin/promoters`, { headers: authHeaders() }),
        axios.get(`${API}/promoter/leaderboard`, { headers: authHeaders() }),
      ]);
      setPromoters(p.data.promoters || []);
      setLeaderboard(l.data.leaderboard || []);
      setCurrency(l.data.currency || 'USD');
    } catch (err) {
      console.error('Failed to load promotions analytics:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalPaid = promoters.reduce((s, p) => s + (p.paid || 0), 0);
  const totalHeld = promoters.reduce((s, p) => s + (p.held || 0), 0);
  const totalOnboards = promoters.reduce((s, p) => s + (p.onboards || 0), 0);
  const ambassadors = promoters.filter((p) => p.is_promoter).length;
  const fmt = (n) => `${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

  return (
    <Card className="md:col-span-2" data-testid="analytics-promotions">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-gold-500" /> Promotions &amp; Earnings
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-center text-muted-foreground py-8">Loading…</p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="rounded-xl bg-muted/40 p-4" data-testid="promo-stat-paid">
                <Wallet className="h-5 w-5 text-green-600 mb-1" />
                <p className="text-xs text-muted-foreground">Paid to Promoters</p>
                <p className="text-xl font-bold text-green-600">{fmt(totalPaid)}</p>
              </div>
              <div className="rounded-xl bg-muted/40 p-4" data-testid="promo-stat-held">
                <Clock className="h-5 w-5 text-gold-700 mb-1" />
                <p className="text-xs text-muted-foreground">Held (pending eligibility)</p>
                <p className="text-xl font-bold text-gold-700">{fmt(totalHeld)}</p>
              </div>
              <div className="rounded-xl bg-muted/40 p-4" data-testid="promo-stat-onboards">
                <Users className="h-5 w-5 text-teal-700 mb-1" />
                <p className="text-xs text-muted-foreground">Total Onboards</p>
                <p className="text-xl font-bold text-foreground">{totalOnboards}</p>
              </div>
              <div className="rounded-xl bg-muted/40 p-4" data-testid="promo-stat-ambassadors">
                <Trophy className="h-5 w-5 text-gold-500 mb-1" />
                <p className="text-xs text-muted-foreground">Approved Ambassadors</p>
                <p className="text-xl font-bold text-foreground">{ambassadors}</p>
              </div>
            </div>

            <h4 className="font-semibold text-foreground mb-3">Top Promoters</h4>
            {leaderboard.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4" data-testid="analytics-no-promoters">No promoter earnings yet.</p>
            ) : (
              <div className="space-y-2">
                {leaderboard.slice(0, 8).map((p) => (
                  <div key={p.rank} className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg" data-testid={`analytics-promoter-${p.rank}`}>
                    <span className="flex items-center gap-3">
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${p.rank <= 3 ? 'bg-gold-gradient text-white' : 'bg-muted text-foreground'}`}>{p.rank}</span>
                      <span className="text-sm font-medium text-foreground">{p.name}</span>
                    </span>
                    <span className="text-sm">
                      <span className="font-semibold text-gold-700">{fmt(p.total)}</span>
                      <span className="text-muted-foreground"> · {p.onboards} onboards</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AnalyticsPromotions;
