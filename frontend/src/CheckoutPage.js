import React, { useState, useEffect } from 'react';
import { useCurrency } from './CurrencyContext';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import CurrencyConverter from './CurrencyConverter';
import { CreditCard, ShieldCheck, Loader2, CheckCircle2, XCircle, ArrowLeft, Heart, Tag, X, Banknote } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const CheckoutPage = () => {
  const { format } = useCurrency();
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [tipSaving, setTipSaving] = useState(false);
  const [selectedTip, setSelectedTip] = useState(null); // 0 | 2 | 3 | 5 | 'custom'
  const [customTip, setCustomTip] = useState('');
  const [promoInput, setPromoInput] = useState('');
  const [promoSaving, setPromoSaving] = useState(false);
  const [promoFeedback, setPromoFeedback] = useState(null); // {type: 'success'|'error', text}
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get(`${API}/orders/${orderId}`, { headers: authHeaders() });
        setOrder(res.data);
        const currentTip = Number(res.data?.tip || 0);
        if ([0, 2, 3, 5].includes(currentTip)) setSelectedTip(currentTip);
        else if (currentTip > 0) { setSelectedTip('custom'); setCustomTip(String(currentTip)); }
        else setSelectedTip(0);
      } catch (e) {
        setError(e?.response?.data?.detail || 'Order not found');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [orderId]);

  const applyTip = async (tipValue) => {
    if (order?.payment_status === 'paid') return;
    setTipSaving(true);
    setError('');
    try {
      const res = await axios.put(
        `${API}/orders/${orderId}/tip`,
        { tip: Number(tipValue) || 0 },
        { headers: authHeaders() }
      );
      setOrder(res.data);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to update tip');
    } finally {
      setTipSaving(false);
    }
  };

  const handleTipChip = (val) => {
    setSelectedTip(val);
    setCustomTip('');
    applyTip(val);
  };

  const handleCustomTipBlur = () => {
    const v = parseFloat(customTip);
    if (!isNaN(v) && v >= 0) applyTip(v);
  };

  const applyPromo = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    setPromoSaving(true);
    setPromoFeedback(null);
    try {
      const res = await axios.post(
        `${API}/orders/${orderId}/apply-promo`,
        { code },
        { headers: authHeaders() }
      );
      // Refresh full order
      const fresh = await axios.get(`${API}/orders/${orderId}`, { headers: authHeaders() });
      setOrder(fresh.data);
      setPromoFeedback({ type: 'success', text: res.data.message });
      setPromoInput('');
    } catch (e) {
      setPromoFeedback({ type: 'error', text: e?.response?.data?.detail || 'Could not apply code' });
    } finally {
      setPromoSaving(false);
    }
  };

  const removePromo = async () => {
    setPromoSaving(true);
    try {
      await axios.delete(`${API}/orders/${orderId}/promo`, { headers: authHeaders() });
      const fresh = await axios.get(`${API}/orders/${orderId}`, { headers: authHeaders() });
      setOrder(fresh.data);
      setPromoFeedback(null);
    } catch (e) {
      setPromoFeedback({ type: 'error', text: e?.response?.data?.detail || 'Could not remove code' });
    } finally {
      setPromoSaving(false);
    }
  };

  const handleWiPay = async () => {
    setCreating(true);
    setError('');
    try {
      const res = await axios.post(
        `${API}/payments/wipay/checkout/session`,
        { order_id: orderId, origin_url: window.location.origin },
        { headers: authHeaders() }
      );
      window.location.href = res.data.url;
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to start WiPay checkout');
      setCreating(false);
    }
  };

  const handleCOD = async () => {
    setCreating(true);
    setError('');
    try {
      await axios.post(`${API}/orders/${orderId}/confirm-cod`, {}, { headers: authHeaders() });
      navigate(`/payment/success?order_id=${orderId}&via=cod`);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to place order');
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold-500" />
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
            <p className="text-lg font-semibold mb-2">{error}</p>
            <Button onClick={() => navigate('/')} data-testid="checkout-back-home">Back to home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isPaid = order?.payment_status === 'paid';
  const tipChips = [0, 2, 3, 5];

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
          data-testid="checkout-back-btn"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Complete payment</span>
              <Badge className={isPaid ? 'bg-green-100 text-green-800' : 'bg-gold-500/15 text-gold-700'}>
                {isPaid ? 'Paid' : 'Pending'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Tip selector */}
            {!isPaid && (
              <div className="border border-gold-500/20 bg-matte-800/40/40 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-semibold text-sm flex items-center gap-1.5">
                      <Heart className="h-4 w-4 text-rose-500 fill-rose-500" />
                      Tip your driver
                    </p>
                    <p className="text-xs text-muted-foreground">100% of tips go directly to your driver</p>
                  </div>
                  {tipSaving && <Loader2 className="h-4 w-4 animate-spin text-gold-500" />}
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {tipChips.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleTipChip(t)}
                      disabled={tipSaving}
                      className={`py-2 rounded-md text-sm font-medium transition-colors border ${
                        selectedTip === t
                          ? 'bg-gold-gradient text-white border-gold-500'
                          : 'bg-card text-foreground/90 border-border hover:border-gold-500/50'
                      } disabled:opacity-50`}
                      data-testid={`tip-chip-${t}`}
                    >
                      ${t}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSelectedTip('custom')}
                    className={`py-2 rounded-md text-sm font-medium transition-colors border ${
                      selectedTip === 'custom'
                        ? 'bg-gold-gradient text-white border-gold-500'
                        : 'bg-card text-foreground/90 border-border hover:border-gold-500/50'
                    }`}
                    data-testid="tip-chip-custom"
                  >
                    Custom
                  </button>
                </div>
                {selectedTip === 'custom' && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="500"
                      value={customTip}
                      onChange={(e) => setCustomTip(e.target.value)}
                      onBlur={handleCustomTipBlur}
                      placeholder="0.00"
                      className="flex-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
                      data-testid="tip-custom-input"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="bg-background rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Order ID</span><span className="font-mono text-xs" data-testid="checkout-order-id">{order.id}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Service</span><span className="capitalize">{order.service_type}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{format(order.subtotal || 0)}</span></div>
              {order.delivery_fee != null && (
                <div className="flex justify-between"><span className="text-muted-foreground">Delivery fee</span><span>{format(order.delivery_fee || 0)}</span></div>
              )}
              {(order.service_fee || 0) > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">Service fee</span><span data-testid="checkout-service-fee">{format(order.service_fee || 0)}</span></div>
              )}
              {order.tax != null && order.tax > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{format(order.tax || 0)}</span></div>
              )}
              {(order.tip || 0) > 0 && (
                <div className="flex justify-between text-gold-300"><span>Driver tip</span><span data-testid="checkout-tip">+{format(order.tip || 0)}</span></div>
              )}
              {(order.discount || 0) > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Discount {order.promo_code && <span className="text-xs">({order.promo_code})</span>}</span>
                  <span data-testid="checkout-discount">−{format(order.discount || 0)}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-2 mt-2 font-semibold items-center gap-3 flex-wrap">
                <span>Total</span>
                <CurrencyConverter amountUSD={Number(order.total || 0)} size="md" />
              </div>
            </div>

            {/* Promo code */}
            {!isPaid && (
              <div className="border border-border rounded-lg p-4">
                <div className="flex items-center gap-1.5 mb-2 text-sm font-semibold">
                  <Tag className="h-4 w-4 text-gold-500" />
                  Promo code
                </div>
                {order.promo_code ? (
                  <div className="flex items-center justify-between bg-rose-50 border border-rose-100 rounded-md px-3 py-2">
                    <div className="text-sm">
                      <span className="font-mono font-semibold text-rose-700" data-testid="checkout-applied-promo">{order.promo_code}</span>
                      <span className="text-rose-600 ml-2">−{format(order.discount || 0)} applied</span>
                    </div>
                    <button
                      type="button"
                      onClick={removePromo}
                      disabled={promoSaving}
                      className="text-muted-foreground hover:text-rose-700 disabled:opacity-50"
                      data-testid="checkout-remove-promo"
                      aria-label="Remove promo code"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={promoInput}
                      onChange={(e) => { setPromoInput(e.target.value); setPromoFeedback(null); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyPromo(); } }}
                      placeholder="Enter code"
                      className="flex-1 px-3 py-2 border rounded-md text-sm uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-gold-500"
                      data-testid="checkout-promo-input"
                    />
                    <Button
                      type="button"
                      onClick={applyPromo}
                      disabled={promoSaving || !promoInput.trim()}
                      variant="outline"
                      data-testid="checkout-apply-promo-btn"
                    >
                      {promoSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
                    </Button>
                  </div>
                )}
                {promoFeedback && (
                  <p
                    className={`text-xs mt-2 ${promoFeedback.type === 'success' ? 'text-green-700' : 'text-red-600'}`}
                    data-testid="checkout-promo-feedback"
                  >
                    {promoFeedback.text}
                  </p>
                )}
              </div>
            )}

            {/* Accepted payment methods */}
            <div className="bg-card border border-border rounded-lg p-3 flex items-center justify-between" data-testid="checkout-accepted-methods">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-green-600" />
                Cash on Delivery &amp; secure WiPay checkout
              </div>
            </div>

            {error && <div className="text-sm text-red-600" data-testid="checkout-error">{error}</div>}

            {/* Primary: Cash on Delivery / Pay Later */}
            <Button
              onClick={handleCOD}
              disabled={creating || isPaid || tipSaving}
              className="w-full bg-gold-gradient hover:bg-gold-gradient-hover text-white text-base py-6"
              data-testid="checkout-cod-btn"
            >
              {creating ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Placing order…</>
              ) : isPaid ? (
                <><CheckCircle2 className="h-4 w-4 mr-2" /> Already paid</>
              ) : (
                <><Banknote className="h-5 w-5 mr-2" /> Place order · Cash on Delivery</>
              )}
            </Button>
            {!isPaid && (
              <p className="text-xs text-muted-foreground text-center -mt-2">
                Pay the driver in cash when your order arrives. No card needed.
              </p>
            )}

            {/* Secondary: pay online now (optional) */}
            {!isPaid && (
              <div className="pt-2 border-t border-border space-y-3">
                <p className="text-xs text-muted-foreground text-center">Prefer to pay online now? (optional)</p>
                <Button
                  onClick={handleWiPay}
                  disabled={creating || tipSaving}
                  variant="outline"
                  className="w-full"
                  data-testid="checkout-pay-wipay-btn"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Pay with WiPay (Caribbean cards · Sandbox)
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export const PaymentSuccess = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sessionId = params.get('session_id');
  const orderId = params.get('order_id');
  const via = params.get('via');
  const [status, setStatus] = useState('checking'); // checking | paid | pending | failed
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    // Cash on Delivery / Pay Later — already confirmed server-side, just show success.
    if (via === 'cod') {
      setStatus('cod');
      return;
    }
    // PayPal: on return, capture the approved order, then show result.
    if (via === 'paypal') {
      let cancelled = false;
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const ppOrderId = params.get('token'); // PayPal appends ?token={orderID}
      if (!ppOrderId) { setStatus('failed'); return; }
      axios.post(`${API}/payments/paypal/capture-order`, { order_id: ppOrderId }, { headers })
        .then((r) => { if (!cancelled) setStatus(r.data?.status === 'COMPLETED' ? 'paid' : 'failed'); })
        .catch(() => { if (!cancelled) setStatus('failed'); });
      return () => { cancelled = true; };
    }
    // WiPay: callback already settled the order server-side. Confirm by reading the order.
    if (via === 'wipay') {
      let cancelled = false;
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      axios.get(`${API}/orders/${orderId}`, { headers })
        .then((r) => { if (!cancelled) setStatus(r.data?.payment_status === 'paid' ? 'paid' : 'failed'); })
        .catch(() => { if (!cancelled) setStatus(params.get('status') === 'paid' ? 'paid' : 'failed'); });
      return () => { cancelled = true; };
    }
    if (!sessionId) {
      setStatus('failed');
      return;
    }
    let cancelled = false;
    const maxAttempts = 8;
    const poll = async (n) => {
      if (cancelled) return;
      try {
        const res = await axios.get(`${API}/payments/checkout/status/${sessionId}`);
        setAttempts(n);
        if (res.data.payment_status === 'paid') {
          setStatus('paid');
          return;
        }
        if (res.data.status === 'expired') {
          setStatus('failed');
          return;
        }
        if (n >= maxAttempts) {
          setStatus('pending');
          return;
        }
        setTimeout(() => poll(n + 1), 2000);
      } catch {
        if (n >= maxAttempts) {
          setStatus('failed');
        } else {
          setTimeout(() => poll(n + 1), 2000);
        }
      }
    };
    poll(0);
    return () => { cancelled = true; };
  }, [sessionId, via, orderId]);
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-teal-50 to-blue-50">
      <Card className="max-w-md w-full">
        <CardContent className="p-10 text-center">
          {status === 'checking' && (
            <>
              <Loader2 className="h-14 w-14 text-gold-500 mx-auto mb-4 animate-spin" />
              <h2 className="text-2xl font-semibold mb-2">Confirming your payment…</h2>
              <p className="text-sm text-muted-foreground">Polling Stripe ({attempts + 1}/8)</p>
            </>
          )}
          {status === 'cod' && (
            <>
              <CheckCircle2 className="h-14 w-14 text-green-600 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold mb-2" data-testid="payment-cod-title">Order placed!</h2>
              <p className="text-sm text-muted-foreground mb-6">Pay with cash when your order is delivered. We&apos;ll keep you updated on WhatsApp.</p>
              <div className="flex gap-3">
                <Button onClick={() => navigate(`/order/${orderId}`)} className="flex-1 bg-gold-gradient hover:bg-gold-gradient-hover text-white" data-testid="cod-track-btn">
                  Track order
                </Button>
                <Button variant="outline" onClick={() => navigate('/')} className="flex-1" data-testid="cod-home-btn">
                  Home
                </Button>
              </div>
            </>
          )}
          {status === 'paid' && (
            <>
              <CheckCircle2 className="h-14 w-14 text-green-600 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold mb-2" data-testid="payment-success-title">Payment successful!</h2>
              <p className="text-sm text-muted-foreground mb-6">Your order is confirmed and being prepared.</p>
              <div className="flex gap-3">
                <Button onClick={() => navigate(`/order/${orderId}`)} className="flex-1 bg-gold-gradient hover:bg-gold-gradient-hover text-white" data-testid="payment-success-track-btn">
                  Track order
                </Button>
                <Button variant="outline" onClick={() => navigate('/')} className="flex-1" data-testid="payment-success-home-btn">
                  Home
                </Button>
              </div>
            </>
          )}
          {status === 'pending' && (
            <>
              <Loader2 className="h-14 w-14 text-amber-500 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold mb-2">Still processing</h2>
              <p className="text-sm text-muted-foreground mb-6">We&apos;ll email you when payment is confirmed.</p>
              <Button onClick={() => navigate('/')} data-testid="payment-pending-home-btn">Continue</Button>
            </>
          )}
          {status === 'failed' && (
            <>
              <XCircle className="h-14 w-14 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold mb-2">Payment not confirmed</h2>
              <p className="text-sm text-muted-foreground mb-6">Please try again or contact support.</p>
              <Button onClick={() => navigate(`/checkout/${orderId}`)} data-testid="payment-failed-retry-btn">Try again</Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export const PaymentCancel = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const orderId = params.get('order_id');
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="max-w-md w-full">
        <CardContent className="p-10 text-center">
          <XCircle className="h-14 w-14 text-amber-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-2" data-testid="payment-cancel-title">Payment cancelled</h2>
          <p className="text-sm text-muted-foreground mb-6">No charge was made. You can resume checkout anytime.</p>
          <div className="flex gap-3">
            <Button onClick={() => navigate(`/checkout/${orderId}`)} className="flex-1 bg-gold-gradient hover:bg-gold-gradient-hover text-white" data-testid="payment-cancel-resume-btn">
              Resume checkout
            </Button>
            <Button variant="outline" onClick={() => navigate('/')} className="flex-1" data-testid="payment-cancel-home-btn">
              Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CheckoutPage;
