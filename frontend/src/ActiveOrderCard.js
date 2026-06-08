import React from 'react';
import { Card, CardContent } from './components/ui/card';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { MapPin, CheckCircle, Navigation, Eye, Phone, MessageCircle } from 'lucide-react';

const STATUS_BADGE_MAP = {
  picked_up: 'bg-blue-500',
  in_transit: 'bg-indigo-500',
};

/**
 * Single active-delivery card with status-driven action buttons.
 * Props: { order, onNavigate(address), onUpdateStatus(orderId, status), onView(orderId) }
 */
const ActiveOrderCard = ({ order, onNavigate, onUpdateStatus, onView }) => {
  const badgeCls = STATUS_BADGE_MAP[order.status] || 'bg-green-500';

  return (
    <Card className="hover:shadow-md transition-shadow" data-testid={`active-order-${order.id}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="font-semibold text-lg">
                Order #{order.id?.substring(0, 8)}
              </h3>
              <Badge className={badgeCls}>
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

        <div className="flex gap-2">
          {order.status === 'ready' && (
            <>
              <Button onClick={() => onNavigate(order.pickup_address)} variant="outline" className="flex-1">
                <Navigation className="h-4 w-4 mr-2" />
                Navigate to Pickup
              </Button>
              <Button
                onClick={() => onUpdateStatus(order.id, 'picked_up')}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                data-testid={`pickup-${order.id}`}
              >
                Mark Picked Up
              </Button>
            </>
          )}

          {order.status === 'picked_up' && (
            <>
              <Button onClick={() => onNavigate(order.delivery_address)} variant="outline" className="flex-1">
                <Navigation className="h-4 w-4 mr-2" />
                Navigate to Customer
              </Button>
              <Button
                onClick={() => onUpdateStatus(order.id, 'in_transit')}
                className="flex-1"
                data-testid={`start-delivery-${order.id}`}
              >
                Start Delivery
              </Button>
            </>
          )}

          {order.status === 'in_transit' && (
            <Button
              onClick={() => onUpdateStatus(order.id, 'delivered')}
              className="flex-1 bg-green-600 hover:bg-green-700"
              data-testid={`mark-delivered-${order.id}`}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Mark Delivered
            </Button>
          )}

          <Button onClick={() => onView(order.id)} variant="outline" size="sm">
            <Eye className="h-4 w-4" />
          </Button>
        </div>

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
  );
};

export default ActiveOrderCard;
