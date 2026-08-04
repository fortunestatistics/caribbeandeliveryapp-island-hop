import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Landmark, Save, Eye, EyeOff, ArrowLeft } from 'lucide-react';

const COUNTRIES = [
  'Trinidad & Tobago', 'Jamaica', 'Barbados', 'Guyana', 'Grenada',
  'St. Lucia', 'Antigua & Barbuda', 'United States', 'Canada', 'United Kingdom', 'Other',
];

export const MaskedField = ({ label, value, onChange, testid, mono }) => {
  const [reveal, setReveal] = useState(false);
  const v = value || '';
  const last4 = v.slice(-4);
  return (
    <div>
      <Label>{label}</Label>
      {v && !reveal ? (
        <div className="flex items-center gap-2">
          <div className={`flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ${mono ? 'font-mono' : ''}`} data-testid={`${testid}-masked`}>
            ••••{last4}
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={() => setReveal(true)} data-testid={`${testid}-reveal`} aria-label="Reveal">
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Input value={v} onChange={(e) => onChange(e.target.value)} className="flex-1" data-testid={testid} />
          {v && (
            <Button type="button" variant="ghost" size="icon" onClick={() => setReveal(false)} data-testid={`${testid}-hide`} aria-label="Hide">
              <EyeOff className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

// Reusable banking (payout) section used by merchants and drivers.
// `banking` is the banking_info object; `onChange` receives the updated object.
export const BankAccountSection = ({ banking = {}, onChange, onSave, saving, showPayoutMethod = true, onBack }) => {
  const b = {
    country: banking.country || 'Trinidad & Tobago',
    bank_name: banking.bank_name || '',
    account_name: banking.account_name || '',
    account_number: banking.account_number || '',
    branch: banking.branch || '',
    swift: banking.swift || '',
    iban: banking.iban || '',
    payout_method: banking.payout_method || 'bank',
    paypal_email: banking.paypal_email || '',
  };
  const set = (k, v) => onChange({ ...b, [k]: v });
  const isIntl = b.country && b.country !== 'Trinidad & Tobago';
  const isPaypal = b.payout_method === 'paypal';

  return (
    <Card className="mb-6" data-testid="bank-account-section">
      <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Landmark className="h-5 w-5 text-gold-500" /> Banking &amp; Payouts</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Where your earnings are paid out. Update any time your details change.</p>

        {showPayoutMethod && (
          <div>
            <Label>Payout method</Label>
            <div className="flex gap-2 mt-1">
              <Button type="button" variant={!isPaypal ? 'default' : 'outline'} className={!isPaypal ? 'bg-gold-gradient text-white' : ''} onClick={() => set('payout_method', 'bank')} data-testid="payout-method-bank">
                Bank transfer
              </Button>
              <Button type="button" variant={isPaypal ? 'default' : 'outline'} className={isPaypal ? 'bg-[#003087] text-white hover:bg-[#00256b]' : ''} onClick={() => set('payout_method', 'paypal')} data-testid="payout-method-paypal">
                PayPal
              </Button>
            </div>
          </div>
        )}

        {isPaypal ? (
          <div>
            <Label htmlFor="paypal-email">PayPal email</Label>
            <Input id="paypal-email" type="email" value={b.paypal_email} onChange={(e) => set('paypal_email', e.target.value)} placeholder="you@example.com" data-testid="settings-paypal-email" />
            <p className="text-xs text-muted-foreground mt-1">We'll send your payouts to this PayPal account.</p>
          </div>
        ) : (
          <>
            <div>
              <Label htmlFor="bank-country">Country</Label>
              <select
                id="bank-country"
                value={b.country}
                onChange={(e) => set('country', e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                data-testid="settings-bank-country"
              >
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="bank-name">Bank name</Label>
                <Input id="bank-name" value={b.bank_name} onChange={(e) => set('bank_name', e.target.value)} data-testid="settings-bank-name" />
              </div>
              <div>
                <Label htmlFor="acct-name">Account holder name</Label>
                <Input id="acct-name" value={b.account_name} onChange={(e) => set('account_name', e.target.value)} data-testid="settings-account-holder" />
              </div>
              <MaskedField label="Account number" value={b.account_number} onChange={(v) => set('account_number', v)} testid="settings-account-number" mono />
              <div>
                <Label htmlFor="branch">{isIntl ? 'Branch / Transit' : 'Branch'}</Label>
                <Input id="branch" value={b.branch} onChange={(e) => set('branch', e.target.value)} data-testid="settings-bank-branch" />
              </div>
            </div>
            {isIntl && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="swift">SWIFT / BIC</Label>
                  <Input id="swift" value={b.swift} onChange={(e) => set('swift', e.target.value.toUpperCase())} placeholder="e.g. RBTTTTPX" data-testid="settings-bank-swift" />
                </div>
                <MaskedField label="IBAN" value={b.iban} onChange={(v) => set('iban', v.toUpperCase())} testid="settings-bank-iban" mono />
              </div>
            )}
          </>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button onClick={onSave} disabled={saving} className="bg-gold-gradient text-white" data-testid="settings-save-bank-btn">
            <Save className="h-4 w-4 mr-2" /> {saving ? 'Saving…' : 'Save banking details'}
          </Button>
          {onBack && (
            <Button type="button" variant="outline" onClick={onBack} data-testid="bank-back-to-dashboard-btn">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to dashboard
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
