import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card, CardContent } from './components/ui/card';
import { Button } from './components/ui/button';
import { Star, X, Loader2, CheckCircle2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const authHeaders = () => {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
};

const StarPicker = ({ value, onChange, testIdPrefix }) => (
  <div className="flex items-center gap-1">
    {[1, 2, 3, 4, 5].map((n) => (
      <button
        key={n}
        type="button"
        onClick={() => onChange(n)}
        className="transition-transform hover:scale-110"
        aria-label={`${n} star${n > 1 ? 's' : ''}`}
        data-testid={`${testIdPrefix}-star-${n}`}
      >
        <Star
          className={`h-8 w-8 ${n <= value ? 'fill-gold-300 text-gold-300' : 'text-muted-foreground/40'}`}
        />
      </button>
    ))}
  </div>
);

/**
 * Modal review form shown after delivery. Lets the customer rate the driver
 * and merchant separately with stars + a short text review.
 *
 * Props:
 *   orderId        — required, the order being rated
 *   showDriver     — show driver section (default true if order has driver_id)
 *   showVendor     — show vendor section (default true)
 *   onClose        — called on close
 *   onSubmitted    — called after a successful submit
 */
const ReviewForm = ({ orderId, showDriver = true, showVendor = true, onClose, onSubmitted }) => {
  const [existing, setExisting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [driverRating, setDriverRating] = useState(0);
  const [punctuality, setPunctuality] = useState(0);
  const [professionalism, setProfessionalism] = useState(0);
  const [care, setCare] = useState(0);
  const [communication, setCommunication] = useState(0);
  const [vendorRating, setVendorRating] = useState(0);
  const [driverReview, setDriverReview] = useState('');
  const [vendorReview, setVendorReview] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get(`${API}/orders/${orderId}/rating`, { headers: authHeaders() })
      .then((r) => setExisting(r.data?.rating || null))
      .catch(() => setExisting(null))
      .finally(() => setLoading(false));
  }, [orderId]);

  const submit = async () => {
<<<<<<< HEAD
    const hasRating = (showDriver && driverRating > 0) || (showVendor && vendorRating > 0);
    if (!hasRating) {
=======
    if (showDriver && driverRating === 0 && showVendor && vendorRating === 0) {
>>>>>>> cb805eb
      setError('Please rate at least one of: driver or merchant');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const body = { order_id: orderId };
      if (showDriver && driverRating > 0) {
        body.driver_rating = driverRating;
        if (punctuality) body.delivery_speed = punctuality;
        if (professionalism) body.driver_professionalism = professionalism;
        if (care) body.driver_care = care;
        if (communication) body.driver_communication = communication;
        if (driverReview.trim()) body.driver_review = driverReview.trim();
      }
      if (showVendor && vendorRating > 0) {
        body.vendor_rating = vendorRating;
        if (vendorReview.trim()) body.vendor_review = vendorReview.trim();
      }
      await axios.post(`${API}/ratings`, body, { headers: authHeaders() });
      if (onSubmitted) onSubmitted();
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to submit review');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold-300" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <Card
        className="max-w-md w-full bg-matte-800 border border-gold-500/30 shadow-gold-glow"
        onClick={(e) => e.stopPropagation()}
      >
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-xl font-bold text-foreground">Rate your experience</h3>
            <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>

          {existing ? (
            <div className="text-center py-6 space-y-3">
              <CheckCircle2 className="h-12 w-12 text-gold-300 mx-auto" />
              <p className="text-foreground font-semibold">You&apos;ve already reviewed this order</p>
              {existing.driver_rating && <p className="text-sm text-muted-foreground">Driver: {existing.driver_rating}★</p>}
              {existing.vendor_rating && <p className="text-sm text-muted-foreground">Merchant: {existing.vendor_rating}★</p>}
              <Button onClick={onClose} className="mt-2" data-testid="review-existing-close">Close</Button>
            </div>
          ) : (
            <>
              {showDriver && (
                <div>
                  <p className="text-sm font-semibold text-foreground mb-2">Your driver — overall</p>
                  <StarPicker value={driverRating} onChange={setDriverRating} testIdPrefix="review-driver" />

                  <div className="mt-3 space-y-2">
                    {[
                      { label: 'Punctuality / Speed', value: punctuality, set: setPunctuality, prefix: 'review-punctuality' },
                      { label: 'Professionalism & Courtesy', value: professionalism, set: setProfessionalism, prefix: 'review-professionalism' },
                      { label: 'Care of Items', value: care, set: setCare, prefix: 'review-care' },
                      { label: 'Communication', value: communication, set: setCommunication, prefix: 'review-communication' },
                    ].map((row) => (
                      <div key={row.prefix} className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">{row.label}</span>
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => row.set(n)}
                              aria-label={`${row.label} ${n} star`}
                              data-testid={`${row.prefix}-star-${n}`}
                            >
                              <Star className={`h-5 w-5 ${n <= row.value ? 'fill-gold-300 text-gold-300' : 'text-muted-foreground/40'}`} />
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <textarea
                    value={driverReview}
                    onChange={(e) => setDriverReview(e.target.value.slice(0, 400))}
                    placeholder="Anything to share about your driver?"
                    rows={2}
                    className="mt-3 w-full px-3 py-2 bg-matte-900 border border-border rounded-md text-sm text-foreground placeholder-muted-foreground/60 focus:outline-none focus:border-gold-500"
                    data-testid="review-driver-text"
                  />
                </div>
              )}

              {showVendor && (
                <div>
                  <p className="text-sm font-semibold text-foreground mb-2">The merchant</p>
                  <StarPicker value={vendorRating} onChange={setVendorRating} testIdPrefix="review-vendor" />
                  <textarea
                    value={vendorReview}
                    onChange={(e) => setVendorReview(e.target.value.slice(0, 400))}
                    placeholder="How was the food / product / service?"
                    rows={2}
                    className="mt-2 w-full px-3 py-2 bg-matte-900 border border-border rounded-md text-sm text-foreground placeholder-muted-foreground/60 focus:outline-none focus:border-gold-500"
                    data-testid="review-vendor-text"
                  />
                </div>
              )}

              {error && <p className="text-xs text-red-400" data-testid="review-error">{error}</p>}

              <div className="bg-gold-500/10 border border-gold-500/20 rounded-md px-3 py-2 text-xs text-gold-700">
                ⭐ Drivers earn a $1.00 wallet bonus for every 5-star review.
              </div>

              <Button onClick={submit} disabled={submitting} className="w-full" data-testid="review-submit-btn">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit review'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ReviewForm;
