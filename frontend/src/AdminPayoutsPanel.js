import React, { useState } from 'react';
import { Button } from './components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/tabs';
import { Banknote, ChevronDown, Route, Wallet, Landmark } from 'lucide-react';
import AdminMerchantsMissingCountry from './AdminMerchantsMissingCountry';
import AdminPayPalPayouts from './AdminPayPalPayouts';
import AdminPayoutBatch from './AdminPayoutBatch';

// One collapsible "Payouts & Payments" option button that groups:
// payment-route readiness, PayPal payouts, and the bank payout batch.
const AdminPayoutsPanel = () => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('paypal');

  return (
    <div className="mt-4 rounded-xl border border-border bg-card overflow-hidden" data-testid="payouts-panel">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
        data-testid="payouts-panel-toggle"
      >
        <span className="flex items-center gap-2 font-semibold text-foreground">
          <Banknote className="h-5 w-5 text-neon-cyan" />
          Payouts &amp; Payments
          <span className="text-xs font-normal text-muted-foreground ml-1">PayPal · bank batch · route readiness</span>
        </span>
        <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-border pt-3">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-3">
              <TabsTrigger value="paypal" data-testid="payouts-tab-paypal"><Wallet className="h-4 w-4 mr-1" />PayPal payouts</TabsTrigger>
              <TabsTrigger value="bank" data-testid="payouts-tab-bank"><Landmark className="h-4 w-4 mr-1" />Bank batch</TabsTrigger>
              <TabsTrigger value="route" data-testid="payouts-tab-route"><Route className="h-4 w-4 mr-1" />Route readiness</TabsTrigger>
            </TabsList>
            <TabsContent value="paypal"><AdminPayPalPayouts /></TabsContent>
            <TabsContent value="bank"><AdminPayoutBatch /></TabsContent>
            <TabsContent value="route"><AdminMerchantsMissingCountry /></TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
};

export default AdminPayoutsPanel;
