import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Card, CardContent } from './components/ui/card';
import { LifeBuoy, Search, Loader2, CheckCircle, AlertTriangle, Zap, History, ExternalLink, Eye, ChevronDown, Ban, Trash2, GitMerge, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import AdminManageProfile from './AdminManageProfile';
import AdminMergeDialog from './AdminMergeDialog';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const dashboardFor = (row) => {
  const t = (row.driver && 'driver') || row.user_type || (row.merchant && 'business');
  if (t === 'driver') return '/driver-dashboard';
  if (t === 'business' || t === 'restaurant') return '/vendor-dashboard';
  return '/dashboard';
};

const AdminAccountRepair = () => {
  const { impersonate } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [busyKey, setBusyKey] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [audit, setAudit] = useState([]);
  const [showAudit, setShowAudit] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [recentMerges, setRecentMerges] = useState([]);
  const [undoingId, setUndoingId] = useState(null);

  const loadAudit = async () => {
    try {
      const r = await axios.get(`${API}/admin/repair-audit`, { params: { limit: 25 }, headers: authHeaders() });
      setAudit(r.data.results || []);
    } catch (e) { /* non-blocking */ }
  };

  const loadRecentMerges = async () => {
    try {
      const r = await axios.get(`${API}/admin/accounts/recent-merges`, { headers: authHeaders() });
      setRecentMerges(r.data.merges || []);
    } catch (e) { /* non-blocking */ }
  };

  const undoMerge = async (m) => {
    if (!window.confirm(`Undo the merge and restore ${m.secondary_email || 'the removed account'}?`)) return;
    setUndoingId(m.id);
    try {
      const r = await axios.post(`${API}/admin/accounts/merge/${m.id}/undo`, {}, { headers: authHeaders() });
      toast.success(`Merge reversed — restored ${r.data.restored_email || 'account'} (${r.data.restored_records} records)`);
      loadRecentMerges();
      loadAudit();
      search();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not undo the merge');
    } finally { setUndoingId(null); }
  };

  useEffect(() => { loadAudit(); loadRecentMerges(); }, []);

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
    let body;
    if (row.kind === 'merchant_application') {
      body = { application_id: row.application_id };
      if (!row.has_account) {
        const email = window.prompt(
          `This approved application ("${row.name || 'merchant'}") isn't linked to any account yet.\n\nEnter the merchant's signup email to link + provision it:`,
          row.email || '');
        if (!email) return;
        body.email = email.trim();
      }
    } else {
      body = row.user_id ? { user_id: row.user_id } : { driver_id: row.driver_id };
    }
    setBusyKey(key);
    try {
      const r = await axios.post(`${API}/admin/accounts/repair`, body, { headers: authHeaders() });
      const url = r.data.storefront_url;
      const note = r.data.note;
      toast.success(`Repaired: ${(r.data.actions || []).join('; ')}`, {
        description: note || undefined,
        duration: note || url ? 12000 : 5000,
        action: url ? { label: 'Open profile', onClick: () => window.open(url, '_blank', 'noopener') } : undefined,
      });
      await search();
      loadAudit();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Repair failed');
    } finally {
      setBusyKey(null);
    }
  };

  const repairAllDrivers = async () => {
    setBulkBusy(true);
    try {
      const r = await axios.post(`${API}/admin/drivers/repair-all`, {}, { headers: authHeaders() });
      const n = r.data.healed_count || 0;
      toast.success(n > 0 ? `Repaired ${n} approved driver${n === 1 ? '' : 's'}` : 'All approved drivers are already healthy');
      loadAudit();
      if (results) search();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Bulk repair failed');
    } finally {
      setBulkBusy(false);
    }
  };

  const provisionAllMerchants = async () => {
    setBulkBusy(true);
    try {
      const r = await axios.post(`${API}/admin/merchants/provision-all`, {}, { headers: authHeaders() });
      const n = r.data.provisioned_count || 0;
      toast.success(n > 0 ? `Provisioned ${n} approved merchant${n === 1 ? '' : 's'}` : 'All approved merchants are already provisioned');
      loadAudit();
      if (results) search();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Bulk provision failed');
    } finally {
      setBulkBusy(false);
    }
  };

  const viewAs = async (row) => {
    if (!row.user_id) { toast.error('No user account to view'); return; }
    try {
      await impersonate(row.user_id, row.name, true);
      toast.success(`Now editing as ${row.name || 'user'}`);
      navigate(dashboardFor(row));
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not open this account');
    }
  };

  const deactivate = async (row) => {
    if (!row.user_id) return;
    if (!window.confirm(`Deactivate ${row.name || row.email || 'this account'}? They won't be able to log in. You can reactivate it later with Repair.`)) return;
    setBusyKey(row.user_id + ':deact');
    try {
      await axios.post(`${API}/admin/users/${row.user_id}/deactivate`, {}, { headers: authHeaders() });
      toast.success('Account deactivated');
      loadAudit();
      search();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not deactivate');
    } finally { setBusyKey(null); }
  };

  const deleteBusiness = async (row) => {
    const vid = row.merchant && row.merchant.id;
    if (!vid) return;
    if (!window.confirm(`Delete the business "${row.name || ''}"? This removes the storefront, products and coupons, and turns the owner back into a normal customer. This cannot be undone.`)) return;
    setBusyKey(vid + ':delbiz');
    try {
      await axios.delete(`${API}/admin/merchants/${vid}`, { headers: authHeaders() });
      toast.success('Business deleted');
      loadAudit();
      search();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not delete business');
    } finally { setBusyKey(null); }
  };

  const roleBadge = (row) => {
    if (row.kind === 'unlinked_driver') return 'unlinked driver';
    if (row.kind === 'merchant_application') return 'merchant application';
    if (row.driver) return `driver (${row.driver.status || '—'})`;
    if (row.merchant) return `${row.merchant.type || 'merchant'} (${row.merchant.status || 'unprovisioned'})`;
    return row.user_type || 'customer';
  };

  const storefrontUrl = (row) => (row.merchant && row.merchant.storefront_url) || null;

  return (
    <Card className="border-neon-cyan/40 bg-neon-cyan/5" data-testid="account-repair-tool">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
          <div className="flex items-center gap-2">
            <LifeBuoy className="h-5 w-5" style={{ color: '#0FA3A3' }} />
            <h3 className="text-base font-semibold text-foreground">Repair an account (driver / customer / merchant)</h3>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={repairAllDrivers}
            disabled={bulkBusy}
            data-testid="account-repair-all-drivers-btn"
          >
            {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Zap className="h-4 w-4 mr-1" />}
            Repair all approved drivers
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={provisionAllMerchants}
            disabled={bulkBusy}
            data-testid="account-provision-all-merchants-btn"
          >
            {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Zap className="h-4 w-4 mr-1" />}
            Provision all approved merchants
          </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Search any account by name or email — or bulk-heal every approved driver in one click. Fixes an
          approved driver whose panel won't load, re-activates a blocked account, promotes a stuck role,
          and creates a missing driver wallet.
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
                    {row.diagnostics && (
                      <div className="mt-1.5">
                        <button
                          type="button"
                          onClick={() => setExpanded((e) => ({ ...e, [key]: !e[key] }))}
                          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                          data-testid={`account-repair-details-toggle-${i}`}
                        >
                          <ChevronDown className={`h-3 w-3 transition-transform ${expanded[key] ? 'rotate-180' : ''}`} />
                          {expanded[key] ? 'Hide' : 'View'} full details
                        </button>
                        {expanded[key] && (
                          <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground rounded-md bg-muted/50 p-2" data-testid={`account-repair-details-${i}`}>
                            <div>Role: <span className="text-foreground">{row.diagnostics.role}{row.diagnostics.is_owner ? ' (owner)' : ''}</span></div>
                            <div>Account: <span className="text-foreground">{row.diagnostics.account_status}</span></div>
                            <div>Driver record: <span className="text-foreground">{row.diagnostics.driver_record ? `${row.diagnostics.driver_record.status} · wallet ${row.diagnostics.driver_record.has_wallet ? '✓' : '✗'} · role ${row.diagnostics.driver_record.role_promoted ? '✓' : '✗'}` : '—'}</span></div>
                            <div>Vendor record: <span className="text-foreground">{row.diagnostics.vendor_record ? `${row.diagnostics.vendor_record.type} · ${row.diagnostics.vendor_record.status}` : '—'}</span></div>
                            <div>Merchant apps: <span className="text-foreground">{(row.diagnostics.merchant_applications || []).map((a) => a.status).join(', ') || '—'}</span></div>
                            <div>Driver apps: <span className="text-foreground">{(row.diagnostics.driver_applications || []).map((a) => a.status).join(', ') || '—'}</span></div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    {row.repairable && (
                      <Button size="sm" onClick={() => repair(row, key)} disabled={busyKey === key} data-testid={`account-repair-btn-${i}`}>
                        {busyKey === key ? <Loader2 className="h-4 w-4 animate-spin" /> : <LifeBuoy className="h-4 w-4 mr-1" />}
                        {row.kind === 'merchant_application' ? 'Provision' : 'Repair'}
                      </Button>
                    )}
                    {row.user_id && <AdminManageProfile row={row} index={i} />}
                    {row.user_id && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => viewAs(row)}
                        data-testid={`account-repair-viewas-${i}`}
                      >
                        <Eye className="h-4 w-4 mr-1" />Edit as user
                      </Button>
                    )}
                    {row.user_id && <AdminMergeDialog row={row} index={i} onMerged={() => { search(); loadRecentMerges(); loadAudit(); }} />}
                    {row.merchant && row.merchant.id && !row.is_owner && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:text-red-700 border-red-200"
                        onClick={() => deleteBusiness(row)}
                        disabled={busyKey === (row.merchant.id + ':delbiz')}
                        data-testid={`account-delete-business-${i}`}
                      >
                        {busyKey === (row.merchant.id + ':delbiz') ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}Delete business
                      </Button>
                    )}
                    {row.user_id && !row.is_owner && row.account_status !== 'disabled' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:text-red-700 border-red-200"
                        onClick={() => deactivate(row)}
                        disabled={busyKey === (row.user_id + ':deact')}
                        data-testid={`account-deactivate-${i}`}
                      >
                        {busyKey === (row.user_id + ':deact') ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4 mr-1" />}Deactivate
                      </Button>
                    )}
                    {storefrontUrl(row) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(storefrontUrl(row), '_blank', 'noopener')}
                        data-testid={`account-repair-open-${i}`}
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />Open profile
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Recent merges — undo window */}
        {recentMerges.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border" data-testid="recent-merges">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
              <GitMerge className="h-3.5 w-3.5" />Recent merges (undo available for 24h)
            </p>
            <div className="space-y-1.5">
              {recentMerges.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2 text-xs rounded-md bg-background border border-border px-2.5 py-1.5" data-testid={`recent-merge-${m.id}`}>
                  <span className="text-muted-foreground truncate">
                    Removed <span className="text-foreground font-medium">{m.secondary_email || m.secondary_name || 'account'}</span>
                    {' · '}{m.moved_count} records moved
                    <span className="block text-[10px] opacity-70">{m.created_at ? new Date(m.created_at).toLocaleString() : ''}</span>
                  </span>
                  <Button size="sm" variant="outline" onClick={() => undoMerge(m)} disabled={undoingId === m.id} data-testid={`undo-merge-${m.id}`}>
                    {undoingId === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5 mr-1" />}Undo
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Repair history / audit trail */}
        <div className="mt-4 pt-3 border-t border-border">
          <button
            type="button"
            onClick={() => setShowAudit((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            data-testid="account-repair-audit-toggle"
          >
            <History className="h-3.5 w-3.5" />
            {showAudit ? 'Hide' : 'Show'} repair history ({audit.length})
          </button>
          {showAudit && (
            <div className="mt-2 space-y-1.5" data-testid="account-repair-audit-list">
              {audit.length === 0 && <p className="text-xs text-muted-foreground">No repairs recorded yet.</p>}
              {audit.map((a) => (
                <div key={a.id} className="text-xs text-muted-foreground rounded-md bg-background border border-border px-2.5 py-1.5" data-testid={`account-repair-audit-${a.id}`}>
                  <span className="text-foreground font-medium">{a.actor_email || a.actor_name || 'admin'}</span>
                  {' · '}<span className="capitalize">{(a.kind || '').replace('_', ' ')}</span>
                  {' · '}{(a.actions || []).join('; ')}
                  {a.target?.email ? ` · ${a.target.email}` : (a.target?.count != null ? ` · ${a.target.count} drivers` : '')}
                  <span className="block text-[10px] opacity-70">{a.created_at ? new Date(a.created_at).toLocaleString() : ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminAccountRepair;
