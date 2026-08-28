import React, { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
import { MapPin } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

/**
 * Live delivery map for dashboards (customer / driver / admin).
 * Polls the backend for the driver's live location and plots it against the
 * delivery destination. Fully responsive — set heightClass for the context.
 * Shows a friendly placeholder when there's no active delivery.
 */
export const LiveDeliveryMap = ({
  orderId,
  destination: destProp,           // optional {latitude, longitude}
  driverLocation: driverProp,      // optional {lat, lng} (driver viewing own position)
  heightClass = 'h-56 sm:h-72 lg:h-[26rem]',
  pollMs = 8000,
}) => {
  const [driver, setDriver] = useState(driverProp || null);
  const [dest, setDest] = useState(destProp || null);
  const mapRef = useRef(null);

  const fetchDest = useCallback(async () => {
    if (destProp || !orderId) return;
    try {
      const r = await axios.get(`${API}/orders/${orderId}`);
      if (r.data?.delivery_address?.latitude) setDest(r.data.delivery_address);
    } catch { /* best-effort */ }
  }, [orderId, destProp]);

  const poll = useCallback(async () => {
    if (!orderId) return;
    try {
      const r = await axios.get(`${API}/orders/${orderId}/driver-location`);
      if (r.data?.has_driver && r.data.location?.lat != null) {
        setDriver({ lat: r.data.location.lat, lng: r.data.location.lng, name: r.data.driver_name });
      }
    } catch { /* best-effort */ }
  }, [orderId]);

  useEffect(() => { fetchDest(); }, [fetchDest]);
  useEffect(() => { if (driverProp) setDriver(driverProp); }, [driverProp]);
  useEffect(() => {
    if (!orderId) return;
    poll();
    const id = setInterval(poll, pollMs);
    return () => clearInterval(id);
  }, [orderId, poll, pollMs]);

  const fitBounds = useCallback(() => {
    const map = mapRef.current;
    if (!map || !window.google) return;
    const pts = [];
    if (driver?.lat != null) pts.push({ lat: driver.lat, lng: driver.lng });
    if (dest?.latitude != null) pts.push({ lat: dest.latitude, lng: dest.longitude });
    if (pts.length === 1) { map.setCenter(pts[0]); map.setZoom(14); }
    else if (pts.length >= 2) {
      const b = new window.google.maps.LatLngBounds();
      pts.forEach((p) => b.extend(p));
      map.fitBounds(b, 60);
    }
  }, [driver, dest]);

  useEffect(() => { fitBounds(); }, [fitBounds]);

  const hasDriver = driver?.lat != null;
  const hasDest = dest?.latitude != null;

  if (!orderId || (!hasDriver && !hasDest)) {
    return (
      <div data-testid="live-delivery-map-empty"
        className={`w-full ${heightClass} rounded-xl border border-border bg-muted/30 flex flex-col items-center justify-center text-muted-foreground text-center px-4`}>
        <MapPin className="h-7 w-7 mb-2 opacity-50" />
        <p className="text-sm font-medium">No active delivery right now</p>
        <p className="text-xs">The live map appears once a delivery is on the way.</p>
      </div>
    );
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className={`w-full ${heightClass} rounded-xl border border-border bg-muted/30 flex items-center justify-center text-muted-foreground text-sm`}>
        Map unavailable
      </div>
    );
  }

  const center = hasDriver
    ? { lat: driver.lat, lng: driver.lng }
    : { lat: dest.latitude, lng: dest.longitude };

  return (
    <div data-testid="live-delivery-map" className={`relative w-full ${heightClass} rounded-xl overflow-hidden border border-border`}>
      <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY}>
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={center}
          zoom={13}
          onLoad={(map) => { mapRef.current = map; fitBounds(); }}
          options={{ disableDefaultUI: true, zoomControl: true, gestureHandling: 'greedy', clickableIcons: false }}
        >
          {hasDriver && (
            <Marker
              position={{ lat: driver.lat, lng: driver.lng }}
              title={driver.name || 'Driver'}
              icon={window.google ? {
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 8, fillColor: '#2563eb', fillOpacity: 1,
                strokeColor: '#ffffff', strokeWeight: 3,
              } : undefined}
            />
          )}
          {hasDest && (
            <Marker
              position={{ lat: dest.latitude, lng: dest.longitude }}
              title="Delivery destination"
            />
          )}
        </GoogleMap>
      </LoadScript>
      <div className="absolute top-2 left-2 bg-background/90 backdrop-blur px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 border border-border shadow-sm" data-testid="live-delivery-map-badge">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
        </span>
        Live
      </div>
    </div>
  );
};

export default LiveDeliveryMap;
