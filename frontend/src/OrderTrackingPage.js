import React, { useState, useEffect, useRef } from 'react';
import { useCurrency } from './CurrencyContext';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Badge } from './components/ui/badge';
import { Separator } from './components/ui/separator';
import { 
  MapPin, 
  Phone, 
  MessageCircle, 
  Clock, 
  User,
  Navigation,
  Package,
  CheckCircle,
  Truck,
  Utensils,
  ShoppingCart,
  Pill,
  Car,
  AlertCircle,
  Send,
  Star,
  ThumbsUp
} from 'lucide-react';
import { orderAPI, chatAPI, createWebSocket } from './services/api';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const OrderTrackingPage = () => {
  const { format } = useCurrency();
  const navigate = useNavigate();
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const serviceType = searchParams.get('service') || 'food';
  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);

  const [order, setOrder] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);

  // Fetch order data from API
  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (!user.id) {
          // Use demo data if not logged in
          loadDemoData();
          return;
        }

        const response = await orderAPI.getById(orderId);
        setOrder(response.data);
        
        // Load chat messages
        const chatResponse = await chatAPI.getMessages(orderId);
        setMessages(chatResponse.data);
        
        // Connect to WebSocket for real-time updates
        wsRef.current = createWebSocket(user.id, handleWebSocketMessage);
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching order:', error);
        // Fallback to demo data
        loadDemoData();
      }
    };

    fetchOrder();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [orderId]);

  const handleWebSocketMessage = (data) => {
    if (data.type === 'order_update' && data.order?.id === orderId) {
      setOrder(data.order);
    } else if (data.type === 'new_message' && data.message?.order_id === orderId) {
      setMessages(prev => [...prev, data.message]);
    }
  };

  const loadDemoData = () => {
    setTimeout(() => {
      setOrder({
        id: orderId || 'ORD-12345',
        serviceType: serviceType,
        status: 'in_progress',
        customerName: 'John Doe',
        customerPhone: '+1 (876) 555-1234',
        pickupLocation: {
          address: '123 Main Street, Kingston, Jamaica',
          name: serviceType === 'taxi' ? 'Your Location' : 'Island Spice Kitchen'
        },
        dropoffLocation: {
          address: '456 Beach Road, Montego Bay, Jamaica',
          name: serviceType === 'taxi' ? 'Destination' : 'Your Home'
        },
        courier: {
          name: 'Michael Thompson',
          phone: '+1 (876) 555-5678',
          vehicle: 'Toyota Corolla - ABC 1234',
          rating: 4.8,
          completedDeliveries: 342
        },
        items: serviceType === 'food' ? [
          { name: 'Jerk Chicken Plate', quantity: 2, price: 25.00 },
          { name: 'Rice & Peas', quantity: 2, price: 8.00 },
          { name: 'Fried Plantains', quantity: 1, price: 5.00 }
        ] : serviceType === 'grocery' ? [
          { name: 'Fresh Vegetables', quantity: 1, price: 15.00 },
          { name: 'Rice (5kg)', quantity: 1, price: 12.00 },
          { name: 'Cooking Oil', quantity: 2, price: 8.00 }
        ] : serviceType === 'pharmacy' ? [
          { name: 'Prescription Medication', quantity: 1, price: 35.00 },
          { name: 'Vitamins', quantity: 1, price: 20.00 }
        ] : [],
        total: serviceType === 'taxi' ? 45.00 : 68.00,
        estimatedTime: '25 mins',
        orderTime: new Date(Date.now() - 20 * 60000).toISOString(),
        timeline: [
          { status: 'Order Placed', time: new Date(Date.now() - 20 * 60000), completed: true },
          { status: 'Confirmed', time: new Date(Date.now() - 18 * 60000), completed: true },
          { status: 'Driver Assigned', time: new Date(Date.now() - 15 * 60000), completed: true },
          { status: serviceType === 'taxi' ? 'Driver Arriving' : 'Picked Up', time: new Date(Date.now() - 10 * 60000), completed: true },
          { status: serviceType === 'taxi' ? 'In Transit' : 'On the Way', time: new Date(), completed: false },
          { status: 'Delivered', time: null, completed: false }
        ]
      });

      setMessages([
        { id: 1, sender: 'courier', text: 'Hi! I have your order and will be there soon!', time: new Date(Date.now() - 10 * 60000) },
        { id: 2, sender: 'customer', text: 'Great! Please call when you arrive.', time: new Date(Date.now() - 8 * 60000) },
        { id: 3, sender: 'courier', text: 'Will do! About 5 minutes away.', time: new Date(Date.now() - 5 * 60000) }
      ]);

      setLoading(false);
    }, 1000);
  };


  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (newMessage.trim()) {
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        if (user.id) {
          // Send via API
          const response = await chatAPI.sendMessage({
            order_id: orderId,
            sender_type: 'customer',
            message: newMessage
          });
          
          setMessages([...messages, response.data]);
        } else {
          // Demo mode
          setMessages([...messages, {
            id: messages.length + 1,
            sender: 'customer',
            text: newMessage,
            time: new Date()
          }]);
        }
        
        setNewMessage('');
      } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message');
      }
    }
  };

  const getServiceIcon = () => {
    switch (serviceType) {
      case 'taxi': return <Car className="h-6 w-6" />;
      case 'food': return <Utensils className="h-6 w-6" />;
      case 'grocery': return <ShoppingCart className="h-6 w-6" />;
      case 'pharmacy': return <Pill className="h-6 w-6" />;
      default: return <Package className="h-6 w-6" />;
    }
  };

  const getServiceTitle = () => {
    switch (serviceType) {
      case 'taxi': return 'Taxi Ride';
      case 'food': return 'Food Delivery';
      case 'grocery': return 'Grocery Delivery';
      case 'pharmacy': return 'Pharmacy Delivery';
      default: return 'Delivery';
    }
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-gold-500/30 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading order details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br bg-background py-8">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/')}
            className="mb-4"
          >
            ← Back to Home
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Track Your Order</h1>
              <p className="text-muted-foreground">Order ID: {order.id}</p>
            </div>
            <Badge className="bg-gold-gradient text-white text-lg px-4 py-2">
              {getServiceTitle()}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Order Details & Timeline */}
          <div className="lg:col-span-2 space-y-6">
            {/* Map Placeholder */}
            <Card className="overflow-hidden">
              <div className="bg-gold-gradient h-64 flex items-center justify-center relative">
                <div className="text-white text-center">
                  <Navigation className="h-16 w-16 mx-auto mb-4 animate-pulse" />
                  <p className="text-lg font-semibold">Live Tracking</p>
                  <p className="text-sm opacity-90">Estimated arrival: {order.estimatedTime}</p>
                </div>
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow-lg">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-gold-500" />
                    <span className="font-semibold text-foreground">{order.estimatedTime}</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Order Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Package className="h-5 w-5 mr-2 text-gold-500" />
                  Order Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {order.timeline.map((item, index) => (
                    <div key={`tl-${item.status}-${index}`} className="flex items-start">
                      <div className="flex flex-col items-center mr-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          item.completed ? 'bg-green-500' : 'bg-gray-300'
                        }`}>
                          {item.completed ? (
                            <CheckCircle className="h-5 w-5 text-white" />
                          ) : (
                            <Clock className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        {index < order.timeline.length - 1 && (
                          <div className={`w-0.5 h-12 ${item.completed ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                        )}
                      </div>
                      <div className="flex-1 pt-2">
                        <p className={`font-semibold ${item.completed ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {item.status}
                        </p>
                        {item.time && (
                          <p className="text-sm text-muted-foreground">{formatTime(item.time)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Order Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  {getServiceIcon()}
                  <span className="ml-2">Order Details</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Pickup/Dropoff Locations */}
                <div className="space-y-3">
                  <div className="flex items-start">
                    <div className="w-10 h-10 bg-gold-500/15 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                      <MapPin className="h-5 w-5 text-gold-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{order.pickupLocation.name}</p>
                      <p className="text-sm text-muted-foreground">{order.pickupLocation.address}</p>
                    </div>
                  </div>
                  <div className="ml-5 border-l-2 border-dashed border-border h-8"></div>
                  <div className="flex items-start">
                    <div className="w-10 h-10 bg-gold-500/15 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                      <Navigation className="h-5 w-5 text-gold-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{order.dropoffLocation.name}</p>
                      <p className="text-sm text-muted-foreground">{order.dropoffLocation.address}</p>
                    </div>
                  </div>
                </div>

                {/* Items (if not taxi) */}
                {serviceType !== 'taxi' && order.items.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-semibold text-foreground mb-3">Items</h4>
                      <div className="space-y-2">
                        {order.items.map((item, index) => (
                          <div key={`item-${item.name}-${index}`} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              {item.quantity}x {item.name}
                            </span>
                            <span className="font-semibold text-foreground">
                              {format(item.price)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total</span>
                      <span className="text-gold-500">{format(order.total)}</span>
                    </div>
                  </>
                )}

                {serviceType === 'taxi' && (
                  <>
                    <Separator />
                    <div className="flex justify-between font-bold text-lg">
                      <span>Fare</span>
                      <span className="text-gold-500">{format(order.total)}</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Driver Info & Chat */}
          <div className="space-y-6">
            {/* Driver/Courier Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="h-5 w-5 mr-2 text-gold-500" />
                  Your {serviceType === 'taxi' ? 'Driver' : 'Courier'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="w-20 h-20 bg-gold-gradient rounded-full flex items-center justify-center mx-auto mb-3">
                    <User className="h-10 w-10 text-white" />
                  </div>
                  <h3 className="font-bold text-lg text-foreground">{order.courier.name}</h3>
                  <div className="flex items-center justify-center space-x-1 mt-2">
                    <Star className="h-4 w-4 text-gold-500 fill-current" />
                    <span className="font-semibold">{order.courier.rating}</span>
                    <span className="text-muted-foreground text-sm">
                      ({order.courier.completedDeliveries} deliveries)
                    </span>
                  </div>
                </div>

                <div className="bg-background rounded-lg p-3">
                  <div className="flex items-center justify-center space-x-2">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{order.courier.vehicle}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    className="bg-gradient-to-r from-gold-300 to-gold-700 text-white"
                    onClick={() => window.location.href = `tel:${order.courier.phone}`}
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Call
                  </Button>
                  <Button 
                    variant="outline"
                    className="border-gold-500/30 text-gold-500 hover:bg-gold-500/15"
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Chat
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Chat Section */}
            <Card className="flex flex-col" style={{ height: '500px' }}>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MessageCircle className="h-5 w-5 mr-2 text-gold-500" />
                  Messages
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col overflow-hidden">
                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.sender === 'customer' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          message.sender === 'customer'
                            ? 'bg-gold-gradient text-white'
                            : 'bg-matte-800 text-foreground'
                        }`}
                      >
                        <p className="text-sm">{message.text}</p>
                        <p className={`text-xs mt-1 ${
                          message.sender === 'customer' ? 'text-white/80' : 'text-muted-foreground'
                        }`}>
                          {formatTime(message.time)}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input */}
                <div className="flex space-x-2 border-t pt-4">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Type a message..."
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSendMessage}
                    className="bg-gold-gradient text-white"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => alert('Tip feature coming soon!')}
                >
                  <ThumbsUp className="h-4 w-4 mr-2" />
                  Tip Your {serviceType === 'taxi' ? 'Driver' : 'Courier'}
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start text-red-600 border-red-300 hover:bg-red-50"
                  onClick={() => {
                    if (window.confirm('Are you sure you want to cancel this order?')) {
                      alert('Order cancellation request sent');
                    }
                  }}
                >
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Cancel Order
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderTrackingPage;
