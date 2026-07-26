import React, { useState } from 'react';
import axios from 'axios';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Textarea } from './components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter,
} from './components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/tabs';
import { Pencil, Loader2, Save, Upload, Store, User, Truck, KeyRound, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { fileToConstrainedDataURL } from './imageUtils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const Field = ({ label, value, onChange, testid, placeholder, type = 'text' }) => (
  <div className="space-y-1">
    <Label className="text-xs text-muted-foreground">{label}</Label>
    <Input value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} type={type} data-testid={testid} />
  </div>
);

// Admin edit-any-profile dialog: opens from an Account Repair row, edits the user's
// account + merchant + driver records directly (admin-authenticated, audited).
const AdminManageProfile = ({ row, index }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState(null);          // full manage payload
  const [account, setAccount] = useState({});
  const [merchant, setMerchant] = useState(null);
  const [driver, setDriver] = useState(null);
  const [tab, setTab] = useState('account');
  const [customPw, setCustomPw] = useState('');
  const [tempPw, setTempPw] = useState('');
  const [resetting, setResetting] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/admin/users/${row.user_id}/manage`, { headers: authHeaders() });
      setData(r.data);
      setAccount({ ...r.data.account });
      setMerchant(r.data.merchant ? { ...r.data.merchant, address: { ...(r.data.merchant.address || {}) } } : null);
      setDriver(r.data.driver ? { ...r.data.driver } : null);
      setTab(r.data.merchant ? 'merchant' : (r.data.driver ? 'driver' : 'account'));
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not load this profile');
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const onOpenChange = (v) => {
    setOpen(v);
    if (v) load();
  };

  const saveAccount = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/admin/users/${row.user_id}/account`, {
        name: account.name, phone: account.phone, email: account.email, banking_info: account.banking_info,
      }, { headers: authHeaders() });
      toast.success('Account details saved');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to save account');
    } finally { setSaving(false); }
  };

  const saveMerchant = async () => {
    if (!merchant?.vendor_id) return;
    setSaving(true);
    try {
      await axios.put(`${API}/admin/merchants/${merchant.vendor_id}/profile`, {
        name: merchant.name, description: merchant.description, cuisine_type: merchant.cuisine_type,
        phone: merchant.phone, email: merchant.email, address: merchant.address,
        delivery_fee: merchant.delivery_fee === '' ? null : merchant.delivery_fee,
        minimum_order: merchant.minimum_order === '' ? null : merchant.minimum_order,
        banking_info: merchant.banking_info,
      }, { headers: authHeaders() });
      toast.success('Merchant profile saved');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to save merchant');
    } finally { setSaving(false); }
  };

  const uploadImage = async (kind, file) => {
    if (!file || !merchant?.vendor_id) return;
    try {
      const dataUrl = await fileToConstrainedDataURL(file);
      await axios.put(`${API}/admin/merchants/${merchant.vendor_id}/storefront`, { [kind]: dataUrl }, { headers: authHeaders() });
      setMerchant((m) => ({ ...m, [kind]: dataUrl }));
      toast.success(`${kind === 'logo' ? 'Logo' : 'Cover'} uploaded`);
    } catch (e) {
      toast.error(e?.message || e?.response?.data?.detail || 'Image upload failed');
    }
  };

  const saveDriver = async () => {
    if (!driver?.driver_id) return;
    setSaving(true);
    try {
      await axios.put(`${API}/admin/drivers/${driver.driver_id}/profile`, {
        license_number: driver.license_number, vehicle_type: driver.vehicle_type,
        vehicle_plate: driver.vehicle_plate, banking_info: driver.banking_info,
      }, { headers: authHeaders() });
      toast.success('Driver details saved');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to save driver');
    } finally { setSaving(false); }
  };

  const resetPassword = async (generate) => {
    if (!generate && customPw.trim().length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setResetting(true);
    setTempPw('');
    setCopied(false);
    try {
      const r = await axios.put(`${API}/admin/users/${row.user_id}/password`,
        generate ? { generate: true } : { password: customPw.trim() },
        { headers: authHeaders() });
      setTempPw(r.data.temp_password);
      setCustomPw('');
      toast.success('Temporary password set — share it with the user');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to reset password');
    } finally { setResetting(false); }
  };

  const copyTempPw = async () => {
    try { await navigator.clipboard.writeText(tempPw); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (e) { /* clipboard blocked */ }
  };

  const setAddr = (k, v) => setMerchant((m) => ({ ...m, address: { ...(m.address || {}), [k]: v } }));
  const setBank = (obj, setter, k, v) => setter((o) => ({ ...o, banking_info: { ...(o.banking_info || {}), [k]: v } }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" data-testid={`account-manage-btn-${index}`}>
          <Pencil className="h-4 w-4 mr-1" />Edit profile
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="admin-manage-dialog">
        <DialogHeader>
          <DialogTitle>Edit profile — {row.name || row.email || 'user'}</DialogTitle>
          <DialogDescription>Edit this user's account, merchant, and driver records.</DialogDescription>
        </DialogHeader>

        {loading || !data ? (
          <div className="py-12 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-3">
              <TabsTrigger value="account" data-testid="manage-tab-account"><User className="h-4 w-4 mr-1" />Account</TabsTrigger>
              {merchant && <TabsTrigger value="merchant" data-testid="manage-tab-merchant"><Store className="h-4 w-4 mr-1" />Merchant</TabsTrigger>}
              {driver && <TabsTrigger value="driver" data-testid="manage-tab-driver"><Truck className="h-4 w-4 mr-1" />Driver</TabsTrigger>}
            </TabsList>

            {/* ACCOUNT */}
            <TabsContent value="account" className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Full name" value={account.name} onChange={(v) => setAccount((a) => ({ ...a, name: v }))} testid="manage-account-name" />
                <Field label="Phone" value={account.phone} onChange={(v) => setAccount((a) => ({ ...a, phone: v }))} testid="manage-account-phone" />
                <Field label="Email" value={account.email} onChange={(v) => setAccount((a) => ({ ...a, email: v }))} testid="manage-account-email" />
              </div>
              <p className="text-[11px] text-muted-foreground">Role: {account.user_type} · Status: {account.status}</p>
              <div className="pt-1 border-t border-border">
                <p className="text-xs font-medium mb-2">Banking (for refunds / payouts)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Bank name" value={account.banking_info?.bank_name} onChange={(v) => setBank(account, setAccount, 'bank_name', v)} testid="manage-account-bank-name" />
                  <Field label="Account name" value={account.banking_info?.account_name} onChange={(v) => setBank(account, setAccount, 'account_name', v)} testid="manage-account-bank-holder" />
                  <Field label="Account number" value={account.banking_info?.account_number} onChange={(v) => setBank(account, setAccount, 'account_number', v)} testid="manage-account-bank-number" />
                  <Field label="Branch" value={account.banking_info?.branch} onChange={(v) => setBank(account, setAccount, 'branch', v)} testid="manage-account-bank-branch" />
                </div>
              </div>
              <div className="pt-2 border-t border-border">
                <p className="text-xs font-medium mb-1 flex items-center gap-1"><KeyRound className="h-3.5 w-3.5" />Reset password</p>
                <p className="text-[11px] text-muted-foreground mb-2">Set a temporary password so a locked-out user can log back in, then change it themselves.</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => resetPassword(true)} disabled={resetting} data-testid="manage-reset-generate">
                    {resetting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <KeyRound className="h-4 w-4 mr-1" />}Generate temporary password
                  </Button>
                  <div className="flex items-center gap-2">
                    <Input value={customPw} onChange={(e) => setCustomPw(e.target.value)} placeholder="or type a password (min 8)" className="w-52" data-testid="manage-reset-custom-input" />
                    <Button size="sm" variant="outline" onClick={() => resetPassword(false)} disabled={resetting} data-testid="manage-reset-set-custom">Set</Button>
                  </div>
                </div>
                {tempPw && (
                  <div className="mt-2 flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2" data-testid="manage-reset-result">
                    <span className="text-xs text-amber-800">Temporary password:</span>
                    <code className="text-sm font-mono font-semibold text-amber-900" data-testid="manage-reset-temp-pw">{tempPw}</code>
                    <button type="button" onClick={copyTempPw} className="text-amber-700 hover:text-amber-900" data-testid="manage-reset-copy">
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </button>
                    <span className="text-[10px] text-amber-700 ml-auto">Shown once — copy it now.</span>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button onClick={saveAccount} disabled={saving} data-testid="manage-account-save">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}Save account
                </Button>
              </DialogFooter>
            </TabsContent>

            {/* MERCHANT */}
            {merchant && (
              <TabsContent value="merchant" className="space-y-3">
                <div className="flex gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Logo</Label>
                    <div className="h-16 w-16 rounded-lg border border-border bg-muted overflow-hidden flex items-center justify-center">
                      {merchant.logo ? <img src={merchant.logo} alt="logo" className="h-full w-full object-cover" /> : <Store className="h-6 w-6 text-muted-foreground" />}
                    </div>
                    <label className="text-[11px] text-neon-cyan cursor-pointer inline-flex items-center gap-1" data-testid="manage-merchant-logo-upload">
                      <Upload className="h-3 w-3" />Change
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadImage('logo', e.target.files?.[0])} />
                    </label>
                  </div>
                  <div className="space-y-1 flex-1">
                    <Label className="text-xs text-muted-foreground">Cover</Label>
                    <div className="h-16 w-full rounded-lg border border-border bg-muted overflow-hidden flex items-center justify-center">
                      {merchant.cover ? <img src={merchant.cover} alt="cover" className="h-full w-full object-cover" /> : <span className="text-[11px] text-muted-foreground">No cover</span>}
                    </div>
                    <label className="text-[11px] text-neon-cyan cursor-pointer inline-flex items-center gap-1" data-testid="manage-merchant-cover-upload">
                      <Upload className="h-3 w-3" />Change
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadImage('cover', e.target.files?.[0])} />
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Business name" value={merchant.name} onChange={(v) => setMerchant((m) => ({ ...m, name: v }))} testid="manage-merchant-name" />
                  <Field label="Phone" value={merchant.phone} onChange={(v) => setMerchant((m) => ({ ...m, phone: v }))} testid="manage-merchant-phone" />
                  <Field label="Email" value={merchant.email} onChange={(v) => setMerchant((m) => ({ ...m, email: v }))} testid="manage-merchant-email" />
                  {merchant.business_type === 'restaurant' && (
                    <Field label="Cuisine type" value={merchant.cuisine_type} onChange={(v) => setMerchant((m) => ({ ...m, cuisine_type: v }))} testid="manage-merchant-cuisine" />
                  )}
                  <Field label="Delivery fee" type="number" value={merchant.delivery_fee} onChange={(v) => setMerchant((m) => ({ ...m, delivery_fee: v === '' ? '' : parseFloat(v) }))} testid="manage-merchant-delivery-fee" />
                  <Field label="Minimum order" type="number" value={merchant.minimum_order} onChange={(v) => setMerchant((m) => ({ ...m, minimum_order: v === '' ? '' : parseFloat(v) }))} testid="manage-merchant-min-order" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Description</Label>
                  <Textarea value={merchant.description ?? ''} onChange={(e) => setMerchant((m) => ({ ...m, description: e.target.value }))} rows={2} data-testid="manage-merchant-description" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Field label="Street" value={merchant.address?.street} onChange={(v) => setAddr('street', v)} testid="manage-merchant-street" />
                  <Field label="City" value={merchant.address?.city} onChange={(v) => setAddr('city', v)} testid="manage-merchant-city" />
                  <Field label="Country" value={merchant.address?.country} onChange={(v) => setAddr('country', v)} testid="manage-merchant-country" />
                </div>
                <div className="pt-1 border-t border-border">
                  <p className="text-xs font-medium mb-2">Banking (payouts)</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Bank name" value={merchant.banking_info?.bank_name} onChange={(v) => setBank(merchant, setMerchant, 'bank_name', v)} testid="manage-merchant-bank-name" />
                    <Field label="Account number" value={merchant.banking_info?.account_number} onChange={(v) => setBank(merchant, setMerchant, 'account_number', v)} testid="manage-merchant-bank-number" />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={saveMerchant} disabled={saving} data-testid="manage-merchant-save">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}Save merchant
                  </Button>
                </DialogFooter>
              </TabsContent>
            )}

            {/* DRIVER */}
            {driver && (
              <TabsContent value="driver" className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="License number" value={driver.license_number} onChange={(v) => setDriver((d) => ({ ...d, license_number: v }))} testid="manage-driver-license" />
                  <Field label="Vehicle type" value={driver.vehicle_type} onChange={(v) => setDriver((d) => ({ ...d, vehicle_type: v }))} testid="manage-driver-vehicle-type" />
                  <Field label="Vehicle plate" value={driver.vehicle_plate} onChange={(v) => setDriver((d) => ({ ...d, vehicle_plate: v }))} testid="manage-driver-plate" />
                </div>
                <p className="text-[11px] text-muted-foreground">Status: {driver.status}</p>
                <div className="pt-1 border-t border-border">
                  <p className="text-xs font-medium mb-2">Banking (payouts)</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Bank name" value={driver.banking_info?.bank_name} onChange={(v) => setBank(driver, setDriver, 'bank_name', v)} testid="manage-driver-bank-name" />
                    <Field label="Account number" value={driver.banking_info?.account_number} onChange={(v) => setBank(driver, setDriver, 'account_number', v)} testid="manage-driver-bank-number" />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={saveDriver} disabled={saving} data-testid="manage-driver-save">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}Save driver
                  </Button>
                </DialogFooter>
              </TabsContent>
            )}
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AdminManageProfile;
