import React, { useState } from 'react';
import { useCurrency } from './CurrencyContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Separator } from './components/ui/separator';
import CurrencyConverter from './CurrencyConverter';
import { Badge } from './components/ui/badge';
import { createOrder, fetchProfile, isLoggedIn, formatProfileAddress } from './orderApi';
import { 
  ShoppingCart, 
  MapPin, 
  Plus,
  Minus,
  Trash2,
  Search,
  Store
} from 'lucide-react';

const GroceryOrderForm = () => {
  const { format } = useCurrency();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStore, setSelectedStore] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [cart, setCart] = useState([]);

  const stores = [
    { id: 'super-fresh', name: 'Super Fresh Market', deliveryFee: 8.00, minOrder: 25.00 },
    { id: 'island-grocery', name: 'Island Grocery', deliveryFee: 10.00, minOrder: 30.00 },
    { id: 'caribbean-foods', name: 'Caribbean Foods', deliveryFee: 12.00, minOrder: 35.00 }
  ];

  const categories = ['All', 'Fruits & Vegetables', 'Meat & Seafood', 'Dairy', 'Bakery', 'Pantry', 'Beverages', 'Snacks'];

  const groceryItems = [
    // Fruits & Vegetables
    { id: 1, name: 'Bananas (1 bunch)', price: 2.50, category: 'Fruits & Vegetables', image: '🍌', unit: 'bunch' },
    { id: 2, name: 'Tomatoes (1 lb)', price: 3.00, category: 'Fruits & Vegetables', image: '🍅', unit: 'lb' },
    { id: 3, name: 'Lettuce (1 head)', price: 2.00, category: 'Fruits & Vegetables', image: '🥬', unit: 'head' },
    { id: 4, name: 'Onions (1 lb)', price: 2.50, category: 'Fruits & Vegetables', image: '🧅', unit: 'lb' },
    { id: 5, name: 'Mangoes (each)', price: 1.50, category: 'Fruits & Vegetables', image: '🥭', unit: 'each' },
    
    // Meat & Seafood
    { id: 6, name: 'Chicken Breast (1 lb)', price: 7.00, category: 'Meat & Seafood', image: '🍗', unit: 'lb' },
    { id: 7, name: 'Ground Beef (1 lb)', price: 8.50, category: 'Meat & Seafood', image: '🥩', unit: 'lb' },
    { id: 8, name: 'Fresh Fish (1 lb)', price: 12.00, category: 'Meat & Seafood', image: '🐟', unit: 'lb' },
    { id: 9, name: 'Shrimp (1 lb)', price: 15.00, category: 'Meat & Seafood', image: '🦐', unit: 'lb' },
    
    // Dairy
    { id: 10, name: 'Milk (1 gallon)', price: 4.50, category: 'Dairy', image: '🥛', unit: 'gallon' },
    { id: 11, name: 'Eggs (12 pack)', price: 5.00, category: 'Dairy', image: '🥚', unit: 'pack' },
    { id: 12, name: 'Cheese (8 oz)', price: 6.00, category: 'Dairy', image: '🧀', unit: 'pack' },
    { id: 13, name: 'Butter (1 lb)', price: 5.50, category: 'Dairy', image: '🧈', unit: 'lb' },
    
    // Bakery
    { id: 14, name: 'Bread (1 loaf)', price: 3.50, category: 'Bakery', image: '🍞', unit: 'loaf' },
    { id: 15, name: 'Bagels (6 pack)', price: 4.00, category: 'Bakery', image: '🥯', unit: 'pack' },
    
    // Pantry
    { id: 16, name: 'Rice (5 lb)', price: 8.00, category: 'Pantry', image: '🍚', unit: 'bag' },
    { id: 17, name: 'Pasta (1 lb)', price: 2.50, category: 'Pantry', image: '🍝', unit: 'box' },
    { id: 18, name: 'Cooking Oil (32 oz)', price: 7.00, category: 'Pantry', image: '🛢️', unit: 'bottle' },
    { id: 19, name: 'Beans (15 oz can)', price: 1.50, category: 'Pantry', image: '🫘', unit: 'can' },
    
    // Beverages
    { id: 20, name: 'Orange Juice (64 oz)', price: 5.00, category: 'Beverages', image: '🧃', unit: 'bottle' },
    { id: 21, name: 'Coffee (12 oz)', price: 9.00, category: 'Beverages', image: '☕', unit: 'bag' },
    { id: 22, name: 'Soda (2 liter)', price: 2.50, category: 'Beverages', image: '🥤', unit: 'bottle' },
    
    // Snacks
    { id: 23, name: 'Chips (10 oz)', price: 4.00, category: 'Snacks', image: '🥔', unit: 'bag' },
    { id: 24, name: 'Cookies (12 oz)', price: 5.00, category: 'Snacks', image: '🍪', unit: 'pack' }
  ];

  const filteredItems = groceryItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const addToCart = (item) => {
    const existingItem = cart.find(cartItem => cartItem.id === item.id);
    if (existingItem) {
      setCart(cart.map(cartItem =>
        cartItem.id === item.id
          ? { ...cartItem, quantity: cartItem.quantity + 1 }
          : cartItem
      ));
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
  };

  const updateQuantity = (itemId, change) => {
    setCart(cart.map(item => {
      if (item.id === itemId) {
        const newQuantity = item.quantity + change;
        return newQuantity > 0 ? { ...item, quantity: newQuantity } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (itemId) => {
    setCart(cart.filter(item => item.id !== itemId));
  };

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const getDeliveryFee = () => {
    const store = stores.find(s => s.id === selectedStore);
    return store ? store.deliveryFee : 0;
  };

  const calculateTotal = () => {
    return calculateSubtotal() + getDeliveryFee();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isLoggedIn()) { navigate('/login'); return; }

    if (!selectedStore) {
      alert('Please select a store');
      return;
    }

    if (cart.length === 0) {
      alert('Please add items to your cart');
      return;
    }

    const store = stores.find(s => s.id === selectedStore);
    if (calculateSubtotal() < store.minOrder) {
      alert(`Minimum order for ${store.name} is ${format(store.minOrder)}`);
      return;
    }

    const profile = await fetchProfile();
    const addr = (deliveryAddress || '').trim() || formatProfileAddress(profile.address);
    if (!addr) {
      alert('Please enter a delivery address to continue.');
      return;
    }

    try {
      const order = await createOrder({
        customer_id: 'x',
        service_type: 'grocery',
        vendor_id: selectedStore,
        items: cart.map(i => ({ menu_item_id: String(i.id), name: i.name, quantity: i.quantity, price: i.price })),
        subtotal: calculateSubtotal(),
        delivery_fee: getDeliveryFee(),
        tip: 0,
        total: calculateTotal(),
        pickup_address: { location: store.name, full_address: store.name },
        delivery_address: { location: addr, full_address: addr, instructions: deliveryInstructions || '' },
        customer_phone: profile.phone || '',
        payment_method: 'cod',
        notes: deliveryInstructions || '',
      });
      navigate(`/checkout/${order.id}`);
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not create your order. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br bg-background py-8">
      <div className="container mx-auto px-4 max-w-7xl">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-4"
        >
          ← Back to Home
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Products Section */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-3xl flex items-center">
                  <ShoppingCart className="h-8 w-8 mr-3 text-green-600" />
                  Grocery Delivery
                </CardTitle>
                <p className="text-muted-foreground mt-2">Fresh groceries delivered to your door</p>
              </CardHeader>
              <CardContent>
                {/* Store Selection */}
                <div className="mb-6">
                  <Label className="mb-2 flex items-center">
                    <Store className="h-4 w-4 mr-2" />
                    Select Store
                  </Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {stores.map((store) => (
                      <Card
                        key={store.id}
                        data-testid={`grocery-store-card-${store.id}`}
                        className={`cursor-pointer transition-all ${
                          selectedStore === store.id
                            ? 'border-2 border-green-500 bg-green-50'
                            : 'border border-border hover:shadow-md'
                        }`}
                        onClick={() => setSelectedStore(store.id)}
                      >
                        <CardContent className="p-4 text-center">
                          <h4 className="font-semibold text-foreground mb-1">{store.name}</h4>
                          <p className="text-xs text-muted-foreground">Delivery: {format(store.deliveryFee)}</p>
                          <p className="text-xs text-muted-foreground">Min: ${store.minOrder}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {selectedStore && (
                  <>
                    {/* Search & Filter */}
                    <div className="mb-4">
                      <div className="relative mb-3">
                        <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground/70" />
                        <Input
                          placeholder="Search groceries..."
                          className="pl-10"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {categories.map((category) => (
                          <Button
                            key={category}
                            size="sm"
                            variant={selectedCategory === category.toLowerCase() || (selectedCategory === 'all' && category === 'All') ? 'default' : 'outline'}
                            onClick={() => setSelectedCategory(category === 'All' ? 'all' : category)}
                            className={selectedCategory === category.toLowerCase() || (selectedCategory === 'all' && category === 'All')
                              ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                              : ''
                            }
                          >
                            {category}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Product Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {filteredItems.map((item) => (
                        <Card key={item.id} className="hover:shadow-lg transition-shadow">
                          <CardContent className="p-3">
                            <div className="text-center mb-2">
                              <div className="text-4xl mb-2">{item.image}</div>
                              <Badge className="mb-1 text-xs bg-green-100 text-green-700">{item.category}</Badge>
                              <h4 className="text-sm font-semibold text-foreground mb-1">{item.name}</h4>
                              <p className="text-lg font-bold text-green-600">{format(item.price)}</p>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              data-testid={`grocery-add-btn-${item.id}`}
                              className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white"
                              onClick={() => addToCart(item)}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Cart Section */}
          <div className="lg:sticky lg:top-8 h-fit">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center">
                    <ShoppingCart className="h-5 w-5 mr-2" />
                    Cart
                  </span>
                  {cart.length > 0 && (
                    <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white">
                      {cart.length} items
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit}>
                  {cart.length === 0 ? (
                    <div className="text-center py-8">
                      <ShoppingCart className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                      <p className="text-muted-foreground">Your cart is empty</p>
                      <p className="text-sm text-muted-foreground mt-2">Select a store and add items</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                        {cart.map((item) => (
                          <div key={item.id} className="flex items-start space-x-2 pb-3 border-b">
                            <span className="text-2xl">{item.image}</span>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-semibold text-foreground">{item.name}</h4>
                              <p className="text-xs text-muted-foreground">{format(item.price)} / {item.unit}</p>
                              <div className="flex items-center space-x-1 mt-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-6 w-6 p-0"
                                  onClick={() => updateQuantity(item.id, -1)}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="text-sm font-semibold px-2">{item.quantity}</span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-6 w-6 p-0"
                                  onClick={() => updateQuantity(item.id, 1)}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 text-red-600"
                                  onClick={() => removeFromCart(item.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            <span className="text-sm font-bold text-foreground">
                              {format(item.price * item.quantity)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Delivery Address */}
                      <div className="mb-4 space-y-3">
                        <div>
                          <Label htmlFor="deliveryAddress">Delivery Address</Label>
                          <div className="relative mt-1">
                            <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/70" />
                            <Input
                              id="deliveryAddress"
                              placeholder="Your address"
                              className="pl-9 text-sm"
                              value={deliveryAddress}
                              onChange={(e) => setDeliveryAddress(e.target.value)}
                              data-testid="grocery-delivery-address-input"
                              required
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="instructions">Instructions (Optional)</Label>
                          <Input
                            id="instructions"
                            placeholder="Apt #, gate code..."
                            className="text-sm"
                            value={deliveryInstructions}
                            onChange={(e) => setDeliveryInstructions(e.target.value)}
                          />
                        </div>
                      </div>

                      <Separator className="my-4" />

                      {/* Total */}
                      <div className="bg-matte-800 border border-gold-500/30 p-5 rounded-lg shadow-gold-glow mb-4">
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm text-muted-foreground">
                            <span>Subtotal</span>
                            <span className="text-foreground">{format(calculateSubtotal())}</span>
                          </div>
                          <div className="flex justify-between text-sm text-muted-foreground">
                            <span>Delivery Fee</span>
                            <span className="text-foreground">{format(getDeliveryFee())}</span>
                          </div>
                          <Separator className="bg-gold-500/30" />
                          <div className="flex justify-between items-center pt-1 gap-3 flex-wrap">
                            <span className="text-lg font-semibold text-foreground">Total</span>
                            <CurrencyConverter amountUSD={calculateTotal()} size="lg" />
                          </div>
                        </div>
                      </div>

                      <Button
                        type="submit"
                        className="w-full"
                        data-testid="grocery-checkout-btn"
                      >
                        Checkout
                      </Button>
                    </>
                  )}
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroceryOrderForm;
