import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { Input } from './components/ui/input';
import { Car, Store, Mail, Phone, MapPin, FileText, LogIn, Loader2, RefreshCw, ExternalLink, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { portalPathForRole } from './authToken';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const token = () => localStorage.getItem('token');
const authHeaders = () => (token() ? { Authorization: `Bearer ${token()}` } : {});

const InfoRow = ({ icon: Icon, children }) => (
  <div className="flex items-center gap-2 text-sm text-muted-foreground">
    <Icon className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{children}</span>
  </div>
);

// Map a raw driver status to a queue category for the filter sub-tabs.
const STATUS_CATEGORIES = {
  pending: ['pending', 'pending_approval', 'under_review', 'submitted', 'applied', 'new', ''],
  id_check: ['identity_pending', 'verifying', 'id_pending', 'identity_review', 'identity'],
  incomplete: ['incomplete', 'draft', 'started', 'unverified'],
};
const categoryOf = (status) => {
  const s = String(status || '').toLowerCase();
  if (STATUS_CATEGORIES.id_check.includes(s)) return 'id_check';
  if (STATUS_CATEGORIES.incomplete.includes(s)) return 'incomplete';
  return 'pending';
};

const AdminApplicants = () => {
  const navigate = useNavigate();
  const { impersonate: startImpersonation } = useAuth();
  const [data, setData] = useState({ drivers: [], merchants: [], counts: {} });
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('drivers');
  const [statusFilter, setStatusFilter] = useState('all');
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = await axios.get(`${API}/admin/applicants`, { headers: authHeaders() });
      setData(res.data);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to load applicants');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const runSearch = async (e) => {
    if (e) e.preventDefault();
    const q = query.trim();
    if (q.length < 2) { setSearchResults(null); return; }
    setSearching(true); setError('');
    try {
      const res = await axios.get(`${API}/admin/applicants/search`, {
        params: { q }, headers: authHeaders(),
      });
      setSearchResults(res.data);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => { setQuery(''); setSearchResults(null); setError(''); };

  const viewPortal = async (userId, name, isExternal) => {
    if (isExternal || !userId) {
      alert('This is an external lead with no account yet — there is no portal to view. Approve them first.');
      return;
    }
    setBusyId(userId);
    try {
      const target = await startImpersonation(userId, name, true);
      navigate(portalPathForRole(target?.user_type));
    } catch (e) {
      alert(e?.response?.data?.detail || 'Could not open portal');
      setBusyId(null);
    }
  };

  const driverDocUrl = (docId) => `${API}/drivers/documents/${docId}/download?auth=${encodeURIComponent(token())}`;

  const isSearchMode = !!searchResults;
  const source = isSearchMode ? searchResults : data;
  let list = tab === 'drivers' ? (source.drivers || []) : (source.merchants || []);
  if (tab === 'drivers' && !isSearchMode && statusFilter !== 'all') {
    list = list.filter((a) => categoryOf(a.status) === statusFilter);
  }

  const driverCatCounts = (data.drivers || []).reduce((acc, a) => {
    const c = categoryOf(a.status); acc[c] = (acc[c] || 0) + 1; return acc;
  }, {});
  const STATUS_TABS = [
    { key: 'all', label: 'All', count: (data.drivers || []).length },
    { key: 'pending', label: 'Pending', count: driverCatCounts.pending || 0 },
    { key: 'id_check', label: 'ID Check', count: driverCatCounts.id_check || 0 },
    { key: 'incomplete', label: 'Incomplete', count: driverCatCounts.incomplete || 0 },
  ];

  return (
    <div className="space-y-6" data-testid="admin-applicants-section">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2">
          <Button variant={tab === 'drivers' ? 'default' : 'outline'} onClick={() => setTab('drivers')} data-testid="applicants-tab-drivers">
            <Car className="h-4 w-4 mr-2" /> Drivers ({data.counts?.drivers ?? 0})
          </Button>
          <Button variant={tab === 'merchants' ? 'default' : 'outline'} onClick={() => setTab('merchants')} data-testid="applicants-tab-merchants">
            <Store className="h-4 w-4 mr-2" /> Merchants ({data.counts?.merchants ?? 0})
          </Button>
        </div>
        <Button variant="outline" onClick={load} disabled={loading} data-testid="applicants-refresh">
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />} Refresh
        </Button>
      </div>

      {/* Search any applicant by name / email / phone — finds edge cases the queue hides */}
      <form onSubmit={runSearch} className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search applicants by name, email or phone…"
            className="pl-9"
            data-testid="applicants-search-input"
          />
        </div>
        <Button type="submit" disabled={searching || query.trim().length < 2} data-testid="applicants-search-btn">
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
        </Button>
        {isSearchMode && (
          <Button type="button" variant="ghost" onClick={clearSearch} data-testid="applicants-search-clear">
            <X className="h-4 w-4 mr-1" /> Clear
          </Button>
        )}
      </form>

      {isSearchMode && (
        <p className="text-sm text-muted-foreground" data-testid="applicants-search-summary">
          Search results for “{searchResults.query}” — {searchResults.counts?.drivers ?? 0} driver(s), {searchResults.counts?.merchants ?? 0} merchant(s).
        </p>
      )}

      {/* Driver status filter sub-tabs (hidden while searching) */}
      {tab === 'drivers' && !isSearchMode && (
        <div className="flex flex-wrap gap-2" data-testid="applicants-status-filters">
          {STATUS_TABS.map((s) => (
            <Button
              key={s.key}
              size="sm"
              variant={statusFilter === s.key ? 'default' : 'outline'}
              onClick={() => setStatusFilter(s.key)}
              data-testid={`applicants-status-filter-${s.key}`}
            >
              {s.label} ({s.count})
            </Button>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-600" data-testid="applicants-error">{error}</p>}

      {!loading && list.length === 0 && (
        <p className="text-sm text-muted-foreground" data-testid="applicants-empty">
          {isSearchMode ? `No ${tab} match your search.` : `No ${tab} applications in this view.`}
        </p>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {list.map((a) => (
          <Card key={a.id} data-testid={`applicant-card-${a.id}`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">
                  {tab === 'drivers' ? (a.name || 'Unnamed driver') : (a.business_name || 'Unnamed business')}
                </CardTitle>
                {a.is_external_lead
                  ? <Badge variant="secondary">Website lead</Badge>
                  : <Badge variant="outline">In-app</Badge>}
              </div>
              {a.status && a.status !== 'pending' && (
                <Badge variant="secondary" className="mt-1 w-fit capitalize" data-testid={`applicant-status-${a.id}`}>
                  {String(a.status).replace(/_/g, ' ')}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {tab === 'merchants' && a.owner_name && <InfoRow icon={Store}>Owner: {a.owner_name}</InfoRow>}
              {a.email && <InfoRow icon={Mail}>{a.email}</InfoRow>}
              {a.phone && <InfoRow icon={Phone}>{a.phone}</InfoRow>}
              {tab === 'drivers' && (
                <>
                  {a.city && <InfoRow icon={MapPin}>{a.city}</InfoRow>}
                  <InfoRow icon={Car}>{[a.vehicle_type, a.vehicle_plate].filter(Boolean).join(' · ') || '—'}</InfoRow>
                  {a.license_number && <InfoRow icon={FileText}>Licence: {a.license_number}</InfoRow>}
                </>
              )}
              {tab === 'merchants' && (
                <>
                  {a.business_type && <InfoRow icon={Store}>Type: {a.business_type}</InfoRow>}
                  {a.address && (
                    <InfoRow icon={MapPin}>
                      {typeof a.address === 'string' ? a.address : [a.address.line1, a.address.city, a.address.country].filter(Boolean).join(', ')}
                    </InfoRow>
                  )}
                  {a.description && <p className="text-xs text-muted-foreground pt-1">{a.description}</p>}
                </>
              )}

              {/* Uploaded files */}
              <div className="pt-2">
                <p className="text-xs font-medium mb-1">Documents</p>
                {(!a.documents || a.documents.length === 0) ? (
                  <p className="text-xs text-muted-foreground">No files uploaded.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {a.documents.map((d, i) => (
                      <a
                        key={d.document_id || d.url || `${d.label}-${i}`}
                        href={d.document_id ? driverDocUrl(d.document_id) : d.url}
                        target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-border hover:bg-muted"
                        data-testid={`applicant-doc-${a.id}-${i}`}
                      >
                        <FileText className="h-3 w-3" /> {d.doc_type || d.label || d.filename || 'Document'}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === a.user_id}
                  onClick={() => viewPortal(a.user_id, a.name || a.business_name, a.is_external_lead)}
                  data-testid={`applicant-view-portal-${a.id}`}
                >
                  {busyId === a.user_id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LogIn className="h-4 w-4 mr-2" />}
                  View their portal
                </Button>
                {a.is_external_lead && (
                  <p className="text-xs text-muted-foreground mt-1">External lead — no account until approved.</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminApplicants;
