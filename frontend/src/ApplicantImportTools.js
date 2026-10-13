import React, { useState } from 'react';
import axios from 'axios';
import { Button } from './components/ui/button';
import { Textarea } from './components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './components/ui/dialog';
import { RadioGroup, RadioGroupItem } from './components/ui/radio-group';
import { Label } from './components/ui/label';
import { RefreshCw, Upload, Loader2, MailPlus } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

// Turn pasted CSV or JSON into an array of plain objects. Field names can be anything —
// the backend normalizes them (fullName/name, phoneNumber/mobile, businessName, etc.).
const parsePasted = (raw) => {
  const text = (raw || '').trim();
  if (!text) return [];
  // JSON array or single object
  if (text.startsWith('[') || text.startsWith('{')) {
    const data = JSON.parse(text);
    return Array.isArray(data) ? data : [data];
  }
  // CSV: first row = headers
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const splitRow = (l) => l.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
  const headers = splitRow(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitRow(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = cells[i] ?? ''; });
    return obj;
  });
};

export const ApplicantImportTools = ({ onDone }) => {
  const [syncing, setSyncing] = useState(false);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('driver');
  const [raw, setRaw] = useState('');
  const [importing, setImporting] = useState(false);

  const syncFromEmail = async () => {
    setSyncing(true);
    try {
      const r = await axios.post(`${API}/admin/applicants/sync-email`, {}, { headers: authHeaders() });
      const n = (r.data.drivers_created || 0) + (r.data.merchants_created || 0);
      toast.success(n > 0 ? `Imported ${n} new application(s) from email` : 'No new applications in the inbox');
      if (n > 0 && onDone) onDone();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Email sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const doImport = async () => {
    let items;
    try {
      items = parsePasted(raw);
    } catch (e) {
      toast.error('Could not read that — paste valid JSON or CSV');
      return;
    }
    if (!items.length) { toast.error('Nothing to import — paste some rows first'); return; }
    setImporting(true);
    try {
      const r = await axios.post(`${API}/admin/applicants/import`, { category, items }, { headers: authHeaders() });
      const c = r.data.created || {};
      toast.success(`Imported ${r.data.total_created} applicant(s) (${c.drivers || 0} driver, ${c.merchants || 0} merchant). ${r.data.skipped ? r.data.skipped + ' duplicate(s) skipped.' : ''}`);
      setOpen(false); setRaw('');
      if (onDone) onDone();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={syncFromEmail} disabled={syncing} data-testid="applicants-sync-email-btn"
        title="Pull applications from the shared notification inbox into this admin">
        {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MailPlus className="h-4 w-4 mr-2" />}
        {syncing ? 'Syncing…' : 'Sync from email'}
      </Button>
      <Button variant="outline" onClick={() => setOpen(true)} data-testid="applicants-import-btn">
        <Upload className="h-4 w-4 mr-2" /> Import
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg" data-testid="applicants-import-dialog">
          <DialogHeader>
            <DialogTitle>Import applicants</DialogTitle>
            <DialogDescription>
              Paste a list of applicants (JSON array or CSV with a header row). Field names are flexible —
              e.g. name/fullName, email, phone/mobile, city, businessName. Duplicates (same email/phone) are skipped.
            </DialogDescription>
          </DialogHeader>

          <RadioGroup value={category} onValueChange={setCategory} className="flex gap-6" data-testid="import-category-group">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="driver" id="cat-driver" data-testid="import-category-driver" />
              <Label htmlFor="cat-driver">Drivers</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="merchant" id="cat-merchant" data-testid="import-category-merchant" />
              <Label htmlFor="cat-merchant">Merchants</Label>
            </div>
          </RadioGroup>

          <Textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            className="min-h-[200px] font-mono text-xs"
            placeholder={'CSV example:\nname,email,phone,city\nJane Doe,jane@mail.com,+18681234567,Arima\n\nor JSON:\n[{"fullName":"Jane Doe","email":"jane@mail.com","phone":"+18681234567"}]'}
            data-testid="import-textarea"
          />

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={doImport} disabled={importing} data-testid="import-submit-btn">
              {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              {importing ? 'Importing…' : 'Import applicants'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ApplicantImportTools;
