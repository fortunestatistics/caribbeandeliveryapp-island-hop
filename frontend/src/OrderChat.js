import React, { useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Badge } from './components/ui/badge';
import { MessageCircle, Send, User as UserIcon, Truck, Store } from 'lucide-react';
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
 */
const OrderChat = ({ orderId, currentUserId, title = 'Order chat', className = '' }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);

  const scrollToBottom = () => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  };

  const fetchMessages = useCallback(async () => {
    if (!orderId) return;
    try {
      const r = await axios.get(`${API}/chat/${orderId}/messages`, { headers: authHeaders() });
      setMessages(r.data || []);
    } catch (err) {
      // 403 means the viewer is not a participant; render an empty thread quietly.
      if (err.response?.status !== 403) {
        console.error('Failed to fetch order chat:', err);
      }
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchMessages();
    const id = setInterval(fetchMessages, 5000);
    return () => clearInterval(id);
  }, [fetchMessages]);

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
      fetchMessages();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not send message');
    } finally {
      setSending(false);
    }
  };

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
