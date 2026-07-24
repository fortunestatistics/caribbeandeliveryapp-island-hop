import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Camera, MapPin, User as UserIcon, Loader2, CheckCircle2, Landmark } from 'lucide-react';
import { toast } from 'sonner';
import { authAPI } from './services/api';
import { useAuth } from './AuthContext';
import { fileToConstrainedDataURL } from './imageUtils';

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const fileRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', phone: '', picture: '',
    street: '', city: '', country: '',
    bank_name: '', account_name: '', account_number: '', branch: '',
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/login'); return; }
    setForm({
      name: user.name || '',
      phone: user.phone || '',
      picture: user.picture || '',
      street: user.address?.street || '',
      city: user.address?.city || '',
      country: user.address?.country || '',
      bank_name: user.banking_info?.bank_name || '',
      account_name: user.banking_info?.account_name || '',
      account_number: user.banking_info?.account_number || '',
      branch: user.banking_info?.branch || '',
    });
  }, [user, authLoading, navigate]);

  const handlePick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.');
      return;
    }
    try {
      const dataUrl = await fileToConstrainedDataURL(file, 400, 2_800_000);
      setForm((f) => ({ ...f, picture: dataUrl }));
    } catch (_e) {
      toast.error('Could not process that image. Please try a smaller one.');
    }
  };

  const missingPicture = !form.picture;
  const missingAddress = !form.street || !form.city || !form.country;

  const handleSave = async () => {
    if (missingPicture) { toast.error('Please upload a profile picture.'); return; }
    if (missingAddress) { toast.error('Please complete your address (street, city, country).'); return; }
    setSaving(true);
    try {
      const res = await authAPI.updateProfile({
        name: form.name,
        phone: form.phone || undefined,
        picture: form.picture,
        address: { street: form.street, city: form.city, country: form.country },
        banking_info: {
          bank_name: form.bank_name, account_name: form.account_name,
          account_number: form.account_number, branch: form.branch,
        },
      });
      localStorage.setItem('user', JSON.stringify(res.data));
      toast.success('Profile updated!');
      // Full reload so AuthContext + header reflect the new profile.
      setTimeout(() => { window.location.href = '/dashboard'; }, 600);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not save your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-matte-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-gold-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-matte-900 py-12" data-testid="profile-page">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Your Profile</h1>
          <p className="text-muted-foreground">Add a profile picture and delivery address to complete your account.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserIcon className="h-5 w-5 text-gold-500" /> Profile details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar */}
            <div className="flex items-center gap-5">
              <div className="relative">
                {form.picture ? (
                  <img src={form.picture} alt="avatar" className="w-24 h-24 rounded-full object-cover border-2 border-gold-500/40" data-testid="profile-avatar-preview" />
                ) : (
                  <div className="w-24 h-24 bg-gold-gradient rounded-full flex items-center justify-center text-white text-2xl font-bold">
                    {(form.name || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="absolute -bottom-1 -right-1 bg-gold-500 text-black rounded-full p-2 hover:opacity-90 transition-opacity"
                  data-testid="profile-avatar-upload-btn"
                  aria-label="Upload profile picture"
                >
                  <Camera className="h-4 w-4" />
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePick} data-testid="profile-avatar-input" />
              </div>
              <div className="text-sm">
                <p className="font-medium text-foreground">Profile picture <span className="text-red-400">*</span></p>
                <p className="text-muted-foreground">Tap the camera to upload. Auto-resized & required.</p>
                {!missingPicture && (
                  <p className="text-green-400 flex items-center gap-1 mt-1"><CheckCircle2 className="h-3.5 w-3.5" /> Picture added</p>
                )}
              </div>
            </div>

            {/* Name + phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="profile-name-input" />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1868..." data-testid="profile-phone-input" />
              </div>
            </div>

            {/* Address */}
            <div className="pt-2 border-t">
              <p className="font-medium text-foreground flex items-center gap-2 mb-3 mt-3">
                <MapPin className="h-4 w-4 text-gold-500" /> Delivery Address <span className="text-red-400">*</span>
              </p>
              <div className="space-y-4">
                <div>
                  <Label>Street address</Label>
                  <Input value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} placeholder="123 Main St, Woodbrook" data-testid="profile-street-input" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>City</Label>
                    <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Port of Spain" data-testid="profile-city-input" />
                  </div>
                  <div>
                    <Label>Country</Label>
                    <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="Trinidad & Tobago" data-testid="profile-country-input" />
                  </div>
                </div>
              </div>
            </div>

            {/* Banking (optional — for refunds & payouts) */}
            <div className="pt-2 border-t">
              <p className="font-medium text-foreground flex items-center gap-2 mb-1 mt-3">
                <Landmark className="h-4 w-4 text-gold-500" /> Banking details
                <span className="text-xs font-normal text-muted-foreground">(optional)</span>
              </p>
              <p className="text-xs text-muted-foreground mb-3">Used for refunds and any payouts owed to you. You can change this any time.</p>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Bank name</Label>
                    <Input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} placeholder="Republic Bank" data-testid="profile-bank-name-input" />
                  </div>
                  <div>
                    <Label>Account name</Label>
                    <Input value={form.account_name} onChange={(e) => setForm({ ...form, account_name: e.target.value })} data-testid="profile-account-name-input" />
                  </div>
                  <div>
                    <Label>Account number</Label>
                    <Input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} data-testid="profile-account-number-input" />
                  </div>
                  <div>
                    <Label>Branch</Label>
                    <Input value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} data-testid="profile-bank-branch-input" />
                  </div>
                </div>
              </div>
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full" data-testid="profile-save-btn">
              {saving ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</>) : 'Save Profile'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProfilePage;
