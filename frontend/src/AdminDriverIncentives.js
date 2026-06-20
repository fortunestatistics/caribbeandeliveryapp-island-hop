import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Badge } from './components/ui/badge';
import { Trophy, Loader2, Award, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import api from './services/api';

const AREA_LABELS = {
  overall: 'Overall',
  punctuality: 'Punctuality',
  professionalism: 'Professional',
  care: 'Care',
  communication: 'Comms',
};
const MEDALS = ['🥇', '🥈', '🥉'];

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const AdminDriverIncentives = () => {
  const [month, setMonth] = useState(currentMonth());
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [board, setBoard] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/driver-incentives/leaderboard', { params: { month } });
      setBoard(res.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const runPayout = async () => {
    if (!window.confirm(`Pay the top drivers for ${month}? This credits their wallets and cannot be undone.`)) return;
    setRunning(true);
    try {
      const res = await api.post('/admin/driver-incentives/run-monthly', { month });
      if (res.data.already_awarded) {
        toast.info('This month has already been paid out.');
      } else if (res.data.success) {
        toast.success(`Paid ${res.data.awarded.length} driver(s)!`);
      } else {
        toast.warning(res.data.message || 'No drivers qualified this month.');
      }
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Payout failed');
    } finally {
      setRunning(false);
    }
  };

  const tiers = board?.tiers || [];
  const th = board?.thresholds || {};
  const alreadyAwarded = (board?.already_awarded || []).length > 0;
  const drivers = board?.drivers || [];
  const qualifiedCount = drivers.filter((d) => d.qualified).length;

  return (
    <div data-testid="admin-driver-incentives">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-gold-500" /> Driver Incentives — Monthly Excellence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Month</label>
              <Input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-44"
                data-testid="incentives-month-input"
              />
            </div>
            <Button onClick={load} variant="outline" data-testid="incentives-refresh-btn">Refresh</Button>
            <Button
              onClick={runPayout}
              disabled={running || alreadyAwarded || qualifiedCount === 0}
              className="bg-gold-gradient text-white"
              data-testid="incentives-run-payout-btn"
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : alreadyAwarded ? 'Already paid out' : 'Run payout'}
            </Button>
          </div>
          <div className="mt-4 text-sm text-muted-foreground flex flex-wrap gap-x-6 gap-y-1">
            <span>🥇 ${tiers[0]} &nbsp; 🥈 ${tiers[1]} &nbsp; 🥉 ${tiers[2]} {board?.currency}</span>
            <span>Qualify: ≥{th.min_deliveries} deliveries &amp; ≥{th.min_ratings} ratings</span>
            <span>{qualifiedCount} driver(s) qualified</span>
          </div>
        </CardContent>
      </Card>

      {alreadyAwarded && (
        <Card className="mb-6 border-green-500/30 bg-green-500/5" data-testid="incentives-awarded-banner">
          <CardContent className="py-4">
            <p className="font-semibold text-green-400 flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Payout completed for {board.month}</p>
            <div className="mt-2 space-y-1 text-sm text-muted-foreground">
              {board.already_awarded.sort((a, b) => a.rank - b.rank).map((a) => (
                <div key={a.id}>{MEDALS[a.rank - 1]} Rank {a.rank} — ${a.amount} {a.currency} (composite {a.composite})</div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leaderboard — {board?.month}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 text-gold-500 animate-spin" /></div>
          ) : drivers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8" data-testid="incentives-empty">No driver ratings for this month yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="incentives-table">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-2 pr-3">#</th>
                    <th className="py-2 pr-3">Driver</th>
                    <th className="py-2 pr-3">Composite</th>
                    {Object.values(AREA_LABELS).map((l) => <th key={l} className="py-2 pr-3">{l}</th>)}
                    <th className="py-2 pr-3">Deliv.</th>
                    <th className="py-2 pr-3">Ratings</th>
                    <th className="py-2 pr-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {drivers.map((d) => (
                    <tr key={d.driver_id} className={`border-b border-matte-800/60 ${d.rank && d.rank <= 3 ? 'bg-gold-500/5' : ''}`} data-testid={`incentive-row-${d.driver_id}`}>
                      <td className="py-2 pr-3 font-semibold">{d.rank ? (MEDALS[d.rank - 1] || d.rank) : '—'}</td>
                      <td className="py-2 pr-3 text-foreground font-medium">{d.name}</td>
                      <td className="py-2 pr-3 font-bold text-gold-400">{d.composite || '—'}</td>
                      {Object.keys(AREA_LABELS).map((k) => (
                        <td key={k} className="py-2 pr-3">{d.areas?.[k] ?? '—'}</td>
                      ))}
                      <td className="py-2 pr-3">{d.deliveries}</td>
                      <td className="py-2 pr-3">{d.ratings_count}</td>
                      <td className="py-2 pr-3">
                        {d.qualified
                          ? <Badge className="bg-green-500/15 text-green-400">Qualified</Badge>
                          : <Badge variant="outline" className="text-muted-foreground">Below threshold</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDriverIncentives;
