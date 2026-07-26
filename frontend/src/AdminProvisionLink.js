import React, { useState } from 'react';
import axios from 'axios';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter,
} from './components/ui/dialog';
import { LifeBuoy, Search, Loader2, Link2, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

// Link an approved merchant application (whose signup email matches no account) to an
// EXISTING account — searched & picked — then provision the vendor record.
const AdminProvisionLink = ({ row, index, onDone }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [picked, setPicked] = useState(null);
  const [manualEmail, setManualEmail] = useState('');
  const [provisioning, setProvisioning] = useState(false);

  const reset = () => { setQ(''); setResults([]); setPicked(null); setManualEmail(''); };

  const search = async () => {
    if (q.trim().length < 2) { toast.error('Enter at least 2 characters'); return; }
    setSearching(true);
    try {
      const r = await axios.get(`${API}/admin/accounts/lookup`, { params: { q: q.trim() }, headers: authHeaders() });
      setResults((r.data.results || []).filter((x) => x.user_id));
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Search failed');
    } finally { setSearching(false); }
  };

  const provision = async () => {
    const body = { application_id: row.application_id };
    if (picked) body.link_user_id = picked.user_id;
    else if (manualEmail.trim()) body.email = manualEmail.trim();
    else { toast.error('Pick an account or enter a signup email'); return; }
    setProvisioning(true);
    try {
      const r = await axios.post(`${API}/admin/accounts/repair`, body, { headers: authHeaders() });
      const url = r.data.storefront_url;
      toast.success(`Linked & provisioned: ${(r.data.actions || []).join('; ')}`, {
        duration: 10000,
        action: url ? { label: 'Open profile', onClick: () => window.open(url, '_blank', 'noopener') } : undefined,
      });
      setOpen(false);
      reset();
      onDone && onDone();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Link & provision failed');
    } finally { setProvisioning(false); }
  };

  const label = (a) => `${a.name || '(no name)'} · ${a.email || 'no email'} · ${a.user_type || 'customer'}`;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid={`account-provision-link-btn-${index}`}>
          <Link2 className="h-4 w-4 mr-1" />Link &amp; provision
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg" data-testid="provision-link-dialog">
        <DialogHeader>
          <DialogTitle>Link &amp; provision merchant</DialogTitle>
          <DialogDescription>This approved application isn't linked to any login yet. Connect it to an existing account, then provision the storefront.</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-muted/40 p-2.5 text-sm">
          <span className="text-muted-foreground">Application:</span>{' '}
          <span className="font-medium">{row.name || '(unnamed)'}</span>
          {row.email ? <span className="text-muted-foreground"> · signup email on file: {row.email}</span> : null}
        </div>

        {!picked ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Find the account this merchant actually uses (any email):</p>
            <div className="flex gap-2">
              <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="search name or email" data-testid="provision-search-input" />
              <Button onClick={search} disabled={searching} data-testid="provision-search-btn">
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {results.map((a, i) => (
                <button key={a.user_id} type="button" onClick={() => setPicked(a)} className="w-full text-left text-sm rounded-md border border-border px-2.5 py-1.5 hover:bg-muted" data-testid={`provision-result-${i}`}>
                  {label(a)}
                </button>
              ))}
              {results.length === 0 && q && !searching && <p className="text-xs text-muted-foreground py-2">No accounts found.</p>}
            </div>
            <div className="pt-1 border-t border-border">
              <p className="text-[11px] text-muted-foreground mb-1">…or link by exact signup email:</p>
              <Input value={manualEmail} onChange={(e) => setManualEmail(e.target.value)} placeholder="merchant@email.com" data-testid="provision-manual-email" />
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-green-200 bg-green-50 p-2.5 text-sm flex items-center gap-2" data-testid="provision-picked">
            <UserCheck className="h-4 w-4 text-green-600" />
            <span>Linking to <span className="font-medium">{label(picked)}</span></span>
            <button type="button" onClick={() => setPicked(null)} className="ml-auto text-xs text-neon-cyan underline">change</button>
          </div>
        )}

        <DialogFooter>
          <Button onClick={provision} disabled={provisioning || (!picked && !manualEmail.trim())} data-testid="provision-link-confirm">
            {provisioning ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <LifeBuoy className="h-4 w-4 mr-1" />}Link &amp; provision
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminProvisionLink;
