import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import KPIDashboard from './KPIDashboard';
import ThemePreview from './ThemePreview';
import CarRentalPage from './CarRentalPage';
import DriverOnboarding from './DriverOnboarding';
import RestaurantOnboarding from './RestaurantOnboarding';
import RestaurantMenuManagement from './RestaurantMenuManagement';
import VendorDashboard from './VendorDashboard';
import DriverDashboard from './DriverDashboard';
import AdminPanel from './AdminPanel';
import AdminInviteAccept from './AdminInviteAccept';
import PromoCodeManagement from './PromoCodeManagement';
import AddressManagement from './AddressManagement';
import PrivacyPolicy from './PrivacyPolicy';
import Terms from './Terms';
import OrderScheduling from './OrderScheduling';
import { CheckoutPage, PaymentSuccess, PaymentCancel } from './CheckoutPage';
import VendorStripeConnect from './VendorStripeConnect';
import WalletPage from './WalletPage';
import OrderTrackingPage from './OrderTrackingPageWithMaps';
import PaymentMethodsSelector from './PaymentMethodsSelector';
import DriverEarningsDashboard from './DriverEarningsDashboard';
import BusinessEarningsDashboard from './BusinessEarningsDashboard';
import AuthPage from './AuthPage';
import SocialAuthCallback from './SocialAuthCallback';
import MicrosoftAuthCallback from './MicrosoftAuthCallback';
import ProfilePage from './ProfilePage';
import IdentityVerificationCallback from './IdentityVerificationCallback';
import BusinessOnboarding from './BusinessOnboarding';
import ReferralPage from './ReferralPage';
import ReferralBanner from './ReferralBanner';
import ClaimsPage from './ClaimsPage';
import UnreadChatBell from './UnreadChatBell';
import SubAppsDropdown from './SubAppsDropdown';
import Footer from './Footer';
import ProtectedRoute from './ProtectedRoute';
import AboutPage from './AboutPage';
import HotRightNow from './HotRightNow';
import AnimatedCounter from './AnimatedCounter';
import PromoSlides from './PromoSlides';
import LiveOrderMapPreview from './LiveOrderMapPreview';
import DriverLeaderboard from './DriverLeaderboard';
import EnablePushButton from './EnablePushButton';
import { ModeProvider } from './ModeContext';
import ModeSwitcher from './ModeSwitcher';
import SubscriptionPlans from './SubscriptionPlans';
import RestaurantMenu from './RestaurantMenu';
import TaxiBookingForm from './TaxiBookingForm';
import CourierOrderForm from './CourierOrderForm';
import PharmacyOrderForm from './PharmacyOrderForm';
import GroceryOrderForm from './GroceryOrderForm';
import { Button } from './components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Textarea } from './components/ui/textarea';
import { Badge } from './components/ui/badge';
import { Separator } from './components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { useToast } from './hooks/use-toast';
import { Toaster } from './components/ui/toaster';
import { 
  Building2, 
  Utensils, 
  Pill, 
  ShoppingCart, 
  Package, 
  Car,
  MessageCircle,
  MapPin,
  UserCircle,
  Clock,
  CreditCard,
  CheckCircle,
  AlertCircle,
  Star,
  Phone,
  Mail,
  Globe,
  Calendar,
  DollarSign,
  Users,
  TrendingUp,
  Shield,
  Zap,
  Heart,
  Award,
  Target,
  Plus,
  Minus,
  ChefHat,
  Truck,
  Timer,
  Navigation,
  Eye,
  Edit,
  Settings,
  Menu,
  X,
  ChevronRight,
  Apple,
  Smartphone,
  ArrowRight,
  Search,
  Wallet as WalletIcon
} from 'lucide-react';
import axios from 'axios';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Static role-guard sets, hoisted to module scope so they keep a stable
// reference identity across renders (avoids re-rendering ProtectedRoute).
const ROLES_DRIVER_ADMIN = ['driver', 'admin'];
const ROLES_DRIVER_ONBOARD = ['driver', 'customer', 'admin'];
const ROLES_VENDOR_ADMIN = ['restaurant', 'business', 'admin'];
const ROLES_VENDOR_ONBOARD = ['restaurant', 'customer', 'admin'];
const ROLES_ADMIN_ONLY = ['admin'];
const ROLES_ADMIN_AGENT = ['admin', 'agent'];

// Auth Context
// Auth context, provider and hook now live in ./AuthContext.js
import { AuthContext, useAuth, AuthProvider } from './AuthContext';

// Global Search Component
const GlobalSearch = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const navigate = useNavigate();
  const searchRef = React.useRef(null);

  // Debounce search
  useEffect(() => {
    const delaySearch = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        performSearch(searchQuery);
      } else {
        setSearchResults([]);
        setShowResults(false);
      }
    }, 300);

    return () => clearTimeout(delaySearch);
  }, [searchQuery]);

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const performSearch = async (query) => {
    setIsSearching(true);
    try {
      const response = await axios.get(`${API}/search?q=${encodeURIComponent(query)}`);
      setSearchResults(response.data.results || []);
      setShowResults(true);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleResultClick = (result) => {
    setShowResults(false);
    setSearchQuery('');
    
    // Navigate based on result type
    if (result.type === 'vendor') {
      if (result.vendor_type === 'restaurant') {
        navigate(`/restaurants/${result.id}`);
      } else if (result.vendor_type === 'pharmacy') {
        navigate(`/pharmacy/${result.id}`);
      } else if (result.vendor_type === 'grocery') {
        navigate(`/grocery/${result.id}`);
      }
    } else if (result.type === 'product') {
      // Navigate to vendor page with product highlighted
      navigate(`/restaurants/${result.vendor_id}?product=${result.id}`);
    }
  };

  const submitSearch = (e) => {
    e?.preventDefault?.();
    if (searchQuery.trim().length >= 2) {
      performSearch(searchQuery);
      setShowResults(true);
    }
  };

  return (
    <form ref={searchRef} onSubmit={submitSearch} className="relative w-full min-w-[260px]" data-testid="global-search">
      <div className="flex items-stretch shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gold-500/80 pointer-events-none" />
          <Input
            type="text"
            placeholder="Search restaurants, food, pharmacies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
            data-testid="global-search-input"
            className="pl-11 pr-4 py-3 h-12 w-full text-base bg-matte-800/80 border-2 border-gold-500/30 rounded-l-xl rounded-r-none focus:border-gold-500 focus:ring-2 focus:ring-gold-500/30 placeholder:text-muted-foreground"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="animate-spin h-4 w-4 border-2 border-gold-500/30 border-t-gold-500 rounded-full"></div>
            </div>
          )}
        </div>
        <button
          type="submit"
          data-testid="global-search-btn"
          aria-label="Search"
          className="h-12 px-5 sm:px-6 bg-gold-gradient text-white font-semibold rounded-r-xl border-2 border-l-0 border-gold-500/30 hover:opacity-90 active:scale-[0.98] transition-all flex items-center gap-2"
        >
          <Search className="h-5 w-5" />
          <span className="hidden sm:inline">Search</span>
        </button>
      </div>

      {/* Search Results Dropdown */}
      {showResults && searchResults.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card rounded-lg shadow-xl border border-border max-h-96 overflow-y-auto z-50">
          {/* Vendors */}
          {searchResults.filter(r => r.type === 'vendor').length > 0 && (
            <div className="p-2">
              <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">Vendors</div>
              {searchResults.filter(r => r.type === 'vendor').map((result, index) => {
                const vendorColorMap = {
                  restaurant: 'from-red-500 to-orange-500',
                  pharmacy: 'from-neon-cyan to-gold-500',
                };
                const vendorIconMap = { restaurant: '🍽️', pharmacy: '💊' };
                const gradientCls = vendorColorMap[result.vendor_type] || 'from-green-500 to-emerald-500';
                const iconChar = vendorIconMap[result.vendor_type] || '🛒';
                return (
                <button
                  key={`vendor-${index}`}
                  onClick={() => handleResultClick(result)}
                  className="w-full text-left px-3 py-3 hover:bg-background rounded-lg transition-colors flex items-center space-x-3"
                >
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradientCls} flex items-center justify-center text-white text-xl`}>
                    {iconChar}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-foreground">{result.name}</div>
                    <div className="text-sm text-muted-foreground capitalize">{result.vendor_type}</div>
                  </div>
                </button>
                );
              })}
            </div>
          )}

          {/* Products */}
          {searchResults.filter(r => r.type === 'product').length > 0 && (
            <div className="p-2 border-t border-border/50">
              <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">Products</div>
              {searchResults.filter(r => r.type === 'product').map((result, index) => (
                <button
                  key={`product-${index}`}
                  onClick={() => handleResultClick(result)}
                  className="w-full text-left px-3 py-3 hover:bg-background rounded-lg transition-colors"
                >
                  <div className="font-semibold text-foreground">{result.name}</div>
                  <div className="text-sm text-muted-foreground">{result.vendor_name}</div>
                  {result.price && (
                    <div className="text-sm font-medium text-gold-500">${result.price}</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* No Results */}
      {showResults && searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card rounded-lg shadow-xl border border-border p-4 z-50">
          <div className="text-center text-muted-foreground">
            <Search className="h-8 w-8 mx-auto mb-2 text-muted-foreground/70" />
            <p>No results found for &quot;{searchQuery}&quot;</p>
          </div>
        </div>
      )}
    </form>
  );
};

// Header Component
const Header = () => {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Each nav item declares which roles should see it.
  //   `show: 'everyone'`        — visible regardless of auth state
  //   `show: 'guest'`           — only when logged out
  //   `show: 'authed'`          — any logged-in user
  //   `show: ['admin', 'driver']` — restricted to listed user_type(s)
  const allNavigationItems = [
    { to: "/restaurants",       label: "Restaurants",       icon: Utensils,    show: 'everyone' },
    { to: "/car-rentals",       label: "Car Rentals",       icon: Car,         show: 'everyone' },
    { to: "/wallet",            label: "Wallet",            icon: WalletIcon,  show: 'authed' },
    { to: "/analytics",         label: "Analytics",         icon: TrendingUp,  show: ['admin'] },
    { to: "/pricing",           label: "Pricing",           icon: DollarSign,  show: 'everyone' },
    { to: "/partner",           label: "Become a Partner",  icon: Building2,   show: 'guest-or-customer' },
    { to: "/driver-onboarding", label: "Drive with Us",     icon: Truck,       show: 'guest-or-customer' },
    { to: "/support",           label: "Support",           icon: MessageCircle, show: 'everyone' },
  ];

  const navigationItems = allNavigationItems.filter((item) => {
    if (item.show === 'everyone') return true;
    if (item.show === 'guest') return !user;
    if (item.show === 'authed') return !!user;
    if (item.show === 'guest-or-customer') return !user || user.user_type === 'customer';
    if (Array.isArray(item.show)) return user ? item.show.includes(user.user_type) : false;
    return true;
  });

  return (
    <>
      <header className="bg-card/90 backdrop-blur-xl border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Brand + Sub-Apps Dropdown */}
            <SubAppsDropdown />

            {/* Global Search - Desktop */}
            <div className="hidden md:flex flex-1 max-w-4xl">
              <GlobalSearch />
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center space-x-6">
              {navigationItems.map((item) => (
                <Link 
                  key={item.to}
                  to={item.to} 
                  className="text-foreground/90 hover:text-gold-500 transition-colors font-medium"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* Desktop Auth Section */}
            <div className="hidden md:flex items-center space-x-4">
              {user ? (
                <div className="flex items-center space-x-3">
                  <UnreadChatBell />
                  <ModeSwitcher />
                  <span className="text-sm text-foreground/90 hidden lg:inline">Welcome, {user.name}</span>
                  <Button onClick={() => window.location.href = '/dashboard'} variant="outline" size="sm">
                    Dashboard
                  </Button>
                  <Button onClick={logout} variant="ghost" size="sm">
                    Logout
                  </Button>
                </div>
              ) : (
                <div className="flex items-center space-x-3">
                  <Button onClick={() => window.location.href = '/login'} variant="outline">
                    Sign In
                  </Button>
                  <Button onClick={() => window.location.href = '/signup'} className="bg-gold-gradient text-white">
                    Sign Up
                  </Button>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="mobile-menu-btn"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6 text-foreground/90" />
              ) : (
                <Menu className="h-6 w-6 text-foreground/90" />
              )}
            </button>
          </div>

          {/* Mobile Navigation Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden mt-4 pb-4 border-t border-border bg-card/95 backdrop-blur-md">
              {/* Mobile Search */}
              <div className="px-4 py-3">
                <GlobalSearch />
              </div>
              
              <nav className="flex flex-col space-y-1 mt-4">
                {navigationItems.map((item) => {
                  const IconComponent = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className="flex items-center space-x-3 px-4 py-3 text-foreground/90 hover:text-gold-500 hover:bg-matte-800/40 rounded-lg transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                      data-testid={`mobile-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <IconComponent className="h-5 w-5" />
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  );
                })}
                
                {/* Mobile Auth Section */}
                <div className="border-t border-border pt-4 px-4">
                  {user ? (
                    <div className="space-y-3">
                      <div className="text-sm text-muted-foreground">
                        Welcome, <span className="font-semibold">{user.name}</span>
                      </div>
                      <div className="flex flex-col space-y-2">
                        <Button 
                          onClick={() => {
                            window.location.href = '/dashboard';
                            setMobileMenuOpen(false);
                          }}
                          variant="outline" 
                          size="sm"
                          className="w-full justify-start"
                          data-testid="mobile-dashboard-btn"
                        >
                          <Users className="h-4 w-4 mr-2" />
                          Dashboard
                        </Button>
                        <Button 
                          onClick={() => {
                            logout();
                            setMobileMenuOpen(false);
                          }}
                          variant="ghost" 
                          size="sm"
                          className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                          data-testid="mobile-logout-btn"
                        >
                          Logout
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button 
                      onClick={() => {
                        login('/dashboard');
                        setMobileMenuOpen(false);
                      }}
                      className="w-full bg-gold-gradient text-white"
                      data-testid="mobile-signin-btn"
                    >
                      Sign In
                    </Button>
                  )}
                </div>
              </nav>
            </div>
          )}
        </div>
      </header>

      {/* Overlay for mobile menu */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </>
  );
};

// Landing Page
const LandingPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Services order with Taxi first as requested
  const services = [
    {
      icon: Car,
      name: 'Taxi Service',
      description: 'Reliable ride services across the islands',
      color: 'from-yellow-500 to-orange-500',
      serviceType: 'taxi',
      route: '/taxi-booking',
      image: '🚕',
      tagline: 'Your ride, your way'
    },
    {
      icon: Utensils,
      name: 'Food Delivery',
      description: 'Fresh Caribbean cuisine delivered to your door',
      color: 'from-red-500 to-orange-500',
      serviceType: 'food',
      route: '/restaurants',
      image: '🍽️',
      tagline: 'Delicious delivered'
    },
    {
      icon: Pill,
      name: 'Pharmacy',
      description: 'Prescription & health products delivery',
      color: 'from-neon-cyan to-gold-500',
      serviceType: 'pharmacy',
      route: '/pharmacy-order',
      image: '💊',
      tagline: 'Health at your door'
    },
    {
      icon: ShoppingCart,
      name: 'Groceries',
      description: 'Fresh groceries and household items',
      color: 'from-green-500 to-emerald-500',
      serviceType: 'grocery',
      route: '/grocery-order',
      image: '🛒',
      tagline: 'Fresh from the market'
    },
    {
      icon: Package,
      name: 'Courier',
      description: 'Fast and secure package delivery',
      color: 'from-purple-500 to-pink-500',
      serviceType: 'courier',
      route: '/courier-order',
      image: '📦',
      tagline: 'Delivered with care'
    },
    {
      icon: Car,
      name: 'Car Rental',
      description: 'Airport and city car rental services',
      color: 'from-blue-500 to-indigo-500',
      serviceType: 'car_rental',
      route: '/car-rentals',
      image: '🚗',
      tagline: 'Drive your adventure'
    }
  ];

  const stats = [
    { value: 50,  suffix: 'K+', label: 'Active Users' },
    { value: 5,   suffix: 'K+', label: 'Partner Businesses' },
    { value: 100, suffix: 'K+', label: 'Deliveries Completed' },
    { value: 4.8, suffix: '',   label: 'Average Rating', fixed: true },
  ];

  const features = [
    {
      icon: '⚡',
      title: 'Lightning Fast',
      description: 'Average delivery in under 30 minutes across the islands'
    },
    {
      icon: '🛡️',
      title: 'Secure & Safe',
      description: 'Verified partners and encrypted transactions'
    },
    {
      icon: '💰',
      title: 'Best Prices',
      description: 'Competitive rates with no hidden fees'
    },
    {
      icon: '📱',
      title: 'Easy Tracking',
      description: 'Real-time updates from pickup to delivery'
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section - Caribbean Sunshine (light) */}
      <section className="relative overflow-hidden bg-gradient-to-b from-orange-50 via-background to-background pt-20 pb-32">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,90,0,0.10),transparent_60%)]"></div>
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl"></div>
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-accent/10 blur-3xl"></div>
        
        <div className="relative container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center text-secondary">
            <div className="inline-block mb-6 px-6 py-2 bg-primary/10 border border-primary/20 backdrop-blur-sm rounded-full">
              <span className="text-sm font-semibold text-primary">🏝️ Caribbean&apos;s #1 Delivery Platform</span>
            </div>
            
            <h1 className="font-heading text-5xl md:text-7xl font-extrabold mb-6 leading-tight tracking-tight text-secondary">
              Everything you need,
              <br />
              <span className="text-primary">delivered instantly</span>
            </h1>
            
            <p className="text-xl md:text-2xl mb-10 text-muted-foreground font-light max-w-2xl mx-auto">
              From fresh meals to everyday essentials. Fast, reliable delivery across the Caribbean islands.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              <Button 
                size="lg" 
                className="rounded-full px-10 py-7 text-lg shadow-[0_4px_14px_0_rgba(255,90,0,0.39)] hover:shadow-lg active:scale-95 transition-all"
                onClick={() => {
                  const servicesSection = document.getElementById('services');
                  servicesSection?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Get Started
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="rounded-full border-2 border-slate-200 text-secondary hover:border-primary hover:bg-primary/5 px-10 py-7 text-lg transition-all"
                onClick={() => navigate('/partner')}
              >
                Become a Partner
              </Button>
            </div>

            {/* Hot right now widget */}
            <div className="mt-12 max-w-2xl mx-auto">
              <HotRightNow />
            </div>

            {/* Live order map preview */}
            <div className="mt-12 max-w-4xl mx-auto">
              <LiveOrderMapPreview />
            </div>

            {/* Advertisement / promo slides */}
            <div className="mt-10 max-w-4xl mx-auto">
              <PromoSlides />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-4xl md:text-5xl font-bold mb-2 text-secondary" data-testid={`stat-${stat.label.replace(/\s+/g, '-').toLowerCase()}`}>
                    {stat.fixed ? stat.value.toFixed(1) : <AnimatedCounter value={stat.value} suffix={stat.suffix} />}
                  </div>
                  <div className="text-sm md:text-base text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Services Section - Card Grid */}
      <section id="services" className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              What do you need?
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Choose from our wide range of delivery services
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            {services.map((service) => (
              <div 
                key={service.serviceType}
                onClick={() => navigate(service.route)}
                className="group cursor-pointer"
              >
                <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 bg-card h-full">
                  <div className={`absolute inset-0 bg-gradient-to-br ${service.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>
                  
                  <CardContent className="p-8">
                    <div className="flex items-start justify-between mb-6">
                      <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${service.color} flex items-center justify-center text-3xl shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                        {service.image}
                      </div>
                      <ChevronRight className="h-6 w-6 text-muted-foreground/70 group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                    </div>
                    
                    <h3 className="text-2xl font-bold text-foreground mb-2">
                      {service.name}
                    </h3>
                    
                    <p className="text-sm font-medium text-muted-foreground mb-3">
                      {service.tagline}
                    </p>
                    
                    <p className="text-muted-foreground leading-relaxed">
                      {service.description}
                    </p>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section - Modern 4-column */}
      <section className="py-20 bg-card">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Why IslandHop?
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              The smartest way to get things delivered across the Caribbean
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
            {features.map((feature) => (
              <div key={feature.title} className="text-center p-6">
                <div className="text-6xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-bold text-foreground mb-3">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Latest News & Our Vision */}
      <section className="relative overflow-hidden bg-muted py-24" data-testid="news-vision-section">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(255,90,0,0.06),transparent_60%)]"></div>
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-accent/5 blur-3xl"></div>
        <div className="relative container mx-auto px-4">
          <div className="text-center mb-14">
            <div className="inline-block mb-4 px-5 py-1.5 bg-primary/10 border border-primary/20 rounded-full">
              <span className="text-sm font-semibold text-primary">🇹🇹 Latest from IslandHop</span>
            </div>
            <h2 className="font-heading text-4xl md:text-5xl font-extrabold text-secondary tracking-tight">
              News &amp; <span className="text-primary">Our Vision</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
            {/* Latest News */}
            <div className="group relative rounded-2xl border border-slate-100 bg-card shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-8 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-1" data-testid="news-block">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-primary">Now Expanding</span>
              </div>
              <h3 className="text-2xl font-bold text-secondary mb-3">Officially expanding across Trinidad &amp; Tobago</h3>
              <p className="text-muted-foreground leading-relaxed text-lg">
                IslandHop is officially expanding its footprint across Trinidad &amp; Tobago! We are currently onboarding our first wave of logistics partners and service professionals to bring you the best on-demand experience in the Caribbean. Stay tuned for our live launch!
              </p>
            </div>

            {/* Our Vision */}
            <div className="group relative rounded-2xl border border-slate-100 bg-card shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-8 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-1" data-testid="vision-block">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                  <Heart className="h-6 w-6 text-accent" />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-accent">Why IslandHop</span>
              </div>
              <h3 className="text-2xl font-bold text-secondary mb-3">Community-first, built for the T&amp;T landscape</h3>
              <p className="text-muted-foreground leading-relaxed text-lg">
                We&apos;re more than just delivery; we&apos;re a community-first platform designed to empower local artisans, technicians, and drivers. Delivering anything, anytime, anywhere—built specifically for the T&amp;T landscape.
              </p>
            </div>
          </div>
        </div>
      </section>


      {/* App Download Section */}
      <section className="py-20 bg-gold-gradient">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center text-white">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Get the IslandHop App
            </h2>
            <p className="text-xl mb-10 text-white/90">
              Order faster and track your deliveries in real-time
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="bg-black hover:bg-gray-900 text-white px-8 py-6 text-base font-semibold"
              >
                <Apple className="mr-3 h-6 w-6" />
                Download on App Store
              </Button>
              <Button 
                size="lg" 
                className="bg-card hover:bg-background text-foreground px-8 py-6 text-base font-semibold"
              >
                <Smartphone className="mr-3 h-6 w-6" />
                Get it on Google Play
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Partner CTA */}
      <section className="py-20 bg-gray-900 text-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Grow your business with IslandHop
            </h2>
            <p className="text-xl mb-10 text-gray-300">
              Join thousands of restaurants, stores, and drivers earning more every day
            </p>
            <Button 
              size="lg" 
              className="bg-gold-gradient hover:bg-gold-gradient-hover text-white px-12 py-7 text-lg font-semibold shadow-xl hover:shadow-2xl transition-all hover:scale-105"
              onClick={() => navigate('/partner')}
            >
              Become a Partner
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

// Partner Selection Page
const PartnerSelection = () => {
  const navigate = useNavigate();

  const partnerTypes = [
    {
      type: 'restaurant',
      name: 'Restaurant',
      description: 'Join our food delivery network and reach more customers',
      icon: Utensils,
      color: 'from-gold-300 to-gold-700',
      benefits: ['Increased visibility', 'Order management system', 'Real-time analytics'],
      commission: '15%',
      route: '/restaurant-onboarding'
    },
    {
      type: 'pharmacy',
      name: 'Pharmacy',
      description: 'Deliver health products and prescriptions safely',
      icon: Pill,
      color: 'from-neon-cyan to-gold-500',
      benefits: ['Secure delivery network', 'Prescription handling', 'Insurance compliance'],
      commission: '8%',
      route: '/partner/onboarding?type=pharmacy'
    },
    {
      type: 'grocery',
      name: 'Grocery Store',
      description: 'Expand your grocery business with delivery services',
      icon: ShoppingCart,
      color: 'from-gold-500 to-gold-700',
      benefits: ['Bulk order handling', 'Inventory management', 'Fresh product delivery'],
      commission: '12%',
      route: '/partner/onboarding?type=grocery'
    },
    {
      type: 'general_business',
      name: 'General Business',
      description: 'Any business needing reliable delivery services',
      icon: Building2,
      color: 'from-gold-300 to-neon-cyan',
      benefits: ['Flexible delivery options', 'Custom solutions', 'Dedicated support'],
      commission: '20%',
      route: '/partner/onboarding?type=general_business'
    },
    {
      type: 'car_rental',
      name: 'Car Rental',
      description: 'Airport and city vehicle rental services',
      icon: Car,
      color: 'from-neon-cyan to-gold-300',
      benefits: ['Fleet management system', 'Airport pickup integration', 'Insurance handling', 'Multi-location support'],
      commission: '10%',
      route: '/partner/onboarding?type=car_rental'
    },
    {
      type: 'business_supplier',
      name: 'Business Supplier',
      description: 'Any business needing delivery services - from groceries to retail',
      icon: Building2,
      color: 'from-gold-700 to-gold-300',
      benefits: ['Multi-category support', 'Flexible delivery options', 'Inventory management', 'Customer reach expansion'],
      commission: '12-18%',
      route: '/partner/onboarding?type=business_supplier'
    }
  ];

  return (
    <div className="min-h-screen bg-matte-900 py-16 relative overflow-hidden">
      {/* Ambient gold glow to match landing page */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(249,115,22,0.12),transparent_60%)] pointer-events-none"></div>
      <div className="absolute -top-20 -right-20 h-80 w-80 rounded-full bg-gold-500/10 blur-3xl pointer-events-none"></div>

      <div className="relative container mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="font-heading text-4xl lg:text-5xl font-bold text-secondary mb-6">
            Become a <span className="text-gold-gradient">Partner</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Join IslandHop&apos;s growing network of Caribbean businesses and reach more customers than ever before
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {partnerTypes.map((partner) => (
            <Card 
              key={partner.type} 
              className="group bg-matte-800 border border-border hover:border-gold-500/40 hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300 overflow-hidden"
              data-testid={`partner-type-${partner.type}`}
            >
              <div className={`h-1 bg-gradient-to-r ${partner.color}`}></div>
              <CardContent className="p-8">
                <div className="flex items-center mb-6">
                  <div className={`w-16 h-16 bg-gradient-to-r ${partner.color} rounded-2xl flex items-center justify-center mr-4 shadow-gold-glow`}>
                    <partner.icon className="h-8 w-8 text-matte-900" />
                  </div>
                  <div>
                    <h3 className="font-heading text-2xl font-bold text-secondary">{partner.name}</h3>
                    <Badge className="mt-1 bg-gold-500/15 text-gold-700 border border-gold-500/30 hover:bg-gold-500/20">{partner.commission} commission</Badge>
                  </div>
                </div>

                <p className="text-muted-foreground mb-6 leading-relaxed">
                  {partner.description}
                </p>

                <div className="mb-6">
                  <h4 className="font-semibold text-secondary mb-3">Key Benefits:</h4>
                  <ul className="space-y-2">
                    {partner.benefits.map((benefit) => (
                      <li key={benefit} className="flex items-center text-sm text-muted-foreground">
                        <CheckCircle className="h-4 w-4 text-gold-300 mr-2 flex-shrink-0" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>

                <Button 
                  className="w-full"
                  onClick={() => navigate(partner.route)}
                  data-testid={`apply-${partner.type}-btn`}
                >
                  Apply as {partner.name}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-16 text-center">
          <Card className="max-w-4xl mx-auto bg-matte-800 border border-gold-500/30 shadow-gold-glow">
            <CardContent className="p-8">
              <h3 className="font-heading text-2xl font-bold mb-6 text-secondary">Why Partner with <span className="text-gold-gradient">IslandHop?</span></h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold mb-2 text-gold-gradient">10K+</div>
                  <div className="text-sm text-muted-foreground">Active Customers</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold mb-2 text-gold-gradient">500+</div>
                  <div className="text-sm text-muted-foreground">Partner Businesses</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold mb-2 text-gold-gradient">98%</div>
                  <div className="text-sm text-muted-foreground">On-time Delivery</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
// BusinessOnboarding moved to ./BusinessOnboarding.js
};

// AI Support Chat Component
const AISupport = () => {
  const [messages, setMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [chatSessionId, setChatSessionId] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Initialize chat session
    setChatSessionId(`chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    
    // Add welcome message
    setMessages([{
      id: '1',
      type: 'bot',
      message: "Hello! I'm your IslandHop support assistant. How can I help you today?",
      timestamp: new Date()
    }]);
  }, []);

  const sendMessage = async () => {
    if (!currentMessage.trim() || isLoading) return;

    const userMessage = {
      id: Date.now().toString(),
      type: 'user',
      message: currentMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await axios.post(`${API}/chat/message`, {
        message: currentMessage,
        session_id: chatSessionId
      });

      const botMessage = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        message: response.data.response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        message: "I'm sorry, I'm having trouble responding right now. Please try again in a moment.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }

    setCurrentMessage('');
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-matte-900 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-4">AI Customer Support</h1>
          <p className="text-muted-foreground">Get instant help with your IslandHop questions</p>
        </div>

        <Card className="bg-matte-800 border border-border shadow-2xl h-96">
          <CardContent className="p-6 flex flex-col h-full">
            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto space-y-4 mb-4" data-testid="chat-messages">
              {messages.map((message) => (
                <div 
                  key={message.id}
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.type === 'user' 
                        ? 'bg-gold-gradient text-white' 
                        : 'bg-matte-800 text-foreground'
                    }`}
                    data-testid={`chat-message-${message.type}`}
                  >
                    {message.message}
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-matte-800 px-4 py-2 rounded-lg">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div className="flex space-x-2">
              <Input
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Type your message..."
                className="flex-1"
                data-testid="chat-input"
              />
              <Button 
                onClick={sendMessage}
                disabled={isLoading || !currentMessage.trim()}
                className="bg-gold-gradient text-white"
                data-testid="send-message-btn"
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* FAQ Section */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-foreground mb-6 text-center">Common Questions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setCurrentMessage("How do I track my order?")}>
              <CardContent className="p-6">
                <h3 className="font-semibold text-foreground mb-2">How do I track my order?</h3>
                <p className="text-muted-foreground text-sm">Learn about real-time order tracking</p>
              </CardContent>
            </Card>
            
            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setCurrentMessage("What are the delivery fees?")}>
              <CardContent className="p-6">
                <h3 className="font-semibold text-foreground mb-2">What are the delivery fees?</h3>
                <p className="text-muted-foreground text-sm">Information about pricing and fees</p>
              </CardContent>
            </Card>
            
            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setCurrentMessage("How do I become a partner?")}>
              <CardContent className="p-6">
                <h3 className="font-semibold text-foreground mb-2">How do I become a partner?</h3>
                <p className="text-muted-foreground text-sm">Learn about joining our partner network</p>
              </CardContent>
            </Card>
            
            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setCurrentMessage("What payment methods do you accept?")}>
              <CardContent className="p-6">
                <h3 className="font-semibold text-foreground mb-2">Payment Methods</h3>
                <p className="text-muted-foreground text-sm">Supported payment options</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

// Dashboard Component
const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return; // wait for AuthContext to finish hydrating
    if (!user) {
      navigate('/');
      return;
    }
    fetchApplications();
  }, [user, authLoading, navigate]);

  const fetchApplications = async () => {
    try {
      const response = await axios.get(`${API}/business/onboarding`, {
        withCredentials: false
      });
      setApplications(response.data);
    } catch (error) {
      console.error('Error fetching applications:', error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-matte-900 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-gold-500/30 border-t-gold-500 rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" />;
  }

  return (
    <div className="min-h-screen bg-matte-900 py-12">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Welcome back, {user.name}!</h1>
          <p className="text-muted-foreground">Manage your IslandHop experience</p>
          <div className="mt-4">
            <EnablePushButton />
          </div>
        </div>

        <ReferralBanner />

        {(!user.picture || !user.address || !user.address.street) && (
          <Card className="mb-6 border-gold-500/40 bg-gold-500/5" data-testid="complete-profile-banner">
            <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-4">
              <div className="flex items-center gap-3">
                <UserCircle className="h-8 w-8 text-gold-500 shrink-0" />
                <div>
                  <p className="font-semibold text-foreground">Complete your profile</p>
                  <p className="text-sm text-muted-foreground">Add a profile picture and delivery address to start ordering.</p>
                </div>
              </div>
              <Button onClick={() => navigate('/profile')} data-testid="complete-profile-btn">Complete now</Button>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <Card className="col-span-full lg:col-span-2">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Button
                  variant="outline"
                  className="h-24 flex flex-col items-center justify-center space-y-2"
                  onClick={() => navigate('/services')}
                >
                  <Package className="h-6 w-6" />
                  <span className="text-sm">Place Order</span>
                </Button>
                
                <Button
                  variant="outline"
                  className="h-24 flex flex-col items-center justify-center space-y-2"
                  onClick={() => navigate('/partner')}
                >
                  <Building2 className="h-6 w-6" />
                  <span className="text-sm">Partner Up</span>
                </Button>
                
                <Button
                  variant="outline"
                  className="h-24 flex flex-col items-center justify-center space-y-2"
                  onClick={() => navigate('/track')}
                >
                  <MapPin className="h-6 w-6" />
                  <span className="text-sm">Track Order</span>
                </Button>
                
                <Button
                  variant="outline"
                  className="h-24 flex flex-col items-center justify-center space-y-2"
                  onClick={() => navigate('/support')}
                  data-testid="quick-action-support"
                >
                  <MessageCircle className="h-6 w-6" />
                  <span className="text-sm">Support</span>
                </Button>

                <Button
                  variant="outline"
                  className="h-24 flex flex-col items-center justify-center space-y-2"
                  onClick={() => navigate('/claims')}
                  data-testid="quick-action-claims"
                >
                  <AlertCircle className="h-6 w-6" />
                  <span className="text-sm">My Claims</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Profile Card */}
          <Card>
            <CardHeader>
              <CardTitle>Your Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-3">
                {user.picture ? (
                  <img src={user.picture} alt={user.name} className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 bg-gold-gradient rounded-full flex items-center justify-center text-white font-bold">
                    {user.name.charAt(0)}
                  </div>
                )}
                <div>
                  <div className="font-semibold">{user.name}</div>
                  <div className="text-sm text-muted-foreground">{user.email}</div>
                </div>
              </div>
              {user.address?.street && (
                <div className="flex items-start gap-2 text-sm text-muted-foreground" data-testid="profile-card-address">
                  <MapPin className="h-4 w-4 mt-0.5 text-gold-500 shrink-0" />
                  <span>{[user.address.street, user.address.city, user.address.country].filter(Boolean).join(', ')}</span>
                </div>
              )}
              <div className="pt-4 border-t">
                <Badge variant="secondary" className="mb-2">Active Member</Badge>
                <p className="text-xs text-muted-foreground mb-3">Member since {new Date(user.created_at).toLocaleDateString()}</p>
                <Button variant="outline" size="sm" className="w-full" onClick={() => navigate('/profile')} data-testid="edit-profile-btn">Edit Profile</Button>
              </div>
            </CardContent>
          </Card>

          {/* Business Applications */}
          <Card className="col-span-full">
            <CardHeader>
              <CardTitle>Your Business Applications</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading applications...</div>
              ) : applications.length > 0 ? (
                <div className="space-y-4">
                  {applications.map((app) => {
                    const statusVariantMap = { verified: 'default', rejected: 'destructive' };
                    const variant = statusVariantMap[app.verification_status] || 'secondary';
                    return (
                    <div key={app.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h3 className="font-semibold">{app.business_details.business_name}</h3>
                        <p className="text-sm text-muted-foreground">{app.business_details.business_type}</p>
                        <p className="text-xs text-muted-foreground">Applied: {new Date(app.application_date).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant={variant}>
                          {app.verification_status}
                        </Badge>
                      </div>
                    </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">No business applications yet</p>
                  <Button onClick={() => navigate('/partner')}>
                    Become a Partner
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

// Restaurants Page Component
const RestaurantsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  return (
    <div className="min-h-screen bg-matte-900 py-12">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl lg:text-5xl font-bold text-foreground mb-6">
            Caribbean Restaurants
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Discover authentic Caribbean cuisine delivered fresh to your door
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Sample restaurant cards - this would be populated from API */}
          <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-2">
            <CardContent className="p-6">
              <div className="w-full h-48 bg-gradient-to-r from-red-500 to-orange-500 rounded-lg mb-4 flex items-center justify-center">
                <Utensils className="h-12 w-12 text-white" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Island Spice Kitchen</h3>
              <p className="text-muted-foreground mb-4">Authentic Jamaican cuisine with a modern twist</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Star className="h-4 w-4 text-gold-500 mr-1" />
                  <span className="text-sm">4.8 (120 reviews)</span>
                </div>
                <Badge>30-45 min</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-2">
            <CardContent className="p-6">
              <div className="w-full h-48 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg mb-4 flex items-center justify-center">
                <ChefHat className="h-12 w-12 text-white" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Tropical Delights</h3>
              <p className="text-muted-foreground mb-4">Fresh seafood and tropical flavors</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Star className="h-4 w-4 text-gold-500 mr-1" />
                  <span className="text-sm">4.6 (89 reviews)</span>
                </div>
                <Badge>25-40 min</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-2">
            <CardContent className="p-6">
              <div className="w-full h-48 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg mb-4 flex items-center justify-center">
                <Utensils className="h-12 w-12 text-white" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Caribbean Fusion</h3>
              <p className="text-muted-foreground mb-4">International dishes with Caribbean flair</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Star className="h-4 w-4 text-gold-500 mr-1" />
                  <span className="text-sm">4.9 (156 reviews)</span>
                </div>
                <Badge>35-50 min</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-12">
          <Button 
            onClick={() => navigate('/partner')}
            className="bg-gold-gradient text-white"
          >
            <Building2 className="h-5 w-5 mr-2" />
            Add Your Restaurant
          </Button>
        </div>
      </div>
    </div>
  );
};

// Driver Registration Component
const DriverRegistration = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    licenseNumber: '',
    vehicleType: '',
    vehicleMake: '',
    vehicleModel: '',
    vehicleYear: '',
    licensePlate: '',
    insuranceProvider: '',
    emergencyContact: '',
    emergencyPhone: '',
    availability: []
  });

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/driver/register`, formData, {
        withCredentials: false
      });

      toast({
        title: "Registration Submitted!",
        description: "We'll review your application and get back to you within 24 hours.",
      });

      navigate('/dashboard');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit registration. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-matte-900 py-12">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-4">
            Drive with IslandHop
          </h1>
          <p className="text-muted-foreground">
            Join our network of professional drivers and start earning today
          </p>
        </div>

        <Card className="bg-matte-800 border border-border shadow-2xl">
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) => handleInputChange('fullName', e.target.value)}
                    placeholder="Enter your full name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="your.email@example.com"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="+1 (xxx) xxx-xxxx"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="licenseNumber">Driver&apos;s License Number *</Label>
                  <Input
                    id="licenseNumber"
                    value={formData.licenseNumber}
                    onChange={(e) => handleInputChange('licenseNumber', e.target.value)}
                    placeholder="License number"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="vehicleType">Vehicle Type *</Label>
                  <Select value={formData.vehicleType} onValueChange={(value) => handleInputChange('vehicleType', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select vehicle type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="car">Car</SelectItem>
                      <SelectItem value="motorcycle">Motorcycle</SelectItem>
                      <SelectItem value="van">Van</SelectItem>
                      <SelectItem value="truck">Truck</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="vehicleMake">Vehicle Make *</Label>
                  <Input
                    id="vehicleMake"
                    value={formData.vehicleMake}
                    onChange={(e) => handleInputChange('vehicleMake', e.target.value)}
                    placeholder="e.g., Toyota, Honda"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="vehicleModel">Vehicle Model *</Label>
                  <Input
                    id="vehicleModel"
                    value={formData.vehicleModel}
                    onChange={(e) => handleInputChange('vehicleModel', e.target.value)}
                    placeholder="e.g., Camry, Civic"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="vehicleYear">Vehicle Year *</Label>
                  <Input
                    id="vehicleYear"
                    type="number"
                    value={formData.vehicleYear}
                    onChange={(e) => handleInputChange('vehicleYear', e.target.value)}
                    placeholder="2020"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="licensePlate">License Plate *</Label>
                  <Input
                    id="licensePlate"
                    value={formData.licensePlate}
                    onChange={(e) => handleInputChange('licensePlate', e.target.value)}
                    placeholder="ABC-1234"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="insuranceProvider">Insurance Provider *</Label>
                  <Input
                    id="insuranceProvider"
                    value={formData.insuranceProvider}
                    onChange={(e) => handleInputChange('insuranceProvider', e.target.value)}
                    placeholder="Insurance company name"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="emergencyContact">Emergency Contact Name *</Label>
                  <Input
                    id="emergencyContact"
                    value={formData.emergencyContact}
                    onChange={(e) => handleInputChange('emergencyContact', e.target.value)}
                    placeholder="Emergency contact name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="emergencyPhone">Emergency Contact Phone *</Label>
                  <Input
                    id="emergencyPhone"
                    value={formData.emergencyPhone}
                    onChange={(e) => handleInputChange('emergencyPhone', e.target.value)}
                    placeholder="+1 (xxx) xxx-xxxx"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-between pt-6">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => navigate('/')}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  className="bg-gold-gradient text-white"
                >
                  Submit Application
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <Card className="bg-gold-gradient border-0 text-white">
            <CardContent className="p-6">
              <h3 className="text-xl font-bold mb-2">Why Drive with IslandHop?</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-2xl font-bold">$25+</div>
                  <div className="opacity-90">Per Hour Potential</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">24/7</div>
                  <div className="opacity-90">Driver Support</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">Weekly</div>
                  <div className="opacity-90">Fast Payouts</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
// App Component
function App() {
  return (
    <AuthProvider>
      <ModeProvider>
        <Router>
          <div className="min-h-screen bg-background">
            <Header />

          <Routes>
            <Route path="/theme-preview" element={<ThemePreview />} />
            {/* Public routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/auth/callback" element={<SocialAuthCallback />} />
            <Route path="/auth/microsoft/callback" element={<MicrosoftAuthCallback />} />
            <Route path="/driver/verification/callback" element={<IdentityVerificationCallback />} />
            <Route path="/signup" element={<AuthPage mode="signup" />} />
            <Route path="/pricing" element={<SubscriptionPlans />} />
            <Route path="/restaurants" element={<RestaurantsPage />} />
            <Route path="/restaurant/:restaurantId" element={<RestaurantMenu />} />
            <Route path="/taxi-booking" element={<TaxiBookingForm />} />
            <Route path="/courier-order" element={<CourierOrderForm />} />
            <Route path="/pharmacy-order" element={<PharmacyOrderForm />} />
            <Route path="/grocery-order" element={<GroceryOrderForm />} />
            <Route path="/car-rentals" element={<CarRentalPage />} />
            <Route path="/partner" element={<PartnerSelection />} />
            <Route path="/partner/onboarding" element={<BusinessOnboarding />} />
            <Route path="/support" element={<AISupport />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/leaderboard" element={<DriverLeaderboard />} />
            <Route path="/order/:orderId" element={<OrderTrackingPage />} />

            {/* Logged-in users (any role) */}
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/wallet" element={<ProtectedRoute><WalletPage /></ProtectedRoute>} />
            <Route path="/referrals" element={<ProtectedRoute><ReferralPage /></ProtectedRoute>} />
            <Route path="/claims" element={<ProtectedRoute><ClaimsPage /></ProtectedRoute>} />
            <Route path="/addresses" element={<ProtectedRoute><AddressManagement /></ProtectedRoute>} />
            <Route path="/scheduled-orders" element={<ProtectedRoute><OrderScheduling /></ProtectedRoute>} />
            <Route path="/checkout/:orderId" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
            <Route path="/payment/success" element={<PaymentSuccess />} />
            <Route path="/payment/cancel" element={<PaymentCancel />} />

            {/* Driver-only */}
            <Route path="/driver-dashboard" element={<ProtectedRoute allowedRoles={ROLES_DRIVER_ADMIN}><DriverDashboard /></ProtectedRoute>} />
            <Route path="/driver-onboarding" element={<ProtectedRoute allowedRoles={ROLES_DRIVER_ONBOARD}><DriverOnboarding /></ProtectedRoute>} />
            <Route path="/driver" element={<ProtectedRoute allowedRoles={ROLES_DRIVER_ONBOARD}><DriverRegistration /></ProtectedRoute>} />
            <Route path="/driver/earnings" element={<ProtectedRoute allowedRoles={ROLES_DRIVER_ADMIN}><DriverEarningsDashboard /></ProtectedRoute>} />

            {/* Merchant / Vendor only */}
            <Route path="/vendor-dashboard" element={<ProtectedRoute allowedRoles={ROLES_VENDOR_ADMIN}><VendorDashboard /></ProtectedRoute>} />
            <Route path="/restaurant-onboarding" element={<ProtectedRoute allowedRoles={ROLES_VENDOR_ONBOARD}><RestaurantOnboarding /></ProtectedRoute>} />
            <Route path="/menu-management" element={<ProtectedRoute allowedRoles={ROLES_VENDOR_ADMIN}><RestaurantMenuManagement /></ProtectedRoute>} />
            <Route path="/business/earnings" element={<ProtectedRoute allowedRoles={ROLES_VENDOR_ADMIN}><BusinessEarningsDashboard /></ProtectedRoute>} />
            <Route path="/vendor/connect-stripe" element={<ProtectedRoute allowedRoles={ROLES_VENDOR_ADMIN}><VendorStripeConnect /></ProtectedRoute>} />
            <Route path="/vendor/stripe-return" element={<ProtectedRoute allowedRoles={ROLES_VENDOR_ADMIN}><VendorStripeConnect /></ProtectedRoute>} />
            <Route path="/vendor/stripe-refresh" element={<ProtectedRoute allowedRoles={ROLES_VENDOR_ADMIN}><VendorStripeConnect /></ProtectedRoute>} />
            <Route path="/promo-codes" element={<ProtectedRoute allowedRoles={ROLES_VENDOR_ADMIN}><PromoCodeManagement /></ProtectedRoute>} />

            {/* Admin only */}
            <Route path="/admin" element={<ProtectedRoute allowedRoles={ROLES_ADMIN_AGENT}><AdminPanel /></ProtectedRoute>} />
            <Route path="/admin/invite/:token" element={<AdminInviteAccept />} />
            <Route path="/analytics" element={<ProtectedRoute allowedRoles={ROLES_ADMIN_ONLY}><KPIDashboard /></ProtectedRoute>} />

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>

          <Footer />
          <Toaster />
        </div>
      </Router>
      </ModeProvider>
    </AuthProvider>
  );
}

export default App;