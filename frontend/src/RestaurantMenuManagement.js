import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Badge } from './components/ui/badge';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Upload, 
  Image as ImageIcon,
  DollarSign,
  Package,
  AlertCircle,
  Check,
  X,
  ChefHat
} from 'lucide-react';
import axios from 'axios';
<<<<<<< HEAD
import { fileToConstrainedDataURL } from './imageUtils';
=======
>>>>>>> cb805eb

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const RestaurantMenuManagement = () => {
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    image_url: '',
    available: true,
    is_vegetarian: false,
    is_vegan: false,
    is_gluten_free: false,
    spice_level: 'none',
    preparation_time: 15,
    customizations: [],
    variants: []
  });

  // Fetch restaurant menu items
  useEffect(() => {
    fetchMenuItems();
    fetchCategories();
  }, []);

  const fetchMenuItems = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const response = await axios.get(`${API}/restaurants/my-menu`, {
<<<<<<< HEAD
        withCredentials: true
=======
        withCredentials: false
>>>>>>> cb805eb
      });
      setMenuItems(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching menu:', error);
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await axios.get(`${API}/menu-categories`);
      setCategories(response.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
      // Default categories
      setCategories([
        'Appetizers', 'Main Course', 'Desserts', 'Beverages', 
        'Sides', 'Specials', 'Breakfast', 'Lunch', 'Dinner'
      ]);
    }
  };

  const handleAddItem = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      description: '',
      price: '',
      category: categories[0] || '',
      image_url: '',
      available: true,
      is_vegetarian: false,
      is_vegan: false,
      is_gluten_free: false,
      spice_level: 'none',
      preparation_time: 15,
      customizations: [],
      variants: []
    });
    setShowItemModal(true);
  };

  const handleEditItem = (item) => {
    setEditingItem(item);
    setFormData({ ...item });
    setShowItemModal(true);
  };

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;

    try {
      await axios.delete(`${API}/menu-items/${itemId}`, {
<<<<<<< HEAD
        withCredentials: true
=======
        withCredentials: false
>>>>>>> cb805eb
      });
      fetchMenuItems();
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Failed to delete item');
    }
  };

  const handleToggleAvailability = async (item) => {
    try {
      await axios.put(`${API}/menu-items/${item.id}`, {
        ...item,
        available: !item.available
      }, {
<<<<<<< HEAD
        withCredentials: true
=======
        withCredentials: false
>>>>>>> cb805eb
      });
      fetchMenuItems();
    } catch (error) {
      console.error('Error updating availability:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editingItem) {
        // Update existing item
        await axios.put(`${API}/menu-items/${editingItem.id}`, formData, {
<<<<<<< HEAD
          withCredentials: true
=======
          withCredentials: false
>>>>>>> cb805eb
        });
      } else {
        // Create new item
        await axios.post(`${API}/menu-items`, formData, {
<<<<<<< HEAD
          withCredentials: true
=======
          withCredentials: false
>>>>>>> cb805eb
        });
      }

      setShowItemModal(false);
      fetchMenuItems();
    } catch (error) {
      console.error('Error saving menu item:', error);
      alert('Failed to save menu item');
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
<<<<<<< HEAD
    try {
      const dataUrl = await fileToConstrainedDataURL(file, 800, 1_350_000);
      setFormData(prev => ({ ...prev, image_url: dataUrl }));
    } catch (_e) {
      alert('Could not process that image. Please try a smaller one.');
    }
=======

    // In production, upload to Cloudinary/S3
    // For now, use a placeholder
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData(prev => ({ ...prev, image_url: reader.result }));
    };
    reader.readAsDataURL(file);
>>>>>>> cb805eb
  };

  const filteredItems = selectedCategory === 'all' 
    ? menuItems 
    : menuItems.filter(item => item.category === selectedCategory);

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
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Menu Management</h1>
              <p className="text-muted-foreground">Manage your restaurant menu items</p>
            </div>
            <Button onClick={handleAddItem} className="bg-gold-500/15 hover:bg-gold-500/20">
              <Plus className="h-5 w-5 mr-2" />
              Add Item
            </Button>
          </div>

          {/* Category Filter */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            <Button
              variant={selectedCategory === 'all' ? 'default' : 'outline'}
              onClick={() => setSelectedCategory('all')}
              size="sm"
            >
              All Items ({menuItems.length})
            </Button>
            {categories.map((category) => {
              const count = menuItems.filter(item => item.category === category).length;
              return (
                <Button
                  key={category}
                  variant={selectedCategory === category ? 'default' : 'outline'}
                  onClick={() => setSelectedCategory(category)}
                  size="sm"
                >
                  {category} ({count})
                </Button>
              );
            })}
          </div>
        </div>

        {/* Menu Items Grid */}
        {filteredItems.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ChefHat className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">No menu items yet</h3>
              <p className="text-muted-foreground mb-4">Start by adding your first menu item</p>
              <Button onClick={handleAddItem}>Add First Item</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map((item) => (
              <Card key={item.id} className={!item.available ? 'opacity-60' : ''}>
                <CardContent className="p-4">
                  {/* Image */}
                  <div className="relative mb-4 h-48 bg-gray-200 rounded-lg overflow-hidden">
                    {item.image_url ? (
                      <img 
                        src={item.image_url} 
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-12 w-12 text-muted-foreground/70" />
                      </div>
                    )}
                    
                    {/* Availability Toggle */}
                    <button
                      onClick={() => handleToggleAvailability(item)}
                      className={`absolute top-2 right-2 px-3 py-1 rounded-full text-sm font-medium ${
                        item.available 
                          ? 'bg-green-500 text-white' 
                          : 'bg-red-500 text-white'
                      }`}
                    >
                      {item.available ? 'Available' : 'Out of Stock'}
                    </button>
                  </div>

                  {/* Item Details */}
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg text-foreground">{item.name}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold text-gold-500">
                        ${item.price?.toFixed(2)}
                      </span>
                      <Badge variant="secondary">{item.category}</Badge>
                    </div>

                    {/* Dietary Tags */}
                    <div className="flex gap-1 flex-wrap">
                      {item.is_vegetarian && (
                        <Badge variant="outline" className="text-xs">🌱 Vegetarian</Badge>
                      )}
                      {item.is_vegan && (
                        <Badge variant="outline" className="text-xs">🌿 Vegan</Badge>
                      )}
                      {item.is_gluten_free && (
                        <Badge variant="outline" className="text-xs">🌾 Gluten-Free</Badge>
                      )}
                      {item.spice_level && item.spice_level !== 'none' && (
                        <Badge variant="outline" className="text-xs">
                          🌶️ {item.spice_level}
                        </Badge>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button 
                        onClick={() => handleEditItem(item)}
                        variant="outline" 
                        size="sm"
                        className="flex-1"
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button 
                        onClick={() => handleDeleteItem(item.id)}
                        variant="destructive" 
                        size="sm"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Add/Edit Item Modal */}
        {showItemModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <Card className="max-w-2xl w-full my-8">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{editingItem ? 'Edit Menu Item' : 'Add New Item'}</span>
                  <button onClick={() => setShowItemModal(false)}>
                    <X className="h-6 w-6" />
                  </button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Image Upload */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Item Image</label>
                    <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                      {formData.image_url ? (
                        <div className="relative">
                          <img 
                            src={formData.image_url} 
                            alt="Preview" 
                            className="max-h-48 mx-auto rounded"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="mt-2"
                            onClick={() => setFormData(prev => ({ ...prev, image_url: '' }))}
                          >
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <label className="cursor-pointer">
                          <Upload className="h-8 w-8 text-muted-foreground/70 mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">Click to upload image</p>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleImageUpload}
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Basic Info */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Item Name *</label>
                      <Input
                        required
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g., Jerk Chicken"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Price *</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
                        <Input
                          type="number"
                          step="0.01"
                          required
                          value={formData.price}
                          onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                          placeholder="0.00"
                          className="pl-10"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Description</label>
                    <textarea
                      rows={3}
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full p-2 border rounded-md"
                      placeholder="Describe your dish..."
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Category *</label>
                      <select
                        required
                        value={formData.category}
                        onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                        className="w-full p-2 border rounded-md"
                      >
                        {categories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Preparation Time (min)</label>
                      <Input
                        type="number"
                        value={formData.preparation_time}
                        onChange={(e) => setFormData(prev => ({ ...prev, preparation_time: parseInt(e.target.value) }))}
                      />
                    </div>
                  </div>

                  {/* Dietary Options */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Dietary Information</label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.is_vegetarian}
                          onChange={(e) => setFormData(prev => ({ ...prev, is_vegetarian: e.target.checked }))}
                        />
                        <span className="text-sm">Vegetarian</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.is_vegan}
                          onChange={(e) => setFormData(prev => ({ ...prev, is_vegan: e.target.checked }))}
                        />
                        <span className="text-sm">Vegan</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.is_gluten_free}
                          onChange={(e) => setFormData(prev => ({ ...prev, is_gluten_free: e.target.checked }))}
                        />
                        <span className="text-sm">Gluten-Free</span>
                      </label>
                    </div>
                  </div>

                  {/* Spice Level */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Spice Level</label>
                    <select
                      value={formData.spice_level}
                      onChange={(e) => setFormData(prev => ({ ...prev, spice_level: e.target.value }))}
                      className="w-full p-2 border rounded-md"
                    >
                      <option value="none">None</option>
                      <option value="mild">Mild 🌶️</option>
                      <option value="medium">Medium 🌶️🌶️</option>
                      <option value="hot">Hot 🌶️🌶️🌶️</option>
                      <option value="extra_hot">Extra Hot 🌶️🌶️🌶️🌶️</option>
                    </select>
                  </div>

                  {/* Submit */}
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setShowItemModal(false)} className="flex-1">
                      Cancel
                    </Button>
                    <Button type="submit" className="flex-1 bg-gold-500/15 hover:bg-gold-500/20">
                      {editingItem ? 'Update Item' : 'Add Item'}
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

export default RestaurantMenuManagement;
