import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { CreditCard, ShieldCheck, Loader2, CheckCircle2, XCircle, ArrowLeft, Heart } from 'lucide-react';

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
              <div className="flex justify-between border-t pt-2 mt-2 font-semibold">
                <span>Total</span>
                <span data-testid="checkout-total">${(order.total || 0).toFixed(2)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-500">
              <ShieldCheck className="h-4 w-4 text-green-600" />
              Payments are securely processed by Stripe. We never store your card details.
            </div>

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
