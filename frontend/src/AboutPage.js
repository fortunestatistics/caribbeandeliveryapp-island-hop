import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { CONTACT_EMAILS } from './Footer';
import AnimatedCounter from './AnimatedCounter';
import {
  Compass,
  Globe,
  Mail,
  Rocket,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  ArrowRight,
} from 'lucide-react';

const TRACTION = [
  { label: 'Active Users',  value: 50,   suffix: 'K+', icon: Users,       color: 'text-gold-500' },
  { label: 'Deliveries',    value: 100,  suffix: 'K+', icon: TrendingUp,  color: 'text-emerald-400' },
  { label: 'Service Areas', value: 12,   suffix: '',   icon: Globe,       color: 'text-cyan-400' },
  { label: 'Avg ETA (min)', value: 28,   suffix: '',   icon: Rocket,      color: 'text-orange-400' },
];

const VALUES = [
  { icon: Compass,      title: 'Caribbean-First',  body: 'Built for the realities of island logistics — narrow roads, multi-island ops, local payments.' },
  { icon: ShieldCheck,  title: 'Trust by Design',  body: 'OTP-verified drivers, fraud queue, transparent dispute resolution and instant wallet credits.' },
  { icon: Sparkles,     title: 'Premium Feel',     body: 'Matte-black & metallic-gold UI — every screen reads as a luxury, considered product.' },
];

/**
 * Public About / Investor page. Designed for press, partners and investors who land here
 * after seeing a `mailto:investors@islandhoptt.com` link. Keeps the brand on point without
 * exposing internal admin pages.
 */
const AboutPage = () => {
  return (
    <div className="min-h-screen bg-matte-900" data-testid="about-page">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gold-500/10 via-transparent to-cyan-500/5 pointer-events-none" />
        <div className="container mx-auto px-4 py-20 sm:py-28 relative">
          <Badge variant="outline" className="bg-gold-500/15 text-gold-500 border-gold-500/30 mb-6">
            Trinidad &amp; Tobago · The Caribbean
          </Badge>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground max-w-3xl leading-tight">
            One premium app for everything <span className="text-gold-500">delivered</span> in the Caribbean.
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground mt-6 max-w-2xl">
            IslandHop unifies food, pharmacy, groceries, courier, taxi and car rental into a single
            super-app — built for the islands, by the islands. Customers, drivers, merchants and
            our operations team all run on one platform.
          </p>
          <div className="flex flex-wrap gap-3 mt-8">
            <Link to="/">
              <Button className="bg-gold-gradient text-white" data-testid="about-cta-launch">
                Launch the app <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
            <a href="mailto:investors@islandhoptt.com">
              <Button variant="outline" data-testid="about-cta-investors">
                <Mail className="h-4 w-4 mr-2" /> Talk to the team
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Traction */}
      <section className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {TRACTION.map((t) => {
            const Icon = t.icon;
            return (
              <Card key={t.label} className="bg-matte-800/60 border-matte-700/60">
                <CardContent className="p-5 text-center">
                  <Icon className={`h-6 w-6 mx-auto mb-2 ${t.color}`} />
                  <p className="text-3xl font-bold text-foreground">
                    <AnimatedCounter value={t.value} suffix={t.suffix} testid={`about-stat-${t.label.replace(/\s+/g, '-').toLowerCase()}`} />
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{t.label}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Values */}
      <section className="container mx-auto px-4 py-12">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-8">What we're building</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {VALUES.map((v) => {
            const Icon = v.icon;
            return (
              <Card key={v.title} className="bg-matte-800/60 border-matte-700/60 h-full">
                <CardContent className="p-6">
                  <div className="w-10 h-10 rounded-xl bg-gold-500/15 flex items-center justify-center mb-4">
                    <Icon className="h-5 w-5 text-gold-500" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground">{v.title}</h3>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{v.body}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Contacts */}
      <section className="container mx-auto px-4 py-12 pb-20">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Get in touch</h2>
        <p className="text-sm text-muted-foreground mb-8">Press, partnerships, investment — pick the right door.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CONTACT_EMAILS.map((c) => {
            const Icon = c.icon;
            return (
              <a
                key={c.key}
                href={`mailto:${c.email}`}
                data-testid={`about-contact-${c.key}`}
                className="flex items-start gap-3 p-4 rounded-xl border border-matte-700/60 hover:border-gold-500/40 hover:bg-matte-800/40 transition-colors group"
              >
                <div className="w-10 h-10 rounded-lg bg-gold-500/15 flex items-center justify-center flex-shrink-0">
                  <Icon className="h-5 w-5 text-gold-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{c.label}</p>
                  <p className="text-xs text-gold-500 mt-0.5 truncate">{c.email}</p>
                  <p className="text-xs text-muted-foreground mt-1">{c.desc}</p>
                </div>
              </a>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default AboutPage;
