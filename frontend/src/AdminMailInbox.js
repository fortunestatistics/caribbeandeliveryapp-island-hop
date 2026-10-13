import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Textarea } from './components/ui/textarea';
import { Input } from './components/ui/input';
import { Badge } from './components/ui/badge';
import { Mail, RefreshCw, Send, AlertTriangle, Inbox, ChevronLeft, Zap, UserCheck, CheckCircle2, Settings2, Sparkles, Loader2, BookOpen } from 'lucide-react';
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
  // Workflow state
  const [team, setTeam] = useState([]);
  const [settings, setSettings] = useState(null);
  const [running, setRunning] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [tplSubject, setTplSubject] = useState('');
  const [tplBody, setTplBody] = useState('');
  const [savingTpl, setSavingTpl] = useState(false);
  const [assigning, setAssigning] = useState(false);
  // AI reply assistant
  const [drafting, setDrafting] = useState(false);
  const [showAiKnowledge, setShowAiKnowledge] = useState(false);
  const [aiBusinessInfo, setAiBusinessInfo] = useState('');
  const [aiTone, setAiTone] = useState('');
  const [aiAutoSuggest, setAiAutoSuggest] = useState(false);
  const [savingAi, setSavingAi] = useState(false);

  useEffect(() => {
    axios.get(`${API}/admin/mail/status`, { headers: authHeaders() })
      .then((r) => {
        setStatus(r.data);
        const mb = r.data.mailboxes || [];
        setMailboxes(mb);
        if (mb.length) setActiveMailbox(mb[0]);
      })
      .catch(() => setStatus({ configured: false, consent_granted: false, mailboxes: [] }));
    axios.get(`${API}/admin/mail/team`, { headers: authHeaders() })
      .then((r) => setTeam(r.data.members || [])).catch(() => {});
    axios.get(`${API}/admin/mail/auto-reply/settings`, { headers: authHeaders() })
      .then((r) => { setSettings(r.data); setTplSubject(r.data.subject || ''); setTplBody(r.data.body_html || ''); })
      .catch(() => {});
    axios.get(`${API}/admin/ai-reply/settings`, { headers: authHeaders() })
      .then((r) => { setAiBusinessInfo(r.data.business_info || ''); setAiTone(r.data.tone || ''); setAiAutoSuggest(!!r.data.auto_suggest); })
      .catch(() => {});
  }, []);

  const loadMessages = useCallback(async (mailbox) => {
    if (!mailbox) return;
    setLoadingList(true);
    setSelected(null);
    try {
      const r = await axios.get(`${API}/admin/mail/mailboxes/${encodeURIComponent(mailbox)}/messages?top=25`, { headers: authHeaders() });
      setMessages(r.data.value || []);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to load messages');
      setMessages([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => { if (activeMailbox && status?.consent_granted) loadMessages(activeMailbox); }, [activeMailbox, status, loadMessages]);

  const openMessage = async (msg) => {
    try {
      const r = await axios.get(`${API}/admin/mail/mailboxes/${encodeURIComponent(activeMailbox)}/messages/${msg.id}`, { headers: authHeaders() });
      const full = { ...r.data, ticket: msg.ticket };
      setSelected(full);
      setReply('');
      // Auto-suggest: pre-draft a reply the moment the message is opened.
      if (aiAutoSuggest) draftWithAi(full, { silent: true });
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

  // Strip HTML to plain text for the AI so it reads the customer's actual words.
  const htmlToText = (html) => {
    if (!html) return '';
    const el = document.createElement('div');
    el.innerHTML = html;
    return (el.textContent || el.innerText || '').replace(/\s+\n/g, '\n').trim();
  };

  const draftWithAi = async (msgObj, opts = {}) => {
    const m = msgObj && msgObj.from ? msgObj : selected;
    if (!m) return;
    setDrafting(true);
    try {
      const customerMessage = htmlToText(m.body?.content || m.bodyPreview || '');
      const res = await axios.post(`${API}/admin/ai-reply/draft`, {
        channel: 'email',
        customer_name: m.from?.emailAddress?.name || '',
        customer_message: customerMessage,
        avoid_draft: reply.trim() || undefined,  // tapping again → fresh wording
      }, { headers: authHeaders() });
      setReply(res.data.draft || '');
      if (!opts.silent) toast.success('AI drafted a reply — review & edit before sending');
    } catch (err) {
      if (!opts.silent) toast.error(err.response?.data?.detail || 'Could not draft a reply');
    } finally {
      setDrafting(false);
    }
  };

  const saveAiKnowledge = async () => {
    setSavingAi(true);
    try {
      const r = await axios.put(`${API}/admin/ai-reply/settings`, { business_info: aiBusinessInfo, tone: aiTone, auto_suggest: aiAutoSuggest }, { headers: authHeaders() });
      setAiBusinessInfo(r.data.business_info || '');
      setAiTone(r.data.tone || '');
      setAiAutoSuggest(!!r.data.auto_suggest);
      toast.success('AI reply knowledge saved');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    } finally {
      setSavingAi(false);
    }
  };

  const toggleAutoReply = async () => {
    if (!settings) return;
    try {
      const r = await axios.put(`${API}/admin/mail/auto-reply/settings`, { enabled: !settings.enabled }, { headers: authHeaders() });
      setSettings(r.data);
      toast.success(`Auto-reply ${r.data.enabled ? 'enabled' : 'disabled'}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update');
    }
  };

  const runAutoReply = async () => {
    if (settings && !settings.enabled) {
      toast.info('Auto-reply is turned off. Enable it to acknowledge new emails.');
      return;
    }
    setRunning(true);
    try {
      const r = await axios.post(`${API}/admin/mail/auto-reply/run`, {}, { headers: authHeaders() });
      toast.success(r.data.auto_replies_sent > 0 ? `Auto-replied to ${r.data.auto_replies_sent} new email(s)` : 'No new emails awaiting an auto-reply');
      loadMessages(activeMailbox);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to run auto-reply');
    } finally {
      setRunning(false);
    }
  };

  const saveTemplate = async () => {
    setSavingTpl(true);
    try {
      const r = await axios.put(`${API}/admin/mail/auto-reply/settings`, { enabled: settings?.enabled ?? true, subject: tplSubject, body_html: tplBody }, { headers: authHeaders() });
      setSettings(r.data);
      toast.success('Auto-reply template saved');
      setShowTemplate(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save template');
    } finally {
      setSavingTpl(false);
    }
  };

  const assignTo = async (assigneeId) => {
    if (!selected) return;
    setAssigning(true);
    try {
      const r = await axios.post(
        `${API}/admin/mail/mailboxes/${encodeURIComponent(activeMailbox)}/messages/${selected.id}/assign`,
        { assignee_id: assigneeId || null },
        { headers: authHeaders() }
      );
      const t = r.data.ticket;
      setSelected((s) => ({ ...s, ticket: { ...(s.ticket || {}), assigned_to: t.assigned_to, assigned_to_name: t.assigned_to_name, status: t.status } }));
      setMessages((ms) => ms.map((m) => m.id === selected.id ? { ...m, ticket: { ...(m.ticket || {}), assigned_to: t.assigned_to, assigned_to_name: t.assigned_to_name, status: t.status, auto_replied: m.ticket?.auto_replied } } : m));
      toast.success(assigneeId ? `Assigned to ${t.assigned_to_name}` : 'Unassigned');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to assign');
    } finally {
      setAssigning(false);
    }
  };

  const resolveTicket = async () => {
    if (!selected) return;
    try {
      await axios.post(`${API}/admin/mail/mailboxes/${encodeURIComponent(activeMailbox)}/messages/${selected.id}/resolve`, {}, { headers: authHeaders() });
      setSelected((s) => ({ ...s, ticket: { ...(s.ticket || {}), status: 'resolved' } }));
      setMessages((ms) => ms.map((m) => m.id === selected.id ? { ...m, ticket: { ...(m.ticket || {}), status: 'resolved' } } : m));
      toast.success('Marked as resolved');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to resolve');
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
      {/* Auto-reply control bar (admins only — agents won't have settings) */}
      {settings && (
        <Card className="mb-4" data-testid="auto-reply-bar">
          <CardContent className="py-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Zap className={`h-4 w-4 ${settings.enabled ? 'text-accent' : 'text-muted-foreground'}`} />
              <span className="text-sm font-semibold text-foreground">Instant auto-reply</span>
            </div>
            <button
              onClick={toggleAutoReply}
              data-testid="auto-reply-toggle-btn"
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.enabled ? 'bg-accent' : 'bg-muted'}`}
              aria-label="Toggle auto-reply"
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <Badge variant={settings.enabled ? 'default' : 'secondary'} className="text-[10px]">
              {settings.enabled ? 'ON — new client emails get an instant acknowledgement' : 'OFF'}
            </Badge>
            <div className="ml-auto flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowTemplate((v) => !v)} data-testid="auto-reply-edit-btn">
                <Settings2 className="h-4 w-4 mr-1" /> Template
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAiKnowledge((v) => !v)} data-testid="ai-knowledge-toggle-btn"
                className="border-accent/40 text-accent hover:bg-accent/10">
                <BookOpen className="h-4 w-4 mr-1" /> AI reply knowledge
              </Button>
              <Button size="sm" onClick={runAutoReply} disabled={running} data-testid="auto-reply-run-btn">
                <RefreshCw className={`h-4 w-4 mr-1 ${running ? 'animate-spin' : ''}`} /> Run now
              </Button>
            </div>
            {showAiKnowledge && (
              <div className="w-full mt-2 border-t border-border pt-3 space-y-2" data-testid="ai-knowledge-editor">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5 text-accent" />
                  What the AI knows when it drafts replies (email &amp; WhatsApp). It will never promise refunds or quote prices.
                </p>
                <label className="text-xs font-semibold text-muted-foreground uppercase">Reply tone</label>
                <Input value={aiTone} onChange={(e) => setAiTone(e.target.value)} placeholder="e.g. Warm, friendly and Caribbean-branded" data-testid="ai-tone-input" />
                <label className="text-xs font-semibold text-muted-foreground uppercase">Business info / FAQ</label>
                <Textarea value={aiBusinessInfo} onChange={(e) => setAiBusinessInfo(e.target.value)}
                  className="min-h-[160px] text-xs" placeholder="Delivery areas, hours, fees, how orders & refunds work…"
                  data-testid="ai-knowledge-input" />
                <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer select-none" data-testid="ai-autosuggest-label">
                  <input type="checkbox" checked={aiAutoSuggest} onChange={(e) => setAiAutoSuggest(e.target.checked)}
                    className="h-4 w-4 accent-accent" data-testid="ai-autosuggest-checkbox" />
                  Auto-suggest: pre-draft a reply the moment a message or chat is opened (you still review &amp; send)
                </label>
                <div className="flex justify-end">
                  <Button size="sm" onClick={saveAiKnowledge} disabled={savingAi} data-testid="ai-knowledge-save-btn">
                    {savingAi ? 'Saving…' : 'Save knowledge'}
                  </Button>
                </div>
              </div>
            )}
            {showTemplate && (
              <div className="w-full mt-2 border-t border-border pt-3 space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Subject</label>
                <Input value={tplSubject} onChange={(e) => setTplSubject(e.target.value)} data-testid="auto-reply-subject-input" />
                <label className="text-xs font-semibold text-muted-foreground uppercase">Body (use {'{name}'} for the sender's name)</label>
                <Textarea value={tplBody} onChange={(e) => setTplBody(e.target.value)} className="min-h-[120px] font-mono text-xs" data-testid="auto-reply-body-input" />
                <div className="flex justify-end">
                  <Button size="sm" onClick={saveTemplate} disabled={savingTpl} data-testid="auto-reply-save-btn">
                    {savingTpl ? 'Saving…' : 'Save template'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Mailbox switcher */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Mail className="h-4 w-4 text-gold-500" />
        {mailboxes.map((mb) => (
          <Button key={mb} size="sm" variant={mb === activeMailbox ? 'default' : 'outline'}
            onClick={() => setActiveMailbox(mb)} data-testid={`mailbox-tab-${mb}`}>
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
              <button key={m.id} onClick={() => openMessage(m)} data-testid={`mail-item-${m.id}`}
                className={`w-full text-left p-3 border-b border-matte-700/50 hover:bg-matte-800/50 transition-colors ${selected?.id === m.id ? 'bg-matte-800/60' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm truncate ${m.isRead ? 'text-muted-foreground' : 'font-semibold text-foreground'}`}>
                    {m.from?.emailAddress?.name || m.from?.emailAddress?.address || 'Unknown'}
                  </span>
                  {!m.isRead && <span className="h-2 w-2 rounded-full bg-gold-500 flex-shrink-0" />}
                </div>
                <p className="text-sm text-foreground truncate">{m.subject || '(no subject)'}</p>
                <p className="text-xs text-muted-foreground truncate">{m.bodyPreview}</p>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {m.ticket?.auto_replied && (
                    <span data-testid={`auto-replied-badge-${m.id}`} className="inline-flex items-center gap-1 text-[10px] font-semibold text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                      <Zap className="h-2.5 w-2.5" /> Auto-replied
                    </span>
                  )}
                  {m.ticket?.assigned_to_name && (
                    <span data-testid={`assigned-badge-${m.id}`} className="inline-flex items-center gap-1 text-[10px] font-semibold text-gold-500 bg-gold-500/10 px-1.5 py-0.5 rounded">
                      <UserCheck className="h-2.5 w-2.5" /> {m.ticket.assigned_to_name}
                    </span>
                  )}
                  {m.ticket?.status === 'resolved' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded">
                      <CheckCircle2 className="h-2.5 w-2.5" /> Resolved
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground/70 ml-auto">{fmtDate(m.receivedDateTime)}</span>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Message detail + reply */}
        <Card className="lg:col-span-2">
          {!selected ? (
            <CardContent className="py-16 text-center text-muted-foreground text-sm">
              Select a message to read, assign and reply.
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
                {/* Assignment row */}
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <UserCheck className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Assign to:</span>
                  <select
                    data-testid="mail-assign-select"
                    disabled={assigning}
                    value={selected.ticket?.assigned_to || ''}
                    onChange={(e) => assignTo(e.target.value)}
                    className="text-xs bg-background border border-border rounded-md px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">— Unassigned —</option>
                    {team.map((mem) => (
                      <option key={mem.id} value={mem.id}>{mem.name || mem.email} ({mem.user_type})</option>
                    ))}
                  </select>
                  {selected.ticket?.auto_replied && (
                    <Badge variant="outline" className="text-[10px] text-accent border-accent/40"><Zap className="h-2.5 w-2.5 mr-1" /> Auto-replied</Badge>
                  )}
                  {selected.ticket?.status !== 'resolved' ? (
                    <Button size="sm" variant="outline" className="ml-auto" onClick={resolveTicket} data-testid="mail-resolve-btn">
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Mark resolved
                    </Button>
                  ) : (
                    <Badge className="ml-auto text-[10px] bg-green-500/15 text-green-500"><CheckCircle2 className="h-2.5 w-2.5 mr-1" /> Resolved</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="py-4">
                <div
                  className="prose prose-invert prose-sm max-w-none text-sm text-foreground/90 border border-matte-700/40 rounded-lg p-3 max-h-[35vh] overflow-y-auto bg-matte-900/40"
                  dangerouslySetInnerHTML={{ __html: selected.body?.content || selected.bodyPreview || '' }}
                />
                <div className="mt-4">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reply as {activeMailbox}</label>
                  <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Type your reply…"
                    className="mt-2 min-h-[120px]" data-testid="mail-reply-input" />
                  <div className="flex flex-wrap justify-between items-center gap-2 mt-2">
                    <Button variant="outline" onClick={() => draftWithAi()} disabled={drafting} data-testid="mail-ai-draft-btn"
                      className="border-accent/40 text-accent hover:bg-accent/10">
                      {drafting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                      {drafting ? 'Drafting…' : (reply.trim() ? 'Regenerate' : 'Draft with AI')}
                    </Button>
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
