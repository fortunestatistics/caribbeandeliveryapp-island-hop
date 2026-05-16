import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { 
  MapPin, 
  DollarSign, 
  TrendingUp,
  Clock,
  CheckCircle,
  X,
  Navigation,
  Eye,
  Wallet,
  BarChart3,
  Power,
  AlertCircle,
  Phone,
  MessageCircle
} from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DriverDashboard = () => {
  const navigate = useNavigate();
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
  }, []);

  // Start location tracking when online
  useEffect(() => {
    if (isOnline && driver) {
      startLocationTracking();
    } else {
      stopLocationTracking();
    }
  }, [isOnline, driver]);

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

  const fetchOrderRequests = async () => {
    try {
      const response = await axios.get(`${API}/drivers/order-requests`, {
        withCredentials: true
      });
      setOrderRequests(response.data);
    } catch (error) {
      console.error('Error fetching order requests:', error);
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

  const startLocationTracking = () => {
    if (!navigator.geolocation) {
      alert('Geolocation not supported');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude, heading, speed } = position.coords;
        
        try {
          await axios.post(`${API}/drivers/${driver.id}/location`, {
            latitude,
            longitude,
            heading,
            speed
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
            </div>
          </div>

          {/* Status Alert */}
          {!isOnline && (
            <div className="bg-gold-500/10 border-l-4 border-yellow-400 p-4 mb-6">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-gold-300" />
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    You're currently offline. Go online to start receiving order requests.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Earnings Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Today's Earnings</p>
                    <p className="text-3xl font-bold text-gold-500">
                      ${earnings.today.toFixed(2)}
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
                    <p className="text-sm text-muted-foreground">This Week</p>
                    <p className="text-3xl font-bold text-green-600">
                      ${earnings.week.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-green-100 p-3 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Wallet Balance</p>
                    <p className="text-3xl font-bold text-neon-cyan">
                      ${earnings.balance.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-neon-cyan/15 p-3 rounded-lg">
                    <Wallet className="h-6 w-6 text-neon-cyan" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pending</p>
                    <p className="text-3xl font-bold text-yellow-600">
                      ${earnings.pending.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-gold-500/15 p-3 rounded-lg">
                    <Clock className="h-6 w-6 text-yellow-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

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
                  <Card key={order.id} className="bg-gold-500/15">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-lg">
                              New Order #{order.id?.substring(0, 8)}
                            </h3>
                            <Badge className="bg-gold-500/15 text-white">
                              ${order.driver_earnings?.toFixed(2)} Earnings
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>
                              <MapPin className="h-4 w-4 inline mr-1" />
                              {order.estimated_distance_km?.toFixed(1)} km away
                            </p>
                            <p>
                              <Clock className="h-4 w-4 inline mr-1" />
                              Est. {order.estimated_duration_min || 30} min delivery
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-gold-500">
                            ${order.driver_earnings?.toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">You'll earn</p>
                        </div>
                      </div>

                      {/* Pickup & Delivery */}
                      <div className="grid md:grid-cols-2 gap-4 mb-4 p-4 bg-card rounded-lg">
                        <div>
                          <p className="font-medium text-sm mb-1">Pickup:</p>
                          <p className="text-sm text-muted-foreground">{order.pickup_address?.street_address}</p>
                        </div>
                        <div>
                          <p className="font-medium text-sm mb-1">Delivery:</p>
                          <p className="text-sm text-muted-foreground">{order.delivery_address?.street_address}</p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleAcceptOrder(order.id)}
                          className="flex-1 bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Accept Order
                        </Button>
                        <Button
                          onClick={() => handleRejectOrder(order.id)}
                          variant="outline"
                          className="flex-1"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Decline
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
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
                  <Card key={order.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-lg">
                              Order #{order.id?.substring(0, 8)}
                            </h3>
                            <Badge className={
                              order.status === 'picked_up' ? 'bg-blue-500' :
                              order.status === 'in_transit' ? 'bg-indigo-500' :
                              'bg-green-500'
                            }>
                              {order.status?.toUpperCase()}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <p>Customer: {order.customer_phone || 'N/A'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-gold-500">
                            ${order.driver_earnings?.toFixed(2)}
                          </p>
                        </div>
                      </div>

                      {/* Addresses */}
                      <div className="space-y-2 mb-4 p-4 bg-background rounded-lg">
                        {order.status === 'ready' && (
                          <div>
                            <p className="font-medium text-sm mb-1 flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-red-500" />
                              Pickup from:
                            </p>
                            <p className="text-sm text-muted-foreground ml-6">{order.pickup_address?.street_address}</p>
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-sm mb-1 flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-green-500" />
                            Deliver to:
                          </p>
                          <p className="text-sm text-muted-foreground ml-6">{order.delivery_address?.street_address}</p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        {order.status === 'ready' && (
                          <>
                            <Button
                              onClick={() => handleNavigate(order.pickup_address)}
                              variant="outline"
                              className="flex-1"
                            >
                              <Navigation className="h-4 w-4 mr-2" />
                              Navigate to Pickup
                            </Button>
                            <Button
                              onClick={() => handleUpdateOrderStatus(order.id, 'picked_up')}
                              className="flex-1 bg-blue-600 hover:bg-blue-700"
                            >
                              Mark Picked Up
                            </Button>
                          </>
                        )}

                        {order.status === 'picked_up' && (
                          <>
                            <Button
                              onClick={() => handleNavigate(order.delivery_address)}
                              variant="outline"
                              className="flex-1"
                            >
                              <Navigation className="h-4 w-4 mr-2" />
                              Navigate to Customer
                            </Button>
                            <Button
                              onClick={() => handleUpdateOrderStatus(order.id, 'in_transit')}
                              className="flex-1"
                            >
                              Start Delivery
                            </Button>
                          </>
                        )}

                        {order.status === 'in_transit' && (
                          <Button
                            onClick={() => handleUpdateOrderStatus(order.id, 'delivered')}
                            className="flex-1 bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Mark Delivered
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

                      {/* Contact */}
                      <div className="flex gap-2 mt-4 pt-4 border-t">
                        <Button variant="outline" size="sm" className="flex-1">
                          <Phone className="h-4 w-4 mr-2" />
                          Call Customer
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1">
                          <MessageCircle className="h-4 w-4 mr-2" />
                          Message
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

export default DriverDashboard;
