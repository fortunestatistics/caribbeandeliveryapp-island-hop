import React from 'react';
import { Card, CardContent } from './components/ui/card';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { MapPin, Clock, CheckCircle, X } from 'lucide-react';

/**
 * Single new-order-request card with Accept/Decline buttons.
 * Props: { order, onAccept(orderId), onReject(orderId) }
 */
const OrderRequestCard = ({ order, onAccept, onReject }) => (
  <Card className="bg-gold-500/15" data-testid={`order-request-${order.id}`}>
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
          <p className="text-xs text-muted-foreground">You&apos;ll earn</p>
        </div>
      </div>

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

      <div className="flex gap-2">
        <Button
          onClick={() => onAccept(order.id)}
          className="flex-1 bg-green-600 hover:bg-green-700"
          data-testid={`accept-order-${order.id}`}
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          Accept Order
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

export default OrderRequestCard;
