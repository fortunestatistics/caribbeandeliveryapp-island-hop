import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Badge } from './components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { useToast } from './hooks/use-toast';
import { ArrowLeft, Ticket, Plus, Trash2, Sparkles, Loader2 } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const authHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const randomCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

const MerchantCoupons = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [coupons, setCoupons] = useState([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    code: '', discount_type: 'percentage', discount_value: '',
    min_order_amount: '', expiry_date: '', usage_limit: '',
  });

  const load = async () => {
    try {
      const res = await axios.get(`${API}/merchant/coupons`, { headers: authHeaders() });
      setCoupons(res.data || []);
    } catch (e) {
      toast({ title: 'Could not load coupons', description: e?.response?.data?.detail || 'Make sure you have a merchant account.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const create = async (e) => {
    e.preventDefault();
    if (!form.discount_value || Number(form.discount_value) <= 0) {
      toast({ title: 'Enter a discount value', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      const body = {
        code: form.code.trim() || undefined,
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        min_order_amount: form.min_order_amount ? Number(form.min_order_amount) : 0,
        expiry_date: form.expiry_date || undefined,
        usage_limit: form.usage_limit ? Number(form.usage_limit) : undefined,
      };
      await axios.post(`${API}/merchant/coupons`, body, { headers: authHeaders() });
      toast({ title: 'Coupon created' });
      setForm({ code: '', discount_type: 'percentage', discount_value: '', min_order_amount: '', expiry_date: '', usage_limit: '' });
      load();
    } catch (err) {
      toast({ title: 'Could not create coupon', description: err?.response?.data?.detail || 'Please try again.', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const toggle = async (c) => {
    try {
      await axios.patch(`${API}/merchant/coupons/${c.id}`, { active: !c.active }, { headers: authHeaders() });
      load();
    } catch (e) {
      toast({ title: 'Update failed', variant: 'destructive' });
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete coupon ${c.code}?`)) return;
    try {
      await axios.delete(`${API}/merchant/coupons/${c.id}`, { headers: authHeaders() });
      toast({ title: 'Coupon deleted' });
      load();
    } catch (e) {
      toast({ title: 'Delete failed', variant: 'destructive' });
    }
  };

  const valueLabel = (c) => (c.discount_type === 'percentage' ? `${c.discount_value}% off` : `$${Number(c.discount_value).toFixed(2)} off`);

  return (
    <div className="min-h-screen bg-background py-8" data-testid="merchant-coupons-page">
      <div className="container mx-auto px-4 max-w-4xl">
        <Button variant="ghost" onClick={() => navigate('/vendor-dashboard')} className="mb-4" data-testid="coupons-back-btn">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
        </Button>

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Ticket className="h-7 w-7 text-gold-500" /> Coupons
          </h1>
          <p className="text-muted-foreground">Create discount codes customers can redeem at checkout.</p>
        </div>

        {/* Create form */}
        <Card className="mb-8">
          <CardHeader><CardTitle className="text-lg">Create a coupon</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={create} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="code">Coupon code</Label>
                <div className="flex gap-2 mt-1.5">
                  <Input id="code" data-testid="coupon-code-input" value={form.code} maxLength={20}
                    onChange={(e) => setField('code', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    placeholder="Auto-generated if blank" />
                  <Button type="button" variant="outline" onClick={() => setField('code', randomCode())} data-testid="coupon-generate-btn">
                    <Sparkles className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label>Discount type</Label>
                <Select value={form.discount_type} onValueChange={(v) => setField('discount_type', v)}>
                  <SelectTrigger className="mt-1.5" data-testid="coupon-type-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage off (%)</SelectItem>
                    <SelectItem value="fixed">Fixed amount off ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="value">{form.discount_type === 'percentage' ? 'Percentage (%)' : 'Amount ($)'}</Label>
                <Input id="value" data-testid="coupon-value-input" type="number" min="0" step="0.01" value={form.discount_value}
                  onChange={(e) => setField('discount_value', e.target.value)} placeholder={form.discount_type === 'percentage' ? '15' : '5.00'} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="minorder">Minimum order ($) <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input id="minorder" data-testid="coupon-minorder-input" type="number" min="0" step="0.01" value={form.min_order_amount}
                  onChange={(e) => setField('min_order_amount', e.target.value)} placeholder="0.00" className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="expiry">Expiry date <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input id="expiry" data-testid="coupon-expiry-input" type="date" value={form.expiry_date}
                  onChange={(e) => setField('expiry_date', e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="limit">Usage limit <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input id="limit" data-testid="coupon-limit-input" type="number" min="1" step="1" value={form.usage_limit}
                  onChange={(e) => setField('usage_limit', e.target.value)} placeholder="Unlimited" className="mt-1.5" />
              </div>
              <div className="md:col-span-2">
                <Button type="submit" disabled={creating} className="w-full" data-testid="coupon-create-btn">
                  {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                  Create Coupon
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* List */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Your coupons</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-gold-500" /></div>
            ) : coupons.length === 0 ? (
              <div className="text-center py-10">
                <Ticket className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-muted-foreground">No coupons yet. Create your first one above.</p>
              </div>
            ) : (
              <div className="space-y-3" data-testid="coupons-list">
                {coupons.map((c) => {
                  const inactive = !c.active || c.is_expired;
                  return (
                    <div key={c.id} className={`flex items-center justify-between gap-3 rounded-lg border p-4 ${inactive ? 'opacity-60' : ''}`} data-testid={`coupon-row-${c.code}`}>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-foreground text-lg">{c.code}</span>
                          <Badge className="bg-gold-500/15 text-gold-700">{valueLabel(c)}</Badge>
                          {c.is_expired ? <Badge variant="outline" className="text-red-600 border-red-300">Expired</Badge>
                            : c.active ? <Badge className="bg-green-100 text-green-700">Active</Badge>
                            : <Badge variant="outline">Inactive</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Redeemed {c.used_count}{c.usage_limit ? ` / ${c.usage_limit}` : ''} time{c.used_count === 1 ? '' : 's'}
                          {c.min_order_amount ? ` · min $${Number(c.min_order_amount).toFixed(2)}` : ''}
                          {c.expiry_date ? ` · expires ${String(c.expiry_date).slice(0, 10)}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {!c.is_expired && (
                          <Button size="sm" variant="outline" onClick={() => toggle(c)} data-testid={`coupon-toggle-${c.code}`}>
                            {c.active ? 'Deactivate' : 'Activate'}
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => remove(c)} data-testid={`coupon-delete-${c.code}`}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MerchantCoupons;
