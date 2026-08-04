import React, { useState } from 'react';
import axios from 'axios';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Card, CardContent } from './components/ui/card';
import { Wrench, Search, Loader2, CheckCircle, AlertTriangle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const AdminStorefrontRepair = () => {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [busyKey, setBusyKey] = useState(null);

  const search = async () => {
    const term = q.trim();
    if (term.length < 2) { toast.error('Enter at least 2 characters'); return; }
    setLoading(true);
    try {
      const r = await axios.get(`${API}/admin/merchants/lookup`, { params: { q: term }, headers: authHeaders() });
      setResults(r.data.results || []);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const repair = async (row, key) => {
    setBusyKey(key);
    try {
      const body = row.kind === 'application'
        ? { application_id: row.application_id }
        : { collection: row.collection, vendor_id: row.vendor_id };
      const r = await axios.post(`${API}/admin/merchants/repair-storefront`, body, { headers: authHeaders() });
      const acts = (r.data.actions || []).join('; ');
      if (r.data.vendor_id) {
        toast.success(`Repaired: ${acts}`);
      } else {
        toast.warning(acts || 'Could not fully repair');
      }
      await search();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Repair failed');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <Card className="border-gold-500/40 bg-gold-500/5" data-testid="storefront-repair-tool">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <Wrench className="h-5 w-5 text-gold-500" />
          <h3 className="text-base font-semibold text-foreground">Repair a merchant storefront</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Search a merchant by name or email. If their storefront won't open for customers, click Repair to activate their vendor record, promote their account role, or provision it from an approved application.
        </p>
        <div className="flex gap-2 mb-3">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            placeholder="e.g. williams cakes, gravity media, owner@email.com"
            data-testid="storefront-repair-input"
          />
          <Button onClick={search} disabled={loading} data-testid="storefront-repair-search-btn">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            <span className="ml-2 hidden sm:inline">Search</span>
          </Button>
        </div>

        {results && results.length === 0 && (
          <p className="text-sm text-muted-foreground py-3" data-testid="storefront-repair-empty">No merchants found for that search.</p>
        )}

        {results && results.length > 0 && (
          <div className="space-y-2" data-testid="storefront-repair-results">
            {results.map((row, i) => {
              const key = row.vendor_id || row.application_id || i;
              return (
                <div key={key} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background p-3" data-testid={`storefront-repair-row-${i}`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground truncate">{row.name || '(no name)'}</span>
                      <span className="text-[11px] rounded-full bg-muted px-2 py-0.5 capitalize text-muted-foreground">
                        {row.kind === 'application' ? 'application' : (row.vendor_type || 'vendor')}
                      </span>
                      {row.healthy ? (
                        <span className="flex items-center gap-1 text-[11px] text-green-600"><CheckCircle className="h-3.5 w-3.5" />Healthy</span>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] text-amber-600"><AlertTriangle className="h-3.5 w-3.5" />Needs repair</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {row.user_email || row.email || 'no email'}
                      {row.status ? ` · status: ${row.status}` : ''}
                      {row.verification_status ? ` · ${row.verification_status}` : ''}
                    </div>
                    {row.issues && row.issues.length > 0 && (
                      <ul className="mt-1 text-xs text-amber-700 list-disc list-inside">
                        {row.issues.map((iss, ii) => <li key={ii}>{iss}</li>)}
                      </ul>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    {!row.healthy && (
                      <Button size="sm" onClick={() => repair(row, key)} disabled={busyKey === key} data-testid={`storefront-repair-btn-${i}`}>
                        {busyKey === key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4 mr-1" />}
                        Repair
                      </Button>
                    )}
                    {row.storefront_url && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(row.storefront_url, '_blank', 'noopener')}
                        data-testid={`storefront-repair-open-${i}`}
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />Open
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminStorefrontRepair;
