import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Textarea } from './components/ui/textarea';
import { Label } from './components/ui/label';
import { Badge } from './components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './components/ui/dialog';
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
import AdminDataCleanup from './AdminDataCleanup';

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

const money = (v) => `$${Number(v || 0).toFixed(2)}`;

const DOC_LABELS = {
  driversLicense: "Driver's License",
  vehicleRegistration: 'Vehicle Registration',
  insurance: 'Insurance',
  certificateOfCharacter: 'Certificate of Character',
  profilePhoto: 'Profile Photo',
};

const AdminPanel = () => {
  const navigate = useNavigate();
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
  const [zones, setZones] = useState([]);
  const [zoneForm, setZoneForm] = useState({ name: '', polygon: '', allowed_services: '', description: '' });
  const [whConvos, setWhConvos] = useState([]);
  const [whSelectedPhone, setWhSelectedPhone] = useState('');
  const [whMessages, setWhMessages] = useState([]);
  const [whReplyBody, setWhReplyBody] = useState('');
  const [whComposePhone, setWhComposePhone] = useState('');
  const [whComposeBody, setWhComposeBody] = useState('');
  const [whComposeSending, setWhComposeSending] = useState(false);
  const [whComposeFeedback, setWhComposeFeedback] = useState(null); // {type, text}
  const [fraudFlags, setFraudFlags] = useState([]);
  const [fraudOpenCount, setFraudOpenCount] = useState(0);
  const [fraudFilter, setFraudFilter] = useState('open');
  const [claims, setClaims] = useState([]);
  const [claimsFilter, setClaimsFilter] = useState('open');
  const [claimsOpenCount, setClaimsOpenCount] = useState(0);
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
  // Driver cash-outstanding (COD reconciliation)
  const [cashOutstanding, setCashOutstanding] = useState(null);

  useEffect(() => {
    fetchStats();
    fetchUsers();
    fetchOrders();
    fetchDisputes();
    // Lightweight fetch of fraud count for tab badge (silent on failure)
    axios
      .get(`${API}/admin/fraud-queue?status=open&limit=1`, { headers: authHeaders() })
      .then((r) => setFraudOpenCount(r.data?.open_count || 0))
      .catch(() => {});
    axios
      .get(`${API}/admin/claims?status=open&limit=500`, { headers: authHeaders() })
      .then((r) => setClaimsOpenCount(Array.isArray(r.data) ? r.data.length : 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedTab === 'approvals') fetchApprovals();
    if (selectedTab === 'zones') fetchZones();
    if (selectedTab === 'whatsapp') fetchWhConvos();
    if (selectedTab === 'fraud') fetchFraudQueue();
    if (selectedTab === 'claims') fetchClaims();
    if (selectedTab === 'orders') fetchCashOutstanding();
  }, [selectedTab, fraudFilter, claimsFilter]);

  const fetchCashOutstanding = async () => {
    try {
      const r = await axios.get(`${API}/admin/drivers/cash-outstanding`, { headers: authHeaders(), withCredentials: false });
      setCashOutstanding(r.data);
    } catch (e) { setCashOutstanding(null); }
  };

  const settleDriverCash = async (driverId) => {
    if (!window.confirm('Mark this driver\'s outstanding cash as settled (remitted)?')) return;
    try {
      await axios.post(`${API}/admin/drivers/${driverId}/settle-cash`, {}, { headers: authHeaders(), withCredentials: false });
      fetchCashOutstanding();
    } catch (e) { alert(e.response?.data?.detail || 'Failed to settle'); }
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
  }, [searchQuery, selectedTab]);

  const ADMIN_TABS = ['overview', 'users', 'orders', 'approvals', 'wallet', 'fraud', 'claims', 'incentives', 'promoters', 'mail', 'banking', 'team', 'zones', 'whatsapp', 'disputes', 'analytics', 'cleanup'];
  const AGENT_TABS = ['overview', 'claims', 'mail', 'disputes'];
  const visibleTabs = myRole === 'agent' ? AGENT_TABS : ADMIN_TABS;

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
    if (!window.confirm(`Are you sure you want to ${verb} this claim${credit ? ` and credit $${credit.toFixed(2)}` : ''}?`)) return;
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

  const fetchZones = async () => {
    try {
      const res = await axios.get(`${API}/service-zones`, { headers: authHeaders() });
      setZones(res.data);
    } catch (e) { console.error(e); }
  };

  const createZone = async () => {
    let polygonParsed;
    try {
      polygonParsed = JSON.parse(zoneForm.polygon);
      if (!Array.isArray(polygonParsed) || polygonParsed.length < 3) throw new Error();
    } catch {
      alert('Polygon must be valid JSON like [[lat,lng],[lat,lng],[lat,lng],...] with 3+ points');
      return;
    }
    const services = zoneForm.allowed_services.split(',').map(s => s.trim()).filter(Boolean);
    try {
      await axios.post(`${API}/service-zones`, {
        name: zoneForm.name,
        polygon: polygonParsed,
        allowed_services: services,
        active: true,
        description: zoneForm.description || undefined,
      }, { headers: authHeaders() });
      setZoneForm({ name: '', polygon: '', allowed_services: '', description: '' });
      fetchZones();
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to create zone');
    }
  };

  const deleteZone = async (id) => {
    if (!window.confirm('Delete this zone?')) return;
    try {
      await axios.delete(`${API}/service-zones/${id}`, { headers: authHeaders() });
      fetchZones();
    } catch (e) { alert(e.response?.data?.detail || 'Failed'); }
  };

  const fetchWhConvos = async () => {
    try {
      const res = await axios.get(`${API}/whatsapp/conversations`, { headers: authHeaders() });
      setWhConvos(res.data);
    } catch (e) { console.error(e); }
  };

  const openWhConvo = async (phone) => {
    setWhSelectedPhone(phone);
    try {
      const res = await axios.get(`${API}/whatsapp/messages?phone=${encodeURIComponent(phone)}`, { headers: authHeaders() });
      setWhMessages(res.data.reverse());
    } catch (e) { console.error(e); }
  };

  const sendWhReply = async () => {
    if (!whSelectedPhone || !whReplyBody.trim()) return;
    try {
      await axios.post(`${API}/whatsapp/send`, { to: whSelectedPhone, body: whReplyBody }, { headers: authHeaders() });
      setWhReplyBody('');
      openWhConvo(whSelectedPhone);
      fetchWhConvos();
    } catch (e) { alert(e.response?.data?.detail || 'Failed to send'); }
  };

  const sendWhCompose = async () => {
    if (!whComposePhone.trim() || !whComposeBody.trim()) return;
    setWhComposeSending(true);
    setWhComposeFeedback(null);
    try {
      await axios.post(`${API}/whatsapp/send`, { to: whComposePhone.trim(), body: whComposeBody.trim() }, { headers: authHeaders() });
      setWhComposeFeedback({ type: 'success', text: `WhatsApp message queued to ${whComposePhone.trim()}` });
      setWhComposeBody('');
      fetchWhConvos();
    } catch (e) {
      setWhComposeFeedback({ type: 'error', text: e.response?.data?.detail || 'Failed to send WhatsApp message' });
    } finally { setWhComposeSending(false); }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/admin/stats`, {
        headers: authHeaders(), withCredentials: false
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
      const params = search && search.trim() ? `?q=${encodeURIComponent(search.trim())}` : '';
      const response = await axios.get(`${API}/admin/users${params}`, {
        headers: authHeaders(), withCredentials: false
      });
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchOrders = async () => {
    try {
      const response = await axios.get(`${API}/admin/orders`, {
        headers: authHeaders(), withCredentials: false
      });
      setOrders(response.data);
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  const fetchDisputes = async () => {
    try {
      const response = await axios.get(`${API}/admin/disputes`, {
        headers: authHeaders(), withCredentials: false
      });
      setDisputes(response.data);
    } catch (error) {
      console.error('Error fetching disputes:', error);
    }
  };

  const handleUserAction = async (userId, action) => {
    try {
      await axios.post(`${API}/admin/users/${userId}/${action}`, {}, {
        headers: authHeaders(), withCredentials: false
      });
      fetchUsers();
    } catch (error) {
      console.error(`Error ${action} user:`, error);
      alert(`Failed to ${action} user`);
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
        { headers: authHeaders(), withCredentials: false }
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
    setProfileLoading(true);
    try {
      const r = await axios.get(`${API}/admin/users/${user.id}/profile`, { headers: authHeaders(), withCredentials: false });
      setProfileData(r.data);
    } catch (e) {
      setProfileData({ error: e.response?.data?.detail || 'Failed to load profile' });
    } finally {
      setProfileLoading(false);
    }
  };


  const handleOrderAction = async (orderId, action) => {
    try {
      await axios.post(`${API}/admin/orders/${orderId}/${action}`, {}, {
        headers: authHeaders(), withCredentials: false
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

  const filteredUsers = users.filter(user => 
    user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
              <Button variant="outline" onClick={() => navigate('/pricing')} data-testid="admin-subscription-link">
                <DollarSign className="h-5 w-5 mr-2" />
                Subscription Plans
              </Button>
              <Button variant="outline">
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
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'fraud' && fraudOpenCount > 0 && (
                <Badge variant="destructive" className="ml-2">{fraudOpenCount}</Badge>
              )}
              {tab === 'claims' && claimsOpenCount > 0 && (
                <Badge variant="destructive" className="ml-2">{claimsOpenCount}</Badge>
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
                    placeholder={`Search ${selectedTab}...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
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
        )}

        {selectedTab === 'users' && (
          <Card>
            <CardHeader>
              <CardTitle>Users Management ({filteredUsers.length})</CardTitle>
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
                          <Badge className={user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
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
                              data-testid={`message-user-btn-${user.id}`}
                              size="sm"
                              variant="outline"
                              disabled={emailInvalid}
                              title={emailInvalid ? 'No valid email on file' : 'Send email'}
                              onClick={() => openMessageUser(user)}
                            >
                              <Mail className="h-4 w-4" />
                            </Button>
                            {user.status === 'active' ? (
                              <Button 
                                size="sm" 
                                variant="destructive"
                                onClick={() => handleUserAction(user.id, 'suspend')}
                              >
                                <Ban className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button 
                                size="sm"
                                className="bg-green-600"
                                onClick={() => handleUserAction(user.id, 'activate')}
                              >
                                <UserCheck className="h-4 w-4" />
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
        )}

        {selectedTab === 'orders' && (
          <>
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

        {selectedTab === 'approvals' && (
          <Card data-testid="admin-approvals-content">
            <CardHeader>
              <CardTitle>Pending Approvals ({approvals.total})</CardTitle>
              <p className="text-sm text-muted-foreground">Review and approve new drivers, restaurants, car rentals, and business onboarding applications.</p>
            </CardHeader>
            <CardContent>
              {approvals.total === 0 ? (
                <div className="text-center py-12 text-muted-foreground" data-testid="approvals-empty">
                  <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
                  <p>No pending approvals at the moment.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {[['drivers','driver','Drivers'], ['restaurants','restaurant','Restaurants'], ['car_rentals','car_rental','Car Rentals'], ['businesses','business','Businesses']].map(([key, kind, label]) => (
                    approvals[key] && approvals[key].length > 0 && (
                      <div key={key} data-testid={`approval-section-${key}`}>
                        <h3 className="font-semibold mb-3 text-gold-500">{label} ({approvals[key].length})</h3>
                        <div className="space-y-2">
                          {approvals[key].map((row) => (
                            <div key={row.id} className="p-4 bg-matte-900/40 rounded-lg" data-testid={`approval-row-${row.id}`}>
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium">{row.name || row.id}</p>
                                  <p className="text-sm text-muted-foreground">{row.email || row.phone || '—'}</p>
                                  {row.source && (
                                    <span data-testid={`lead-source-${row.id}`} className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                                      🌐 Lead from {row.source}
                                    </span>
                                  )}
                                  {row.created_at && <p className="text-xs text-muted-foreground">Applied {new Date(row.created_at).toLocaleDateString()}</p>}
                                </div>
                                <div className="flex gap-2">
                                  <Button data-testid={`view-applicant-btn-${row.id}`} size="sm" variant="outline" onClick={() => setDetailApproval({ ...row, kind })}>
                                    <Eye className="h-4 w-4 mr-1" />View
                                  </Button>
                                  <Button data-testid={`approve-btn-${row.id}`} size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleApproval(kind, row.id, 'approve')}>
                                    <CheckCircle className="h-4 w-4 mr-1" />Approve
                                  </Button>
                                  <Button data-testid={`reject-btn-${row.id}`} size="sm" variant="destructive" onClick={() => handleApproval(kind, row.id, 'reject')}>
                                    <X className="h-4 w-4 mr-1" />Reject
                                  </Button>
                                </div>
                              </div>
                              {kind === 'driver' && row.raw?.identity_verification && (
                                <div className="mt-3 pt-3 border-t border-border" data-testid={`approval-kyc-${row.id}`}>
                                  <span className="text-xs font-semibold text-gold-500">Automated KYC (Stripe Identity): </span>
                                  <Badge
                                    className={row.raw.identity_verification.status === 'verified'
                                      ? 'bg-green-600/20 text-green-400'
                                      : 'bg-yellow-600/20 text-yellow-400'}
                                  >
                                    {row.raw.identity_verification.status || 'not started'}
                                  </Badge>
                                </div>
                              )}
                              {kind === 'driver' && row.raw?.documents && Object.keys(row.raw.documents).length > 0 && (
                                <div className="mt-3 pt-3 border-t border-border" data-testid={`approval-docs-${row.id}`}>
                                  <p className="text-xs font-semibold text-gold-500 mb-2">Identity Documents (click to review)</p>
                                  <div className="flex flex-wrap gap-2">
                                    {Object.entries(row.raw.documents).map(([docType, docId]) => (
                                      <Button
                                        key={docType}
                                        size="sm"
                                        variant="outline"
                                        onClick={() => viewDocument(docId)}
                                        data-testid={`view-doc-${row.id}-${docType}`}
                                      >
                                        <FileText className="h-3.5 w-3.5 mr-1" />{DOC_LABELS[docType] || docType}
                                      </Button>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {kind === 'driver' && (!row.raw?.documents || Object.keys(row.raw.documents).length === 0) && (
                                <p className="mt-3 pt-3 border-t border-border text-xs text-yellow-500" data-testid={`approval-nodocs-${row.id}`}>
                                  ⚠ No identity documents were submitted with this application.
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {selectedTab === 'fraud' && (
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
                                ${(flag.amount || 0).toFixed(2)}
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

        {selectedTab === 'claims' && (
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
                                +${claim.resolution_credit.toFixed(2)} credited
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

        {selectedTab === 'zones' && (
          <div className="space-y-6" data-testid="admin-zones-content">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-gold-500" />Create Service Zone</CardTitle>
                <p className="text-sm text-muted-foreground">Define a polygon (3+ [lat,lng] points) to restrict operations to a specific geo region.</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Zone Name</Label>
                  <Input data-testid="zone-name-input" value={zoneForm.name} onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })} placeholder="Port of Spain Central" />
                </div>
                <div>
                  <Label>Polygon (JSON: [[lat,lng],[lat,lng],…])</Label>
                  <Textarea data-testid="zone-polygon-input" value={zoneForm.polygon} onChange={(e) => setZoneForm({ ...zoneForm, polygon: e.target.value })} placeholder='[[10.6,-61.6],[10.7,-61.6],[10.7,-61.45],[10.6,-61.45]]' />
                </div>
                <div>
                  <Label>Allowed Services (comma-separated)</Label>
                  <Input data-testid="zone-services-input" value={zoneForm.allowed_services} onChange={(e) => setZoneForm({ ...zoneForm, allowed_services: e.target.value })} placeholder="food,taxi,grocery,pharmacy" />
                </div>
                <div>
                  <Label>Description (optional)</Label>
                  <Input data-testid="zone-description-input" value={zoneForm.description} onChange={(e) => setZoneForm({ ...zoneForm, description: e.target.value })} />
                </div>
                <Button data-testid="create-zone-btn" onClick={createZone} className="bg-gold-gradient text-white" disabled={!zoneForm.name || !zoneForm.polygon}>
                  <Plus className="h-4 w-4 mr-2" />Create Zone
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-teal-700" />Active Zones ({zones.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {zones.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8" data-testid="zones-empty">No service zones defined yet.</p>
                ) : (
                  <div className="space-y-2">
                    {zones.map((z) => (
                      <div key={z.id} className="flex items-center justify-between p-4 bg-matte-900/40 rounded-lg" data-testid={`zone-row-${z.id}`}>
                        <div>
                          <p className="font-medium">{z.name}</p>
                          <p className="text-sm text-muted-foreground">{z.country} • {z.polygon?.length || 0} vertices</p>
                          {z.allowed_services && z.allowed_services.length > 0 && (
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {z.allowed_services.map((s) => <Badge key={s} variant="outline" className="text-xs">{s}</Badge>)}
                            </div>
                          )}
                        </div>
                        <Button data-testid={`delete-zone-btn-${z.id}`} size="sm" variant="destructive" onClick={() => deleteZone(z.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {selectedTab === 'whatsapp' && (
          <div className="space-y-4" data-testid="admin-whatsapp-content">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Send className="h-5 w-5 text-gold-500" />Send a WhatsApp message</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid sm:grid-cols-3 gap-3">
                  <Input
                    data-testid="wa-compose-phone"
                    value={whComposePhone}
                    onChange={(e) => setWhComposePhone(e.target.value)}
                    placeholder="To: +1868… (driver/merchant)"
                    className="sm:col-span-1"
                  />
                  <Input
                    data-testid="wa-compose-body"
                    value={whComposeBody}
                    onChange={(e) => setWhComposeBody(e.target.value)}
                    placeholder="Message…"
                    onKeyDown={(e) => e.key === 'Enter' && sendWhCompose()}
                    className="sm:col-span-2"
                  />
                </div>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-xs text-muted-foreground">
                    Note: Customers must message <span className="font-semibold">+1 (252) 374-6444</span> first to receive WhatsApp notifications (WhatsApp's 24h session rule). Once your message templates are approved by Meta, this restriction is lifted and notifications send freely.
                  </p>
                  <Button
                    data-testid="wa-compose-send-btn"
                    onClick={sendWhCompose}
                    disabled={whComposeSending || !whComposePhone.trim() || !whComposeBody.trim()}
                    className="bg-gold-gradient text-white"
                  >
                    {whComposeSending ? 'Sending…' : 'Send WhatsApp'}
                  </Button>
                </div>
                {whComposeFeedback && (
                  <p data-testid="wa-compose-feedback" className={`text-xs ${whComposeFeedback.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                    {whComposeFeedback.text}
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-3 gap-4">
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5 text-gold-500" />Conversations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
                {whConvos.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8" data-testid="whatsapp-no-convos">No WhatsApp messages yet.</p>
                ) : (
                  whConvos.map((c) => (
                    <div key={c.phone} onClick={() => openWhConvo(c.phone)} className={`p-3 rounded-lg cursor-pointer ${whSelectedPhone === c.phone ? 'bg-gold-500/10 border border-gold-500/30' : 'bg-matte-900/40 hover:bg-matte-900/60'}`} data-testid={`wa-convo-${c.phone}`}>
                      <p className="font-medium font-mono text-sm">{c.phone}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.last_message}</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">{c.count} msg • {new Date(c.last_at).toLocaleString()}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>{whSelectedPhone ? `Chat with ${whSelectedPhone}` : 'Select a conversation'}</CardTitle>
              </CardHeader>
              <CardContent>
                {!whSelectedPhone ? (
                  <p className="text-center text-muted-foreground py-12">Pick a conversation from the left.</p>
                ) : (
                  <>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto mb-4" data-testid="wa-thread">
                      {whMessages.map((m) => (
                        <div key={m.id} className={`p-3 rounded-lg max-w-[80%] ${m.direction === 'inbound' ? 'bg-matte-900/40 mr-auto' : 'bg-gold-500/15 ml-auto text-right'}`} data-testid={`wa-msg-${m.id}`}>
                          <p className="text-sm">{m.body}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(m.created_at).toLocaleTimeString()}
                            {m.direction === 'outbound' && m.status && (
                              <span
                                className={`ml-2 font-medium ${
                                  ['delivered', 'read', 'sent'].includes(m.status) ? 'text-green-600'
                                  : ['failed', 'undelivered'].includes(m.status) ? 'text-red-600'
                                  : 'text-muted-foreground'
                                }`}
                                data-testid={`wa-status-${m.id}`}
                              >
                                · {m.status}
                              </span>
                            )}
                          </p>
                          {m.direction === 'outbound' && ['failed', 'undelivered'].includes(m.status) && (
                            <p className="text-[11px] text-red-600 mt-1" data-testid={`wa-error-${m.id}`}>
                              {String(m.error_code) === '63005' || String(m.error_code) === '63016'
                                ? 'Not delivered — the customer is outside WhatsApp\u2019s 24-hour window. Business-initiated messages require an approved template.'
                                : `Not delivered${m.error_code ? ` (error ${m.error_code})` : ''}.`}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input data-testid="wa-reply-input" value={whReplyBody} onChange={(e) => setWhReplyBody(e.target.value)} placeholder="Type a reply…" onKeyDown={(e) => e.key === 'Enter' && sendWhReply()} />
                      <Button data-testid="wa-send-btn" onClick={sendWhReply} className="bg-gold-gradient text-white">
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
          </div>
        )}
        {selectedTab === 'mail' && (
          <AdminMailInbox />
        )}

        {selectedTab === 'wallet' && (
          <AdminWalletRequests />
        )}

        {selectedTab === 'banking' && (
          <AdminMercuryBanking />
        )}

        {selectedTab === 'team' && (
          <AdminTeam />
        )}

        {selectedTab === 'incentives' && (
          <AdminDriverIncentives />
        )}

        {selectedTab === 'promoters' && (
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
                          <div key={i} className="flex justify-between p-2">
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
                        +${detailClaim.resolution_credit.toFixed(2)} credited
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
                    <div><span className="text-muted-foreground">Amount</span><p className="font-medium">${(detailFraud.amount || 0).toFixed(2)}</p></div>
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
