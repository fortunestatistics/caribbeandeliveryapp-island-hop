import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { CreditCard, ShieldCheck, FlaskConical, AlertTriangle } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const AdminPaymentMode = () => {
  const [data, setData] = useState(null);

  useEffect(() => {
    axios.get(`${API}/admin/payment-mode`, { headers: authHeaders() })
      .then((res) => setData(res.data))
      .catch(() => setData(null));
  }, []);

  if (!data) return null;

  const anyLive = data.any_payment_live;

  return (
    <Card data-testid="admin-payment-mode" className={anyLive ? 'border-green-500/40' : 'border-amber-500/40'}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2"><CreditCard className="h-5 w-5" /> Payment Mode</span>
          {anyLive ? (
            <Badge className="bg-green-500/15 text-green-700 border-green-500/30" data-testid="payment-mode-overall">
              <ShieldCheck className="h-3.5 w-3.5 mr-1" /> LIVE — real money
            </Badge>
          ) : (
            <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30" data-testid="payment-mode-overall">
              <FlaskConical className="h-3.5 w-3.5 mr-1" /> TEST mode — no real money
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {anyLive && !data.all_payment_live && (
          <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-500/10 rounded p-2 mb-3" data-testid="payment-mode-mixed-warning">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Mixed mode: some payment rails are LIVE while others are still in TEST/SANDBOX. Double-check before launch.</span>
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {data.providers.map((p) => {
            const isLive = p.live;
            const isMocked = p.mode === 'mocked';
            return (
              <div key={p.name} className="rounded-lg border border-border p-3" data-testid={`payment-provider-${p.name.toLowerCase().replace(/\s+/g, '-')}`}>
                <div className="text-sm font-medium">{p.name}</div>
                <Badge
                  className={
                    isLive
                      ? 'bg-green-500/15 text-green-700 border-green-500/30 mt-1'
                      : isMocked
                        ? 'bg-slate-500/15 text-slate-600 border-slate-500/30 mt-1'
                        : 'bg-amber-500/15 text-amber-700 border-amber-500/30 mt-1'
                  }
                >
                  {p.mode.toUpperCase()}
                </Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminPaymentMode;
