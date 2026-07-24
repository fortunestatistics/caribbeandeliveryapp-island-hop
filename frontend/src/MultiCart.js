import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Badge } from './components/ui/badge';
import { useCart } from './CartContext';
import { useCurrency } from './CurrencyContext';
import { createOrder, fetchProfile, isLoggedIn, formatProfileAddress } from './orderApi';
import {
  ShoppingCart, Plus, Minus, Trash2, Store, ArrowLeft, Loader2,
  Banknote, CreditCard, Wallet, ShieldCheck, CheckCircle2, XCircle,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const authHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Header cart icon with live item-count badge.
export const CartButton = () => {
  const navigate = useNavigate();
  const { totalCount } = useCart();
  return (
    <button
      type="button"
      onClick={() => navigate('/cart')}
      className="relative p-2 rounded-lg hover:bg-muted transition-colors"
      aria-label="Cart"
      data-testid="header-cart-btn"
    >
      <ShoppingCart className="h-5 w-5 text-foreground/90" />
      {totalCount > 0 && (
        <span
          className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-gold-gradient text-white text-[10px] font-bold flex items-center justify-center"
          data-testid="header-cart-count"
        >
          {totalCount}
        </span>
      )}
    </button>
  );
};

// ---------- /cart : multi-store basket ----------
export const MultiCartPage = () => {
  const navigate = useNavigate();
  const { format } = useCurrency();
  const { vendors, setQty, removeItem, clearVendor, totalCount, grandSubtotal } = useCart();
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isLoggedIn()) return;
    fetchProfile().then((p) => {
      setPhone(p.phone || '');
      const addr = formatProfileAddress(p.address);
      if (addr) setDeliveryAddress(addr);
    });
  }, []);

  const placeAll = async () => {
    if (!isLoggedIn()) { navigate('/login'); return; }
    const addr = (deliveryAddress || '').trim();
    if (!addr) { setError('Please enter a delivery address to continue.'); return; }
    setPlacing(true);
    setError('');
    const groupId = `grp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    try {
      const createdIds = [];
      for (const g of vendors) {
        const subtotal = g.items.reduce((s, i) => s + i.price * i.quantity, 0);
        const order = await createOrder({
          customer_id: 'x',
          service_type: g.service_type || 'food',
          restaurant_id: g.vendor_id,
          items: g.items.map((i) => ({ menu_item_id: String(i.id), name: i.name, quantity: i.quantity, price: i.price })),
          subtotal,
          delivery_fee: Number(g.delivery_fee) || 0,
          tip: 0,
          total: subtotal + (Number(g.delivery_fee) || 0),
          pickup_address: { location: g.vendor_name || 'Store', full_address: g.address || '' },
          delivery_address: { location: addr, full_address: addr },
          customer_phone: phone || '',
          payment_method: 'pending',
          notes: '',
          cart_group_id: groupId,
        });
        createdIds.push(order.id);
      }
      navigate('/checkout-group', { state: { orderIds: createdIds } });
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create your orders. Please try again.');
      setPlacing(false);
    }
  };

  if (totalCount === 0) {
    return (
      <div className="min-h-screen bg-background py-12 px-4">
        <div className="max-w-2xl mx-auto text-center" data-testid="cart-empty">
          <ShoppingCart className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Your cart is empty</h1>
          <p className="text-muted-foreground mb-6">Add items from any store and check out all at once.</p>
          <Button onClick={() => navigate('/businesses')} className="bg-gold-gradient text-white" data-testid="cart-browse-btn">
            Browse businesses
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6" data-testid="cart-back-btn">
          <ArrowLeft className="h-4 w-4" /> Continue shopping
        </button>
        <h1 className="text-3xl font-bold text-foreground mb-1">Your cart</h1>
        <p className="text-muted-foreground mb-6">{totalCount} item{totalCount === 1 ? '' : 's'} from {vendors.length} store{vendors.length === 1 ? '' : 's'}</p>

        <div className="space-y-5">
          {vendors.map((g) => {
            const subtotal = g.items.reduce((s, i) => s + i.price * i.quantity, 0);
            return (
              <Card key={g.vendor_id} data-testid={`cart-store-${g.vendor_id}`}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-lg">
                    <span className="flex items-center gap-2">
                      <Store className="h-5 w-5 text-gold-500" /> {g.vendor_name || 'Store'}
                    </span>
                    <button onClick={() => clearVendor(g.vendor_id)} className="text-xs text-muted-foreground hover:text-red-600" data-testid={`cart-clear-store-${g.vendor_id}`}>
                      Remove store
                    </button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {g.items.map((i) => (
                    <div key={i.id} className="flex items-center justify-between gap-3" data-testid={`cart-item-${i.id}`}>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{i.name}</p>
                        <p className="text-sm text-muted-foreground">{format(i.price)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setQty(g.vendor_id, i.id, i.quantity - 1)} data-testid={`cart-dec-${i.id}`}>
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <span className="w-6 text-center text-sm font-medium" data-testid={`cart-qty-${i.id}`}>{i.quantity}</span>
                        <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setQty(g.vendor_id, i.id, i.quantity + 1)} data-testid={`cart-inc-${i.id}`}>
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-red-600" onClick={() => removeItem(g.vendor_id, i.id)} data-testid={`cart-remove-${i.id}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between border-t pt-2 text-sm">
                    <span className="text-muted-foreground">Store subtotal</span>
                    <span className="font-semibold" data-testid={`cart-store-subtotal-${g.vendor_id}`}>{format(subtotal)}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="mt-6">
          <CardContent className="p-5 space-y-4">
            <div>
              <label className="text-sm font-medium">Delivery address (shared for all stores)</label>
              <Input value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="Enter your delivery address" data-testid="cart-address-input" className="mt-1" />
            </div>
            <div className="flex justify-between items-center border-t pt-3">
              <span className="text-muted-foreground">Items subtotal</span>
              <span className="text-xl font-bold text-gold-500" data-testid="cart-grand-subtotal">{format(grandSubtotal)}</span>
            </div>
            <p className="text-xs text-muted-foreground">Delivery fees, service fee and any tax are added at payment. You'll pay once for everything.</p>
            {error && <div className="text-sm text-red-600" data-testid="cart-error">{error}</div>}
            <Button onClick={placeAll} disabled={placing} className="w-full bg-gold-gradient text-white text-base py-6" data-testid="cart-checkout-btn">
              {placing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Preparing your orders…</> : 'Continue to payment'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// ---------- /checkout-group : one combined payment for all orders ----------
export const MultiCheckoutPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { format } = useCurrency();
  const { clear } = useCart();
  const orderIds = location.state?.orderIds || [];
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orderIds.length) { setLoading(false); return; }
    const load = async () => {
      try {
        const results = await Promise.all(
          orderIds.map((id) => axios.get(`${API}/orders/${id}`, { headers: authHeaders() }).then((r) => r.data).catch(() => null))
        );
        setOrders(results.filter(Boolean));
      } finally {
        setLoading(false);
      }
      try {
        const w = await axios.get(`${API}/wallet`, { headers: authHeaders() });
        setWalletBalance(Number(w.data?.balances?.USD || 0));
      } catch (_) { setWalletBalance(null); }
    };
    load();
    // eslint-disable-next-line
  }, []);

  const grandTotal = orders.reduce((s, o) => s + Number(o.total || 0), 0);

  const payCOD = async () => {
    setBusy(true); setError('');
    try {
      await axios.post(`${API}/orders/confirm-cod-multi`, { order_ids: orderIds }, { headers: authHeaders() });
      clear();
      navigate(`/payment/success?via=cod&order_id=${orderIds[0]}`);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to place orders');
      setBusy(false);
    }
  };

  const payCard = async () => {
    setBusy(true); setError('');
    try {
      const res = await axios.post(`${API}/payments/checkout/session-multi`, { order_ids: orderIds, origin_url: window.location.origin }, { headers: authHeaders() });
      clear();
      window.location.href = res.data.url;
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to start card checkout');
      setBusy(false);
    }
  };

  const payWallet = async () => {
    setBusy(true); setError('');
    try {
      for (const id of orderIds) {
        await axios.post(`${API}/wallet/pay-order`, { order_id: id }, { headers: authHeaders() });
      }
      clear();
      navigate(`/payment/success?via=wallet&order_id=${orderIds[0]}`);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Wallet payment failed');
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gold-500" /></div>;
  }
  if (!orderIds.length || !orders.length) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full"><CardContent className="p-8 text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
          <p className="text-lg font-semibold mb-4">No orders to pay for</p>
          <Button onClick={() => navigate('/businesses')} data-testid="group-empty-browse">Browse businesses</Button>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-1">Complete payment</h1>
        <p className="text-muted-foreground mb-6">Paying for {orders.length} order{orders.length === 1 ? '' : 's'} from your cart, all at once.</p>

        <Card className="mb-6">
          <CardContent className="p-5 space-y-3">
            {orders.map((o) => (
              <div key={o.id} className="flex justify-between text-sm" data-testid={`group-order-${o.id}`}>
                <span className="text-muted-foreground">Order #{o.id?.substring(0, 8)} · {o.service_type}</span>
                <span className="font-medium">{format(o.total || 0)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t pt-3 font-semibold">
              <span>Grand total</span>
              <span className="text-xl text-gold-500" data-testid="group-grand-total">{format(grandTotal)}</span>
            </div>
          </CardContent>
        </Card>

        <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-2 text-xs text-muted-foreground mb-4" data-testid="group-accepted-methods">
          <ShieldCheck className="h-4 w-4 text-green-600" /> Cash on Delivery &amp; secure card checkout (Stripe). Each store is paid out separately.
        </div>

        {error && <div className="text-sm text-red-600 mb-3" data-testid="group-error">{error}</div>}

        <Button onClick={payCOD} disabled={busy} className="w-full bg-gold-gradient text-white text-base py-6 mb-3" data-testid="group-cod-btn">
          {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Placing orders…</> : <><Banknote className="h-5 w-5 mr-2" /> Place all orders · Cash on Delivery</>}
        </Button>

        <div className="pt-2 border-t border-border space-y-3">
          <p className="text-xs text-muted-foreground text-center">Prefer to pay now? (optional)</p>
          {walletBalance != null && (
            <>
              <Button onClick={payWallet} disabled={busy || walletBalance < grandTotal} variant="outline" className="w-full" data-testid="group-wallet-btn">
                <Wallet className="h-4 w-4 mr-2" /> Pay with IslandHop Wallet (Balance: {format(walletBalance)})
              </Button>
              {walletBalance < grandTotal && (
                <p className="text-xs text-muted-foreground text-center -mt-1" data-testid="group-wallet-insufficient">
                  Wallet balance too low. <button type="button" onClick={() => navigate('/dashboard')} className="text-gold-600 underline">Add funds</button>
                </p>
              )}
            </>
          )}
          <Button onClick={payCard} disabled={busy} variant="outline" className="w-full" data-testid="group-card-btn">
            <CreditCard className="h-4 w-4 mr-2" /> Pay with Card (Stripe)
          </Button>
        </div>
      </div>
    </div>
  );
};
