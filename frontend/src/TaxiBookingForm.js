import React, { useState } from 'react';
import { useCurrency } from './CurrencyContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Separator } from './components/ui/separator';
import { 
  MapPin, 
  Clock, 
  Users, 
  Calendar,
  Car,
  DollarSign,
  Navigation
} from 'lucide-react';

const TaxiBookingForm = () => {
  const { format } = useCurrency();
  const navigate = useNavigate();
  const [bookingData, setBookingData] = useState({
    pickupLocation: '',
    pickupAddress: '',
    dropoffLocation: '',
    dropoffAddress: '',
    pickupDate: '',
    pickupTime: '',
    vehicleType: 'standard',
    passengers: 1,
    luggage: 0,
    notes: '',
    estimatedDistance: '0 km',
    estimatedFare: 0
  });

  const vehicleTypes = [
    { 
      id: 'economy', 
      name: 'Economy', 
      description: 'Compact car, 3 passengers',
      baseFare: 5.00,
      perKm: 2.00,
      icon: '🚗'
    },
    { 
      id: 'standard', 
      name: 'Standard', 
      description: 'Sedan, 4 passengers',
      baseFare: 8.00,
      perKm: 2.50,
      icon: '🚘'
    },
    { 
      id: 'premium', 
      name: 'Premium', 
      description: 'Luxury sedan, 4 passengers',
      baseFare: 15.00,
      perKm: 4.00,
      icon: '🚙'
    },
    { 
      id: 'van', 
      name: 'Van', 
      description: 'Large vehicle, 6-7 passengers',
      baseFare: 12.00,
      perKm: 3.50,
      icon: '🚐'
    }
  ];

  const handleInputChange = (field, value) => {
    setBookingData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const calculateFare = () => {
    const vehicle = vehicleTypes.find(v => v.id === bookingData.vehicleType);
    // Simulate distance calculation (in production, use Google Maps API)
    const estimatedKm = 10;
    const fare = vehicle.baseFare + (estimatedKm * vehicle.perKm);
    return fare.toFixed(2);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Create order
    const orderData = {
      service_type: 'taxi',
      pickup_address: {
        location: bookingData.pickupLocation,
        full_address: bookingData.pickupAddress
      },
      delivery_address: {
        location: bookingData.dropoffLocation,
        full_address: bookingData.dropoffAddress
      },
      vehicle_type: bookingData.vehicleType,
      passengers: bookingData.passengers,
      pickup_time: `${bookingData.pickupDate} ${bookingData.pickupTime}`,
      notes: bookingData.notes,
      total: parseFloat(calculateFare())
    };

    // Navigate to checkout or order confirmation
    navigate('/checkout', { state: { orderData, serviceType: 'taxi' } });
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
              <Car className="h-8 w-8 mr-3 text-gold-500" />
              Book a Taxi Ride
            </CardTitle>
            <p className="text-muted-foreground mt-2">Safe and reliable rides across the Caribbean islands</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Pickup Location */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="pickupLocation">Pickup Location Name</Label>
                  <div className="relative mt-1">
                    <MapPin className="absolute left-3 top-3 h-5 w-5 text-muted-foreground/70" />
                    <Input
                      id="pickupLocation"
                      placeholder="e.g., Airport, Hotel, Home"
                      className="pl-10"
                      value={bookingData.pickupLocation}
                      onChange={(e) => handleInputChange('pickupLocation', e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="pickupAddress">Pickup Full Address</Label>
                  <Input
                    id="pickupAddress"
                    placeholder="123 Main Street, Kingston"
                    value={bookingData.pickupAddress}
                    onChange={(e) => handleInputChange('pickupAddress', e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Dropoff Location */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dropoffLocation">Dropoff Location Name</Label>
                  <div className="relative mt-1">
                    <Navigation className="absolute left-3 top-3 h-5 w-5 text-muted-foreground/70" />
                    <Input
                      id="dropoffLocation"
                      placeholder="e.g., Beach, Restaurant, Office"
                      className="pl-10"
                      value={bookingData.dropoffLocation}
                      onChange={(e) => handleInputChange('dropoffLocation', e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="dropoffAddress">Dropoff Full Address</Label>
                  <Input
                    id="dropoffAddress"
                    placeholder="456 Beach Road, Montego Bay"
                    value={bookingData.dropoffAddress}
                    onChange={(e) => handleInputChange('dropoffAddress', e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Date and Time */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="pickupDate">Pickup Date</Label>
                  <div className="relative mt-1">
                    <Calendar className="absolute left-3 top-3 h-5 w-5 text-muted-foreground/70" />
                    <Input
                      id="pickupDate"
                      type="date"
                      className="pl-10"
                      value={bookingData.pickupDate}
                      onChange={(e) => handleInputChange('pickupDate', e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="pickupTime">Pickup Time</Label>
                  <div className="relative mt-1">
                    <Clock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground/70" />
                    <Input
                      id="pickupTime"
                      type="time"
                      className="pl-10"
                      value={bookingData.pickupTime}
                      onChange={(e) => handleInputChange('pickupTime', e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Vehicle Type Selection */}
              <div>
                <Label>Select Vehicle Type</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                  {vehicleTypes.map((vehicle) => (
                    <Card
                      key={vehicle.id}
                      className={`cursor-pointer transition-all hover:shadow-lg ${
                        bookingData.vehicleType === vehicle.id
                          ? 'border-2 border-gold-500/30 bg-gold-500/15'
                          : 'border border-border'
                      }`}
                      onClick={() => handleInputChange('vehicleType', vehicle.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-3">
                          <span className="text-3xl">{vehicle.icon}</span>
                          <div className="flex-1">
                            <h4 className="font-semibold text-foreground">{vehicle.name}</h4>
                            <p className="text-sm text-muted-foreground">{vehicle.description}</p>
                            <p className="text-xs text-gold-500 mt-1">
                              {format(vehicle.baseFare)} base + {format(vehicle.perKm)}/km
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Passengers and Luggage */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="passengers">Number of Passengers</Label>
                  <div className="relative mt-1">
                    <Users className="absolute left-3 top-3 h-5 w-5 text-muted-foreground/70" />
                    <Input
                      id="passengers"
                      type="number"
                      min="1"
                      max="7"
                      className="pl-10"
                      value={bookingData.passengers}
                      onChange={(e) => handleInputChange('passengers', parseInt(e.target.value))}
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="luggage">Number of Luggage</Label>
                  <Input
                    id="luggage"
                    type="number"
                    min="0"
                    max="10"
                    value={bookingData.luggage}
                    onChange={(e) => handleInputChange('luggage', parseInt(e.target.value))}
                  />
                </div>
              </div>

              {/* Additional Notes */}
              <div>
                <Label htmlFor="notes">Additional Notes (Optional)</Label>
                <textarea
                  id="notes"
                  rows="3"
                  className="w-full mt-1 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-gold-500"
                  placeholder="Any special requests or instructions..."
                  value={bookingData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                />
              </div>

              <Separator />

              {/* Fare Estimate */}
              <div className="bg-gold-gradient p-6 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Estimated Fare</h3>
                    <p className="text-sm text-muted-foreground">Final fare may vary based on actual distance and traffic</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-gold-500">{format(parseFloat(calculateFare()))}</p>
                    <p className="text-sm text-muted-foreground">~10 km estimated</p>
                  </div>
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  <DollarSign className="h-4 w-4 mr-2" />
                  <span>Includes base fare, distance charge, and service fee</span>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full bg-gold-gradient text-white text-lg py-6"
              >
                Continue to Booking Confirmation
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TaxiBookingForm;
