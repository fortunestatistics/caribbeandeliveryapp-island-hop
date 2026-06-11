import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Badge } from './components/ui/badge';
import { 
  Plus, 
  Edit, 
  Trash2,
  Percent,
  DollarSign,
  Calendar,
  Users,
  Copy,
  CheckCircle,
  X,
  Tag,
  TrendingUp
} from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const PromoCodeManagement = () => {
  const [promoCodes, setPromoCodes] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingPromo, setEditingPromo] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    code: '',
    type: 'percentage',
    value: '',
    min_order_amount: 0,
    max_discount: null,
    usage_limit: null,
    usage_per_user: 1,
    service_types: [],
    valid_from: '',
    valid_until: '',
    active: true
  });

  useEffect(() => {
    fetchPromoCodes();
  }, []);

  const fetchPromoCodes = async () => {
    try {
      const response = await axios.get(`${API}/promo-codes`, {
        withCredentials: true
      });
      setPromoCodes(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching promo codes:', error);
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editingPromo) {
        await axios.put(`${API}/promo-codes/${editingPromo.id}`, formData, {
          withCredentials: true
        });
      } else {
        await axios.post(`${API}/promo-codes`, formData, {
          withCredentials: true
        });
      }

      setShowModal(false);
      fetchPromoCodes();
      resetForm();
    } catch (error) {
      console.error('Error saving promo code:', error);
      alert(error.response?.data?.detail || 'Failed to save promo code');
    }
  };

  const handleDelete = async (promoId) => {
    if (!window.confirm('Delete this promo code?')) return;

    try {
      await axios.delete(`${API}/promo-codes/${promoId}`, {
        withCredentials: true
      });
      fetchPromoCodes();
    } catch (error) {
      console.error('Error deleting promo code:', error);
      alert('Failed to delete promo code');
    }
  };

  const handleToggleActive = async (promo) => {
    try {
      await axios.put(`${API}/promo-codes/${promo.id}`, {
        ...promo,
        active: !promo.active
      }, {
        withCredentials: true
      });
      fetchPromoCodes();
    } catch (error) {
      console.error('Error toggling promo code:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      type: 'percentage',
      value: '',
      min_order_amount: 0,
      max_discount: null,
      usage_limit: null,
      usage_per_user: 1,
      service_types: [],
      valid_from: '',
      valid_until: '',
      active: true
    });
    setEditingPromo(null);
  };

  const handleEdit = (promo) => {
    setEditingPromo(promo);
    setFormData({
      code: promo.code,
      type: promo.type,
      value: promo.value,
      min_order_amount: promo.min_order_amount,
      max_discount: promo.max_discount,
      usage_limit: promo.usage_limit,
      usage_per_user: promo.usage_per_user,
      service_types: promo.service_types || [],
      valid_from: promo.valid_from?.split('T')[0] || '',
      valid_until: promo.valid_until?.split('T')[0] || '',
      active: promo.active
    });
    setShowModal(true);
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    alert(`Code "${code}" copied to clipboard!`);
  };

  const generateRandomCode = () => {
    const code = 'PROMO' + Math.random().toString(36).substring(2, 8).toUpperCase();
    setFormData(prev => ({ ...prev, code }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-500/30"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Promo Codes</h1>
              <p className="text-muted-foreground">Create and manage discount codes</p>
            </div>
            <Button onClick={() => { resetForm(); setShowModal(true); }} className="bg-gold-500/15 hover:bg-gold-500/20">
              <Plus className="h-5 w-5 mr-2" />
              Create Promo Code
            </Button>
          </div>

          {/* Stats */}
          <div className="grid md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Codes</p>
                    <p className="text-2xl font-bold">{promoCodes.length}</p>
                  </div>
                  <Tag className="h-8 w-8 text-neon-cyan" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Active</p>
                    <p className="text-2xl font-bold text-green-600">
                      {promoCodes.filter(p => p.active).length}
                    </p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Used</p>
                    <p className="text-2xl font-bold">
                      {promoCodes.reduce((sum, p) => sum + (p.used_count || 0), 0)}
                    </p>
                  </div>
                  <Users className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Savings Given</p>
                    <p className="text-2xl font-bold text-gold-500">$2.5K</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-gold-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Promo Codes List */}
        {promoCodes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Tag className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">No promo codes yet</h3>
              <p className="text-muted-foreground mb-4">Create your first promo code to start offering discounts</p>
              <Button onClick={() => setShowModal(true)}>Create Promo Code</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {promoCodes.map((promo) => (
              <Card key={promo.id} className={!promo.active ? 'opacity-60' : ''}>
                <CardContent className="p-6">
                  {/* Code Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <code className="text-xl font-bold text-gold-500 bg-gold-500/15 px-3 py-1 rounded">
                          {promo.code}
                        </code>
                        <button onClick={() => handleCopyCode(promo.code)}>
                          <Copy className="h-4 w-4 text-muted-foreground/70 hover:text-muted-foreground" />
                        </button>
                      </div>
                      <Badge className={promo.active ? 'bg-green-100 text-green-800' : 'bg-matte-800 text-foreground'}>
                        {promo.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>

                  {/* Discount Info */}
                  <div className="mb-4 p-4 bg-background rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      {promo.type === 'percentage' ? (
                        <Percent className="h-5 w-5 text-gold-500" />
                      ) : (
                        <DollarSign className="h-5 w-5 text-gold-500" />
                      )}
                      <span className="text-2xl font-bold text-gold-500">
                        {promo.type === 'percentage' ? `${promo.value}% OFF` : `$${promo.value} OFF`}
                      </span>
                    </div>
                    {promo.min_order_amount > 0 && (
                      <p className="text-sm text-muted-foreground">Min order: ${promo.min_order_amount}</p>
                    )}
                    {promo.max_discount && (
                      <p className="text-sm text-muted-foreground">Max discount: ${promo.max_discount}</p>
                    )}
                  </div>

                  {/* Usage Stats */}
                  <div className="mb-4 text-sm text-muted-foreground space-y-1">
                    <p className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Used: {promo.used_count || 0}
                      {promo.usage_limit && ` / ${promo.usage_limit}`}
                    </p>
                    <p className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Valid until: {new Date(promo.valid_until).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Service Types */}
                  {promo.service_types && promo.service_types.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs text-muted-foreground mb-1">Applies to:</p>
                      <div className="flex flex-wrap gap-1">
                        {promo.service_types.map((service) => (
                          <Badge key={service} variant="outline" className="text-xs">
                            {service}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-4 border-t">
                    <Button onClick={() => handleEdit(promo)} variant="outline" size="sm" className="flex-1">
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button 
                      onClick={() => handleToggleActive(promo)}
                      variant="outline" 
                      size="sm"
                      className="flex-1"
                    >
                      {promo.active ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button onClick={() => handleDelete(promo.id)} variant="destructive" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <Card className="max-w-2xl w-full my-8">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{editingPromo ? 'Edit Promo Code' : 'Create Promo Code'}</span>
                  <button onClick={() => { setShowModal(false); resetForm(); }}>
                    <X className="h-6 w-6" />
                  </button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Code */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Promo Code *</label>
                    <div className="flex gap-2">
                      <Input
                        required
                        value={formData.code}
                        onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                        placeholder="e.g., SUMMER2024"
                        className="flex-1"
                      />
                      <Button type="button" onClick={generateRandomCode} variant="outline">
                        Generate
                      </Button>
                    </div>
                  </div>

                  {/* Discount Type & Value */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Discount Type *</label>
                      <select
                        required
                        value={formData.type}
                        onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                        className="w-full p-2 border rounded-md"
                      >
                        <option value="percentage">Percentage Off</option>
                        <option value="fixed_amount">Fixed Amount Off</option>
                        <option value="free_delivery">Free Delivery</option>
                      </select>
                    </div>

                    {formData.type !== 'free_delivery' && (
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          {formData.type === 'percentage' ? 'Percentage (%)' : 'Amount ($)'} *
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          required
                          value={formData.value}
                          onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value }))}
                          placeholder={formData.type === 'percentage' ? '10' : '5.00'}
                        />
                      </div>
                    )}
                  </div>

                  {/* Min Order & Max Discount */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Minimum Order Amount ($)</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.min_order_amount}
                        onChange={(e) => setFormData(prev => ({ ...prev, min_order_amount: parseFloat(e.target.value) || 0 }))}
                        placeholder="0.00"
                      />
                    </div>

                    {formData.type === 'percentage' && (
                      <div>
                        <label className="block text-sm font-medium mb-2">Maximum Discount ($)</label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.max_discount || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, max_discount: e.target.value ? parseFloat(e.target.value) : null }))}
                          placeholder="No limit"
                        />
                      </div>
                    )}
                  </div>

                  {/* Usage Limits */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Total Usage Limit</label>
                      <Input
                        type="number"
                        value={formData.usage_limit || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, usage_limit: e.target.value ? parseInt(e.target.value) : null }))}
                        placeholder="Unlimited"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Usage Per User</label>
                      <Input
                        type="number"
                        value={formData.usage_per_user}
                        onChange={(e) => setFormData(prev => ({ ...prev, usage_per_user: parseInt(e.target.value) || 1 }))}
                      />
                    </div>
                  </div>

                  {/* Valid Dates */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Valid From *</label>
                      <Input
                        type="date"
                        required
                        value={formData.valid_from}
                        onChange={(e) => setFormData(prev => ({ ...prev, valid_from: e.target.value }))}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Valid Until *</label>
                      <Input
                        type="date"
                        required
                        value={formData.valid_until}
                        onChange={(e) => setFormData(prev => ({ ...prev, valid_until: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* Service Types */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Applies to Services (leave empty for all)</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['food', 'taxi', 'grocery', 'pharmacy', 'courier', 'car_rental'].map((service) => (
                        <label key={service} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={formData.service_types.includes(service)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData(prev => ({ ...prev, service_types: [...prev.service_types, service] }));
                              } else {
                                setFormData(prev => ({ ...prev, service_types: prev.service_types.filter(s => s !== service) }));
                              }
                            }}
                          />
                          <span className="text-sm capitalize">{service}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Submit */}
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => { setShowModal(false); resetForm(); }} className="flex-1">
                      Cancel
                    </Button>
                    <Button type="submit" className="flex-1 bg-gold-500/15 hover:bg-gold-500/20">
                      {editingPromo ? 'Update' : 'Create'} Promo Code
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default PromoCodeManagement;
