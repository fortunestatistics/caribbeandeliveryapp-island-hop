import React, { useState, useCallback } from 'react';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { MapPin, Save, LocateFixed } from 'lucide-react';

const GMAPS_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
const TT_CENTER = { lat: 10.6918, lng: -61.2225 };
const MAP_STYLE = { width: '100%', height: '320px', borderRadius: '0.75rem' };

// Lets a merchant drop / drag a pin on the exact store location so every order gets
// precise pickup coordinates (accurate dispatch + driver ETAs), independent of geocoding.
export default function StoreLocationCard({ value, onSave, saving }) {
  const initial = value && value.lat != null && value.lng != null
    ? { lat: Number(value.lat), lng: Number(value.lng) }
    : null;
  const [pos, setPos] = useState(initial);
  const [locating, setLocating] = useState(false);

  const center = pos || TT_CENTER;

  const place = useCallback((lat, lng) => {
    setPos({ lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) });
  }, []);

  const onMapClick = (e) => place(e.latLng.lat(), e.latLng.lng());
  const onDragEnd = (e) => place(e.latLng.lat(), e.latLng.lng());

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { place(p.coords.latitude, p.coords.longitude); setLocating(false); },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  return (
    <Card className="mb-6" data-testid="store-location-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MapPin className="h-5 w-5 text-gold-500" /> Store Location
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Drop a pin exactly where drivers should collect orders. This gives every order precise
          pickup coordinates so the nearest driver is offered the job and pickup ETAs are accurate.
        </p>

        {GMAPS_KEY ? (
          <LoadScript googleMapsApiKey={GMAPS_KEY}>
            <GoogleMap
              mapContainerStyle={MAP_STYLE}
              center={center}
              zoom={pos ? 16 : 11}
              onClick={onMapClick}
              options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
            >
              {pos && <Marker position={pos} draggable onDragEnd={onDragEnd} />}
            </GoogleMap>
          </LoadScript>
        ) : (
          <div className="text-sm text-amber-600">Map unavailable — Google Maps key not configured.</div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={useMyLocation} disabled={locating} data-testid="store-location-use-gps">
            <LocateFixed className="h-4 w-4 mr-2" /> {locating ? 'Locating…' : 'Use my current location'}
          </Button>
          {pos ? (
            <span className="text-xs text-muted-foreground">
              Pin: <span data-testid="store-location-lat">{pos.lat}</span>, <span data-testid="store-location-lng">{pos.lng}</span>
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Tap the map to place your store pin.</span>
          )}
        </div>

        <Button
          onClick={() => onSave(pos)}
          disabled={saving || !pos}
          className="bg-gold-gradient text-white"
          data-testid="store-location-save"
        >
          <Save className="h-4 w-4 mr-2" /> {saving ? 'Saving…' : 'Save store location'}
        </Button>
      </CardContent>
    </Card>
  );
}
