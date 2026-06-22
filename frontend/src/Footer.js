import React from 'react';
import {
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
      className="mt-12 border-t border-gold-500/15 bg-matte-900/80 backdrop-blur-xl"
    >
      <div className="container mx-auto px-4 py-7">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          {/* Brand + socials */}
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-lg font-bold text-foreground leading-none">IslandHop</h2>
              <p className="text-xs text-gold-500 mt-0.5">Caribbean Delivery</p>
            </div>
            <div className="hidden sm:flex items-center gap-2 ml-2">
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
                    className="w-8 h-8 rounded-lg bg-gold-500/10 flex items-center justify-center text-gold-500 hover:bg-gold-500/20 transition-colors"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Contact emails — compact inline pills */}
          <div className="flex flex-wrap items-center gap-2">
            {CONTACT_EMAILS.map((c) => {
              const Icon = c.icon;
              return (
                <a
                  key={c.key}
                  href={`mailto:${c.email}`}
                  data-testid={`contact-${c.key}`}
                  title={c.email}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-matte-800/80 text-xs text-muted-foreground hover:border-gold-500/40 hover:text-gold-300 transition-colors"
                >
                  <Icon className="h-3.5 w-3.5 text-gold-500" />
                  {c.label}
                </a>
              );
            })}
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-matte-800/80 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} IslandHop Technologies · Trinidad &amp; Tobago
          </p>
          <div className="flex items-center gap-4">
            <a
              href="https://www.islandhoptt.com"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="footer-website"
              className="text-xs text-gold-500 hover:text-gold-400 inline-flex items-center gap-1 transition-colors"
            >
              www.islandhoptt.com <ExternalLink className="h-3 w-3" />
            </a>
            <a
              href="/about"
              data-testid="footer-about"
              className="text-xs text-muted-foreground hover:text-gold-500 transition-colors"
            >
              About
            </a>
            <a
              href="/privacy-policy"
              data-testid="footer-privacy"
              className="text-xs text-muted-foreground hover:text-gold-500 transition-colors"
            >
              Privacy Policy
            </a>
            <a
              href="/terms"
              data-testid="footer-terms"
              className="text-xs text-muted-foreground hover:text-gold-500 transition-colors"
            >
              Terms
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
