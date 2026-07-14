import React, { useState, useEffect } from 'react';
import { useCurrency } from './CurrencyContext';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Badge } from './components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';
import CurrencyConverter from './CurrencyConverter';
import { useToast } from './hooks/use-toast';
import { 
  Car, 
  MapPin, 
  Calendar, 
  Clock, 
  DollarSign, 
  Users, 
  Fuel, 
  Settings, 
  Shield, 
  Star,
  Navigation,
  Phone,
  Mail,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CarRentalPage = () => {
  const { format } = useCurrency();
  const [rentalCompanies, setRentalCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [availableVehicles, setAvailableVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [bookingForm, setBookingForm] = useState({
    pickupLocation: '',
    dropoffLocation: '',
    pickupDate: '',
    pickupTime: '',
    dropoffDate: '',
    dropoffTime: '',
    driverAge: '',
    licenseNumber: '',
    insuranceSelected: false
  });
  const [loading, setLoading] = useState(true);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchRentalCompanies();
    // eslint-disable-next-line -- load once on mount
  }, []);

  const fetchRentalCompanies = async () => {
    try {
      const response = await axios.get(`${API}/car-rentals`);
      setRentalCompanies(response.data);
    } catch (error) {
      console.error('Error fetching rental companies:', error);
      toast({
        title: "Error",
        description: "Failed to load rental companies",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableVehicles = async (companyId) => {
    if (!bookingForm.pickupDate || !bookingForm.dropoffDate) {
      toast({
        title: "Please select dates",
        description: "Select pickup and dropoff dates to see available vehicles",
      });
      return;
    }

    try {
      const response = await axios.get(`${API}/car-rentals/${companyId}/available-vehicles`, {
        params: {
          pickup_date: `${bookingForm.pickupDate}T${bookingForm.pickupTime || '09:00'}`,
          dropoff_date: `${bookingForm.dropoffDate}T${bookingForm.dropoffTime || '17:00'}`,
          location: bookingForm.pickupLocation
        }
      });
      setAvailableVehicles(response.data);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
    }
  };

  const handleBooking = async () => {
    if (!selectedVehicle || !selectedCompany) {
      toast({
        title: "Error",
        description: "Please select a vehicle to book",
        variant: "destructive",
      });
      return;
    }

    try {
      const pickupDateTime = new Date(`${bookingForm.pickupDate}T${bookingForm.pickupTime || '09:00'}`);
      const dropoffDateTime = new Date(`${bookingForm.dropoffDate}T${bookingForm.dropoffTime || '17:00'}`);
      const days = Math.max(1, Math.ceil((dropoffDateTime - pickupDateTime) / (1000 * 60 * 60 * 24)));
      
      const totalCost = selectedVehicle.daily_rate * days;
      const insuranceCost = bookingForm.insuranceSelected ? days * 15 : 0;
      const securityDeposit = selectedVehicle.daily_rate * 2;

      const bookingData = {
        rental_company_id: selectedCompany.id,
        vehicle_id: selectedVehicle.id,
        pickup_location: bookingForm.pickupLocation,
        dropoff_location: bookingForm.dropoffLocation,
        pickup_datetime: pickupDateTime.toISOString(),
        dropoff_datetime: dropoffDateTime.toISOString(),
        rental_duration_days: days,
        daily_rate: selectedVehicle.daily_rate,
        total_cost: totalCost + insuranceCost,
        security_deposit: securityDeposit,
        insurance_selected: bookingForm.insuranceSelected,
        insurance_cost: insuranceCost,
        driver_info: {
          age: bookingForm.driverAge,
          license_number: bookingForm.licenseNumber
        },
        additional_services: []
      };

      const response = await axios.post(`${API}/car-rentals/bookings`, bookingData, {
        withCredentials: false
      });

      toast({
        title: "Booking successful!",
        description: `Your booking ${response.data.booking_number} has been created`,
      });

      setShowBookingModal(false);
      setSelectedVehicle(null);
      
    } catch (error) {
      console.error('Error creating booking:', error);
      toast({
        title: "Error",
        description: "Failed to create booking. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getVehicleIcon = (type) => {
    switch (type.toLowerCase()) {
      case 'luxury':
      case 'convertible':
        return '🏎️';
      case 'suv':
        return '🚙';
      case 'economy':
      case 'compact':
        return '🚗';
      default:
        return '🚘';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-matte-900 py-12">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-foreground mb-8">Loading Car Rentals...</h1>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-matte-900 py-12">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">Caribbean Car Rentals</h1>
          <p className="text-xl text-muted-foreground">Explore the islands with reliable vehicle rentals</p>
        </div>

        {/* Booking Form */}
        <Card className="mb-12 bg-matte-800 border border-border shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="h-5 w-5 mr-2 text-gold-500" />
              Search Available Vehicles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <Label htmlFor="pickupLocation">Pickup Location</Label>
                <Select value={bookingForm.pickupLocation} onValueChange={(value) => setBookingForm(prev => ({...prev, pickupLocation: value}))}>
                  <SelectTrigger data-testid="pickup-location-select">
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="airport">Airport Terminal</SelectItem>
                    <SelectItem value="downtown">Downtown Kingston</SelectItem>
                    <SelectItem value="hotel_pickup">Hotel Pickup</SelectItem>
                    <SelectItem value="port">Cruise Port</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="pickupDate">Pickup Date</Label>
                <Input
                  type="date"
                  value={bookingForm.pickupDate}
                  onChange={(e) => setBookingForm(prev => ({...prev, pickupDate: e.target.value}))}
                  min={new Date().toISOString().split('T')[0]}
                  data-testid="pickup-date-input"
                />
              </div>

              <div>
                <Label htmlFor="dropoffDate">Return Date</Label>
                <Input
                  type="date"
                  value={bookingForm.dropoffDate}
                  onChange={(e) => setBookingForm(prev => ({...prev, dropoffDate: e.target.value}))}
                  min={bookingForm.pickupDate || new Date().toISOString().split('T')[0]}
                  data-testid="dropoff-date-input"
                />
              </div>

              <div className="flex items-end">
                <Button 
                  className="w-full bg-gold-gradient text-white"
                  onClick={() => {
                    if (rentalCompanies.length > 0) {
                      fetchAvailableVehicles(rentalCompanies[0].id);
                      setSelectedCompany(rentalCompanies[0]);
                    }
                  }}
                  disabled={!bookingForm.pickupDate || !bookingForm.dropoffDate || !bookingForm.pickupLocation}
                  data-testid="search-vehicles-btn"
                >
                  Search Vehicles
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rental Companies */}
        {!selectedCompany ? (
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-6">Car Rental Companies</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rentalCompanies.map((company) => (
                <Card 
                  key={company.id}
                  className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-2 bg-matte-800 border border-border cursor-pointer"
                  onClick={() => {
                    setSelectedCompany(company);
                    fetchAvailableVehicles(company.id);
                  }}
                  data-testid={`rental-company-${company.id}`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center mb-4">
                      <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center mr-4">
                        <Car className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-foreground">{company.company_name}</h3>
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Star className="h-4 w-4 text-gold-500 mr-1" />
                          {company.rating}
                          <span className="mx-2">•</span>
                          <span>{company.fleet?.length || 0} vehicles</span>
                        </div>
                      </div>
                    </div>

                    <p className="text-muted-foreground mb-4">{company.description}</p>

                    <div className="space-y-2 mb-4">
                      {company.locations?.map((location, index) => (
                        <div key={location.name || `loc-${index}`} className="flex items-center text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4 mr-2" />
                          {location.name}
                        </div>
                      ))}
                    </div>

                    <Badge variant="secondary" className="mb-2">
                      Airport Pickup Available
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          /* Vehicle Selection */
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground">{selectedCompany.company_name}</h2>
                <p className="text-muted-foreground">Available vehicles for your selected dates</p>
              </div>
              <Button 
                variant="outline"
                onClick={() => {
                  setSelectedCompany(null);
                  setAvailableVehicles([]);
                }}
              >
                ← Back to Companies
              </Button>
            </div>

            {availableVehicles.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {availableVehicles.map((vehicle) => (
                  <Card 
                    key={vehicle.id}
                    className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-2 bg-matte-800 border border-border"
                  >
                    <CardContent className="p-6">
                      <div className="text-center mb-4">
                        <div className="text-4xl mb-2">{getVehicleIcon(vehicle.vehicle_type)}</div>
                        <h3 className="text-xl font-bold text-foreground">
                          {vehicle.make} {vehicle.model}
                        </h3>
                        <p className="text-sm text-muted-foreground">{vehicle.year} • {vehicle.color}</p>
                      </div>

                      <div className="space-y-3 mb-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center text-muted-foreground">
                            <Users className="h-4 w-4 mr-1" />
                            Passengers
                          </span>
                          <span className="font-semibold">{vehicle.passenger_capacity}</span>
                        </div>
                        
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center text-muted-foreground">
                            <Settings className="h-4 w-4 mr-1" />
                            Transmission
                          </span>
                          <span className="font-semibold capitalize">{vehicle.transmission}</span>
                        </div>
                        
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center text-muted-foreground">
                            <Fuel className="h-4 w-4 mr-1" />
                            Fuel Type
                          </span>
                          <span className="font-semibold capitalize">{vehicle.fuel_type}</span>
                        </div>
                      </div>

                      <div className="border-t pt-4">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-2xl font-bold text-gold-500">
                            {format(vehicle.daily_rate)}/day
                          </span>
                          <Badge 
                            variant="secondary"
                            className={vehicle.status === 'available' ? 'bg-green-100 text-green-800' : 'bg-matte-800'}
                          >
                            {vehicle.status}
                          </Badge>
                        </div>

                        <div className="mb-4">
                          <p className="text-xs text-muted-foreground mb-2">Features:</p>
                          <div className="flex flex-wrap gap-1">
                            {vehicle.features?.slice(0, 3).map((feature) => (
                              <Badge key={feature} variant="outline" className="text-xs">
                                {feature}
                              </Badge>
                            ))}
                            {vehicle.features?.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{vehicle.features.length - 3} more
                              </Badge>
                            )}
                          </div>
                        </div>

                        <Dialog open={showBookingModal} onOpenChange={setShowBookingModal}>
                          <DialogTrigger asChild>
                            <Button 
                              className="w-full bg-gold-gradient text-white"
                              onClick={() => {
                                setSelectedVehicle(vehicle);
                                setShowBookingModal(true);
                              }}
                              disabled={vehicle.status !== 'available'}
                              data-testid={`book-vehicle-${vehicle.id}`}
                            >
                              Book Now
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-md">
                            <DialogHeader>
                              <DialogTitle>Complete Your Booking</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label htmlFor="pickupTime">Pickup Time</Label>
                                  <Input
                                    type="time"
                                    value={bookingForm.pickupTime}
                                    onChange={(e) => setBookingForm(prev => ({...prev, pickupTime: e.target.value}))}
                                    data-testid="pickup-time-input"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="dropoffTime">Return Time</Label>
                                  <Input
                                    type="time"
                                    value={bookingForm.dropoffTime}
                                    onChange={(e) => setBookingForm(prev => ({...prev, dropoffTime: e.target.value}))}
                                    data-testid="dropoff-time-input"
                                  />
                                </div>
                              </div>

                              <div>
                                <Label htmlFor="driverAge">Driver Age</Label>
                                <Input
                                  type="number"
                                  min="21"
                                  max="75"
                                  value={bookingForm.driverAge}
                                  onChange={(e) => setBookingForm(prev => ({...prev, driverAge: e.target.value}))}
                                  data-testid="driver-age-input"
                                />
                              </div>

                              <div>
                                <Label htmlFor="licenseNumber">Driver License Number</Label>
                                <Input
                                  value={bookingForm.licenseNumber}
                                  onChange={(e) => setBookingForm(prev => ({...prev, licenseNumber: e.target.value}))}
                                  data-testid="license-input"
                                />
                              </div>

                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id="insurance"
                                  checked={bookingForm.insuranceSelected}
                                  onChange={(e) => setBookingForm(prev => ({...prev, insuranceSelected: e.target.checked}))}
                                  data-testid="insurance-checkbox"
                                />
                                <Label htmlFor="insurance" className="text-sm">
                                  Add Comprehensive Insurance (+{format(15)}/day)
                                </Label>
                              </div>

                              <div className="border-t border-border pt-4">
                                <div className="flex justify-between text-sm mb-2 text-muted-foreground">
                                  <span>Daily Rate:</span>
                                  <span className="text-foreground">{format(selectedVehicle?.daily_rate || 0)}</span>
                                </div>
                                {bookingForm.insuranceSelected && (
                                  <div className="flex justify-between text-sm mb-2 text-muted-foreground">
                                    <span>Insurance:</span>
                                    <span className="text-foreground">{format(15)}/day</span>
                                  </div>
                                )}
                                <div className="flex justify-between items-center pt-3 mt-2 border-t border-gold-500/30 gap-3 flex-wrap">
                                  <span className="font-semibold text-foreground">Total</span>
                                  <CurrencyConverter
                                    amountUSD={((selectedVehicle?.daily_rate || 0) + (bookingForm.insuranceSelected ? 15 : 0)) *
                                      Math.max(1, bookingForm.pickupDate && bookingForm.dropoffDate ?
                                        Math.ceil((new Date(bookingForm.dropoffDate) - new Date(bookingForm.pickupDate)) / (1000 * 60 * 60 * 24)) : 1
                                      )}
                                    size="lg"
                                  />
                                </div>
                              </div>

                              <Button 
                                onClick={handleBooking}
                                className="w-full bg-gold-gradient text-white"
                                disabled={!bookingForm.driverAge || !bookingForm.licenseNumber}
                                data-testid="confirm-booking-btn"
                              >
                                Confirm Booking
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Car className="h-16 w-16 text-muted-foreground/70 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">No vehicles available</h3>
                <p className="text-muted-foreground">Try different dates or contact the rental company directly.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CarRentalPage;