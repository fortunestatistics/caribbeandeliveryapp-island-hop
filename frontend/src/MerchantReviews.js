import React, { useEffect, useState } from 'react';
import { Card, CardContent } from './components/ui/card';
import { Button } from './components/ui/button';
import { Textarea } from './components/ui/textarea';
import { Star, MessageSquare, Loader2, CornerDownRight } from 'lucide-react';
import { toast } from 'sonner';
import { reviewAPI } from './services/api';

const StarRow = ({ value, size = 'h-4 w-4' }) => (
  <div className="flex items-center">
    {[1, 2, 3, 4, 5].map((i) => (
      <Star
        key={i}
        className={`${size} ${i <= Math.round(value) ? 'text-gold-500 fill-current' : 'text-muted-foreground/30'}`}
      />
    ))}
  </div>
);

const StarPicker = ({ value, onChange }) => {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1" data-testid="review-star-picker">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(i)}
          aria-label={`${i} star`}
          data-testid={`review-star-${i}`}
          className="p-0.5"
        >
          <Star className={`h-7 w-7 transition-colors ${i <= (hover || value) ? 'text-gold-500 fill-current' : 'text-muted-foreground/30'}`} />
        </button>
      ))}
    </div>
  );
};

const initials = (name) => (name || '?').trim().charAt(0).toUpperCase();
const fmtDate = (iso) => {
  try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch (_e) { return ''; }
};

const ReplyForm = ({ merchantId, reviewId, onReplied }) => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const res = await reviewAPI.replyMerchantReview(merchantId, reviewId, text.trim());
      onReplied(res.data);
      setOpen(false); setText('');
      toast.success('Reply posted');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not post reply');
    } finally { setSaving(false); }
  };
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-gold-500 hover:text-gold-400 mt-2 flex items-center gap-1" data-testid={`reply-open-${reviewId}`}>
        <CornerDownRight className="h-3 w-3" /> Reply
      </button>
    );
  }
  return (
    <div className="mt-3 space-y-2">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a response…" rows={2} data-testid={`reply-input-${reviewId}`} />
      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={saving} data-testid={`reply-submit-${reviewId}`}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Post reply'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
};

const MerchantReviews = ({ merchantId }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ summary: { average: 0, count: 0, distribution: {} }, reviews: [], can_reply: false });
  const [myRating, setMyRating] = useState(0);
  const [myComment, setMyComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isLoggedIn = !!localStorage.getItem('token');

  const load = async () => {
    try {
      const res = await reviewAPI.getMerchantReviews(merchantId);
      setData(res.data);
    } catch (e) {
      console.error('Failed to load merchant reviews:', e);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [merchantId]);

  const submitReview = async () => {
    if (!myRating) { toast.error('Please select a star rating'); return; }
    setSubmitting(true);
    try {
      await reviewAPI.createMerchantReview(merchantId, { rating: myRating, comment: myComment });
      setMyRating(0); setMyComment('');
      toast.success('Thanks for your review!');
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not submit review');
    } finally { setSubmitting(false); }
  };

  const onReplied = (updated) => {
    setData((d) => ({ ...d, reviews: d.reviews.map((r) => (r.id === updated.id ? updated : r)) }));
  };

  const { summary, reviews, can_reply } = data;
  const total = summary.count || 0;

  return (
    <Card className="mt-8" data-testid="merchant-reviews-section">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <MessageSquare className="h-5 w-5 text-gold-500" />
          <h2 className="text-xl font-bold text-foreground">Reviews</h2>
        </div>

        {/* Summary */}
        <div className="flex flex-col sm:flex-row gap-8 pb-6 border-b">
          <div className="text-center sm:text-left">
            <div className="text-5xl font-bold text-foreground leading-none" data-testid="reviews-average">
              {Number(summary.average || 0).toFixed(1)}
            </div>
            <div className="mt-2"><StarRow value={summary.average || 0} size="h-5 w-5" /></div>
            <p className="text-sm text-muted-foreground mt-1" data-testid="reviews-count">{total} review{total === 1 ? '' : 's'}</p>
          </div>
          <div className="flex-1 space-y-1.5 max-w-md">
            {[5, 4, 3, 2, 1].map((s) => {
              const c = Number(summary.distribution?.[String(s)] || 0);
              const pct = total ? (c / total) * 100 : 0;
              return (
                <div key={s} className="flex items-center gap-2 text-xs">
                  <span className="w-3 text-muted-foreground">{s}</span>
                  <Star className="h-3 w-3 text-gold-500 fill-current" />
                  <div className="flex-1 h-2 rounded-full bg-matte-800 overflow-hidden">
                    <div className="h-full bg-gold-500" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-6 text-right text-muted-foreground">{c}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Write a review */}
        {isLoggedIn ? (
          <div className="py-6 border-b" data-testid="write-review-form">
            <p className="font-semibold text-foreground mb-3">Rate this merchant</p>
            <StarPicker value={myRating} onChange={setMyRating} />
            <Textarea
              className="mt-3"
              rows={3}
              placeholder="Share details of your experience…"
              value={myComment}
              onChange={(e) => setMyComment(e.target.value)}
              data-testid="review-comment-input"
            />
            <Button className="mt-3" onClick={submitReview} disabled={submitting} data-testid="submit-review-btn">
              {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Posting…</> : 'Post review'}
            </Button>
          </div>
        ) : (
          <div className="py-5 border-b text-sm text-muted-foreground">
            Please <a href="/login" className="text-gold-500 hover:underline">sign in</a> to write a review.
          </div>
        )}

        {/* Reviews list */}
        <div className="pt-6 space-y-6" data-testid="reviews-list">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 text-gold-500 animate-spin" /></div>
          ) : reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6" data-testid="reviews-empty">No reviews yet. Be the first to review!</p>
          ) : (
            reviews.map((r) => (
              <div key={r.id} className="flex gap-3" data-testid={`review-${r.id}`}>
                {r.customer_picture ? (
                  <img src={r.customer_picture} alt={r.customer_name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gold-gradient flex items-center justify-center text-white font-bold shrink-0">{initials(r.customer_name)}</div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground">{r.customer_name || 'Anonymous'}</span>
                    <span className="text-xs text-muted-foreground">{fmtDate(r.created_at)}</span>
                  </div>
                  <div className="mt-0.5"><StarRow value={r.rating} /></div>
                  {r.comment && <p className="text-sm text-muted-foreground mt-2 whitespace-pre-line">{r.comment}</p>}

                  {r.reply && (
                    <div className="mt-3 ml-1 pl-3 border-l-2 border-gold-500/40 bg-matte-800/40 rounded-r-lg p-3" data-testid={`review-reply-${r.id}`}>
                      <p className="text-xs font-semibold text-gold-400 flex items-center gap-1"><CornerDownRight className="h-3 w-3" /> Response from the merchant</p>
                      <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{r.reply}</p>
                    </div>
                  )}

                  {can_reply && !r.reply && (
                    <ReplyForm merchantId={merchantId} reviewId={r.id} onReplied={onReplied} />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default MerchantReviews;
