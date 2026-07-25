import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from './components/ui/card';
import { Button } from './components/ui/button';
import { Route, WifiOff, Radar, ArrowRight, MapPin } from 'lucide-react';

const TEAL = '#0FA3A3';
const ORANGE = '#F47B27';

const INNOVATIONS = [
  {
    icon: Route,
    tag: 'Smart Routing',
    title: 'Proprietary back-road routing',
    claim: 'Up to 40% faster',
    desc: "Trinidad & Tobago's back roads don't follow a grid. Our nearest-neighbour routing engine re-sequences each driver's active drops from their live location, cutting kilometres and time on the routes that big global apps get wrong.",
    points: ['Re-orders multi-stop runs in real time', 'Tuned for rural & back-road distances', 'Shows the exact distance & minutes saved'],
    cta: { label: 'See it in the Driver app', to: '/driver-dashboard' },
    testid: 'tech-routing',
  },
  {
    icon: WifiOff,
    tag: 'Offline Sync',
    title: 'Offline order syncing for rural T&T',
    claim: 'Zero dropped orders',
    desc: 'When the signal drops in the countryside, orders don\'t. We queue each order safely on the device and send it automatically the instant connectivity returns — so a weak rural connection never costs a sale.',
    points: ['Orders saved locally when offline', 'Auto-sync on reconnect, no retry needed', 'Clear "saved / syncing" status for customers'],
    cta: { label: 'Start an order', to: '/businesses' },
    testid: 'tech-offline',
  },
  {
    icon: Radar,
    tag: 'Dispatch',
    title: 'Unique courier dispatch tech',
    claim: 'Best driver, every time',
    desc: 'A two-phase dispatch engine offers each job to the closest, highest-rated drivers first — with a priority window for subscribed drivers — then opens it to everyone. Admins get a live board to auto-dispatch the whole queue in one tap.',
    points: ['Proximity + rating + subscription scoring', 'Exclusive first-look window for Pro/Premium', 'One-tap auto-dispatch for the whole queue'],
    cta: { label: 'Open Dispatch Board', to: '/admin/dispatch' },
    testid: 'tech-dispatch',
  },
];

const TechnologyPage = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="py-16 px-4 text-center" style={{ background: `linear-gradient(135deg, ${TEAL}12, ${ORANGE}12)` }}>
        <div className="max-w-3xl mx-auto">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full" style={{ background: `${TEAL}20`, color: TEAL }}>
            <MapPin className="h-3.5 w-3.5" /> Built for the Caribbean
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mt-4 mb-4 text-foreground" data-testid="tech-hero-title">
            The tech that moves <span style={{ color: TEAL }}>Island</span><span style={{ color: ORANGE }}>Hop</span>
          </h1>
          <p className="text-base md:text-lg text-muted-foreground">
            Three homegrown innovations engineered for Trinidad &amp; Tobago's roads, networks and communities — not copied from a Silicon Valley playbook.
          </p>
        </div>
      </section>

      {/* Cards */}
      <section className="py-14 px-4">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          {INNOVATIONS.map((it) => {
            const Icon = it.icon;
            return (
              <Card key={it.testid} className="overflow-hidden flex flex-col" data-testid={it.testid}>
                <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${TEAL}, ${ORANGE})` }} />
                <CardContent className="p-6 flex flex-col flex-1">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: `${TEAL}15` }}>
                    <Icon className="h-6 w-6" style={{ color: TEAL }} />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: ORANGE }}>{it.tag}</span>
                  <h3 className="text-lg md:text-lg font-bold text-foreground mt-1">{it.title}</h3>
                  <p className="text-2xl font-extrabold my-2" style={{ color: TEAL }}>{it.claim}</p>
                  <p className="text-sm text-muted-foreground mb-4">{it.desc}</p>
                  <ul className="space-y-2 mb-6">
                    {it.points.map((p) => (
                      <li key={p} className="text-sm text-foreground flex items-start gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: ORANGE }} />
                        {p}
                      </li>
                    ))}
                  </ul>
                  <Button
                    onClick={() => navigate(it.cta.to)}
                    variant="outline"
                    className="mt-auto w-full"
                    data-testid={`${it.testid}-cta`}
                  >
                    {it.cta.label} <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <p className="max-w-6xl mx-auto text-xs text-muted-foreground mt-6 text-center">
          Routing time savings vary by drop density and road conditions; "up to 40% faster" reflects optimized multi-stop back-road runs.
        </p>
      </section>
    </div>
  );
};

export default TechnologyPage;
