import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Textarea } from './components/ui/textarea';
import { Label } from './components/ui/label';
import { Badge } from './components/ui/badge';
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
  Plus
} from 'lucide-react';
import axios from 'axios';

import AdminStatsCards from './AdminStatsCards';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const AdminPanel = () => {
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
  const [selectedTab, setSelectedTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    fetchUsers();
    fetchOrders();
    fetchDisputes();
  }, []);

  useEffect(() => {
    if (selectedTab === 'approvals') fetchApprovals();
    if (selectedTab === 'zones') fetchZones();
    if (selectedTab === 'whatsapp') fetchWhConvos();
  }, [selectedTab]);

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

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/admin/users`, {
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
    return map[status] || 'bg-neon-cyan/15 text-neon-cyan';
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
            <Button variant="outline">
              <Settings className="h-5 w-5 mr-2" />
              Settings
            </Button>
          </div>

          {/* Stats Overview */}
          <AdminStatsCards stats={stats} />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {['overview', 'users', 'orders', 'approvals', 'zones', 'whatsapp', 'disputes', 'analytics'].map((tab) => (
            <Button
              key={tab}
              variant={selectedTab === tab ? 'default' : 'outline'}
              onClick={() => setSelectedTab(tab)}
              data-testid={`admin-tab-${tab}`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
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
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="border-b hover:bg-background">
                        <td className="p-3">
                          <div>
                            <p className="font-medium">{user.name || 'N/A'}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
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
                        <td className="p-3">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline">
                              <Eye className="h-4 w-4" />
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
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {selectedTab === 'orders' && (
          <Card>
            <CardHeader>
              <CardTitle>Orders Management ({filteredOrders.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredOrders.map((order) => (
                  <Card key={order.id} className="hover:shadow-md transition-shadow">
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
                            ${order.total?.toFixed(2)}
                          </p>
                          <div className="flex gap-2 mt-2">
                            <Button size="sm" variant="outline">
                              <Eye className="h-4 w-4" />
                            </Button>
                            {order.status === 'pending' && (
                              <Button 
                                size="sm" 
                                variant="destructive"
                                onClick={() => handleOrderAction(order.id, 'cancel')}
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
                            <div key={row.id} className="flex items-center justify-between p-4 bg-matte-900/40 rounded-lg" data-testid={`approval-row-${row.id}`}>
                              <div>
                                <p className="font-medium">{row.name || row.id}</p>
                                <p className="text-sm text-muted-foreground">{row.email || row.phone || '—'}</p>
                                {row.created_at && <p className="text-xs text-muted-foreground">Applied {new Date(row.created_at).toLocaleDateString()}</p>}
                              </div>
                              <div className="flex gap-2">
                                <Button data-testid={`approve-btn-${row.id}`} size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleApproval(kind, row.id, 'approve')}>
                                  <CheckCircle className="h-4 w-4 mr-1" />Approve
                                </Button>
                                <Button data-testid={`reject-btn-${row.id}`} size="sm" variant="destructive" onClick={() => handleApproval(kind, row.id, 'reject')}>
                                  <X className="h-4 w-4 mr-1" />Reject
                                </Button>
                              </div>
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
                <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-neon-cyan" />Active Zones ({zones.length})</CardTitle>
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
          <div className="grid md:grid-cols-3 gap-4" data-testid="admin-whatsapp-content">
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
                          <p className="text-xs text-muted-foreground mt-1">{new Date(m.created_at).toLocaleTimeString()}</p>
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
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;

