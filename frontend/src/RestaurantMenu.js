import React, { useState, useEffect } from 'react';
import { useCurrency } from './CurrencyContext';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { Input } from './components/ui/input';
import { 
  ShoppingCart, 
  Plus, 
  Minus, 
  Search,
  Star,
  Clock,
  MapPin,
  Trash2,
<<<<<<< HEAD
  ArrowRight,
  Store,
  Loader2
} from 'lucide-react';
import MerchantReviews from './MerchantReviews';
import axios from 'axios';
import { getBusinessConfig } from './businessTypeConfig';
import { useCart } from './CartContext';
=======
  ArrowRight
} from 'lucide-react';
import MerchantReviews from './MerchantReviews';
import axios from 'axios';
import { createOrder, fetchProfile, isLoggedIn, formatProfileAddress } from './orderApi';
import { getBusinessConfig } from './businessTypeConfig';
>>>>>>> cb805eb

const STOREFRONT_API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const RestaurantMenu = () => {
<<<<<<< HEAD
  const { formatTTD } = useCurrency();
  const navigate = useNavigate();
  const { restaurantId } = useParams();
  const { cart: globalCart, addItem, setQty, removeItem } = useCart();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [storefront, setStorefront] = useState(null);
  const [loadState, setLoadState] = useState('loading'); // 'loading' | 'found' | 'notfound'

  useEffect(() => {
    if (!restaurantId) { setLoadState('notfound'); return; }
    setLoadState('loading');
    axios.get(`${STOREFRONT_API}/merchants/${restaurantId}/storefront`)
      .then((res) => {
        const d = res.data || {};
        const hasData = d.name || d.logo || d.cover || d.bio || (d.gallery && d.gallery.length) || (d.menu_items && d.menu_items.length);
        if (hasData) {
          setStorefront(d);
          setLoadState('found');
        } else {
          setLoadState('notfound');
        }
      })
      .catch(() => setLoadState('notfound'));
=======
  const { format } = useCurrency();
  const navigate = useNavigate();
  const { restaurantId } = useParams();
  const [cart, setCart] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [storefront, setStorefront] = useState(null);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [placingOrder, setPlacingOrder] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) return;
    fetchProfile().then((p) => {
      setProfilePhone(p.phone || '');
      const addr = formatProfileAddress(p.address);
      if (addr) setDeliveryAddress(addr);
    });
  }, []);

  const handleCheckout = async () => {
    if (!isLoggedIn()) { navigate('/login'); return; }
    const addr = (deliveryAddress || '').trim();
    if (!addr) { alert('Please enter a delivery address to continue.'); return; }
    setPlacingOrder(true);
    try {
      const order = await createOrder({
        customer_id: 'x',
        service_type: 'food',
        restaurant_id: restaurant.id,
        items: cart.map(i => ({ menu_item_id: String(i.id), name: i.name, quantity: i.quantity, price: i.price })),
        subtotal: subtotal,
        delivery_fee: restaurant.deliveryFee,
        tip: 0,
        total: total,
        pickup_address: { location: restaurant.name, full_address: restaurant.address },
        delivery_address: { location: addr, full_address: addr },
        customer_phone: profilePhone || '',
        payment_method: 'cod',
        notes: '',
      });
      navigate(`/checkout/${order.id}`);
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not create your order. Please try again.');
      setPlacingOrder(false);
    }
  };

  useEffect(() => {
    if (!restaurantId) return;
    axios.get(`${STOREFRONT_API}/merchants/${restaurantId}/storefront`)
      .then((res) => {
        const d = res.data || {};
        if (d.name || d.logo || d.cover || d.bio || (d.gallery && d.gallery.length) || (d.menu_items && d.menu_items.length)) {
          setStorefront(d);
        }
      })
      .catch(() => {});
>>>>>>> cb805eb
  }, [restaurantId]);

  // Real vendor data (from the storefront endpoint) with a safe demo fallback.
  const sf = storefront || {};
  const vendorCfg = getBusinessConfig(sf.vendor_type);
  const restaurant = {
    id: restaurantId || 'island-spice',
<<<<<<< HEAD
    name: sf.name || 'Store',
=======
    name: sf.name || 'Island Spice Kitchen',
>>>>>>> cb805eb
    cuisine: sf.cuisine_type || (sf.vendor_type ? vendorCfg.customerLabel : 'Caribbean'),
    rating: sf.rating != null ? sf.rating : 4.8,
    reviews: 342,
    deliveryTime: sf.estimated_delivery_time ? `${sf.estimated_delivery_time} min` : '25-35 min',
<<<<<<< HEAD
    deliveryFee: sf.delivery_fee != null ? sf.delivery_fee : 25.00,
=======
    deliveryFee: sf.delivery_fee != null ? sf.delivery_fee : 12.00,
>>>>>>> cb805eb
    minOrder: sf.minimum_order != null ? sf.minimum_order : 15.00,
    address: (sf.address && (sf.address.street || sf.address.city))
      ? [sf.address.street, sf.address.city, sf.address.country].filter(Boolean).join(', ')
      : '123 Main Street, Kingston, Jamaica',
    description: sf.description || '',
  };

  // Category filter chips reflect the vendor's actual catalog; fall back to the
  // categories that match this business type (menu for restaurants, etc.).
  const derivedCats = Array.from(new Set((sf.menu_items || []).map((m) => m.category).filter(Boolean)));
  const categories = derivedCats.length > 0
<<<<<<< HEAD
    ? Array.from(new Set(['All', 'Popular', ...derivedCats]))
    : (sf.vendor_type
        ? Array.from(new Set(['All', ...vendorCfg.categories.slice(0, 6)]))
=======
    ? ['All', 'Popular', ...derivedCats]
    : (sf.vendor_type
        ? ['All', ...vendorCfg.categories.slice(0, 6)]
>>>>>>> cb805eb
        : ['All', 'Popular', 'Mains', 'Sides', 'Drinks', 'Desserts']);

  const realMenu = (sf.menu_items || []).map((m, i) => ({
    id: m.id || i + 1,
    name: m.name,
    description: m.description || '',
    price: m.price || 0,
    category: m.category || 'Mains',
    image: vendorCfg.itemIcon || '🍽️',
    popular: !!m.popular,
    spicy: !!m.spicy,
  }));

<<<<<<< HEAD
  // Use the merchant's real menu when available. If we resolved a real vendor
  // but it has no items yet, show an empty menu — not demo food.
  const menuItems = realMenu.length > 0 ? realMenu : [];
=======
  const demoMenuItems = [
    {
      id: 1,
      name: 'Jerk Chicken Plate',
      description: 'Authentic jerk chicken with rice & peas, festival, and plantains',
      price: 18.00,
      category: 'Mains',
      image: '🍗',
      popular: true,
      spicy: true
    },
    {
      id: 2,
      name: 'Curry Goat',
      description: 'Tender goat meat in Caribbean curry sauce with rice',
      price: 22.00,
      category: 'Mains',
      image: '🍛',
      popular: true,
      spicy: false
    },
    {
      id: 3,
      name: 'Ackee & Saltfish',
      description: "Jamaica's national dish served with bammy or festival",
      price: 16.00,
      category: 'Mains',
      image: '🐟',
      popular: true,
      spicy: false
    },
    {
      id: 4,
      name: 'Oxtail Dinner',
      description: 'Braised oxtail with butter beans, rice & peas',
      price: 28.00,
      category: 'Mains',
      image: '🥘',
      popular: false,
      spicy: false
    },
    {
      id: 5,
      name: 'Beef Patty',
      description: 'Flaky pastry filled with seasoned beef',
      price: 4.50,
      category: 'Sides',
      image: '🥟',
      popular: true,
      spicy: true
    },
    {
      id: 6,
      name: 'Rice & Peas',
      description: 'Coconut rice with kidney beans',
      price: 5.00,
      category: 'Sides',
      image: '🍚',
      popular: false,
      spicy: false
    },
    {
      id: 7,
      name: 'Fried Plantains',
      description: 'Sweet ripe plantains fried to perfection',
      price: 4.00,
      category: 'Sides',
      image: '🍌',
      popular: false,
      spicy: false
    },
    {
      id: 8,
      name: 'Festival',
      description: 'Sweet fried dumplings',
      price: 3.50,
      category: 'Sides',
      image: '🥖',
      popular: false,
      spicy: false
    },
    {
      id: 9,
      name: 'Callaloo',
      description: 'Traditional Caribbean greens',
      price: 6.00,
      category: 'Sides',
      image: '🥬',
      popular: false,
      spicy: false
    },
    {
      id: 10,
      name: 'Sorrel Drink',
      description: 'Refreshing hibiscus drink',
      price: 3.50,
      category: 'Drinks',
      image: '🧃',
      popular: false,
      spicy: false
    },
    {
      id: 11,
      name: 'Ginger Beer',
      description: 'Spicy homemade ginger beer',
      price: 3.50,
      category: 'Drinks',
      image: '🥤',
      popular: true,
      spicy: true
    },
    {
      id: 12,
      name: 'Coconut Water',
      description: 'Fresh coconut water',
      price: 4.00,
      category: 'Drinks',
      image: '🥥',
      popular: false,
      spicy: false
    },
    {
      id: 13,
      name: 'Rum Cake',
      description: 'Traditional Caribbean rum cake',
      price: 7.00,
      category: 'Desserts',
      image: '🍰',
      popular: true,
      spicy: false
    },
    {
      id: 14,
      name: 'Sweet Potato Pudding',
      description: 'Grated sweet potato with coconut',
      price: 6.00,
      category: 'Desserts',
      image: '🍮',
      popular: false,
      spicy: false
    }
  ];

  // Use the merchant's real menu when available. If we resolved a real vendor
  // (sf.name) but it has no items yet, show an empty menu — not demo food.
  const menuItems = realMenu.length > 0 ? realMenu : (sf.name ? [] : demoMenuItems);
>>>>>>> cb805eb

  const filteredItems = menuItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || 
                           selectedCategory === 'popular' && item.popular ||
                           item.category.toLowerCase() === selectedCategory.toLowerCase();
    return matchesSearch && matchesCategory;
  });

<<<<<<< HEAD
  const serviceType = (() => {
    const vt = (sf.vendor_type || '').toLowerCase();
    if (['pharmacy', 'grocery', 'convenience', 'car_rental', 'courier'].includes(vt)) return vt === 'convenience' ? 'grocery' : vt;
    return 'food';
  })();
  const vendorInfo = {
    vendor_id: restaurant.id,
    vendor_name: restaurant.name,
    vendor_type: sf.vendor_type || 'restaurant',
    service_type: serviceType,
    delivery_fee: restaurant.deliveryFee,
    address: restaurant.address,
  };
  const cart = (globalCart[restaurant.id]?.items) || [];

  const addToCart = (item) => {
    addItem(vendorInfo, { id: item.id, name: item.name, price: item.price }, 1);
  };

  const updateQuantity = (itemId, change) => {
    const current = cart.find((i) => String(i.id) === String(itemId));
    if (!current) return;
    setQty(restaurant.id, itemId, current.quantity + change);
  };

  const removeFromCart = (itemId) => {
    removeItem(restaurant.id, itemId);
=======
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
>>>>>>> cb805eb
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const total = subtotal + restaurant.deliveryFee;
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

<<<<<<< HEAD
  if (loadState === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" data-testid="storefront-loading">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadState === 'notfound') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4" data-testid="storefront-unavailable">
        <div className="text-center max-w-md">
          <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
            <Store className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Store unavailable</h1>
          <p className="text-sm text-muted-foreground mb-6">
            This business isn't available right now — it may have been removed or isn't open for orders yet.
          </p>
          <Button onClick={() => navigate('/businesses')} data-testid="storefront-back-btn">
            <ArrowRight className="h-4 w-4 mr-1" />Browse other businesses
          </Button>
        </div>
      </div>
    );
  }

=======
>>>>>>> cb805eb
  return (
    <div className="min-h-screen bg-gradient-to-br bg-background py-8">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Storefront hero (custom merchant branding) */}
        {storefront && (
          <div className="mb-6 rounded-2xl overflow-hidden border border-matte-800 bg-card" data-testid="storefront-hero">
            <div
              className="h-40 sm:h-52 bg-matte-800 bg-cover bg-center"
              style={storefront.cover ? { backgroundImage: `url(${storefront.cover})` } : {}}
              data-testid="storefront-hero-cover"
            />
            <div className="px-5 sm:px-7 pb-6 -mt-10">
              <div className="flex items-end gap-4">
                {storefront.logo && (
                  <img src={storefront.logo} alt="store logo" data-testid="storefront-hero-logo"
                    className="h-20 w-20 rounded-2xl border-4 border-background object-cover shadow-lg bg-card" />
                )}
                <h2 className="text-2xl font-bold text-foreground pb-1">{restaurant.name}</h2>
              </div>
              {storefront.bio && (
                <p className="text-muted-foreground mt-3 max-w-2xl" data-testid="storefront-hero-bio">{storefront.bio}</p>
              )}
              {storefront.gallery && storefront.gallery.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3 mt-5" data-testid="storefront-hero-gallery">
                  {storefront.gallery.map((g, i) => (
                    <div key={`${g}-${i}`} className="aspect-square rounded-lg overflow-hidden bg-matte-800">
                      <img src={g} alt={`gallery-${i}`} className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Restaurant Header */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <Button
              variant="ghost"
              onClick={() => navigate(sf.vendor_type && sf.vendor_type !== 'restaurant' ? '/businesses' : '/restaurants')}
              className="mb-4"
            >
              ← Back to {sf.vendor_type && sf.vendor_type !== 'restaurant' ? 'Businesses' : 'Restaurants'}
            </Button>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground mb-2">{restaurant.name}</h1>
                <div className="flex items-center space-x-4 text-muted-foreground mb-3">
                  <div className="flex items-center">
                    <Star className="h-5 w-5 text-gold-500 fill-current mr-1" />
                    <span className="font-semibold">{restaurant.rating}</span>
                    <span className="ml-1">({restaurant.reviews} reviews)</span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="h-5 w-5 mr-1" />
                    <span>{restaurant.deliveryTime}</span>
                  </div>
                  <div className="flex items-center">
                    <MapPin className="h-5 w-5 mr-1" />
                    <span>{restaurant.address}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge className="bg-gold-500/15 text-gold-700">{restaurant.cuisine}</Badge>
<<<<<<< HEAD
                  <Badge variant="outline">Delivery {formatTTD(restaurant.deliveryFee)}</Badge>
                  <Badge variant="outline">Min {formatTTD(restaurant.minOrder)}</Badge>
                  {sf.open_status?.enabled && (
                    sf.open_status.is_open ? (
                      <Badge className="bg-green-100 text-green-800" data-testid="storefront-open-badge">
                        ● Open now{sf.open_status.hours_today ? ` · closes ${sf.open_status.hours_today.close}` : ''}
                      </Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-800" data-testid="storefront-closed-badge">
                        ● Closed
                      </Badge>
                    )
                  )}
=======
                  <Badge variant="outline">Delivery {format(restaurant.deliveryFee)}</Badge>
                  <Badge variant="outline">Min {format(restaurant.minOrder)}</Badge>
>>>>>>> cb805eb
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Menu Section */}
          <div className="lg:col-span-2 space-y-6">
<<<<<<< HEAD
            {/* Closed banner — store isn't accepting orders right now */}
            {sf.open_status?.enabled && !sf.open_status?.is_open && (
              <Card className="border-red-300 bg-red-50" data-testid="storefront-closed-banner">
                <CardContent className="p-4 flex items-center gap-3">
                  <Clock className="h-5 w-5 text-red-600 shrink-0" />
                  <div>
                    <h3 className="font-semibold text-red-800">This store is currently closed</h3>
                    <p className="text-sm text-red-700">
                      You can browse the menu, but orders can only be placed during opening hours.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
=======
>>>>>>> cb805eb
            {/* Business-type CTA banner (pharmacy Rx upload, grocery/fleet messaging) */}
            {vendorCfg.heroCta && (
              <Card className="border-gold-500/40 bg-gradient-to-r from-gold-500/10 to-neon-cyan/5" data-testid="storefront-type-cta">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{vendorCfg.itemIcon}</span>
                    <div>
                      <h3 className="font-semibold text-foreground">{vendorCfg.heroCta.title}</h3>
                      <p className="text-sm text-muted-foreground">{vendorCfg.heroCta.subtitle}</p>
                    </div>
                  </div>
                  {vendorCfg.heroCta.label && (
                    <Button
                      className="bg-gold-gradient text-white shrink-0"
                      onClick={() => navigate(vendorCfg.heroCta.route)}
                      data-testid="storefront-cta-btn"
                    >
                      {vendorCfg.heroCta.label}
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
            {/* Search & Filter */}
            <Card>
              <CardContent className="p-4">
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground/70" />
                  <Input
                    placeholder={vendorCfg.searchPlaceholder || 'Search menu items...'}
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
<<<<<<< HEAD
                  {categories.map((category, ci) => (
                    <Button
                      key={`${category}-${ci}`}
=======
                  {categories.map((category) => (
                    <Button
                      key={category}
>>>>>>> cb805eb
                      size="sm"
                      variant={selectedCategory === category.toLowerCase() ? 'default' : 'outline'}
                      onClick={() => setSelectedCategory(category.toLowerCase())}
                      className={selectedCategory === category.toLowerCase() 
                        ? 'bg-gold-gradient text-white'
                        : ''
                      }
                    >
                      {category}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Menu Items */}
            <div className="space-y-4">
              {filteredItems.map((item) => (
                <Card key={item.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-4">
                      <div className="text-5xl">{item.image}</div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="text-lg font-semibold text-foreground flex items-center">
                              {item.name}
                              {item.popular && (
                                <Badge className="ml-2 bg-gold-500/15 text-yellow-700">Popular</Badge>
                              )}
                              {item.spicy && (
                                <span className="ml-2">🌶️</span>
                              )}
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                          </div>
<<<<<<< HEAD
                          <p className="text-xl font-bold text-foreground">{formatTTD(item.price)}</p>
=======
                          <p className="text-xl font-bold text-foreground">{format(item.price)}</p>
>>>>>>> cb805eb
                        </div>
                        <Button
                          className="bg-gold-gradient text-white"
                          onClick={() => addToCart(item)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          {vendorCfg.addLabel || 'Add to Cart'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredItems.length === 0 && (
              <Card>
                <CardContent className="p-12 text-center">
                  <p className="text-muted-foreground">No items found matching your search.</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Cart Section */}
          <div className="lg:sticky lg:top-8 h-fit">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center">
                    <ShoppingCart className="h-5 w-5 mr-2" />
                    Your Cart
                  </span>
                  {cartItemCount > 0 && (
                    <Badge className="bg-gold-gradient text-white">
                      {cartItemCount} {cartItemCount === 1 ? 'item' : 'items'}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {cart.length === 0 ? (
                  <div className="text-center py-8">
                    <ShoppingCart className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                    <p className="text-muted-foreground">Your cart is empty</p>
                    <p className="text-sm text-muted-foreground mt-2">Add items from the menu to get started</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
                      {cart.map((item) => (
                        <div key={item.id} className="flex items-start space-x-3 pb-4 border-b">
                          <div className="text-3xl">{item.image}</div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-foreground truncate">{item.name}</h4>
<<<<<<< HEAD
                            <p className="text-sm text-muted-foreground">{formatTTD(item.price)}</p>
=======
                            <p className="text-sm text-muted-foreground">{format(item.price)}</p>
>>>>>>> cb805eb
                            <div className="flex items-center space-x-2 mt-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateQuantity(item.id, -1)}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="font-semibold px-3">{item.quantity}</span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateQuantity(item.id, 1)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-600"
                                onClick={() => removeFromCart(item.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="font-semibold text-foreground">
<<<<<<< HEAD
                            {formatTTD(item.price * item.quantity)}
=======
                            {format(item.price * item.quantity)}
>>>>>>> cb805eb
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2 mb-6">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Subtotal</span>
<<<<<<< HEAD
                        <span>{formatTTD(subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Delivery Fee</span>
                        <span>{formatTTD(restaurant.deliveryFee)}</span>
                      </div>
                      <div className="flex justify-between text-xl font-bold text-foreground pt-2 border-t">
                        <span>Total</span>
                        <span>{formatTTD(total)}</span>
=======
                        <span>{format(subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Delivery Fee</span>
                        <span>{format(restaurant.deliveryFee)}</span>
                      </div>
                      <div className="flex justify-between text-xl font-bold text-foreground pt-2 border-t">
                        <span>Total</span>
                        <span>{format(total)}</span>
>>>>>>> cb805eb
                      </div>
                    </div>

                    {subtotal < restaurant.minOrder && (
                      <div className="mb-4 p-3 bg-gold-500/10 rounded-lg text-sm text-yellow-800">
<<<<<<< HEAD
                        Add {formatTTD(restaurant.minOrder - subtotal)} more to reach minimum order
                      </div>
                    )}

                    <Button
                      className="w-full bg-gold-gradient text-white"
                      disabled={subtotal < restaurant.minOrder}
                      onClick={() => navigate('/cart')}
                      data-testid="restaurant-checkout-btn"
                    >
                      Go to cart &amp; checkout
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      Keep shopping other stores — everything checks out together in one cart.
                    </p>
=======
                        Add {format(restaurant.minOrder - subtotal)} more to reach minimum order
                      </div>
                    )}

                    <div className="mb-4">
                      <label className="text-sm font-medium text-foreground mb-1 block">Delivery address</label>
                      <Input
                        placeholder="Enter your delivery address"
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        data-testid="restaurant-delivery-address-input"
                      />
                    </div>

                    <Button
                      className="w-full bg-gold-gradient text-white"
                      disabled={subtotal < restaurant.minOrder || placingOrder}
                      onClick={handleCheckout}
                      data-testid="restaurant-checkout-btn"
                    >
                      {placingOrder ? 'Creating order…' : 'Proceed to Checkout'}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
>>>>>>> cb805eb
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <MerchantReviews merchantId={restaurant.id} />
      </div>
    </div>
  );
};

export default RestaurantMenu;
