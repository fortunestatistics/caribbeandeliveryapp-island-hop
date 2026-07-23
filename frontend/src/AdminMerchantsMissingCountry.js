import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Card, CardContent } from './components/ui/card';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { AlertTriangle, CheckCircle, RefreshCw, ChevronDown, ChevronRight, Loader2, MapPin } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

// Payment-routing guardrail: active merchants with no country can't be routed to the
// correct processor (Stripe vs WiPay), so they must be fixed before launch.
export default function AdminMerchantsMissingCountry() {
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/admin/merchants/missing-country`, { headers: authHeaders() });
      setResults(r.data?.results || []);
    } catch (_) {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const count = results.length;
  const clean = !loading && count === 0;

  return (
    <Card className="mb-4 border-l-4" style={{ borderLeftColor: clean ? '#16a34a' : '#f59e0b' }} data-testid="payment-readiness-card">
      <CardContent className="p-4">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between gap-3 text-left"
          data-testid="payment-readiness-toggle"
        >
          <div className="flex items-center gap-2">
            {clean ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            )}
            <div>
              <p className="font-semibold text-sm flex items-center gap-2">
                Payment routing readiness
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                ) : (
                  <Badge className={clean ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'} data-testid="payment-readiness-count">
                    {clean ? 'All merchants have a country' : `${count} missing country`}
                  </Badge>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                Merchants without a country can't be routed to the right payment processor. Fix before launch.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <RefreshCw
              className="h-4 w-4 text-muted-foreground hover:text-foreground"
              onClick={(e) => { e.stopPropagation(); load(); }}
              data-testid="payment-readiness-refresh"
            />
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </div>
        </button>

        {open && !clean && (
          <div className="mt-3 space-y-2" data-testid="payment-readiness-list">
            {results.map((m) => (
              <div
                key={`${m.collection}-${m.vendor_id}`}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2 text-sm"
                data-testid={`missing-country-row-${m.vendor_id}`}
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{m.name || 'Unnamed merchant'}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    <span className="capitalize">{m.type}</span>{m.email ? ` · ${m.email}` : ''}
                  </p>
                </div>
                <Badge variant="outline" className="text-amber-700 border-amber-300 shrink-0">
                  <MapPin className="h-3 w-3 mr-1" /> No country
                </Badge>
              </div>
            ))}
            <p className="text-xs text-muted-foreground pt-1">
              Ask each merchant to set their country in Merchant → Settings → Business Profile (or edit it via User Accounts).
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
