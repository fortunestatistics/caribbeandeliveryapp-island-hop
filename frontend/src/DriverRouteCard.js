import React, { useState } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Route, Navigation, Zap, Clock, Loader2, MapPin } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Smart back-road routing — orders the driver's active deliveries into the
// shortest visit sequence and shows the distance + time saved.
const DriverRouteCard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const optimize = async () => {
    setLoading(true); setError('');
    try {
      const res = await axios.get(`${API}/driver/route/optimize`, { withCredentials: true });
      setData(res.data);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Could not optimize your route right now.');
    } finally {
      setLoading(false);
    }
  };

  const openMaps = () => {
    if (!data?.stops?.length) return;
    const dest = data.stops[data.stops.length - 1];
    const waypoints = data.stops.slice(0, -1).map((s) => `${s.lat},${s.lng}`).join('|');
    const url = `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}` +
      (waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : '') + '&travelmode=driving';
    window.open(url, '_blank', 'noopener');
  };

  return (
    <Card className="mb-6 border-l-4" style={{ borderLeftColor: '#0FA3A3' }} data-testid="driver-route-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <span className="flex items-center gap-2">
            <Route className="h-5 w-5" style={{ color: '#0FA3A3' }} /> Smart Route
          </span>
          <Button size="sm" onClick={optimize} disabled={loading} data-testid="driver-optimize-route-btn"
            className="text-white" style={{ background: '#0FA3A3' }}>
            {loading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Zap className="h-4 w-4 mr-1.5" />}
            {data ? 'Re-optimize' : 'Optimize route'}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!data && !error && (
          <p className="text-sm text-muted-foreground">
            Optimize the order of your active deliveries to cut back-road driving time.
          </p>
        )}
        {error && <p className="text-sm text-red-600" data-testid="driver-route-error">{error}</p>}
        {data && !data.optimizable && (
          <p className="text-sm text-muted-foreground" data-testid="driver-route-not-optimizable">{data.message}</p>
        )}
        {data && data.optimizable && (
          <div data-testid="driver-route-result">
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="rounded-lg bg-green-500/10 p-3 text-center">
                <p className="text-2xl font-bold text-green-600" data-testid="driver-route-percent">{data.percent_saved}%</p>
                <p className="text-xs text-muted-foreground">faster route</p>
              </div>
              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-2xl font-bold text-foreground">{data.distance_saved_km}<span className="text-sm"> km</span></p>
                <p className="text-xs text-muted-foreground">distance saved</p>
              </div>
              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-2xl font-bold text-foreground flex items-center justify-center gap-1"><Clock className="h-4 w-4" />{data.time_saved_min}<span className="text-sm">m</span></p>
                <p className="text-xs text-muted-foreground">time saved</p>
              </div>
            </div>
            <ol className="space-y-2 mb-4">
              {data.stops.map((s) => (
                <li key={s.order_id} className="flex items-center gap-3" data-testid={`driver-route-stop-${s.order_id}`}>
                  <span className="flex-shrink-0 w-7 h-7 rounded-full text-white text-sm font-bold flex items-center justify-center" style={{ background: '#0FA3A3' }}>{s.seq}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-foreground truncate">{s.label}</span>
                    <span className="block text-xs text-muted-foreground">Order #{String(s.order_id).substring(0, 8)} · {s.leg_km} km leg</span>
                  </span>
                  <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </li>
              ))}
            </ol>
            <Button variant="outline" className="w-full" onClick={openMaps} data-testid="driver-route-navigate-btn">
              <Navigation className="h-4 w-4 mr-2" /> Start navigation (Google Maps)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DriverRouteCard;
