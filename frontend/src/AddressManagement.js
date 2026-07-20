import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Badge } from './components/ui/badge';
import { 
  Plus, 
  Edit, 
  Trash2,
  MapPin,
  Home,
  Briefcase,
  Star,
  Check,
  X,
  Navigation as NavigationIcon
} from 'lucide-react';
import axios from 'axios';
import { useLocationConsent } from './LocationConsentContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AddressManagement = () => {
  const [addresses, setAddresses] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  const { requestLocationConsent } = useLocationConsent();
  
  const [formData, setFormData] = useState({
    label: 'home',
    street_address: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'Jamaica',
    latitude: null,
    longitude: null,
    delivery_instructions: '',
    is_default: false
  });

  useEffect(() => {
    fetchAddresses();
  }, []);

  const fetchAddresses = async () => {
    try {
      const response = await axios.get(`${API}/addresses`, {
        withCredentials: false
      });
      setAddresses(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching addresses:', error);
      setLoading(false);
    }
  };

  const getCurrentLocation = async () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }
    const granted = await requestLocationConsent();
    if (!granted) return;
    setUseCurrentLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        setFormData(prev => ({ ...prev, latitude, longitude }));

        // Reverse geocode to get address (using a free service)
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const data = await response.json();

          setFormData(prev => ({
            ...prev,
            street_address: data.display_name || '',
            city: data.address?.city || data.address?.town || '',
            state: data.address?.state || '',
            postal_code: data.address?.postcode || ''
          }));
        } catch (error) {
          console.error('Error reverse geocoding:', error);
        }

        setUseCurrentLocation(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        alert('Could not get your location');
        setUseCurrentLocation(false);
      }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editingAddress) {
        await axios.put(`${API}/addresses/${editingAddress.id}`, formData, {
          withCredentials: false
        });
      } else {
        await axios.post(`${API}/addresses`, formData, {
          withCredentials: false
        });
      }

      setShowModal(false);
      fetchAddresses();
      resetForm();
    } catch (error) {
      console.error('Error saving address:', error);
      alert('Failed to save address');
    }
  };

  const handleDelete = async (addressId) => {
    if (!window.confirm('Delete this address?')) return;

    try {
      await axios.delete(`${API}/addresses/${addressId}`, {
        withCredentials: false
      });
      fetchAddresses();
    } catch (error) {
      console.error('Error deleting address:', error);
      alert('Failed to delete address');
    }
  };

  const handleSetDefault = async (addressId) => {
    try {
      await axios.post(`${API}/addresses/${addressId}/set-default`, {}, {
        withCredentials: false
      });
      fetchAddresses();
    } catch (error) {
      console.error('Error setting default address:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      label: 'home',
      street_address: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'Jamaica',
      latitude: null,
      longitude: null,
      delivery_instructions: '',
      is_default: false
    });
    setEditingAddress(null);
  };

  const handleEdit = (address) => {
    setEditingAddress(address);
    setFormData({ ...address });
    setShowModal(true);
  };

  const getLabelIcon = (label) => {
    switch (label) {
      case 'home':
        return <Home className="h-5 w-5" />;
      case 'work':
        return <Briefcase className="h-5 w-5" />;
      default:
        return <MapPin className="h-5 w-5" />;
    }
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
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground">My Addresses</h1>
              <p className="text-muted-foreground">Manage your delivery addresses</p>
            </div>
            <Button onClick={() => { resetForm(); setShowModal(true); }} className="bg-gold-500/15 hover:bg-gold-500/20">
              <Plus className="h-5 w-5 mr-2" />
              Add Address
            </Button>
          </div>
        </div>

        {/* Addresses List */}
        {addresses.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <MapPin className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">No saved addresses</h3>
              <p className="text-muted-foreground mb-4">Add your first address for faster checkout</p>
              <Button onClick={() => setShowModal(true)}>Add Address</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {addresses.map((address) => (
              <Card key={address.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="bg-gold-500/15 p-2 rounded-lg text-gold-500">
                          {getLabelIcon(address.label)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-lg capitalize">{address.label}</h3>
                            {address.is_default && (
                              <Badge className="bg-gold-500/15">
                                <Star className="h-3 w-3 mr-1" />
                                Default
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1 text-muted-foreground">
                        <p className="font-medium text-foreground">{address.street_address}</p>
                        <p>{address.city}, {address.state} {address.postal_code}</p>
                        <p>{address.country}</p>
                        {address.delivery_instructions && (
                          <p className="text-sm italic mt-2 text-muted-foreground">
                            Note: {address.delivery_instructions}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      {!address.is_default && (
                        <Button
                          onClick={() => handleSetDefault(address.id)}
                          variant="outline"
                          size="sm"
                        >
                          <Star className="h-4 w-4 mr-1" />
                          Set Default
                        </Button>
                      )}
                      <Button onClick={() => handleEdit(address)} variant="outline" size="sm">
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button onClick={() => handleDelete(address.id)} variant="destructive" size="sm">
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Add/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <Card className="max-w-2xl w-full my-8">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{editingAddress ? 'Edit Address' : 'Add New Address'}</span>
                  <button onClick={() => { setShowModal(false); resetForm(); }}>
                    <X className="h-6 w-6" />
                  </button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Use Current Location */}
                  <Button
                    type="button"
                    onClick={getCurrentLocation}
                    variant="outline"
                    className="w-full"
                    disabled={useCurrentLocation}
                  >
                    <NavigationIcon className="h-4 w-4 mr-2" />
                    {useCurrentLocation ? 'Getting location...' : 'Use Current Location'}
                  </Button>

                  {/* Label */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Label *</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['home', 'work', 'other'].map((label) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, label }))}
                          className={`p-3 border-2 rounded-lg capitalize ${
                            formData.label === label
                              ? 'border-gold-500/30 bg-gold-500/15'
                              : 'border-border'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Street Address */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Street Address *</label>
                    <Input
                      required
                      value={formData.street_address}
                      onChange={(e) => setFormData(prev => ({ ...prev, street_address: e.target.value }))}
                      placeholder="123 Main Street, Apt 4B"
                    />
                  </div>

                  {/* City, State, Postal Code */}
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">City *</label>
                      <Input
                        required
                        value={formData.city}
                        onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                        placeholder="Kingston"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">State/Parish *</label>
                      <Input
                        required
                        value={formData.state}
                        onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                        placeholder="St. Andrew"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Postal Code</label>
                      <Input
                        value={formData.postal_code}
                        onChange={(e) => setFormData(prev => ({ ...prev, postal_code: e.target.value }))}
                        placeholder="12345"
                      />
                    </div>
                  </div>

                  {/* Delivery Instructions */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Delivery Instructions</label>
                    <textarea
                      rows={3}
                      value={formData.delivery_instructions}
                      onChange={(e) => setFormData(prev => ({ ...prev, delivery_instructions: e.target.value }))}
                      className="w-full p-2 border rounded-md"
                      placeholder="e.g., Ring doorbell, Gate code is 1234"
                    />
                  </div>

                  {/* Set as Default */}
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.is_default}
                        onChange={(e) => setFormData(prev => ({ ...prev, is_default: e.target.checked }))}
                      />
                      <span className="text-sm">Set as default address</span>
                    </label>
                  </div>

                  {/* Submit */}
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => { setShowModal(false); resetForm(); }} className="flex-1">
                      Cancel
                    </Button>
                    <Button type="submit" className="flex-1 bg-gold-500/15 hover:bg-gold-500/20">
                      {editingAddress ? 'Update' : 'Save'} Address
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

export default AddressManagement;
