import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import OrderChat from './OrderChat';
import { useAuth } from './AuthContext';
import { 
  Package, 
  DollarSign, 
  TrendingUp,
  Clock,
  CheckCircle,
  X,
  ChefHat,
  Eye,
  AlertCircle,
  Settings,
  BarChart3,
  Users,
  Store,
  Ticket,
  Megaphone,
  MessageCircle
} from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const VendorDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [chatOpenFor, setChatOpenFor] = useState(null);
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({
    today_orders: 0,
    today_revenue: 0,
    pending_orders: 0,
    total_earnings: 0
  });
  const [selectedTab, setSelectedTab] = useState('pending');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
    fetchStats();
    fetchSetupStatus();
    fetchSavings();
    
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchOrders();
      fetchStats();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const [setup, setSetup] = useState(null);
  const [savings, setSavings] = useState(null);
  const [setupDismissed, setSetupDismissed] = useState(
    () => localStorage.getItem('storefront_setup_dismissed') === '1'
  );
  const fetchSavings = async () => {
    try {
      const token = localStorage.getItem('token');
      const cfg = { withCredentials: false, headers: token ? { Authorization: `Bearer ${token}` } : {} };
      const { data } = await axios.get(`${API}/merchant/fee-savings`, cfg);
      setSavings(data);
    } catch (e) {
      setSavings(null);
    }
  };
  const fetchSetupStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const cfg = { withCredentials: false, headers: token ? { Authorization: `Bearer ${token}` } : {} };
      const [sf, pr] = await Promise.all([
        axios.get(`${API}/merchant/storefront`, cfg),
        axios.get(`${API}/merchant/products`, cfg),
      ]);
      setSetup({
        hasLogo: !!sf.data?.logo,
        hasCover: !!sf.data?.cover,
        hasBio: !!(sf.data?.bio && sf.data.bio.trim()),
        hasProducts: (pr.data?.products || []).length > 0,
      });
    } catch (e) {
      setSetup(null); // not a merchant yet / not resolvable — hide banner
    }
  };

  const fetchOrders = async () => {
    try {
      const response = await axios.get(`${API}/vendors/my-orders`, {
        withCredentials: false
      });
      setOrders(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/vendors/stats`, {
        withCredentials: false
      });
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleOrderAction = async (orderId, status) => {
    try {
      await axios.put(`${API}/orders/${orderId}/status`, {
        status: status
      }, {
        params: { status },
        withCredentials: false
      });
      
      fetchOrders();
      fetchStats();
    } catch (error) {
      console.error('Error updating order:', error);
      alert('Failed to update order');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-gold-500/15 text-yellow-800',
      confirmed: 'bg-neon-cyan/15 text-teal-700',
      preparing: 'bg-purple-100 text-purple-800',
      ready: 'bg-green-100 text-green-800',
      picked_up: 'bg-indigo-100 text-indigo-800',
      in_transit: 'bg-neon-cyan/15 text-teal-700',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-matte-800 text-foreground';
  };

  const filterOrders = (status) => {
    if (status === 'active') {
      return orders.filter(o => ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status));
    }
    if (status === 'completed') {
      return orders.filter(o => ['delivered', 'cancelled'].includes(o.status));
    }
    return orders.filter(o => o.status === status);
  };

  const filteredOrders = filterOrders(selectedTab);

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
              <h1 className="text-3xl font-bold text-foreground">Vendor Dashboard</h1>
              <p className="text-muted-foreground">Manage your orders and business</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => navigate('/menu-management')} variant="outline">
                <ChefHat className="h-5 w-5 mr-2" />
                Manage Menu
              </Button>
              <Button onClick={() => navigate('/merchant/storefront')} variant="outline" data-testid="vendor-storefront-btn">
                <Store className="h-5 w-5 mr-2" />
                My Storefront
              </Button>
              <Button onClick={() => navigate('/merchant/coupons')} variant="outline" data-testid="vendor-coupons-btn">
                <Ticket className="h-5 w-5 mr-2" />
                Coupons
              </Button>
              <Button onClick={() => navigate('/merchant/ads')} variant="outline" data-testid="vendor-ads-btn">
                <Megaphone className="h-5 w-5 mr-2" />
                Advertise
              </Button>
              <Button onClick={() => navigate('/merchant/subscription')} variant="outline" data-testid="vendor-subscription-link">
                <DollarSign className="h-5 w-5 mr-2" />
                Subscription
              </Button>
              <Button onClick={() => navigate('/vendor/settings')} variant="outline" data-testid="vendor-settings-btn">
                <Settings className="h-5 w-5 mr-2" />
                Settings
              </Button>
            </div>
          </div>

          {/* Premium fee-savings ROI banner — shows commission saved vs the Standard 10% base */}
          {savings && (() => {
            const money = (n) => `${savings.currency || 'TTD'} $${Number(n || 0).toFixed(2)}`;
            const isPremium = savings.tier === 'premium';
            const isPro = savings.tier === 'pro';
            // Premium/Pro: celebrate savings. Standard: upsell with potential savings.
            const headline = isPremium
              ? `You saved ${money(savings.saved)} in fees this month`
              : isPro
              ? `You saved ${money(savings.saved)} this month with Professional`
              : savings.potential_extra_savings > 0
              ? `You could have saved ${money(savings.potential_extra_savings)} this month on Premium`
              : null;
            if (!headline) return null;
            const sub = isPremium
              ? `${savings.orders} order${savings.orders === 1 ? '' : 's'} • 0% commission on Premium (Standard would have cost ${money(savings.standard_commission)}).`
              : savings.upgrade_tier === 'premium'
              ? `Upgrade to Premium (0% commission) and keep an extra ${money(savings.potential_extra_savings)} a month.`
              : '';
            return (
              <div
                className="mb-6 rounded-xl border border-gold-500/40 bg-gold-gradient/5 bg-gradient-to-r from-gold-500/10 to-neon-cyan/5 p-4"
                data-testid="fee-savings-banner"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-gold-500/15 p-2.5">
                      <TrendingUp className="h-5 w-5 text-gold-500" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-foreground" data-testid="fee-savings-headline">{headline}</h3>
                      {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
                      <p className="mt-0.5 text-xs text-muted-foreground">{savings.month}</p>
                    </div>
                  </div>
                  {!isPremium && (
                    <Button
                      size="sm"
                      className="bg-gold-gradient text-white shrink-0"
                      onClick={() => navigate('/merchant/subscription')}
                      data-testid="fee-savings-upgrade-btn"
                    >
                      Upgrade to Premium
                    </Button>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Storefront completion checklist — helps newly-approved merchants go live in search */}
          {setup && !setupDismissed && (() => {
            const steps = [
              { key: 'hasLogo', label: 'Add a logo', done: setup.hasLogo, to: '/merchant/storefront' },
              { key: 'hasCover', label: 'Add a cover photo', done: setup.hasCover, to: '/merchant/storefront' },
              { key: 'hasBio', label: 'Write a short bio', done: setup.hasBio, to: '/merchant/storefront' },
              { key: 'hasProducts', label: 'Add your first product', done: setup.hasProducts, to: '/merchant/products' },
            ];
            const doneCount = steps.filter((s) => s.done).length;
            if (doneCount === steps.length) return null;
            const next = steps.find((s) => !s.done);
            return (
              <div className="mb-6 rounded-xl border border-gold-500/40 bg-gold-500/5 p-4" data-testid="storefront-setup-banner">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Store className="h-5 w-5 text-gold-500" />
                      <h3 className="text-base font-semibold text-foreground">Finish setting up your storefront</h3>
                      <span className="text-xs text-muted-foreground">{doneCount}/{steps.length} done</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">Complete these so your store looks great and shows up in customer search.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {steps.map((s) => (
                        <button
                          key={s.key}
                          onClick={() => navigate(s.to)}
                          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                            s.done
                              ? 'border-green-500/30 bg-green-500/10 text-green-700'
                              : 'border-border hover:border-gold-500 text-foreground'
                          }`}
                          data-testid={`setup-step-${s.key}`}
                        >
                          {s.done ? <CheckCircle className="h-3.5 w-3.5" /> : <span className="h-3.5 w-3.5 rounded-full border border-current inline-block" />}
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <Button size="sm" className="bg-gold-gradient text-white" onClick={() => navigate(next.to)} data-testid="setup-continue-btn">
                      {next.label}
                    </Button>
                    <button
                      onClick={() => { setSetupDismissed(true); localStorage.setItem('storefront_setup_dismissed', '1'); }}
                      className="text-xs text-muted-foreground hover:text-foreground"
                      data-testid="setup-dismiss-btn"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Today&apos;s Orders</p>
                    <p className="text-3xl font-bold text-foreground">{stats.today_orders}</p>
                  </div>
                  <div className="bg-neon-cyan/15 p-3 rounded-lg">
                    <Package className="h-6 w-6 text-teal-700" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Today&apos;s Revenue</p>
                    <p className="text-3xl font-bold text-gold-500">
                      ${stats.today_revenue?.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-gold-500/15 p-3 rounded-lg">
                    <DollarSign className="h-6 w-6 text-gold-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pending Orders</p>
                    <p className="text-3xl font-bold text-yellow-600">{stats.pending_orders}</p>
                  </div>
                  <div className="bg-gold-500/15 p-3 rounded-lg">
                    <Clock className="h-6 w-6 text-yellow-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Earnings</p>
                    <p className="text-3xl font-bold text-green-600">
                      ${stats.total_earnings?.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-green-100 p-3 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Orders Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Orders</span>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => navigate('/merchant/products')} className="bg-gold-gradient text-white" data-testid="manage-products-btn">
                  Products &amp; Menu
                </Button>
                <Button size="sm" variant="outline" onClick={() => fetchOrders()}>
                  Refresh
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Tabs */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              {[
                { id: 'pending', label: 'Pending', count: orders.filter(o => o.status === 'pending').length },
                { id: 'active', label: 'Active', count: filterOrders('active').length },
                { id: 'preparing', label: 'Preparing', count: orders.filter(o => o.status === 'preparing').length },
                { id: 'ready', label: 'Ready', count: orders.filter(o => o.status === 'ready').length },
                { id: 'completed', label: 'Completed', count: filterOrders('completed').length }
              ].map((tab) => (
                <Button
                  key={tab.id}
                  variant={selectedTab === tab.id ? 'default' : 'outline'}
                  onClick={() => setSelectedTab(tab.id)}
                  size="sm"
                >
                  {tab.label} ({tab.count})
                </Button>
              ))}
            </div>

            {/* Orders List */}
            {filteredOrders.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">No orders</h3>
                <p className="text-muted-foreground">You don&apos;t have any {selectedTab} orders</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map((order) => (
                  <Card key={order.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-lg">
                              Order #{order.id?.substring(0, 8)}
                            </h3>
                            <Badge className={getStatusColor(order.status)}>
                              {order.status?.toUpperCase()}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>
                              <Clock className="h-4 w-4 inline mr-1" />
                              {new Date(order.created_at).toLocaleString()}
                            </p>
                            <p>
                              <Users className="h-4 w-4 inline mr-1" />
                              Customer: {order.customer_phone || 'N/A'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-gold-500">
                            ${order.vendor_payout?.toFixed(2) || order.subtotal?.toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">Your payout</p>
                        </div>
                      </div>

                      {/* Order Items */}
                      {order.items && order.items.length > 0 && (
                        <div className="mb-4 p-4 bg-background rounded-lg">
                          <p className="font-medium text-sm mb-2">Items:</p>
                          {order.items.map((item, idx) => (
                            <div key={`${item.menu_item_id || item.name}-${idx}`} className="flex justify-between text-sm">
                              <span>{item.quantity}x {item.name}</span>
                              <span>${(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Delivery Info */}
                      {order.delivery_address && (
                        <div className="mb-4 text-sm text-muted-foreground">
                          <p className="font-medium">Delivery Address:</p>
                          <p>{order.delivery_address.street_address}</p>
                          <p>{order.delivery_address.city}, {order.delivery_address.postal_code}</p>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 pt-4 border-t">
                        {order.status === 'pending' && (
                          <>
                            <Button
                              onClick={() => handleOrderAction(order.id, 'confirmed')}
                              className="flex-1 bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Accept Order
                            </Button>
                            <Button
                              onClick={() => handleOrderAction(order.id, 'cancelled')}
                              variant="destructive"
                              className="flex-1"
                            >
                              <X className="h-4 w-4 mr-2" />
                              Reject
                            </Button>
                          </>
                        )}

                        {order.status === 'confirmed' && (
                          <Button
                            onClick={() => handleOrderAction(order.id, 'preparing')}
                            className="flex-1"
                          >
                            Start Preparing
                          </Button>
                        )}

                        {order.status === 'preparing' && (
                          <Button
                            onClick={() => handleOrderAction(order.id, 'ready')}
                            className="flex-1 bg-green-600 hover:bg-green-700"
                          >
                            Mark as Ready
                          </Button>
                        )}

                        {(order.status === 'ready' || order.status === 'picked_up' || order.status === 'in_transit') && (
                          <Button variant="outline" className="flex-1" disabled>
                            <Clock className="h-4 w-4 mr-2" />
                            Waiting for Delivery
                          </Button>
                        )}

                        <Button
                          onClick={() => setChatOpenFor((cur) => cur === order.id ? null : order.id)}
                          variant={chatOpenFor === order.id ? 'default' : 'outline'}
                          size="sm"
                          data-testid={`vendor-chat-${order.id}`}
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() => navigate(`/order-tracking/${order.id}`)}
                          variant="outline"
                          size="sm"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>

                      {chatOpenFor === order.id && (
                        <div className="mt-4" data-testid={`vendor-chat-wrapper-${order.id}`}>
                          <OrderChat
                            orderId={order.id}
                            currentUserId={user?.id}
                            viewerRole="vendor"
                            title="Customer & driver"
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VendorDashboard;
