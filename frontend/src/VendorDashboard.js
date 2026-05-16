import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
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
  Users
} from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const VendorDashboard = () => {
  const navigate = useNavigate();
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
    
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchOrders();
      fetchStats();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await axios.get(`${API}/vendors/my-orders`, {
        withCredentials: true
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
        withCredentials: true
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
        withCredentials: true
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
      confirmed: 'bg-neon-cyan/15 text-neon-cyan',
      preparing: 'bg-purple-100 text-purple-800',
      ready: 'bg-green-100 text-green-800',
      picked_up: 'bg-indigo-100 text-indigo-800',
      in_transit: 'bg-neon-cyan/15 text-neon-cyan',
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
              <Button onClick={() => navigate('/vendor/settings')} variant="outline">
                <Settings className="h-5 w-5 mr-2" />
                Settings
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Today's Orders</p>
                    <p className="text-3xl font-bold text-foreground">{stats.today_orders}</p>
                  </div>
                  <div className="bg-neon-cyan/15 p-3 rounded-lg">
                    <Package className="h-6 w-6 text-neon-cyan" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Today's Revenue</p>
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
              <Button size="sm" variant="outline" onClick={() => fetchOrders()}>
                Refresh
              </Button>
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
                <p className="text-muted-foreground">You don't have any {selectedTab} orders</p>
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
                            <div key={idx} className="flex justify-between text-sm">
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
                          onClick={() => navigate(`/order-tracking/${order.id}`)}
                          variant="outline"
                          size="sm"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
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
