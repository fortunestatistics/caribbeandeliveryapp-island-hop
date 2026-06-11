import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Textarea } from './components/ui/textarea';
import { Label } from './components/ui/label';
import { Badge } from './components/ui/badge';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Camera,
  Send,
  X,
  ChevronLeft,
  Plus,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const authHeaders = () => {
  try {
    const t = localStorage.getItem('token');
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch (_e) { return {}; }
};

const CLAIM_TYPES = [
  { id: 'missing_item', label: 'Missing item', icon: '🔍' },
  { id: 'wrong_item', label: 'Wrong item', icon: '↔️' },
  { id: 'damaged', label: 'Damaged or spoiled', icon: '💥' },
  { id: 'late', label: 'Very late delivery', icon: '⏰' },
  { id: 'quality', label: 'Quality issue', icon: '⚠️' },
  { id: 'other', label: 'Something else', icon: '❓' },
];

const STATUS_META = {
  open: { label: 'Open', icon: Clock, classes: 'bg-amber-500/20 text-amber-400 border-amber-500/40' },
  in_progress: { label: 'In review', icon: Clock, classes: 'bg-blue-500/20 text-blue-400 border-blue-500/40' },
  resolved: { label: 'Resolved', icon: CheckCircle, classes: 'bg-green-500/20 text-green-400 border-green-500/40' },
  closed: { label: 'Closed', icon: X, classes: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/40' },
};

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const StatusBadge = ({ status }) => {
  const meta = STATUS_META[status] || STATUS_META.open;
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={meta.classes}>
      <Icon className="h-3 w-3 mr-1" /> {meta.label}
    </Badge>
  );
};

const ClaimsPage = () => {
  const navigate = useNavigate();
  const [claims, setClaims] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [c, o] = await Promise.all([
        axios.get(`${API}/claims`, { headers: authHeaders() }),
        axios.get(`${API}/orders`, { headers: authHeaders() }),
      ]);
      setClaims(c.data || []);
      // Show paid/delivered orders only (those eligible for claims)
      setOrders((o.data || []).filter((or) => or.payment_status === 'paid' || or.status === 'delivered'));
    } catch (e) {
      console.error('Failed to load claims:', e);
      toast.error('Could not load your claims.');
    } finally {
      setLoading(false);
    }
  };

  const openClaim = async (claim) => {
    setSelectedClaim(claim);
    try {
      const r = await axios.get(`${API}/support/tickets/${claim.id}/messages`, { headers: authHeaders() });
      setMessages(r.data || []);
    } catch (e) {
      console.error('Failed to load messages:', e);
      setMessages([]);
    }
  };

  const sendMessage = async () => {
    if (!newMsg.trim() || !selectedClaim) return;
    try {
      await axios.post(
        `${API}/support/tickets/${selectedClaim.id}/messages`,
        { message: newMsg, sender_type: 'customer' },
        { headers: authHeaders() }
      );
      setNewMsg('');
      openClaim(selectedClaim);
      fetchAll();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to send message');
    }
  };

  if (selectedClaim) {
    return (
      <ClaimThread
        claim={selectedClaim}
        messages={messages}
        newMsg={newMsg}
        setNewMsg={setNewMsg}
        onSend={sendMessage}
        onBack={() => { setSelectedClaim(null); fetchAll(); }}
      />
    );
  }

  if (showNew) {
    return (
      <NewClaimForm
        orders={orders}
        onCancel={() => setShowNew(false)}
        onSubmitted={() => { setShowNew(false); fetchAll(); }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-matte-900 py-10" data-testid="claims-page">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">My Claims</h1>
            <p className="text-muted-foreground">Report issues with past orders and track support tickets.</p>
          </div>
          <Button
            onClick={() => setShowNew(true)}
            disabled={orders.length === 0}
            data-testid="claims-new-btn"
            className="bg-gold-gradient text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            File a claim
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-8 w-8 border-2 border-gold-500/30 border-t-gold-500 rounded-full" />
          </div>
        ) : claims.length === 0 ? (
          <Card data-testid="claims-empty">
            <CardContent className="py-16 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/60 mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No claims yet</h3>
              <p className="text-sm text-muted-foreground mb-6">
                If something went wrong with an order, file a claim — we usually respond within a few hours.
              </p>
              <Button
                onClick={() => setShowNew(true)}
                disabled={orders.length === 0}
                data-testid="claims-empty-cta"
                className="bg-gold-gradient text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                File your first claim
              </Button>
              {orders.length === 0 && (
                <p className="text-xs text-muted-foreground mt-3">
                  You'll be able to file claims after your first paid order.
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {claims.map((claim) => (
              <button
                key={claim.id}
                type="button"
                onClick={() => openClaim(claim)}
                data-testid={`claim-row-${claim.id}`}
                className="w-full text-left p-4 bg-matte-800/60 hover:bg-matte-800 border border-matte-700/50 rounded-xl transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <StatusBadge status={claim.status} />
                      {claim.claim_type && (
                        <Badge variant="outline" className="text-xs">
                          {claim.claim_type.replace('_', ' ')}
                        </Badge>
                      )}
                      {typeof claim.resolution_credit === 'number' && claim.resolution_credit > 0 && (
                        <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/40">
                          +${claim.resolution_credit.toFixed(2)} credited
                        </Badge>
                      )}
                    </div>
                    <p className="font-medium text-foreground truncate">{claim.subject}</p>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{claim.description}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {claim.order_id && <>Order #{claim.order_id.slice(0, 8)} · </>}
                      {claim.created_at && new Date(claim.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const NewClaimForm = ({ orders, onCancel, onSubmitted }) => {
  const [orderId, setOrderId] = useState(orders[0]?.id || '');
  const [claimType, setClaimType] = useState('missing_item');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error('Photo must be under 4 MB.');
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setPhoto(dataUrl);
    } catch (err) {
      console.error('Photo read failed:', err);
      toast.error('Could not read photo.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!orderId || !description.trim()) {
      toast.error('Please pick an order and describe the issue.');
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(
        `${API}/claims`,
        {
          subject: subject || `Claim: ${claimType.replace('_', ' ')}`,
          description,
          order_id: orderId,
          claim_type: claimType,
          category: 'claim',
          photo_url: photo || undefined,
        },
        { headers: authHeaders() }
      );
      toast.success('Claim filed — we\'ll follow up shortly.');
      onSubmitted();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to file claim');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-matte-900 py-10" data-testid="claim-new-form">
      <div className="container mx-auto px-4 max-w-2xl">
        <Button variant="ghost" onClick={onCancel} className="mb-4">
          <ChevronLeft className="h-4 w-4 mr-2" />Back
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-gold-500" />File a claim
            </CardTitle>
            <p className="text-sm text-muted-foreground">Tell us what went wrong. A photo speeds things up.</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label className="mb-2 block">Which order?</Label>
                <select
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  data-testid="claim-order-select"
                  className="w-full h-11 px-3 rounded-lg bg-matte-800/80 border border-matte-700 text-foreground"
                >
                  {orders.map((o) => (
                    <option key={o.id} value={o.id}>
                      #{o.id.slice(0, 8)} · {o.service_type} · ${(o.total || 0).toFixed(2)} · {new Date(o.created_at).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="mb-2 block">What happened?</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CLAIM_TYPES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setClaimType(t.id)}
                      data-testid={`claim-type-${t.id}`}
                      className={
                        'p-3 rounded-lg border-2 transition-all text-sm text-left ' +
                        (claimType === t.id
                          ? 'border-gold-500 bg-gold-500/10 text-foreground'
                          : 'border-matte-700 bg-matte-800/40 text-muted-foreground hover:border-matte-600')
                      }
                    >
                      <span className="block text-lg mb-1">{t.icon}</span>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="claim-subject" className="mb-2 block">Subject <span className="text-muted-foreground">(optional)</span></Label>
                <Input
                  id="claim-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  data-testid="claim-subject-input"
                  placeholder="Short summary"
                />
              </div>

              <div>
                <Label htmlFor="claim-desc" className="mb-2 block">Tell us more</Label>
                <Textarea
                  id="claim-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  data-testid="claim-description-input"
                  placeholder="Be specific — what was missing, wrong, or damaged?"
                  rows={5}
                  required
                />
              </div>

              <div>
                <Label className="mb-2 block">Photo proof <span className="text-muted-foreground">(optional)</span></Label>
                <label
                  htmlFor="claim-photo"
                  className="flex flex-col items-center justify-center w-full p-6 border-2 border-dashed border-matte-700 rounded-lg cursor-pointer hover:border-gold-500/50 transition-colors"
                  data-testid="claim-photo-dropzone"
                >
                  {photo ? (
                    <img src={photo} alt="proof" className="max-h-40 rounded-md" />
                  ) : (
                    <>
                      <Camera className="h-8 w-8 text-muted-foreground/70 mb-2" />
                      <span className="text-sm text-muted-foreground">Tap to attach a photo (≤4 MB)</span>
                    </>
                  )}
                  <input
                    id="claim-photo"
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={submitting}
                  data-testid="claim-submit-btn"
                  className="bg-gold-gradient text-white flex-1"
                >
                  {submitting ? 'Submitting…' : 'Submit claim'}
                </Button>
                <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const ClaimThread = ({ claim, messages, newMsg, setNewMsg, onSend, onBack }) => {
  return (
    <div className="min-h-screen bg-matte-900 py-10" data-testid="claim-thread">
      <div className="container mx-auto px-4 max-w-3xl">
        <Button variant="ghost" onClick={onBack} className="mb-4">
          <ChevronLeft className="h-4 w-4 mr-2" />All claims
        </Button>

        <Card className="mb-4">
          <CardContent className="p-5">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <StatusBadge status={claim.status} />
              {claim.claim_type && (
                <Badge variant="outline" className="text-xs">
                  {claim.claim_type.replace('_', ' ')}
                </Badge>
              )}
              {typeof claim.resolution_credit === 'number' && claim.resolution_credit > 0 && (
                <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/40">
                  +${claim.resolution_credit.toFixed(2)} credited to wallet
                </Badge>
              )}
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">{claim.subject}</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{claim.description}</p>
            {claim.photo_url && (
              <img src={claim.photo_url} alt="claim proof" className="mt-4 max-h-64 rounded-lg border border-matte-700" />
            )}
            <p className="text-xs text-muted-foreground mt-4">
              Order #{claim.order_id?.slice(0, 8)} · Filed {new Date(claim.created_at).toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conversation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 mb-4">
              {messages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No messages yet — support will reply here.
                </p>
              ) : (
                messages.map((m) => {
                  const mine = m.sender_type === 'customer';
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={
                          'max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ' +
                          (mine
                            ? 'bg-gold-gradient text-white rounded-br-sm'
                            : m.sender_type === 'system'
                            ? 'bg-amber-500/10 border border-amber-500/30 text-amber-200 italic'
                            : 'bg-matte-800 text-foreground rounded-bl-sm')
                        }
                      >
                        <p className="whitespace-pre-line">{m.message}</p>
                        <p className={`text-[10px] mt-1 ${mine ? 'text-white/70' : 'text-muted-foreground'}`}>
                          {m.sender_type} · {new Date(m.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {claim.status !== 'closed' && (
              <div className="flex gap-2">
                <Input
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onSend(); } }}
                  placeholder="Reply…"
                  data-testid="claim-reply-input"
                  className="flex-1"
                />
                <Button onClick={onSend} disabled={!newMsg.trim()} data-testid="claim-reply-send" className="bg-gold-gradient text-white">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ClaimsPage;
