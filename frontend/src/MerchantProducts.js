import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Textarea } from './components/ui/textarea';
import { Label } from './components/ui/label';
import { Switch } from './components/ui/switch';
import { Badge } from './components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2, Package, Loader2, Pencil } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const emptyForm = { name: '', price: '', category: 'General', description: '', available: true };

const MerchantProducts = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [vendorType, setVendorType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/merchant/products`, { headers: authHeaders() });
      setProducts(res.data.products || []);
      setVendorType(res.data.vendor_type || '');
      setError('');
    } catch (e) {
      setError(e.response?.data?.detail || 'Could not load your products. Make sure your merchant account is approved.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => { setForm(emptyForm); setEditingId(null); };

  const submit = async () => {
    if (!form.name.trim()) { toast.error('Please enter a product name'); return; }
    if (form.price === '' || isNaN(Number(form.price))) { toast.error('Please enter a valid price'); return; }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        price: Number(form.price),
        category: form.category.trim() || 'General',
        description: form.description.trim(),
        available: form.available,
      };
      if (editingId) {
        await axios.put(`${API}/merchant/products/${editingId}`, body, { headers: authHeaders() });
        toast.success('Product updated');
      } else {
        await axios.post(`${API}/merchant/products`, body, { headers: authHeaders() });
        toast.success('Product added');
      }
      resetForm();
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (p) => {
    setEditingId(p.id);
    setForm({ name: p.name || '', price: String(p.price ?? ''), category: p.category || 'General', description: p.description || '', available: p.available !== false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      await axios.delete(`${API}/merchant/products/${id}`, { headers: authHeaders() });
      toast.success('Product deleted');
      if (editingId === id) resetForm();
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to delete');
    }
  };

  const toggleAvailable = async (p) => {
    try {
      await axios.put(`${API}/merchant/products/${p.id}`, { available: !p.available }, { headers: authHeaders() });
      load();
    } catch (e) {
      toast.error('Failed to update availability');
    }
  };

  const itemNoun = vendorType === 'restaurant' ? 'Menu Item' : 'Product';

  return (
    <div className="min-h-screen bg-background py-8 px-4" data-testid="merchant-products-page">
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" onClick={() => navigate('/vendor-dashboard')} className="mb-4" data-testid="products-back-btn">
          <ArrowLeft className="h-4 w-4 mr-2" />Back to Dashboard
        </Button>
        <h1 className="text-3xl font-bold text-foreground mb-1">Products &amp; Menu</h1>
        <p className="text-muted-foreground mb-6">Add the items customers can order from your storefront.</p>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {editingId ? <Pencil className="h-5 w-5 text-gold-500" /> : <Plus className="h-5 w-5 text-gold-500" />}
              {editingId ? `Edit ${itemNoun}` : `Add ${itemNoun}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Name</Label>
                <Input data-testid="product-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Chicken Roti" />
              </div>
              <div>
                <Label>Price (TTD)</Label>
                <Input data-testid="product-price-input" type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="45.00" />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Input data-testid="product-category-input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Mains / Medicine / Produce" />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch data-testid="product-available-switch" checked={form.available} onCheckedChange={(v) => setForm({ ...form, available: v })} />
                <span className="text-sm">Available for order</span>
              </div>
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea data-testid="product-description-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Short description" />
            </div>
            <div className="flex gap-2">
              <Button onClick={submit} disabled={saving} className="bg-gold-gradient text-white" data-testid="product-save-btn">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {editingId ? 'Save changes' : `Add ${itemNoun}`}
              </Button>
              {editingId && <Button variant="outline" onClick={resetForm} data-testid="product-cancel-btn">Cancel</Button>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5 text-teal-700" />Your Items ({products.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
            ) : error ? (
              <p className="py-6 text-center text-red-600" data-testid="products-error">{error}</p>
            ) : products.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground" data-testid="products-empty">No items yet. Add your first {itemNoun.toLowerCase()} above.</p>
            ) : (
              <div className="space-y-2">
                {products.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-card border border-border rounded-lg" data-testid={`product-row-${p.id}`}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{p.name}</span>
                        <Badge variant="outline" className="text-xs">{p.category}</Badge>
                        {p.available === false && <Badge variant="outline" className="text-xs border-amber-500/40 text-amber-600">Unavailable</Badge>}
                      </div>
                      {p.description && <p className="text-xs text-muted-foreground truncate">{p.description}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-semibold text-gold-600">TT${Number(p.price).toFixed(2)}</span>
                      <Switch checked={p.available !== false} onCheckedChange={() => toggleAvailable(p)} data-testid={`product-toggle-${p.id}`} />
                      <Button size="sm" variant="ghost" onClick={() => startEdit(p)} data-testid={`product-edit-${p.id}`}><Pencil className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(p.id)} data-testid={`product-delete-${p.id}`}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                    </div>
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

export default MerchantProducts;
