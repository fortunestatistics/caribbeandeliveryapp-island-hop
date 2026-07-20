import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card, CardContent } from './components/ui/card';
import { Button } from './components/ui/button';
import { Gift, Copy, Check, X, Share2 } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const DISMISS_KEY = 'referralBannerDismissedAt';
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// localStorage can throw in private browsing on some Safari/iOS configurations.
// We swallow the error intentionally (banner is non-critical) but log to the dev
// console so issues are still discoverable during local testing.
const logStorageWarn = (op, err) => {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`ReferralBanner: localStorage ${op} failed —`, err?.message || err);
  }
};

const ReferralBanner = () => {
  const [referralCode, setReferralCode] = useState(null);
  const [hasPaidOrder, setHasPaidOrder] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Respect a recent dismiss
    try {
      const last = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10);
      if (last && Date.now() - last < DISMISS_TTL_MS) {
        setDismissed(true);
        return;
      }
    } catch (err) { logStorageWarn('read dismiss', err); }

    const token = (() => {
      try { return localStorage.getItem('token'); } catch (err) { logStorageWarn('read token', err); return null; }
    })();
    if (!token) return;

    const headers = { Authorization: `Bearer ${token}` };

    // Probe whether user has at least one completed/paid order
    axios
      .get(`${API}/orders`, { headers, withCredentials: false })
      .then((res) => {
        const orders = Array.isArray(res.data) ? res.data : [];
        const eligible = orders.some(
          (o) => o.payment_status === 'paid' || o.status === 'delivered'
        );
        setHasPaidOrder(eligible);
      })
      .catch((err) => {
        console.error('ReferralBanner orders probe failed:', err);
      });

    // Fetch (or create) the user's referral code
    axios
      .get(`${API}/referrals/my-code`, { headers, withCredentials: false })
      .then((res) => setReferralCode(res.data?.code || null))
      .catch((err) => {
        console.error('ReferralBanner code fetch failed:', err);
      });
  }, []);

  if (dismissed || !referralCode || !hasPaidOrder) return null;

  const shareLink = `${window.location.origin}/signup?ref=${referralCode}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      toast.success('Referral link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
      toast.error('Could not copy. Long-press to copy the link manually.');
    }
  };

  const handleNativeShare = async () => {
    if (!navigator.share) {
      handleCopy();
      return;
    }
    try {
      await navigator.share({
        title: 'IslandHop — Caribbean delivery',
        text: `Use my code ${referralCode} on IslandHop and we both get rewarded!`,
        url: shareLink,
      });
    } catch (err) {
      // User cancelled — not an error worth surfacing
      if (err?.name !== 'AbortError') console.error('Share failed:', err);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, Date.now().toString()); } catch (err) { logStorageWarn('write dismiss', err); }
  };

  return (
    <Card
      data-testid="referral-banner"
      className="mb-6 border-2 border-gold-500/40 bg-gradient-to-r from-matte-800 via-matte-800/90 to-matte-900 overflow-hidden relative"
    >
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        data-testid="referral-banner-dismiss"
        className="absolute top-3 right-3 p-1 rounded-md hover:bg-matte-700/60 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-gold-gradient flex items-center justify-center">
            <Gift className="h-7 w-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-foreground">
              Get <span className="text-gold-500">$10</span>, give <span className="text-gold-500">$10</span>
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Share your code <code className="px-1.5 py-0.5 rounded bg-matte-700/60 text-gold-500 font-mono">{referralCode}</code> — you both earn wallet credit on their first paid order.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:flex-nowrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
              data-testid="referral-banner-copy"
              className="border-gold-500/40 text-gold-500 hover:bg-gold-500/10"
            >
              {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              {copied ? 'Copied' : 'Copy link'}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleNativeShare}
              data-testid="referral-banner-share"
              className="bg-gold-gradient text-white"
            >
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ReferralBanner;
