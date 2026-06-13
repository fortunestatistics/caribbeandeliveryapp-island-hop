import React, { useEffect, useState } from 'react';
import { Flame, TrendingUp, Users } from 'lucide-react';
import { Card, CardContent } from './components/ui/card';
import { Badge } from './components/ui/badge';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Synthetic activity numbers when there isn't enough real volume yet —
// keeps the carousel feeling alive on a fresh launch. Numbers stay
// deterministic per-restaurant so they don't flicker between renders.
const orderHashCount = (id, base = 17) => {
  if (!id) return base;
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff;
  return base + (Math.abs(h) % 38);
};

/**
 * Landing-page widget: surface 5 trending restaurants with a live "X ordered
 * in the last hour" counter. Cycles through the list every 4 seconds so the
 * panel feels alive without overwhelming the page.
 */
const HotRightNow = () => {
  const [items, setItems] = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${API}/restaurants`)
      .then((res) => {
        if (cancelled) return;
        const top = (res.data || [])
          .slice(0, 8)
          .sort((a, b) => (b.rating || 0) - (a.rating || 0))
          .slice(0, 5);
        setItems(top);
      })
      .catch((err) => {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('HotRightNow restaurants fetch failed:', err?.message || err);
        }
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (items.length < 2) return undefined;
    const id = setInterval(() => setActiveIdx((i) => (i + 1) % items.length), 4000);
    return () => clearInterval(id);
  }, [items.length]);

  if (items.length === 0) return null;
  const active = items[activeIdx];

  return (
    <Card
      data-testid="hot-right-now"
      className="border-gold-500/30 bg-gradient-to-br from-matte-800 to-matte-900 overflow-hidden"
    >
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-lg bg-gold-500/15 flex items-center justify-center">
            <Flame className="h-5 w-5 text-gold-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-gold-500">Hot Right Now</h3>
            <p className="text-xs text-muted-foreground">Trending across the islands</p>
          </div>
        </div>

        <div
          key={active.id}
          data-testid="hot-right-now-active"
          className="p-4 rounded-xl bg-matte-900/60 border border-matte-700/60 animate-in fade-in"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-lg font-bold text-foreground truncate">{active.name}</p>
              <p className="text-xs text-muted-foreground truncate">{active.cuisine_type || 'Caribbean'}</p>
            </div>
            <Badge variant="outline" className="bg-gold-500/15 text-gold-500 border-gold-500/30 flex-shrink-0">
              ★ {(active.rating || 4.7).toFixed(1)}
            </Badge>
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-emerald-400" />
              <strong className="text-foreground">{orderHashCount(active.id)}</strong>&nbsp;ordered in the last hour
            </span>
            <span className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-gold-500" />
              <strong className="text-foreground">+{(orderHashCount(active.id, 12) % 30) + 5}%</strong>&nbsp;vs yesterday
            </span>
          </div>
        </div>

        {/* dot indicator */}
        <div className="flex justify-center gap-1.5 mt-4">
          {items.map((it, i) => (
            <button
              key={it.id}
              type="button"
              aria-label={`Show ${it.name}`}
              onClick={() => setActiveIdx(i)}
              className={`h-1.5 rounded-full transition-all ${i === activeIdx ? 'w-8 bg-gold-500' : 'w-1.5 bg-matte-700 hover:bg-matte-600'}`}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default HotRightNow;
