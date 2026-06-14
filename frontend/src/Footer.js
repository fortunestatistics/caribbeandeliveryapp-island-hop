import React from 'react';
import {
  Mail,
  Headphones,
  Store,
  Truck,
  LineChart,
  Landmark,
  ExternalLink,
  Instagram,
} from 'lucide-react';

// Single source of truth for IslandHop social profiles.
export const SOCIAL_LINKS = [
  { key: 'instagram', label: 'Instagram', handle: '@islandhopapp', url: 'https://instagram.com/islandhopapp', icon: Instagram },
];

// Single source of truth for every official IslandHop contact address.
// Update here when emails change — nothing else in the codebase hardcodes them.
export const CONTACT_EMAILS = [
  { key: 'support',  label: 'Customer Support',     email: 'support@islandhoptt.com',          icon: Headphones, desc: 'Order issues, claims, account help' },
  { key: 'partner',  label: 'Merchant Partnerships', email: 'partner@islandhoptt.com',          icon: Store,      desc: 'List your business with us' },
  { key: 'drivers',  label: 'Driver Onboarding',     email: 'drivers@islandhoptt.com',          icon: Truck,      desc: 'Drive with IslandHop' },
  { key: 'investors', label: 'Investor Relations',   email: 'investors@islandhoptt.com',        icon: LineChart,  desc: 'Press & investment enquiries' },
  { key: 'banking',  label: 'Banking Partners',      email: 'banking.partners@islandhoptt.com', icon: Landmark,   desc: 'Treasury & payment partnerships' },
];

const Footer = () => {
  return (
    <footer
      data-testid="site-footer"
      className="mt-20 border-t border-gold-500/15 bg-matte-900/80 backdrop-blur-xl"
    >
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Brand block */}
          <div className="md:col-span-1">
            <h2 className="text-2xl font-bold text-foreground">IslandHop</h2>
            <p className="text-sm text-gold-500 mt-1">Caribbean Delivery</p>
            <p className="text-sm text-muted-foreground mt-4 leading-relaxed">
              Food, pharmacy, groceries, courier, taxi &amp; car rental — one premium app for the Caribbean.
            </p>
            <a
              href="https://www.islandhoptt.com"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="footer-website"
              className="inline-flex items-center gap-1.5 text-xs text-gold-500 hover:text-gold-400 mt-4 transition-colors"
            >
              www.islandhoptt.com <ExternalLink className="h-3 w-3" />
            </a>
            <a
              href="/about"
              data-testid="footer-about"
              className="block text-xs text-muted-foreground hover:text-gold-500 mt-2 transition-colors"
            >
              About IslandHop &amp; press →
            </a>

            {/* Social profiles */}
            <div className="mt-6">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground/80 mb-2">Follow us</p>
              <div className="flex items-center gap-3">
                {SOCIAL_LINKS.map((s) => {
                  const Icon = s.icon;
                  return (
                    <a
                      key={s.key}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={s.label}
                      title={`${s.label} ${s.handle}`}
                      data-testid={`social-${s.key}`}
                      className="w-9 h-9 rounded-lg bg-gold-500/10 flex items-center justify-center text-gold-500 hover:bg-gold-500/20 hover:scale-105 transition-all"
                    >
                      <Icon className="h-4 w-4" />
                    </a>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Contact directory — spans 2 cols on md+ */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-5">
              <Mail className="h-4 w-4 text-gold-500" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">Get in touch</h3>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CONTACT_EMAILS.map((c) => {
                const Icon = c.icon;
                return (
                  <li key={c.key}>
                    <a
                      href={`mailto:${c.email}`}
                      data-testid={`contact-${c.key}`}
                      className="flex items-start gap-3 p-3 rounded-xl border border-matte-800/80 hover:border-gold-500/40 hover:bg-matte-800/40 transition-colors group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-gold-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-gold-500/20 transition-colors">
                        <Icon className="h-4 w-4 text-gold-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground leading-tight">{c.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{c.email}</p>
                        <p className="text-[11px] text-muted-foreground/70 mt-0.5">{c.desc}</p>
                      </div>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-matte-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} IslandHop Technologies. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            Trinidad &amp; Tobago · The Caribbean
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
