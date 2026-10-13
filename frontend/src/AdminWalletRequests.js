import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './components/ui/dialog';
import { Landmark, Check, X, RefreshCw, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const AdminWalletRequests = () => {
  const [reqs, setReqs] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(false);
  const [proofView, setProofView] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/admin/wallet/funding-requests?status=${filter}`, { headers: authHeaders() });
      setReqs(r.data.requests || []);
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed to load'); } finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const act = async (id, action, r) => {
    const isDep = r?.direction === 'deposit';
    const verb = action === 'approve'
      ? (isDep ? `credit ${r.amount} ${r.currency} to ${r.user_email}'s wallet` : `mark ${r.amount} ${r.currency} as sent to ${r.destination || r.user_email} and debit their wallet`)
      : `reject this ${r?.direction} request`;
    if (!window.confirm(`Are you sure you want to ${verb}? The client will be emailed.`)) return;
    try {
      await axios.post(`${API}/admin/wallet/funding-requests/${id}/${action}`, {}, { headers: authHeaders() });
      toast.success(action === 'approve' ? (isDep ? 'Wallet credited & client emailed' : 'Marked paid, wallet debited & client emailed') : 'Rejected & client emailed');
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Action failed'); }
  };

  return (
    <Card data-testid="admin-wallet-requests">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2"><Landmark className="h-5 w-5 text-gold-500" /> Wallet funding requests</span>
          <span className="flex items-center gap-2">
            {['pending', 'approved', 'rejected', 'all'].map((f) => (
              <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => setFilter(f)} data-testid={`wallet-filter-${f}`}>{f}</Button>
            ))}
            <Button size="sm" variant="ghost" onClick={load}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></Button>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {reqs.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">No {filter} requests.</p>}
        <div className="space-y-2">
          {reqs.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3 border border-border rounded-lg" data-testid={`wallet-req-${r.id}`}>
              <div className="flex items-center gap-3">
                {r.direction === 'deposit'
                  ? <ArrowDownToLine className="h-4 w-4 text-green-500" />
                  : <ArrowUpFromLine className="h-4 w-4 text-amber-500" />}
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {r.direction === 'deposit' ? 'Deposit' : 'Withdraw'} {r.amount} {r.currency} · <span className="text-muted-foreground font-normal">{r.method}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{r.user_email} {r.reference ? `· ref: ${r.reference}` : ''}{r.destination ? `· to: ${r.destination}` : ''}</p>
                  {r.proof_base64 && (
                    <button
                      type="button"
                      onClick={() => setProofView(r.proof_base64)}
                      className="mt-1 flex items-center gap-2 group"
                      data-testid={`proof-${r.id}`}
                    >
                      <img
                        src={r.proof_base64}
                        alt="Proof of transfer"
                        className="h-10 w-10 rounded object-cover border border-border group-hover:ring-2 group-hover:ring-gold-500 transition-all"
                      />
                      <span className="text-xs text-gold-500 underline">Tap to view proof</span>
                    </button>
                  )}
                  {r.payout_auto && <span className="text-[10px] text-green-500">· auto-paid via PayPal</span>}
                  {r.payout_error && <span className="text-[10px] text-rose-500">· auto-payout failed, send manually</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={`text-[10px] ${r.status === 'pending' ? 'bg-amber-500/15 text-amber-500' : r.status === 'approved' ? 'bg-green-500/15 text-green-500' : 'bg-rose-500/15 text-rose-500'}`}>{r.status}</Badge>
                {r.status === 'pending' && (
                  <>
                    <Button size="sm" onClick={() => act(r.id, 'approve', r)} data-testid={`approve-${r.id}`}>
                      <Check className="h-4 w-4 mr-1" /> {r.direction === 'deposit' ? 'Mark paid & credit' : 'Send & mark paid'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => act(r.id, 'reject', r)} data-testid={`reject-${r.id}`}><X className="h-4 w-4" /></Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      <Dialog open={!!proofView} onOpenChange={(o) => !o && setProofView(null)}>
        <DialogContent className="max-w-3xl" data-testid="proof-viewer-dialog">
          <DialogHeader>
            <DialogTitle>Proof of transfer</DialogTitle>
          </DialogHeader>
          {proofView && (
            <div className="max-h-[75vh] overflow-auto flex justify-center">
              <img src={proofView} alt="Proof of transfer" className="max-w-full rounded-lg" data-testid="proof-viewer-image" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default AdminWalletRequests;
