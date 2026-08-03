<<<<<<< HEAD
import React, { useState, useEffect, useRef } from 'react';
=======
import React, { useState, useEffect } from 'react';
>>>>>>> cb805eb
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
<<<<<<< HEAD
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from './components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './components/ui/select';
import { Slider } from './components/ui/slider';
import { QRCodeCanvas } from 'qrcode.react';
=======
>>>>>>> cb805eb
import OrderChat from './OrderChat';
import { useAuth } from './AuthContext';
import { 
  Package, 
  DollarSign, 
  TrendingUp,
  Clock,
  CheckCircle,
  X,
  ChefHat,
  Eye,
  AlertCircle,
  Settings,
  BarChart3,
  Users,
  Store,
  Ticket,
  Megaphone,
<<<<<<< HEAD
  MessageCircle,
  Banknote,
  Bell,
  BellOff,
  ChevronDown,
  QrCode,
  Printer,
  Wallet,
  Volume2,
  History,
  Play,
  Truck,
  MapPin
} from 'lucide-react';
import axios from 'axios';
import { getBusinessConfig } from './businessTypeConfig';
import { useToast } from './hooks/use-toast';
import { formatAddress, mapsLink } from './formatAddress';
import { useCurrency } from './CurrencyContext';
=======
  MessageCircle
} from 'lucide-react';
import axios from 'axios';
import { getBusinessConfig } from './businessTypeConfig';
>>>>>>> cb805eb

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

<<<<<<< HEAD
// Live ETA for when the assigned driver will reach the store to collect the order.
const DriverEtaBadge = ({ orderId }) => {
  const [eta, setEta] = useState(null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await axios.get(`${API}/orders/${orderId}/pickup-eta`, { withCredentials: true });
        if (alive) setEta(r.data);
      } catch (_) { /* ignore */ }
    };
    load();
    const t = setInterval(load, 15000);
    return () => { alive = false; clearInterval(t); };
  }, [orderId]);

  if (!eta || !eta.has_driver) {
    return (
      <div className="w-full flex items-center gap-2 text-sm text-muted-foreground border rounded-md px-3 py-2" data-testid={`vendor-eta-${orderId}`}>
        <Clock className="h-4 w-4" /> Waiting for a driver…
      </div>
    );
  }
  if (eta.picked_up) {
    return (
      <div className="w-full flex items-center gap-2 text-sm border rounded-md px-3 py-2" style={{ color: '#0FA3A3', borderColor: '#0FA3A340' }} data-testid={`vendor-eta-${orderId}`}>
        <Truck className="h-4 w-4" /> {eta.driver_name || 'Driver'} has collected the order
      </div>
    );
  }
  return (
    <div className="w-full flex items-center justify-between gap-2 text-sm border rounded-md px-3 py-2" style={{ borderColor: '#0FA3A340' }} data-testid={`vendor-eta-${orderId}`}>
      <span className="flex items-center gap-2 text-foreground"><Truck className="h-4 w-4" style={{ color: '#0FA3A3' }} /> {eta.driver_name || 'Driver'} arriving to collect</span>
      {eta.eta_available
        ? <span className="font-bold whitespace-nowrap" style={{ color: '#0FA3A3' }} data-testid={`vendor-eta-time-${orderId}`}>~{eta.eta_min} min</span>
        : <span className="text-xs text-muted-foreground">en route</span>}
    </div>
  );
};

const VendorDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { format } = useCurrency();
  const [chatOpenFor, setChatOpenFor] = useState(null);
  const [detailsFor, setDetailsFor] = useState(null);
  const [orders, setOrders] = useState([]);
  const seenOrderIdsRef = useRef(null);
  const audioCtxRef = useRef(null);
  const [newOrderCount, setNewOrderCount] = useState(0);
  const [soundOn, setSoundOn] = useState(
    () => localStorage.getItem('vendor_sound_off') !== '1'
  );
  const soundOnRef = useRef(soundOn);
  soundOnRef.current = soundOn;
  const [soundChime, setSoundChime] = useState(
    () => localStorage.getItem('vendor_sound_chime') || 'classic'
  );
  const [soundVolume, setSoundVolume] = useState(
    () => Number(localStorage.getItem('vendor_sound_volume') || 70)
  );
  const soundChimeRef = useRef(soundChime);
  soundChimeRef.current = soundChime;
  const soundVolumeRef = useRef(soundVolume);
  soundVolumeRef.current = soundVolume;
  const [showSoundSettings, setShowSoundSettings] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [alertsSeenAt, setAlertsSeenAt] = useState(
    () => localStorage.getItem('vendor_alerts_seen_at') || ''
  );
=======
const VendorDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [chatOpenFor, setChatOpenFor] = useState(null);
  const [orders, setOrders] = useState([]);
>>>>>>> cb805eb
  const [stats, setStats] = useState({
    today_orders: 0,
    today_revenue: 0,
    pending_orders: 0,
    total_earnings: 0
  });
  const [selectedTab, setSelectedTab] = useState('pending');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
    fetchStats();
    fetchSetupStatus();
    fetchSavings();
<<<<<<< HEAD
    // Ask for desktop notification permission so merchants get alerted even off-tab
    try {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    } catch (_) { /* noop */ }

    // Refresh every 15 seconds so new orders surface quickly
    const interval = setInterval(() => {
      fetchOrders();
      fetchStats();
    }, 15000);
=======
    
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchOrders();
      fetchStats();
    }, 30000);
>>>>>>> cb805eb

    return () => clearInterval(interval);
  }, []);

<<<<<<< HEAD
  // Chime presets — each is a list of {freq, at, dur} notes played via Web Audio.
  const CHIMES = {
    classic: { label: 'Classic (double beep)', notes: [
      { f: 880, f2: 1320, at: 0, dur: 0.24 },
      { f: 880, f2: 1320, at: 0.28, dur: 0.24 },
      { f: 880, f2: 1320, at: 0.56, dur: 0.24 },
    ], type: 'sine' },
    ding: { label: 'Ding', notes: [{ f: 1200, f2: 1200, at: 0, dur: 0.5 }], type: 'sine' },
    bell: { label: 'Bell', notes: [
      { f: 660, f2: 660, at: 0, dur: 0.7 },
      { f: 990, f2: 990, at: 0, dur: 0.7 },
    ], type: 'triangle' },
    marimba: { label: 'Marimba', notes: [
      { f: 523, f2: 523, at: 0, dur: 0.18 },
      { f: 659, f2: 659, at: 0.16, dur: 0.18 },
      { f: 784, f2: 784, at: 0.32, dur: 0.28 },
    ], type: 'triangle' },
    urgent: { label: 'Urgent (kitchen)', notes: [
      { f: 1000, f2: 1000, at: 0, dur: 0.14 },
      { f: 1000, f2: 1000, at: 0.18, dur: 0.14 },
      { f: 1000, f2: 1000, at: 0.36, dur: 0.14 },
      { f: 1000, f2: 1000, at: 0.54, dur: 0.14 },
    ], type: 'square' },
  };

  const playTone = (chimeName, volumePct) => {
    try {
      if (!audioCtxRef.current) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        audioCtxRef.current = new Ctx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;
      const peak = Math.max(0.02, Math.min(1, (volumePct || 0) / 100)) * 0.6;
      const chime = CHIMES[chimeName] || CHIMES.classic;
      chime.notes.forEach((n) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = chime.type || 'sine';
        osc.frequency.setValueAtTime(n.f, now + n.at);
        if (n.f2 && n.f2 !== n.f) osc.frequency.setValueAtTime(n.f2, now + n.at + n.dur * 0.5);
        gain.gain.setValueAtTime(0.0001, now + n.at);
        gain.gain.exponentialRampToValueAtTime(peak, now + n.at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + n.at + n.dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + n.at);
        osc.stop(now + n.at + n.dur + 0.02);
      });
    } catch (_) { /* audio may be blocked until user interacts */ }
  };

  // Attention chime using the merchant's chosen sound + volume.
  const playChime = () => {
    if (!soundOnRef.current) return;
    playTone(soundChimeRef.current, soundVolumeRef.current);
  };

  const saveSoundChime = (val) => {
    setSoundChime(val);
    localStorage.setItem('vendor_sound_chime', val);
    playTone(val, soundVolumeRef.current);
  };
  const saveSoundVolume = (val) => {
    const v = Array.isArray(val) ? val[0] : val;
    setSoundVolume(v);
    localStorage.setItem('vendor_sound_volume', String(v));
  };
  const markAlertsSeen = () => {
    const ts = new Date().toISOString();
    setAlertsSeenAt(ts);
    localStorage.setItem('vendor_alerts_seen_at', ts);
  };

  const alertNewOrders = (count) => {
    setNewOrderCount((c) => c + count);
    playChime();
    toast({
      title: `${count} new order${count > 1 ? 's' : ''} received`,
      description: 'You have a new order waiting. Tap Pending to view it.',
    });
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        const n = new Notification('New IslandHop order', {
          body: `${count} new order${count > 1 ? 's' : ''} received`,
          tag: 'islandhop-new-order',
        });
        setTimeout(() => n.close(), 8000);
      }
    } catch (_) { /* noop */ }
  };

  const [setup, setSetup] = useState(null);
  const [savings, setSavings] = useState(null);
  const [vendorType, setVendorType] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [stripeStatus, setStripeStatus] = useState(null);
  const [weekly, setWeekly] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const [storeName, setStoreName] = useState('');
=======
  const [setup, setSetup] = useState(null);
  const [savings, setSavings] = useState(null);
  const [vendorType, setVendorType] = useState('');
>>>>>>> cb805eb
  const [setupDismissed, setSetupDismissed] = useState(
    () => localStorage.getItem('storefront_setup_dismissed') === '1'
  );
  const fetchSavings = async () => {
    try {
      const token = localStorage.getItem('token');
<<<<<<< HEAD
      const cfg = { withCredentials: true, headers: token ? { Authorization: `Bearer ${token}` } : {} };
=======
      const cfg = { withCredentials: false, headers: token ? { Authorization: `Bearer ${token}` } : {} };
>>>>>>> cb805eb
      const { data } = await axios.get(`${API}/merchant/fee-savings`, cfg);
      setSavings(data);
    } catch (e) {
      setSavings(null);
    }
<<<<<<< HEAD
    try {
      const token = localStorage.getItem('token');
      const cfg = { withCredentials: true, headers: token ? { Authorization: `Bearer ${token}` } : {} };
      const { data } = await axios.get(`${API}/merchant/payouts/weekly`, cfg);
      setWeekly(data);
    } catch (e) {
      setWeekly(null);
    }
=======
>>>>>>> cb805eb
  };
  const fetchSetupStatus = async () => {
    try {
      const token = localStorage.getItem('token');
<<<<<<< HEAD
      const cfg = { withCredentials: true, headers: token ? { Authorization: `Bearer ${token}` } : {} };
=======
      const cfg = { withCredentials: false, headers: token ? { Authorization: `Bearer ${token}` } : {} };
>>>>>>> cb805eb
      const [sf, pr] = await Promise.all([
        axios.get(`${API}/merchant/storefront`, cfg),
        axios.get(`${API}/merchant/products`, cfg),
      ]);
      setSetup({
        hasLogo: !!sf.data?.logo,
        hasCover: !!sf.data?.cover,
        hasBio: !!(sf.data?.bio && sf.data.bio.trim()),
        hasProducts: (pr.data?.products || []).length > 0,
      });
      if (pr.data?.vendor_type) setVendorType(pr.data.vendor_type);
<<<<<<< HEAD
      if (sf.data?.vendor_id) setVendorId(sf.data.vendor_id);
      if (sf.data?.name) setStoreName(sf.data.name);
    } catch (e) {
      setSetup(null); // not a merchant yet / not resolvable — hide banner
    }
    try {
      const token = localStorage.getItem('token');
      const cfg = { withCredentials: true, headers: token ? { Authorization: `Bearer ${token}` } : {} };
      const cs = await axios.get(`${API}/vendor/connect/status`, cfg);
      setStripeStatus(cs.data);
    } catch (e) {
      setStripeStatus(null);
    }
=======
    } catch (e) {
      setSetup(null); // not a merchant yet / not resolvable — hide banner
    }
>>>>>>> cb805eb
  };

  const fetchOrders = async () => {
    try {
      const response = await axios.get(`${API}/vendors/my-orders`, {
<<<<<<< HEAD
        withCredentials: true
      });
      const list = response.data || [];
      setOrders(list);

      // Detect brand-new incoming orders and alert the merchant.
      const activeIds = list
        .filter((o) => ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status))
        .map((o) => o.id);
      if (seenOrderIdsRef.current === null) {
        // First load — establish baseline, don't alert.
        seenOrderIdsRef.current = new Set(activeIds);
      } else {
        const fresh = activeIds.filter((id) => !seenOrderIdsRef.current.has(id));
        if (fresh.length > 0) alertNewOrders(fresh.length);
        seenOrderIdsRef.current = new Set(activeIds);
      }
=======
        withCredentials: false
      });
      setOrders(response.data);
>>>>>>> cb805eb
      setLoading(false);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setLoading(false);
    }
  };

<<<<<<< HEAD
  const toggleSound = () => {
    setSoundOn((prev) => {
      const next = !prev;
      localStorage.setItem('vendor_sound_off', next ? '0' : '1');
      if (next) playChime();
      return next;
    });
  };

  const clearNewOrderAlert = () => setNewOrderCount(0);

  const handlePrintQR = () => {
    const node = document.getElementById('vendor-qr-printable');
    if (!node) return;
    const w = window.open('', '_blank', 'width=480,height=640');
    if (!w) return;
    w.document.write(`<html><head><title>Storefront QR — ${storeName || 'IslandHop'}</title>
      <style>body{font-family:system-ui,sans-serif;text-align:center;padding:32px;}</style></head>
      <body>${node.innerHTML}<script>window.onload=function(){setTimeout(function(){window.print();},250);};<\/script></body></html>`);
    w.document.close();
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/vendors/stats`, {
        withCredentials: true
=======
  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/vendors/stats`, {
        withCredentials: false
>>>>>>> cb805eb
      });
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleOrderAction = async (orderId, status) => {
    try {
      await axios.put(`${API}/orders/${orderId}/status`, {
        status: status
      }, {
        params: { status },
<<<<<<< HEAD
        withCredentials: true
=======
        withCredentials: false
>>>>>>> cb805eb
      });
      
      fetchOrders();
      fetchStats();
    } catch (error) {
      console.error('Error updating order:', error);
      alert('Failed to update order');
    }
  };

<<<<<<< HEAD
  const REJECT_REASONS = [
    'Item(s) out of stock',
    'Store is closing / closed',
    'Too busy to fulfill right now',
    'Cannot deliver to that address',
    'Duplicate or test order',
  ];
  const [rejectFor, setRejectFor] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const submitReject = async () => {
    if (!rejectFor) return;
    setRejecting(true);
    try {
      await axios.post(`${API}/orders/${rejectFor}/reject`, { reason: rejectReason || undefined }, { withCredentials: true });
      setRejectFor(null);
      setRejectReason('');
      fetchOrders();
      fetchStats();
    } catch (error) {
      alert(error?.response?.data?.detail || 'Failed to decline order');
    } finally {
      setRejecting(false);
    }
  };

=======
>>>>>>> cb805eb
  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-gold-500/15 text-yellow-800',
      confirmed: 'bg-neon-cyan/15 text-teal-700',
      preparing: 'bg-purple-100 text-purple-800',
      ready: 'bg-green-100 text-green-800',
      picked_up: 'bg-indigo-100 text-indigo-800',
      in_transit: 'bg-neon-cyan/15 text-teal-700',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-matte-800 text-foreground';
  };

  const filterOrders = (status) => {
    if (status === 'active') {
      return orders.filter(o => ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status));
    }
    if (status === 'completed') {
      return orders.filter(o => ['delivered', 'cancelled'].includes(o.status));
    }
    return orders.filter(o => o.status === status);
  };

  const filteredOrders = filterOrders(selectedTab);

<<<<<<< HEAD
  // Recent alerts = most recent orders; "unseen" = arrived after the merchant last opened the list.
  const recentAlerts = [...orders]
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
    .slice(0, 15);
  const unseenAlertCount = alertsSeenAt
    ? recentAlerts.filter((o) => String(o.created_at || '') > alertsSeenAt).length
    : recentAlerts.length;

  const timeAgo = (iso) => {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

=======
>>>>>>> cb805eb
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-500/30"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4 max-w-7xl">
<<<<<<< HEAD
        {stripeStatus && !stripeStatus.payouts_enabled && (
          <div
            className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-gold-500/40 bg-gold-500/10 p-4"
            data-testid="stripe-onboarding-banner"
          >
            <div className="flex items-start gap-3">
              <Banknote className="h-5 w-5 text-gold-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">Finish setting up payouts to get paid</p>
                <p className="text-sm text-muted-foreground">
                  Until you connect your bank via Stripe, your share of each sale is held and can&apos;t be sent to you. It takes 2 minutes.
                </p>
              </div>
            </div>
            <Button
              onClick={() => navigate('/vendor/connect-stripe')}
              className="bg-gold-gradient hover:bg-gold-gradient-hover text-white shrink-0"
              data-testid="stripe-onboarding-banner-btn"
            >
              <Banknote className="h-4 w-4 mr-2" /> Set up payouts
            </Button>
          </div>
        )}
        {/* Header */}
        <div className="mb-8">
          {newOrderCount > 0 && (
            <button
              type="button"
              onClick={() => { setSelectedTab('pending'); clearNewOrderAlert(); }}
              className="w-full mb-4 flex items-center justify-between gap-3 rounded-lg border-2 border-gold-500 bg-gold-500/10 px-4 py-3 text-left animate-pulse"
              data-testid="vendor-new-order-banner"
            >
              <span className="flex items-center gap-3">
                <Bell className="h-6 w-6 text-gold-600" />
                <span>
                  <span className="block font-bold text-foreground">{newOrderCount} new order{newOrderCount > 1 ? 's' : ''} received!</span>
                  <span className="block text-sm text-muted-foreground">Tap here to view your pending orders.</span>
                </span>
              </span>
              <Badge className="bg-gold-gradient text-white">View</Badge>
            </button>
          )}
          {showAlerts && (
            <Card className="mb-4" data-testid="vendor-alerts-panel">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-4 w-4 text-gold-500" /> Recent order alerts
                </CardTitle>
                <button
                  type="button"
                  onClick={markAlertsSeen}
                  className="text-xs text-muted-foreground hover:text-foreground"
                  data-testid="vendor-alerts-mark-seen"
                >
                  Mark all seen
                </button>
              </CardHeader>
              <CardContent className="pt-0">
                {recentAlerts.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center" data-testid="vendor-alerts-empty">
                    No order alerts yet. New orders will show up here.
                  </p>
                ) : (
                  <ul className="divide-y divide-border max-h-72 overflow-y-auto">
                    {recentAlerts.map((o) => {
                      const unseen = alertsSeenAt ? String(o.created_at || '') > alertsSeenAt : true;
                      return (
                        <li
                          key={o.id}
                          className="flex items-center justify-between gap-3 py-2.5 cursor-pointer hover:bg-muted/50 rounded px-1"
                          onClick={() => { setSelectedTab('pending'); setShowAlerts(false); }}
                          data-testid={`vendor-alert-item-${o.id}`}
                        >
                          <span className="flex items-center gap-2.5 min-w-0">
                            {unseen && <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />}
                            <span className="min-w-0">
                              <span className="block text-sm font-medium text-foreground truncate">
                                New order #{String(o.id).substring(0, 8)} · {o.service_type || 'order'}
                              </span>
                              <span className="block text-xs text-muted-foreground">{timeAgo(o.created_at)}</span>
                            </span>
                          </span>
                          <span className="flex items-center gap-2 shrink-0">
                            <span className="text-sm font-semibold text-gold-600">{format(Number(o.total || 0))}</span>
                            <Badge className={getStatusColor(o.status)}>{o.status}</Badge>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
=======
        {/* Header */}
        <div className="mb-8">
>>>>>>> cb805eb
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Vendor Dashboard</h1>
              <p className="text-muted-foreground">Manage your orders and business</p>
            </div>
            <div className="flex gap-2">
<<<<<<< HEAD
              <Button
                onClick={() => setShowAlerts((v) => { if (v) markAlertsSeen(); return !v; })}
                variant="outline"
                size="icon"
                className="relative"
                title="Recent order alerts"
                data-testid="vendor-alerts-toggle"
              >
                <History className="h-5 w-5 text-gold-500" />
                {unseenAlertCount > 0 && (
                  <span
                    className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center"
                    data-testid="vendor-alerts-unseen-count"
                  >
                    {unseenAlertCount}
                  </span>
                )}
              </Button>
              <Button
                onClick={toggleSound}
                variant="outline"
                size="icon"
                title={soundOn ? 'New-order sound is ON' : 'New-order sound is OFF'}
                data-testid="vendor-sound-toggle"
              >
                {soundOn ? <Bell className="h-5 w-5 text-gold-500" /> : <BellOff className="h-5 w-5 text-muted-foreground" />}
              </Button>
              <Button
                onClick={() => setShowSoundSettings(true)}
                variant="outline"
                size="icon"
                title="Alert sound settings"
                data-testid="vendor-sound-settings-btn"
              >
                <Volume2 className="h-5 w-5 text-gold-500" />
              </Button>
=======
>>>>>>> cb805eb
              {(() => {
                const cfg = getBusinessConfig(vendorType);
                const Icon = vendorType === 'restaurant' ? ChefHat : Package;
                return (
                  <Button onClick={() => navigate(cfg.manageRoute)} variant="outline" data-testid="vendor-manage-catalog-btn">
                    <Icon className="h-5 w-5 mr-2" />
                    {cfg.manageLabel}
                  </Button>
                );
              })()}
<<<<<<< HEAD
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" data-testid="vendor-storefront-menu-btn">
                    <Store className="h-5 w-5 mr-2" />
                    Storefront
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate('/merchant/storefront')} data-testid="vendor-storefront-edit-item">
                    <Store className="h-4 w-4 mr-2" />
                    Edit Storefront
                  </DropdownMenuItem>
                  {vendorId && (
                    <DropdownMenuItem
                      onClick={() => window.open(`/restaurant/${vendorId}`, '_blank', 'noopener')}
                      data-testid="vendor-view-storefront-item"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View My Storefront
                    </DropdownMenuItem>
                  )}
                  {vendorId && (
                    <DropdownMenuItem onClick={() => setShowQR(true)} data-testid="vendor-qr-item">
                      <QrCode className="h-4 w-4 mr-2" />
                      Store QR Code
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={() => navigate('/wallet')} variant="outline" data-testid="vendor-wallet-btn">
                <Wallet className="h-5 w-5 mr-2" />
                Wallet
              </Button>
              <Button onClick={() => navigate('/vendor/connect-stripe')} variant="outline" data-testid="vendor-payments-btn">
                <Banknote className="h-5 w-5 mr-2" />
                Payments &amp; Payouts
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" data-testid="vendor-grow-menu-btn">
                    <Megaphone className="h-5 w-5 mr-2" />
                    Grow
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate('/merchant/coupons')} data-testid="vendor-coupons-item">
                    <Ticket className="h-4 w-4 mr-2" />
                    Coupons
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/merchant/ads')} data-testid="vendor-ads-item">
                    <Megaphone className="h-4 w-4 mr-2" />
                    Advertise
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/merchant/subscription')} data-testid="vendor-subscription-item">
                    <DollarSign className="h-4 w-4 mr-2" />
                    Subscription
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
=======
              <Button onClick={() => navigate('/merchant/storefront')} variant="outline" data-testid="vendor-storefront-btn">
                <Store className="h-5 w-5 mr-2" />
                My Storefront
              </Button>
              <Button onClick={() => navigate('/merchant/coupons')} variant="outline" data-testid="vendor-coupons-btn">
                <Ticket className="h-5 w-5 mr-2" />
                Coupons
              </Button>
              <Button onClick={() => navigate('/merchant/ads')} variant="outline" data-testid="vendor-ads-btn">
                <Megaphone className="h-5 w-5 mr-2" />
                Advertise
              </Button>
              <Button onClick={() => navigate('/merchant/subscription')} variant="outline" data-testid="vendor-subscription-link">
                <DollarSign className="h-5 w-5 mr-2" />
                Subscription
              </Button>
>>>>>>> cb805eb
              <Button onClick={() => navigate('/vendor/settings')} variant="outline" data-testid="vendor-settings-btn">
                <Settings className="h-5 w-5 mr-2" />
                Settings
              </Button>
            </div>
          </div>

          {/* Premium fee-savings ROI banner — shows commission saved vs the Standard 10% base */}
          {savings && (() => {
<<<<<<< HEAD
            const money = (n) => format(Number(n || 0));
=======
            const money = (n) => `${savings.currency || 'TTD'} $${Number(n || 0).toFixed(2)}`;
>>>>>>> cb805eb
            const isPremium = savings.tier === 'premium';
            const isPro = savings.tier === 'pro';
            // Premium/Pro: celebrate savings. Standard: upsell with potential savings.
            const headline = isPremium
              ? `You saved ${money(savings.saved)} in fees this month`
              : isPro
              ? `You saved ${money(savings.saved)} this month with Professional`
              : savings.potential_extra_savings > 0
              ? `You could have saved ${money(savings.potential_extra_savings)} this month on Premium`
              : null;
            if (!headline) return null;
            const sub = isPremium
              ? `${savings.orders} order${savings.orders === 1 ? '' : 's'} • 0% commission on Premium (Standard would have cost ${money(savings.standard_commission)}).`
              : savings.upgrade_tier === 'premium'
              ? `Upgrade to Premium (0% commission) and keep an extra ${money(savings.potential_extra_savings)} a month.`
              : '';
            return (
              <div
                className="mb-6 rounded-xl border border-gold-500/40 bg-gold-gradient/5 bg-gradient-to-r from-gold-500/10 to-neon-cyan/5 p-4"
                data-testid="fee-savings-banner"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-gold-500/15 p-2.5">
                      <TrendingUp className="h-5 w-5 text-gold-500" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-foreground" data-testid="fee-savings-headline">{headline}</h3>
                      {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
                      <p className="mt-0.5 text-xs text-muted-foreground">{savings.month}</p>
                    </div>
                  </div>
                  {!isPremium && (
                    <Button
                      size="sm"
                      className="bg-gold-gradient text-white shrink-0"
                      onClick={() => navigate('/merchant/subscription')}
                      data-testid="fee-savings-upgrade-btn"
                    >
                      Upgrade to Premium
                    </Button>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Storefront completion checklist — helps newly-approved merchants go live in search */}
          {setup && !setupDismissed && (() => {
            const steps = [
              { key: 'hasLogo', label: 'Add a logo', done: setup.hasLogo, to: '/merchant/storefront' },
              { key: 'hasCover', label: 'Add a cover photo', done: setup.hasCover, to: '/merchant/storefront' },
              { key: 'hasBio', label: 'Write a short bio', done: setup.hasBio, to: '/merchant/storefront' },
              { key: 'hasProducts', label: 'Add your first product', done: setup.hasProducts, to: '/merchant/products' },
            ];
            const doneCount = steps.filter((s) => s.done).length;
            if (doneCount === steps.length) return null;
            const next = steps.find((s) => !s.done);
            return (
              <div className="mb-6 rounded-xl border border-gold-500/40 bg-gold-500/5 p-4" data-testid="storefront-setup-banner">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Store className="h-5 w-5 text-gold-500" />
                      <h3 className="text-base font-semibold text-foreground">Finish setting up your storefront</h3>
                      <span className="text-xs text-muted-foreground">{doneCount}/{steps.length} done</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">Complete these so your store looks great and shows up in customer search.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {steps.map((s) => (
                        <button
                          key={s.key}
                          onClick={() => navigate(s.to)}
                          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                            s.done
                              ? 'border-green-500/30 bg-green-500/10 text-green-700'
                              : 'border-border hover:border-gold-500 text-foreground'
                          }`}
                          data-testid={`setup-step-${s.key}`}
                        >
                          {s.done ? <CheckCircle className="h-3.5 w-3.5" /> : <span className="h-3.5 w-3.5 rounded-full border border-current inline-block" />}
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <Button size="sm" className="bg-gold-gradient text-white" onClick={() => navigate(next.to)} data-testid="setup-continue-btn">
                      {next.label}
                    </Button>
                    <button
                      onClick={() => { setSetupDismissed(true); localStorage.setItem('storefront_setup_dismissed', '1'); }}
                      className="text-xs text-muted-foreground hover:text-foreground"
                      data-testid="setup-dismiss-btn"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

<<<<<<< HEAD
          {/* Owed-to-you-this-week payout card */}
          {weekly && (
            <div
              className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-green-500/30 bg-green-500/5 p-4"
              data-testid="weekly-payout-card"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-green-500/15 p-2.5">
                  <Wallet className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Owed to you this week</p>
                  <p className="text-2xl font-bold text-green-600" data-testid="weekly-payout-amount">
                    {format(Number(weekly.owed_this_week || 0))}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {weekly.orders_this_week} order{weekly.orders_this_week === 1 ? '' : 's'} in the last 7 days
                    {weekly.paid_this_week > 0 && ` · ${format(Number(weekly.paid_this_week))} already paid out`}
                  </p>
                </div>
              </div>
              <Button
                onClick={() => navigate('/vendor/connect-stripe')}
                variant="outline"
                className="shrink-0"
                data-testid="weekly-payout-details-btn"
              >
                View payouts
              </Button>
            </div>
          )}

=======
>>>>>>> cb805eb
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Today&apos;s Orders</p>
                    <p className="text-3xl font-bold text-foreground">{stats.today_orders}</p>
                  </div>
                  <div className="bg-neon-cyan/15 p-3 rounded-lg">
                    <Package className="h-6 w-6 text-teal-700" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Today&apos;s Revenue</p>
                    <p className="text-3xl font-bold text-gold-500">
<<<<<<< HEAD
                      {format(Number(stats.today_revenue || 0))}
=======
                      ${stats.today_revenue?.toFixed(2)}
>>>>>>> cb805eb
                    </p>
                  </div>
                  <div className="bg-gold-500/15 p-3 rounded-lg">
                    <DollarSign className="h-6 w-6 text-gold-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pending Orders</p>
                    <p className="text-3xl font-bold text-yellow-600">{stats.pending_orders}</p>
                  </div>
                  <div className="bg-gold-500/15 p-3 rounded-lg">
                    <Clock className="h-6 w-6 text-yellow-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Earnings</p>
                    <p className="text-3xl font-bold text-green-600">
<<<<<<< HEAD
                      {format(Number(stats.total_earnings || 0))}
=======
                      ${stats.total_earnings?.toFixed(2)}
>>>>>>> cb805eb
                    </p>
                  </div>
                  <div className="bg-green-100 p-3 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Orders Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Orders</span>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => navigate('/merchant/products')} className="bg-gold-gradient text-white" data-testid="manage-products-btn">
                  Products &amp; Menu
                </Button>
                <Button size="sm" variant="outline" onClick={() => fetchOrders()}>
                  Refresh
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Tabs */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              {[
                { id: 'pending', label: 'Pending', count: orders.filter(o => o.status === 'pending').length },
                { id: 'active', label: 'Active', count: filterOrders('active').length },
                { id: 'preparing', label: 'Preparing', count: orders.filter(o => o.status === 'preparing').length },
                { id: 'ready', label: 'Ready', count: orders.filter(o => o.status === 'ready').length },
                { id: 'completed', label: 'Completed', count: filterOrders('completed').length }
              ].map((tab) => (
                <Button
                  key={tab.id}
                  variant={selectedTab === tab.id ? 'default' : 'outline'}
                  onClick={() => setSelectedTab(tab.id)}
                  size="sm"
                >
                  {tab.label} ({tab.count})
                </Button>
              ))}
            </div>

            {/* Orders List */}
            {filteredOrders.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">No orders</h3>
                <p className="text-muted-foreground">You don&apos;t have any {selectedTab} orders</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map((order) => (
                  <Card key={order.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-lg">
                              Order #{order.id?.substring(0, 8)}
                            </h3>
                            <Badge className={getStatusColor(order.status)}>
                              {order.status?.toUpperCase()}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>
                              <Clock className="h-4 w-4 inline mr-1" />
                              {new Date(order.created_at).toLocaleString()}
                            </p>
                            <p>
                              <Users className="h-4 w-4 inline mr-1" />
                              Customer: {order.customer_phone || 'N/A'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-gold-500">
<<<<<<< HEAD
                            {format(Number(order.vendor_payout ?? order.subtotal ?? 0))}
=======
                            ${order.vendor_payout?.toFixed(2) || order.subtotal?.toFixed(2)}
>>>>>>> cb805eb
                          </p>
                          <p className="text-xs text-muted-foreground">Your payout</p>
                        </div>
                      </div>

                      {/* Order Items */}
                      {order.items && order.items.length > 0 && (
                        <div className="mb-4 p-4 bg-background rounded-lg">
                          <p className="font-medium text-sm mb-2">Items:</p>
                          {order.items.map((item, idx) => (
                            <div key={`${item.menu_item_id || item.name}-${idx}`} className="flex justify-between text-sm">
                              <span>{item.quantity}x {item.name}</span>
<<<<<<< HEAD
                              <span>{format(Number((item.price || 0) * (item.quantity || 1)))}</span>
=======
                              <span>${(item.price * item.quantity).toFixed(2)}</span>
>>>>>>> cb805eb
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Delivery Info */}
                      {order.delivery_address && (
                        <div className="mb-4 text-sm text-muted-foreground">
<<<<<<< HEAD
                          <p className="font-medium">Drop-off address:</p>
                          <p>{formatAddress(order.delivery_address) || 'Not provided'}</p>
=======
                          <p className="font-medium">Delivery Address:</p>
                          <p>{order.delivery_address.street_address}</p>
                          <p>{order.delivery_address.city}, {order.delivery_address.postal_code}</p>
>>>>>>> cb805eb
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 pt-4 border-t">
                        {order.status === 'pending' && (
                          <>
                            <Button
                              onClick={() => handleOrderAction(order.id, 'confirmed')}
                              className="flex-1 bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Accept Order
                            </Button>
                            <Button
<<<<<<< HEAD
                              onClick={() => { setRejectFor(order.id); setRejectReason(''); }}
                              variant="destructive"
                              className="flex-1"
                              data-testid={`vendor-reject-btn-${order.id}`}
=======
                              onClick={() => handleOrderAction(order.id, 'cancelled')}
                              variant="destructive"
                              className="flex-1"
>>>>>>> cb805eb
                            >
                              <X className="h-4 w-4 mr-2" />
                              Reject
                            </Button>
                          </>
                        )}

                        {order.status === 'confirmed' && (
                          <Button
                            onClick={() => handleOrderAction(order.id, 'preparing')}
                            className="flex-1"
                          >
                            Start Preparing
                          </Button>
                        )}

                        {order.status === 'preparing' && (
                          <Button
                            onClick={() => handleOrderAction(order.id, 'ready')}
                            className="flex-1 bg-green-600 hover:bg-green-700"
                          >
                            Mark as Ready
                          </Button>
                        )}

                        {(order.status === 'ready' || order.status === 'picked_up' || order.status === 'in_transit') && (
<<<<<<< HEAD
                          <div className="flex-1">
                            {order.driver_id ? (
                              <DriverEtaBadge orderId={order.id} />
                            ) : (
                              <Button variant="outline" className="w-full" disabled>
                                <Clock className="h-4 w-4 mr-2" />
                                Finding a driver…
                              </Button>
                            )}
                          </div>
=======
                          <Button variant="outline" className="flex-1" disabled>
                            <Clock className="h-4 w-4 mr-2" />
                            Waiting for Delivery
                          </Button>
>>>>>>> cb805eb
                        )}

                        <Button
                          onClick={() => setChatOpenFor((cur) => cur === order.id ? null : order.id)}
                          variant={chatOpenFor === order.id ? 'default' : 'outline'}
                          size="sm"
                          data-testid={`vendor-chat-${order.id}`}
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                        <Button
<<<<<<< HEAD
                          onClick={() => setDetailsFor(order)}
                          variant="outline"
                          size="sm"
                          data-testid={`vendor-order-details-btn-${order.id}`}
=======
                          onClick={() => navigate(`/order-tracking/${order.id}`)}
                          variant="outline"
                          size="sm"
>>>>>>> cb805eb
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>

                      {chatOpenFor === order.id && (
                        <div className="mt-4" data-testid={`vendor-chat-wrapper-${order.id}`}>
                          <OrderChat
                            orderId={order.id}
                            currentUserId={user?.id}
                            viewerRole="vendor"
                            title="Customer & driver"
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
<<<<<<< HEAD

      {/* Full order details for the merchant */}
      <Dialog open={!!detailsFor} onOpenChange={(o) => !o && setDetailsFor(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" data-testid="vendor-order-details-dialog">
          <DialogHeader>
            <DialogTitle>Order #{detailsFor?.id?.substring(0, 8)}</DialogTitle>
          </DialogHeader>
          {detailsFor && (
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-2">
                <Badge className={getStatusColor(detailsFor.status)}>{detailsFor.status?.toUpperCase()}</Badge>
                <span className="text-muted-foreground">{new Date(detailsFor.created_at).toLocaleString()}</span>
              </div>

              <div className="p-3 rounded-lg bg-muted/50" data-testid="vendor-details-customer">
                <p className="font-semibold mb-1">Customer</p>
                <p className="text-muted-foreground">Name: {detailsFor.customer_name || 'N/A'}</p>
                <p className="text-muted-foreground">
                  Phone: {detailsFor.customer_phone
                    ? <a href={`tel:${detailsFor.customer_phone}`} className="text-gold-600 underline">{detailsFor.customer_phone}</a>
                    : 'N/A'}
                </p>
              </div>

              <div data-testid="vendor-details-items">
                <p className="font-semibold mb-1">Items</p>
                {(detailsFor.items || []).length === 0 && <p className="text-muted-foreground">No items listed.</p>}
                {(detailsFor.items || []).map((it, idx) => (
                  <div key={`${it.menu_item_id || it.name}-${idx}`} className="flex justify-between">
                    <span>{it.quantity}× {it.name}</span>
                    <span>{format(Number((it.price || 0) * (it.quantity || 1)))}</span>
                  </div>
                ))}
                {detailsFor.notes && <p className="text-muted-foreground mt-2">Note: {detailsFor.notes}</p>}
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div data-testid="vendor-details-dropoff">
                  <p className="font-semibold mb-1 flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-red-500" /> Drop-off location
                  </p>
                  <p className="text-muted-foreground">{formatAddress(detailsFor.delivery_address) || 'Not provided'}</p>
                  {mapsLink(detailsFor.delivery_address) && (
                    <a href={mapsLink(detailsFor.delivery_address)} target="_blank" rel="noopener noreferrer"
                       className="inline-flex items-center gap-1 text-xs text-gold-600 underline mt-1"
                       data-testid="vendor-details-dropoff-map">
                      <MapPin className="h-3 w-3" /> View on map
                    </a>
                  )}
                </div>
              </div>

              <div className="border-t pt-3 space-y-1">
                <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{format(Number(detailsFor.subtotal || 0))}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Delivery fee</span><span>{format(Number(detailsFor.delivery_fee || 0))}</span></div>
                <div className="flex justify-between font-semibold"><span>Order total</span><span>{format(Number(detailsFor.total || 0))}</span></div>
                <div className="flex justify-between text-gold-600 font-semibold"><span>Your payout</span><span>{format(Number(detailsFor.vendor_payout ?? detailsFor.subtotal ?? 0))}</span></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Printable storefront QR code */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="max-w-sm" data-testid="vendor-qr-dialog">
          <DialogHeader>
            <DialogTitle>Your storefront QR code</DialogTitle>
          </DialogHeader>
          <div id="vendor-qr-printable" className="flex flex-col items-center text-center p-4">
            <p className="text-lg font-bold text-foreground mb-1">{storeName || 'Scan to order'}</p>
            <p className="text-sm text-muted-foreground mb-4">Scan with your phone camera to order from us</p>
            <div className="bg-white p-4 rounded-lg border">
              <QRCodeCanvas
                value={`${window.location.origin}/restaurant/${vendorId}`}
                size={220}
                level="M"
                includeMargin
                data-testid="vendor-qr-canvas"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-3 break-all">{`${window.location.origin}/restaurant/${vendorId}`}</p>
          </div>
          <Button onClick={handlePrintQR} className="w-full bg-gold-gradient text-white" data-testid="vendor-qr-print-btn">
            <Printer className="h-4 w-4 mr-2" /> Print QR code
          </Button>
        </DialogContent>
      </Dialog>

      {/* Alert sound settings */}
      <Dialog open={showSoundSettings} onOpenChange={setShowSoundSettings}>
        <DialogContent className="max-w-sm" data-testid="vendor-sound-settings-dialog">
          <DialogHeader>
            <DialogTitle>New-order alert sound</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Play a sound on new orders</p>
                <p className="text-xs text-muted-foreground">So a busy kitchen never misses one.</p>
              </div>
              <Button
                onClick={toggleSound}
                variant={soundOn ? 'default' : 'outline'}
                size="sm"
                className={soundOn ? 'bg-gold-gradient text-white' : ''}
                data-testid="vendor-sound-settings-toggle"
              >
                {soundOn ? 'On' : 'Off'}
              </Button>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Chime</label>
              <Select value={soundChime} onValueChange={saveSoundChime}>
                <SelectTrigger data-testid="vendor-sound-chime-select">
                  <SelectValue placeholder="Choose a chime" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CHIMES).map(([key, c]) => (
                    <SelectItem key={key} value={key} data-testid={`vendor-sound-chime-${key}`}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-foreground">Volume</label>
                <span className="text-xs text-muted-foreground" data-testid="vendor-sound-volume-value">{soundVolume}%</span>
              </div>
              <Slider
                value={[soundVolume]}
                onValueChange={saveSoundVolume}
                min={10}
                max={100}
                step={5}
                data-testid="vendor-sound-volume-slider"
              />
            </div>

            <Button
              onClick={() => playTone(soundChime, soundVolume)}
              variant="outline"
              className="w-full"
              data-testid="vendor-sound-test-btn"
            >
              <Play className="h-4 w-4 mr-2" /> Test sound
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject order dialog */}
      <Dialog open={!!rejectFor} onOpenChange={(o) => { if (!o) { setRejectFor(null); setRejectReason(''); } }}>
        <DialogContent className="max-w-sm" data-testid="vendor-reject-dialog">
          <DialogHeader>
            <DialogTitle>Decline this order</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Pick a reason (the customer is notified):</p>
            <div className="flex flex-wrap gap-2">
              {REJECT_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRejectReason(r)}
                  data-testid={`vendor-reject-reason-${r.slice(0, 12)}`}
                  className={`text-sm rounded-full px-3 py-1.5 border transition-colors ${rejectReason === r ? 'bg-red-600 text-white border-red-600' : 'bg-background text-foreground hover:bg-muted'}`}
                >
                  {r}
                </button>
              ))}
            </div>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Or type a custom reason…"
              rows={2}
              data-testid="vendor-reject-reason-input"
              className="w-full text-sm rounded-md border px-3 py-2 bg-background"
            />
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setRejectFor(null); setRejectReason(''); }}
                data-testid="vendor-reject-cancel-btn"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={submitReject}
                disabled={rejecting}
                data-testid="vendor-reject-confirm-btn"
              >
                {rejecting ? 'Declining…' : 'Decline order'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
=======
>>>>>>> cb805eb
    </div>
  );
};

export default VendorDashboard;
