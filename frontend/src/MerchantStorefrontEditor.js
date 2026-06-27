import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Label } from './components/ui/label';
import { Textarea } from './components/ui/textarea';
import { useToast } from './hooks/use-toast';
import { fileToResizedDataURL } from './imageUtils';
import { ArrowLeft, ImagePlus, Trash2, Store, Eye, Loader2, Save } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const authHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const MerchantStorefrontEditor = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vendorId, setVendorId] = useState(null);
  const [logo, setLogo] = useState(null);
  const [cover, setCover] = useState(null);
  const [bio, setBio] = useState('');
  const [gallery, setGallery] = useState([]);
  const logoRef = useRef(null);
  const coverRef = useRef(null);
  const galleryRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API}/merchant/storefront`, { headers: authHeaders() });
        const d = res.data || {};
        setVendorId(d.vendor_id);
        setLogo(d.logo || null);
        setCover(d.cover || null);
        setBio(d.bio || '');
        setGallery(Array.isArray(d.gallery) ? d.gallery : []);
      } catch (e) {
        toast({ title: 'Could not load storefront', description: e?.response?.data?.detail || 'Make sure you have a merchant account.', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line

  const pickImage = async (file, setter, maxDim) => {
    if (!file) return;
    try {
      const data = await fileToResizedDataURL(file, maxDim);
      setter(data);
    } catch {
      toast({ title: 'Image error', description: 'Could not process that image.', variant: 'destructive' });
    }
  };

  const addGallery = async (files) => {
    const list = Array.from(files || []);
    for (const f of list) {
      if (gallery.length >= 6) {
        toast({ title: 'Gallery full', description: 'You can add up to 6 photos.', variant: 'destructive' });
        break;
      }
      // eslint-disable-next-line no-await-in-loop
      const data = await fileToResizedDataURL(f, 800);
      setGallery((g) => (g.length >= 6 ? g : [...g, data]));
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/merchant/storefront`, { logo, cover, bio, gallery }, { headers: authHeaders() });
      toast({ title: 'Storefront saved', description: 'Your public store page has been updated.' });
    } catch (e) {
      toast({ title: 'Save failed', description: e?.response?.data?.detail || 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-500/40"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8" data-testid="merchant-storefront-editor">
      <div className="container mx-auto px-4 max-w-3xl">
        <Button variant="ghost" onClick={() => navigate('/vendor-dashboard')} className="mb-4" data-testid="storefront-back-btn">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
        </Button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Store className="h-7 w-7 text-gold-500" /> My Storefront
            </h1>
            <p className="text-muted-foreground">Customise how customers see your store.</p>
          </div>
          {vendorId && (
            <Button variant="outline" onClick={() => navigate(`/restaurant/${vendorId}`)} data-testid="storefront-preview-btn">
              <Eye className="h-4 w-4 mr-2" /> Preview
            </Button>
          )}
        </div>

        {/* Cover + Logo */}
        <Card className="mb-6 overflow-hidden">
          <div
            className="relative h-44 bg-matte-800 bg-cover bg-center"
            style={cover ? { backgroundImage: `url(${cover})` } : {}}
            data-testid="storefront-cover-preview"
          >
            <button
              type="button"
              onClick={() => coverRef.current?.click()}
              className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 text-white text-xs px-3 py-1.5 hover:bg-black/80 transition-colors"
              data-testid="storefront-cover-upload"
            >
              <ImagePlus className="h-3.5 w-3.5" /> {cover ? 'Change cover' : 'Add cover'}
            </button>
            <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e.target.files?.[0], setCover, 1280)} />
            <div className="absolute -bottom-10 left-6">
              <button
                type="button"
                onClick={() => logoRef.current?.click()}
                className="h-20 w-20 rounded-2xl border-4 border-background bg-card overflow-hidden flex items-center justify-center shadow-lg"
                data-testid="storefront-logo-upload"
              >
                {logo ? <img src={logo} alt="logo" className="h-full w-full object-cover" /> : <ImagePlus className="h-6 w-6 text-muted-foreground" />}
              </button>
              <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e.target.files?.[0], setLogo, 400)} />
            </div>
          </div>
          <CardContent className="pt-14 pb-6">
            <Label htmlFor="bio">Short bio / description</Label>
            <Textarea
              id="bio"
              data-testid="storefront-bio-input"
              value={bio}
              maxLength={500}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell customers what makes your store special..."
              className="mt-1.5 min-h-[100px]"
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">{bio.length}/500</p>
          </CardContent>
        </Card>

        {/* Gallery */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Photo gallery</span>
              <span className="text-sm font-normal text-muted-foreground">{gallery.length}/6</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3" data-testid="storefront-gallery-grid">
              {gallery.map((g, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-matte-800 group">
                  <img src={g} alt={`gallery-${i}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setGallery((arr) => arr.filter((_, idx) => idx !== i))}
                    className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1.5 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    data-testid={`storefront-gallery-remove-${i}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {gallery.length < 6 && (
                <button
                  type="button"
                  onClick={() => galleryRef.current?.click()}
                  className="aspect-square rounded-lg border-2 border-dashed border-matte-700 flex flex-col items-center justify-center text-muted-foreground hover:border-gold-500/50 hover:text-gold-400 transition-colors"
                  data-testid="storefront-gallery-add"
                >
                  <ImagePlus className="h-6 w-6 mb-1" />
                  <span className="text-xs">Add photo</span>
                </button>
              )}
            </div>
            <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addGallery(e.target.files)} />
          </CardContent>
        </Card>

        <Button onClick={save} disabled={saving} className="w-full" data-testid="storefront-save-btn">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Storefront
        </Button>
      </div>
    </div>
  );
};

export default MerchantStorefrontEditor;
