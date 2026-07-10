import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { 
  Navigation,
  Wallet,
  Power,
  AlertCircle,
  Star,
  DollarSign
} from 'lucide-react';
import axios from 'axios';
import DriverEarningsCards from './DriverEarningsCards';
import OrderRequestCard from './OrderRequestCard';
import ActiveOrderCard from './ActiveOrderCard';
import { useLocationConsent } from './LocationConsentContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DriverDashboard = () => {
  const navigate = useNavigate();
  const { requestLocationConsent } = useLocationConsent();
  const [driver, setDriver] = useState(null);
  const [orderRequests, setOrderRequests] = useState([]);
  const [activeOrders, setActiveOrders] = useState([]);
  const [earnings, setEarnings] = useState({
    today: 0,
    week: 0,
    balance: 0,
    pending: 0
  });
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [locationTracking, setLocationTracking] = useState(null);
  const [incentives, setIncentives] = useState({ total_earned: 0, incentives: [] });

  useEffect(() => {
    fetchDriverData();
    fetchOrderRequests();
    fetchActiveOrders();
    fetchEarnings();

    // Refresh every 10 seconds
    const interval = setInterval(() => {
      fetchOrderRequests();
      fetchActiveOrders();
      fetchEarnings();
    }, 10000);

    return () => clearInterval(interval);
    // eslint-disable-next-line -- polling interval set once on mount
  }, []);

  // Start location tracking when online
  useEffect(() => {
    if (isOnline && driver) {
      startLocationTracking();
    } else {
      stopLocationTracking();
    }
    // eslint-disable-next-line -- start/stop tracking helpers are stable
  }, [isOnline, driver]);

  const fetchDriverData = async () => {
    try {
      const response = await axios.get(`${API}/drivers/me`, {
        withCredentials: false
      });
      setDriver(response.data);
      setIsOnline(response.data.status === 'online');
      setLoading(false);
    } catch (error) {
      console.error('Error fetching driver data:', error);
      setLoading(false);
    }
  };

  const fetchOrderRequests = async () => {
    try {
      const response = await axios.get(`${API}/drivers/order-requests`, {
        withCredentials: false
      });
      setOrderRequests(response.data);
    } catch (error) {
      console.error('Error fetching order requests:', error);
    }
  };

  const fetchActiveOrders = async () => {
    try {
      const response = await axios.get(`${API}/drivers/active-orders`, {
        withCredentials: false
      });
      setActiveOrders(response.data);
    } catch (error) {
      console.error('Error fetching active orders:', error);
    }
  };

  const fetchEarnings = async () => {
    try {
      const response = await axios.get(`${API}/drivers/${driver?.id}/wallet`, {
        withCredentials: false
      });
      setEarnings({
        today: response.data.today_earnings || 0,
        week: response.data.week_earnings || 0,
        balance: response.data.available_balance || 0,
        pending: response.data.pending_earnings || 0
      });
      // Fetch review-driven bonuses (5-star bonuses + weekly top-driver bonuses)
      try {
        const inc = await axios.get(`${API}/drivers/${driver?.id}/incentives`, { withCredentials: false });
        setIncentives(inc.data || { total_earned: 0, incentives: [] });
      } catch (incErr) { console.debug('No incentives for driver:', incErr?.message); }
    } catch (error) {
      console.error('Error fetching earnings:', error);
    }
  };

  const toggleOnlineStatus = async () => {
    try {
      const newStatus = isOnline ? 'offline' : 'online';
      await axios.put(`${API}/drivers/status`, {
        status: newStatus
      }, {
        withCredentials: false
      });
      setIsOnline(!isOnline);
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
    }
  };

  const startLocationTracking = async () => {
    if (!navigator.geolocation) {
      alert('Geolocation not supported');
      return;
    }

    const granted = await requestLocationConsent();
    if (!granted) return;

    // Clear any existing watcher to avoid duplicate trackers.
    if (locationTracking) {
      navigator.geolocation.clearWatch(locationTracking);
    }

    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude, heading, speed } = position.coords;

        try {
          const token = localStorage.getItem('token');
          const params = { latitude, longitude };
          if (typeof heading === 'number' && !Number.isNaN(heading)) params.heading = heading;
          if (typeof speed === 'number' && !Number.isNaN(speed)) params.speed = speed;
          await axios.post(`${API}/drivers/${driver.id}/location`, null, {
            params,
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
        } catch (error) {
          console.error('Error updating location:', error);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );

    setLocationTracking(watchId);
  };

  const stopLocationTracking = () => {
    if (locationTracking) {
      navigator.geolocation.clearWatch(locationTracking);
      setLocationTracking(null);
    }
  };

  const handleAcceptOrder = async (orderId) => {
    try {
      await axios.post(`${API}/orders/${orderId}/accept-driver`, {
        driver_id: driver.id
      }, {
        withCredentials: false
      });
      
      fetchOrderRequests();
      fetchActiveOrders();
    } catch (error) {
      console.error('Error accepting order:', error);
      alert('Failed to accept order');
    }
  };

  const handleRejectOrder = async (orderId) => {
    try {
      await axios.post(`${API}/orders/${orderId}/reject-driver`, {
        driver_id: driver.id
      }, {
        withCredentials: false
      });
      
      fetchOrderRequests();
    } catch (error) {
      console.error('Error rejecting order:', error);
    }
  };

  const handleUpdateOrderStatus = async (orderId, status) => {
    try {
      await axios.put(`${API}/orders/${orderId}/status`, {
        status: status
      }, {
        params: { status },
        withCredentials: false
      });
      
      fetchActiveOrders();
    } catch (error) {
      console.error('Error updating order status:', error);
      alert('Failed to update order');
    }
  };

  const handleDeliverCOD = async (order) => {
    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    if (!window.confirm(`Confirm you collected $${Number(order.total || 0).toFixed(2)} cash from the customer?`)) return;
    try {
      await axios.put(`${API}/orders/${order.id}/status`, { status: 'delivered' }, { params: { status: 'delivered' }, headers, withCredentials: false });
      const r = await axios.post(`${API}/orders/${order.id}/cash-collected`, {}, { headers, withCredentials: false });
      alert(`Cash collected. You keep $${r.data.driver_keeps?.toFixed(2)}; $${r.data.platform_due?.toFixed(2)} is owed to IslandHop.`);
      fetchActiveOrders();
    } catch (error) {
      console.error('Error confirming cash:', error);
      alert(error.response?.data?.detail || 'Failed to confirm cash collected');
    }
  };

  const handleNavigate = (address) => {
    // Open Google Maps
    const destination = `${address.latitude},${address.longitude}`;
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}`, '_blank');
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
              <h1 className="text-3xl font-bold text-foreground">Driver Dashboard</h1>
              <p className="text-muted-foreground">Manage your deliveries and earnings</p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={toggleOnlineStatus}
                className={isOnline ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'}
              >
                <Power className="h-5 w-5 mr-2" />
                {isOnline ? 'Go Offline' : 'Go Online'}
              </Button>
              <Button onClick={() => navigate('/driver/earnings')} variant="outline">
                <Wallet className="h-5 w-5 mr-2" />
                Wallet
              </Button>
              <Button onClick={() => navigate('/driver/subscription')} variant="outline" data-testid="driver-subscription-link">
                <DollarSign className="h-5 w-5 mr-2" />
                Subscription
              </Button>
            </div>
          </div>

          {/* Status Alert */}
          {!isOnline && (
            <div className="bg-gold-500/10 border-l-4 border-yellow-400 p-4 mb-6">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-gold-300" />
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    You&apos;re currently offline. Go online to start receiving order requests.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Earnings Cards */}
          <DriverEarningsCards earnings={earnings} />
        </div>

        {/* Review-driven driver incentives */}
        {incentives.total_earned > 0 && (
          <Card className="mb-6 bg-gold-gradient text-matte-900 border-0 shadow-gold-glow" data-testid="driver-incentives-card">
            <CardContent className="p-6 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <Star className="h-7 w-7 fill-matte-900" />
                <div>
                  <p className="text-xs uppercase tracking-wider font-bold opacity-80">Review bonuses earned</p>
                  <p className="text-3xl font-black">${incentives.total_earned.toFixed(2)}</p>
                </div>
              </div>
              <div className="text-right text-xs leading-snug max-w-xs">
                <p className="font-semibold">{incentives.incentives.length} bonus{incentives.incentives.length === 1 ? '' : 'es'} so far.</p>
                <p className="opacity-80">$1 per 5★ review + $25 weekly bonus for avg ≥ 4.8★ over 10+ ratings.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Order Requests */}
        {orderRequests.length > 0 && (
          <Card className="mb-6 border-l-4 border-l-turquoise-500">
            <CardHeader>
              <CardTitle className="text-gold-500">
                New Order Requests ({orderRequests.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {orderRequests.map((order) => (
                  <OrderRequestCard
                    key={order.id}
                    order={order}
                    onAccept={handleAcceptOrder}
                    onReject={handleRejectOrder}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active Orders */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Active Deliveries ({activeOrders.length})</span>
              <Button size="sm" variant="outline" onClick={fetchActiveOrders}>
                Refresh
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeOrders.length === 0 ? (
              <div className="text-center py-12">
                <Navigation className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">No active deliveries</h3>
                <p className="text-muted-foreground">
                  {isOnline ? 'Waiting for order requests...' : 'Go online to start receiving orders'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeOrders.map((order) => (
                  <ActiveOrderCard
                    key={order.id}
                    order={order}
                    onNavigate={handleNavigate}
                    onUpdateStatus={handleUpdateOrderStatus}
                    onDeliverCOD={handleDeliverCOD}
                    onView={(id) => navigate(`/order-tracking/${id}`)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DriverDashboard;
