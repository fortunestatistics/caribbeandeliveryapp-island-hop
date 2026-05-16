import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Badge } from './components/ui/badge';
import { 
  Calendar, 
  Clock,
  Plus,
  Edit,
  Trash2,
  RepeatIcon,
  AlertCircle,
  Check,
  X,
  ShoppingCart
} from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const OrderScheduling = () => {
  const [scheduledOrders, setScheduledOrders] = useState([]);
  const [recurringOrders, setRecurringOrders] = useState([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [scheduleData, setScheduleData] = useState({
    service_type: 'food',
    restaurant_id: '',
    items: [],
    delivery_address_id: '',
    scheduled_date: '',
    scheduled_time: '',
    is_recurring: false,
    recurrence_pattern: 'weekly',
    recurrence_days: [],
    end_date: ''
  });

  useEffect(() => {
    fetchScheduledOrders();
    fetchRecurringOrders();
  }, []);

  const fetchScheduledOrders = async () => {
    try {
      const response = await axios.get(`${API}/scheduled-orders`, {
        withCredentials: true
      });
      setScheduledOrders(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching scheduled orders:', error);
      setLoading(false);
    }
  };

  const fetchRecurringOrders = async () => {
    try {
      const response = await axios.get(`${API}/recurring-orders`, {
        withCredentials: true
      });
      setRecurringOrders(response.data);
    } catch (error) {
      console.error('Error fetching recurring orders:', error);
    }
  };

  const handleScheduleOrder = async (e) => {
    e.preventDefault();

    try {
      await axios.post(`${API}/scheduled-orders`, scheduleData, {
        withCredentials: true
      });

      setShowScheduleModal(false);
      fetchScheduledOrders();
      if (scheduleData.is_recurring) {
        fetchRecurringOrders();
      }
      resetForm();
    } catch (error) {
      console.error('Error scheduling order:', error);
      alert('Failed to schedule order');
    }
  };

  const handleCancelScheduledOrder = async (orderId) => {
    if (!window.confirm('Cancel this scheduled order?')) return;

    try {
      await axios.delete(`${API}/scheduled-orders/${orderId}`, {
        withCredentials: true
      });
      fetchScheduledOrders();
    } catch (error) {
      console.error('Error canceling order:', error);
      alert('Failed to cancel order');
    }
  };

  const handleDeleteRecurringOrder = async (recurringId) => {
    if (!window.confirm('Delete this recurring order? Future orders will be cancelled.')) return;

    try {
      await axios.delete(`${API}/recurring-orders/${recurringId}`, {
        withCredentials: true
      });
      fetchRecurringOrders();
      fetchScheduledOrders();
    } catch (error) {
      console.error('Error deleting recurring order:', error);
      alert('Failed to delete recurring order');
    }
  };

  const resetForm = () => {
    setScheduleData({
      service_type: 'food',
      restaurant_id: '',
      items: [],
      delivery_address_id: '',
      scheduled_date: '',
      scheduled_time: '',
      is_recurring: false,
      recurrence_pattern: 'weekly',
      recurrence_days: [],
      end_date: ''
    });
  };

  const getRecurrenceText = (pattern, days) => {
    if (pattern === 'daily') return 'Every day';
    if (pattern === 'weekly') {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return `Every ${days.map(d => dayNames[d]).join(', ')}`;
    }
    if (pattern === 'monthly') return 'Monthly';
    return pattern;
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
              <h1 className="text-3xl font-bold text-foreground">Scheduled Orders</h1>
              <p className="text-muted-foreground">Schedule orders for later or set up recurring deliveries</p>
            </div>
            <Button onClick={() => setShowScheduleModal(true)} className="bg-gold-500/15 hover:bg-gold-500/20">
              <Plus className="h-5 w-5 mr-2" />
              Schedule Order
            </Button>
          </div>

          {/* Stats */}
          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Upcoming Orders</p>
                    <p className="text-2xl font-bold">{scheduledOrders.length}</p>
                  </div>
                  <Calendar className="h-8 w-8 text-neon-cyan" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Recurring Orders</p>
                    <p className="text-2xl font-bold text-purple-600">{recurringOrders.length}</p>
                  </div>
                  <RepeatIcon className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">This Week</p>
                    <p className="text-2xl font-bold text-gold-500">
                      {scheduledOrders.filter(o => {
                        const orderDate = new Date(o.scheduled_datetime);
                        const weekFromNow = new Date();
                        weekFromNow.setDate(weekFromNow.getDate() + 7);
                        return orderDate <= weekFromNow;
                      }).length}
                    </p>
                  </div>
                  <Clock className="h-8 w-8 text-gold-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Scheduled Orders */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Upcoming Scheduled Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {scheduledOrders.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">No scheduled orders</h3>
                <p className="text-muted-foreground mb-4">Schedule an order to have it delivered at a specific time</p>
                <Button onClick={() => setShowScheduleModal(true)}>Schedule First Order</Button>
              </div>
            ) : (
              <div className="space-y-4">
                {scheduledOrders.map((order) => (
                  <Card key={order.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <Calendar className="h-5 w-5 text-gold-500" />
                            <div>
                              <h3 className="font-semibold text-lg">
                                {new Date(order.scheduled_datetime).toLocaleDateString()}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {new Date(order.scheduled_datetime).toLocaleTimeString()}
                              </p>
                            </div>
                            {order.is_recurring && (
                              <Badge className="bg-purple-100 text-purple-800">
                                <RepeatIcon className="h-3 w-3 mr-1" />
                                Recurring
                              </Badge>
                            )}
                            <Badge className={
                              order.status === 'pending' ? 'bg-neon-cyan/15 text-neon-cyan' :
                              order.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                              'bg-matte-800 text-foreground'
                            }>
                              {order.status}
                            </Badge>
                          </div>

                          <div className="space-y-1 text-sm text-muted-foreground">
                            <p className="capitalize">Service: {order.service_type}</p>
                            {order.items && order.items.length > 0 && (
                              <p>Items: {order.items.length} item(s)</p>
                            )}
                            {order.delivery_address && (
                              <p>Deliver to: {order.delivery_address.street_address}</p>
                            )}
                            {order.recurring_pattern && (
                              <p className="flex items-center gap-1">
                                <RepeatIcon className="h-4 w-4" />
                                {getRecurrenceText(order.recurring_pattern, order.recurrence_days)}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <Button
                            onClick={() => handleCancelScheduledOrder(order.id)}
                            variant="destructive"
                            size="sm"
                          >
                            <X className="h-4 w-4 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recurring Orders */}
        {recurringOrders.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RepeatIcon className="h-5 w-5" />
                Active Recurring Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recurringOrders.map((recurring) => (
                  <Card key={recurring.id} className="bg-purple-50">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <RepeatIcon className="h-5 w-5 text-purple-600" />
                            <div>
                              <h3 className="font-semibold text-lg capitalize">
                                {recurring.service_type} Delivery
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {getRecurrenceText(recurring.recurrence_pattern, recurring.recurrence_days)}
                              </p>
                            </div>
                            <Badge className={
                              recurring.active ? 'bg-green-100 text-green-800' : 'bg-matte-800 text-foreground'
                            }>
                              {recurring.active ? 'Active' : 'Paused'}
                            </Badge>
                          </div>

                          <div className="space-y-1 text-sm text-muted-foreground">
                            <p>Next scheduled: {new Date(recurring.next_occurrence).toLocaleDateString()}</p>
                            {recurring.end_date && (
                              <p>Ends: {new Date(recurring.end_date).toLocaleDateString()}</p>
                            )}
                            <p>Orders created: {recurring.orders_created || 0}</p>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <Button
                            onClick={() => handleDeleteRecurringOrder(recurring.id)}
                            variant="destructive"
                            size="sm"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Schedule Order Modal */}
        {showScheduleModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <Card className="max-w-2xl w-full my-8">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Schedule an Order</span>
                  <button onClick={() => { setShowScheduleModal(false); resetForm(); }}>
                    <X className="h-6 w-6" />
                  </button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleScheduleOrder} className="space-y-6">
                  {/* Service Type */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Service Type *</label>
                    <select
                      required
                      value={scheduleData.service_type}
                      onChange={(e) => setScheduleData(prev => ({ ...prev, service_type: e.target.value }))}
                      className="w-full p-2 border rounded-md"
                    >
                      <option value="food">Food Delivery</option>
                      <option value="grocery">Grocery</option>
                      <option value="pharmacy">Pharmacy</option>
                    </select>
                  </div>

                  {/* Date & Time */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Date *</label>
                      <Input
                        type="date"
                        required
                        value={scheduleData.scheduled_date}
                        onChange={(e) => setScheduleData(prev => ({ ...prev, scheduled_date: e.target.value }))}
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Time *</label>
                      <Input
                        type="time"
                        required
                        value={scheduleData.scheduled_time}
                        onChange={(e) => setScheduleData(prev => ({ ...prev, scheduled_time: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* Recurring Order */}
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={scheduleData.is_recurring}
                        onChange={(e) => setScheduleData(prev => ({ ...prev, is_recurring: e.target.checked }))}
                      />
                      <span className="text-sm font-medium">Make this a recurring order</span>
                    </label>
                  </div>

                  {/* Recurring Options */}
                  {scheduleData.is_recurring && (
                    <>
                      <div>
                        <label className="block text-sm font-medium mb-2">Recurrence Pattern *</label>
                        <select
                          required
                          value={scheduleData.recurrence_pattern}
                          onChange={(e) => setScheduleData(prev => ({ ...prev, recurrence_pattern: e.target.value }))}
                          className="w-full p-2 border rounded-md"
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>

                      {scheduleData.recurrence_pattern === 'weekly' && (
                        <div>
                          <label className="block text-sm font-medium mb-2">Repeat on Days *</label>
                          <div className="grid grid-cols-4 gap-2">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
                              <label key={day} className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={scheduleData.recurrence_days.includes(idx)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setScheduleData(prev => ({
                                        ...prev,
                                        recurrence_days: [...prev.recurrence_days, idx].sort()
                                      }));
                                    } else {
                                      setScheduleData(prev => ({
                                        ...prev,
                                        recurrence_days: prev.recurrence_days.filter(d => d !== idx)
                                      }));
                                    }
                                  }}
                                />
                                <span className="text-sm">{day}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium mb-2">End Date (Optional)</label>
                        <Input
                          type="date"
                          value={scheduleData.end_date}
                          onChange={(e) => setScheduleData(prev => ({ ...prev, end_date: e.target.value }))}
                          min={scheduleData.scheduled_date}
                        />
                      </div>
                    </>
                  )}

                  {/* Info */}
                  <div className="bg-neon-cyan/10 p-4 rounded-lg flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-neon-cyan flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-neon-cyan">
                      <p className="font-medium mb-1">Note:</p>
                      <p>This is a simplified scheduling interface. In production, you would select specific items, quantities, and delivery address before scheduling.</p>
                    </div>
                  </div>

                  {/* Submit */}
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => { setShowScheduleModal(false); resetForm(); }} className="flex-1">
                      Cancel
                    </Button>
                    <Button type="submit" className="flex-1 bg-gold-500/15 hover:bg-gold-500/20">
                      Schedule Order
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderScheduling;
