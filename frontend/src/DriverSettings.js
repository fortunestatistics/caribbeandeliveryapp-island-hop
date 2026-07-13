import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { useToast } from './hooks/use-toast';
import { ArrowLeft, User, Car, Landmark, Lock, Save, DollarSign } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const authCfg = () => {
  const token = localStorage.getItem('token');
  return { withCredentials: false, headers: token ? { Authorization: `Bearer ${token}` } : {} };
};

export default function DriverSettings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [savingAccount, setSavingAccount] = useState(false);
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const [account, setAccount] = useState({ name: '', phone: '' });
  const [driver, setDriver] = useState(null);
  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm: '' });

  useEffect(() => {
    (async () => {
      try {
        const [me, drv] = await Promise.all([
          axios.get(`${API}/auth/me`, authCfg()),
          axios.get(`${API}/drivers/me`, authCfg()).catch(() => ({ data: null })),
        ]);
        setAccount({ name: me.data?.name || '', phone: me.data?.phone || '' });
        if (drv.data) {
          setDriver({
            license_number: drv.data.license_number || '',
            vehicle_type: drv.data.vehicle_type || '',
            vehicle_plate: drv.data.vehicle_plate || '',
            banking_info: {
              bank_name: drv.data.banking_info?.bank_name || '',
              account_name: drv.data.banking_info?.account_name || '',
              account_number: drv.data.banking_info?.account_number || '',
              branch: drv.data.banking_info?.branch || '',
            },
          });
        }
      } catch (e) {
        toast({ title: 'Could not load settings', description: e?.response?.data?.detail || 'Please try again.', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveAccount = async () => {
    setSavingAccount(true);
    try {
      await axios.put(`${API}/users/me`, { name: account.name, phone: account.phone }, authCfg());
      toast({ title: 'Account updated', description: 'Your personal details were saved.' });
    } catch (e) {
      toast({ title: 'Save failed', description: e?.response?.data?.detail || 'Please try again.', variant: 'destructive' });
    } finally { setSavingAccount(false); }
  };

  const saveVehicle = async () => {
    setSavingVehicle(true);
    try {
      const { data } = await axios.put(`${API}/drivers/profile`, {
        license_number: driver.license_number, vehicle_type: driver.vehicle_type, vehicle_plate: driver.vehicle_plate,
      }, authCfg());
      toast({ title: 'Vehicle details updated', description: 'Your license & vehicle info were saved.' });
      setDriver((d) => ({ ...d, ...data.driver }));
    } catch (e) {
      toast({ title: 'Save failed', description: e?.response?.data?.detail || 'Please try again.', variant: 'destructive' });
    } finally { setSavingVehicle(false); }
  };

  const saveBank = async () => {
    setSavingBank(true);
    try {
      await axios.put(`${API}/drivers/profile`, { banking_info: driver.banking_info }, authCfg());
      toast({ title: 'Banking details updated', description: 'Your payout details were saved.' });
    } catch (e) {
      toast({ title: 'Save failed', description: e?.response?.data?.detail || 'Please try again.', variant: 'destructive' });
    } finally { setSavingBank(false); }
  };

  const changePassword = async () => {
    if (pw.new_password.length < 6) { toast({ title: 'Password too short', description: 'Use at least 6 characters.', variant: 'destructive' }); return; }
    if (pw.new_password !== pw.confirm) { toast({ title: 'Passwords do not match', variant: 'destructive' }); return; }
    setSavingPw(true);
    try {
      await axios.post(`${API}/auth/change-password`, { current_password: pw.current_password, new_password: pw.new_password }, authCfg());
      toast({ title: 'Password changed', description: 'Use your new password next time you sign in.' });
      setPw({ current_password: '', new_password: '', confirm: '' });
    } catch (e) {
      toast({ title: 'Could not change password', description: e?.response?.data?.detail || 'Check your current password.', variant: 'destructive' });
    } finally { setSavingPw(false); }
  };

  const setBank = (k, v) => setDriver((d) => ({ ...d, banking_info: { ...d.banking_info, [k]: v } }));

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading settings…</div>;
  }

  return (
    <div className="min-h-screen bg-background py-8" data-testid="driver-settings-page">
      <div className="max-w-3xl mx-auto px-4">
        <button onClick={() => navigate('/driver-dashboard')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4" data-testid="settings-back-btn">
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </button>
        <h1 className="text-3xl font-bold text-foreground mb-1">Settings</h1>
        <p className="text-muted-foreground mb-6">Update your account, vehicle, banking and password.</p>

        <div className="flex flex-wrap gap-2 mb-6">
          <Button variant="outline" onClick={() => navigate('/driver/earnings')}>
            <DollarSign className="h-4 w-4 mr-2" /> Earnings
          </Button>
          <Button variant="outline" onClick={() => navigate('/driver/subscription')}>
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

        {driver ? (
          <>
            {/* Vehicle & license */}
            <Card className="mb-6">
              <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Car className="h-5 w-5 text-gold-500" /> Vehicle &amp; License</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="license">License number</Label>
                  <Input id="license" value={driver.license_number} onChange={(e) => setDriver({ ...driver, license_number: e.target.value })} data-testid="settings-license-number" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="vtype">Vehicle type</Label>
                    <Input id="vtype" value={driver.vehicle_type} onChange={(e) => setDriver({ ...driver, vehicle_type: e.target.value })} data-testid="settings-vehicle-type" />
                  </div>
                  <div>
                    <Label htmlFor="vplate">Vehicle plate</Label>
                    <Input id="vplate" value={driver.vehicle_plate} onChange={(e) => setDriver({ ...driver, vehicle_plate: e.target.value })} data-testid="settings-vehicle-plate" />
                  </div>
                </div>
                <Button onClick={saveVehicle} disabled={savingVehicle} className="bg-gold-gradient text-white" data-testid="settings-save-vehicle-btn">
                  <Save className="h-4 w-4 mr-2" /> {savingVehicle ? 'Saving…' : 'Save vehicle details'}
                </Button>
              </CardContent>
            </Card>

            {/* Banking */}
            <Card className="mb-6">
              <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Landmark className="h-5 w-5 text-gold-500" /> Banking (payouts)</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="bank-name">Bank name</Label>
                    <Input id="bank-name" value={driver.banking_info.bank_name} onChange={(e) => setBank('bank_name', e.target.value)} data-testid="settings-bank-name" />
                  </div>
                  <div>
                    <Label htmlFor="acct-name">Account name</Label>
                    <Input id="acct-name" value={driver.banking_info.account_name} onChange={(e) => setBank('account_name', e.target.value)} data-testid="settings-account-holder" />
                  </div>
                  <div>
                    <Label htmlFor="acct-num">Account number</Label>
                    <Input id="acct-num" value={driver.banking_info.account_number} onChange={(e) => setBank('account_number', e.target.value)} data-testid="settings-account-number" />
                  </div>
                  <div>
                    <Label htmlFor="branch">Branch</Label>
                    <Input id="branch" value={driver.banking_info.branch} onChange={(e) => setBank('branch', e.target.value)} data-testid="settings-bank-branch" />
                  </div>
                </div>
                <Button onClick={saveBank} disabled={savingBank} className="bg-gold-gradient text-white" data-testid="settings-save-bank-btn">
                  <Save className="h-4 w-4 mr-2" /> {savingBank ? 'Saving…' : 'Save banking details'}
                </Button>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="mb-6"><CardContent className="p-6 text-sm text-muted-foreground">No driver profile found for this account.</CardContent></Card>
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
