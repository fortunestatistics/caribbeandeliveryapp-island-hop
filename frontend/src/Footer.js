import React, { useState } from 'react';
import axios from 'axios';
import {
  Headphones,
  Store,
  Truck,
  LineChart,
  Landmark,
  ExternalLink,
  Instagram,
  Send,
  Loader2,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './components/ui/dialog';
import { Input } from './components/ui/input';
import { Textarea } from './components/ui/textarea';
import { Button } from './components/ui/button';
import { Label } from './components/ui/label';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Single source of truth for IslandHop social profiles.
export const SOCIAL_LINKS = [
  { key: 'instagram', label: 'Instagram', handle: '@islandhopapp', url: 'https://instagram.com/islandhopapp', icon: Instagram },
];

// Single source of truth for every official IslandHop contact address.
// `key` maps to the backend CONTACT_MAILBOXES routing (server sends to the correct mailbox).
export const CONTACT_EMAILS = [
  { key: 'support',   label: 'Customer Support',      email: 'support@islandhoptt.com',          icon: Headphones, desc: 'Order issues, claims, account help' },
  { key: 'partner',   label: 'Merchant Partnerships', email: 'partners@islandhoptt.com',         icon: Store,      desc: 'List your business with us' },
  { key: 'drivers',   label: 'Driver Onboarding',     email: 'drivers@islandhoptt.com',          icon: Truck,      desc: 'Drive with IslandHop' },
  { key: 'investors', label: 'Investor Relations',    email: 'investors@islandhoptt.com',        icon: LineChart,  desc: 'Press & investment enquiries' },
  { key: 'banking',   label: 'Banking Partners',      email: 'banking.partners@islandhoptt.com', icon: Landmark,   desc: 'Treasury & payment partnerships' },
];

const Footer = () => {
  const [dept, setDept] = useState(null); // active contact department object
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const openContact = (c) => {
    setDept(c);
    setName(''); setEmail(''); setMessage('');
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || message.trim().length < 5) {
      toast.error('Please enter your email and a short message.');
      return;
    }
    setSending(true);
    try {
      await axios.post(`${API}/contact`, {
        department: dept.key, name: name.trim() || 'Website visitor', email: email.trim(), message: message.trim(),
      });
      toast.success(`Message sent to ${dept.label}. We'll be in touch shortly.`);
      setDept(null);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Could not send your message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <footer
      data-testid="site-footer"
      className="mt-12 border-t border-gold-500/15 bg-matte-900/80 backdrop-blur-xl"
    >
      <div className="container mx-auto px-4 py-7">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          {/* Brand + socials */}
          <div className="flex items-center gap-3">
            <img src={require('./assets/islandhop-mark.png')} alt="IslandHop" className="w-10 h-10 object-contain" />
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

          {/* Contact — opens an in-app form that delivers to the correct mailbox */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground mr-1 hidden sm:inline">Get in touch:</span>
            {CONTACT_EMAILS.map((c) => {
              const Icon = c.icon;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => openContact(c)}
                  data-testid={`contact-${c.key}`}
                  title={`Message ${c.label}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-matte-800/80 text-xs text-muted-foreground hover:border-gold-500/40 hover:text-gold-300 transition-colors"
                >
                  <Icon className="h-3.5 w-3.5 text-gold-500" />
                  {c.label}
                </button>
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
            <a href="/about" data-testid="footer-about" className="text-xs text-muted-foreground hover:text-gold-500 transition-colors">About</a>
            <a href="/promote" data-testid="footer-promote" className="text-xs text-muted-foreground hover:text-gold-500 transition-colors">Promote &amp; Earn</a>
            <a href="/privacy-policy" data-testid="footer-privacy" className="text-xs text-muted-foreground hover:text-gold-500 transition-colors">Privacy Policy</a>
            <a href="/terms-and-conditions" data-testid="footer-terms" className="text-xs text-muted-foreground hover:text-gold-500 transition-colors">Terms &amp; Conditions</a>
          </div>
        </div>
      </div>

      {/* Contact form dialog */}
      <Dialog open={!!dept} onOpenChange={(o) => !o && setDept(null)}>
        <DialogContent data-testid="contact-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {dept && <dept.icon className="h-5 w-5 text-gold-500" />} Contact {dept?.label}
            </DialogTitle>
            <DialogDescription>
              {dept?.desc} — your message goes straight to <span className="font-medium">{dept?.email}</span>.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label htmlFor="contact-name" className="text-xs">Your name</Label>
              <Input id="contact-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" data-testid="contact-name" />
            </div>
            <div>
              <Label htmlFor="contact-email" className="text-xs">Your email *</Label>
              <Input id="contact-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" data-testid="contact-email" />
            </div>
            <div>
              <Label htmlFor="contact-message" className="text-xs">Message *</Label>
              <Textarea id="contact-message" required rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="How can we help?" data-testid="contact-message" />
            </div>
            <div className="flex items-center justify-between gap-2 pt-1">
              <a
                href={dept ? `mailto:${dept.email}` : '#'}
                className="text-xs text-muted-foreground hover:text-gold-500 underline"
                data-testid="contact-mailto-fallback"
              >
                or email directly
              </a>
              <Button type="submit" disabled={sending} data-testid="contact-submit">
                {sending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                Send message
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </footer>
  );
};

export default Footer;
