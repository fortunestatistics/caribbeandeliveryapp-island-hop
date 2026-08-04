import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Card, CardContent } from './components/ui/card';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { Checkbox } from './components/ui/checkbox';
import { useToast } from './hooks/use-toast';
import { Banknote, Download, RefreshCw, ChevronDown, ChevronRight, Loader2, CheckCircle2 } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const mask = (v) => (v && v.length > 4 ? '••••' + v.slice(-4) : (v || '—'));
const csvCell = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;

// Bank-specific bulk-transfer templates (confirm exact columns with your bank once open).
const FORMATS = {
  republic: {
    label: 'Republic Bank',
    headers: ['Beneficiary Name', 'Bank Name', 'Branch/Transit', 'Account Number', 'Amount', 'Currency', 'Reference'],
    row: (r) => [r.bank.account_name || r.name, r.bank.bank_name, r.bank.branch, r.bank.account_number, r.amount.toFixed(2), 'USD', `IslandHop ${r.type}`],
  },
  scotiabank: {
    label: 'Scotiabank (ScotiaConnect)',
    headers: ['Beneficiary Name', 'Bank', 'Transit', 'Account Number', 'Currency', 'Amount', 'Reference'],
    row: (r) => [r.bank.account_name || r.name, r.bank.bank_name, r.bank.branch, r.bank.account_number, 'USD', r.amount.toFixed(2), `IslandHop ${r.type}`],
  },
  generic: {
    label: 'Generic / Other bank',
    headers: ['Name', 'Type', 'Country', 'Bank', 'Branch', 'Account Number', 'SWIFT', 'IBAN', 'Currency', 'Amount', 'Method', 'PayPal Email', 'Reference'],
    row: (r) => [r.name, r.type, r.bank.country, r.bank.bank_name, r.bank.branch, r.bank.account_number, r.bank.swift, r.bank.iban, 'USD', r.amount.toFixed(2), r.payout_method, r.paypal_email, `IslandHop ${r.type}`],
  },
};

export default function AdminPayoutBatch() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState('republic');
  const [selected, setSelected] = useState({});
  const [marking, setMarking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/admin/payouts/owing`, { headers: authHeaders() });
      setData(r.data);
      const pre = {};
      [...(r.data.merchants || []), ...(r.data.drivers || [])].forEach((x) => { pre[`${x.type}-${x.entity_id}`] = true; });
      setSelected(pre);
    } catch (_) {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const rows = data ? [...(data.merchants || []), ...(data.drivers || [])] : [];
  const bankRows = rows.filter((r) => r.payout_method !== 'paypal'); // PayPal handled in its own panel
  const chosen = bankRows.filter((r) => selected[`${r.type}-${r.entity_id}`]);
  const chosenTotal = chosen.reduce((s, r) => s + r.amount, 0);

  const exportCsv = () => {
    if (!chosen.length) { toast({ title: 'Nothing selected', variant: 'destructive' }); return; }
    const fmt = FORMATS[format];
    const lines = [fmt.headers.map(csvCell).join(',')];
    chosen.forEach((r) => lines.push(fmt.row(r).map(csvCell).join(',')));
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `islandhop-payouts-${format}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'CSV exported', description: `${chosen.length} recipients · $${chosenTotal.toFixed(2)}` });
  };

  const markPaid = async () => {
    if (!chosen.length) { toast({ title: 'Nothing selected', variant: 'destructive' }); return; }
    if (!window.confirm(`Mark ${chosen.length} recipients as PAID ($${chosenTotal.toFixed(2)})? Only do this after you've uploaded the file to your bank.`)) return;
    setMarking(true);
    try {
      const items = chosen.map((r) => ({ type: r.type, entity_id: r.entity_id, amount: r.amount, order_ids: r.order_ids || [] }));
      const res = await axios.post(`${API}/admin/payouts/mark-paid`, { method: 'bank_transfer', items }, { headers: authHeaders() });
      toast({ title: 'Marked as paid', description: `${res.data.marked} recipients · $${res.data.total.toFixed(2)}` });
      load();
    } catch (e) {
      toast({ title: 'Failed', description: e?.response?.data?.detail || 'Try again.', variant: 'destructive' });
    } finally {
      setMarking(false);
    }
  };

  const toggle = (r) => setSelected((s) => ({ ...s, [`${r.type}-${r.entity_id}`]: !s[`${r.type}-${r.entity_id}`] }));

  return (
    <Card className="mb-4 border-l-4 border-l-green-600" data-testid="payout-batch-card">
      <CardContent className="p-4">
        <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between gap-3 text-left" data-testid="payout-batch-toggle">
          <div className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-green-600" />
            <div>
              <p className="font-semibold text-sm flex items-center gap-2">
                Bank Payout Batch
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : (
                  <Badge className="bg-green-100 text-green-800" data-testid="payout-batch-total">
                    ${data?.totals?.grand_total?.toFixed(2) || '0.00'} owed
                  </Badge>
                )}
              </p>
              <p className="text-xs text-muted-foreground">Review what's owed, export a bank bulk-transfer file, then mark paid.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); load(); }} data-testid="payout-batch-refresh" />
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </div>
        </button>

        {open && (
          <div className="mt-3 space-y-3" data-testid="payout-batch-body">
            {bankRows.length === 0 && !loading && (
              <p className="text-sm text-muted-foreground">No bank-transfer payouts owed right now. (PayPal recipients appear in the PayPal Payouts panel.)</p>
            )}

            {bankRows.length > 0 && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Bank format:</span>
                  {Object.entries(FORMATS).map(([k, f]) => (
                    <Button key={k} size="sm" variant={format === k ? 'default' : 'outline'} className={format === k ? 'bg-green-600 text-white hover:bg-green-700' : ''} onClick={() => setFormat(k)} data-testid={`payout-format-${k}`}>
                      {f.label}
                    </Button>
                  ))}
                </div>

                <div className="rounded-md border border-border divide-y">
                  {bankRows.map((r) => {
                    const key = `${r.type}-${r.entity_id}`;
                    return (
                      <div key={key} className="flex items-center gap-3 px-3 py-2 text-sm" data-testid={`payout-row-${r.entity_id}`}>
                        <Checkbox checked={!!selected[key]} onCheckedChange={() => toggle(r)} data-testid={`payout-select-${r.entity_id}`} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{r.name} <span className="text-xs text-muted-foreground capitalize">· {r.type}{r.orders_count != null ? ` · ${r.orders_count} orders` : ''}</span></p>
                          <p className="text-xs text-muted-foreground truncate">{r.bank.bank_name || 'No bank on file'} · {mask(r.bank.account_number)} {r.bank.country ? `· ${r.bank.country}` : ''}</p>
                        </div>
                        <span className="font-semibold">${r.amount.toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm">Selected: <b>{chosen.length}</b> · <b>${chosenTotal.toFixed(2)}</b> <span className="text-xs text-muted-foreground">(USD — convert at your bank if paying in TTD)</span></span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={exportCsv} data-testid="payout-export-btn"><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
                    <Button size="sm" className="bg-green-600 text-white hover:bg-green-700" onClick={markPaid} disabled={marking} data-testid="payout-mark-paid-btn">
                      {marking ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="h-4 w-4 mr-1" /> Mark selected paid</>}
                    </Button>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">Tip: export → upload the file in RepublicOnline / ScotiaConnect → then click "Mark selected paid". Confirm the exact column layout with your bank; I can fine-tune it to their template.</p>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
