import React from 'react';
<<<<<<< HEAD
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from './components/ui/card';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { MapPin, Clock, CheckCircle, X, Car, TrendingUp, Navigation } from 'lucide-react';
import { formatAddress, mapsLink } from './formatAddress';
import { useCurrency } from './CurrencyContext';

/**
 * Single new-order-request card with Accept/Decline buttons.
 * Props: { order, onAccept(orderId), onReject(orderId), subscription }
 */
const OrderRequestCard = ({ order, onAccept, onReject, subscription }) => {
  const navigate = useNavigate();
  const { format } = useCurrency();
  const isTaxi = order.service_type === 'taxi';
  const earnings = format(Number(order.driver_earnings ?? order.driver_delivery_portion ?? order.delivery_fee ?? 0));
  const plan = subscription?.plan;
  const tier = subscription?.tier || 'standard';
  // Driver's keep % for this job: taxi = 100 - taxi_cut_pct; delivery = driver_keep_pct.
  const taxiCut = plan?.taxi_cut_pct ?? (tier === 'standard' ? 20 : tier === 'pro' ? 5 : 0);
  const keepPct = isTaxi ? 100 - taxiCut : (plan?.driver_keep_pct ?? 80);
  const planName = plan?.name || (tier === 'standard' ? 'Standard' : tier);

  return (
=======
import { Card, CardContent } from './components/ui/card';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { MapPin, Clock, CheckCircle, X } from 'lucide-react';

/**
 * Single new-order-request card with Accept/Decline buttons.
 * Props: { order, onAccept(orderId), onReject(orderId) }
 */
const OrderRequestCard = ({ order, onAccept, onReject }) => (
>>>>>>> cb805eb
  <Card className="bg-gold-500/15" data-testid={`order-request-${order.id}`}>
    <CardContent className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="font-semibold text-lg">
<<<<<<< HEAD
              {isTaxi ? 'New Ride' : 'New Order'} #{order.id?.substring(0, 8)}
            </h3>
            {isTaxi && (
              <Badge className="bg-cyan-500/20 text-cyan-100" data-testid={`ride-badge-${order.id}`}>
                <Car className="h-3 w-3 mr-1" /> Taxi
              </Badge>
            )}
            <Badge className="bg-gold-500/15 text-white">
              {earnings} Earnings
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            {order.estimated_distance_km != null && (
              <p>
                <MapPin className="h-4 w-4 inline mr-1" />
                {order.estimated_distance_km?.toFixed(1)} km away
              </p>
            )}
            <p>
              <Clock className="h-4 w-4 inline mr-1" />
              Est. {order.estimated_duration_min || 30} min {isTaxi ? 'ride' : 'delivery'}
=======
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
>>>>>>> cb805eb
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gold-500">
<<<<<<< HEAD
            {earnings}
=======
            ${order.driver_earnings?.toFixed(2)}
>>>>>>> cb805eb
          </p>
          <p className="text-xs text-muted-foreground">You&apos;ll earn</p>
        </div>
      </div>

<<<<<<< HEAD
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
          <p className="font-medium text-sm mb-1 flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> Pickup{isTaxi ? '' : ' (store)'}:
          </p>
          <p className="text-sm text-muted-foreground" data-testid={`request-pickup-${order.id}`}>
            {formatAddress(order.pickup_address) || 'Address not provided'}
          </p>
          {mapsLink(order.pickup_address) && (
            <a href={mapsLink(order.pickup_address)} target="_blank" rel="noopener noreferrer"
               className="inline-flex items-center gap-1 text-xs text-gold-600 underline mt-1"
               data-testid={`request-pickup-map-${order.id}`}>
              <Navigation className="h-3 w-3" /> View on map
            </a>
          )}
        </div>
        <div>
          <p className="font-medium text-sm mb-1 flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-red-500" /> {isTaxi ? 'Dropoff:' : 'Delivery to customer:'}
          </p>
          <p className="text-sm text-muted-foreground" data-testid={`request-dropoff-${order.id}`}>
            {formatAddress(order.delivery_address) || 'Address not provided'}
          </p>
          {mapsLink(order.delivery_address) && (
            <a href={mapsLink(order.delivery_address)} target="_blank" rel="noopener noreferrer"
               className="inline-flex items-center gap-1 text-xs text-gold-600 underline mt-1"
               data-testid={`request-dropoff-map-${order.id}`}>
              <Navigation className="h-3 w-3" /> View on map
            </a>
          )}
=======
      <div className="grid md:grid-cols-2 gap-4 mb-4 p-4 bg-card rounded-lg">
        <div>
          <p className="font-medium text-sm mb-1">Pickup:</p>
          <p className="text-sm text-muted-foreground">{order.pickup_address?.street_address}</p>
        </div>
        <div>
          <p className="font-medium text-sm mb-1">Delivery:</p>
          <p className="text-sm text-muted-foreground">{order.delivery_address?.street_address}</p>
>>>>>>> cb805eb
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={() => onAccept(order.id)}
          className="flex-1 bg-green-600 hover:bg-green-700"
          data-testid={`accept-order-${order.id}`}
        >
          <CheckCircle className="h-4 w-4 mr-2" />
<<<<<<< HEAD
          {isTaxi ? 'Accept Ride' : 'Accept Order'}
=======
          Accept Order
>>>>>>> cb805eb
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
<<<<<<< HEAD
  );
};
=======
);
>>>>>>> cb805eb

export default OrderRequestCard;
