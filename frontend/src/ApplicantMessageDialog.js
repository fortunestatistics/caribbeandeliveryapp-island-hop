import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Textarea } from './components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './components/ui/dialog';
import { Mail, MessageSquare, Send, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

// Quick starters so an admin can ask for outstanding documents in one tap.
const DOCS_TEMPLATE_EMAIL = (name) =>
  `${name ? `Hi ${name},` : 'Hello,'}\n\nThanks for applying to IslandHop! To move your application forward, please reply with the following documents:\n\n• A valid government-issued ID\n• Your driver's licence (if applying as a driver)\n• Vehicle registration & insurance (drivers)\n\nOnce we receive these we'll continue your review. Thank you!`;
const DOCS_TEMPLATE_SMS = (name) =>
  `${name ? `Hi ${name}, ` : ''}IslandHop here — to move your application forward please send a valid ID${''} (and driver's licence + vehicle registration/insurance if applying as a driver). Reply to this message with the documents. Thanks!`;

export const ApplicantMessageDialog = ({ rec, category, onClose }) => {
  const open = !!rec;
  const [channel, setChannel] = useState('email');
  const [subject, setSubject] = useState('Your IslandHop application');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [thread, setThread] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [suggesting, setSuggesting] = useState(false);

  const APPLICANT_TYPE = { drivers: 'driver', businesses: 'merchant', service_pros: 'service_pro' };

  const getSuggestions = async () => {
    setSuggesting(true);
    try {
      const lastInbound = [...thread].reverse().find((m) => m.direction === 'inbound');
      const r = await axios.post(`${API}/admin/applicants/ai-suggestions`, {
        channel,
        applicant_name: rec.name || null,
        applicant_type: APPLICANT_TYPE[category] || 'applicant',
        context: lastInbound?.body || '',
      }, { headers: authHeaders() });
      setSuggestions(r.data.suggestions || []);
      if (!(r.data.suggestions || []).length) toast.error('No suggestions returned, try again');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not get AI suggestions');
    } finally {
      setSuggesting(false);
    }
  };

  const loadThread = async () => {
    if (!rec) return;
    try {
      const r = await axios.get(`${API}/admin/applicants/${category}/${rec.id}/messages`, {
        headers: authHeaders(), params: { email: rec.email || '' },
      });
      setThread(r.data.messages || []);
    } catch { /* thread is best-effort */ }
  };

  useEffect(() => {
    if (rec) {
      setChannel(rec.email ? 'email' : 'sms');
      setSubject('Your IslandHop application');
      setMessage('');
      setThread([]);
      setSuggestions([]);
      loadThread();
    }
  }, [rec]);

  const send = async () => {
    if (!message.trim()) { toast.error('Write a message first'); return; }
    setSending(true);
    try {
      const r = await axios.post(`${API}/admin/applicants/contact`, {
        channel,
        email: rec.email || null,
        phone: rec.phone || null,
        name: rec.name || null,
        subject,
        message,
        category,
        record_id: rec.id,
      }, { headers: authHeaders() });
      toast.success(`${channel === 'email' ? 'Email' : 'Text'} sent to ${r.data.to}`);
      setMessage('');
      loadThread();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not send the message');
    } finally {
      setSending(false);
    }
  };

  if (!rec) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg" data-testid="applicant-message-dialog">
        <DialogHeader>
          <DialogTitle>Message {rec.name || 'applicant'}</DialogTitle>
          <DialogDescription>Ask for documents or send an update. Delivered from your IslandHop team.</DialogDescription>
        </DialogHeader>

        {thread.length > 0 && (
          <div className="max-h-40 overflow-y-auto rounded-md border border-border bg-muted/30 p-2 space-y-2" data-testid="applicant-message-thread">
            {thread.map((m, i) => (
              <div key={i} className={`text-xs rounded-md p-2 ${m.direction === 'inbound' ? 'bg-blue-50 border border-blue-100' : 'bg-white border border-border'}`} data-testid={`thread-msg-${i}`}>
                <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                  <span>{m.direction === 'inbound' ? '⬅ Applicant' : '➡ You'} · {m.channel}</span>
                  <span>{m.created_at ? new Date(m.created_at).toLocaleString() : ''}</span>
                </div>
                {m.subject && <div className="font-medium">{m.subject}</div>}
                <div className="whitespace-pre-wrap">{m.body}</div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Button
            type="button" size="sm"
            variant={channel === 'email' ? 'default' : 'outline'}
            disabled={!rec.email}
            onClick={() => setChannel('email')}
            data-testid="message-channel-email"
          >
            <Mail className="h-4 w-4 mr-1" /> Email {rec.email ? '' : '(none)'}
          </Button>
          <Button
            type="button" size="sm"
            variant={channel === 'sms' ? 'default' : 'outline'}
            disabled={!rec.phone}
            onClick={() => setChannel('sms')}
            data-testid="message-channel-sms"
          >
            <MessageSquare className="h-4 w-4 mr-1" /> Text {rec.phone ? '' : '(none)'}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          To: {channel === 'email' ? (rec.email || '—') : (rec.phone || '—')}
        </p>

        {channel === 'email' && (
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" data-testid="message-subject-input" />
        )}

        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase">Your message</span>
          <Button type="button" size="sm" variant="outline" onClick={getSuggestions} disabled={suggesting}
            className="border-accent/40 text-accent hover:bg-accent/10" data-testid="ai-suggestions-btn">
            {suggesting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
            {suggesting ? 'Thinking…' : 'Suggest 3 replies'}
          </Button>
        </div>

        {suggestions.length > 0 && (
          <div className="space-y-2" data-testid="ai-suggestions-list">
            {suggestions.map((sug, i) => (
              <button
                type="button" key={i}
                onClick={() => { setMessage(sug); setSuggestions([]); }}
                data-testid={`ai-suggestion-${i}`}
                className="w-full text-left text-xs rounded-md border border-accent/30 bg-accent/5 hover:bg-accent/10 p-2 transition-colors"
              >
                <span className="font-semibold text-accent">Option {i + 1}</span>
                <span className="block whitespace-pre-wrap mt-0.5">{sug}</span>
              </button>
            ))}
          </div>
        )}

        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="min-h-[160px]"
          placeholder="Type your message…"
          data-testid="message-body-input"
        />

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button type="button" variant="ghost" className="sm:mr-auto" onClick={() => setMessage(channel === 'sms' ? DOCS_TEMPLATE_SMS(rec.name) : DOCS_TEMPLATE_EMAIL(rec.name))} data-testid="message-docs-template-btn">
            Insert "request documents" template
          </Button>
          <Button onClick={send} disabled={sending} data-testid="message-send-btn">
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            {sending ? 'Sending…' : `Send ${channel === 'email' ? 'email' : 'text'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ApplicantMessageDialog;
