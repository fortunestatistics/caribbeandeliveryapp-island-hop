import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, X, Send, Loader2, Sparkles, ShoppingBag } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const getSessionId = () => {
  let sid = localStorage.getItem('assistant_session_id');
  if (!sid) {
    sid = (window.crypto?.randomUUID?.() || `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    localStorage.setItem('assistant_session_id', sid);
  }
  return sid;
};

const WELCOME = {
  role: 'assistant',
  content: "Hey there! 🌴 I'm your IslandHop Assistant. Ask me to find a shop, pharmacy, restaurant or ride — or how to track an order or become a partner.",
};

const QUICK_REPLIES = [
  { label: '🍛 Find food', message: 'Where can I order local food or a good meal?' },
  { label: '💊 Order from a pharmacy', message: 'I need to order from a pharmacy and have it delivered.' },
  { label: '📦 Track my order', message: 'How do I track my order?' },
  { label: '🚗 Become a driver', message: 'How do I become a driver on IslandHop?' },
];

const AssistantWidget = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadedHistory, setLoadedHistory] = useState(false);
  const scrollRef = useRef(null);
  const sessionId = useRef(getSessionId());

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  }, []);

  useEffect(() => { if (open) scrollToBottom(); }, [messages, open, scrollToBottom]);

  useEffect(() => {
    if (!open || loadedHistory) return;
    setLoadedHistory(true);
    (async () => {
      try {
<<<<<<< HEAD
        const res = await fetch(`${API}/assistant/history/${sessionId.current}`, { credentials: 'include' });
=======
        const res = await fetch(`${API}/assistant/history/${sessionId.current}`);
>>>>>>> cb805eb
        const data = await res.json();
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages([WELCOME, ...data.messages.map((m) => ({ role: m.role, content: m.content }))]);
        }
      } catch (_e) { /* keep welcome message */ }
    })();
  }, [open, loadedHistory]);

  const send = async (overrideText) => {
    const text = (typeof overrideText === 'string' ? overrideText : input).trim();
    if (!text || sending) return;
    if (typeof overrideText !== 'string') setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setSending(true);
    try {
      const res = await fetch(`${API}/assistant/chat`, {
        method: 'POST',
<<<<<<< HEAD
        credentials: 'include',
=======
>>>>>>> cb805eb
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId.current, message: text }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Something went wrong');
      }
      const data = await res.json();
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply, vendors: data.vendors || [] }]);
    } catch (e) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `Sorry — ${e.message}. Please try again.` }]);
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  // Render assistant text: **bold** + tappable internal links (e.g. /restaurant/<id>).
  const PATH_SPLIT = /(\/(?:restaurant|restaurants|businesses|store|orders|become-a-partner|become-a-driver|support|pricing)(?:\/[A-Za-z0-9-]+)?)/g;
  const isPath = (s) => /^\/(?:restaurant|restaurants|businesses|store|orders|become-a-partner|become-a-driver|support|pricing)(?:\/[A-Za-z0-9-]+)?$/.test(s);
  const goto = (path) => { setOpen(false); navigate(path); };
  const renderContent = (text) => (text || '').split('\n').map((line, li) => {
    const nodes = [];
    line.split(/(\*\*[^*]+\*\*)/g).forEach((part, pi) => {
      if (/^\*\*[^*]+\*\*$/.test(part)) {
        nodes.push(<strong key={`b${li}-${pi}`}>{part.slice(2, -2)}</strong>);
      } else {
        part.split(PATH_SPLIT).forEach((s, si) => {
          if (isPath(s)) {
            nodes.push(
              <button key={`l${li}-${pi}-${si}`} onClick={() => goto(s)} className="font-medium text-gold-600 underline hover:text-gold-500" data-testid="assistant-link">
                {s}
              </button>
            );
          } else if (s) {
            nodes.push(<span key={`t${li}-${pi}-${si}`}>{s}</span>);
          }
        });
      }
    });
    return <div key={li}>{nodes.length ? nodes : '\u00A0'}</div>;
  });

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-[60] flex items-center gap-2 rounded-full bg-gold-gradient px-5 py-3 text-white shadow-lg shadow-black/20 transition-transform hover:scale-105 active:scale-95"
          data-testid="assistant-launcher"
          aria-label="Open IslandHop Assistant"
        >
          <MessageCircle className="h-5 w-5" />
          <span className="text-sm font-semibold hidden sm:inline">Ask IslandHop</span>
        </button>
      )}

      {open && (
        <div
          className="fixed bottom-5 right-5 z-[60] flex h-[70vh] max-h-[560px] w-[92vw] max-w-[380px] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl shadow-black/30"
          data-testid="assistant-panel"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 bg-gold-gradient px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              <div>
                <p className="text-sm font-semibold leading-tight">IslandHop Assistant</p>
                <p className="text-[11px] opacity-90 leading-tight">Here to help you hop 🌴</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-full p-1 hover:bg-white/20" data-testid="assistant-close" aria-label="Close assistant">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-muted/20 p-4" data-testid="assistant-messages">
            {messages.map((m, i) => (
              <div key={i} data-testid={`assistant-message-${i}`}>
                <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${
                      m.role === 'user'
                        ? 'bg-gold-gradient text-white rounded-br-sm'
                        : 'bg-background border border-border text-foreground rounded-bl-sm'
                    }`}
                  >
                    {renderContent(m.content)}
                  </div>
                </div>
                {m.role === 'assistant' && Array.isArray(m.vendors) && m.vendors.length > 0 && (
                  <div className="mt-2 flex flex-col gap-2" data-testid={`assistant-vendors-${i}`}>
                    {m.vendors.map((v, vi) => (
                      <div
                        key={`${i}-${vi}`}
                        className="flex items-center justify-between gap-2 rounded-xl border border-gold-500/40 bg-gold-500/5 px-3 py-2"
                        data-testid={`assistant-vendor-card-${vi}`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{v.name}</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {v.subtitle || v.type}{v.rating ? ` · ★${v.rating}` : ''}
                          </p>
                        </div>
                        <button
                          onClick={() => goto(v.link)}
                          className="flex shrink-0 items-center gap-1 rounded-full bg-gold-gradient px-3 py-1.5 text-xs font-semibold text-white transition-transform hover:scale-105 active:scale-95"
                          data-testid={`assistant-vendor-cta-${vi}`}
                        >
                          <ShoppingBag className="h-3.5 w-3.5" />
                          {v.cta || 'View'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {sending && (
              <div className="flex justify-start" data-testid="assistant-typing">
                <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-border bg-background px-3.5 py-2.5">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: '0ms' }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: '150ms' }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
          </div>

          {/* Quick replies (shown until the customer sends their first message) */}
          {messages.filter((m) => m.role === 'user').length === 0 && !sending && (
            <div className="flex flex-wrap gap-2 border-t border-border bg-background px-3 pt-3" data-testid="assistant-quick-replies">
              {QUICK_REPLIES.map((q) => (
                <button
                  key={q.label}
                  onClick={() => send(q.message)}
                  className="rounded-full border border-gold-500/40 bg-gold-500/10 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-gold-500/20"
                  data-testid={`assistant-quick-${q.label}`}
                >
                  {q.label}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex items-end gap-2 border-t border-border bg-background p-3">
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask me anything…"
              className="max-h-24 flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold-500/40"
              data-testid="assistant-input"
            />
            <button
              onClick={send}
              disabled={sending || !input.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold-gradient text-white disabled:opacity-50"
              data-testid="assistant-send"
              aria-label="Send message"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default AssistantWidget;
