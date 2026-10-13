import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useCurrency } from './CurrencyContext';
import { Card, CardContent } from './components/ui/card';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { ArrowLeft, MapPin, Package, ShoppingBag } from 'lucide-react';
import LiveDeliveryMap from './LiveDeliveryMap';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const cfg = () => {
  const token = localStorage.getItem('token');
  return { withCredentials: true, headers: token ? { Authorization: `Bearer ${token}` } : {} };
};

const ACTIVE = ['pending', 'confirmed', 'preparing', 'ready', 'ready_for_pickup', 'assigned', 'picked_up', 'in_transit'];

const STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  preparing: 'bg-blue-100 text-blue-700',
  ready: 'bg-indigo-100 text-indigo-700',
  ready_for_pickup: 'bg-indigo-100 text-indigo-700',
  assigned: 'bg-purple-100 text-purple-700',
  picked_up: 'bg-purple-100 text-purple-700',
  in_transit: 'bg-teal-100 text-teal-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  refunded: 'bg-red-100 text-red-700',
};

const label = (s) => (s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function MyOrdersPage() {
  const navigate = useNavigate();
  const { format } = useCurrency();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get(`${API}/orders`, cfg());
        const list = Array.isArray(data) ? data : [];
        list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        setOrders(list);
      } catch (e) {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const active = orders.filter((o) => ACTIVE.includes(o.status));
  const past = orders.filter((o) => !ACTIVE.includes(o.status));

  const renderOrder = (o) => (
    <Card key={o.id} className="mb-3" data-testid={`my-order-${o.id}`}>
      <CardContent className="p-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Package className="h-4 w-4 text-gold-500 shrink-0" />
            <span className="font-semibold text-foreground capitalize">{o.service_type || 'Order'}</span>
            <Badge className={`${STATUS_STYLES[o.status] || 'bg-muted text-foreground'} border-0`} data-testid={`my-order-status-${o.id}`}>
              {label(o.status)}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground font-mono truncate">#{o.id}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {format ? format(o.total || 0) : `$${(o.total || 0).toFixed(2)}`}
            {o.created_at ? ` · ${new Date(o.created_at).toLocaleString()}` : ''}
          </p>
        </div>
        <Button
          onClick={() => navigate(`/order/${o.id}`)}
          className="bg-gold-gradient text-white shrink-0"
          data-testid={`my-order-track-${o.id}`}
        >
          <MapPin className="h-4 w-4 mr-2" /> Track
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background py-8" data-testid="my-orders-page">
      <div className="max-w-3xl mx-auto px-4">
        <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4" data-testid="my-orders-back-btn">
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </button>
        <h1 className="text-3xl font-bold text-foreground mb-1">My Orders</h1>
        <p className="text-muted-foreground mb-6">Track a live order or review your history.</p>

        {loading && <p className="text-muted-foreground" data-testid="my-orders-loading">Loading your orders…</p>}

        {!loading && error && (
          <Card><CardContent className="p-6 text-sm text-muted-foreground" data-testid="my-orders-error">
            We couldn’t load your orders right now. Please try again shortly.
          </CardContent></Card>
        )}

        {!loading && !error && orders.length === 0 && (
          <Card><CardContent className="p-8 text-center" data-testid="my-orders-empty">
            <ShoppingBag className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-foreground font-medium mb-1">No orders yet</p>
            <p className="text-sm text-muted-foreground mb-4">When you place an order, you can track it here.</p>
            <Button onClick={() => navigate('/businesses')} className="bg-gold-gradient text-white" data-testid="my-orders-browse-btn">
              Browse businesses
            </Button>
          </CardContent></Card>
        )}

        {!loading && !error && active.length > 0 && (
          <div className="mb-8" data-testid="my-orders-active">
            <h2 className="text-lg font-semibold text-foreground mb-3">Active</h2>
            <div className="mb-4">
              <LiveDeliveryMap orderId={active[0]?.id} heightClass="h-48 sm:h-64 lg:h-80" />
            </div>
            {active.map(renderOrder)}
          </div>
        )}

        {!loading && !error && past.length > 0 && (
          <div data-testid="my-orders-past">
            <h2 className="text-lg font-semibold text-foreground mb-3">Past orders</h2>
            {past.map(renderOrder)}
          </div>
        )}
      </div>
    </div>
  );
}
