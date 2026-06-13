import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Textarea } from './components/ui/textarea';
import { Badge } from './components/ui/badge';
import { Mail, RefreshCw, Send, AlertTriangle, Inbox, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const fmtDate = (iso) => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
};

const AdminMailInbox = () => {
  const [status, setStatus] = useState(null);
  const [mailboxes, setMailboxes] = useState([]);
  const [activeMailbox, setActiveMailbox] = useState('');
  const [messages, setMessages] = useState([]);
  const [selected, setSelected] = useState(null);
  const [reply, setReply] = useState('');
  const [loadingList, setLoadingList] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    axios.get(`${API}/admin/mail/status`, { headers: authHeaders() })
      .then((r) => {
        setStatus(r.data);
        const mb = r.data.mailboxes || [];
        setMailboxes(mb);
        if (mb.length) setActiveMailbox(mb[0]);
      })
      .catch(() => setStatus({ configured: false, consent_granted: false, mailboxes: [] }));
  }, []);

  const loadMessages = useCallback(async (mailbox) => {
    if (!mailbox) return;
    setLoadingList(true);
    setSelected(null);
    try {
      const r = await axios.get(`${API}/admin/mail/mailboxes/${encodeURIComponent(mailbox)}/messages?top=25`, { headers: authHeaders() });
      setMessages(r.data.value || []);
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to load messages';
      toast.error(msg);
      setMessages([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => { if (activeMailbox && status?.consent_granted) loadMessages(activeMailbox); }, [activeMailbox, status, loadMessages]);

  const openMessage = async (msg) => {
    try {
      const r = await axios.get(`${API}/admin/mail/mailboxes/${encodeURIComponent(activeMailbox)}/messages/${msg.id}`, { headers: authHeaders() });
      setSelected(r.data);
      setReply('');
    } catch {
      toast.error('Failed to open message');
    }
  };

  const sendReply = async () => {
    if (!reply.trim()) { toast.error('Write a reply first'); return; }
    setSending(true);
    try {
      await axios.post(
        `${API}/admin/mail/mailboxes/${encodeURIComponent(activeMailbox)}/messages/${selected.id}/reply`,
        { body_html: reply.replace(/\n/g, '<br/>') },
        { headers: authHeaders() }
      );
      toast.success('Reply sent');
      setReply('');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  // Not configured / consent pending banner
  if (status && (!status.configured || !status.consent_granted)) {
    return (
      <Card data-testid="admin-mail-not-ready">
        <CardContent className="py-10 text-center">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-foreground mb-1">
            {status.configured ? 'Microsoft 365 approval pending' : 'Outlook inbox not configured'}
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {status.configured
              ? 'Your Azure credentials are connected, but a Global Administrator still needs to "Grant admin consent" for the Mail permissions before emails can load.'
              : 'Microsoft 365 credentials are not set on the server yet.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div data-testid="admin-mail-inbox">
      {/* Mailbox switcher */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Mail className="h-4 w-4 text-gold-500" />
        {mailboxes.map((mb) => (
          <Button
            key={mb}
            size="sm"
            variant={mb === activeMailbox ? 'default' : 'outline'}
            onClick={() => setActiveMailbox(mb)}
            data-testid={`mailbox-tab-${mb}`}
          >
            {mb.split('@')[0]}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={() => loadMessages(activeMailbox)} data-testid="mail-refresh-btn">
          <RefreshCw className={`h-4 w-4 ${loadingList ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Message list */}
        <Card className={`lg:col-span-1 ${selected ? 'hidden lg:block' : ''}`}>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Inbox className="h-4 w-4" /> {activeMailbox}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 max-h-[60vh] overflow-y-auto">
            {loadingList && <p className="text-sm text-muted-foreground p-4">Loading…</p>}
            {!loadingList && messages.length === 0 && <p className="text-sm text-muted-foreground p-4">No messages.</p>}
            {messages.map((m) => (
              <button
                key={m.id}
                onClick={() => openMessage(m)}
                data-testid={`mail-item-${m.id}`}
                className={`w-full text-left p-3 border-b border-matte-700/50 hover:bg-matte-800/50 transition-colors ${selected?.id === m.id ? 'bg-matte-800/60' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm truncate ${m.isRead ? 'text-muted-foreground' : 'font-semibold text-foreground'}`}>
                    {m.from?.emailAddress?.name || m.from?.emailAddress?.address || 'Unknown'}
                  </span>
                  {!m.isRead && <span className="h-2 w-2 rounded-full bg-gold-500 flex-shrink-0" />}
                </div>
                <p className="text-sm text-foreground truncate">{m.subject || '(no subject)'}</p>
                <p className="text-xs text-muted-foreground truncate">{m.bodyPreview}</p>
                <p className="text-[10px] text-muted-foreground/70 mt-1">{fmtDate(m.receivedDateTime)}</p>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Message detail + reply */}
        <Card className="lg:col-span-2">
          {!selected ? (
            <CardContent className="py-16 text-center text-muted-foreground text-sm">
              Select a message to read and reply.
            </CardContent>
          ) : (
            <>
              <CardHeader className="py-3 border-b border-matte-700/50">
                <Button size="sm" variant="ghost" className="lg:hidden w-fit mb-2" onClick={() => setSelected(null)}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <CardTitle className="text-base">{selected.subject || '(no subject)'}</CardTitle>
                <div className="text-xs text-muted-foreground mt-1">
                  From <strong>{selected.from?.emailAddress?.address}</strong> · {fmtDate(selected.receivedDateTime)}
                </div>
              </CardHeader>
              <CardContent className="py-4">
                <div
                  className="prose prose-invert prose-sm max-w-none text-sm text-foreground/90 border border-matte-700/40 rounded-lg p-3 max-h-[35vh] overflow-y-auto bg-matte-900/40"
                  dangerouslySetInnerHTML={{ __html: selected.body?.content || selected.bodyPreview || '' }}
                />
                <div className="mt-4">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reply as {activeMailbox}</label>
                  <Textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Type your reply…"
                    className="mt-2 min-h-[120px]"
                    data-testid="mail-reply-input"
                  />
                  <div className="flex justify-end mt-2">
                    <Button onClick={sendReply} disabled={sending} data-testid="mail-send-reply-btn">
                      <Send className="h-4 w-4 mr-2" /> {sending ? 'Sending…' : 'Send reply'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export default AdminMailInbox;
