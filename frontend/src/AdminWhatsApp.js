import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Badge } from './components/ui/badge';
import { MessageSquare, Send, Sparkles, Loader2, CornerUpLeft } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const AdminWhatsApp = () => {
  const [whConvos, setWhConvos] = useState([]);
  const [whSelectedPhone, setWhSelectedPhone] = useState('');
  const [whMessages, setWhMessages] = useState([]);
  const [whReplyBody, setWhReplyBody] = useState('');
  const [whComposePhone, setWhComposePhone] = useState('');
  const [whComposeBody, setWhComposeBody] = useState('');
  const [whComposeSending, setWhComposeSending] = useState(false);
  const [whComposeFeedback, setWhComposeFeedback] = useState(null);
  const [whDrafting, setWhDrafting] = useState(false);
  const [autoSuggest, setAutoSuggest] = useState(false);

  const fetchWhConvos = async () => {
    try {
      const res = await axios.get(`${API}/whatsapp/conversations`, { headers: authHeaders() });
      // Conversations where the customer messaged last (unanswered) float to the top.
      const sorted = [...(res.data || [])].sort((a, b) => {
        const aWaiting = a.last_direction === 'inbound' ? 1 : 0;
        const bWaiting = b.last_direction === 'inbound' ? 1 : 0;
        if (aWaiting !== bWaiting) return bWaiting - aWaiting;
        return new Date(b.last_at) - new Date(a.last_at);
      });
      setWhConvos(sorted);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchWhConvos();
    axios.get(`${API}/admin/ai-reply/settings`, { headers: authHeaders() })
      .then((r) => setAutoSuggest(!!r.data.auto_suggest))
      .catch(() => {});
  }, []);

  const openWhConvo = async (phone) => {
    setWhSelectedPhone(phone);
    setWhReplyBody('');
    try {
      const res = await axios.get(`${API}/whatsapp/messages?phone=${encodeURIComponent(phone)}`, { headers: authHeaders() });
      const msgs = res.data.reverse();
      setWhMessages(msgs);
      // Auto-suggest: pre-draft a reply the moment a conversation with a waiting
      // customer message is opened (admin still reviews & sends).
      if (autoSuggest && msgs.some((m) => m.direction === 'inbound')) {
        draftWhWithAi(msgs, { silent: true });
      }
    } catch (e) { console.error(e); }
  };

  const sendWhReply = async () => {
    if (!whSelectedPhone || !whReplyBody.trim()) return;
    try {
      await axios.post(`${API}/whatsapp/send`, { to: whSelectedPhone, body: whReplyBody }, { headers: authHeaders() });
      setWhReplyBody('');
      openWhConvo(whSelectedPhone);
      fetchWhConvos();
    } catch (e) { alert(e.response?.data?.detail || 'Failed to send'); }
  };

  const draftWhWithAi = async (msgsArg, opts = {}) => {
    const msgs = Array.isArray(msgsArg) ? msgsArg : whMessages;
    if (!whSelectedPhone && !msgs.length) return;
    // Newest inbound customer message drives the reply; include recent thread as context.
    const lastInbound = [...msgs].reverse().find((m) => m.direction === 'inbound');
    if (!lastInbound) { if (!opts.silent) alert('No customer message to reply to yet.'); return; }
    const context = msgs.slice(-8)
      .map((m) => `${m.direction === 'inbound' ? 'Customer' : 'Us'}: ${m.body}`).join('\n');
    setWhDrafting(true);
    try {
      const res = await axios.post(`${API}/admin/ai-reply/draft`, {
        channel: 'whatsapp',
        customer_message: lastInbound.body,
        context,
        avoid_draft: whReplyBody.trim() || undefined,  // tapping again → fresh wording
      }, { headers: authHeaders() });
      setWhReplyBody(res.data.draft || '');
    } catch (e) {
      if (!opts.silent) alert(e.response?.data?.detail || 'Could not draft a reply');
    } finally {
      setWhDrafting(false);
    }
  };

  const sendWhCompose = async () => {
    if (!whComposePhone.trim() || !whComposeBody.trim()) return;
    setWhComposeSending(true);
    setWhComposeFeedback(null);
    try {
      await axios.post(`${API}/whatsapp/send`, { to: whComposePhone.trim(), body: whComposeBody.trim() }, { headers: authHeaders() });
      setWhComposeFeedback({ type: 'success', text: `WhatsApp message queued to ${whComposePhone.trim()}` });
      setWhComposeBody('');
      fetchWhConvos();
    } catch (e) {
      setWhComposeFeedback({ type: 'error', text: e.response?.data?.detail || 'Failed to send WhatsApp message' });
    } finally { setWhComposeSending(false); }
  };

  return (
    <div className="space-y-4" data-testid="admin-whatsapp-content">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Send className="h-5 w-5 text-gold-500" />Send a WhatsApp message</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <Input
              data-testid="wa-compose-phone"
              value={whComposePhone}
              onChange={(e) => setWhComposePhone(e.target.value)}
              placeholder="To: +1868… (driver/merchant)"
              className="sm:col-span-1"
            />
            <Input
              data-testid="wa-compose-body"
              value={whComposeBody}
              onChange={(e) => setWhComposeBody(e.target.value)}
              placeholder="Message…"
              onKeyDown={(e) => e.key === 'Enter' && sendWhCompose()}
              className="sm:col-span-2"
            />
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-muted-foreground">
              Note: Customers must message <span className="font-semibold">+1 (252) 374-6444</span> first to receive WhatsApp notifications (WhatsApp's 24h session rule). Once your message templates are approved by Meta, this restriction is lifted and notifications send freely.
            </p>
            <Button
              data-testid="wa-compose-send-btn"
              onClick={sendWhCompose}
              disabled={whComposeSending || !whComposePhone.trim() || !whComposeBody.trim()}
              className="bg-gold-gradient text-white"
            >
              {whComposeSending ? 'Sending…' : 'Send WhatsApp'}
            </Button>
          </div>
          {whComposeFeedback && (
            <p data-testid="wa-compose-feedback" className={`text-xs ${whComposeFeedback.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {whComposeFeedback.text}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5 text-gold-500" />Conversations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
            {whConvos.length === 0 ? (
              <p className="text-center text-muted-foreground py-8" data-testid="whatsapp-no-convos">No WhatsApp messages yet.</p>
            ) : (
              whConvos.map((c) => (
                <div key={c.phone} onClick={() => openWhConvo(c.phone)} className={`p-3 rounded-lg cursor-pointer ${whSelectedPhone === c.phone ? 'bg-gold-500/10 border border-gold-500/30' : 'bg-matte-900/40 hover:bg-matte-900/60'}`} data-testid={`wa-convo-${c.phone}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium font-mono text-sm truncate">{c.phone}</p>
                    {c.last_direction === 'inbound' && (
                      <Badge className="bg-green-500/15 text-green-600 border border-green-500/30 text-[10px] shrink-0 gap-1" data-testid={`wa-waiting-${c.phone}`}>
                        <CornerUpLeft className="h-3 w-3" />Reply needed
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{c.last_message}</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">{c.count} msg • {new Date(c.last_at).toLocaleString()}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>{whSelectedPhone ? `Chat with ${whSelectedPhone}` : 'Select a conversation'}</CardTitle>
          </CardHeader>
          <CardContent>
            {!whSelectedPhone ? (
              <p className="text-center text-muted-foreground py-12">Pick a conversation from the left.</p>
            ) : (
              <>
                <div className="space-y-2 max-h-[400px] overflow-y-auto mb-4" data-testid="wa-thread">
                  {whMessages.map((m) => (
                    <div key={m.id} className={`p-3 rounded-lg max-w-[80%] ${m.direction === 'inbound' ? 'bg-matte-900/40 mr-auto' : 'bg-gold-500/15 ml-auto text-right'}`} data-testid={`wa-msg-${m.id}`}>
                      <p className="text-sm">{m.body}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(m.created_at).toLocaleTimeString()}
                        {m.direction === 'outbound' && m.status && (
                          <span
                            className={`ml-2 font-medium ${
                              ['delivered', 'read', 'sent'].includes(m.status) ? 'text-green-600'
                              : ['failed', 'undelivered'].includes(m.status) ? 'text-red-600'
                              : 'text-muted-foreground'
                            }`}
                            data-testid={`wa-status-${m.id}`}
                          >
                            · {m.status}
                          </span>
                        )}
                      </p>
                      {m.direction === 'outbound' && ['failed', 'undelivered'].includes(m.status) && (
                        <p className="text-[11px] text-red-600 mt-1" data-testid={`wa-error-${m.id}`}>
                          {String(m.error_code) === '63005' || String(m.error_code) === '63016'
                            ? 'Not delivered — the customer is outside WhatsApp\u2019s 24-hour window. Business-initiated messages require an approved template.'
                            : `Not delivered${m.error_code ? ` (error ${m.error_code})` : ''}.`}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button data-testid="wa-ai-draft-btn" variant="outline" onClick={() => draftWhWithAi()} disabled={whDrafting}
                    className="border-accent/40 text-accent hover:bg-accent/10 shrink-0" title={whReplyBody.trim() ? 'Regenerate a different reply' : 'Draft a reply with AI'}>
                    {whDrafting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  </Button>
                  <Input data-testid="wa-reply-input" value={whReplyBody} onChange={(e) => setWhReplyBody(e.target.value)} placeholder="Type a reply…" onKeyDown={(e) => e.key === 'Enter' && sendWhReply()} />
                  <Button data-testid="wa-send-btn" onClick={sendWhReply} className="bg-gold-gradient text-white">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminWhatsApp;
