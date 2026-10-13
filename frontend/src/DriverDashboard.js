import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from './hooks/use-toast';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { 
  Navigation,
  Wallet,
  Power,
  AlertCircle,
  Star,
  DollarSign,
  Settings,
  MapPin
} from 'lucide-react';
import axios from 'axios';
import DriverEarningsCards from './DriverEarningsCards';
import OrderRequestCard from './OrderRequestCard';
import ActiveOrderCard from './ActiveOrderCard';
import LiveDeliveryMap from './LiveDeliveryMap';
import DriverRouteCard from './DriverRouteCard';
import { useLocationConsent } from './LocationConsentContext';
import { useCurrency } from './CurrencyContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DriverDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { format } = useCurrency();
  const { requestLocationConsent } = useLocationConsent();
  const wsRef = useRef(null);
  const prevReqCount = useRef(0);
  const prevAvailCount = useRef(0);
  const [driver, setDriver] = useState(null);
  const [driverLoc, setDriverLoc] = useState(null);
  const [orderRequests, setOrderRequests] = useState([]);
  const [availableOrders, setAvailableOrders] = useState([]);
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
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
    fetchDriverData();
    fetchOrderRequests();
    fetchAvailableOrders();
    fetchActiveOrders();
    fetchEarnings();
    fetchSubscription();

    // Refresh every 10 seconds
    const interval = setInterval(() => {
      fetchOrderRequests();
      fetchAvailableOrders();
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

  // Real-time new-order alerts over WebSocket (in addition to the 10s poll) so a driver
  // is actively notified the moment a job is offered, even between polls.
  useEffect(() => {
    const uid = driver?.user_id;
    if (!uid || !isOnline) return undefined;
    let closed = false;
    try {
      const wsUrl = `${API.replace(/^http/, 'ws').replace(/\/api$/, '')}/ws/${uid}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === 'new_order_request') {
            fetchOrderRequests();
            fetchAvailableOrders();
          } else if (msg.type === 'available_orders') {
            fetchAvailableOrders();
          }
        } catch (_) { /* ignore */ }
      };
      ws.onclose = () => { if (!closed) wsRef.current = null; };
    } catch (_) { /* ignore */ }
    return () => {
      closed = true;
      try { wsRef.current && wsRef.current.close(); } catch (_) { /* ignore */ }
      wsRef.current = null;
    };
    // eslint-disable-next-line -- reconnect only on identity/online change
  }, [driver?.user_id, isOnline]);

  const fetchDriverData = async () => {
    try {
      const response = await axios.get(`${API}/drivers/me`, {
        withCredentials: true
      });
      setDriver(response.data);
      setIsOnline(response.data.status === 'online');
      setLoading(false);
    } catch (error) {
      console.error('Error fetching driver data:', error);
      setLoading(false);
    }
  };

  const playPing = () => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = 880;
      o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
      o.start(); o.stop(ctx.currentTime + 0.5);
    } catch (_) { /* ignore */ }
  };

  const alertNewRequests = (list) => {
    const count = Array.isArray(list) ? list.length : 0;
    if (count > prevReqCount.current) {
      playPing();
      toast({ title: '🚗 New order request!', description: 'A pickup is waiting — review and accept it below.' });
    }
    prevReqCount.current = count;
  };

  // Distinct two-tone chime for the open "Available Now" pool (different from the direct-offer ping).
  const playJobChime = () => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const tone = (freq, start, dur) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = freq;
        o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
        g.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + start + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
        o.start(ctx.currentTime + start); o.stop(ctx.currentTime + start + dur);
      };
      tone(660, 0, 0.22);
      tone(990, 0.18, 0.32);
    } catch (_) { /* ignore */ }
  };

  const alertAvailable = (list) => {
    const count = Array.isArray(list) ? list.length : 0;
    if (isOnline && count > prevAvailCount.current) {
      playJobChime();
      toast({ title: '📦 New job available!', description: 'A waiting order just landed in Available Now — grab it fast.' });
    }
    prevAvailCount.current = count;
  };

  const fetchOrderRequests = async () => {
    try {
      const response = await axios.get(`${API}/drivers/order-requests`, {
        withCredentials: true
      });
      setOrderRequests(response.data);
      alertNewRequests(response.data);
    } catch (error) {
      console.error('Error fetching order requests:', error);
    }
  };

  const fetchAvailableOrders = async () => {
    try {
      const response = await axios.get(`${API}/drivers/available-orders`, { withCredentials: true });
      const list = Array.isArray(response.data) ? response.data : [];
      setAvailableOrders(list);
      alertAvailable(list);
    } catch (error) {
      // silent — driver may be pending approval
    }
  };

  const fetchActiveOrders = async () => {
    try {
      const response = await axios.get(`${API}/drivers/active-orders`, {
        withCredentials: true
      });
      setActiveOrders(response.data);
    } catch (error) {
      console.error('Error fetching active orders:', error);
    }
  };

  const fetchSubscription = async () => {
    try {
      const response = await axios.get(`${API}/driver/subscription`, { withCredentials: true });
      setSubscription(response.data);
    } catch (error) {
      console.error('Error fetching subscription:', error);
    }
  };

  const fetchEarnings = async () => {
    try {
      const response = await axios.get(`${API}/drivers/${driver?.id}/wallet`, {
        withCredentials: true
      });
      setEarnings({
        today: response.data.today_earnings || 0,
        week: response.data.week_earnings || 0,
        balance: response.data.available_balance || 0,
        pending: response.data.pending_earnings || 0
      });
      // Fetch review-driven bonuses (5-star bonuses + weekly top-driver bonuses)
      try {
        const inc = await axios.get(`${API}/drivers/${driver?.id}/incentives`, { withCredentials: true });
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
        withCredentials: true
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
        setDriverLoc({ lat: latitude, lng: longitude });
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
        withCredentials: true
      });
      toast({ title: '✅ Order accepted!', description: 'Head to pickup.' });
      fetchOrderRequests();
      fetchAvailableOrders();
      fetchActiveOrders();
    } catch (error) {
      const msg = error?.response?.data?.detail || 'Failed to accept order — it may have just been taken.';
      toast({ title: 'Could not accept order', description: msg, variant: 'destructive' });
      fetchAvailableOrders();
    }
  };

  const handleRejectOrder = async (orderId) => {
    try {
      await axios.post(`${API}/orders/${orderId}/reject-driver`, {
        driver_id: driver.id
      }, {
        withCredentials: true
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
        withCredentials: true
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
      await axios.put(`${API}/orders/${order.id}/status`, { status: 'delivered' }, { params: { status: 'delivered' }, headers, withCredentials: true });
      const r = await axios.post(`${API}/orders/${order.id}/cash-collected`, {}, { headers, withCredentials: true });
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
                data-testid="driver-online-toggle"
              >
                <Power className="h-5 w-5 mr-2" />
                {isOnline ? 'Go Offline' : 'Go Online'}
              </Button>
              <Button onClick={() => navigate('/driver/earnings')} variant="outline">
                <Wallet className="h-5 w-5 mr-2" />
                Earnings
              </Button>
              <Button onClick={() => navigate('/wallet')} variant="outline" data-testid="driver-wallet-btn">
                <Wallet className="h-5 w-5 mr-2" />
                Wallet
              </Button>
              <Button onClick={() => navigate('/driver/subscription')} variant="outline" data-testid="driver-subscription-link">
                <DollarSign className="h-5 w-5 mr-2" />
                Subscription
              </Button>
              <Button onClick={() => navigate('/driver/settings')} variant="outline" data-testid="driver-settings-btn">
                <Settings className="h-5 w-5 mr-2" />
                Settings
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
                    subscription={subscription}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Available Now — open pool any driver can grab */}
        {(() => {
          const offeredIds = new Set(orderRequests.map((o) => o.id));
          const toRad = (d) => (d * Math.PI) / 180;
          const haversineKm = (a, b) => {
            if (!a || !b) return null;
            const [lat1, lng1] = a; const [lat2, lng2] = b;
            if ([lat1, lng1, lat2, lng2].some((v) => typeof v !== 'number' || Number.isNaN(v))) return null;
            const R = 6371;
            const dLat = toRad(lat2 - lat1); const dLng = toRad(lng2 - lng1);
            const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
            return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
          };
          const pickupCoords = (o) => {
            const p = o.pickup_address || {};
            const lat = p.latitude ?? p.lat; const lng = p.longitude ?? p.lng;
            return (typeof lat === 'number' && typeof lng === 'number') ? [lat, lng] : null;
          };
          const me = driverLoc ? [driverLoc.lat, driverLoc.lng] : null;
          const pool = availableOrders
            .filter((o) => !offeredIds.has(o.id))
            .map((o) => ({ ...o, _distanceKm: me ? haversineKm(me, pickupCoords(o)) : null }))
            .sort((a, b) => {
              if (a._distanceKm == null && b._distanceKm == null) return 0;
              if (a._distanceKm == null) return 1;
              if (b._distanceKm == null) return -1;
              return a._distanceKm - b._distanceKm;
            });
          if (pool.length === 0) return null;
          return (
            <Card className="mb-6 border-l-4 border-l-gold-500" data-testid="driver-available-now-card">
              <CardHeader>
                <CardTitle className="text-gold-500 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    Available Now
                    <Badge className="bg-gold-gradient text-white animate-pulse" data-testid="available-count-badge">{pool.length}</Badge>
                  </span>
                  <Button size="sm" variant="outline" onClick={fetchAvailableOrders} data-testid="available-refresh-btn">
                    Refresh
                  </Button>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Waiting jobs any driver can claim — first to accept gets it.{me ? ' Nearest to you first.' : ' Go online for distances.'}
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pool.map((order) => {
                    const pickup = order.pickup_address || {};
                    const dropoff = order.delivery_address || {};
                    const pickupText = pickup.location || pickup.full_address || pickup.street || 'Pickup location';
                    const dropText = dropoff.location || dropoff.full_address || dropoff.street || '';
                    const km = order._distanceKm;
                    const distLabel = km == null ? null : (km < 1 ? `~${Math.round(km * 1000)} m away` : `~${km.toFixed(1)} km away`);
                    return (
                      <div key={order.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3" data-testid={`available-order-${order.id}`}>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold uppercase tracking-wide text-turquoise-500">{order.service_type}</span>
                            {typeof order.total === 'number' && (
                              <span className="text-xs text-muted-foreground">{format(order.total)}</span>
                            )}
                            {distLabel && (
                              <Badge variant="secondary" className="text-xs" data-testid={`available-distance-${order.id}`}>
                                <MapPin className="h-3 w-3 mr-1" />{distLabel}
                              </Badge>
                            )}
                          </div>
                          <p className="truncate text-sm text-foreground">Pickup: {pickupText}</p>
                          {dropText && <p className="truncate text-xs text-muted-foreground">Drop-off: {dropText}</p>}
                        </div>
                        <Button
                          size="sm"
                          className="bg-gold-gradient text-white shrink-0"
                          onClick={() => handleAcceptOrder(order.id)}
                          data-testid={`available-accept-btn-${order.id}`}
                        >
                          Accept
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Active Orders */}
        <DriverRouteCard />
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
                <LiveDeliveryMap orderId={activeOrders[0]?.id} heightClass="h-48 sm:h-64 lg:h-80" />
                {activeOrders.map((order) => (
                  <ActiveOrderCard
                    key={order.id}
                    order={order}
                    onNavigate={handleNavigate}
                    onUpdateStatus={handleUpdateOrderStatus}
                    onDeliverCOD={handleDeliverCOD}
                    onView={(id) => navigate(`/order/${id}`)}
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
