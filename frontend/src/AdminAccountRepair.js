import React, { useState } from 'react';
import axios from 'axios';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Card, CardContent } from './components/ui/card';
import { LifeBuoy, Search, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const AdminAccountRepair = () => {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [busyKey, setBusyKey] = useState(null);

  const search = async () => {
    const term = q.trim();
    if (term.length < 2) { toast.error('Enter at least 2 characters'); return; }
    setLoading(true);
    try {
      const r = await axios.get(`${API}/admin/accounts/lookup`, { params: { q: term }, headers: authHeaders() });
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
      const body = row.user_id ? { user_id: row.user_id } : { driver_id: row.driver_id };
      const r = await axios.post(`${API}/admin/accounts/repair`, body, { headers: authHeaders() });
      toast.success(`Repaired: ${(r.data.actions || []).join('; ')}`);
      await search();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Repair failed');
    } finally {
      setBusyKey(null);
    }
  };

  const roleBadge = (row) => {
    if (row.kind === 'unlinked_driver') return 'unlinked driver';
    if (row.driver) return `driver (${row.driver.status || '—'})`;
    if (row.merchant) return `${row.merchant.type} (${row.merchant.status || '—'})`;
    return row.user_type || 'customer';
  };

  return (
    <Card className="border-neon-cyan/40 bg-neon-cyan/5" data-testid="account-repair-tool">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <LifeBuoy className="h-5 w-5" style={{ color: '#0FA3A3' }} />
          <h3 className="text-base font-semibold text-foreground">Repair an account (driver / customer / merchant)</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Search any account by name or email. Fixes an approved driver whose panel won't load, re-activates a
          paused/blocked account, promotes a stuck role, and creates a missing driver wallet.
        </p>
        <div className="flex gap-2 mb-3">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            placeholder="e.g. Kulture D Teacher, driver@email.com"
            data-testid="account-repair-input"
          />
          <Button onClick={search} disabled={loading} data-testid="account-repair-search-btn">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            <span className="ml-2 hidden sm:inline">Search</span>
          </Button>
        </div>

        {results && results.length === 0 && (
          <p className="text-sm text-muted-foreground py-3" data-testid="account-repair-empty">No accounts found for that search.</p>
        )}

        {results && results.length > 0 && (
          <div className="space-y-2" data-testid="account-repair-results">
            {results.map((row, i) => {
              const key = row.user_id || row.driver_id || i;
              return (
                <div key={key} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background p-3" data-testid={`account-repair-row-${i}`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground truncate">{row.name || '(no name)'}</span>
                      <span className="text-[11px] rounded-full bg-muted px-2 py-0.5 capitalize text-muted-foreground">
                        {roleBadge(row)}
                      </span>
                      {row.healthy ? (
                        <span className="flex items-center gap-1 text-[11px] text-green-600"><CheckCircle className="h-3.5 w-3.5" />Healthy</span>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] text-amber-600"><AlertTriangle className="h-3.5 w-3.5" />Needs repair</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {row.email || 'no email'}
                      {row.account_status ? ` · account: ${row.account_status}` : ''}
                    </div>
                    {row.issues && row.issues.length > 0 && (
                      <ul className="mt-1 text-xs text-amber-700 list-disc list-inside">
                        {row.issues.map((iss, ii) => <li key={ii}>{iss}</li>)}
                      </ul>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    {row.repairable && (
                      <Button size="sm" onClick={() => repair(row, key)} disabled={busyKey === key} data-testid={`account-repair-btn-${i}`}>
                        {busyKey === key ? <Loader2 className="h-4 w-4 animate-spin" /> : <LifeBuoy className="h-4 w-4 mr-1" />}
                        Repair
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

export default AdminAccountRepair;
