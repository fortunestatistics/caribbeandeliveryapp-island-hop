import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Search, Utensils, Pill, ShoppingCart, Car, Package, Star, Store } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CATEGORIES = [
  { key: 'all', label: 'All', icon: Store },
  { key: 'restaurant', label: 'Restaurants', icon: Utensils },
  { key: 'pharmacy', label: 'Pharmacy', icon: Pill },
  { key: 'grocery', label: 'Grocery', icon: ShoppingCart },
  { key: 'shop', label: 'Shops', icon: Store },
  { key: 'taxi', label: 'Taxi', icon: Car, route: '/taxi-booking' },
  { key: 'courier', label: 'Courier', icon: Package, route: '/courier-order' },
];

const ICONS = { restaurant: Utensils, pharmacy: Pill, grocery: ShoppingCart };
const GRADIENTS = {
  restaurant: 'from-red-500 to-orange-500',
  pharmacy: 'from-cyan-500 to-emerald-500',
  grocery: 'from-green-500 to-emerald-600',
};

const BusinessSearch = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [cat, setCat] = useState(params.get('category') || 'all');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [online, setOnline] = useState(null);

  useEffect(() => {
    axios.get(`${API}/drivers/online-count`).then((r) => setOnline(r.data.online)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (query.trim().length >= 2) {
        const r = await axios.get(`${API}/search`, { params: { q: query.trim() } });
        const vendors = (r.data.results || []).filter((x) => x.type === 'vendor');
        let filtered = vendors;
        if (cat === 'shop') {
          filtered = vendors.filter((v) => !['pharmacy', 'grocery', 'restaurant'].includes(v.vendor_type));
        } else if (cat !== 'all') {
          filtered = vendors.filter((v) => v.vendor_type === cat);
        }
        setResults(filtered);
      } else {
        const r = await axios.get(`${API}/search/featured`, { params: { category: cat, limit: 30 } });
        setResults(r.data.results || []);
      }
    } catch (e) {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [cat, query]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const handleCategory = (c) => {
    if (c.route) { navigate(c.route); return; }
    setCat(c.key);
  };

  const openVendor = (v) => {
    if (v.vendor_type === 'pharmacy') navigate('/pharmacy-order');
    else if (v.vendor_type === 'grocery') navigate('/grocery-order');
    else navigate(`/restaurant/${v.id}`);
  };

  return (
    <div className="min-h-screen bg-background" data-testid="business-search-page">
      <div className="bg-gold-gradient py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-3">Browse Businesses</h1>
          <p className="text-white/90 text-base mb-6">Discover onboarded partners near you — food, pharmacy, grocery and more.</p>
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search partners, food, medicines…"
              data-testid="business-search-input"
              className="w-full pl-12 pr-4 py-3.5 rounded-full bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-gold-500"
            />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-wrap gap-2 mb-8 justify-center">
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            const activeChip = !c.route && cat === c.key;
            const hint = (c.key === 'taxi' || c.key === 'courier') && online != null ? ` · ${online} online` : '';
            return (
              <button
                key={c.key}
                onClick={() => handleCategory(c)}
                data-testid={`business-cat-${c.key}`}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  activeChip ? 'bg-gold-gradient text-white' : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />{c.label}{hint}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="py-16 text-center text-muted-foreground">Loading partners…</div>
        ) : results.length === 0 ? (
          <div className="py-16 text-center" data-testid="business-empty">
            <Store className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No partners found. Try another category or search term.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {results.map((v, i) => {
              const Icon = ICONS[v.vendor_type] || Store;
              return (
                <button
                  key={v.id || i}
                  onClick={() => openVendor(v)}
                  data-testid={`business-card-${i}`}
                  className="text-left bg-card border border-border rounded-xl overflow-hidden hover:border-gold-500 hover:shadow-lg transition-all group"
                >
                  <div className={`h-28 bg-gradient-to-br ${GRADIENTS[v.vendor_type] || 'from-slate-500 to-slate-700'} flex items-center justify-center relative`}>
                    <Icon className="h-10 w-10 text-white/90" />
                    {v.featured && (
                      <span className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full bg-white/90 text-gold-700 font-semibold flex items-center gap-1">
                        <Star className="h-3 w-3 fill-gold-500 text-gold-500" />Featured
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="font-semibold text-foreground group-hover:text-gold-600 truncate">{v.name}</div>
                    <div className="text-xs text-muted-foreground capitalize mb-1">{v.vendor_type}</div>
                    {v.description && <p className="text-sm text-muted-foreground line-clamp-2">{v.description}</p>}
                    {v.rating ? (
                      <div className="mt-2 inline-flex items-center gap-1 text-xs text-amber-600">
                        <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />{Number(v.rating).toFixed(1)}
                      </div>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default BusinessSearch;
