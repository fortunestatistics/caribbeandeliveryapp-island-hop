import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { portalPathForRole } from './authToken';
import { RATE_TTD_PER_USD } from './CurrencyContext';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Textarea } from './components/ui/textarea';
import { Label } from './components/ui/label';
import { Badge } from './components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './components/ui/dialog';
import { toast } from 'sonner';
import AnalyticsPromotions from './AnalyticsPromotions';
import { 
  Users, 
  DollarSign, 
  TrendingUp,
  Package,
  ShoppingCart,
  Truck,
  AlertCircle,
  CheckCircle,
  X,
  Search,
  Filter,
  Download,
  Settings,
  Ban,
  UserCheck,
  Eye,
  MapPin,
  MessageSquare,
  Send,
  Trash2,
  FileText,
  Mail,
  User as UserIcon,
  CreditCard,
  Banknote,
  AlertTriangle,
  PauseCircle,
  ShieldOff,
  ExternalLink,
  Plus
} from 'lucide-react';
import axios from 'axios';

import AdminStatsCards from './AdminStatsCards';
import AdminMailInbox from './AdminMailInbox';
import AdminWalletRequests from './AdminWalletRequests';
import AdminMercuryBanking from './AdminMercuryBanking';
import AdminTeam from './AdminTeam';
import AdminDriverIncentives from './AdminDriverIncentives';
import AdminPromoters from './AdminPromoters';
import AdminApprovals from './AdminApprovals';
import IncompleteApplications from './IncompleteApplications';
import AdminPayouts from './AdminPayouts';
import AdminPaymentMode from './AdminPaymentMode';
import AdminDataCleanup from './AdminDataCleanup';
import AdminWhatsApp from './AdminWhatsApp';
import AdminServiceZones from './AdminServiceZones';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

// Mirrors backend graph_mail.is_real_email — flags system/QA placeholder addresses.
const PLACEHOLDER_PREFIXES = ['id_start_', 'id_noapp_', 'id_session_', 'id_kyc_', 'sched_test_', 'resto_test_', 'driver_test_', 'qa_test_'];
const PLACEHOLDER_DOMAINS = ['test.com', 'example.com', 'example.org', 'example.net', 'test.test'];
const isPlaceholderEmail = (email) => {
  if (!email || typeof email !== 'string') return true;
  const addr = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) return true;
  const [local, domain] = addr.split('@');
  if (PLACEHOLDER_DOMAINS.includes(domain)) return true;
  return PLACEHOLDER_PREFIXES.some((p) => local.startsWith(p));
};

const money = (v) => `TT$${(Number(v || 0) * RATE_TTD_PER_USD).toFixed(2)}`;

const DOC_LABELS = {
  driversLicense: "Driver's License",
  vehicleRegistration: 'Vehicle Registration',
  insurance: 'Insurance',
  profilePhoto: 'Profile Photo',
};

const AdminPanel = () => {
  const navigate = useNavigate();
  const { impersonate } = useAuth();

  const openClientPortal = async (user) => {
    if (!window.confirm(`Open ${user.name || user.email}'s portal in edit mode? You'll be able to view, fix, connect or adjust their account as them. Use "Exit" to return to admin.`)) return;
    try {
      const target = await impersonate(user.id, user.name || user.email, true);
      navigate(portalPathForRole(target?.user_type || user.user_type));
    } catch (e) {
      alert(e?.response?.data?.detail || 'Could not open client portal');
    }
  };
  const [stats, setStats] = useState({
    total_users: 0,
    total_orders: 0,
    total_revenue: 0,
    active_drivers: 0,
    active_vendors: 0,
    pending_verifications: 0
  });
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [approvals, setApprovals] = useState({ drivers: [], restaurants: [], car_rentals: [], businesses: [], total: 0 });
  const [fraudFlags, setFraudFlags] = useState([]);
  const [fraudOpenCount, setFraudOpenCount] = useState(0);
  const [fraudFilter, setFraudFilter] = useState('open');
  const [claims, setClaims] = useState([]);
  const [claimsFilter, setClaimsFilter] = useState('open');
  const [claimsOpenCount, setClaimsOpenCount] = useState(0);
  const [userTypeFilter, setUserTypeFilter] = useState('all');
  const [safetySub, setSafetySub] = useState('fraud');
  const [growthSub, setGrowthSub] = useState('team');
  const [financeSub, setFinanceSub] = useState('wallet');
  const [selectedTab, setSelectedTab] = useState('overview');
  const [myRole, setMyRole] = useState('admin');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Message-a-user dialog
  const [msgUser, setMsgUser] = useState(null);
  const [msgSubject, setMsgSubject] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [msgSending, setMsgSending] = useState(false);
  const [msgFeedback, setMsgFeedback] = useState(null); // {type, text}
  // Order detail + approval detail dialogs
  const [detailOrder, setDetailOrder] = useState(null);
  const [detailApproval, setDetailApproval] = useState(null);
  const [detailClaim, setDetailClaim] = useState(null);
  const [detailFraud, setDetailFraud] = useState(null);
  // Customer profile dialog
  const [profileUser, setProfileUser] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileDocs, setProfileDocs] = useState(null);
  const [docsReviewed, setDocsReviewed] = useState(false);
  const [docActionBusy, setDocActionBusy] = useState(false);
  // Driver cash-outstanding (COD reconciliation)
  const [cashOutstanding, setCashOutstanding] = useState(null);
  // End-of-day settlements (merchants + drivers)
  const [settlementBatches, setSettlementBatches] = useState([]);
  const [settling, setSettling] = useState(false);

  useEffect(() => {
    fetchStats();
    fetchUsers();
    fetchOrders();
    fetchDisputes();
    fetchApprovals();
    // Lightweight fetch of fraud count for tab badge (silent on failure)
    axios
      .get(`${API}/admin/fraud-queue?status=open&limit=1`, { headers: authHeaders() })
      .then((r) => setFraudOpenCount(r.data?.open_count || 0))
      .catch(() => {});
    axios
      .get(`${API}/admin/claims?status=open&limit=500`, { headers: authHeaders() })
      .then((r) => setClaimsOpenCount(Array.isArray(r.data) ? r.data.length : 0))
      .catch(() => {});
    // eslint-disable-next-line -- initial data load on mount only
  }, []);

  useEffect(() => {
    if (selectedTab === 'approvals') fetchApprovals();
    if (selectedTab === 'safety') {
      if (safetySub === 'fraud' && myRole !== 'agent') fetchFraudQueue();
      if (safetySub === 'claims') fetchClaims();
      if (safetySub === 'disputes') fetchDisputes();
    }
    if (selectedTab === 'orders') fetchCashOutstanding();
    if (selectedTab === 'orders') fetchSettlements();
    // eslint-disable-next-line -- fetchers are stable; re-run only on tab/filter change
  }, [selectedTab, safetySub, financeSub, fraudFilter, claimsFilter]);

  // Agents cannot see the Fraud sub-tab; default them to Claims.
  useEffect(() => {
    if (myRole === 'agent' && safetySub === 'fraud') setSafetySub('claims');
  }, [myRole, safetySub]);

  const fetchCashOutstanding = async () => {
    try {
      const r = await axios.get(`${API}/admin/drivers/cash-outstanding`, { headers: authHeaders(), withCredentials: true });
      setCashOutstanding(r.data);
    } catch (e) { setCashOutstanding(null); }
  };

  const settleDriverCash = async (driverId) => {
    if (!window.confirm('Mark this driver\'s outstanding cash as settled (remitted)?')) return;
    try {
      await axios.post(`${API}/admin/drivers/${driverId}/settle-cash`, {}, { headers: authHeaders(), withCredentials: true });
      fetchCashOutstanding();
    } catch (e) { alert(e.response?.data?.detail || 'Failed to settle'); }
  };

  const fetchSettlements = async () => {
    try {
      const r = await axios.get(`${API}/admin/settlements?limit=10`, { headers: authHeaders(), withCredentials: true });
      setSettlementBatches(r.data?.batches || []);
    } catch (e) { setSettlementBatches([]); }
  };

  const runSettlement = async () => {
    if (!window.confirm('Run settlement now? This credits merchant payouts and driver earnings to their wallets (netting any cash owed) and queues external payouts.')) return;
    setSettling(true);
    try {
      const r = await axios.post(`${API}/admin/settlements/run`, {}, { headers: authHeaders(), withCredentials: true });
      const b = r.data?.batch || {};
      alert(`Settlement complete — ${b.merchants_settled || 0} merchant(s) (${money(b.merchants_total)}) and ${b.drivers_settled || 0} driver(s) (${money(b.drivers_total)}) settled.`);
      fetchSettlements();
      fetchCashOutstanding();
    } catch (e) { alert(e.response?.data?.detail || 'Failed to run settlement'); }
    finally { setSettling(false); }
  };

  useEffect(() => {
    axios.get(`${API}/auth/me`, { headers: authHeaders() })
      .then((r) => setMyRole(r.data.user_type))
      .catch(() => {});
  }, []);

  // Server-side user search (debounced) so admins can find any user, not just page 1.
  useEffect(() => {
    if (selectedTab !== 'users') return;
    const t = setTimeout(() => fetchUsers(searchQuery), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line -- debounced fetch; fetchUsers is stable
  }, [searchQuery, selectedTab, userTypeFilter]);

  const ADMIN_TABS = ['overview', 'users', 'orders', 'payouts', 'approvals', 'safety', 'wallet', 'team', 'mail', 'whatsapp', 'analytics', 'cleanup'];
  const AGENT_TABS = ['overview', 'safety', 'mail'];
  const visibleTabs = myRole === 'agent' ? AGENT_TABS : ADMIN_TABS;
  const TAB_LABELS = { safety: 'Safety & Disputes', wallet: 'Finance & Zones', team: 'Team & Growth', payouts: 'Payouts' };

  const fetchClaims = async () => {
    try {
      const res = await axios.get(`${API}/admin/claims?status=${claimsFilter}`, { headers: authHeaders() });
      setClaims(res.data || []);
    } catch (e) {
      console.error('Failed to fetch claims:', e);
    }
  };

  const handleClaimResolve = async (claimId, resolution, creditAmount = null) => {
    const verb = resolution === 'approved' ? 'approve' : 'reject';
    let credit = creditAmount;
    if (resolution === 'approved' && credit === null) {
      const raw = window.prompt('Credit amount to refund to customer wallet (USD)? Leave blank for $0.', '0');
      if (raw === null) return; // cancelled
      credit = parseFloat(raw) || 0;
    }
    if (!window.confirm(`Are you sure you want to ${verb} this claim${credit ? ` and credit ${money(credit)}` : ''}?`)) return;
    try {
      await axios.post(
        `${API}/claims/${claimId}/resolve`,
        { resolution, credit_amount: credit || 0, notes: '' },
        { headers: authHeaders() }
      );
      fetchClaims();
    } catch (e) {
      alert(e.response?.data?.detail || `Failed to ${verb} claim`);
    }
  };

  const fetchFraudQueue = async () => {
    try {
      const res = await axios.get(`${API}/admin/fraud-queue?status=${fraudFilter}`, { headers: authHeaders() });
      setFraudFlags(res.data.flags || []);
      setFraudOpenCount(res.data.open_count || 0);
    } catch (e) {
      console.error('Failed to fetch fraud queue:', e);
    }
  };

  const handleFraudReview = async (flagId, action) => {
    const verb = action === 'clear' ? 'clear' : 'confirm';
    const confirmMsg = action === 'confirm'
      ? 'Confirm fraud? This will cancel the order and suspend the customer.'
      : 'Clear this flag as safe?';
    if (!window.confirm(confirmMsg)) return;
    try {
      await axios.post(
        `${API}/admin/fraud-queue/${flagId}/review`,
        { action: verb, notes: '' },
        { headers: authHeaders() }
      );
      fetchFraudQueue();
    } catch (e) {
      alert(e.response?.data?.detail || `Failed to ${verb} flag`);
    }
  };

  const fetchApprovals = async () => {
    try {
      const res = await axios.get(`${API}/admin/pending-approvals`, { headers: authHeaders() });
      setApprovals(res.data);
    } catch (e) { console.error(e); }
  };

  const handleApproval = async (kind, id, action) => {
    const ep = {
      driver: 'drivers',
      restaurant: 'restaurants',
      car_rental: 'car-rentals',
      business: 'businesses',
    }[kind];
    try {
      await axios.post(`${API}/admin/${ep}/${id}/${action}`, { notes: '' }, { headers: authHeaders() });
      fetchApprovals();
    } catch (e) {
      alert(e.response?.data?.detail || `Failed to ${action} ${kind}`);
    }
  };

  const viewDocument = async (documentId) => {
    try {
      const res = await axios.get(`${API}/drivers/documents/${documentId}/download`, {
        headers: authHeaders(),
        responseType: 'blob',
      });
      const blobUrl = URL.createObjectURL(res.data);
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (e) {
      alert(e.response?.data?.detail || 'Could not open document');
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/admin/stats`, {
        headers: authHeaders(), withCredentials: true
      });
      setStats(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching stats:', error);
      setLoading(false);
    }
  };

  const fetchUsers = async (search) => {
    try {
      const params = new URLSearchParams();
      if (search && search.trim()) params.set('q', search.trim());
      if (userTypeFilter && userTypeFilter !== 'all') params.set('user_type', userTypeFilter);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const response = await axios.get(`${API}/admin/users${qs}`, {
        headers: authHeaders(), withCredentials: true
      });
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchOrders = async () => {
    try {
      const response = await axios.get(`${API}/admin/orders`, {
        headers: authHeaders(), withCredentials: true
      });
      setOrders(response.data);
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  const fetchDisputes = async () => {
    try {
      const response = await axios.get(`${API}/admin/disputes`, {
        headers: authHeaders(), withCredentials: true
      });
      setDisputes(response.data);
    } catch (error) {
      console.error('Error fetching disputes:', error);
    }
  };

  const handleUserAction = async (userId, action) => {
    try {
      await axios.post(`${API}/admin/users/${userId}/${action}`, {}, {
        headers: authHeaders(), withCredentials: true
      });
      fetchUsers();
    } catch (error) {
      console.error(`Error ${action} user:`, error);
      alert(`Failed to ${action} user`);
    }
  };

  const handleSetUserStatus = async (userId, status) => {
    try {
      await axios.post(`${API}/admin/users/${userId}/set-status`, { status }, {
        headers: authHeaders(), withCredentials: true
      });
      fetchUsers(searchQuery);
    } catch (error) {
      alert(error?.response?.data?.detail || `Failed to set status to ${status}`);
    }
  };

  const openMessageUser = (user) => {
    setMsgUser(user);
    setMsgSubject('');
    setMsgBody('');
    setMsgFeedback(null);
  };

  const sendUserMessage = async () => {
    if (!msgUser || !msgSubject.trim() || !msgBody.trim()) return;
    setMsgSending(true);
    setMsgFeedback(null);
    try {
      const r = await axios.post(
        `${API}/admin/users/${msgUser.id}/message`,
        { subject: msgSubject.trim(), body: msgBody.trim() },
        { headers: authHeaders(), withCredentials: true }
      );
      setMsgFeedback({ type: 'success', text: `Email sent to ${r.data.sent_to}` });
      setMsgSubject('');
      setMsgBody('');
    } catch (e) {
      setMsgFeedback({ type: 'error', text: e.response?.data?.detail || 'Failed to send message' });
    } finally {
      setMsgSending(false);
    }
  };

  const userByEmail = (email) => users.find((u) => u.email && email && u.email.toLowerCase() === email.toLowerCase());
  const customerForOrder = (order) => order && users.find((u) => u.id === order.customer_id);

  const openUserProfile = async (user) => {
    setProfileUser(user);
    setProfileData(null);
    setProfileDocs(null);
    setDocsReviewed(false);
    setProfileLoading(true);
    try {
      const r = await axios.get(`${API}/admin/users/${user.id}/profile`, { headers: authHeaders(), withCredentials: true });
      setProfileData(r.data);
    } catch (e) {
      setProfileData({ error: e.response?.data?.detail || 'Failed to load profile' });
    } finally {
      setProfileLoading(false);
    }
    // Load documents + linked applicant record (non-blocking)
    try {
      const d = await axios.get(`${API}/admin/users/${user.id}/documents`, { headers: authHeaders(), withCredentials: true });
      setProfileDocs(d.data);
    } catch (e) {
      setProfileDocs({ documents: [], applicant: null });
    }
  };

  const APPLICANT_APPROVE_EP = { driver: 'drivers', restaurant: 'restaurants', business: 'businesses' };

  const handleApplicantApproval = async (applicant, action) => {
    if (!applicant?.record_id) return;
    setDocActionBusy(true);
    try {
      await axios.post(`${API}/admin/${APPLICANT_APPROVE_EP[applicant.kind]}/${applicant.record_id}/${action}`, { notes: '' }, { headers: authHeaders(), withCredentials: true });
      toast.success(`Applicant ${action === 'approve' ? 'approved' : 'rejected'}`);
      setProfileUser(null); setProfileData(null); setProfileDocs(null);
      fetchUsers(searchQuery);
    } catch (e) {
      toast.error(e?.response?.data?.detail || `Failed to ${action}`);
    } finally {
      setDocActionBusy(false);
    }
  };


  const handleOrderAction = async (orderId, action) => {
    try {
      await axios.post(`${API}/admin/orders/${orderId}/${action}`, {}, {
        headers: authHeaders(), withCredentials: true
      });
      fetchOrders();
    } catch (error) {
      console.error(`Error ${action} order:`, error);
      alert(`Failed to ${action} order`);
    }
  };

  const handleExportData = (type) => {
    // In production, generate CSV/Excel
    alert(`Exporting ${type} data...`);
  };

  // The server already filters users by name/email/phone (see fetchUsers → /admin/users?q=),
  // so trust its results directly — re-filtering client-side on name/email only would hide
  // valid phone-number matches.
  const filteredUsers = users;

  const filteredOrders = orders.filter(order =>
    order.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.customer_phone?.includes(searchQuery)
  );

  const orderStatusBadgeCls = (status) => {
    const map = {
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return map[status] || 'bg-neon-cyan/15 text-teal-700';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-500/30"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Admin Panel</h1>
              <p className="text-muted-foreground">Platform management & analytics</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate('/profile')} data-testid="admin-settings-link">
                <Settings className="h-5 w-5 mr-2" />
                Settings
              </Button>
            </div>
          </div>

          {/* Stats Overview */}
          {myRole !== 'agent' && <AdminStatsCards stats={stats} />}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {visibleTabs.map((tab) => (
            <Button
              key={tab}
              variant={selectedTab === tab ? 'default' : 'outline'}
              onClick={() => setSelectedTab(tab)}
              data-testid={`admin-tab-${tab}`}
            >
              {TAB_LABELS[tab] || (tab.charAt(0).toUpperCase() + tab.slice(1))}
              {tab === 'approvals' && ((approvals.drivers?.length || 0) + (approvals.restaurants?.length || 0) + (approvals.businesses?.length || 0)) > 0 && (
                <Badge className="ml-2 bg-amber-500 text-white hover:bg-amber-500" data-testid="approvals-pending-badge">
                  {(approvals.drivers?.length || 0) + (approvals.restaurants?.length || 0) + (approvals.businesses?.length || 0)}
                </Badge>
              )}
              {tab === 'safety' && (fraudOpenCount + claimsOpenCount) > 0 && (
                <Badge variant="destructive" className="ml-2">{fraudOpenCount + claimsOpenCount}</Badge>
              )}
            </Button>
          ))}
        </div>

        {/* Search & Filters */}
        {(selectedTab === 'users' || selectedTab === 'orders') && (
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground/70" />
                  <Input
                    placeholder={selectedTab === 'users' ? 'Search by name, email or phone…' : `Search ${selectedTab}...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid={`admin-${selectedTab}-search-input`}
                  />
                </div>
                <Button variant="outline">
                  <Filter className="h-5 w-5 mr-2" />
                  Filters
                </Button>
                <Button variant="outline" onClick={() => handleExportData(selectedTab)}>
                  <Download className="h-5 w-5 mr-2" />
                  Export
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Content based on selected tab */}
        {selectedTab === 'overview' && (
          <div className="space-y-6">
            <AdminPaymentMode />
            <div className="grid md:grid-cols-2 gap-6">
            {/* Recent Orders */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {orders.slice(0, 5).map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-3 bg-background rounded-lg">
                      <div>
                        <p className="font-medium">#{order.id?.substring(0, 8)}</p>
                        <p className="text-sm text-muted-foreground">{order.customer_phone}</p>
                      </div>
                      <Badge className={orderStatusBadgeCls(order.status)}>
                        {order.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Pending Disputes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                  Pending Disputes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {disputes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                    <p>No pending disputes</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {disputes.slice(0, 5).map((dispute) => (
                      <div key={dispute.id} className="p-3 bg-gold-500/10 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <p className="font-medium">Order #{dispute.order_id?.substring(0, 8)}</p>
                          <Badge variant="outline">Pending</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{dispute.reason}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          </div>
        )}

        {selectedTab === 'users' && (
          <>
          <IncompleteApplications />
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <CardTitle>Users Management ({filteredUsers.length})</CardTitle>
                <div className="flex items-center gap-2" data-testid="user-type-filter">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  {[['all', 'All'], ['customer', 'Customer'], ['merchant', 'Merchant'], ['driver', 'Driver']].map(([val, label]) => (
                    <Button
                      key={val}
                      size="sm"
                      variant={userTypeFilter === val ? 'default' : 'outline'}
                      onClick={() => setUserTypeFilter(val)}
                      data-testid={`user-type-${val}`}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3">User</th>
                      <th className="text-left p-3">Type</th>
                      <th className="text-left p-3">Status</th>
                      <th className="text-left p-3">Joined</th>
                      <th className="text-right p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => {
                      const emailInvalid = user.email_is_real === false || (user.email_is_real === undefined && isPlaceholderEmail(user.email));
                      return (
                      <tr key={user.id} data-testid={`admin-user-row-${user.id}`} className="border-b hover:bg-background cursor-pointer" onClick={() => openUserProfile(user)}>
                        <td className="p-3">
                          <div>
                            <p className="font-medium">{user.name || 'N/A'}</p>
                            {emailInvalid ? (
                              <Badge data-testid={`no-email-badge-${user.id}`} className="bg-amber-100 text-amber-800 border border-amber-300 text-[10px] mt-0.5">
                                <AlertTriangle className="h-3 w-3 mr-1" />No valid email
                              </Badge>
                            ) : (
                              <p className="text-sm text-muted-foreground">{user.email}</p>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline">{user.user_type || 'customer'}</Badge>
                        </td>
                        <td className="p-3">
                          <Badge className={
                            (user.status === 'paused') ? 'bg-amber-100 text-amber-800'
                            : (user.status === 'restricted' || user.status === 'suspended') ? 'bg-red-100 text-red-800'
                            : 'bg-green-100 text-green-800'
                          }>
                            {user.status || 'active'}
                          </Badge>
                        </td>
                        <td className="p-3 text-sm text-muted-foreground">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-2">
                            <Button
                              data-testid={`view-profile-btn-${user.id}`}
                              size="sm"
                              variant="outline"
                              title="View profile"
                              onClick={() => openUserProfile(user)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              data-testid={`open-portal-btn-${user.id}`}
                              size="sm"
                              variant="outline"
                              title="Open this client's portal (view / fix / adjust)"
                              onClick={() => openClientPortal(user)}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                            <Button
                              data-testid={`message-user-btn-${user.id}`}
                              size="sm"
                              variant="outline"
                              disabled={emailInvalid}
                              title={emailInvalid ? 'No valid email on file' : 'Send email'}
                              onClick={() => openMessageUser(user)}
                            >
                              <Mail className="h-4 w-4" />
                            </Button>
                            {(user.status || 'active') !== 'active' && (
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                                title="Approve (set active)"
                                data-testid={`approve-user-btn-${user.id}`}
                                onClick={() => handleSetUserStatus(user.id, 'active')}
                              >
                                <UserCheck className="h-4 w-4" />
                              </Button>
                            )}
                            {(user.status || 'active') !== 'paused' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-amber-700 border-amber-300 hover:bg-amber-50"
                                title="Pause account"
                                data-testid={`pause-user-btn-${user.id}`}
                                onClick={() => handleSetUserStatus(user.id, 'paused')}
                              >
                                <PauseCircle className="h-4 w-4" />
                              </Button>
                            )}
                            {(user.status || 'active') !== 'restricted' && (
                              <Button
                                size="sm"
                                variant="destructive"
                                title="Restrict account"
                                data-testid={`restrict-user-btn-${user.id}`}
                                onClick={() => handleSetUserStatus(user.id, 'restricted')}
                              >
                                <ShieldOff className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );})}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          </>
        )}

        {selectedTab === 'orders' && (
          <>
            <Card className="mb-4 border-gold-300" data-testid="settlement-card">
              <CardHeader>
                <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                  <span className="flex items-center gap-2"><Banknote className="h-5 w-5 text-gold-600" />End-of-Day Settlement</span>
                  <Button size="sm" className="bg-gold-gradient text-white" disabled={settling} onClick={runSettlement} data-testid="run-settlement-btn">
                    {settling ? 'Settling…' : 'Run settlement now'}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Settles merchant payouts and driver earnings to their in-app wallets (netting any COD cash drivers owe) and queues external payouts. Runs automatically at end of day; use the button to settle on demand.
                </p>
                {settlementBatches.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No settlement runs yet.</p>
                ) : (
                  <div className="border rounded-lg divide-y">
                    {settlementBatches.map((b) => (
                      <div key={b.id} className="flex items-center justify-between p-3 text-sm" data-testid={`settlement-batch-${b.id}`}>
                        <div>
                          <p className="font-medium">{new Date(b.created_at).toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">
                            {b.merchants_settled} merchant(s) · {b.drivers_settled} driver(s)
                            {b.drivers_cash_offset > 0 ? ` · ${money(b.drivers_cash_offset)} cash offset` : ''} · {b.actor}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gold-700">{money(b.merchants_total + b.drivers_total)}</p>
                          <p className="text-xs text-muted-foreground">M {money(b.merchants_total)} · D {money(b.drivers_total)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            {cashOutstanding && cashOutstanding.drivers?.length > 0 && (
              <Card className="mb-4 border-amber-300" data-testid="cash-outstanding-card">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2"><Banknote className="h-5 w-5 text-amber-600" />Driver Cash Outstanding (COD)</span>
                    <Badge className="bg-amber-100 text-amber-800 border border-amber-300">{money(cashOutstanding.total_outstanding)} owed to platform</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg divide-y">
                    {cashOutstanding.drivers.map((d) => (
                      <div key={d.driver_id} className="flex items-center justify-between p-3 text-sm" data-testid={`cash-driver-${d.driver_id}`}>
                        <div>
                          <p className="font-medium">{d.name}</p>
                          <p className="text-xs text-muted-foreground">{d.phone || '—'} · collected {money(d.cash_collected_total)} total</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-amber-700">{money(d.cash_outstanding)}</span>
                          <Button size="sm" variant="outline" data-testid={`settle-cash-${d.driver_id}`} onClick={() => settleDriverCash(d.driver_id)}>
                            Mark settled
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          <Card>
            <CardHeader>
              <CardTitle>Orders Management ({filteredOrders.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredOrders.map((order) => (
                  <Card key={order.id} data-testid={`admin-order-${order.id}`} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setDetailOrder(order)}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold">Order #{order.id?.substring(0, 8)}</h3>
                            <Badge className={orderStatusBadgeCls(order.status)}>
                              {order.status?.toUpperCase()}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>Customer: {order.customer_phone || 'N/A'}</p>
                            <p>Service: {order.service_type}</p>
                            <p>Date: {new Date(order.created_at).toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-gold-500">
                            {money(order.total)}
                          </p>
                          <div className="flex gap-2 mt-2">
                            <Button data-testid={`view-order-btn-${order.id}`} size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setDetailOrder(order); }}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            {order.status === 'pending' && (
                              <Button 
                                size="sm" 
                                variant="destructive"
                                onClick={(e) => { e.stopPropagation(); handleOrderAction(order.id, 'cancel'); }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
          </>
        )}

        {selectedTab === 'approvals' && <AdminApprovals />}
        {selectedTab === 'payouts' && <AdminPayouts />}

        {selectedTab === 'safety' && (
          <div className="flex gap-2 mb-4" data-testid="safety-subtabs">
            {[['fraud', 'Frauds', fraudOpenCount], ['claims', 'Claims', claimsOpenCount], ['disputes', 'Disputes', 0]]
              .filter(([key]) => !(key === 'fraud' && myRole === 'agent'))
              .map(([key, label, count]) => (
                <Button
                  key={key}
                  variant={safetySub === key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSafetySub(key)}
                  data-testid={`safety-subtab-${key}`}
                >
                  {label}
                  {count > 0 && <Badge variant="destructive" className="ml-2">{count}</Badge>}
                </Button>
              ))}
          </div>
        )}

        {selectedTab === 'safety' && safetySub === 'fraud' && myRole !== 'agent' && (
          <Card data-testid="admin-fraud-content">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    Fraud Review Queue
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Orders auto-flagged by heuristics (high value, velocity, new account, refund requests). Review and clear or confirm.
                  </p>
                </div>
                <div className="flex gap-2">
                  {['open', 'cleared', 'confirmed_fraud', 'all'].map((s) => (
                    <Button
                      key={s}
                      variant={fraudFilter === s ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFraudFilter(s)}
                      data-testid={`fraud-filter-${s}`}
                    >
                      {s.replace('_', ' ')}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {fraudFlags.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground" data-testid="fraud-empty">
                  <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
                  <p>No {fraudFilter === 'all' ? '' : fraudFilter} fraud flags.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {fraudFlags.map((flag) => {
                    const sevColor = flag.severity === 'high'
                      ? 'bg-red-500/20 text-red-400 border-red-500/40'
                      : flag.severity === 'medium'
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                      : 'bg-blue-500/20 text-blue-400 border-blue-500/40';
                    return (
                      <div
                        key={flag.id}
                        data-testid={`fraud-row-${flag.id}`}
                        className="p-4 bg-matte-900/40 rounded-lg border border-matte-700/60 cursor-pointer hover:border-gold-500/40 transition-colors"
                        onClick={() => setDetailFraud(flag)}
                      >
                        <div className="flex items-start justify-between flex-wrap gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <Badge variant="outline" className={sevColor}>
                                {flag.severity.toUpperCase()}
                              </Badge>
                              <span className="font-mono text-xs text-muted-foreground">
                                ORDER #{(flag.order_id || '').slice(0, 8)}
                              </span>
                              <Badge variant="outline">
                                {money(flag.amount)}
                              </Badge>
                              {flag.status !== 'open' && (
                                <Badge variant="secondary">{flag.status.replace('_', ' ')}</Badge>
                              )}
                            </div>
                            <p className="font-medium text-foreground">
                              {flag.customer?.name || 'Unknown'}
                              <span className="text-muted-foreground font-normal ml-2 text-sm">
                                {flag.customer?.email}
                              </span>
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {flag.order?.service_type} · {flag.order?.payment_status} ·{' '}
                              {flag.created_at && new Date(flag.created_at).toLocaleString()}
                            </p>
                            <div className="flex gap-1 mt-2 flex-wrap">
                              {(flag.signals || []).map((s) => (
                                <Badge key={s} variant="outline" className="text-xs">
                                  {s.replace(/_/g, ' ')}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          {flag.status === 'open' && (
                            <div className="flex gap-2 flex-shrink-0">
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={(e) => { e.stopPropagation(); handleFraudReview(flag.id, 'clear'); }}
                                data-testid={`fraud-clear-${flag.id}`}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />Clear
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={(e) => { e.stopPropagation(); handleFraudReview(flag.id, 'confirm'); }}
                                data-testid={`fraud-confirm-${flag.id}`}
                              >
                                <Ban className="h-4 w-4 mr-1" />Confirm Fraud
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {selectedTab === 'safety' && safetySub === 'claims' && (
          <Card data-testid="admin-claims-content">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-gold-500" />
                    Customer Claims
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Triage customer disputes. Approve with a wallet credit, or reject.
                  </p>
                </div>
                <div className="flex gap-2">
                  {['open', 'resolved', 'closed', 'all'].map((s) => (
                    <Button
                      key={s}
                      variant={claimsFilter === s ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setClaimsFilter(s)}
                      data-testid={`claims-filter-${s}`}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {claims.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground" data-testid="claims-empty">
                  <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
                  <p>No {claimsFilter === 'all' ? '' : claimsFilter} claims.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {claims.map((claim) => (
                    <div
                      key={claim.id}
                      data-testid={`admin-claim-row-${claim.id}`}
                      className="p-4 bg-matte-900/40 rounded-lg border border-matte-700/60 cursor-pointer hover:border-gold-500/40 transition-colors"
                      onClick={() => setDetailClaim(claim)}
                    >
                      <div className="flex items-start justify-between flex-wrap gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Badge variant="outline" className="bg-gold-500/15 text-gold-500 border-gold-500/30">
                              {(claim.claim_type || 'other').replace(/_/g, ' ')}
                            </Badge>
                            <Badge variant="outline">{claim.status}</Badge>
                            <span className="font-mono text-xs text-muted-foreground">
                              ORDER #{(claim.order_id || '').slice(0, 8)}
                            </span>
                            {typeof claim.resolution_credit === 'number' && claim.resolution_credit > 0 && (
                              <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/40">
                                +{money(claim.resolution_credit)} credited
                              </Badge>
                            )}
                          </div>
                          <p className="font-medium text-foreground truncate">{claim.subject}</p>
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{claim.description}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {claim.created_at && new Date(claim.created_at).toLocaleString()}
                          </p>
                          {claim.photo_url && (
                            <img
                              src={claim.photo_url}
                              alt="claim proof"
                              className="mt-2 max-h-24 rounded-md border border-matte-700"
                            />
                          )}
                        </div>
                        {claim.status === 'open' && (
                          <div className="flex gap-2 flex-shrink-0">
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={(e) => { e.stopPropagation(); handleClaimResolve(claim.id, 'approved'); }}
                              data-testid={`claim-approve-${claim.id}`}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />Approve & credit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={(e) => { e.stopPropagation(); handleClaimResolve(claim.id, 'rejected', 0); }}
                              data-testid={`claim-reject-${claim.id}`}
                            >
                              <X className="h-4 w-4 mr-1" />Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {selectedTab === 'safety' && safetySub === 'disputes' && (
          <Card data-testid="admin-disputes-content">
            <CardHeader>
              <CardTitle>Customer Disputes ({disputes.length})</CardTitle>
              <p className="text-sm text-muted-foreground">Review and resolve customer disputes. Approve with a wallet credit, or reject.</p>
            </CardHeader>
            <CardContent>
              {disputes.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground" data-testid="disputes-empty">
                  <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
                  <p>No open disputes.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {disputes.map((d) => (
                    <div key={d.id} className="p-4 bg-matte-900/40 rounded-lg" data-testid={`dispute-row-${d.id}`}>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <p className="font-medium">{d.subject || d.reason || `Dispute #${(d.id || '').slice(0, 8)}`}</p>
                          <p className="text-sm text-muted-foreground">{d.customer_name || d.customer_id || '—'}{d.order_id ? ` · Order #${String(d.order_id).slice(0, 8)}` : ''}</p>
                          {d.created_at && <p className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleString()}</p>}
                        </div>
                        <Badge variant="outline">{d.status || 'open'}</Badge>
                      </div>
                      {d.description && <p className="text-sm mt-2 text-muted-foreground">{d.description}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}


        {selectedTab === 'wallet' && financeSub === 'zones' && (
          <AdminServiceZones />
        )}

        {selectedTab === 'whatsapp' && (
          <AdminWhatsApp />
        )}
        {selectedTab === 'mail' && (
          <AdminMailInbox />
        )}

        {selectedTab === 'wallet' && (
          <div className="flex gap-2 mb-4" data-testid="finance-subtabs">
            {[['wallet', 'Wallet Requests'], ['banking', 'Banking'], ['zones', 'Service Zones']].map(([key, label]) => (
              <Button key={key} variant={financeSub === key ? 'default' : 'outline'} size="sm" onClick={() => setFinanceSub(key)} data-testid={`finance-subtab-${key}`}>
                {label}
              </Button>
            ))}
          </div>
        )}

        {selectedTab === 'wallet' && financeSub === 'wallet' && (
          <AdminWalletRequests />
        )}

        {selectedTab === 'wallet' && financeSub === 'banking' && (
          <AdminMercuryBanking />
        )}

        {selectedTab === 'team' && (
          <div className="flex gap-2 mb-4" data-testid="growth-subtabs">
            {[['team', 'Team'], ['incentives', 'Incentives'], ['promoters', 'Promoters']].map(([key, label]) => (
              <Button key={key} variant={growthSub === key ? 'default' : 'outline'} size="sm" onClick={() => setGrowthSub(key)} data-testid={`growth-subtab-${key}`}>
                {label}
              </Button>
            ))}
          </div>
        )}

        {selectedTab === 'team' && growthSub === 'team' && (
          <AdminTeam />
        )}

        {selectedTab === 'team' && growthSub === 'incentives' && (
          <AdminDriverIncentives />
        )}

        {selectedTab === 'team' && growthSub === 'promoters' && (
          <AdminPromoters />
        )}

        {selectedTab === 'cleanup' && (
          <AdminDataCleanup />
        )}



        {selectedTab === 'analytics' && (
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <TrendingUp className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-muted-foreground">Revenue charts coming soon</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>User Growth</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-muted-foreground">User growth charts coming soon</p>
                </div>
              </CardContent>
            </Card>

            <AnalyticsPromotions />
          </div>
        )}

        {/* Customer profile */}
        <Dialog open={!!profileUser} onOpenChange={(o) => { if (!o) { setProfileUser(null); setProfileData(null); } }}>
          <DialogContent data-testid="user-profile-dialog" className="max-w-2xl max-h-[85vh] overflow-y-auto">
            {profileUser && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <UserIcon className="h-5 w-5 text-gold-500" />{profileUser.name || 'Customer'}
                    <Badge variant="outline" className="capitalize">{profileUser.user_type || 'customer'}</Badge>
                  </DialogTitle>
                </DialogHeader>
                {profileLoading && <p className="text-sm text-muted-foreground py-6 text-center">Loading profile…</p>}
                {!profileLoading && profileData?.error && <p className="text-sm text-red-600 py-4">{profileData.error}</p>}
                {!profileLoading && profileData?.user && (
                  <div className="space-y-4 text-sm">
                    {/* Contact + account */}
                    <div className="grid grid-cols-2 gap-3">
                      <div><span className="text-muted-foreground">Email</span>
                        {profileData.user.email_is_real === false
                          ? <div><Badge className="bg-amber-100 text-amber-800 border border-amber-300 text-[10px]"><AlertTriangle className="h-3 w-3 mr-1" />No valid email</Badge></div>
                          : <p className="font-medium break-all" data-testid="profile-email">{profileData.user.email || '—'}</p>}
                      </div>
                      <div><span className="text-muted-foreground">Phone</span><p className="font-medium">{profileData.user.phone || '—'}{profileData.user.phone_verified ? ' ✓' : ''}</p></div>
                      <div><span className="text-muted-foreground">Status</span><p className="font-medium capitalize">{profileData.user.status || 'active'}</p></div>
                      <div><span className="text-muted-foreground">Member since</span><p className="font-medium">{new Date(profileData.user.created_at).toLocaleString()}</p></div>
                      <div className="col-span-2"><span className="text-muted-foreground">User ID</span><p className="font-mono text-xs break-all">{profileData.user.id}</p></div>
                    </div>

                    {profileData.user.address && (Object.values(profileData.user.address).some(Boolean)) && (
                      <div><span className="text-muted-foreground">Address</span>
                        <p className="font-medium">{Object.values(profileData.user.address).filter(Boolean).join(', ')}</p>
                      </div>
                    )}

                    {profileData.referrer && (
                      <p className="text-xs text-muted-foreground">Referred by <span className="font-medium text-foreground">{profileData.referrer.name || profileData.referrer.email}</span></p>
                    )}

                    {/* Documents (drivers & merchants) — permanently stored, click to review */}
                    {profileDocs && (profileDocs.documents?.length > 0 || ['driver', 'restaurant', 'business', 'merchant'].includes((profileData.user.user_type || '').toLowerCase())) && (
                      <div data-testid="profile-documents-section">
                        <p className="font-semibold mb-2 flex items-center gap-2"><FileText className="h-4 w-4 text-gold-500" />Documents ({profileDocs.documents?.length || 0})</p>
                        {(!profileDocs.documents || profileDocs.documents.length === 0) ? (
                          <p className="text-xs text-amber-600 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" />No documents were submitted with this application.</p>
                        ) : (
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3" data-testid="profile-documents-grid">
                            {profileDocs.documents.map((d, i) => {
                              const url = d.kind === 'driver_doc'
                                ? `${API}/drivers/documents/${d.document_id}/download?auth=${encodeURIComponent(localStorage.getItem('token') || '')}`
                                : (d.url || '');
                              const label = d.doc_type || d.label || d.filename || `Doc ${i + 1}`;
                              return (
                                <a key={d.document_id || d.url || i} href={url} target="_blank" rel="noopener noreferrer"
                                  className="group border border-border rounded-lg overflow-hidden hover:border-gold-500 transition-colors"
                                  data-testid={`profile-document-${i}`} title="Open in new tab"
                                  onClick={() => setDocsReviewed(true)}>
                                  <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                                    {d.is_image ? <img src={url} alt={label} className="w-full h-full object-cover" loading="lazy" /> : <FileText className="h-8 w-8 text-muted-foreground" />}
                                  </div>
                                  <div className="p-1.5 flex items-center justify-between gap-1">
                                    <span className="text-[10px] font-medium capitalize truncate">{String(label).replace(/_/g, ' ')}</span>
                                    <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-gold-500 shrink-0" />
                                  </div>
                                </a>
                              );
                            })}
                          </div>
                        )}
                        {profileDocs.applicant && ['pending', 'pending_approval'].includes((profileDocs.applicant.status || '').toLowerCase()) && (
                          <label className="flex items-center gap-2 mt-3 text-xs cursor-pointer" data-testid="docs-reviewed-toggle">
                            <input type="checkbox" checked={docsReviewed} onChange={(e) => setDocsReviewed(e.target.checked)} className="h-4 w-4 accent-gold-500" data-testid="docs-reviewed-checkbox" />
                            I have reviewed the submitted documents
                          </label>
                        )}
                      </div>
                    )}

                    {/* Order stats */}
                    <div className="grid grid-cols-4 gap-2">
                      {[['Orders', profileData.stats.order_count], ['Spent', money(profileData.stats.total_spent)], ['Delivered', profileData.stats.delivered], ['Active', profileData.stats.active]].map(([label, val]) => (
                        <div key={label} className="rounded-lg border border-border p-2 text-center">
                          <p className="text-lg font-bold text-gold-500">{val}</p>
                          <p className="text-[11px] text-muted-foreground">{label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Recent orders */}
                    <div>
                      <p className="font-semibold mb-1">Recent orders</p>
                      {profileData.recent_orders.length === 0 ? (
                        <p className="text-muted-foreground text-xs">No orders yet.</p>
                      ) : (
                        <div className="border rounded-lg divide-y" data-testid="profile-recent-orders">
                          {profileData.recent_orders.map((o) => (
                            <div key={o.id} className="flex items-center justify-between p-2 text-xs">
                              <div>
                                <span className="font-medium capitalize">{o.service_type}</span>
                                <span className="text-muted-foreground"> · #{o.id?.substring(0, 8)} · {o.created_at ? new Date(o.created_at).toLocaleDateString() : ''}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={orderStatusBadgeCls(o.status)}>{o.status}</Badge>
                                <span className="font-medium">{money(o.total)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <DialogFooter className="gap-2">
                  {profileDocs?.applicant && ['pending', 'pending_approval'].includes((profileDocs.applicant.status || '').toLowerCase()) && (
                    <>
                      <Button
                        data-testid="profile-reject-applicant-btn"
                        variant="destructive"
                        disabled={!docsReviewed || docActionBusy}
                        title={!docsReviewed ? 'Review the documents first' : 'Reject applicant'}
                        onClick={() => handleApplicantApproval(profileDocs.applicant, 'reject')}
                      >
                        <X className="h-4 w-4 mr-1" />Reject
                      </Button>
                      <Button
                        data-testid="profile-approve-applicant-btn"
                        className="bg-green-600 hover:bg-green-700"
                        disabled={!docsReviewed || docActionBusy}
                        title={!docsReviewed ? 'Review the documents first' : 'Approve applicant'}
                        onClick={() => handleApplicantApproval(profileDocs.applicant, 'approve')}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />Approve
                      </Button>
                    </>
                  )}
                  {profileData?.user && (
                    <Button
                      data-testid="profile-message-btn"
                      variant="outline"
                      disabled={profileData.user.email_is_real === false}
                      onClick={() => { const u = profileData.user; setProfileUser(null); openMessageUser(u); }}
                    >
                      <Mail className="h-4 w-4 mr-1" />Email
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => { setProfileUser(null); setProfileData(null); }}>Close</Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Message a user (email) */}
        <Dialog open={!!msgUser} onOpenChange={(o) => { if (!o) setMsgUser(null); }}>
          <DialogContent data-testid="message-user-dialog">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-gold-500" />Email {msgUser?.name || 'customer'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">To: <span className="font-medium text-foreground">{msgUser?.email}</span></p>
              <Input
                data-testid="message-subject-input"
                placeholder="Subject"
                value={msgSubject}
                onChange={(e) => setMsgSubject(e.target.value)}
              />
              <Textarea
                data-testid="message-body-input"
                placeholder="Write your message…"
                rows={6}
                value={msgBody}
                onChange={(e) => setMsgBody(e.target.value)}
              />
              {msgFeedback && (
                <p data-testid="message-feedback" className={`text-sm ${msgFeedback.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                  {msgFeedback.text}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMsgUser(null)}>Close</Button>
              <Button
                data-testid="message-send-btn"
                className="bg-gold-500 hover:bg-gold-600"
                disabled={msgSending || !msgSubject.trim() || !msgBody.trim()}
                onClick={sendUserMessage}
              >
                <Send className="h-4 w-4 mr-1" />{msgSending ? 'Sending…' : 'Send Email'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Order detail + transaction breakdown */}
        <Dialog open={!!detailOrder} onOpenChange={(o) => { if (!o) setDetailOrder(null); }}>
          <DialogContent data-testid="order-detail-dialog" className="max-w-2xl max-h-[85vh] overflow-y-auto">
            {detailOrder && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-gold-500" />Order #{detailOrder.id?.substring(0, 8)}
                    <Badge className={orderStatusBadgeCls(detailOrder.status)}>{detailOrder.status?.toUpperCase()}</Badge>
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div><span className="text-muted-foreground">Service</span><p className="font-medium capitalize">{detailOrder.service_type}</p></div>
                    <div><span className="text-muted-foreground">Placed</span><p className="font-medium">{new Date(detailOrder.created_at).toLocaleString()}</p></div>
                    <div><span className="text-muted-foreground">Payment</span><p className="font-medium capitalize">{detailOrder.payment_method} · {detailOrder.payment_status}</p></div>
                    <div><span className="text-muted-foreground">Customer</span><p className="font-medium">{customerForOrder(detailOrder)?.name || detailOrder.customer_phone || detailOrder.customer_id?.substring(0,8)}</p></div>
                  </div>

                  {(detailOrder.pickup_address || detailOrder.delivery_address) && (
                    <div className="grid grid-cols-2 gap-3">
                      <div><span className="text-muted-foreground">Pickup</span><p className="font-medium">{detailOrder.pickup_address?.street || detailOrder.pickup_address?.address || '—'}</p></div>
                      <div><span className="text-muted-foreground">Drop-off</span><p className="font-medium">{detailOrder.delivery_address?.street || detailOrder.delivery_address?.address || '—'}</p></div>
                    </div>
                  )}

                  {detailOrder.items?.length > 0 && (
                    <div>
                      <p className="font-semibold mb-1">Items</p>
                      <div className="border rounded-lg divide-y">
                        {detailOrder.items.map((it, i) => (
                          <div key={`${it.name}-${i}`} className="flex justify-between p-2">
                            <span>{it.quantity}× {it.name}</span>
                            <span className="font-medium">{money(it.price * it.quantity)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="font-semibold mb-1 flex items-center gap-1"><CreditCard className="h-4 w-4 text-gold-500" />Transaction</p>
                    <div className="border rounded-lg p-3 space-y-1">
                      <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{money(detailOrder.subtotal)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Delivery fee</span><span>{money(detailOrder.delivery_fee)}</span></div>
                      {detailOrder.tip > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Tip</span><span>{money(detailOrder.tip)}</span></div>}
                      {detailOrder.tax > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{money(detailOrder.tax)}</span></div>}
                      {detailOrder.discount > 0 && <div className="flex justify-between text-green-600"><span>Discount{detailOrder.promo_code ? ` (${detailOrder.promo_code})` : ''}</span><span>-{money(detailOrder.discount)}</span></div>}
                      <div className="flex justify-between font-bold pt-1 border-t"><span>Total</span><span className="text-gold-500">{money(detailOrder.total)}</span></div>
                    </div>
                  </div>

                  <div>
                    <p className="font-semibold mb-1">Payouts & Earnings</p>
                    <div className="border rounded-lg p-3 space-y-1">
                      <div className="flex justify-between"><span className="text-muted-foreground">Commission ({detailOrder.commission_rate}%)</span><span>{money(detailOrder.commission_amount)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Vendor payout <Badge variant="outline" className="ml-1">{detailOrder.vendor_payout_status}</Badge></span><span>{money(detailOrder.vendor_payout)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Driver earnings <Badge variant="outline" className="ml-1">{detailOrder.driver_payout_status}</Badge></span><span>{money(detailOrder.driver_earnings)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Platform earnings</span><span>{money(detailOrder.platform_earnings)}</span></div>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDetailOrder(null)}>Close</Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Approval applicant / customer profile */}
        <Dialog open={!!detailApproval} onOpenChange={(o) => { if (!o) setDetailApproval(null); }}>
          <DialogContent data-testid="applicant-detail-dialog" className="max-w-lg max-h-[85vh] overflow-y-auto">
            {detailApproval && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2"><UserIcon className="h-5 w-5 text-gold-500" />{detailApproval.name || 'Applicant'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div><span className="text-muted-foreground">Type</span><p className="font-medium capitalize">{detailApproval.kind?.replace('_', ' ')}</p></div>
                    <div><span className="text-muted-foreground">Email</span>
                      {isPlaceholderEmail(detailApproval.email)
                        ? <div><Badge className="bg-amber-100 text-amber-800 border border-amber-300 text-[10px]"><AlertTriangle className="h-3 w-3 mr-1" />No valid email</Badge></div>
                        : <p className="font-medium break-all">{detailApproval.email || '—'}</p>}
                    </div>
                    <div><span className="text-muted-foreground">Phone</span><p className="font-medium">{detailApproval.phone || detailApproval.raw?.phone || '—'}</p></div>
                    <div><span className="text-muted-foreground">Applied</span><p className="font-medium">{detailApproval.created_at ? new Date(detailApproval.created_at).toLocaleString() : '—'}</p></div>
                  </div>
                  {(() => {
                    const acct = userByEmail(detailApproval.email);
                    return acct ? (
                      <div className="border rounded-lg p-3 space-y-1">
                        <p className="font-semibold">Linked customer account</p>
                        <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span>{acct.name}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="capitalize">{acct.status || 'active'}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Member since</span><span>{new Date(acct.created_at).toLocaleDateString()}</span></div>
                      </div>
                    ) : null;
                  })()}
                  {detailApproval.raw && (
                    <div>
                      <p className="font-semibold mb-1">Application details</p>
                      <div className="border rounded-lg p-3 space-y-1">
                        {Object.entries(detailApproval.raw)
                          .filter(([k, v]) => ['license_number', 'vehicle_type', 'vehicle_plate', 'business_name', 'category', 'address', 'description'].includes(k) && v)
                          .map(([k, v]) => (
                            <div key={k} className="flex justify-between gap-3">
                              <span className="text-muted-foreground capitalize">{k.replace(/_/g, ' ')}</span>
                              <span className="font-medium text-right break-all">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                  {detailApproval.raw?.identity_verification && (
                    <div>
                      <p className="font-semibold mb-1">Automated KYC (Stripe Identity)</p>
                      <div className="border rounded-lg p-3">
                        <Badge className={detailApproval.raw.identity_verification.status === 'verified'
                          ? 'bg-green-600/20 text-green-400'
                          : 'bg-yellow-600/20 text-yellow-400'}>
                          {detailApproval.raw.identity_verification.status || 'not started'}
                        </Badge>
                      </div>
                    </div>
                  )}
                  {detailApproval.kind === 'driver' && (
                    <div>
                      <p className="font-semibold mb-1">Submitted documents (click to open)</p>
                      {detailApproval.raw?.documents && Object.keys(detailApproval.raw.documents).length > 0 ? (
                        <div className="border rounded-lg p-3 flex flex-wrap gap-2" data-testid="applicant-dialog-docs">
                          {Object.entries(detailApproval.raw.documents).map(([docType, docId]) => (
                            <Button key={docType} size="sm" variant="outline"
                              onClick={() => viewDocument(docId)}
                              data-testid={`dialog-view-doc-${docType}`}>
                              <FileText className="h-3.5 w-3.5 mr-1" />{DOC_LABELS[docType] || docType}
                            </Button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-yellow-500 border rounded-lg p-3" data-testid="applicant-dialog-nodocs">
                          ⚠ No identity documents were submitted with this application.
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setDetailApproval(null)}>Close</Button>
                  <Button variant="destructive" onClick={() => { handleApproval(detailApproval.kind, detailApproval.id, 'reject'); setDetailApproval(null); }}>Reject</Button>
                  <Button className="bg-green-600 hover:bg-green-700" onClick={() => { handleApproval(detailApproval.kind, detailApproval.id, 'approve'); setDetailApproval(null); }}>Approve</Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Claim detail dialog */}
        <Dialog open={!!detailClaim} onOpenChange={(o) => { if (!o) setDetailClaim(null); }}>
          <DialogContent data-testid="claim-detail-dialog" className="max-w-lg max-h-[85vh] overflow-y-auto">
            {detailClaim && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 flex-wrap">
                    <FileText className="h-5 w-5 text-gold-500" />
                    {detailClaim.subject || 'Customer claim'}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3 text-sm">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="bg-gold-500/15 text-gold-500 border-gold-500/30 capitalize">
                      {(detailClaim.claim_type || 'other').replace(/_/g, ' ')}
                    </Badge>
                    <Badge variant="outline" className="capitalize">{detailClaim.status}</Badge>
                    <span className="font-mono text-xs text-muted-foreground self-center">
                      ORDER #{(detailClaim.order_id || '').slice(0, 8)}
                    </span>
                    {typeof detailClaim.resolution_credit === 'number' && detailClaim.resolution_credit > 0 && (
                      <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/40">
                        +{money(detailClaim.resolution_credit)} credited
                      </Badge>
                    )}
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Description</p>
                    <p className="font-medium whitespace-pre-wrap border rounded-lg p-3" data-testid="claim-dialog-description">
                      {detailClaim.description || '—'}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><span className="text-muted-foreground">Filed by</span><p className="font-medium break-all">{detailClaim.customer_email || detailClaim.customer_id?.substring(0, 8) || '—'}</p></div>
                    <div><span className="text-muted-foreground">Submitted</span><p className="font-medium">{detailClaim.created_at ? new Date(detailClaim.created_at).toLocaleString() : '—'}</p></div>
                  </div>
                  {detailClaim.photo_url && (
                    <div>
                      <p className="text-muted-foreground mb-1">Proof photo (click to enlarge)</p>
                      <a href={detailClaim.photo_url} target="_blank" rel="noopener noreferrer" data-testid="claim-dialog-photo-link">
                        <img src={detailClaim.photo_url} alt="claim proof"
                          className="max-h-72 w-auto rounded-lg border border-matte-700 hover:opacity-90 transition-opacity" />
                      </a>
                    </div>
                  )}
                  {detailClaim.resolution_notes && (
                    <div>
                      <p className="text-muted-foreground mb-1">Resolution notes</p>
                      <p className="font-medium border rounded-lg p-3">{detailClaim.resolution_notes}</p>
                    </div>
                  )}
                </div>
                {detailClaim.status === 'open' && (
                  <DialogFooter className="gap-2">
                    <Button variant="destructive" data-testid="claim-dialog-reject"
                      onClick={() => { handleClaimResolve(detailClaim.id, 'rejected', 0); setDetailClaim(null); }}>
                      <X className="h-4 w-4 mr-1" />Reject
                    </Button>
                    <Button className="bg-green-600 hover:bg-green-700" data-testid="claim-dialog-approve"
                      onClick={() => { handleClaimResolve(detailClaim.id, 'approved'); setDetailClaim(null); }}>
                      <CheckCircle className="h-4 w-4 mr-1" />Approve &amp; credit
                    </Button>
                  </DialogFooter>
                )}
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Fraud detail dialog */}
        <Dialog open={!!detailFraud} onOpenChange={(o) => { if (!o) setDetailFraud(null); }}>
          <DialogContent data-testid="fraud-detail-dialog" className="max-w-lg max-h-[85vh] overflow-y-auto">
            {detailFraud && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 flex-wrap">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    Fraud review · {(detailFraud.severity || '').toUpperCase()}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div><span className="text-muted-foreground">Order</span><p className="font-mono font-medium">#{(detailFraud.order_id || '').slice(0, 8)}</p></div>
                    <div><span className="text-muted-foreground">Amount</span><p className="font-medium">{money(detailFraud.amount)}</p></div>
                    <div><span className="text-muted-foreground">Service</span><p className="font-medium capitalize">{detailFraud.order?.service_type || '—'}</p></div>
                    <div><span className="text-muted-foreground">Payment</span><p className="font-medium capitalize">{detailFraud.order?.payment_method} · {detailFraud.order?.payment_status}</p></div>
                    <div><span className="text-muted-foreground">Flagged</span><p className="font-medium">{detailFraud.created_at ? new Date(detailFraud.created_at).toLocaleString() : '—'}</p></div>
                    <div><span className="text-muted-foreground">Status</span><p className="font-medium capitalize">{(detailFraud.status || '').replace(/_/g, ' ')}</p></div>
                  </div>
                  <div className="border rounded-lg p-3 space-y-1">
                    <p className="font-semibold">Customer</p>
                    <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span>{detailFraud.customer?.name || 'Unknown'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="break-all">{detailFraud.customer?.email || '—'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span>{detailFraud.customer?.phone || '—'}</span></div>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Fraud signals</p>
                    <div className="flex flex-wrap gap-1" data-testid="fraud-dialog-signals">
                      {(detailFraud.signals || []).length === 0
                        ? <span className="text-muted-foreground">None recorded</span>
                        : detailFraud.signals.map((s) => (
                          <Badge key={s} variant="outline" className="text-xs capitalize">{s.replace(/_/g, ' ')}</Badge>
                        ))}
                    </div>
                  </div>
                </div>
                {detailFraud.status === 'open' && (
                  <DialogFooter className="gap-2">
                    <Button className="bg-green-600 hover:bg-green-700" data-testid="fraud-dialog-clear"
                      onClick={() => { handleFraudReview(detailFraud.id, 'clear'); setDetailFraud(null); }}>
                      <CheckCircle className="h-4 w-4 mr-1" />Clear
                    </Button>
                    <Button variant="destructive" data-testid="fraud-dialog-confirm"
                      onClick={() => { handleFraudReview(detailFraud.id, 'confirm'); setDetailFraud(null); }}>
                      <Ban className="h-4 w-4 mr-1" />Confirm Fraud
                    </Button>
                  </DialogFooter>
                )}
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default AdminPanel;
