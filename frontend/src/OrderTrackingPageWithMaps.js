import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useCurrency } from './CurrencyContext';
import { useNavigate, useParams } from 'react-router-dom';
<<<<<<< HEAD
import { formatAddress } from './formatAddress';
=======
>>>>>>> cb805eb
import { GoogleMap, LoadScript, Marker, DirectionsRenderer } from '@react-google-maps/api';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import ReviewForm from './ReviewForm';
import OrderChat from './OrderChat';
import { useAuth } from './AuthContext';
import { celebrate } from './celebrate';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Badge } from './components/ui/badge';
import { 
  MapPin, 
  Phone, 
  MessageCircle, 
  Clock, 
  User,
  Package,
  CheckCircle,
  Truck,
  Send,
  Star
} from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

const mapContainerStyle = {
  width: '100%',
  height: '500px'
};

const OrderTrackingPageWithMaps = () => {
  const { format } = useCurrency();
  const navigate = useNavigate();
  const { orderId } = useParams();
  const { user } = useAuth();
  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);
  const mapRef = useRef(null);

  const [order, setOrder] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [directions, setDirections] = useState(null);
<<<<<<< HEAD
  const [eta, setEta] = useState(null);
=======
>>>>>>> cb805eb
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratings, setRatings] = useState({
    vendor_rating: 5,
    driver_rating: 5,
    food_quality: 5,
    delivery_speed: 5,
    vendor_review: '',
    driver_review: ''
  });

  // Calculate map center and zoom
  const getMapCenter = () => {
    if (driverLocation?.location) {
      return {
        lat: driverLocation.location.lat,
        lng: driverLocation.location.lng
      };
    }
    if (order?.delivery_address?.latitude) {
      return {
        lat: order.delivery_address.latitude,
        lng: order.delivery_address.longitude
      };
    }
    return { lat: 18.1096, lng: -77.2975 }; // Jamaica default
  };

  // Fetch order data
  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const token = (() => { try { return localStorage.getItem('token'); } catch (_e) { return null; } })();
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const response = await axios.get(`${API}/orders/${orderId}`, {
          headers,
<<<<<<< HEAD
          withCredentials: true,
=======
          withCredentials: false,
>>>>>>> cb805eb
        });
        setOrder(response.data);
        setLoading(false);

        // If order is delivered, celebrate + show rating modal
        if (response.data.status === 'delivered') {
          const hasRated = await checkIfRated();
          if (!hasRated) {
            celebrate();
            setTimeout(() => setShowRatingModal(true), 2000);
          }
        }
      } catch (error) {
        console.error('Error fetching order:', error);
        setLoading(false);
      }
    };

    if (orderId) {
      fetchOrder();
    }
    // eslint-disable-next-line -- fetch order on orderId change
  }, [orderId]);

  // Check if user has already rated this order
  const checkIfRated = async () => {
    try {
      const response = await axios.get(`${API}/ratings?order_id=${orderId}`, {
<<<<<<< HEAD
        withCredentials: true
=======
        withCredentials: false
>>>>>>> cb805eb
      });
      return response.data.length > 0;
    } catch (error) {
      return false;
    }
  };

  // Fetch driver location
  useEffect(() => {
    if (!order || !order.driver_id) return;

    const fetchDriverLocation = async () => {
      try {
        const response = await axios.get(`${API}/orders/${orderId}/driver-location`);
        setDriverLocation(response.data);
        
        // Calculate route if we have both pickup and driver location
        if (response.data.has_driver && response.data.location && order.delivery_address) {
          calculateRoute(response.data.location, order.delivery_address);
        }
      } catch (error) {
        console.error('Error fetching driver location:', error);
      }
    };

    fetchDriverLocation();
<<<<<<< HEAD
    const interval = setInterval(fetchDriverLocation, 6000); // Update every 6 seconds
=======
    const interval = setInterval(fetchDriverLocation, 10000); // Update every 10 seconds
>>>>>>> cb805eb

    return () => clearInterval(interval);
    // eslint-disable-next-line -- poll driver location while order is active
  }, [order, orderId]);

  // Calculate route using Google Directions API
  const calculateRoute = useCallback((origin, destination) => {
    if (!window.google) return;

    const directionsService = new window.google.maps.DirectionsService();
    directionsService.route(
      {
        origin: new window.google.maps.LatLng(origin.lat, origin.lng),
        destination: new window.google.maps.LatLng(destination.latitude, destination.longitude),
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK) {
          setDirections(result);
<<<<<<< HEAD
          const leg = result?.routes?.[0]?.legs?.[0];
          if (leg) setEta({ duration: leg.duration?.text, distance: leg.distance?.text });
=======
>>>>>>> cb805eb
        }
      }
    );
  }, []);

  // WebSocket for real-time updates
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user.id) return;

    const ws = new WebSocket(
      BACKEND_URL.replace('http', 'ws') + `/ws/${user.id}`
    );

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'driver_location_update' && data.driver_id === order?.driver_id) {
        setDriverLocation(prev => ({
          ...prev,
          location: { lat: data.latitude, lng: data.longitude },
          last_update: new Date().toISOString()
        }));
        
        // Update route
        if (order?.delivery_address) {
          calculateRoute(
            { lat: data.latitude, lng: data.longitude },
            order.delivery_address
          );
        }
      }
      
      if (data.type === 'order_status_update' && data.order_id === orderId) {
        setOrder(prev => ({ ...prev, status: data.status }));
        
        // Celebrate + show rating modal when delivered (live WS event)
        if (data.status === 'delivered') {
          celebrate();
          setTimeout(() => setShowRatingModal(true), 2000);
        }
      }
      
      if (data.type === 'new_message') {
        setMessages(prev => [...prev, data.message]);
      }
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [order, orderId, calculateRoute]);

  // Send chat message
  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      await axios.post(`${API}/chat/send`, {
        order_id: orderId,
        message: newMessage,
        sender_type: 'customer'
      }, {
<<<<<<< HEAD
        withCredentials: true
=======
        withCredentials: false
>>>>>>> cb805eb
      });

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  // Submit rating
  const submitRating = async () => {
    try {
      await axios.post(`${API}/ratings`, {
        order_id: orderId,
        ...ratings
      }, {
<<<<<<< HEAD
        withCredentials: true
=======
        withCredentials: false
>>>>>>> cb805eb
      });

      setShowRatingModal(false);
      alert('Thank you for your feedback!');
    } catch (error) {
      console.error('Error submitting rating:', error);
      alert('Failed to submit rating. Please try again.');
    }
  };

  // Status badge color
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-500/30"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground">Order Not Found</h2>
          <Button onClick={() => navigate('/')} className="mt-4">
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
            ← Back
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Track Your Order</h1>
              <p className="text-muted-foreground">Order ID: {orderId.substring(0, 8)}</p>
            </div>
            <Badge className={getStatusColor(order.status)}>
              {order.status.replace('_', ' ').toUpperCase()}
            </Badge>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Left Column: Map & Status */}
          <div className="space-y-6">
            {/* Google Map */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Live Tracking
                </CardTitle>
              </CardHeader>
              <CardContent>
                <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY}>
                  <GoogleMap
                    mapContainerStyle={mapContainerStyle}
                    center={getMapCenter()}
                    zoom={14}
                    onLoad={map => mapRef.current = map}
                  >
                    {/* Driver Location Marker */}
                    {driverLocation?.has_driver && driverLocation?.location && (
                      <Marker
                        position={{
                          lat: driverLocation.location.lat,
                          lng: driverLocation.location.lng
                        }}
                        icon={{
                          url: 'data:image/svg+xml;utf8,' + encodeURIComponent(`
                            <svg width="40" height="40" xmlns="http://www.w3.org/2000/svg">
                              <circle cx="20" cy="20" r="15" fill="#0EA5E9" stroke="white" stroke-width="3"/>
                              <text x="20" y="26" text-anchor="middle" fill="white" font-size="16" font-weight="bold">🚗</text>
                            </svg>
                          `)
                        }}
                        title="Driver Location"
                      />
                    )}

                    {/* Delivery Location Marker */}
                    {order.delivery_address && (
                      <Marker
                        position={{
                          lat: order.delivery_address.latitude,
                          lng: order.delivery_address.longitude
                        }}
                        icon={{
                          url: 'data:image/svg+xml;utf8,' + encodeURIComponent(`
                            <svg width="40" height="40" xmlns="http://www.w3.org/2000/svg">
                              <circle cx="20" cy="20" r="15" fill="#10B981" stroke="white" stroke-width="3"/>
                              <text x="20" y="26" text-anchor="middle" fill="white" font-size="16" font-weight="bold">📍</text>
                            </svg>
                          `)
                        }}
                        title="Delivery Location"
                      />
                    )}

                    {/* Route */}
                    {directions && (
                      <DirectionsRenderer
                        directions={directions}
                        options={{
                          suppressMarkers: true,
                          polylineOptions: {
                            strokeColor: '#0EA5E9',
                            strokeWeight: 5
                          }
                        }}
                      />
                    )}
                  </GoogleMap>
                </LoadScript>

<<<<<<< HEAD
                {/* Live ETA to your door */}
                {driverLocation?.has_driver && eta && (
                  <div className="mt-4 p-4 rounded-lg flex items-center justify-between" style={{ background: '#0FA3A315' }} data-testid="tracking-eta">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-sm font-medium text-foreground">Your driver is on the way</span>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold" style={{ color: '#0FA3A3' }} data-testid="tracking-eta-time">{eta.duration}</p>
                      <p className="text-xs text-muted-foreground">{eta.distance} to your door</p>
                    </div>
                  </div>
                )}

=======
>>>>>>> cb805eb
                {/* Driver Info Below Map */}
                {driverLocation?.has_driver && (
                  <div className="mt-4 p-4 bg-neon-cyan/10 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-foreground">{driverLocation.driver_name}</p>
                        <p className="text-sm text-muted-foreground">{driverLocation.vehicle_type} • {driverLocation.vehicle_plate}</p>
                      </div>
                      <Button size="sm" variant="outline">
                        <Phone className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Order Status Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Order Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {['pending', 'confirmed', 'preparing', 'ready', 'picked_up', 'in_transit', 'delivered'].map((status, index) => {
                    const isCompleted = ['pending', 'confirmed', 'preparing', 'ready', 'picked_up', 'in_transit', 'delivered'].indexOf(order.status) >= index;
                    const isCurrent = order.status === status;

                    return (
                      <div key={status} className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          isCompleted ? 'bg-green-500' : 'bg-gray-200'
                        }`}>
                          {isCompleted ? (
                            <CheckCircle className="h-5 w-5 text-white" />
                          ) : (
                            <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className={`font-medium ${isCurrent ? 'text-gold-500' : 'text-foreground'}`}>
                            {status.replace('_', ' ').toUpperCase()}
                          </p>
                          {isCurrent && (
                            <p className="text-sm text-muted-foreground">In progress...</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Order Details & Chat */}
          <div className="space-y-6">
            {/* Order Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Order Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Subtotal</p>
                  <p className="text-lg font-semibold">{format(order.subtotal || 0)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Delivery Fee</p>
                  <p className="text-lg font-semibold">{format(order.delivery_fee || 0)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold text-gold-500">{format(order.total || 0)}</p>
                </div>
                
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-2">Delivery Address</p>
<<<<<<< HEAD
                  <p className="font-medium">{formatAddress(order.delivery_address) || 'Address not provided'}</p>
=======
                  <p className="font-medium">{order.delivery_address?.street_address}</p>
                  <p className="text-sm text-muted-foreground">
                    {order.delivery_address?.city}, {order.delivery_address?.postal_code}
                  </p>
>>>>>>> cb805eb
                </div>
              </CardContent>
            </Card>

            {/* Chat */}
            <OrderChat orderId={orderId} currentUserId={user?.id} viewerRole="customer" title="Chat with driver & merchant" />
          </div>
        </div>

        {/* Rating Modal */}
        {showRatingModal && (
          <ReviewForm
            orderId={orderId}
            showDriver={Boolean(order?.driver_id)}
            showVendor={true}
            onClose={() => setShowRatingModal(false)}
            onSubmitted={() => setShowRatingModal(false)}
          />
        )}
      </div>
    </div>
  );
};

export default OrderTrackingPageWithMaps;
