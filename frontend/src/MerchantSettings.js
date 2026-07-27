import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Textarea } from './components/ui/textarea';
import { useToast } from './hooks/use-toast';
import { ArrowLeft, User, Store, Lock, Save, Image as ImageIcon, Ticket, DollarSign } from 'lucide-react';
import StoreHoursCard from './StoreHoursCard';
import StoreLocationCard from './StoreLocationCard';
import { BankAccountSection } from './BankAccountSection';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const authCfg = () => {
  const token = localStorage.getItem('token');
  return { withCredentials: true, headers: token ? { Authorization: `Bearer ${token}` } : {} };
};

export default function MerchantSettings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [savingAccount, setSavingAccount] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  const [savingHours, setSavingHours] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const [account, setAccount] = useState({ name: '', phone: '' });
  const [profile, setProfile] = useState(null);
  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm: '' });

  useEffect(() => {
    (async () => {
      try {
        const [me, prof] = await Promise.all([
          axios.get(`${API}/auth/me`, authCfg()),
          axios.get(`${API}/merchant/profile`, authCfg()).catch(() => ({ data: null })),
        ]);
        setAccount({ name: me.data?.name || '', phone: me.data?.phone || '' });
        if (prof.data) {
          setProfile({
            name: prof.data.name || '', description: prof.data.description || '',
            cuisine_type: prof.data.cuisine_type || '', phone: prof.data.phone || '',
            email: prof.data.email || '',
            address: prof.data.address || { street: '', city: '', country: '' },
            delivery_fee: prof.data.delivery_fee ?? '', minimum_order: prof.data.minimum_order ?? '',
            collection: prof.data.collection,
            banking_info: prof.data.banking_info || {},
            business_hours: prof.data.business_hours || null,
            pickup_coords: prof.data.pickup_coords || null,
          });
        }
      } catch (e) {
        toast({ title: 'Could not load settings', description: e?.response?.data?.detail || 'Please try again.', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const saveAccount = async () => {
    setSavingAccount(true);
    try {
      await axios.put(`${API}/users/me`, { name: account.name, phone: account.phone }, authCfg());
      toast({ title: 'Account updated', description: 'Your personal details were saved.' });
    } catch (e) {
      toast({ title: 'Save failed', description: e?.response?.data?.detail || 'Please try again.', variant: 'destructive' });
    } finally { setSavingAccount(false); }
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const body = {
        name: profile.name, description: profile.description, phone: profile.phone,
        email: profile.email, address: profile.address,
      };
      if (profile.collection === 'restaurants') {
        body.cuisine_type = profile.cuisine_type;
        if (profile.delivery_fee !== '') body.delivery_fee = Number(profile.delivery_fee);
        if (profile.minimum_order !== '') body.minimum_order = Number(profile.minimum_order);
      }
      const { data } = await axios.put(`${API}/merchant/profile`, body, authCfg());
      toast({ title: 'Business profile updated', description: 'Your store details were saved.' });
      setProfile((p) => ({ ...p, ...data.profile }));
    } catch (e) {
      toast({ title: 'Save failed', description: e?.response?.data?.detail || 'Please try again.', variant: 'destructive' });
    } finally { setSavingProfile(false); }
  };

  const changePassword = async () => {
    if (pw.new_password.length < 8) {
      toast({ title: 'Password too short', description: 'Use at least 8 characters.', variant: 'destructive' }); return;
    }
    if (pw.new_password !== pw.confirm) {
      toast({ title: 'Passwords do not match', variant: 'destructive' }); return;
    }
    setSavingPw(true);
    try {
      await axios.post(`${API}/auth/change-password`, { current_password: pw.current_password, new_password: pw.new_password }, authCfg());
      toast({ title: 'Password changed', description: 'Use your new password next time you sign in.' });
      setPw({ current_password: '', new_password: '', confirm: '' });
    } catch (e) {
      toast({ title: 'Could not change password', description: e?.response?.data?.detail || 'Check your current password.', variant: 'destructive' });
    } finally { setSavingPw(false); }
  };

  const setAddr = (k, v) => setProfile((p) => ({ ...p, address: { ...p.address, [k]: v } }));
  const setBank = (patch) => setProfile((p) => ({ ...p, banking_info: patch }));

  const saveBank = async () => {
    setSavingBank(true);
    try {
      const { data } = await axios.put(`${API}/merchant/profile`, { banking_info: profile.banking_info }, authCfg());
      toast({ title: 'Banking details updated', description: 'Your payout details were saved.' });
      if (data.profile?.banking_info) setProfile((p) => ({ ...p, banking_info: { ...p.banking_info, ...data.profile.banking_info } }));
    } catch (e) {
      toast({ title: 'Save failed', description: e?.response?.data?.detail || 'Please try again.', variant: 'destructive' });
    } finally { setSavingBank(false); }
  };

  const saveHours = async (hours) => {    setSavingHours(true);
    try {
      const { data } = await axios.put(`${API}/merchant/profile`, { business_hours: hours }, authCfg());
      toast({ title: 'Store hours saved', description: hours.enabled ? 'Customers can only order during your open hours.' : 'Hours saved (enforcement is off).' });
      setProfile((p) => ({ ...p, business_hours: data.profile?.business_hours || hours }));
    } catch (e) {
      toast({ title: 'Save failed', description: e?.response?.data?.detail || 'Please try again.', variant: 'destructive' });
    } finally { setSavingHours(false); }
  };

  const saveLocation = async (coords) => {
    if (!coords) return;
    setSavingLocation(true);
    try {
      const { data } = await axios.put(`${API}/merchant/profile`, { pickup_coords: { lat: coords.lat, lng: coords.lng } }, authCfg());
      toast({ title: 'Store location saved', description: 'Drivers will now be routed to this exact spot for pickups.' });
      setProfile((p) => ({ ...p, pickup_coords: data.profile?.pickup_coords || coords }));
    } catch (e) {
      toast({ title: 'Save failed', description: e?.response?.data?.detail || 'Please try again.', variant: 'destructive' });
    } finally { setSavingLocation(false); }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading settings…</div>;
  }

  return (
    <div className="min-h-screen bg-background py-8" data-testid="merchant-settings-page">
      <div className="max-w-3xl mx-auto px-4">
        <button onClick={() => navigate('/vendor-dashboard')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4" data-testid="settings-back-btn">
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </button>
        <h1 className="text-3xl font-bold text-foreground mb-1">Settings</h1>
        <p className="text-muted-foreground mb-6">Update your account, business profile and password.</p>

        {/* Quick links */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Button variant="outline" onClick={() => navigate('/merchant/storefront')} data-testid="settings-edit-storefront-btn">
            <ImageIcon className="h-4 w-4 mr-2" /> Edit Storefront
          </Button>
          <Button variant="outline" onClick={() => navigate('/merchant/coupons')}>
            <Ticket className="h-4 w-4 mr-2" /> Coupons
          </Button>
          <Button variant="outline" onClick={() => navigate('/merchant/subscription')}>
            <DollarSign className="h-4 w-4 mr-2" /> Subscription
          </Button>
        </div>

        {/* Account */}
        <Card className="mb-6">
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><User className="h-5 w-5 text-gold-500" /> Account</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="acc-name">Your name</Label>
              <Input id="acc-name" value={account.name} onChange={(e) => setAccount({ ...account, name: e.target.value })} data-testid="settings-account-name" />
            </div>
            <div>
              <Label htmlFor="acc-phone">Phone</Label>
              <Input id="acc-phone" value={account.phone} onChange={(e) => setAccount({ ...account, phone: e.target.value })} data-testid="settings-account-phone" />
            </div>
            <Button onClick={saveAccount} disabled={savingAccount} className="bg-gold-gradient text-white" data-testid="settings-save-account-btn">
              <Save className="h-4 w-4 mr-2" /> {savingAccount ? 'Saving…' : 'Save account'}
            </Button>
          </CardContent>
        </Card>

        {/* Business profile */}
        {profile ? (
          <Card className="mb-6">
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Store className="h-5 w-5 text-gold-500" /> Business Profile</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="biz-name">Business name</Label>
                <Input id="biz-name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} data-testid="settings-business-name" />
              </div>
              <div>
                <Label htmlFor="biz-desc">Description</Label>
                <Textarea id="biz-desc" value={profile.description} onChange={(e) => setProfile({ ...profile, description: e.target.value })} data-testid="settings-business-description" />
              </div>
              {profile.collection === 'restaurants' && (
                <div>
                  <Label htmlFor="biz-cuisine">Cuisine type</Label>
                  <Input id="biz-cuisine" value={profile.cuisine_type} onChange={(e) => setProfile({ ...profile, cuisine_type: e.target.value })} data-testid="settings-business-cuisine" />
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="biz-phone">Phone</Label>
                  <Input id="biz-phone" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} data-testid="settings-business-phone" />
                </div>
                <div>
                  <Label htmlFor="biz-email">Email</Label>
                  <Input id="biz-email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} data-testid="settings-business-email" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="addr-street">Street</Label>
                  <Input id="addr-street" value={profile.address?.street || ''} onChange={(e) => setAddr('street', e.target.value)} data-testid="settings-business-street" />
                </div>
                <div>
                  <Label htmlFor="addr-city">City</Label>
                  <Input id="addr-city" value={profile.address?.city || ''} onChange={(e) => setAddr('city', e.target.value)} data-testid="settings-business-city" />
                </div>
                <div>
                  <Label htmlFor="addr-country">Country</Label>
                  <Input id="addr-country" value={profile.address?.country || ''} onChange={(e) => setAddr('country', e.target.value)} data-testid="settings-business-country" />
                  {!(profile.address?.country || '').trim() && (
                    <p className="text-xs text-amber-600 mt-1" data-testid="settings-country-warning">
                      Add your country so customer payments are routed correctly at checkout.
                    </p>
                  )}
                </div>
              </div>
              {profile.collection === 'restaurants' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="biz-delivery">Delivery fee</Label>
                    <Input id="biz-delivery" type="number" value={profile.delivery_fee} onChange={(e) => setProfile({ ...profile, delivery_fee: e.target.value })} data-testid="settings-business-delivery-fee" />
                  </div>
                  <div>
                    <Label htmlFor="biz-min">Minimum order</Label>
                    <Input id="biz-min" type="number" value={profile.minimum_order} onChange={(e) => setProfile({ ...profile, minimum_order: e.target.value })} data-testid="settings-business-minimum-order" />
                  </div>
                </div>
              )}
              <Button onClick={saveProfile} disabled={savingProfile} className="bg-gold-gradient text-white" data-testid="settings-save-profile-btn">
                <Save className="h-4 w-4 mr-2" /> {savingProfile ? 'Saving…' : 'Save business profile'}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="mb-6"><CardContent className="p-6 text-sm text-muted-foreground">No merchant business profile found for this account.</CardContent></Card>
        )}

        {/* Store hours */}
        {profile && (
          <StoreHoursCard value={profile.business_hours} onSave={saveHours} saving={savingHours} />
        )}

        {/* Store location pin */}
        {profile && (
          <StoreLocationCard value={profile.pickup_coords} onSave={saveLocation} saving={savingLocation} />
        )}

        {/* Banking & payouts */}
        {profile && (
          <BankAccountSection
            banking={profile.banking_info}
            onChange={setBank}
            onSave={saveBank}
            saving={savingBank}
            showPayoutMethod
            onBack={() => navigate('/vendor-dashboard')}
          />
        )}

        {/* Change password */}
        <Card className="mb-10">
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Lock className="h-5 w-5 text-gold-500" /> Change Password</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="pw-current">Current password</Label>
              <Input id="pw-current" type="password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} data-testid="settings-current-password" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="pw-new">New password</Label>
                <Input id="pw-new" type="password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} data-testid="settings-new-password" />
              </div>
              <div>
                <Label htmlFor="pw-confirm">Confirm new password</Label>
                <Input id="pw-confirm" type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} data-testid="settings-confirm-password" />
              </div>
            </div>
            <Button onClick={changePassword} disabled={savingPw} variant="outline" data-testid="settings-change-password-btn">
              <Lock className="h-4 w-4 mr-2" /> {savingPw ? 'Updating…' : 'Change password'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
