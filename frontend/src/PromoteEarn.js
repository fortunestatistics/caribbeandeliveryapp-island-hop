import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { QRCodeCanvas } from 'qrcode.react';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import {
  Megaphone, Copy, Download, Share2, Users, Wallet, Clock,
  CheckCircle, Trophy, Truck, Store, Package, UserPlus, ShieldCheck,
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const TYPE_META = {
  customer: { label: 'Customer', icon: UserPlus, color: 'text-teal-700' },
  driver: { label: 'Driver', icon: Truck, color: 'text-gold-700' },
  merchant: { label: 'Business', icon: Store, color: 'text-secondary' },
  supplier: { label: 'Supplier', icon: Package, color: 'text-gold-700' },
};

const PromoteEarn = () => {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [onboards, setOnboards] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const qrRef = useRef(null);

  const load = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/login'); return; }
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const [m, o, l] = await Promise.all([
        axios.get(`${API}/promoter/me`, { headers }),
        axios.get(`${API}/promoter/onboards`, { headers }),
        axios.get(`${API}/promoter/leaderboard`, { headers }),
      ]);
      setMe(m.data);
      setOnboards(o.data.onboards || []);
      setLeaderboard(l.data.leaderboard || []);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) { navigate('/login'); return; }
      console.error('Failed to load promoter data:', err);
    }
    setLoading(false);
  }, [navigate]);

  useEffect(() => { load(); }, [load]);

  const joinUrl = me?.code ? `${window.location.origin}/join/${me.code}` : '';

  const copyLink = () => {
    if (!joinUrl) return;
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = () => {
    if (!joinUrl) return;
    const text = `Join IslandHop through me and get started — sign up, order, drive, or partner with us! ${joinUrl}`;
    if (navigator.share) navigator.share({ title: 'Join IslandHop', text, url: joinUrl });
    else { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  const downloadQR = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `islandhop-promoter-${me?.code || 'qr'}.png`;
    a.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-500/40"></div>
      </div>
    );
  }

  const cur = me?.currency || 'USD';
  const schedule = me?.reward_schedule || {};

  return (
    <div className="min-h-screen bg-background py-10" data-testid="promote-earn-page">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="mb-8">
          <h1 className="font-heading text-3xl md:text-4xl font-bold text-secondary flex items-center gap-3">
            <Megaphone className="h-8 w-8 text-gold-500" />
            Promote &amp; Earn
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Share your personal QR code to onboard customers, drivers, businesses and suppliers — and earn rewards
            straight to your IslandHop wallet when they get started.
          </p>
        </div>

        {/* Eligibility banner */}
        {me && !me.is_eligible && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-gold-500/40 bg-gold-500/10 p-4" data-testid="promoter-eligibility-banner">
            <ShieldCheck className="h-5 w-5 text-gold-700 mt-0.5 shrink-0" />
            <p className="text-sm text-foreground">
              You can start sharing now! Your rewards will be <strong>held</strong> and automatically paid to your wallet
              once your account is approved/active or you&apos;re approved as an IslandHop Ambassador.
            </p>
          </div>
        )}
        {me?.is_eligible && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-green-500/40 bg-green-500/10 p-4" data-testid="promoter-active-banner">
            <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
            <p className="text-sm text-foreground">
              You&apos;re an <strong>active promoter</strong>{me.is_ambassador ? ' (Ambassador)' : ''} — rewards are paid instantly to your wallet.
            </p>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* QR card */}
          <Card className="border-gold-500/30">
            <CardHeader><CardTitle>Your Promoter QR Code</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-col items-center">
                <div ref={qrRef} className="bg-white p-4 rounded-xl border border-border shadow-card-hover" data-testid="promoter-qr">
                  <QRCodeCanvas value={joinUrl || 'https://islandhopapp.com'} size={188} level="M" includeMargin={false} fgColor="#0B2C54" />
                </div>
                <p className="mt-4 text-xs text-muted-foreground">Your code</p>
                <p className="text-3xl font-bold tracking-widest text-gold-500 font-mono" data-testid="promoter-code">{me?.code || '—'}</p>
                <div className="grid grid-cols-3 gap-2 w-full mt-5">
                  <Button variant="outline" onClick={copyLink} data-testid="copy-link-btn">
                    <Copy className="h-4 w-4 mr-1" />{copied ? 'Copied' : 'Link'}
                  </Button>
                  <Button variant="outline" onClick={downloadQR} data-testid="download-qr-btn">
                    <Download className="h-4 w-4 mr-1" />PNG
                  </Button>
                  <Button onClick={shareLink} data-testid="share-link-btn">
                    <Share2 className="h-4 w-4 mr-1" />Share
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Earnings + schedule */}
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Paid ({cur})</p>
                      <p className="text-2xl font-bold text-green-600" data-testid="promoter-paid">{(me?.totals?.paid || 0).toFixed(2)}</p>
                    </div>
                    <Wallet className="h-7 w-7 text-green-600" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Held ({cur})</p>
                      <p className="text-2xl font-bold text-gold-700" data-testid="promoter-held">{(me?.totals?.held || 0).toFixed(2)}</p>
                    </div>
                    <Clock className="h-7 w-7 text-gold-700" />
                  </div>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader><CardTitle className="text-base">Reward Schedule</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {['customer', 'driver', 'merchant', 'supplier'].map((t) => {
                  const M = TYPE_META[t]; const Icon = M.icon;
                  return (
                    <div key={t} className="flex items-center justify-between" data-testid={`reward-row-${t}`}>
                      <span className="flex items-center gap-2 text-sm text-foreground">
                        <Icon className={`h-4 w-4 ${M.color}`} />{M.label}
                      </span>
                      <span className="font-semibold text-gold-700">+{schedule[t] ?? 0} {cur}</span>
                    </div>
                  );
                })}
                <p className="text-xs text-muted-foreground pt-1">
                  Paid when the customer places their first paid order, or when a driver/business/supplier is approved.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Onboards */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-teal-700" />People You Onboarded</CardTitle>
          </CardHeader>
          <CardContent>
            {onboards.length === 0 ? (
              <p className="text-center text-muted-foreground py-8" data-testid="no-onboards">No onboards yet. Share your QR code to start earning!</p>
            ) : (
              <div className="space-y-3">
                {onboards.map((o) => (
                  <div key={o.user_id} className="flex items-center justify-between p-4 bg-muted/40 rounded-lg" data-testid={`onboard-row-${o.user_id}`}>
                    <div>
                      <p className="font-medium text-foreground">{o.name || 'IslandHop user'}</p>
                      <p className="text-sm text-muted-foreground">
                        {o.role || 'customer'} · joined {o.joined_at ? new Date(o.joined_at).toLocaleDateString() : '—'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1 justify-end max-w-[55%]">
                      {o.rewards.length === 0 ? (
                        <Badge variant="outline" className="text-muted-foreground">Pending</Badge>
                      ) : o.rewards.map((r, i) => (
                        <Badge key={i} className={r.status === 'paid'
                          ? 'bg-green-500/15 text-green-700 border-green-500/30'
                          : 'bg-gold-500/15 text-gold-700 border-gold-500/30'}>
                          {TYPE_META[r.type]?.label || r.type} +{r.amount} {r.status === 'paid' ? '✓' : '⏳'}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-gold-500" />Top Promoters</CardTitle>
          </CardHeader>
          <CardContent>
            {leaderboard.length === 0 ? (
              <p className="text-center text-muted-foreground py-6" data-testid="no-leaderboard">No promoter earnings yet — be the first!</p>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((p) => (
                  <div key={p.rank} className="flex items-center justify-between p-3 bg-muted/40 rounded-lg" data-testid={`leaderboard-row-${p.rank}`}>
                    <span className="flex items-center gap-3">
                      <span className={`flex h-7 w-7 items-center justify-center rounded-full font-bold text-sm ${p.rank <= 3 ? 'bg-gold-gradient text-white' : 'bg-muted text-foreground'}`}>{p.rank}</span>
                      <span className="font-medium text-foreground">{p.name}</span>
                    </span>
                    <span className="text-sm">
                      <span className="font-semibold text-gold-700">{p.total} {me?.currency}</span>
                      <span className="text-muted-foreground"> · {p.onboards} onboards</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PromoteEarn;
