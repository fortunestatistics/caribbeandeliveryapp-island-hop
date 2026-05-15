import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { CreditCard, ShieldCheck, Loader2, CheckCircle2, XCircle, ArrowLeft, Heart, Tag, X, Wallet } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const authHeaders = () => {
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const CheckoutPage = () => {
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
  const [walletBalance, setWalletBalance] = useState(null); // USD number or null
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
    // Try to fetch wallet balance for "Pay with wallet" UX
    axios.get(`${API}/wallet`, { headers: authHeaders() })
      .then((r) => setWalletBalance(Number(r.data?.balances?.USD || 0)))
      .catch(() => setWalletBalance(null));
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

  const handlePay = async () => {
    setCreating(true);
    setError('');
    try {
      const res = await axios.post(
        `${API}/payments/checkout/session`,
        { order_id: orderId, origin_url: window.location.origin },
        { headers: authHeaders() }
      );
      window.location.href = res.data.url;
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to start checkout');
      setCreating(false);
    }
  };

  const handlePayWithWallet = async () => {
    setCreating(true);
    setError('');
    try {
      await axios.post(`${API}/wallet/pay-order`, { order_id: orderId }, { headers: authHeaders() });
      navigate(`/payment/success?order_id=${orderId}&via=wallet`);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to pay from wallet');
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
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
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6"
          data-testid="checkout-back-btn"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Complete payment</span>
              <Badge className={isPaid ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}>
                {isPaid ? 'Paid' : 'Pending'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Tip selector */}
            {!isPaid && (
              <div className="border border-teal-100 bg-teal-50/40 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-semibold text-sm flex items-center gap-1.5">
                      <Heart className="h-4 w-4 text-rose-500 fill-rose-500" />
                      Tip your driver
                    </p>
                    <p className="text-xs text-gray-500">100% of tips go directly to your driver</p>
                  </div>
                  {tipSaving && <Loader2 className="h-4 w-4 animate-spin text-teal-600" />}
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
                          ? 'bg-teal-600 text-white border-teal-600'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-teal-300'
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
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-teal-300'
                    }`}
                    data-testid="tip-chip-custom"
                  >
                    Custom
                  </button>
                </div>
                {selectedTip === 'custom' && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-sm text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="500"
                      value={customTip}
                      onChange={(e) => setCustomTip(e.target.value)}
                      onBlur={handleCustomTipBlur}
                      placeholder="0.00"
                      className="flex-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      data-testid="tip-custom-input"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-600">Order ID</span><span className="font-mono text-xs" data-testid="checkout-order-id">{order.id}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Service</span><span className="capitalize">{order.service_type}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span>${(order.subtotal || 0).toFixed(2)}</span></div>
              {order.delivery_fee != null && (
                <div className="flex justify-between"><span className="text-gray-600">Delivery fee</span><span>${(order.delivery_fee || 0).toFixed(2)}</span></div>
              )}
              {order.tax != null && order.tax > 0 && (
                <div className="flex justify-between"><span className="text-gray-600">Tax</span><span>${(order.tax || 0).toFixed(2)}</span></div>
              )}
              {(order.tip || 0) > 0 && (
                <div className="flex justify-between text-teal-700"><span>Driver tip</span><span data-testid="checkout-tip">+${(order.tip || 0).toFixed(2)}</span></div>
              )}
              {(order.discount || 0) > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Discount {order.promo_code && <span className="text-xs">({order.promo_code})</span>}</span>
                  <span data-testid="checkout-discount">−${(order.discount || 0).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-2 mt-2 font-semibold">
                <span>Total</span>
                <span data-testid="checkout-total">${(order.total || 0).toFixed(2)}</span>
              </div>
            </div>

            {/* Promo code */}
            {!isPaid && (
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-1.5 mb-2 text-sm font-semibold">
                  <Tag className="h-4 w-4 text-teal-600" />
                  Promo code
                </div>
                {order.promo_code ? (
                  <div className="flex items-center justify-between bg-rose-50 border border-rose-100 rounded-md px-3 py-2">
                    <div className="text-sm">
                      <span className="font-mono font-semibold text-rose-700" data-testid="checkout-applied-promo">{order.promo_code}</span>
                      <span className="text-rose-600 ml-2">−${(order.discount || 0).toFixed(2)} applied</span>
                    </div>
                    <button
                      type="button"
                      onClick={removePromo}
                      disabled={promoSaving}
                      className="text-gray-500 hover:text-rose-700 disabled:opacity-50"
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
                      className="flex-1 px-3 py-2 border rounded-md text-sm uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-teal-500"
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
            <div className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <ShieldCheck className="h-4 w-4 text-green-600" />
                Powered by Stripe
              </div>
              <div className="flex items-center gap-2" aria-label="Accepted payment methods" data-testid="checkout-accepted-methods">
                {/* Visa */}
                <svg width="34" height="22" viewBox="0 0 34 22" className="rounded-sm border border-gray-200 bg-white" aria-label="Visa">
                  <rect width="34" height="22" rx="3" fill="#fff"/>
                  <text x="17" y="15" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="9" fill="#1A1F71" letterSpacing="0.5">VISA</text>
                </svg>
                {/* Mastercard */}
                <svg width="34" height="22" viewBox="0 0 34 22" className="rounded-sm border border-gray-200 bg-white" aria-label="Mastercard">
                  <rect width="34" height="22" rx="3" fill="#fff"/>
                  <circle cx="14" cy="11" r="6" fill="#EB001B"/>
                  <circle cx="20" cy="11" r="6" fill="#F79E1B" fillOpacity="0.9"/>
                </svg>
                {/* Amex */}
                <svg width="34" height="22" viewBox="0 0 34 22" className="rounded-sm border border-gray-200" aria-label="American Express">
                  <rect width="34" height="22" rx="3" fill="#2E77BC"/>
                  <text x="17" y="15" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="7" fill="#fff" letterSpacing="0.3">AMEX</text>
                </svg>
                {/* Apple Pay */}
                <svg width="42" height="22" viewBox="0 0 42 22" className="rounded-sm border border-gray-200 bg-black" aria-label="Apple Pay" data-testid="apple-pay-badge">
                  <rect width="42" height="22" rx="3" fill="#000"/>
                  <text x="6.5" y="15.5" fontFamily="-apple-system, Helvetica, Arial, sans-serif" fontWeight="600" fontSize="10" fill="#fff"></text>
                  <text x="14" y="15.5" fontFamily="-apple-system, Helvetica, Arial, sans-serif" fontWeight="500" fontSize="9" fill="#fff">Pay</text>
                </svg>
                {/* Google Pay */}
                <svg width="42" height="22" viewBox="0 0 42 22" className="rounded-sm border border-gray-200 bg-white" aria-label="Google Pay">
                  <rect width="42" height="22" rx="3" fill="#fff"/>
                  <text x="3" y="15" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="8" fill="#4285F4">G</text>
                  <text x="8" y="15" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="8" fill="#EA4335">o</text>
                  <text x="13" y="15" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="8" fill="#FBBC05">o</text>
                  <text x="18" y="15" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="8" fill="#4285F4">g</text>
                  <text x="23" y="15" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="8" fill="#34A853">l</text>
                  <text x="26" y="15" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="8" fill="#EA4335">e</text>
                  <text x="32" y="15" fontFamily="Arial, sans-serif" fontWeight="500" fontSize="8" fill="#5F6368">Pay</text>
                </svg>
              </div>
            </div>
            <p className="text-xs text-gray-400 -mt-3">
              Apple Pay & Google Pay appear automatically on supported devices (Safari/iOS, Chrome/Android).
            </p>

            {error && <div className="text-sm text-red-600" data-testid="checkout-error">{error}</div>}

            <Button
              onClick={handlePay}
              disabled={creating || isPaid || tipSaving}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white"
              data-testid="checkout-pay-btn"
            >
              {creating ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Redirecting to Stripe…</>
              ) : isPaid ? (
                <><CheckCircle2 className="h-4 w-4 mr-2" /> Already paid</>
              ) : (
                <><CreditCard className="h-4 w-4 mr-2" /> Pay ${(order.total || 0).toFixed(2)}</>
              )}
            </Button>

            {!isPaid && walletBalance !== null && (
              <Button
                onClick={handlePayWithWallet}
                disabled={creating || tipSaving || walletBalance < (order.total || 0)}
                variant="outline"
                className="w-full border-teal-300 text-teal-700 hover:bg-teal-50"
                data-testid="checkout-pay-wallet-btn"
              >
                <Wallet className="h-4 w-4 mr-2" />
                {walletBalance < (order.total || 0)
                  ? `Wallet balance: $${walletBalance.toFixed(2)} (insufficient)`
                  : `Pay with wallet (balance: $${walletBalance.toFixed(2)})`}
              </Button>
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
  const [status, setStatus] = useState('checking'); // checking | paid | pending | failed
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
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
  }, [sessionId]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-teal-50 to-blue-50">
      <Card className="max-w-md w-full">
        <CardContent className="p-10 text-center">
          {status === 'checking' && (
            <>
              <Loader2 className="h-14 w-14 text-teal-600 mx-auto mb-4 animate-spin" />
              <h2 className="text-2xl font-semibold mb-2">Confirming your payment…</h2>
              <p className="text-sm text-gray-600">Polling Stripe ({attempts + 1}/8)</p>
            </>
          )}
          {status === 'paid' && (
            <>
              <CheckCircle2 className="h-14 w-14 text-green-600 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold mb-2" data-testid="payment-success-title">Payment successful!</h2>
              <p className="text-sm text-gray-600 mb-6">Your order is confirmed and being prepared.</p>
              <div className="flex gap-3">
                <Button onClick={() => navigate(`/order/${orderId}`)} className="flex-1 bg-teal-600 hover:bg-teal-700 text-white" data-testid="payment-success-track-btn">
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
              <p className="text-sm text-gray-600 mb-6">We'll email you when payment is confirmed.</p>
              <Button onClick={() => navigate('/')} data-testid="payment-pending-home-btn">Continue</Button>
            </>
          )}
          {status === 'failed' && (
            <>
              <XCircle className="h-14 w-14 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold mb-2">Payment not confirmed</h2>
              <p className="text-sm text-gray-600 mb-6">Please try again or contact support.</p>
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
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <Card className="max-w-md w-full">
        <CardContent className="p-10 text-center">
          <XCircle className="h-14 w-14 text-amber-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-2" data-testid="payment-cancel-title">Payment cancelled</h2>
          <p className="text-sm text-gray-600 mb-6">No charge was made. You can resume checkout anytime.</p>
          <div className="flex gap-3">
            <Button onClick={() => navigate(`/checkout/${orderId}`)} className="flex-1 bg-teal-600 hover:bg-teal-700 text-white" data-testid="payment-cancel-resume-btn">
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
