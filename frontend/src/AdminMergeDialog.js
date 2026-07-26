import React, { useState } from 'react';
import axios from 'axios';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter,
} from './components/ui/dialog';
import { GitMerge, Search, Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

// Admin: merge two accounts of the same person into one login (choose which survives).
const AdminMergeDialog = ({ row, index, onMerged }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [other, setOther] = useState(null);       // the second account
  const [primaryIsRow, setPrimaryIsRow] = useState(true);
  const [merging, setMerging] = useState(false);

  const self = { user_id: row.user_id, name: row.name, email: row.email, user_type: row.user_type };

  const search = async () => {
    if (q.trim().length < 2) { toast.error('Enter at least 2 characters'); return; }
    setSearching(true);
    try {
      const r = await axios.get(`${API}/admin/accounts/lookup`, { params: { q: q.trim() }, headers: authHeaders() });
      setResults((r.data.results || []).filter((x) => x.user_id && x.user_id !== row.user_id));
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Search failed');
    } finally { setSearching(false); }
  };

  const doMerge = async () => {
    if (!other) return;
    const primary = primaryIsRow ? self : other;
    const secondary = primaryIsRow ? other : self;
    setMerging(true);
    try {
      const r = await axios.post(`${API}/admin/accounts/merge`,
        { primary_user_id: primary.user_id, secondary_user_id: secondary.user_id },
        { headers: authHeaders() });
      toast.success(`Merged into ${primary.email || primary.name}. Roles: ${(r.data.available_roles || []).join(', ')}`);
      setOpen(false);
      setOther(null); setResults([]); setQ('');
      onMerged && onMerged();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Merge failed');
    } finally { setMerging(false); }
  };

  const label = (a) => `${a.name || '(no name)'} · ${a.email || 'no email'} · ${a.user_type || 'customer'}`;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setOther(null); setResults([]); setQ(''); } }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" data-testid={`account-merge-btn-${index}`}>
          <GitMerge className="h-4 w-4 mr-1" />Merge
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg" data-testid="admin-merge-dialog">
        <DialogHeader>
          <DialogTitle>Merge accounts</DialogTitle>
          <DialogDescription>Combine this person's two logins into one so they can switch roles. The other login is removed.</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-muted/40 p-2.5 text-sm">
          <span className="text-muted-foreground">This account:</span> <span className="font-medium">{label(self)}</span>
        </div>

        {!other ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Find the other account to merge with:</p>
            <div className="flex gap-2">
              <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="name or email" data-testid="merge-search-input" />
              <Button onClick={search} disabled={searching} data-testid="merge-search-btn">
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            <div className="max-h-52 overflow-y-auto space-y-1">
              {results.map((a, i) => (
                <button key={a.user_id} type="button" onClick={() => setOther(a)} className="w-full text-left text-sm rounded-md border border-border px-2.5 py-1.5 hover:bg-muted" data-testid={`merge-result-${i}`}>
                  {label(a)}
                </button>
              ))}
              {results.length === 0 && q && !searching && <p className="text-xs text-muted-foreground py-2">No other accounts found.</p>}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-muted/40 p-2.5 text-sm">
              <span className="text-muted-foreground">Other account:</span> <span className="font-medium">{label(other)}</span>
              <button type="button" onClick={() => setOther(null)} className="ml-2 text-xs text-neon-cyan underline">change</button>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium">Which login should survive?</p>
              <label className="flex items-center gap-2 text-sm cursor-pointer" data-testid="merge-primary-row">
                <input type="radio" checked={primaryIsRow} onChange={() => setPrimaryIsRow(true)} />
                Keep <strong>{self.email || self.name}</strong>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer" data-testid="merge-primary-other">
                <input type="radio" checked={!primaryIsRow} onChange={() => setPrimaryIsRow(false)} />
                Keep <strong>{other.email || other.name}</strong>
              </label>
            </div>
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded-md p-2">
              <span>{(primaryIsRow ? other : self).email}</span>
              <ArrowRight className="h-3.5 w-3.5" />
              <span className="font-medium">{(primaryIsRow ? self : other).email}</span>
              <span>(the first account is removed)</span>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button onClick={doMerge} disabled={!other || merging} data-testid="merge-confirm-btn">
            {merging ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <GitMerge className="h-4 w-4 mr-1" />}Merge accounts
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminMergeDialog;
