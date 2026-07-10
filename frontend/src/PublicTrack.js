import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { MapPin, Package, CheckCircle2, Truck, Clock } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const STEPS = ['pending', 'confirmed', 'preparing', 'picked_up', 'out_for_delivery', 'delivered'];
const STEP_LABELS = {
  pending: 'Order placed',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  picked_up: 'Picked up',
  out_for_delivery: 'On the way',
  delivered: 'Delivered',
};

const PublicTrack = () => {
  const { orderId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  const fetchTrack = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/orders/${orderId}/public-track`);
      setData(r.data);
    } catch (e) {
      setError(true);
    }
  }, [orderId]);

  useEffect(() => {
    fetchTrack();
    const t = setInterval(fetchTrack, 15000);
    return () => clearInterval(t);
  }, [fetchTrack]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4" data-testid="public-track-error">
        <div className="text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <h1 className="text-xl font-semibold">Tracking link not found</h1>
          <p className="text-muted-foreground">This delivery link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading tracking…</div>;
  }

  const currentIdx = Math.max(0, STEPS.indexOf(data.status));
  const delivered = data.status === 'delivered';

  return (
    <div className="min-h-screen bg-background" data-testid="public-track-page">
      <div className="bg-gold-gradient py-10 px-4 text-center">
        <div className="inline-flex items-center gap-2 text-white font-bold text-lg mb-2">
          <Truck className="h-5 w-5" />IslandHop
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Track your delivery</h1>
        {data.vendor_name && <p className="text-white/90 mt-1">from {data.vendor_name}</p>}
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <div className="bg-card border border-border rounded-xl p-5 text-center" data-testid="public-track-status">
          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold ${delivered ? 'bg-green-500/15 text-green-600' : 'bg-gold-500/15 text-gold-700'}`}>
            {delivered ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
            {STEP_LABELS[data.status] || data.status}
          </div>
          {data.driver_name && !delivered && (
            <p className="text-sm text-muted-foreground mt-3">{data.driver_name} is handling your delivery.</p>
          )}
          {data.destination_city && (
            <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1"><MapPin className="h-3 w-3" />Heading to {data.destination_city}</p>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <ol className="space-y-4">
            {STEPS.map((s, i) => {
              const done = i <= currentIdx;
              return (
                <li key={s} className="flex items-center gap-3" data-testid={`public-track-step-${s}`}>
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs ${done ? 'bg-gold-gradient text-white' : 'bg-muted text-muted-foreground'}`}>
                    {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                  </div>
                  <span className={done ? 'font-medium' : 'text-muted-foreground'}>{STEP_LABELS[s]}</span>
                </li>
              );
            })}
          </ol>
        </div>

        {data.driver_location && (
          <a
            href={`https://www.google.com/maps?q=${data.driver_location.lat || data.driver_location.latitude},${data.driver_location.lng || data.driver_location.longitude}`}
            target="_blank"
            rel="noreferrer"
            className="block text-center bg-gold-gradient text-white rounded-full py-3 font-medium"
            data-testid="public-track-map-link"
          >
            View driver on map
          </a>
        )}
        <p className="text-center text-xs text-muted-foreground">Live tracking · updates automatically</p>
      </div>
    </div>
  );
};

export default PublicTrack;
