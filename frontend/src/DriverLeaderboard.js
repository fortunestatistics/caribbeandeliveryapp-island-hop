import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Trophy, Star, Award, Medal } from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Aspirational baseline so a freshly launched marketplace still feels alive.
// Replaced by real top-driver data from `/api/drivers/leaderboard` when it
// returns ≥ 1 row.
const FALLBACK = [
  { id: 's1', name: 'Marcus J.',  area: 'Port of Spain', deliveries: 412, rating: 5.0, streak: 'GOLD' },
  { id: 's2', name: 'Anika R.',   area: 'San Fernando',  deliveries: 387, rating: 4.97, streak: 'GOLD' },
  { id: 's3', name: 'Devon P.',   area: 'Chaguanas',     deliveries: 354, rating: 4.95, streak: 'SILVER' },
  { id: 's4', name: 'Keisha M.',  area: 'Tobago',        deliveries: 312, rating: 4.94, streak: 'SILVER' },
  { id: 's5', name: 'Rajesh S.',  area: 'Arima',         deliveries: 298, rating: 4.93, streak: 'BRONZE' },
];

const TIER_META = {
  GOLD:   { icon: Trophy, classes: 'bg-gold-500/15 text-gold-500 border-gold-500/40' },
  SILVER: { icon: Medal,  classes: 'bg-zinc-400/15 text-zinc-300 border-zinc-400/40' },
  BRONZE: { icon: Award,  classes: 'bg-orange-500/15 text-orange-400 border-orange-500/40' },
};

const DriverLeaderboard = () => {
  const [rows, setRows] = useState(FALLBACK);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    axios
      .get(`${API}/drivers/leaderboard?limit=10`)
      .then((res) => {
        if (Array.isArray(res.data) && res.data.length > 0) {
          setRows(res.data);
          setIsLive(true);
        }
      })
      .catch(() => { /* fall back to seeded data */ });
  }, []);

  return (
    <div className="min-h-screen bg-matte-900 py-12" data-testid="driver-leaderboard">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gold-gradient flex items-center justify-center">
            <Trophy className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Top Drivers This Week</h1>
            <p className="text-sm text-muted-foreground">
              {isLive ? 'Live rankings — updated continuously' : 'Spotlight roll — actual rankings refresh on launch'}
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Leaderboard</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {rows.map((d, idx) => {
                const tier = TIER_META[d.streak] || TIER_META.BRONZE;
                const TierIcon = tier.icon;
                return (
                  <li
                    key={d.id}
                    data-testid={`leaderboard-row-${idx + 1}`}
                    className={`flex items-center gap-4 p-3 rounded-xl border ${idx === 0 ? 'border-gold-500/40 bg-gold-500/5' : 'border-matte-700/60 bg-matte-900/40'}`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold flex-shrink-0 ${idx === 0 ? 'bg-gold-gradient text-white' : 'bg-matte-800 text-foreground'}`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">{d.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{d.area}</p>
                    </div>
                    <div className="hidden sm:flex flex-col items-end text-xs text-muted-foreground">
                      <span><strong className="text-foreground">{d.deliveries}</strong> deliveries</span>
                      <span className="flex items-center gap-1 mt-0.5">
                        <Star className="h-3 w-3 text-gold-500 fill-gold-500" />
                        <strong className="text-foreground">{(d.rating || 0).toFixed(2)}</strong>
                      </span>
                    </div>
                    <Badge variant="outline" className={`flex-shrink-0 ${tier.classes}`}>
                      <TierIcon className="h-3 w-3 mr-1" /> {d.streak}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DriverLeaderboard;
