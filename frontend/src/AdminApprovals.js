import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Card, CardContent } from './components/ui/card';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { Input } from './components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './components/ui/dialog';
import {
  Store, Car, Truck, Building2, Users, Search, RefreshCw, ChevronDown, ChevronRight,
  CheckCircle, X, Receipt, Loader2, Mail, Phone, LogIn, PauseCircle, ShieldOff, UserCheck, ClipboardList,
  FileText, FolderOpen, ExternalLink, AlertTriangle, ShoppingBag, Wrench,
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const token = () => localStorage.getItem('token');
const authHeaders = () => ({ Authorization: `Bearer ${token()}` });

const CATEGORIES = [
  { key: 'drivers', label: 'Driver Applications', icon: Truck, approveKind: 'driver' },
  { key: 'businesses', label: 'Merchant/Vendor Applications', icon: Store, approveKind: 'business' },
  { key: 'restaurants', label: 'Live Restaurants', icon: Building2, approveKind: 'restaurant' },
  { key: 'shops', label: 'Live Shops', icon: ShoppingBag, approveKind: null },
  { key: 'car_rentals', label: 'Car Rental Companies', icon: Car, approveKind: 'car_rental' },
  { key: 'users', label: 'User Accounts', icon: Users, approveKind: null },
];

const APPROVE_EP = { driver: 'drivers', restaurant: 'restaurants', car_rental: 'car-rentals', business: 'businesses' };
const PENDING_STATUSES = ['pending', 'pending_approval'];

// Application-style categories flow through a "pending" review queue; the others
// (live restaurants, car-rental companies, user accounts) are created active, so
// their sensible default view is "All Records" — otherwise their tab looks empty.
const APPLICATION_CATEGORIES = new Set(['drivers', 'businesses']);
const defaultStatusFor = (cat) => (APPLICATION_CATEGORIES.has(cat) ? 'pending' : 'all');

const statusBadge = (status) => {
  const s = (status || '').toLowerCase();
  if (['active', 'approved', 'verified', 'online'].includes(s)) return 'bg-green-500/15 text-green-700 border-green-500/30';
  if (PENDING_STATUSES.includes(s)) return 'bg-amber-500/15 text-amber-700 border-amber-500/30';
  if (['rejected', 'suspended', 'banned'].includes(s)) return 'bg-red-500/15 text-red-700 border-red-500/30';
  return 'bg-muted text-muted-foreground border-border';
};

const fmt = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v)) return v.length ? `${v.length} item(s)` : '—';
  if (typeof v === 'object') return null; // rendered as nested
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) { const d = new Date(s); if (!isNaN(d.getTime())) return d.toLocaleString(); }
  return s;
};

const HIDE_KEYS = new Set(['full', 'hashed_password', 'password', 'session_token', '_id']);

const FullDataGrid = ({ data }) => {
  const entries = Object.entries(data || {}).filter(([k]) => !HIDE_KEYS.has(k));
  return (
    <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
      {entries.map(([k, v]) => {
        const scalar = fmt(v);
        return (
          <div key={k} className="flex flex-col border-b border-border/40 py-1">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">{k.replace(/_/g, ' ')}</span>
            {scalar !== null ? (
              <span className="text-foreground break-words">{scalar}</span>
            ) : (
              <pre className="text-xs bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap break-words">{JSON.stringify(v, null, 2)}</pre>
            )}
          </div>
        );
      })}
    </div>
  );
};

const OrderHistoryDialog = ({ open, onClose, record, category }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState('order');

  useEffect(() => {
    if (!open || !record) return;
    setLoading(true);
    axios.get(`${API}/admin/records/${category}/${record.id}/orders`, { headers: authHeaders() })
      .then((res) => { setOrders(res.data.orders || []); setType(res.data.type || 'order'); })
      .catch(() => toast.error('Failed to load order history'))
      .finally(() => setLoading(false));
  }, [open, record, category]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" data-testid="order-history-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" /> {type === 'rental' ? 'Rental Bookings' : 'Order History'} — {record?.name || record?.id}
          </DialogTitle>
          <DialogDescription>Full order/booking history associated with this record.</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="py-10 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
        ) : orders.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground" data-testid="order-history-empty">No {type === 'rental' ? 'bookings' : 'orders'} found for this record.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{orders.length} record(s)</p>
            {orders.map((o) => (
              <div key={o.id} className="p-3 rounded-lg border border-border bg-muted/30" data-testid={`order-row-${o.id}`}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="font-mono text-xs text-muted-foreground">#{(o.id || '').slice(0, 8)}</span>
                    <span className="ml-2 font-medium">{o.service_type || 'order'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={statusBadge(o.status)}>{o.status || o.payment_status || '—'}</Badge>
                    <span className="font-semibold">${Number(o.total ?? o.total_cost ?? 0).toFixed(2)}</span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {(o.created_at ? new Date(o.created_at).toLocaleString() : '')}
                  {o.payment_status ? ` · ${o.payment_status}` : ''}
                  {typeof o.items?.length === 'number' ? ` · ${o.items.length} item(s)` : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const DocumentsDialog = ({ open, onClose, record, category }) => {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mediaToken, setMediaToken] = useState(null);

  const urlFor = (d) => {
    const t = mediaToken || token();
    return d.kind === 'driver_doc'
      ? `${API}/drivers/documents/${d.document_id}/download?auth=${encodeURIComponent(t)}`
      : d.kind === 'business_doc'
      ? `${API}/business/documents/${d.document_id}/download?auth=${encodeURIComponent(t)}`
      : (d.url || '');
  };

  useEffect(() => {
    if (!open || !record) return;
    setLoading(true);
    // Mint a short-lived media token so document URLs don't carry a long-lived login JWT.
    axios.post(`${API}/auth/media-token`, {}, { headers: authHeaders() })
      .then((res) => setMediaToken(res.data.token))
      .catch(() => setMediaToken(null));
    axios.get(`${API}/admin/records/${category}/${record.id}/documents`, { headers: authHeaders() })
      .then((res) => setDocs(res.data.documents || []))
      .catch(() => toast.error('Failed to load documents'))
      .finally(() => setLoading(false));
  }, [open, record, category]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" data-testid="documents-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" /> Documents — {record?.name || record?.id}
          </DialogTitle>
          <DialogDescription>Uploaded application documents. Click a thumbnail to open it in a new tab.</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="py-10 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
        ) : docs.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground" data-testid="documents-empty">No documents were submitted with this application.</p>
        ) : (
          (() => {
            const renderCard = (d, i) => {
              const url = urlFor(d);
              const label = d.doc_type || d.label || d.filename || `Document ${i + 1}`;
              return (
                <a
                  key={d.document_id || d.url || i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group border border-border rounded-lg overflow-hidden hover:border-gold-500 transition-colors"
                  data-testid={`document-item-${i}`}
                  title="Open in new tab"
                >
                  <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden">
                    {d.is_image ? (
                      <img src={url} alt={label} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <FileText className="h-10 w-10 text-muted-foreground" />
                    )}
                  </div>
                  <div className="p-2 flex items-center justify-between gap-1">
                    <span className="text-xs font-medium capitalize truncate">{String(label).replace(/_/g, ' ')}</span>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-gold-500 shrink-0" />
                  </div>
                </a>
              );
            };
            const merchantDocs = docs.filter((d) => d.group === 'merchant');
            const accountDocs = docs.filter((d) => d.group === 'user_account');
            const ungrouped = docs.filter((d) => d.group !== 'merchant' && d.group !== 'user_account');
            const Section = ({ title, subtitle, items, testid }) => (
              <div className="space-y-2" data-testid={testid}>
                <div>
                  <h4 className="text-sm font-semibold">{title}</h4>
                  <p className="text-xs text-muted-foreground">{subtitle}</p>
                </div>
                {items.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-3" data-testid={`${testid}-empty`}>None submitted.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">{items.map(renderCard)}</div>
                )}
              </div>
            );
            return (
              <div className="space-y-6">
                {category !== 'drivers' && (
                  <Section
                    title="Merchant / Restaurant Documents"
                    subtitle="Business Registration, Health Permits, Store Photos, etc."
                    items={merchantDocs}
                    testid="documents-section-merchant"
                  />
                )}
                <Section
                  title="User Account Documents"
                  subtitle="Personal ID and Driver's License of the owner / applicant."
                  items={accountDocs}
                  testid="documents-section-account"
                />
                {ungrouped.length > 0 && (
                  <Section title="Other Documents" subtitle="" items={ungrouped} testid="documents-section-other" />
                )}
              </div>
            );
          })()
        )}
      </DialogContent>
    </Dialog>
  );
};

const AdminApprovals = () => {
  const [active, setActive] = useState('businesses');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [records, setRecords] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [historyRec, setHistoryRec] = useState(null);
  const [docsRec, setDocsRec] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [readyOnly, setReadyOnly] = useState(false);

  const isReady = useCallback((rec) => {
    const ds = rec.doc_summary;
    if (!ds) return true; // users / no summary — don't penalise
    if (active === 'drivers') return ds.total > 0;
    return ds.merchant_count > 0 && ds.has_account_doc;
  }, [active]);

  const displayRecords = React.useMemo(() => {
    const list = readyOnly ? records.filter(isReady) : [...records];
    // Incomplete applications sink to the bottom; keep API order otherwise (newest first).
    return list.sort((a, b) => (isReady(a) === isReady(b) ? 0 : isReady(a) ? -1 : 1));
  }, [records, readyOnly, isReady]);

  const load = useCallback(async (category, q, status) => {
    setLoading(true);
    try {
      const params = {};
      if (q) params.q = q;
      if (status && status !== 'all') params.status = status;
      const res = await axios.get(`${API}/admin/records/${category}`, { headers: authHeaders(), params });
      setRecords(res.data.records || []);
      setCounts((c) => ({ ...c, [category]: res.data.count }));
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to load records');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { setExpanded(null); setQuery(''); load(active, '', statusFilter); }, [active, statusFilter, load]);

  const doApproval = async (kind, id, action) => {
    setBusyId(id);
    try {
      await axios.post(`${API}/admin/${APPROVE_EP[kind]}/${id}/${action}`, { notes: '' }, { headers: authHeaders() });
      toast.success(`${action === 'approve' ? 'Approved' : 'Rejected'} successfully`);
      load(active, query, statusFilter);
    } catch (e) {
      toast.error(e?.response?.data?.detail || `Failed to ${action}`);
    } finally {
      setBusyId(null);
    }
  };

  const setUserStatus = async (rec, status) => {
    setBusyId(rec.id);
    try {
      await axios.post(`${API}/admin/users/${rec.id}/set-status`, { status }, { headers: authHeaders() });
      toast.success(status === 'active' ? 'Account approved (active)' : `Account ${status}`);
      load(active, query, statusFilter);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to update account');
    } finally {
      setBusyId(null);
    }
  };

  const impersonate = async (rec) => {
    if (!rec.user_id) { toast.error('External lead — no account to view yet.'); return; }
    setBusyId(rec.id);
    try {
      const res = await axios.post(`${API}/admin/impersonate/${rec.user_id}`, {}, { headers: authHeaders() });
      localStorage.setItem('impersonator_token', token());
      localStorage.setItem('impersonating_name', rec.name || 'user');
      localStorage.setItem('token', res.data.token);
      window.location.href = '/';
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not open portal');
      setBusyId(null);
    }
  };

  const repairDriver = async (rec) => {
    setBusyId(rec.id);
    try {
      const res = await axios.post(`${API}/admin/users/${rec.id}/repair-driver-profile`, {}, { headers: authHeaders() });
      toast.success(res.data?.message || 'Driver profile repaired — check Driver Applications.');
      load(active, query, statusFilter);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not repair driver profile');
    } finally {
      setBusyId(null);
    }
  };

  const activeCat = CATEGORIES.find((c) => c.key === active);

  return (
    <div className="space-y-4" data-testid="admin-approvals-section">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ClipboardList className="h-5 w-5" /> Partner Approvals
          </h2>
          <p className="text-sm text-muted-foreground">Review and process new partner applications. Order history lives in each record — separate from the Orders tab.</p>
        </div>
        {/* New vs All toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant={readyOnly ? 'default' : 'outline'}
            onClick={() => setReadyOnly((v) => !v)}
            data-testid="approvals-ready-toggle"
            aria-pressed={readyOnly}
            title="Show only applications with complete documents"
          >
            <CheckCircle className="h-4 w-4 mr-2" />Ready to approve
          </Button>
          <div className="flex items-center gap-1 rounded-lg border border-border p-1" data-testid="approvals-status-filter">
            {[['pending', 'New Applications'], ['all', 'All Records']].map(([val, label]) => (
              <Button
                key={val}
                size="sm"
                variant={statusFilter === val ? 'default' : 'ghost'}
                onClick={() => setStatusFilter(val)}
                aria-pressed={statusFilter === val}
                data-testid={`approvals-status-${val}`}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Category sub-tabs (application-type filters) */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          return (
            <Button
              key={c.key}
              variant={active === c.key ? 'default' : 'outline'}
              onClick={() => { setActive(c.key); setStatusFilter(defaultStatusFor(c.key)); }}
              data-testid={`approvals-cat-${c.key}`}
              size="sm"
            >
              <Icon className="h-4 w-4 mr-2" />{c.label}
              {counts[c.key] !== undefined && <Badge variant="secondary" className="ml-2">{counts[c.key]}</Badge>}
            </Button>
          );
        })}
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={`Search ${activeCat?.label.toLowerCase()}...`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load(active, query, statusFilter)}
            data-testid="approvals-search-input"
          />
        </div>
        <Button variant="outline" onClick={() => load(active, query, statusFilter)} disabled={loading} data-testid="approvals-refresh">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      {/* Records */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : displayRecords.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground" data-testid="approvals-empty">
              {readyOnly
                ? `No "ready to approve" ${activeCat?.label.toLowerCase()} — all pending items are missing documents.`
                : statusFilter === 'pending'
                  ? `No new ${activeCat?.label.toLowerCase()} awaiting approval. Switch to "All Records" to see existing ones.`
                  : `No ${activeCat?.label.toLowerCase()} found.`}
            </p>
          ) : (
            <div className="divide-y divide-border">
              {displayRecords.map((rec) => {
                const isPending = PENDING_STATUSES.includes((rec.status || '').toLowerCase());
                const isOpen = expanded === rec.id;
                return (
                  <div key={rec.id} data-testid={`record-${active}-${rec.id}`}>
                    <div className="flex items-center gap-3 p-4 hover:bg-muted/30">
                      <button
                        onClick={() => setExpanded(isOpen ? null : rec.id)}
                        className="text-muted-foreground shrink-0"
                        data-testid={`record-toggle-${rec.id}`}
                        aria-label="Expand"
                      >
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">{rec.name || rec.id}</span>
                          <Badge className={statusBadge(rec.status)} data-testid={`record-status-${rec.id}`}>{rec.status || '—'}</Badge>
                          {rec.is_external_lead && <Badge variant="secondary">Website lead</Badge>}
                          {rec.featured && <Badge className="bg-gold-500/15 text-gold-700 border-gold-500/30">Featured</Badge>}
                          {active !== 'users' && rec.doc_summary && (
                            rec.doc_summary.total === 0 ? (
                              <Badge variant="outline" className="border-amber-500/40 text-amber-600 gap-1" data-testid={`record-docbadge-${rec.id}`}>
                                <AlertTriangle className="h-3 w-3" />No docs
                              </Badge>
                            ) : (
                              <span className="inline-flex items-center gap-1" data-testid={`record-docbadge-${rec.id}`}>
                                <Badge variant="outline" className="border-green-500/40 text-green-600 gap-1">
                                  <CheckCircle className="h-3 w-3" />{rec.doc_summary.total} docs
                                </Badge>
                                {active !== 'drivers' && !rec.doc_summary.has_account_doc && (
                                  <Badge variant="outline" className="border-amber-500/40 text-amber-600 gap-1" title="Owner's personal ID / licence not uploaded">
                                    <AlertTriangle className="h-3 w-3" />Missing ID
                                  </Badge>
                                )}
                              </span>
                            )
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                          {rec.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{rec.email}</span>}
                          {rec.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{rec.phone}</span>}
                          {rec.subtitle && <span>{rec.subtitle}</span>}
                          {rec.created_at && <span>Joined {new Date(rec.created_at).toLocaleDateString()}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button size="sm" variant="outline" onClick={() => setHistoryRec(rec)} data-testid={`record-orders-${rec.id}`}>
                          <Receipt className="h-4 w-4 mr-1" />Orders
                        </Button>
                        {(active === 'drivers' || active === 'businesses') && (
                          <Button size="sm" variant="outline" onClick={() => setDocsRec(rec)} data-testid={`record-docs-${rec.id}`}>
                            <FolderOpen className="h-4 w-4 mr-1" />Docs
                          </Button>
                        )}
                        {rec.user_id && (
                          <Button size="sm" variant="outline" disabled={busyId === rec.id} onClick={() => impersonate(rec)} data-testid={`record-portal-${rec.id}`}>
                            {busyId === rec.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                          </Button>
                        )}
                        {isPending && activeCat?.approveKind && (
                          <>
                            <Button size="sm" className="bg-green-600 hover:bg-green-700" disabled={busyId === rec.id} onClick={() => doApproval(activeCat.approveKind, rec.id, 'approve')} data-testid={`record-approve-${rec.id}`}>
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="destructive" disabled={busyId === rec.id} onClick={() => doApproval(activeCat.approveKind, rec.id, 'reject')} data-testid={`record-reject-${rec.id}`}>
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {active === 'users' && (
                          <>
                            {rec.full?.user_type === 'driver' && (
                              <Button size="sm" variant="outline" className="text-blue-700 border-blue-300 hover:bg-blue-50" title="Repair driver profile (creates a pending driver application if one is missing)" disabled={busyId === rec.id} onClick={() => repairDriver(rec)} data-testid={`record-repair-driver-${rec.id}`}>
                                {busyId === rec.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
                              </Button>
                            )}
                            {(rec.status || 'active') !== 'active' && (
                              <Button size="sm" className="bg-green-600 hover:bg-green-700" title="Approve (set active)" disabled={busyId === rec.id} onClick={() => setUserStatus(rec, 'active')} data-testid={`record-approve-user-${rec.id}`}>
                                <UserCheck className="h-4 w-4" />
                              </Button>
                            )}
                            {(rec.status || 'active') !== 'paused' && (
                              <Button size="sm" variant="outline" className="text-amber-700 border-amber-300 hover:bg-amber-50" title="Pause account" disabled={busyId === rec.id} onClick={() => setUserStatus(rec, 'paused')} data-testid={`record-pause-user-${rec.id}`}>
                                <PauseCircle className="h-4 w-4" />
                              </Button>
                            )}
                            {(rec.status || 'active') !== 'restricted' && (
                              <Button size="sm" variant="destructive" title="Restrict account" disabled={busyId === rec.id} onClick={() => setUserStatus(rec, 'restricted')} data-testid={`record-restrict-user-${rec.id}`}>
                                <ShieldOff className="h-4 w-4" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    {isOpen && (
                      <div className="px-4 pb-4 pt-1 bg-muted/20" data-testid={`record-detail-${rec.id}`}>
                        <FullDataGrid data={rec.full} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <OrderHistoryDialog
        open={!!historyRec}
        onClose={() => setHistoryRec(null)}
        record={historyRec}
        category={active}
      />

      <DocumentsDialog
        open={!!docsRec}
        onClose={() => setDocsRec(null)}
        record={docsRec}
        category={active}
      />
    </div>
  );
};

export default AdminApprovals;
