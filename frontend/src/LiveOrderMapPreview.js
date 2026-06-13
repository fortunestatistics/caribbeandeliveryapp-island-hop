import React, { useEffect, useState } from 'react';
import { MapPin, Navigation } from 'lucide-react';

// Caribbean cities to cycle delivery "ping" through — anchored to the
// Trinidad & Tobago region. Pure visual; no real GPS data is sent.
const PINGS = [
  { from: 'Port of Spain', to: 'Diego Martin', cuisine: 'Caribbean BBQ', minutes: 4 },
  { from: 'San Fernando',  to: 'Marabella',    cuisine: 'Indian',         minutes: 6 },
  { from: 'Chaguanas',     to: 'Endeavour',    cuisine: 'Pharmacy',       minutes: 3 },
  { from: 'Scarborough',   to: 'Crown Point',  cuisine: 'Groceries',      minutes: 8 },
  { from: 'Arima',         to: 'Tunapuna',     cuisine: 'Pizza',          minutes: 5 },
];

/**
 * Decorative animated map preview shown on the landing page.
 * Renders an SVG stage with three "trails" between pickup and drop-off
 * markers. A status banner cycles through synthetic recent deliveries to
 * communicate platform activity.
 */
const LiveOrderMapPreview = () => {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % PINGS.length), 3500);
    return () => clearInterval(id);
  }, []);
  const ping = PINGS[idx];

  return (
    <div
      data-testid="live-order-map-preview"
      className="relative w-full rounded-2xl overflow-hidden border border-gold-500/20 bg-matte-900"
    >
      <div className="relative h-64 sm:h-80 bg-gradient-to-br from-matte-900 via-matte-800 to-matte-900 overflow-hidden">
        {/* island silhouettes */}
        <svg viewBox="0 0 600 320" className="absolute inset-0 w-full h-full opacity-90" preserveAspectRatio="xMidYMid slice">
          <defs>
            <radialGradient id="glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="trail" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00E5FF" stopOpacity="0" />
              <stop offset="50%" stopColor="#00E5FF" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#D4AF37" stopOpacity="0.9" />
            </linearGradient>
          </defs>
          {/* faux Trinidad shape */}
          <path d="M120,180 Q170,150 220,170 Q260,150 310,180 Q360,200 380,230 Q330,260 270,250 Q200,260 150,235 Z" fill="#1a1a1a" stroke="#2a2a2a" strokeWidth="1.5" />
          {/* faux Tobago shape */}
          <path d="M440,90 Q470,80 490,95 Q505,115 488,130 Q462,135 445,115 Z" fill="#1a1a1a" stroke="#2a2a2a" strokeWidth="1.5" />
          {/* ambient glow */}
          <circle cx="240" cy="200" r="120" fill="url(#glow)" />
          {/* trails */}
          <path d="M160,200 Q220,170 300,210" stroke="url(#trail)" strokeWidth="2" fill="none" strokeDasharray="4 6">
            <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="1.5s" repeatCount="indefinite" />
          </path>
          <path d="M250,220 Q300,190 360,225" stroke="url(#trail)" strokeWidth="2" fill="none" strokeDasharray="4 6" opacity="0.7">
            <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="2s" repeatCount="indefinite" />
          </path>
          <path d="M450,110 L478,118" stroke="url(#trail)" strokeWidth="2" fill="none" strokeDasharray="4 6" opacity="0.6">
            <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="1.8s" repeatCount="indefinite" />
          </path>
          {/* pickup + drop markers */}
          {[[160, 200], [250, 220], [450, 110]].map(([x, y], i) => (
            <g key={`p-${i}`}>
              <circle cx={x} cy={y} r="5" fill="#00E5FF" />
              <circle cx={x} cy={y} r="11" fill="#00E5FF" opacity="0.25">
                <animate attributeName="r" from="6" to="14" dur="1.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.35" to="0" dur="1.5s" repeatCount="indefinite" />
              </circle>
            </g>
          ))}
          {[[300, 210], [360, 225], [478, 118]].map(([x, y], i) => (
            <g key={`d-${i}`}>
              <circle cx={x} cy={y} r="5" fill="#D4AF37" />
              <circle cx={x} cy={y} r="11" fill="#D4AF37" opacity="0.3">
                <animate attributeName="r" from="6" to="14" dur="1.8s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.4" to="0" dur="1.8s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
              </circle>
            </g>
          ))}
        </svg>
        {/* corner status */}
        <div className="absolute bottom-3 left-3 right-3 sm:left-auto sm:right-3 sm:max-w-xs">
          <div
            key={idx}
            data-testid="live-map-banner"
            className="bg-matte-900/90 backdrop-blur-md border border-gold-500/30 rounded-xl p-3 animate-in fade-in"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
              </span>
              <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold">Live</span>
            </div>
            <p className="text-sm text-foreground">
              <span className="font-semibold">{ping.cuisine}</span> on the move
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
              <MapPin className="h-3 w-3 text-gold-500" /> {ping.from}
              <Navigation className="h-3 w-3 mx-1 rotate-45" />
              {ping.to} · ETA {ping.minutes} min
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveOrderMapPreview;
