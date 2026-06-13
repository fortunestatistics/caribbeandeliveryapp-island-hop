import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Card } from './components/ui/card';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { ChevronLeft, ChevronRight, Megaphone, ArrowRight } from 'lucide-react';

// Editable in-app ad slides. Each slide carries its own visual palette so
// merchants feel like the placement was made for them, not a stock template.
// Add new slides here OR wire to a backend feed at `/api/promo-slides` later.
const PROMO_SLIDES = [
  {
    id: 'food-fest',
    eyebrow: 'Trinidad Food Fest',
    headline: '20% off your first food order',
    body: 'Discover top-rated Caribbean restaurants delivering across Port of Spain. Use code FOODFEST20 at checkout.',
    cta: 'Browse restaurants',
    href: '/restaurants',
    gradient: 'from-gold-500/30 via-amber-500/10 to-transparent',
    accent: 'text-gold-500',
  },
  {
    id: 'pharmacy-care',
    eyebrow: 'Sponsored · Pharmacy',
    headline: 'Same-day prescription delivery',
    body: 'Partner pharmacies deliver verified prescriptions to your door — pay safely with wallet or card.',
    cta: 'Order pharmacy',
    href: '/pharmacy-order',
    gradient: 'from-emerald-500/30 via-emerald-500/5 to-transparent',
    accent: 'text-emerald-400',
  },
  {
    id: 'rides',
    eyebrow: 'IslandHop Taxi',
    headline: 'Premium rides islandwide, in 4 minutes',
    body: 'Book a taxi with vetted drivers, real-time tracking, and transparent fares — TTD or USD.',
    cta: 'Book a ride',
    href: '/taxi-booking',
    gradient: 'from-cyan-500/30 via-cyan-500/5 to-transparent',
    accent: 'text-cyan-400',
  },
  {
    id: 'partner',
    eyebrow: 'For Businesses',
    headline: 'List your business — reach 50K+ customers',
    body: 'Join the IslandHop merchant network. Zero setup fees, weekly Stripe payouts, full analytics dashboard.',
    cta: 'Become a partner',
    href: '/partner',
    gradient: 'from-orange-500/30 via-orange-500/5 to-transparent',
    accent: 'text-orange-400',
  },
];

/**
 * Auto-rotating advertisement carousel. Pauses on hover so customers
 * can finish reading. Dot indicators + arrow controls for manual nav.
 * Each slide deep-links into the relevant flow.
 */
const PromoSlides = ({ rotationMs = 6000 }) => {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const slides = PROMO_SLIDES;
  const timerRef = useRef(null);

  useEffect(() => {
    if (paused || slides.length < 2) return undefined;
    timerRef.current = setInterval(() => setIdx((i) => (i + 1) % slides.length), rotationMs);
    return () => clearInterval(timerRef.current);
  }, [paused, slides.length, rotationMs]);

  const go = (delta) => setIdx((i) => (i + delta + slides.length) % slides.length);
  const slide = slides[idx];

  return (
    <div
      className="relative w-full"
      data-testid="promo-slides"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <Card className="overflow-hidden border-gold-500/20 bg-matte-900/80">
        <div className={`relative bg-gradient-to-br ${slide.gradient}`}>
          <div className="p-6 sm:p-10 min-h-[260px] flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Megaphone className={`h-4 w-4 ${slide.accent}`} />
                <Badge variant="outline" className={`text-xs uppercase tracking-wider bg-matte-900/60 ${slide.accent} border-current/30`}>
                  {slide.eyebrow}
                </Badge>
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight max-w-2xl">
                {slide.headline}
              </h3>
              <p className="text-sm sm:text-base text-muted-foreground mt-3 max-w-2xl leading-relaxed">
                {slide.body}
              </p>
            </div>
            <div className="flex items-center justify-between mt-6 flex-wrap gap-3">
              <Link to={slide.href} data-testid={`promo-cta-${slide.id}`}>
                <Button className="bg-gold-gradient text-white">
                  {slide.cta} <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => go(-1)}
                  aria-label="Previous slide"
                  data-testid="promo-prev"
                  className="p-2 rounded-full bg-matte-800/80 hover:bg-matte-700/80 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="flex gap-1.5">
                  {slides.map((s, i) => (
                    <button
                      key={s.id}
                      type="button"
                      aria-label={`Show ${s.eyebrow}`}
                      onClick={() => setIdx(i)}
                      className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-8 bg-gold-500' : 'w-1.5 bg-matte-700 hover:bg-matte-600'}`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => go(1)}
                  aria-label="Next slide"
                  data-testid="promo-next"
                  className="p-2 rounded-full bg-matte-800/80 hover:bg-matte-700/80 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </Card>
      <p className="text-[10px] text-muted-foreground/60 mt-2 text-center uppercase tracking-wider">
        Promoted placements · Want to advertise? <Link to="/partner" className="text-gold-500 hover:underline">Become a partner</Link>
      </p>
    </div>
  );
};

export default PromoSlides;
