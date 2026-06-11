import React, { useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Badge } from './components/ui/badge';
import { Label } from './components/ui/label';
import { MessageCircle, Send, User as UserIcon, Truck, Store, Repeat, X, Check } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const authHeaders = () => {
  try {
    const t = localStorage.getItem('token');
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch (_e) { return {}; }
};

const ROLE_META = {
  customer: { label: 'Customer', icon: UserIcon, classes: 'bg-blue-500/20 text-blue-400 border-blue-500/40' },
  driver:   { label: 'Driver',   icon: Truck,    classes: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' },
  vendor:   { label: 'Merchant', icon: Store,    classes: 'bg-amber-500/20 text-amber-400 border-amber-500/40' },
  system:   { label: 'Support',  icon: MessageCircle, classes: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/40' },
};

const RoleBadge = ({ role }) => {
  const meta = ROLE_META[role] || ROLE_META.system;
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={`text-xs ${meta.classes}`}>
      <Icon className="h-3 w-3 mr-1" /> {meta.label}
    </Badge>
  );
};

/**
 * Reusable per-order chat panel. Renders the full customer ↔ driver ↔ merchant
 * thread for `orderId` and identifies the current viewer via `currentUserId`.
 * Also surfaces vendor substitution proposals: merchants can propose a swap,
 * customers can accept or decline inline.
 */
const OrderChat = ({ orderId, currentUserId, viewerRole, className = '', title = 'Order chat' }) => {
  const [messages, setMessages] = useState([]);
  const [substitutions, setSubstitutions] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  // Vendor-only mini-form
  const [subFormOpen, setSubFormOpen] = useState(false);
  const [subForm, setSubForm] = useState({ original: '', proposed: '', priceDelta: '0', note: '' });
  const [subSubmitting, setSubSubmitting] = useState(false);
  const scrollRef = useRef(null);

  const scrollToBottom = () => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  };

  const fetchAll = useCallback(async () => {
    if (!orderId) return;
    try {
      const [msgs, subs] = await Promise.all([
        axios.get(`${API}/chat/${orderId}/messages`, { headers: authHeaders() }),
        axios.get(`${API}/orders/${orderId}/substitutions`, { headers: authHeaders() }).catch(() => ({ data: [] })),
      ]);
      setMessages(msgs.data || []);
      setSubstitutions(subs.data || []);
    } catch (err) {
      if (err.response?.status !== 403) {
        console.error('Failed to fetch order chat:', err);
      }
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 5000);
    return () => clearInterval(id);
  }, [fetchAll]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || !orderId) return;
    setSending(true);
    try {
      await axios.post(
        `${API}/chat/send`,
        { order_id: orderId, message: text },
        { headers: authHeaders() }
      );
      setInput('');
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not send message');
    } finally {
      setSending(false);
    }
  };

  const submitSubstitution = async () => {
    if (!subForm.original.trim()) {
      toast.error('Please enter the original item name.');
      return;
    }
    setSubSubmitting(true);
    try {
      await axios.post(
        `${API}/orders/${orderId}/substitutions`,
        {
          order_id: orderId,
          original_item_name: subForm.original.trim(),
          proposed_item_name: subForm.proposed.trim() || null,
          price_delta: parseFloat(subForm.priceDelta) || 0,
          note: subForm.note.trim() || null,
        },
        { headers: authHeaders() }
      );
      toast.success('Substitution proposed.');
      setSubForm({ original: '', proposed: '', priceDelta: '0', note: '' });
      setSubFormOpen(false);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to propose');
    } finally {
      setSubSubmitting(false);
    }
  };

  const respondSubstitution = async (propId, accept) => {
    try {
      await axios.post(
        `${API}/orders/${orderId}/substitutions/${propId}/respond?accept=${accept}`,
        {},
        { headers: authHeaders() }
      );
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to respond');
    }
  };

  const pendingSubs = substitutions.filter((s) => s.status === 'pending');
  const isVendor = viewerRole === 'vendor';
  const isCustomer = viewerRole === 'customer';

  return (
    <Card className={className} data-testid="order-chat">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircle className="h-4 w-4 text-gold-500" />
          {title}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Direct line between you, the driver, and the merchant for this order.
        </p>
      </CardHeader>
      <CardContent>
        {/* Pending substitutions — actionable by customer, visible to all */}
        {pendingSubs.length > 0 && (
          <div className="mb-3 space-y-2" data-testid="order-chat-substitutions">
            {pendingSubs.map((sub) => (
              <div
                key={sub.id}
                className="p-3 rounded-lg border border-gold-500/30 bg-gold-500/5"
                data-testid={`substitution-${sub.id}`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Repeat className="h-4 w-4 text-gold-500" />
                      <span className="text-sm font-semibold text-foreground">Substitution proposed</span>
                    </div>
                    <p className="text-sm text-foreground">
                      {sub.proposed_item_name ? (
                        <>
                          <span className="line-through text-muted-foreground">{sub.original_item_name}</span>
                          {' → '}
                          <span className="font-medium">{sub.proposed_item_name}</span>
                          {sub.price_delta !== 0 && (
                            <span className={`ml-2 text-xs ${sub.price_delta > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                              ({sub.price_delta > 0 ? '+' : ''}${Math.abs(sub.price_delta).toFixed(2)})
                            </span>
                          )}
                        </>
                      ) : (
                        <>Mark <span className="font-medium">{sub.original_item_name}</span> as unavailable</>
                      )}
                    </p>
                    {sub.note && <p className="text-xs text-muted-foreground mt-1">“{sub.note}”</p>}
                  </div>
                  {isCustomer && (
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => respondSubstitution(sub.id, true)}
                        data-testid={`substitution-accept-${sub.id}`}
                      >
                        <Check className="h-4 w-4 mr-1" />Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => respondSubstitution(sub.id, false)}
                        data-testid={`substitution-decline-${sub.id}`}
                      >
                        <X className="h-4 w-4 mr-1" />Decline
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Vendor-only: propose a substitution */}
        {isVendor && (
          <div className="mb-3">
            {!subFormOpen ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSubFormOpen(true)}
                data-testid="propose-substitution-btn"
                className="border-gold-500/40 text-gold-500"
              >
                <Repeat className="h-4 w-4 mr-2" />Propose substitution
              </Button>
            ) : (
              <div className="p-3 rounded-lg border border-matte-700 bg-matte-900/40 space-y-2" data-testid="substitution-form">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Original item</Label>
                    <Input
                      value={subForm.original}
                      onChange={(e) => setSubForm({ ...subForm, original: e.target.value })}
                      placeholder="e.g. Margherita Pizza"
                      data-testid="sub-original-input"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Substitute (leave blank if unavailable)</Label>
                    <Input
                      value={subForm.proposed}
                      onChange={(e) => setSubForm({ ...subForm, proposed: e.target.value })}
                      placeholder="e.g. Pepperoni Pizza"
                      data-testid="sub-proposed-input"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Price difference ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={subForm.priceDelta}
                      onChange={(e) => setSubForm({ ...subForm, priceDelta: e.target.value })}
                      data-testid="sub-delta-input"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Note (optional)</Label>
                    <Input
                      value={subForm.note}
                      onChange={(e) => setSubForm({ ...subForm, note: e.target.value })}
                      placeholder="e.g. Same toppings, fresher batch"
                      data-testid="sub-note-input"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={submitSubstitution}
                    disabled={subSubmitting}
                    data-testid="sub-submit-btn"
                    className="bg-gold-gradient text-white"
                  >
                    {subSubmitting ? 'Sending…' : 'Send to customer'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setSubFormOpen(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        )}

        <div
          ref={scrollRef}
          className="space-y-3 max-h-[340px] min-h-[180px] overflow-y-auto pr-1 mb-3"
          data-testid="order-chat-scroll"
        >
          {loading ? (
            <div className="flex justify-center py-6">
              <div className="animate-spin h-6 w-6 border-2 border-gold-500/30 border-t-gold-500 rounded-full" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No messages yet. Say hi 👋
            </div>
          ) : (
            messages.map((m) => {
              const mine = m.sender_id === currentUserId;
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                    <div className="flex items-center gap-2 mb-1">
                      {!mine && (
                        <span className="text-xs text-muted-foreground font-medium">
                          {m.sender_name || 'Participant'}
                        </span>
                      )}
                      <RoleBadge role={m.sender_user_type} />
                    </div>
                    <div
                      className={
                        'px-3.5 py-2 rounded-2xl text-sm whitespace-pre-line ' +
                        (mine
                          ? 'bg-gold-gradient text-white rounded-br-sm'
                          : m.sender_user_type === 'system'
                          ? 'bg-amber-500/10 border border-amber-500/30 text-amber-200 italic'
                          : 'bg-matte-800 text-foreground rounded-bl-sm')
                      }
                    >
                      {m.message}
                    </div>
                    <span className={`text-[10px] mt-1 ${mine ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                      {m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Type a message…"
            data-testid="order-chat-input"
            className="flex-1"
          />
          <Button
            onClick={send}
            disabled={!input.trim() || sending}
            data-testid="order-chat-send"
            className="bg-gold-gradient text-white"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default OrderChat;
