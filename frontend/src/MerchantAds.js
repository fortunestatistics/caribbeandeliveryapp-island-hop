import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Badge } from './components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { useToast } from './hooks/use-toast';
import { fileToResizedDataURL } from './imageUtils';
import { ArrowLeft, Megaphone, ImagePlus, Trash2, Loader2, Plus } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const authHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const MerchantAds = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ads, setAds] = useState([]);
  const [packages, setPackages] = useState([]);
  const [form, setForm] = useState({ title: '', image: null, cta_url: '', package_id: '' });
  const imgRef = useRef(null);

  const load = async () => {
    try {
      const [a, p] = await Promise.all([
        axios.get(`${API}/merchant/ads`, { headers: authHeaders() }),
        axios.get(`${API}/ads/packages`),
      ]);
      setAds(a.data || []);
      setPackages(p.data || []);
      setForm((f) => ({ ...f, package_id: f.package_id || (p.data?.[0]?.id || '') }));
    } catch (e) {
      toast({ title: 'Could not load ads', description: e?.response?.data?.detail || 'Make sure you have a merchant account.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  const pickImage = async (file) => {
    if (!file) return;
    try {
      const data = await fileToResizedDataURL(file, 1000);
      setForm((f) => ({ ...f, image: data }));
    } catch {
      toast({ title: 'Image error', description: 'Could not process that image.', variant: 'destructive' });
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.image || !form.package_id) {
      toast({ title: 'Add a title, image and package', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await axios.post(`${API}/merchant/ads`, form, { headers: authHeaders() });
      toast({ title: 'Ad published', description: res.data?.message });
      setForm({ title: '', image: null, cta_url: '', package_id: packages?.[0]?.id || '' });
      load();
    } catch (err) {
      toast({ title: 'Could not publish ad', description: err?.response?.data?.detail || 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (ad) => {
    try { await axios.patch(`${API}/merchant/ads/${ad.id}`, {}, { headers: authHeaders() }); load(); }
    catch { toast({ title: 'Update failed', variant: 'destructive' }); }
  };

  const remove = async (ad) => {
    if (!window.confirm('Delete this ad?')) return;
    try { await axios.delete(`${API}/merchant/ads/${ad.id}`, { headers: authHeaders() }); toast({ title: 'Ad deleted' }); load(); }
    catch { toast({ title: 'Delete failed', variant: 'destructive' }); }
  };

  const selectedPkg = packages.find((p) => p.id === form.package_id);

  return (
    <div className="min-h-screen bg-background py-8" data-testid="merchant-ads-page">
      <div className="container mx-auto px-4 max-w-4xl">
        <Button variant="ghost" onClick={() => navigate('/vendor-dashboard')} className="mb-4" data-testid="ads-back-btn">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
        </Button>

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Megaphone className="h-7 w-7 text-gold-500" /> Advertise
          </h1>
          <p className="text-muted-foreground">Buy front-page &amp; website ad space to reach more customers.</p>
        </div>

        <Card className="mb-8">
          <CardHeader><CardTitle className="text-lg">Create an ad</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label htmlFor="ad-title">Headline</Label>
                <Input id="ad-title" data-testid="ad-title-input" value={form.title} maxLength={80}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. 50% off this weekend!" className="mt-1.5" />
              </div>
              <div>
                <Label>Ad image</Label>
                <div className="mt-1.5">
                  <button type="button" onClick={() => imgRef.current?.click()} data-testid="ad-image-upload"
                    className="w-full h-40 rounded-lg border-2 border-dashed border-matte-700 flex items-center justify-center overflow-hidden hover:border-gold-500/50 transition-colors">
                    {form.image
                      ? <img src={form.image} alt="ad" className="h-full w-full object-cover" />
                      : <span className="flex flex-col items-center text-muted-foreground"><ImagePlus className="h-6 w-6 mb-1" />Upload image</span>}
                  </button>
                  <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e.target.files?.[0])} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="ad-cta">Link (optional)</Label>
                  <Input id="ad-cta" data-testid="ad-cta-input" value={form.cta_url}
                    onChange={(e) => setForm((f) => ({ ...f, cta_url: e.target.value }))}
                    placeholder="Defaults to your store page" className="mt-1.5" />
                </div>
                <div>
                  <Label>Package</Label>
                  <Select value={form.package_id} onValueChange={(v) => setForm((f) => ({ ...f, package_id: v }))}>
                    <SelectTrigger className="mt-1.5" data-testid="ad-package-select"><SelectValue placeholder="Choose package" /></SelectTrigger>
                    <SelectContent>
                      {packages.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name} — TT${p.price_ttd.toLocaleString()}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" disabled={saving} className="w-full bg-gold-gradient text-white" data-testid="ad-publish-btn">
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                {selectedPkg ? `Publish & Pay TT$${selectedPkg.price_ttd.toLocaleString()}` : 'Publish Ad'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Your ads</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-gold-500" /></div>
            ) : ads.length === 0 ? (
              <p className="text-center text-muted-foreground py-10">No ads yet. Create your first one above.</p>
            ) : (
              <div className="space-y-3" data-testid="merchant-ads-list">
                {ads.map((ad) => (
                  <div key={ad.id} className={`flex items-center gap-4 rounded-lg border p-3 ${ad.is_live ? '' : 'opacity-60'}`} data-testid={`ad-row-${ad.id}`}>
                    <img src={ad.image} alt={ad.title} className="h-16 w-24 rounded object-cover bg-matte-800 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground truncate">{ad.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {ad.placement} · {ad.clicks || 0} clicks · {ad.is_live ? 'Live' : (ad.status === 'paused' ? 'Paused' : 'Ended')}
                        {ad.ends_at ? ` · ends ${String(ad.ends_at).slice(0, 10)}` : ''}
                      </p>
                    </div>
                    <Badge variant="outline">{ad.is_live ? 'Active' : 'Inactive'}</Badge>
                    <Button size="sm" variant="outline" onClick={() => toggle(ad)} data-testid={`ad-toggle-${ad.id}`}>
                      {ad.status === 'active' ? 'Pause' : 'Resume'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(ad)} data-testid={`ad-delete-${ad.id}`}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MerchantAds;
