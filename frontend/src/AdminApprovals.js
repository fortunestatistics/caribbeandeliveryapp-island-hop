import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Card, CardContent } from './components/ui/card';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { Input } from './components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './components/ui/dialog';
import {
  Store, Car, Truck, Building2, Users, Search, RefreshCw, ChevronDown, ChevronRight,
  CheckCircle, X, Receipt, Loader2, Mail, Phone, LogIn,
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const token = () => localStorage.getItem('token');
const authHeaders = () => ({ Authorization: `Bearer ${token()}` });

const CATEGORIES = [
  { key: 'restaurants', label: 'Restaurants', icon: Store, approveKind: 'restaurant' },
  { key: 'drivers', label: 'Drivers', icon: Truck, approveKind: 'driver' },
  { key: 'car_rentals', label: 'Car Rental Companies', icon: Car, approveKind: 'car_rental' },
  { key: 'businesses', label: 'Business Storefronts', icon: Building2, approveKind: 'business' },
  { key: 'users', label: 'User Accounts', icon: Users, approveKind: null },
];

const APPROVE_EP = { driver: 'drivers', restaurant: 'restaurants', car_rental: 'car-rentals', business: 'businesses' };
const PENDING_STATUSES = ['pending', 'pending_approval'];

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

const AdminApprovals = () => {
  const [active, setActive] = useState('restaurants');
  const [records, setRecords] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [historyRec, setHistoryRec] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async (category, q) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/records/${category}`, { headers: authHeaders(), params: q ? { q } : {} });
      setRecords(res.data.records || []);
      setCounts((c) => ({ ...c, [category]: res.data.count }));
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to load records');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { setExpanded(null); load(active, ''); setQuery(''); }, [active, load]);

  const doApproval = async (kind, id, action) => {
    setBusyId(id);
    try {
      await axios.post(`${API}/admin/${APPROVE_EP[kind]}/${id}/${action}`, { notes: '' }, { headers: authHeaders() });
      toast.success(`${action === 'approve' ? 'Approved' : 'Rejected'} successfully`);
      load(active, query);
    } catch (e) {
      toast.error(e?.response?.data?.detail || `Failed to ${action}`);
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

  const activeCat = CATEGORIES.find((c) => c.key === active);

  return (
    <div className="space-y-4" data-testid="admin-approvals-section">
      {/* Category sub-tabs */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          return (
            <Button
              key={c.key}
              variant={active === c.key ? 'default' : 'outline'}
              onClick={() => setActive(c.key)}
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
            onKeyDown={(e) => e.key === 'Enter' && load(active, query)}
            data-testid="approvals-search"
          />
        </div>
        <Button variant="outline" onClick={() => load(active, query)} disabled={loading} data-testid="approvals-refresh">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      {/* Records */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : records.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground" data-testid="approvals-empty">No {activeCat?.label.toLowerCase()} found.</p>
          ) : (
            <div className="divide-y divide-border">
              {records.map((rec) => {
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
    </div>
  );
};

export default AdminApprovals;
