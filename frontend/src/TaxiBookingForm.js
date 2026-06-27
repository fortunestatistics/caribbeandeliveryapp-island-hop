import React, { useState, useEffect, useCallback } from 'react';
import { useCurrency } from './CurrencyContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { LoadScript, Autocomplete } from '@react-google-maps/api';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Separator } from './components/ui/separator';
import { MapPin, Clock, Users, Calendar, Car, Navigation, Loader2, Route } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
const LIBRARIES = ['places'];
const authHeaders = () => {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
};

const TaxiBookingForm = () => {
  const { format, currency } = useCurrency();
  const navigate = useNavigate();

  const [vehicles, setVehicles] = useState([]);
  const [vehicleType, setVehicleType] = useState('standard');
  const [pickup, setPickup] = useState({ address: '', lat: null, lng: null });
  const [dropoff, setDropoff] = useState({ address: '', lat: null, lng: null });
  const [pickupDate, setPickupDate] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [passengers, setPassengers] = useState(1);
  const [notes, setNotes] = useState('');

  const [autoPickup, setAutoPickup] = useState(null);
  const [autoDropoff, setAutoDropoff] = useState(null);

  const [quote, setQuote] = useState(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [booking, setBooking] = useState(false);
  const [bookError, setBookError] = useState('');

  useEffect(() => {
    axios.get(`${API}/taxi/rate-card`)
      .then((r) => setVehicles(r.data.vehicles || []))
      .catch(() => setVehicles([]));
  }, []);

  const onPlace = (auto, setter) => {
    if (!auto) return;
    const p = auto.getPlace();
    const loc = p?.geometry?.location;
    if (!loc) return;
    setter({ address: p.formatted_address || p.name || '', lat: loc.lat(), lng: loc.lng() });
  };

  const fetchQuote = useCallback(async () => {
    if (pickup.lat == null || dropoff.lat == null) { setQuote(null); return; }
    setQuoting(true); setQuoteError('');
    try {
      const r = await axios.post(`${API}/taxi/quote`, {
        pickup_lat: pickup.lat, pickup_lng: pickup.lng,
        dropoff_lat: dropoff.lat, dropoff_lng: dropoff.lng,
        vehicle_type: vehicleType,
      });
      setQuote(r.data);
    } catch (e) {
      setQuote(null);
      setQuoteError(e.response?.data?.detail || 'Could not estimate fare for this route.');
    } finally { setQuoting(false); }
  }, [pickup, dropoff, vehicleType]);

  useEffect(() => { fetchQuote(); }, [fetchQuote]);

  const handleBook = async (e) => {
    e.preventDefault();
    setBookError('');
    if (!localStorage.getItem('token')) {
      navigate('/login');
      return;
    }
    if (!quote) { setBookError('Please choose pickup and drop-off so we can estimate your fare.'); return; }
    setBooking(true);
    try {
      let phone = '';
      try { phone = (await axios.get(`${API}/auth/me`, { headers: authHeaders() })).data?.phone || ''; } catch (_) {}
      const order = {
        customer_id: 'x',
        service_type: 'taxi',
        vendor_id: vehicleType,
        items: [],
        subtotal: 0,
        delivery_fee: quote.fare_usd,
        tip: 0,
        total: 0,
        pickup_address: { location: pickup.address, full_address: pickup.address, latitude: pickup.lat, longitude: pickup.lng, vehicle_type: vehicleType },
        delivery_address: { location: dropoff.address, full_address: dropoff.address, latitude: dropoff.lat, longitude: dropoff.lng },
        customer_phone: phone,
        payment_method: 'card',
        notes: `${notes}${pickupDate ? ` | Pickup: ${pickupDate} ${pickupTime}` : ''} | Passengers: ${passengers}`,
      };
      const r = await axios.post(`${API}/orders`, order, { headers: authHeaders() });
      navigate(`/checkout/${r.data.id}`);
    } catch (err) {
      setBookError(err.response?.data?.detail || 'Could not create your booking. Please try again.');
    } finally { setBooking(false); }
  };

  const body = (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <Button variant="ghost" onClick={() => navigate('/')} className="mb-4" data-testid="taxi-back-btn">← Back to Home</Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-3xl flex items-center">
              <Car className="h-8 w-8 mr-3 text-gold-500" />Book a Taxi Ride
            </CardTitle>
            <p className="text-muted-foreground mt-2">Real-time fares based on distance &amp; time across Trinidad &amp; Tobago</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleBook} className="space-y-6">
              {/* Pickup / Dropoff with autocomplete */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Pickup</Label>
                  <div className="relative mt-1">
                    <MapPin className="absolute left-3 top-3 h-5 w-5 text-muted-foreground/70 z-10" />
                    <Autocomplete onLoad={setAutoPickup} onPlaceChanged={() => onPlace(autoPickup, setPickup)}>
                      <Input data-testid="taxi-pickup-input" className="pl-10" placeholder="Search pickup address" defaultValue={pickup.address}
                        onChange={(e) => setPickup((s) => ({ ...s, address: e.target.value }))} required />
                    </Autocomplete>
                  </div>
                </div>
                <div>
                  <Label>Drop-off</Label>
                  <div className="relative mt-1">
                    <Navigation className="absolute left-3 top-3 h-5 w-5 text-muted-foreground/70 z-10" />
                    <Autocomplete onLoad={setAutoDropoff} onPlaceChanged={() => onPlace(autoDropoff, setDropoff)}>
                      <Input data-testid="taxi-dropoff-input" className="pl-10" placeholder="Search drop-off address" defaultValue={dropoff.address}
                        onChange={(e) => setDropoff((s) => ({ ...s, address: e.target.value }))} required />
                    </Autocomplete>
                  </div>
                </div>
              </div>

              {/* Date / Time */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="pickupDate">Pickup Date (optional)</Label>
                  <div className="relative mt-1">
                    <Calendar className="absolute left-3 top-3 h-5 w-5 text-muted-foreground/70" />
                    <Input id="pickupDate" type="date" className="pl-10" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="pickupTime">Pickup Time (optional)</Label>
                  <div className="relative mt-1">
                    <Clock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground/70" />
                    <Input id="pickupTime" type="time" className="pl-10" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Vehicle selection */}
              <div>
                <Label>Select Vehicle Type</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                  {vehicles.map((v) => (
                    <Card key={v.id} data-testid={`taxi-vehicle-${v.id}`}
                      className={`cursor-pointer transition-all hover:shadow-lg ${vehicleType === v.id ? 'border-2 border-gold-500/40 bg-gold-500/15' : 'border border-border'}`}
                      onClick={() => setVehicleType(v.id)}>
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-3">
                          <span className="text-3xl">{v.icon}</span>
                          <div className="flex-1">
                            <h4 className="font-semibold text-foreground">{v.name}</h4>
                            <p className="text-sm text-muted-foreground">Up to {v.seats} passengers</p>
                            <p className="text-xs text-gold-500 mt-1">
                              {currency === 'USD' ? `US$${v.base_usd.toFixed(2)} base + US$${v.per_km_usd.toFixed(2)}/km` : `TT$${v.base_ttd.toFixed(2)} base + TT$${v.per_km_ttd.toFixed(2)}/km`}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Passengers */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="passengers">Number of Passengers</Label>
                  <div className="relative mt-1">
                    <Users className="absolute left-3 top-3 h-5 w-5 text-muted-foreground/70" />
                    <Input id="passengers" type="number" min="1" max="7" className="pl-10" value={passengers} onChange={(e) => setPassengers(parseInt(e.target.value) || 1)} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Input id="notes" placeholder="Any special instructions" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </div>

              <Separator />

              {/* Fare estimate */}
              <div className="bg-gold-gradient p-6 rounded-lg" data-testid="taxi-fare-box">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Estimated Fare</h3>
                    {quote ? (
                      <p className="text-sm text-foreground/80 flex items-center gap-1 mt-1">
                        <Route className="h-4 w-4" />{quote.distance_km} km · ~{Math.round(quote.duration_min)} min
                      </p>
                    ) : (
                      <p className="text-sm text-foreground/70 mt-1">Choose pickup &amp; drop-off to see your fare</p>
                    )}
                  </div>
                  <div className="text-right">
                    {quoting ? (
                      <Loader2 className="h-7 w-7 animate-spin text-foreground" />
                    ) : (
                      <p className="text-3xl font-bold text-foreground" data-testid="taxi-fare-amount">
                        {quote ? format(quote.fare_usd) : '—'}
                      </p>
                    )}
                  </div>
                </div>
                {quoteError && <p className="text-sm text-red-700 mt-2" data-testid="taxi-quote-error">{quoteError}</p>}
                <p className="text-xs text-foreground/70 mt-3">Final fare may vary with actual route &amp; traffic. A $3 service fee applies at checkout.</p>
              </div>

              {bookError && <p className="text-sm text-red-600" data-testid="taxi-book-error">{bookError}</p>}

              <Button type="submit" disabled={booking || !quote} className="w-full bg-gold-gradient text-white text-lg py-6" data-testid="taxi-book-btn">
                {booking ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Booking…</> : (quote ? `Book ride · ${format(quote.fare_usd)}` : 'Book ride')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  if (!GOOGLE_MAPS_API_KEY) return body;
  return <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY} libraries={LIBRARIES}>{body}</LoadScript>;
};

export default TaxiBookingForm;
