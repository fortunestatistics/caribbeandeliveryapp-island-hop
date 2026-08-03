import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Textarea } from './components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Badge } from './components/ui/badge';
import { Checkbox } from './components/ui/checkbox';
import { Award, Building2, CheckCircle, CreditCard, DollarSign, Package, Shield, Target, Users } from 'lucide-react';
import { useAuth } from './AuthContext';
import { useToast } from './hooks/use-toast';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

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
    // Authentication removed for demo access
    fetchCategories();
    fetchPricingTiers();
  }, [navigate]);

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

  // Upload one or more selected files to object storage and attach the returned
  // document refs to formData.documents (keyed by docType so re-uploads replace).
  const [uploading, setUploading] = useState({});
  const handleDocUpload = async (docType, label, fileList, { multiple = false } = {}) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setUploading((u) => ({ ...u, [docType]: true }));
    const authToken = localStorage.getItem('token');
    try {
      const uploaded = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append('doc_type', docType);
        fd.append('file', file);
        const res = await axios.post(`${API}/business/documents`, fd, {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        });
        uploaded.push({
          type: docType,
          label,
          document_id: res.data.document_id,
          filename: res.data.filename || file.name,
          is_image: !!res.data.is_image,
        });
      }
      setFormData((prev) => {
        const others = multiple
          ? prev.documents
          : prev.documents.filter((d) => d.type !== docType);
        return { ...prev, documents: [...others, ...uploaded] };
      });
      toast({ title: 'Uploaded', description: `${files.length} file(s) added to ${label}.` });
    } catch (err) {
      toast({ title: 'Upload failed', description: err?.response?.data?.detail || 'Could not upload file.', variant: 'destructive' });
    } finally {
      setUploading((u) => ({ ...u, [docType]: false }));
    }
  };

  const docsFor = (docType) => formData.documents.filter((d) => d.type === docType);


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
<<<<<<< HEAD
        withCredentials: true
=======
        withCredentials: false
>>>>>>> cb805eb
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
            { key: 'businessModel', label: 'Business Model', type: 'select', options: ['B2C', 'B2B', 'B2B2C', 'Marketplace', 'Subscription'], description: 'How your business sells to customers — pick the one that best fits.', optionDescriptions: {
              'B2C': 'Business-to-Consumer — you sell directly to individual shoppers (most restaurants, shops & pharmacies).',
              'B2B': 'Business-to-Business — you sell wholesale to other companies, not the general public.',
              'B2B2C': 'You supply other businesses who resell to consumers (e.g., a brand selling through retail partners).',
              'Marketplace': 'You host multiple third-party sellers/vendors under one storefront and take a commission.',
              'Subscription': 'Customers pay a recurring fee (weekly/monthly) for ongoing products or services.'
            } },
            { key: 'targetCustomers', label: 'Target Customer Demographics', type: 'textarea' },
            { key: 'competitiveAdvantage', label: 'Competitive Advantage', type: 'textarea' }
          ]
        };
    }
  };

  // Authentication check removed for demo purposes
  /* 
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
  */

  return (
    <div className="min-h-screen bg-matte-900 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-4">Business Onboarding</h1>
          <p className="text-muted-foreground">Step {currentStep} of 6: {stepTitles[currentStep - 1]}</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {stepTitles.map((title, index) => (
              <div 
                key={title}
                className={`flex-1 text-center ${index <= currentStep - 1 ? 'text-gold-500' : 'text-muted-foreground/70'}`}
              >
                <div className={`w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center ${
                  index <= currentStep - 1 ? 'bg-gold-gradient text-matte-900 shadow-gold-glow font-bold' : 'bg-matte-800 text-muted-foreground border border-border'
                }`}>
                  {index + 1}
                </div>
                <div className="text-xs font-medium">{title}</div>
              </div>
            ))}
          </div>
          <div className="w-full bg-matte-800 border border-border rounded-full h-2">
            <div 
              className="bg-gold-gradient h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / 6) * 100}%` }}
            ></div>
          </div>
        </div>

        <Card className="bg-matte-800 border border-border shadow-2xl">
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
                        <SelectItem value="drivers_license">Driver&apos;s License</SelectItem>
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
                  <h3 className="text-2xl font-bold text-foreground mb-2">
                    {getBusinessSpecificFields().title}
                  </h3>
                  <p className="text-muted-foreground">
                    Please provide information specific to your business type
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {getBusinessSpecificFields().fields.map((field, index) => (
                    <div key={field.key} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                      <Label htmlFor={field.key}>
                        {field.label} {field.required && '*'}
                      </Label>
                      {field.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 mb-1" data-testid={`${field.key}-description`}>{field.description}</p>
                      )}
                      
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
                      {field.type === 'select' && field.optionDescriptions && (
                        <ul className="mt-2 space-y-1 text-xs text-muted-foreground rounded-lg bg-muted/40 p-3" data-testid={`${field.key}-help`}>
                          {Object.entries(field.optionDescriptions).map(([k, v]) => (
                            <li key={k}><span className="font-semibold text-foreground">{k}:</span> {v}</li>
                          ))}
                        </ul>
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
                          <div className="text-sm text-muted-foreground">Select all that apply:</div>
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
                <div className="mt-8 p-4 bg-gold-500/15 rounded-lg">
                  <h4 className="font-semibold text-turquoise-800 mb-2">
                    {businessType === 'restaurant' && 'Restaurant Guidelines'}
                    {businessType === 'pharmacy' && 'Pharmacy Requirements'}
                    {businessType === 'grocery' && 'Grocery Store Information'}
                    {businessType === 'car_rental' && 'Car Rental Guidelines'}
                    {!['restaurant', 'pharmacy', 'grocery', 'car_rental'].includes(businessType) && 'Business Information'}
                  </h4>
                  <div className="text-sm text-gold-300">
                    {businessType === 'restaurant' && (
                      <ul className="list-disc list-inside space-y-1">
                        <li>Ensure you have valid food handler&apos;s licenses for all staff</li>
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
                            ? 'border-gold-500/30 bg-gold-500/15' 
                            : 'hover:border-border'
                        }`}
                        onClick={() => handleInputChange('selectedPricingTier', tier.id)}
                        data-testid={`pricing-tier-${tier.name.toLowerCase()}`}
                      >
                        <CardContent className="p-6 text-center">
                          <h3 className="font-bold text-lg mb-2">{tier.name}</h3>
                          <div className="text-2xl font-bold text-gold-500 mb-2">
                            ${tier.monthly_fee}/mo
                          </div>
                          <div className="text-sm text-muted-foreground mb-4">
                            {tier.commission_rate}% commission
                          </div>
                          <ul className="text-xs text-left space-y-1">
                            {tier.features.map((feature) => (
                              <li key={feature} className="flex items-center">
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
                  <h3 className="text-2xl font-bold text-foreground mb-2">
                    Documents & Banking Information
                  </h3>
                  <p className="text-muted-foreground">
                    Upload required documents and provide banking details for secure payouts
                  </p>
                </div>

                {/* Document Upload Section */}
                <Card className="bg-matte-800 border border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Package className="h-5 w-5 mr-2 text-gold-500" />
                      Required Documents
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="businessLicense">Business License *</Label>
                        <div className="mt-2 border-2 border-dashed border-border rounded-lg p-6 text-center">
                          <Package className="h-8 w-8 text-muted-foreground/70 mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground mb-2">Upload Business License</p>
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="hidden"
                            id="businessLicenseUpload"
                            data-testid="business-license-upload"
                            onChange={(e) => handleDocUpload('businessLicense', 'Business License', e.target.files)}
                          />
                          <Button 
                            variant="outline" 
                            size="sm"
                            disabled={uploading['businessLicense']}
                            onClick={() => document.getElementById('businessLicenseUpload').click()}
                          >
                            {uploading['businessLicense'] ? 'Uploading…' : 'Choose File'}
                          </Button>
                          {docsFor('businessLicense').map((d) => (
                            <p key={d.document_id} className="mt-2 text-xs text-green-600 truncate" data-testid="business-license-filename">✓ {d.filename}</p>
                          ))}
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="taxId">Tax ID / EIN Document *</Label>
                        <div className="mt-2 border-2 border-dashed border-border rounded-lg p-6 text-center">
                          <Package className="h-8 w-8 text-muted-foreground/70 mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground mb-2">Upload Tax ID Document</p>
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="hidden"
                            id="taxIdUpload"
                            data-testid="tax-id-upload"
                            onChange={(e) => handleDocUpload('taxId', 'Tax ID / EIN', e.target.files)}
                          />
                          <Button 
                            variant="outline" 
                            size="sm"
                            disabled={uploading['taxId']}
                            onClick={() => document.getElementById('taxIdUpload').click()}
                          >
                            {uploading['taxId'] ? 'Uploading…' : 'Choose File'}
                          </Button>
                          {docsFor('taxId').map((d) => (
                            <p key={d.document_id} className="mt-2 text-xs text-green-600 truncate" data-testid="tax-id-filename">✓ {d.filename}</p>
                          ))}
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="proofOfAddress">Proof of Business Address</Label>
                        <div className="mt-2 border-2 border-dashed border-border rounded-lg p-6 text-center">
                          <Package className="h-8 w-8 text-muted-foreground/70 mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground mb-2">Utility bill or lease agreement</p>
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="hidden"
                            id="addressProofUpload"
                            data-testid="address-proof-upload"
                            onChange={(e) => handleDocUpload('proofOfAddress', 'Proof of Address', e.target.files)}
                          />
                          <Button 
                            variant="outline" 
                            size="sm"
                            disabled={uploading['proofOfAddress']}
                            onClick={() => document.getElementById('addressProofUpload').click()}
                          >
                            {uploading['proofOfAddress'] ? 'Uploading…' : 'Choose File'}
                          </Button>
                          {docsFor('proofOfAddress').map((d) => (
                            <p key={d.document_id} className="mt-2 text-xs text-green-600 truncate" data-testid="address-proof-filename">✓ {d.filename}</p>
                          ))}
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="businessPhotos">Business Photos</Label>
                        <div className="mt-2 border-2 border-dashed border-border rounded-lg p-6 text-center">
                          <Package className="h-8 w-8 text-muted-foreground/70 mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground mb-2">Interior/exterior photos</p>
                          <input
                            type="file"
                            accept=".jpg,.jpeg,.png"
                            multiple
                            className="hidden"
                            id="businessPhotosUpload"
                            data-testid="business-photos-upload"
                            onChange={(e) => handleDocUpload('businessPhoto', 'Business Photo', e.target.files, { multiple: true })}
                          />
                          <Button 
                            variant="outline" 
                            size="sm"
                            disabled={uploading['businessPhoto']}
                            onClick={() => document.getElementById('businessPhotosUpload').click()}
                          >
                            {uploading['businessPhoto'] ? 'Uploading…' : 'Choose Files'}
                          </Button>
                          {docsFor('businessPhoto').map((d) => (
                            <p key={d.document_id} className="mt-2 text-xs text-green-600 truncate" data-testid="business-photo-filename">✓ {d.filename}</p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Banking Information Section */}
                <Card className="bg-neon-cyan/10">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center">
                        <CreditCard className="h-5 w-5 mr-2 text-teal-700" />
                        Banking Information <span className="ml-2 text-sm font-normal text-muted-foreground">(optional)</span>
                      </span>
                      <Button type="button" variant="outline" size="sm" data-testid="partner-skip-banking-btn"
                        onClick={() => { ['accountHolderName','bankName','accountNumber','routingNumber','accountType'].forEach((k) => handleInputChange(k, '')); nextStep(); }}>
                        Skip for now
                      </Button>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">You can add your payout details later from your profile. Not needed to submit your application.</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="accountHolderName">Account Holder Name</Label>
                        <Input
                          id="accountHolderName"
                          value={formData.accountHolderName || ''}
                          onChange={(e) => handleInputChange('accountHolderName', e.target.value)}
                          placeholder="Exact name on bank account"
                          data-testid="account-holder-input"
                        />
                      </div>
                      <div>
                        <Label htmlFor="bankName">Bank Name</Label>
                        <Input
                          id="bankName"
                          value={formData.bankName || ''}
                          onChange={(e) => handleInputChange('bankName', e.target.value)}
                          placeholder="Name of your bank"
                          data-testid="bank-name-input"
                        />
                      </div>
                      <div>
                        <Label htmlFor="accountNumber">Account Number</Label>
                        <Input
                          id="accountNumber"
                          value={formData.accountNumber || ''}
                          onChange={(e) => handleInputChange('accountNumber', e.target.value)}
                          placeholder="Bank account number"
                          data-testid="account-number-input"
                        />
                      </div>
                      <div>
                        <Label htmlFor="routingNumber">Routing Number</Label>
                        <Input
                          id="routingNumber"
                          value={formData.routingNumber || ''}
                          onChange={(e) => handleInputChange('routingNumber', e.target.value)}
                          placeholder="Bank routing number"
                          data-testid="routing-number-input"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label htmlFor="accountType">Account Type</Label>
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

                    <div className="mt-6 p-4 bg-matte-800 border border-gold-500/20 rounded-lg">
                      <div className="flex items-start space-x-3">
                        <Shield className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="font-semibold text-foreground mb-1">Secure Banking Information</h4>
                          <p className="text-sm text-muted-foreground">
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
                  <h3 className="text-2xl font-bold text-foreground mb-2">Review Your Application</h3>
                  <p className="text-muted-foreground">Please review all information before submitting</p>
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
                      <div>✓ {({ car_rental: 'Fleet inspection', pharmacy: 'Pharmacy audit', restaurant: 'Kitchen inspection' }[businessType]) || 'Business verification'}</div>
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
                  className="bg-gold-gradient text-white"
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

export default BusinessOnboarding;
