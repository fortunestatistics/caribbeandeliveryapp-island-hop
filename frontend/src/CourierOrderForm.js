import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Separator } from './components/ui/separator';
import CurrencyConverter from './CurrencyConverter';
import { 
  Package, 
  MapPin, 
  User,
  Phone,
  Scale,
  Ruler,
  Clock,
  DollarSign,
  AlertCircle
} from 'lucide-react';

const CourierOrderForm = () => {
  const navigate = useNavigate();
  const [orderData, setOrderData] = useState({
    // Sender Information
    senderName: '',
    senderPhone: '',
    pickupAddress: '',
    pickupInstructions: '',
    
    // Recipient Information
    recipientName: '',
    recipientPhone: '',
    deliveryAddress: '',
    deliveryInstructions: '',
    
    // Package Details
    packageType: 'document',
    weight: '',
    dimensions: '',
    value: '',
    fragile: false,
    requiresSignature: true,
    
    // Delivery Options
    deliverySpeed: 'standard',
    pickupTime: 'now',
    scheduledDate: '',
    scheduledTime: ''
  });

  const packageTypes = [
    { id: 'document', name: 'Documents', icon: '📄', baseFare: 5.00 },
    { id: 'small', name: 'Small Package', icon: '📦', baseFare: 8.00 },
    { id: 'medium', name: 'Medium Package', icon: '📦', baseFare: 12.00 },
    { id: 'large', name: 'Large Package', icon: '📦', baseFare: 18.00 },
    { id: 'fragile', name: 'Fragile Items', icon: '⚠️', baseFare: 15.00 }
  ];

  const deliveryOptions = [
    { id: 'standard', name: 'Standard', time: '2-4 hours', multiplier: 1.0 },
    { id: 'express', name: 'Express', time: '1-2 hours', multiplier: 1.5 },
    { id: 'sameday', name: 'Same Day', time: 'Within 6 hours', multiplier: 1.2 },
    { id: 'scheduled', name: 'Scheduled', time: 'Choose date & time', multiplier: 1.1 }
  ];

  const handleInputChange = (field, value) => {
    setOrderData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const calculateFare = () => {
    const packageType = packageTypes.find(p => p.id === orderData.packageType);
    const deliveryOption = deliveryOptions.find(d => d.id === orderData.deliverySpeed);
    
    let baseFare = packageType.baseFare;
    
    // Add weight surcharge if over 5kg
    if (orderData.weight && parseFloat(orderData.weight) > 5) {
      baseFare += (parseFloat(orderData.weight) - 5) * 2;
    }
    
    // Apply delivery speed multiplier
    baseFare *= deliveryOption.multiplier;
    
    // Add insurance if high value
    if (orderData.value && parseFloat(orderData.value) > 100) {
      baseFare += 5;
    }
    
    // Add signature fee
    if (orderData.requiresSignature) {
      baseFare += 2;
    }
    
    return baseFare.toFixed(2);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const courierOrder = {
      service_type: 'courier',
      ...orderData,
      total: parseFloat(calculateFare())
    };

    navigate('/checkout', { state: { orderData: courierOrder, serviceType: 'courier' } });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br bg-background py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-4"
        >
          ← Back to Home
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-3xl flex items-center">
              <Package className="h-8 w-8 mr-3 text-purple-600" />
              Courier Service
            </CardTitle>
            <p className="text-muted-foreground mt-2">Fast and secure package delivery across the islands</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Sender Information */}
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                  <MapPin className="h-5 w-5 mr-2 text-gold-500" />
                  Sender Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="senderName">Sender Name</Label>
                    <div className="relative mt-1">
                      <User className="absolute left-3 top-3 h-5 w-5 text-muted-foreground/70" />
                      <Input
                        id="senderName"
                        placeholder="Your name"
                        className="pl-10"
                        value={orderData.senderName}
                        onChange={(e) => handleInputChange('senderName', e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="senderPhone">Sender Phone</Label>
                    <div className="relative mt-1">
                      <Phone className="absolute left-3 top-3 h-5 w-5 text-muted-foreground/70" />
                      <Input
                        id="senderPhone"
                        type="tel"
                        placeholder="+1 (876) 555-1234"
                        className="pl-10"
                        value={orderData.senderPhone}
                        onChange={(e) => handleInputChange('senderPhone', e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="pickupAddress">Pickup Address</Label>
                    <Input
                      id="pickupAddress"
                      placeholder="123 Main Street, Kingston, Jamaica"
                      value={orderData.pickupAddress}
                      onChange={(e) => handleInputChange('pickupAddress', e.target.value)}
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="pickupInstructions">Pickup Instructions (Optional)</Label>
                    <Input
                      id="pickupInstructions"
                      placeholder="Building number, floor, special instructions..."
                      value={orderData.pickupInstructions}
                      onChange={(e) => handleInputChange('pickupInstructions', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Recipient Information */}
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                  <MapPin className="h-5 w-5 mr-2 text-gold-500" />
                  Recipient Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="recipientName">Recipient Name</Label>
                    <div className="relative mt-1">
                      <User className="absolute left-3 top-3 h-5 w-5 text-muted-foreground/70" />
                      <Input
                        id="recipientName"
                        placeholder="Recipient name"
                        className="pl-10"
                        value={orderData.recipientName}
                        onChange={(e) => handleInputChange('recipientName', e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="recipientPhone">Recipient Phone</Label>
                    <div className="relative mt-1">
                      <Phone className="absolute left-3 top-3 h-5 w-5 text-muted-foreground/70" />
                      <Input
                        id="recipientPhone"
                        type="tel"
                        placeholder="+1 (876) 555-5678"
                        className="pl-10"
                        value={orderData.recipientPhone}
                        onChange={(e) => handleInputChange('recipientPhone', e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="deliveryAddress">Delivery Address</Label>
                    <Input
                      id="deliveryAddress"
                      placeholder="456 Beach Road, Montego Bay, Jamaica"
                      value={orderData.deliveryAddress}
                      onChange={(e) => handleInputChange('deliveryAddress', e.target.value)}
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="deliveryInstructions">Delivery Instructions (Optional)</Label>
                    <Input
                      id="deliveryInstructions"
                      placeholder="Building number, security code, special instructions..."
                      value={orderData.deliveryInstructions}
                      onChange={(e) => handleInputChange('deliveryInstructions', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Package Details */}
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                  <Package className="h-5 w-5 mr-2 text-purple-600" />
                  Package Details
                </h3>
                
                {/* Package Type */}
                <div className="mb-4">
                  <Label>Package Type</Label>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-2">
                    {packageTypes.map((type) => (
                      <Card
                        key={type.id}
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          orderData.packageType === type.id
                            ? 'border-2 border-purple-500 bg-purple-50'
                            : 'border border-border'
                        }`}
                        onClick={() => handleInputChange('packageType', type.id)}
                      >
                        <CardContent className="p-3 text-center">
                          <div className="text-2xl mb-1">{type.icon}</div>
                          <div className="text-xs font-semibold text-foreground">{type.name}</div>
                          <div className="text-xs text-muted-foreground">${type.baseFare}</div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="weight">Weight (kg)</Label>
                    <div className="relative mt-1">
                      <Scale className="absolute left-3 top-3 h-5 w-5 text-muted-foreground/70" />
                      <Input
                        id="weight"
                        type="number"
                        step="0.1"
                        placeholder="0.5"
                        className="pl-10"
                        value={orderData.weight}
                        onChange={(e) => handleInputChange('weight', e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="dimensions">Dimensions (cm)</Label>
                    <div className="relative mt-1">
                      <Ruler className="absolute left-3 top-3 h-5 w-5 text-muted-foreground/70" />
                      <Input
                        id="dimensions"
                        placeholder="L x W x H"
                        className="pl-10"
                        value={orderData.dimensions}
                        onChange={(e) => handleInputChange('dimensions', e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="value">Package Value ($)</Label>
                    <div className="relative mt-1">
                      <DollarSign className="absolute left-3 top-3 h-5 w-5 text-muted-foreground/70" />
                      <Input
                        id="value"
                        type="number"
                        placeholder="50.00"
                        className="pl-10"
                        value={orderData.value}
                        onChange={(e) => handleInputChange('value', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Package Options */}
                <div className="mt-4 space-y-3">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="fragile"
                      checked={orderData.fragile}
                      onChange={(e) => handleInputChange('fragile', e.target.checked)}
                      className="w-4 h-4 text-purple-600"
                    />
                    <label htmlFor="fragile" className="text-sm text-foreground/90 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1 text-gold-500" />
                      Fragile - Handle with care
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="signature"
                      checked={orderData.requiresSignature}
                      onChange={(e) => handleInputChange('requiresSignature', e.target.checked)}
                      className="w-4 h-4 text-purple-600"
                    />
                    <label htmlFor="signature" className="text-sm text-foreground/90">
                      Require signature on delivery (+$2.00)
                    </label>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Delivery Options */}
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                  <Clock className="h-5 w-5 mr-2 text-gold-500" />
                  Delivery Options
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {deliveryOptions.map((option) => (
                    <Card
                      key={option.id}
                      className={`cursor-pointer transition-all hover:shadow-lg ${
                        orderData.deliverySpeed === option.id
                          ? 'border-2 border-gold-500/30 bg-gold-500/15'
                          : 'border border-border'
                      }`}
                      onClick={() => handleInputChange('deliverySpeed', option.id)}
                    >
                      <CardContent className="p-4">
                        <h4 className="font-semibold text-foreground">{option.name}</h4>
                        <p className="text-sm text-muted-foreground">{option.time}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {orderData.deliverySpeed === 'scheduled' && (
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <Label htmlFor="scheduledDate">Scheduled Date</Label>
                      <Input
                        id="scheduledDate"
                        type="date"
                        value={orderData.scheduledDate}
                        onChange={(e) => handleInputChange('scheduledDate', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="scheduledTime">Scheduled Time</Label>
                      <Input
                        id="scheduledTime"
                        type="time"
                        value={orderData.scheduledTime}
                        onChange={(e) => handleInputChange('scheduledTime', e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Fare Estimate */}
              <div className="bg-matte-800 border border-gold-500/30 p-6 rounded-lg shadow-gold-glow">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Total Delivery Cost</h3>
                    <p className="text-sm text-muted-foreground mt-1">Includes pickup, delivery, and all fees</p>
                  </div>
                  <CurrencyConverter amountUSD={parseFloat(calculateFare()) || 0} size="lg" />
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full text-lg py-6"
              >
                Continue to Checkout
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CourierOrderForm;
