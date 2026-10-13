import React, { useCallback } from 'react';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';

const GMAPS_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
const TT_CENTER = { lat: 10.6918, lng: -61.2225 };
const MAP_STYLE = { width: '100%', height: '260px', borderRadius: '0.75rem' };

// Controlled draggable pin. Parent passes lat/lng and receives {lat,lng} on change.
export default function MapPinPicker({ lat, lng, onChange, testId = 'map-pin-picker' }) {
  const hasPin = lat != null && lng != null;
  const pos = hasPin ? { lat: Number(lat), lng: Number(lng) } : null;
  const center = pos || TT_CENTER;

  const place = useCallback((la, ln) => {
    onChange({ lat: Number(la.toFixed(6)), lng: Number(ln.toFixed(6)) });
  }, [onChange]);

  if (!GMAPS_KEY) {
    return <div className="text-sm text-amber-600">Map unavailable — Google Maps key not configured.</div>;
  }

  return (
    <div data-testid={testId}>
      <LoadScript googleMapsApiKey={GMAPS_KEY}>
        <GoogleMap
          mapContainerStyle={MAP_STYLE}
          center={center}
          zoom={hasPin ? 16 : 11}
          onClick={(e) => place(e.latLng.lat(), e.latLng.lng())}
          options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
        >
          {pos && <Marker position={pos} draggable onDragEnd={(e) => place(e.latLng.lat(), e.latLng.lng())} />}
        </GoogleMap>
      </LoadScript>
      <p className="text-xs text-muted-foreground mt-1">
        {hasPin
          ? <>Drop-off pin set: <span data-testid={`${testId}-coords`}>{pos.lat}, {pos.lng}</span> — drag to fine-tune.</>
          : 'Tap the map to drop a pin on your exact drop-off spot.'}
      </p>
    </div>
  );
}
