import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import KPIDashboard from './KPIDashboard';
import CarRentalPage from './CarRentalPage';
import DriverOnboarding from './DriverOnboarding';
import RestaurantOnboarding from './RestaurantOnboarding';
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
  X
} from 'lucide-react';
import axios from 'axios';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = React.createContext();

const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, {
        withCredentials: true
      });
      setUser(response.data);
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = (redirectUrl = '/') => {
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(window.location.origin + redirectUrl)}`;
    window.location.href = authUrl;
  };

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// Auth handler component
const AuthHandler = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleAuth = async () => {
      const hash = window.location.hash;
      const sessionIdMatch = hash.match(/session_id=([^&]*)/);
      
      if (sessionIdMatch) {
        const sessionId = sessionIdMatch[1];
        
        try {
          const response = await axios.post(`${API}/auth/session`, {
            session_id: sessionId
          }, { withCredentials: true });
          
          // Clean the URL
          window.location.hash = '';
          navigate('/dashboard');
          window.location.reload();
        } catch (error) {
          console.error('Auth error:', error);
          navigate('/');
        }
      }
    };

    handleAuth();
  }, [navigate]);

  return null;
};

// Header Component
const Header = () => {
  const { user, login, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigationItems = [
    { to: "/restaurants", label: "Restaurants", icon: Utensils },
    { to: "/car-rentals", label: "Car Rentals", icon: Car },
    { to: "/analytics", label: "Analytics", icon: TrendingUp },
    { to: "/partner", label: "Become a Partner", icon: Building2 },
    { to: "/driver", label: "Drive with Us", icon: Truck },
    { to: "/support", label: "Support", icon: MessageCircle }
  ];

  return (
    <>
      <header className="bg-white/95 backdrop-blur-md border-b border-orange-200 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-gradient-to-br from-turquoise-500 to-orange-500 rounded-xl flex items-center justify-center">
                <Package className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">IslandHop</h1>
                <p className="text-xs text-turquoise-600">Caribbean Delivery</p>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center space-x-6">
              {navigationItems.map((item) => (
                <Link 
                  key={item.to}
                  to={item.to} 
                  className="text-gray-700 hover:text-orange-600 transition-colors font-medium"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* Desktop Auth Section */}
            <div className="hidden md:flex items-center space-x-4">
              {user ? (
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-gray-700 hidden lg:inline">Welcome, {user.name}</span>
                  <Button onClick={() => window.location.href = '/dashboard'} variant="outline" size="sm">
                    Dashboard
                  </Button>
                  <Button onClick={logout} variant="ghost" size="sm">
                    Logout
                  </Button>
                </div>
              ) : (
                <Button onClick={() => login('/dashboard')} className="bg-gradient-to-r from-turquoise-500 to-orange-500 text-white">
                  Sign In
                </Button>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="mobile-menu-btn"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6 text-gray-700" />
              ) : (
                <Menu className="h-6 w-6 text-gray-700" />
              )}
            </button>
          </div>

          {/* Mobile Navigation Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden mt-4 pb-4 border-t border-gray-200 bg-white/95 backdrop-blur-md">
              <nav className="flex flex-col space-y-1 mt-4">
                {navigationItems.map((item) => {
                  const IconComponent = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className="flex items-center space-x-3 px-4 py-3 text-gray-700 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                      data-testid={`mobile-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <IconComponent className="h-5 w-5" />
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  );
                })}
                
                {/* Mobile Auth Section */}
                <div className="border-t border-gray-200 pt-4 px-4">
                  {user ? (
                    <div className="space-y-3">
                      <div className="text-sm text-gray-600">
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
                      className="w-full bg-gradient-to-r from-turquoise-500 to-orange-500 text-white"
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
      color: 'from-yellow-500 to-orange-500'
    },
    {
      icon: Utensils,
      name: 'Food Delivery',
      description: 'Fresh Caribbean cuisine delivered to your door',
      color: 'from-red-500 to-orange-500'
    },
    {
      icon: Pill,
      name: 'Pharmacy',
      description: 'Prescription & health products delivery',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      icon: ShoppingCart,
      name: 'Groceries',
      description: 'Fresh groceries and household items',
      color: 'from-green-500 to-emerald-500'
    },
    {
      icon: Package,
      name: 'Courier',
      description: 'Fast and secure package delivery',
      color: 'from-purple-500 to-pink-500'
    },
    {
      icon: Car,
      name: 'Car Rental',
      description: 'Airport and city car rental services',
      color: 'from-blue-500 to-indigo-500'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-turquoise-50 via-white to-orange-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 lg:py-32">
        <div className="absolute inset-0 bg-gradient-to-br from-turquoise-400/20 via-transparent to-orange-400/20"></div>
        <div className="relative container mx-auto px-4 text-center">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-5xl lg:text-7xl font-bold text-gray-900 mb-6 leading-tight">
              Caribbean Delivery
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-turquoise-600 to-orange-600">
                Made Simple
              </span>
            </h1>
            <p className="text-xl lg:text-2xl text-gray-600 mb-8 leading-relaxed">
              From fresh Caribbean cuisine to everyday essentials, we deliver island life to your doorstep
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-turquoise-500 to-orange-500 text-white px-8 py-4 text-lg"
                onClick={() => navigate('/services')}
                data-testid="order-now-btn"
              >
                Order Now
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="border-2 border-orange-300 text-orange-700 hover:bg-orange-50 px-8 py-4 text-lg"
                onClick={() => navigate('/partner')}
                data-testid="become-partner-btn"
              >
                Become a Partner
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-16 lg:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              Our Services
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Complete delivery solutions for island living
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {services.map((service, index) => (
              <Card 
                key={index} 
                className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border-0 bg-white/80 backdrop-blur-sm"
                data-testid={`service-card-${service.name.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <CardContent className="p-8 text-center">
                  <div className={`inline-flex w-16 h-16 rounded-2xl bg-gradient-to-r ${service.color} items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                    <service.icon className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">
                    {service.name}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {service.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 lg:py-24 bg-gradient-to-r from-turquoise-500/10 to-orange-500/10">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
                Why Choose IslandHop?
              </h2>
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-turquoise-500 to-orange-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Zap className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Lightning Fast Delivery</h3>
                    <p className="text-gray-600">Real-time tracking with average delivery times under 30 minutes</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-turquoise-500 to-orange-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Shield className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Secure & Reliable</h3>
                    <p className="text-gray-600">End-to-end encryption and verified partner network</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-turquoise-500 to-orange-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Heart className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Island Community</h3>
                    <p className="text-gray-600">Supporting local businesses across the Caribbean</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="relative">
              <div className="aspect-square bg-gradient-to-br from-turquoise-400 to-orange-400 rounded-3xl p-8 text-white">
                <div className="h-full flex flex-col justify-center items-center text-center">
                  <div className="text-6xl font-bold mb-4">24/7</div>
                  <div className="text-xl mb-6">AI Customer Support</div>
                  <Button 
                    variant="secondary" 
                    size="lg"
                    onClick={() => navigate('/support')}
                    data-testid="chat-support-btn"
                  >
                    <MessageCircle className="h-5 w-5 mr-2" />
                    Chat Now
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 lg:py-24">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              Ready to Get Started?
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              Join thousands of satisfied customers enjoying Caribbean convenience
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-turquoise-500 to-orange-500 text-white px-8 py-4 text-lg"
                onClick={() => navigate('/services')}
                data-testid="start-ordering-btn"
              >
                Start Ordering
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="border-2 border-turquoise-300 text-turquoise-700 hover:bg-turquoise-50 px-8 py-4 text-lg"
                onClick={() => navigate('/partner')}
                data-testid="join-as-partner-btn"
              >
                Join as Partner
              </Button>
            </div>
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
      color: 'from-red-500 to-orange-500',
      benefits: ['Increased visibility', 'Order management system', 'Real-time analytics'],
      commission: '15%'
    },
    {
      type: 'pharmacy',
      name: 'Pharmacy',
      description: 'Deliver health products and prescriptions safely',
      icon: Pill,
      color: 'from-blue-500 to-cyan-500',
      benefits: ['Secure delivery network', 'Prescription handling', 'Insurance compliance'],
      commission: '8%'
    },
    {
      type: 'grocery',
      name: 'Grocery Store',
      description: 'Expand your grocery business with delivery services',
      icon: ShoppingCart,
      color: 'from-green-500 to-emerald-500',
      benefits: ['Bulk order handling', 'Inventory management', 'Fresh product delivery'],
      commission: '12%'
    },
    {
      type: 'general_business',
      name: 'General Business',
      description: 'Any business needing reliable delivery services',
      icon: Building2,
      color: 'from-purple-500 to-pink-500',
      benefits: ['Flexible delivery options', 'Custom solutions', 'Dedicated support'],
      commission: '20%'
    },
    {
      type: 'car_rental',
      name: 'Car Rental',
      description: 'Airport and city vehicle rental services',
      icon: Car,
      color: 'from-blue-500 to-indigo-500',
      benefits: ['Fleet management system', 'Airport pickup integration', 'Insurance handling', 'Multi-location support'],
      commission: '10%'
    },
    {
      type: 'business_supplier',
      name: 'Business Supplier',
      description: 'Any business needing delivery services - from groceries to retail',
      icon: Building2,
      color: 'from-emerald-500 to-teal-500',
      benefits: ['Multi-category support', 'Flexible delivery options', 'Inventory management', 'Customer reach expansion'],
      commission: '12-18%'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-turquoise-50 via-white to-orange-50 py-12">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
            Become a Partner
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Join IslandHop's growing network of Caribbean businesses and reach more customers than ever before
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {partnerTypes.map((partner, index) => (
            <Card 
              key={index} 
              className="group hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-0 bg-white/80 backdrop-blur-sm overflow-hidden"
              data-testid={`partner-type-${partner.type}`}
            >
              <div className={`h-2 bg-gradient-to-r ${partner.color}`}></div>
              <CardContent className="p-8">
                <div className="flex items-center mb-6">
                  <div className={`w-16 h-16 bg-gradient-to-r ${partner.color} rounded-2xl flex items-center justify-center mr-4`}>
                    <partner.icon className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">{partner.name}</h3>
                    <Badge variant="secondary" className="mt-1">{partner.commission} commission</Badge>
                  </div>
                </div>

                <p className="text-gray-600 mb-6 leading-relaxed">
                  {partner.description}
                </p>

                <div className="mb-6">
                  <h4 className="font-semibold text-gray-900 mb-3">Key Benefits:</h4>
                  <ul className="space-y-2">
                    {partner.benefits.map((benefit, idx) => (
                      <li key={idx} className="flex items-center text-sm text-gray-600">
                        <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>

                <Button 
                  className={`w-full bg-gradient-to-r ${partner.color} text-white`}
                  onClick={() => navigate(`/partner/onboarding?type=${partner.type}`)}
                  data-testid={`apply-${partner.type}-btn`}
                >
                  Apply as {partner.name}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-16 text-center">
          <Card className="max-w-4xl mx-auto bg-gradient-to-r from-turquoise-500 to-orange-500 border-0 text-white">
            <CardContent className="p-8">
              <h3 className="text-2xl font-bold mb-4">Why Partner with IslandHop?</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold mb-2">10K+</div>
                  <div className="text-sm opacity-90">Active Customers</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold mb-2">500+</div>
                  <div className="text-sm opacity-90">Partner Businesses</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold mb-2">98%</div>
                  <div className="text-sm opacity-90">On-time Delivery</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

// Business Onboarding Page
const BusinessOnboarding = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const [businessType, setBusinessType] = useState(new URLSearchParams(location.search).get('type') || '');
  const [currentStep, setCurrentStep] = useState(1);
  const [categories, setCategories] = useState([]);
  const [pricingTiers, setPricingTiers] = useState([]);
  const [formData, setFormData] = useState({
    // Business Owner Info
    ownerName: '',
    ownerEmail: '',
    ownerPhone: '',
    identificationType: '',
    identificationNumber: '',
    ownerAddress: {
      street: '',
      city: '',
      parish: '',
      country: '',
      postalCode: ''
    },
    // Business Details
    businessName: '',
    businessType: businessType,
    categoryId: '',
    description: '',
    businessAddress: {
      street: '',
      city: '',
      parish: '',
      country: '',
      postalCode: ''
    },
    businessPhone: '',
    businessEmail: '',
    website: '',
    operatingHours: {
      monday: { open: '', close: '' },
      tuesday: { open: '', close: '' },
      wednesday: { open: '', close: '' },
      thursday: { open: '', close: '' },
      friday: { open: '', close: '' },
      saturday: { open: '', close: '' },
      sunday: { open: '', close: '' }
    },
    deliveryRadius: 5,
    minimumOrder: 0,
    deliveryFee: 0,
    estimatedPrepTime: 30,
    selectedPricingTier: '',
    // Documents
    documents: [],
    
    // Restaurant-specific fields
    cuisineType: '',
    menuCategories: [],
    kitchenCapacity: '',
    foodSafetyRating: '',
    averageOrderValue: '',
    peakHours: '',
    specialDietaryOptions: [],
    
    // Pharmacy-specific fields
    pharmacyLicense: '',
    pharmacistInfo: {
      name: '',
      license: '',
      experience: ''
    },
    prescriptionServices: [],
    insuranceAccepted: [],
    controlledSubstancesLicense: '',
    
    // Grocery-specific fields
    storeSize: '',
    productCategories: [],
    refrigeratedSection: false,
    organicProducts: false,
    localSuppliers: [],
    inventorySystem: '',
    
    // Car Rental-specific fields
    fleetSize: '',
    vehicleTypes: [],
    insuranceProvider: '',
    airportPickup: false,
    driverServices: false,
    rentalLocations: [],
    
    // General Business-specific fields
    industryType: '',
    serviceArea: '',
    businessModel: '',
    targetCustomers: '',
    competitiveAdvantage: '',
    
    // Business Supplier-specific fields  
    businessCategory: '',
    storeSize: '',
    productCategories: [],
    inventorySize: '',
    specialServices: [],
    businessLicense: '',
    taxId: '',
    yearsInBusiness: '',
    
    // Banking information
    accountHolderName: '',
    bankName: '',
    accountNumber: '',
    routingNumber: '',
    accountType: ''
  });

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    fetchCategories();
    fetchPricingTiers();
  }, [user, navigate]);

  const fetchCategories = async () => {
    try {
      const response = await axios.get(`${API}/business/categories`);
      setCategories(response.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchPricingTiers = async () => {
    try {
      const response = await axios.get(`${API}/business/pricing-tiers`);
      setPricingTiers(response.data);
    } catch (error) {
      console.error('Error fetching pricing tiers:', error);
    }
  };

  const handleInputChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleSubmit = async () => {
    try {
      const applicationData = {
        business_owner: {
          email: formData.ownerEmail,
          name: formData.ownerName,
          phone: formData.ownerPhone,
          identification_type: formData.identificationType,
          identification_number: formData.identificationNumber,
          address: formData.ownerAddress
        },
        business_details: {
          business_name: formData.businessName,
          business_type: formData.businessType,
          category_id: formData.categoryId,
          description: formData.description,
          address: formData.businessAddress,
          phone: formData.businessPhone,
          email: formData.businessEmail,
          website: formData.website,
          operating_hours: formData.operatingHours,
          delivery_radius: formData.deliveryRadius,
          minimum_order: formData.minimumOrder,
          delivery_fee: formData.deliveryFee,
          estimated_prep_time: formData.estimatedPrepTime
        },
        documents: formData.documents
      };

      await axios.post(`${API}/business/onboarding`, applicationData, {
        withCredentials: true
      });

      toast({
        title: "Application Submitted!",
        description: "We'll review your application and get back to you within 24 hours.",
      });

      navigate('/dashboard');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit application. Please try again.",
        variant: "destructive",
      });
    }
  };

  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, 6));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  const stepTitles = [
    'Business Owner Information',
    'Business Details', 
    'Business-Specific Information',
    'Operations & Pricing',
    'Documents & Banking',
    'Review & Submit'
  ];

  const getBusinessSpecificFields = () => {
    switch (businessType) {
      case 'restaurant':
        return {
          title: 'Restaurant Information',
          fields: [
            { key: 'cuisineType', label: 'Cuisine Type', type: 'select', options: ['Caribbean', 'International', 'Seafood', 'Vegetarian', 'Fast Food', 'Fine Dining'] },
            { key: 'kitchenCapacity', label: 'Kitchen Capacity (orders/hour)', type: 'number' },
            { key: 'foodSafetyRating', label: 'Food Safety Rating', type: 'select', options: ['A', 'B', 'C', 'Pending'] },
            { key: 'averageOrderValue', label: 'Expected Average Order Value ($)', type: 'number' },
            { key: 'peakHours', label: 'Peak Operating Hours', type: 'text', placeholder: 'e.g., 12:00-14:00, 18:00-21:00' },
            { key: 'specialDietaryOptions', label: 'Special Dietary Options', type: 'multiselect', options: ['Vegetarian', 'Vegan', 'Gluten-Free', 'Diabetic-Friendly', 'Halal', 'Kosher'] }
          ]
        };
      case 'pharmacy':
        return {
          title: 'Pharmacy Information',
          fields: [
            { key: 'pharmacyLicense', label: 'Pharmacy License Number', type: 'text', required: true },
            { key: 'pharmacistInfo.name', label: 'Licensed Pharmacist Name', type: 'text', required: true },
            { key: 'pharmacistInfo.license', label: 'Pharmacist License Number', type: 'text', required: true },
            { key: 'pharmacistInfo.experience', label: 'Years of Experience', type: 'number' },
            { key: 'controlledSubstancesLicense', label: 'Controlled Substances License', type: 'text' },
            { key: 'prescriptionServices', label: 'Prescription Services', type: 'multiselect', options: ['Home Delivery', 'Consultation', 'Compounding', 'Vaccination', 'Health Screening'] },
            { key: 'insuranceAccepted', label: 'Insurance Plans Accepted', type: 'multiselect', options: ['SAGICOR', 'Guardian Life', 'NCB Insurance', 'Private Pay', 'Government Health Card'] }
          ]
        };
      case 'grocery':
        return {
          title: 'Grocery Store Information',
          fields: [
            { key: 'storeSize', label: 'Store Size (sq ft)', type: 'number' },
            { key: 'productCategories', label: 'Product Categories', type: 'multiselect', options: ['Fresh Produce', 'Dairy & Eggs', 'Meat & Seafood', 'Bakery', 'Frozen Foods', 'Beverages', 'Household Items', 'Personal Care'] },
            { key: 'refrigeratedSection', label: 'Refrigerated Section Available', type: 'checkbox' },
            { key: 'organicProducts', label: 'Organic Products Available', type: 'checkbox' },
            { key: 'inventorySystem', label: 'Inventory Management System', type: 'select', options: ['Manual', 'Basic POS', 'Advanced Inventory System', 'Cloud-based System'] },
            { key: 'localSuppliers', label: 'Local Suppliers', type: 'textarea', placeholder: 'List your main local suppliers' }
          ]
        };
      case 'car_rental':
        return {
          title: 'Car Rental Information',
          fields: [
            { key: 'fleetSize', label: 'Fleet Size (number of vehicles)', type: 'number', required: true },
            { key: 'vehicleTypes', label: 'Vehicle Categories', type: 'multiselect', options: ['Economy', 'Compact', 'Mid-size', 'Full-size', 'SUV', 'Luxury', 'Van/Minivan', 'Convertible'] },
            { key: 'insuranceProvider', label: 'Fleet Insurance Provider', type: 'text', required: true },
            { key: 'airportPickup', label: 'Airport Pickup Service', type: 'checkbox' },
            { key: 'driverServices', label: 'Chauffeur Services Available', type: 'checkbox' },
            { key: 'rentalLocations', label: 'Rental Locations', type: 'multiselect', options: ['Airport Terminal', 'Downtown', 'Hotel Pickup', 'Cruise Port', 'Shopping Centers'] }
          ]
        };
      case 'business_supplier':
        return {
          title: 'Business Supplier Information',
          fields: [
            { key: 'businessCategory', label: 'Primary Business Category', type: 'select', options: ['🛒 Grocery Store', '💊 Pharmacy', '🛍️ Retail Shop', '🥖 Bakery', '🍷 Liquor Store', '💐 Florist', '🐾 Pet Store', '🔨 Hardware Store', '📚 Bookstore', '✨ Other'], required: true },
            { key: 'storeSize', label: 'Store Size', type: 'select', options: ['Small (Under 1,000 sq ft)', 'Medium (1,000-5,000 sq ft)', 'Large (5,000-15,000 sq ft)', 'Extra Large (15,000+ sq ft)'] },
            { key: 'productCategories', label: 'Product Categories', type: 'multiselect', options: ['Food & Beverages', 'Health & Beauty', 'Electronics', 'Clothing & Accessories', 'Home & Garden', 'Sports & Outdoors', 'Toys & Games', 'Books & Media', 'Automotive', 'Pet Supplies', 'Office Supplies', 'Pharmacy Items'] },
            { key: 'inventorySize', label: 'Approximate Inventory Size', type: 'select', options: ['Under 100 items', '100-500 items', '500-2,000 items', '2,000-10,000 items', '10,000+ items'] },
            { key: 'averageOrderValue', label: 'Expected Average Order Value ($)', type: 'number' },
            { key: 'specialServices', label: 'Special Services', type: 'multiselect', options: ['Same-day delivery', 'Scheduled delivery', 'Temperature-controlled items', 'Prescription delivery', 'Gift wrapping', 'Assembly service', 'Installation', 'Return/exchange pickup'] },
            { key: 'businessLicense', label: 'Business License Number', type: 'text', required: true },
            { key: 'taxId', label: 'Tax ID / EIN', type: 'text', required: true },
            { key: 'yearsInBusiness', label: 'Years in Business', type: 'number' },
            { key: 'competitiveAdvantage', label: 'What makes your business unique?', type: 'textarea', placeholder: 'Describe your unique selling points, quality, pricing, or special offerings' }
          ]
        };
      default:
        return {
          title: 'Business Information',
          fields: [
            { key: 'industryType', label: 'Industry Type', type: 'select', options: ['Retail', 'Services', 'Manufacturing', 'Technology', 'Healthcare', 'Education', 'Other'] },
            { key: 'serviceArea', label: 'Primary Service Area', type: 'text' },
            { key: 'businessModel', label: 'Business Model', type: 'select', options: ['B2C', 'B2B', 'B2B2C', 'Marketplace', 'Subscription'] },
            { key: 'targetCustomers', label: 'Target Customer Demographics', type: 'textarea' },
            { key: 'competitiveAdvantage', label: 'Competitive Advantage', type: 'textarea' }
          ]
        };
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 text-center">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4">Please sign in to continue with business onboarding.</p>
            <Button onClick={() => navigate('/')}>Go to Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-turquoise-50 via-white to-orange-50 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Business Onboarding</h1>
          <p className="text-gray-600">Step {currentStep} of 6: {stepTitles[currentStep - 1]}</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {stepTitles.map((title, index) => (
              <div 
                key={index}
                className={`flex-1 text-center ${index <= currentStep - 1 ? 'text-turquoise-600' : 'text-gray-400'}`}
              >
                <div className={`w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center ${
                  index <= currentStep - 1 ? 'bg-turquoise-500 text-white' : 'bg-gray-300 text-gray-600'
                }`}>
                  {index + 1}
                </div>
                <div className="text-xs font-medium">{title}</div>
              </div>
            ))}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-turquoise-500 to-orange-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / 6) * 100}%` }}
            ></div>
          </div>
        </div>

        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl">
          <CardContent className="p-8">
            {/* Step 1: Business Owner Information */}
            {currentStep === 1 && (
              <div className="space-y-6" data-testid="owner-info-step">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="ownerName">Full Name *</Label>
                    <Input
                      id="ownerName"
                      value={formData.ownerName}
                      onChange={(e) => handleInputChange('ownerName', e.target.value)}
                      placeholder="Enter your full name"
                      data-testid="owner-name-input"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ownerEmail">Email *</Label>
                    <Input
                      id="ownerEmail"
                      type="email"
                      value={formData.ownerEmail}
                      onChange={(e) => handleInputChange('ownerEmail', e.target.value)}
                      placeholder="your.email@example.com"
                      data-testid="owner-email-input"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="ownerPhone">Phone Number *</Label>
                    <Input
                      id="ownerPhone"
                      value={formData.ownerPhone}
                      onChange={(e) => handleInputChange('ownerPhone', e.target.value)}
                      placeholder="+1 (xxx) xxx-xxxx"
                      data-testid="owner-phone-input"
                    />
                  </div>
                  <div>
                    <Label htmlFor="identificationType">ID Type *</Label>
                    <Select value={formData.identificationType} onValueChange={(value) => handleInputChange('identificationType', value)}>
                      <SelectTrigger data-testid="id-type-select">
                        <SelectValue placeholder="Select ID type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="passport">Passport</SelectItem>
                        <SelectItem value="drivers_license">Driver's License</SelectItem>
                        <SelectItem value="national_id">National ID</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="identificationNumber">ID Number *</Label>
                  <Input
                    id="identificationNumber"
                    value={formData.identificationNumber}
                    onChange={(e) => handleInputChange('identificationNumber', e.target.value)}
                    placeholder="Enter ID number"
                    data-testid="id-number-input"
                  />
                </div>

                <div>
                  <Label>Address *</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <Input
                      placeholder="Street Address"
                      value={formData.ownerAddress.street}
                      onChange={(e) => handleInputChange('ownerAddress.street', e.target.value)}
                      data-testid="owner-street-input"
                    />
                    <Input
                      placeholder="City"
                      value={formData.ownerAddress.city}
                      onChange={(e) => handleInputChange('ownerAddress.city', e.target.value)}
                      data-testid="owner-city-input"
                    />
                    <Input
                      placeholder="Parish/State"
                      value={formData.ownerAddress.parish}
                      onChange={(e) => handleInputChange('ownerAddress.parish', e.target.value)}
                      data-testid="owner-parish-input"
                    />
                    <Input
                      placeholder="Country"
                      value={formData.ownerAddress.country}
                      onChange={(e) => handleInputChange('ownerAddress.country', e.target.value)}
                      data-testid="owner-country-input"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Business Details */}
            {currentStep === 2 && (
              <div className="space-y-6" data-testid="business-details-step">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="businessName">Business Name *</Label>
                    <Input
                      id="businessName"
                      value={formData.businessName}
                      onChange={(e) => handleInputChange('businessName', e.target.value)}
                      placeholder="Enter business name"
                      data-testid="business-name-input"
                    />
                  </div>
                  <div>
                    <Label htmlFor="categoryId">Business Category *</Label>
                    <Select value={formData.categoryId} onValueChange={(value) => handleInputChange('categoryId', value)}>
                      <SelectTrigger data-testid="category-select">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name} ({category.commission_rate}% commission)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Business Description *</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Describe your business and services"
                    rows={3}
                    data-testid="business-description-textarea"
                  />
                </div>

                <div>
                  <Label>Business Address *</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <Input
                      placeholder="Street Address"
                      value={formData.businessAddress.street}
                      onChange={(e) => handleInputChange('businessAddress.street', e.target.value)}
                      data-testid="business-street-input"
                    />
                    <Input
                      placeholder="City"
                      value={formData.businessAddress.city}
                      onChange={(e) => handleInputChange('businessAddress.city', e.target.value)}
                      data-testid="business-city-input"
                    />
                    <Input
                      placeholder="Parish/State"
                      value={formData.businessAddress.parish}
                      onChange={(e) => handleInputChange('businessAddress.parish', e.target.value)}
                      data-testid="business-parish-input"
                    />
                    <Input
                      placeholder="Country"
                      value={formData.businessAddress.country}
                      onChange={(e) => handleInputChange('businessAddress.country', e.target.value)}
                      data-testid="business-country-input"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <Label htmlFor="businessPhone">Business Phone *</Label>
                    <Input
                      id="businessPhone"
                      value={formData.businessPhone}
                      onChange={(e) => handleInputChange('businessPhone', e.target.value)}
                      placeholder="+1 (xxx) xxx-xxxx"
                      data-testid="business-phone-input"
                    />
                  </div>
                  <div>
                    <Label htmlFor="businessEmail">Business Email *</Label>
                    <Input
                      id="businessEmail"
                      type="email"
                      value={formData.businessEmail}
                      onChange={(e) => handleInputChange('businessEmail', e.target.value)}
                      placeholder="business@example.com"
                      data-testid="business-email-input"
                    />
                  </div>
                  <div>
                    <Label htmlFor="website">Website (Optional)</Label>
                    <Input
                      id="website"
                      value={formData.website}
                      onChange={(e) => handleInputChange('website', e.target.value)}
                      placeholder="https://www.example.com"
                      data-testid="website-input"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Business-Specific Information */}
            {currentStep === 3 && (
              <div className="space-y-6" data-testid="business-specific-step">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {getBusinessSpecificFields().title}
                  </h3>
                  <p className="text-gray-600">
                    Please provide information specific to your business type
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {getBusinessSpecificFields().fields.map((field, index) => (
                    <div key={field.key} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                      <Label htmlFor={field.key}>
                        {field.label} {field.required && '*'}
                      </Label>
                      
                      {field.type === 'text' && (
                        <Input
                          id={field.key}
                          value={field.key.includes('.') ? 
                            field.key.split('.').reduce((obj, key) => obj?.[key], formData) || '' :
                            formData[field.key] || ''
                          }
                          onChange={(e) => handleInputChange(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          data-testid={`${field.key}-input`}
                        />
                      )}
                      
                      {field.type === 'number' && (
                        <Input
                          id={field.key}
                          type="number"
                          value={field.key.includes('.') ? 
                            field.key.split('.').reduce((obj, key) => obj?.[key], formData) || '' :
                            formData[field.key] || ''
                          }
                          onChange={(e) => handleInputChange(field.key, parseFloat(e.target.value) || 0)}
                          placeholder={field.placeholder}
                          data-testid={`${field.key}-input`}
                        />
                      )}
                      
                      {field.type === 'select' && (
                        <Select 
                          value={formData[field.key] || ''} 
                          onValueChange={(value) => handleInputChange(field.key, value)}
                        >
                          <SelectTrigger data-testid={`${field.key}-select`}>
                            <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
                          </SelectTrigger>
                          <SelectContent>
                            {field.options.map((option) => (
                              <SelectItem key={option} value={option.toLowerCase().replace(/\s+/g, '_')}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      
                      {field.type === 'textarea' && (
                        <Textarea
                          id={field.key}
                          value={formData[field.key] || ''}
                          onChange={(e) => handleInputChange(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          rows={3}
                          data-testid={`${field.key}-textarea`}
                        />
                      )}
                      
                      {field.type === 'checkbox' && (
                        <div className="flex items-center space-x-2 mt-2">
                          <input
                            type="checkbox"
                            id={field.key}
                            checked={formData[field.key] || false}
                            onChange={(e) => handleInputChange(field.key, e.target.checked)}
                            data-testid={`${field.key}-checkbox`}
                          />
                          <Label htmlFor={field.key} className="text-sm">
                            Yes, this service is available
                          </Label>
                        </div>
                      )}
                      
                      {field.type === 'multiselect' && (
                        <div className="space-y-2">
                          <div className="text-sm text-gray-600">Select all that apply:</div>
                          <div className="grid grid-cols-2 gap-2">
                            {field.options.map((option) => (
                              <div key={option} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id={`${field.key}-${option}`}
                                  checked={(formData[field.key] || []).includes(option)}
                                  onChange={(e) => {
                                    const currentValues = formData[field.key] || [];
                                    if (e.target.checked) {
                                      handleInputChange(field.key, [...currentValues, option]);
                                    } else {
                                      handleInputChange(field.key, currentValues.filter(v => v !== option));
                                    }
                                  }}
                                  data-testid={`${field.key}-${option.toLowerCase().replace(/\s+/g, '-')}`}
                                />
                                <Label htmlFor={`${field.key}-${option}`} className="text-sm">
                                  {option}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Business-specific help text */}
                <div className="mt-8 p-4 bg-turquoise-50 rounded-lg">
                  <h4 className="font-semibold text-turquoise-800 mb-2">
                    {businessType === 'restaurant' && 'Restaurant Guidelines'}
                    {businessType === 'pharmacy' && 'Pharmacy Requirements'}
                    {businessType === 'grocery' && 'Grocery Store Information'}
                    {businessType === 'car_rental' && 'Car Rental Guidelines'}
                    {!['restaurant', 'pharmacy', 'grocery', 'car_rental'].includes(businessType) && 'Business Information'}
                  </h4>
                  <div className="text-sm text-turquoise-700">
                    {businessType === 'restaurant' && (
                      <ul className="list-disc list-inside space-y-1">
                        <li>Ensure you have valid food handler's licenses for all staff</li>
                        <li>Menu items should include allergen information</li>
                        <li>Kitchen capacity should reflect realistic order volumes</li>
                        <li>Consider peak hours for optimal delivery scheduling</li>
                      </ul>
                    )}
                    {businessType === 'pharmacy' && (
                      <ul className="list-disc list-inside space-y-1">
                        <li>Valid pharmacy license is required before approval</li>
                        <li>Licensed pharmacist must be available during operating hours</li>
                        <li>Prescription delivery requires special handling protocols</li>
                        <li>Insurance verification systems must be in place</li>
                      </ul>
                    )}
                    {businessType === 'grocery' && (
                      <ul className="list-disc list-inside space-y-1">
                        <li>Refrigerated items require temperature-controlled delivery</li>
                        <li>Inventory system helps track product availability</li>
                        <li>Local supplier partnerships enhance freshness</li>
                        <li>Product categorization improves customer experience</li>
                      </ul>
                    )}
                    {businessType === 'car_rental' && (
                      <ul className="list-disc list-inside space-y-1">
                        <li>All vehicles must have valid registration and insurance</li>
                        <li>Driver background checks are required for chauffeur services</li>
                        <li>Airport pickup requires special permits and scheduling</li>
                        <li>Vehicle maintenance records must be up to date</li>
                      </ul>
                    )}
                    {!['restaurant', 'pharmacy', 'grocery', 'car_rental'].includes(businessType) && (
                      <p>Provide detailed information about your business to help us understand your service requirements and create the best partnership experience.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Operations & Pricing */}
            {currentStep === 4 && (
              <div className="space-y-6" data-testid="pricing-operations-step">
                <div>
                  <Label>Select Pricing Tier *</Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    {pricingTiers.map((tier) => (
                      <Card 
                        key={tier.id}
                        className={`cursor-pointer transition-all duration-200 ${
                          formData.selectedPricingTier === tier.id 
                            ? 'border-turquoise-500 bg-turquoise-50' 
                            : 'hover:border-gray-300'
                        }`}
                        onClick={() => handleInputChange('selectedPricingTier', tier.id)}
                        data-testid={`pricing-tier-${tier.name.toLowerCase()}`}
                      >
                        <CardContent className="p-6 text-center">
                          <h3 className="font-bold text-lg mb-2">{tier.name}</h3>
                          <div className="text-2xl font-bold text-turquoise-600 mb-2">
                            ${tier.monthly_fee}/mo
                          </div>
                          <div className="text-sm text-gray-600 mb-4">
                            {tier.commission_rate}% commission
                          </div>
                          <ul className="text-xs text-left space-y-1">
                            {tier.features.map((feature, idx) => (
                              <li key={idx} className="flex items-center">
                                <CheckCircle className="h-3 w-3 text-green-500 mr-1" />
                                {feature}
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <Label htmlFor="deliveryRadius">Delivery Radius (km) *</Label>
                    <Input
                      id="deliveryRadius"
                      type="number"
                      value={formData.deliveryRadius}
                      onChange={(e) => handleInputChange('deliveryRadius', parseFloat(e.target.value))}
                      placeholder="5"
                      data-testid="delivery-radius-input"
                    />
                  </div>
                  <div>
                    <Label htmlFor="minimumOrder">Minimum Order ($) *</Label>
                    <Input
                      id="minimumOrder"
                      type="number"
                      value={formData.minimumOrder}
                      onChange={(e) => handleInputChange('minimumOrder', parseFloat(e.target.value))}
                      placeholder="0"
                      data-testid="minimum-order-input"
                    />
                  </div>
                  <div>
                    <Label htmlFor="deliveryFee">Delivery Fee ($) *</Label>
                    <Input
                      id="deliveryFee"
                      type="number"
                      value={formData.deliveryFee}
                      onChange={(e) => handleInputChange('deliveryFee', parseFloat(e.target.value))}
                      placeholder="5"
                      data-testid="delivery-fee-input"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="estimatedPrepTime">Estimated Preparation Time (minutes) *</Label>
                  <Input
                    id="estimatedPrepTime"
                    type="number"
                    value={formData.estimatedPrepTime}
                    onChange={(e) => handleInputChange('estimatedPrepTime', parseInt(e.target.value))}
                    placeholder="30"
                    data-testid="prep-time-input"
                  />
                </div>
              </div>
            )}

            {/* Step 5: Documents & Banking */}
            {currentStep === 5 && (
              <div className="space-y-6" data-testid="documents-banking-step">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    Documents & Banking Information
                  </h3>
                  <p className="text-gray-600">
                    Upload required documents and provide banking details for secure payouts
                  </p>
                </div>

                {/* Document Upload Section */}
                <Card className="bg-gray-50">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Package className="h-5 w-5 mr-2 text-turquoise-600" />
                      Required Documents
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="businessLicense">Business License *</Label>
                        <div className="mt-2 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                          <Package className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-600 mb-2">Upload Business License</p>
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="hidden"
                            id="businessLicenseUpload"
                            data-testid="business-license-upload"
                          />
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => document.getElementById('businessLicenseUpload').click()}
                          >
                            Choose File
                          </Button>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="taxId">Tax ID / EIN Document *</Label>
                        <div className="mt-2 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                          <Package className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-600 mb-2">Upload Tax ID Document</p>
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="hidden"
                            id="taxIdUpload"
                            data-testid="tax-id-upload"
                          />
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => document.getElementById('taxIdUpload').click()}
                          >
                            Choose File
                          </Button>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="proofOfAddress">Proof of Business Address</Label>
                        <div className="mt-2 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                          <Package className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-600 mb-2">Utility bill or lease agreement</p>
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="hidden"
                            id="addressProofUpload"
                            data-testid="address-proof-upload"
                          />
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => document.getElementById('addressProofUpload').click()}
                          >
                            Choose File
                          </Button>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="businessPhotos">Business Photos</Label>
                        <div className="mt-2 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                          <Package className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-600 mb-2">Interior/exterior photos</p>
                          <input
                            type="file"
                            accept=".jpg,.jpeg,.png"
                            multiple
                            className="hidden"
                            id="businessPhotosUpload"
                            data-testid="business-photos-upload"
                          />
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => document.getElementById('businessPhotosUpload').click()}
                          >
                            Choose Files
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Banking Information Section */}
                <Card className="bg-blue-50">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <CreditCard className="h-5 w-5 mr-2 text-blue-600" />
                      Banking Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="accountHolderName">Account Holder Name *</Label>
                        <Input
                          id="accountHolderName"
                          value={formData.accountHolderName || ''}
                          onChange={(e) => handleInputChange('accountHolderName', e.target.value)}
                          placeholder="Exact name on bank account"
                          data-testid="account-holder-input"
                        />
                      </div>
                      <div>
                        <Label htmlFor="bankName">Bank Name *</Label>
                        <Input
                          id="bankName"
                          value={formData.bankName || ''}
                          onChange={(e) => handleInputChange('bankName', e.target.value)}
                          placeholder="Name of your bank"
                          data-testid="bank-name-input"
                        />
                      </div>
                      <div>
                        <Label htmlFor="accountNumber">Account Number *</Label>
                        <Input
                          id="accountNumber"
                          value={formData.accountNumber || ''}
                          onChange={(e) => handleInputChange('accountNumber', e.target.value)}
                          placeholder="Bank account number"
                          data-testid="account-number-input"
                        />
                      </div>
                      <div>
                        <Label htmlFor="routingNumber">Routing Number *</Label>
                        <Input
                          id="routingNumber"
                          value={formData.routingNumber || ''}
                          onChange={(e) => handleInputChange('routingNumber', e.target.value)}
                          placeholder="Bank routing number"
                          data-testid="routing-number-input"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label htmlFor="accountType">Account Type *</Label>
                        <Select 
                          value={formData.accountType || ''} 
                          onValueChange={(value) => handleInputChange('accountType', value)}
                        >
                          <SelectTrigger data-testid="account-type-select">
                            <SelectValue placeholder="Select account type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="checking">Checking Account</SelectItem>
                            <SelectItem value="savings">Savings Account</SelectItem>
                            <SelectItem value="business">Business Account</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="mt-6 p-4 bg-white rounded-lg border">
                      <div className="flex items-start space-x-3">
                        <Shield className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-1">Secure Banking Information</h4>
                          <p className="text-sm text-gray-600">
                            Your banking information is encrypted and securely stored. We use bank-level security to protect your financial data.
                            Payouts are processed weekly and typically arrive within 1-2 business days.
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Step 6: Review & Submit */}
            {currentStep === 6 && (
              <div className="space-y-6" data-testid="review-submit-step">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Review Your Application</h3>
                  <p className="text-gray-600">Please review all information before submitting</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Users className="h-5 w-5 mr-2" />
                        Owner Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div><strong>Name:</strong> {formData.ownerName}</div>
                      <div><strong>Email:</strong> {formData.ownerEmail}</div>
                      <div><strong>Phone:</strong> {formData.ownerPhone}</div>
                      <div><strong>ID Type:</strong> {formData.identificationType}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Building2 className="h-5 w-5 mr-2" />
                        Business Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div><strong>Name:</strong> {formData.businessName}</div>
                      <div><strong>Type:</strong> {formData.businessType}</div>
                      <div><strong>Phone:</strong> {formData.businessPhone}</div>
                      <div><strong>Email:</strong> {formData.businessEmail}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <DollarSign className="h-5 w-5 mr-2" />
                        Pricing & Operations
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div><strong>Delivery Radius:</strong> {formData.deliveryRadius} km</div>
                      <div><strong>Minimum Order:</strong> ${formData.minimumOrder}</div>
                      <div><strong>Delivery Fee:</strong> ${formData.deliveryFee}</div>
                      <div><strong>Prep Time:</strong> {formData.estimatedPrepTime} min</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Target className="h-5 w-5 mr-2" />
                        {getBusinessSpecificFields().title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      {businessType === 'restaurant' && (
                        <>
                          <div><strong>Cuisine Type:</strong> {formData.cuisineType}</div>
                          <div><strong>Kitchen Capacity:</strong> {formData.kitchenCapacity} orders/hour</div>
                          <div><strong>Average Order Value:</strong> ${formData.averageOrderValue}</div>
                          <div><strong>Peak Hours:</strong> {formData.peakHours}</div>
                          {formData.specialDietaryOptions?.length > 0 && (
                            <div><strong>Dietary Options:</strong> {formData.specialDietaryOptions.join(', ')}</div>
                          )}
                        </>
                      )}
                      {businessType === 'pharmacy' && (
                        <>
                          <div><strong>Pharmacy License:</strong> {formData.pharmacyLicense}</div>
                          <div><strong>Pharmacist:</strong> {formData.pharmacistInfo?.name}</div>
                          <div><strong>License #:</strong> {formData.pharmacistInfo?.license}</div>
                          <div><strong>Experience:</strong> {formData.pharmacistInfo?.experience} years</div>
                          {formData.prescriptionServices?.length > 0 && (
                            <div><strong>Services:</strong> {formData.prescriptionServices.join(', ')}</div>
                          )}
                        </>
                      )}
                      {businessType === 'grocery' && (
                        <>
                          <div><strong>Store Size:</strong> {formData.storeSize} sq ft</div>
                          <div><strong>Refrigerated Section:</strong> {formData.refrigeratedSection ? 'Yes' : 'No'}</div>
                          <div><strong>Organic Products:</strong> {formData.organicProducts ? 'Yes' : 'No'}</div>
                          <div><strong>Inventory System:</strong> {formData.inventorySystem}</div>
                          {formData.productCategories?.length > 0 && (
                            <div><strong>Categories:</strong> {formData.productCategories.join(', ')}</div>
                          )}
                        </>
                      )}
                      {businessType === 'car_rental' && (
                        <>
                          <div><strong>Fleet Size:</strong> {formData.fleetSize} vehicles</div>
                          <div><strong>Insurance Provider:</strong> {formData.insuranceProvider}</div>
                          <div><strong>Airport Pickup:</strong> {formData.airportPickup ? 'Yes' : 'No'}</div>
                          <div><strong>Chauffeur Services:</strong> {formData.driverServices ? 'Yes' : 'No'}</div>
                          {formData.vehicleTypes?.length > 0 && (
                            <div><strong>Vehicle Types:</strong> {formData.vehicleTypes.join(', ')}</div>
                          )}
                        </>
                      )}
                      {businessType === 'business_supplier' && (
                        <>
                          <div><strong>Business Category:</strong> {formData.businessCategory}</div>
                          <div><strong>Store Size:</strong> {formData.storeSize}</div>
                          <div><strong>Inventory Size:</strong> {formData.inventorySize}</div>
                          <div><strong>Years in Business:</strong> {formData.yearsInBusiness} years</div>
                          <div><strong>Business License:</strong> {formData.businessLicense}</div>
                          <div><strong>Tax ID:</strong> {formData.taxId}</div>
                          {formData.productCategories?.length > 0 && (
                            <div><strong>Product Categories:</strong> {formData.productCategories.join(', ')}</div>
                          )}
                          {formData.specialServices?.length > 0 && (
                            <div><strong>Special Services:</strong> {formData.specialServices.join(', ')}</div>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <CreditCard className="h-5 w-5 mr-2" />
                        Banking Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div><strong>Account Holder:</strong> {formData.accountHolderName}</div>
                      <div><strong>Bank:</strong> {formData.bankName}</div>
                      <div><strong>Account Type:</strong> {formData.accountType}</div>
                      <div><strong>Account Number:</strong> ****{formData.accountNumber?.slice(-4)}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Award className="h-5 w-5 mr-2" />
                        Next Steps
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div>✓ Application review (24-48 hours)</div>
                      <div>✓ Background & license verification</div>
                      <div>✓ Account setup & training</div>
                      <div>✓ {businessType === 'car_rental' ? 'Fleet inspection' : businessType === 'pharmacy' ? 'Pharmacy audit' : businessType === 'restaurant' ? 'Kitchen inspection' : 'Business verification'}</div>
                      <div>✓ Go live and start earning!</div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-8 border-t">
              <Button 
                variant="outline" 
                onClick={prevStep} 
                disabled={currentStep === 1}
                data-testid="prev-step-btn"
              >
                Previous
              </Button>
              
              {currentStep < 6 ? (
                <Button 
                  onClick={nextStep}
                  className="bg-gradient-to-r from-turquoise-500 to-orange-500 text-white"
                  data-testid="next-step-btn"
                >
                  Next Step
                </Button>
              ) : (
                <Button 
                  onClick={handleSubmit}
                  className="bg-gradient-to-r from-green-500 to-emerald-500 text-white"
                  data-testid="submit-application-btn"
                >
                  Submit Application
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
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
    <div className="min-h-screen bg-gradient-to-br from-turquoise-50 via-white to-orange-50 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">AI Customer Support</h1>
          <p className="text-gray-600">Get instant help with your IslandHop questions</p>
        </div>

        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl h-96">
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
                        ? 'bg-gradient-to-r from-turquoise-500 to-orange-500 text-white' 
                        : 'bg-gray-100 text-gray-900'
                    }`}
                    data-testid={`chat-message-${message.type}`}
                  >
                    {message.message}
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 px-4 py-2 rounded-lg">
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
                className="bg-gradient-to-r from-turquoise-500 to-orange-500 text-white"
                data-testid="send-message-btn"
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* FAQ Section */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Common Questions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setCurrentMessage("How do I track my order?")}>
              <CardContent className="p-6">
                <h3 className="font-semibold text-gray-900 mb-2">How do I track my order?</h3>
                <p className="text-gray-600 text-sm">Learn about real-time order tracking</p>
              </CardContent>
            </Card>
            
            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setCurrentMessage("What are the delivery fees?")}>
              <CardContent className="p-6">
                <h3 className="font-semibold text-gray-900 mb-2">What are the delivery fees?</h3>
                <p className="text-gray-600 text-sm">Information about pricing and fees</p>
              </CardContent>
            </Card>
            
            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setCurrentMessage("How do I become a partner?")}>
              <CardContent className="p-6">
                <h3 className="font-semibold text-gray-900 mb-2">How do I become a partner?</h3>
                <p className="text-gray-600 text-sm">Learn about joining our partner network</p>
              </CardContent>
            </Card>
            
            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setCurrentMessage("What payment methods do you accept?")}>
              <CardContent className="p-6">
                <h3 className="font-semibold text-gray-900 mb-2">Payment Methods</h3>
                <p className="text-gray-600 text-sm">Supported payment options</p>
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
  const { user } = useAuth();
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    fetchApplications();
  }, [user, navigate]);

  const fetchApplications = async () => {
    try {
      const response = await axios.get(`${API}/business/onboarding`, {
        withCredentials: true
      });
      setApplications(response.data);
    } catch (error) {
      console.error('Error fetching applications:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return <Navigate to="/" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-turquoise-50 via-white to-orange-50 py-12">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome back, {user.name}!</h1>
          <p className="text-gray-600">Manage your IslandHop experience</p>
        </div>

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
                >
                  <MessageCircle className="h-6 w-6" />
                  <span className="text-sm">Support</span>
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
                  <img src={user.picture} alt={user.name} className="w-12 h-12 rounded-full" />
                ) : (
                  <div className="w-12 h-12 bg-gradient-to-r from-turquoise-500 to-orange-500 rounded-full flex items-center justify-center text-white font-bold">
                    {user.name.charAt(0)}
                  </div>
                )}
                <div>
                  <div className="font-semibold">{user.name}</div>
                  <div className="text-sm text-gray-600">{user.email}</div>
                </div>
              </div>
              <div className="pt-4 border-t">
                <Badge variant="secondary" className="mb-2">Active Member</Badge>
                <p className="text-xs text-gray-600">Member since {new Date(user.created_at).toLocaleDateString()}</p>
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
                  {applications.map((app) => (
                    <div key={app.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h3 className="font-semibold">{app.business_details.business_name}</h3>
                        <p className="text-sm text-gray-600">{app.business_details.business_type}</p>
                        <p className="text-xs text-gray-500">Applied: {new Date(app.application_date).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <Badge 
                          variant={
                            app.verification_status === 'verified' ? 'default' : 
                            app.verification_status === 'rejected' ? 'destructive' : 'secondary'
                          }
                        >
                          {app.verification_status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-4">No business applications yet</p>
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
    <div className="min-h-screen bg-gradient-to-br from-turquoise-50 via-white to-orange-50 py-12">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
            Caribbean Restaurants
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
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
              <h3 className="text-xl font-bold text-gray-900 mb-2">Island Spice Kitchen</h3>
              <p className="text-gray-600 mb-4">Authentic Jamaican cuisine with a modern twist</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Star className="h-4 w-4 text-yellow-500 mr-1" />
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
              <h3 className="text-xl font-bold text-gray-900 mb-2">Tropical Delights</h3>
              <p className="text-gray-600 mb-4">Fresh seafood and tropical flavors</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Star className="h-4 w-4 text-yellow-500 mr-1" />
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
              <h3 className="text-xl font-bold text-gray-900 mb-2">Caribbean Fusion</h3>
              <p className="text-gray-600 mb-4">International dishes with Caribbean flair</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Star className="h-4 w-4 text-yellow-500 mr-1" />
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
            className="bg-gradient-to-r from-turquoise-500 to-orange-500 text-white"
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
        withCredentials: true
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
    <div className="min-h-screen bg-gradient-to-br from-turquoise-50 via-white to-orange-50 py-12">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Drive with IslandHop
          </h1>
          <p className="text-gray-600">
            Join our network of professional drivers and start earning today
          </p>
        </div>

        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl">
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
                  <Label htmlFor="licenseNumber">Driver's License Number *</Label>
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
                  className="bg-gradient-to-r from-turquoise-500 to-orange-500 text-white"
                >
                  Submit Application
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <Card className="bg-gradient-to-r from-turquoise-500 to-orange-500 border-0 text-white">
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
      <Router>
        <div className="min-h-screen bg-gradient-to-br from-turquoise-50 via-white to-orange-50">
          <Header />
          <AuthHandler />
          
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/restaurants" element={<RestaurantsPage />} />
            <Route path="/car-rentals" element={<CarRentalPage />} />
            <Route path="/analytics" element={<KPIDashboard />} />
            <Route path="/partner" element={<PartnerSelection />} />
            <Route path="/partner/onboarding" element={<BusinessOnboarding />} />
            <Route path="/driver-onboarding" element={<DriverOnboarding />} />
            <Route path="/restaurant-onboarding" element={<RestaurantOnboarding />} />
            <Route path="/driver" element={<DriverRegistration />} />
            <Route path="/support" element={<AISupport />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
          
          <Toaster />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;