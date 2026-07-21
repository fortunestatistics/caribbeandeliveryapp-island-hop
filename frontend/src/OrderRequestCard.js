import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from './components/ui/card';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { MapPin, Clock, CheckCircle, X, Car, TrendingUp } from 'lucide-react';

/**
 * Single new-order-request card with Accept/Decline buttons.
 * Props: { order, onAccept(orderId), onReject(orderId), subscription }
 */
const OrderRequestCard = ({ order, onAccept, onReject, subscription }) => {
  const navigate = useNavigate();
  const isTaxi = order.service_type === 'taxi';
  const plan = subscription?.plan;
  const tier = subscription?.tier || 'standard';
  // Driver's keep % for this job: taxi = 100 - taxi_cut_pct; delivery = driver_keep_pct.
  const taxiCut = plan?.taxi_cut_pct ?? (tier === 'standard' ? 20 : tier === 'pro' ? 5 : 0);
  const keepPct = isTaxi ? 100 - taxiCut : (plan?.driver_keep_pct ?? 80);
  const planName = plan?.name || (tier === 'standard' ? 'Standard' : tier);

  return (
  <Card className="bg-gold-500/15" data-testid={`order-request-${order.id}`}>
    <CardContent className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="font-semibold text-lg">
              {isTaxi ? 'New Ride' : 'New Order'} #{order.id?.substring(0, 8)}
            </h3>
            {isTaxi && (
              <Badge className="bg-cyan-500/20 text-cyan-100" data-testid={`ride-badge-${order.id}`}>
                <Car className="h-3 w-3 mr-1" /> Taxi
              </Badge>
            )}
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
              Est. {order.estimated_duration_min || 30} min {isTaxi ? 'ride' : 'delivery'}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gold-500">
            ${order.driver_earnings?.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground">You&apos;ll earn</p>
        </div>
      </div>

      {/* Live commission — what the driver keeps on THIS job, per their plan */}
      <div
        className="flex items-center justify-between gap-2 mb-4 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25"
        data-testid={`keep-rate-${order.id}`}
      >
        <span className="text-sm text-emerald-200 flex items-center gap-1.5">
          <TrendingUp className="h-4 w-4" />
          You keep <strong>{keepPct}%</strong> {isTaxi ? 'of this fare' : 'of the delivery fee'} · {planName} plan
        </span>
        {isTaxi && tier === 'standard' && (
          <button
            onClick={() => navigate('/driver/subscription')}
            className="text-xs font-semibold text-emerald-300 underline shrink-0"
            data-testid={`upgrade-hint-${order.id}`}
          >
            Keep more →
          </button>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4 p-4 bg-card rounded-lg">
        <div>
          <p className="font-medium text-sm mb-1">Pickup:</p>
          <p className="text-sm text-muted-foreground">{order.pickup_address?.street_address}</p>
        </div>
        <div>
          <p className="font-medium text-sm mb-1">{isTaxi ? 'Dropoff:' : 'Delivery:'}</p>
          <p className="text-sm text-muted-foreground">{order.delivery_address?.street_address}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={() => onAccept(order.id)}
          className="flex-1 bg-green-600 hover:bg-green-700"
          data-testid={`accept-order-${order.id}`}
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          {isTaxi ? 'Accept Ride' : 'Accept Order'}
        </Button>
        <Button
          onClick={() => onReject(order.id)}
          variant="outline"
          className="flex-1"
          data-testid={`reject-order-${order.id}`}
        >
          <X className="h-4 w-4 mr-2" />
          Decline
        </Button>
      </div>
    </CardContent>
  </Card>
  );
};

export default OrderRequestCard;
