import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Textarea } from './components/ui/textarea';
import { Badge } from './components/ui/badge';
import { useToast } from './hooks/use-toast';
import { 
  Utensils, 
  Clock, 
  FileText, 
  CreditCard, 
  CheckCircle,
  Upload,
  MapPin,
  Star,
  ChefHat
} from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const RestaurantOnboarding = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    // Business Information
    businessName: '',
    ownerName: '',
    ownerEmail: '',
    ownerPhone: '',
    address: {
      street: '',
      city: '',
      parish: '',
      country: 'Jamaica'
    },
    cuisineTypes: [],
    description: '',
    establishedYear: '',
    seatingCapacity: '',
    
    // Operating Hours
    operatingHours: {
      monday: { isOpen: true, open: '09:00', close: '22:00' },
      tuesday: { isOpen: true, open: '09:00', close: '22:00' },
      wednesday: { isOpen: true, open: '09:00', close: '22:00' },
      thursday: { isOpen: true, open: '09:00', close: '22:00' },
      friday: { isOpen: true, open: '09:00', close: '23:00' },
      saturday: { isOpen: true, open: '09:00', close: '23:00' },
      sunday: { isOpen: true, open: '10:00', close: '21:00' }
    },
    
    // Documents
    businessLicense: null,
    foodHandlerCertificate: null,
    taxId: null,
    menuPhotos: [],
    restaurantPhotos: [],
    
    // Banking Information
    accountHolderName: '',
    bankName: '',
    accountNumber: '',
    routingNumber: '',
    accountType: ''
  });

  const cuisineOptions = [
    'Caribbean', 'Jamaican', 'Cuban', 'Puerto Rican', 'Barbadian', 'Trinidadian',
    'International', 'Italian', 'Chinese', 'Indian', 'Mexican', 'American',
    'Seafood', 'Vegetarian', 'Vegan', 'Fast Food', 'Fine Dining', 'Casual Dining',
    'BBQ', 'Pizza', 'Sushi', 'Mediterranean', 'Thai', 'Other'
  ];

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const dayLabels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const stepTitles = [
    'Business Information',
    'Operating Hours',
    'Documents Upload',
    'Banking Information', 
    'Review & Submit'
  ];

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

  const handleOperatingHoursChange = (day, field, value) => {
    setFormData(prev => ({
      ...prev,
      operatingHours: {
        ...prev.operatingHours,
        [day]: {
          ...prev.operatingHours[day],
          [field]: value
        }
      }
    }));
  };

  const toggleCuisineType = (cuisine) => {
    setFormData(prev => ({
      ...prev,
      cuisineTypes: prev.cuisineTypes.includes(cuisine)
        ? prev.cuisineTypes.filter(c => c !== cuisine)
        : [...prev.cuisineTypes, cuisine]
    }));
  };

  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, 5));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  const handleSubmit = async () => {
    try {
      const restaurantData = {
        name: formData.businessName,
        description: formData.description,
        cuisine_type: formData.cuisineTypes.join(', '),
        address: formData.address,
        phone: formData.ownerPhone,
        email: formData.ownerEmail,
        owner_info: {
          name: formData.ownerName,
          email: formData.ownerEmail,
          phone: formData.ownerPhone
        },
        operating_hours: formData.operatingHours,
        business_details: {
          established_year: formData.establishedYear,
          seating_capacity: formData.seatingCapacity,
          cuisine_types: formData.cuisineTypes
        },
        banking_info: {
          account_holder_name: formData.accountHolderName,
          bank_name: formData.bankName,
          account_number: formData.accountNumber,
          routing_number: formData.routingNumber,
          account_type: formData.accountType
        }
      };

      await axios.post(`${API}/restaurants`, restaurantData, {
        withCredentials: false
      });

      toast({
        title: "Restaurant Application Submitted!",
        description: "We'll review your application and get back to you within 24-48 hours.",
      });

      navigate('/dashboard');
    } catch (error) {
      console.error('Error submitting restaurant application:', error);
      toast({
        title: "Error",
        description: "Failed to submit application. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = (fileType, event, isMultiple = false) => {
    const files = event.target.files;
    if (files) {
      if (isMultiple) {
        setFormData(prev => ({
          ...prev,
          [fileType]: Array.from(files)
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          [fileType]: files[0]
        }));
      }
    }
  };

  return (
    <div className="min-h-screen bg-matte-900 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-4">Become a Partner Restaurant</h1>
          <p className="text-muted-foreground">Step {currentStep} of 5: {stepTitles[currentStep - 1]}</p>
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
                <div className="text-xs font-medium hidden md:block">{title}</div>
              </div>
            ))}
          </div>
          <div className="w-full bg-matte-800 border border-border rounded-full h-2">
            <div 
              className="bg-gold-gradient h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / 5) * 100}%` }}
            ></div>
          </div>
        </div>

        <Card className="bg-matte-800 border border-border shadow-2xl">
          <CardContent className="p-8">
            {/* Step 1: Business Information */}
            {currentStep === 1 && (
              <div className="space-y-6" data-testid="business-info-step">
                <div className="text-center mb-6">
                  <Utensils className="h-12 w-12 text-red-600 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-foreground mb-2">Business Information</h3>
                  <p className="text-muted-foreground">Tell us about your restaurant</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="businessName">Restaurant Name *</Label>
                    <Input
                      id="businessName"
                      value={formData.businessName}
                      onChange={(e) => handleInputChange('businessName', e.target.value)}
                      placeholder="Enter your restaurant name"
                      data-testid="business-name-input"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ownerName">Owner Name *</Label>
                    <Input
                      id="ownerName"
                      value={formData.ownerName}
                      onChange={(e) => handleInputChange('ownerName', e.target.value)}
                      placeholder="Restaurant owner full name"
                      data-testid="owner-name-input"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ownerEmail">Contact Email *</Label>
                    <Input
                      id="ownerEmail"
                      type="email"
                      value={formData.ownerEmail}
                      onChange={(e) => handleInputChange('ownerEmail', e.target.value)}
                      placeholder="restaurant@example.com"
                      data-testid="owner-email-input"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ownerPhone">Contact Phone *</Label>
                    <Input
                      id="ownerPhone"
                      value={formData.ownerPhone}
                      onChange={(e) => handleInputChange('ownerPhone', e.target.value)}
                      placeholder="+1 (xxx) xxx-xxxx"
                      data-testid="owner-phone-input"
                    />
                  </div>
                  <div>
                    <Label htmlFor="establishedYear">Established Year</Label>
                    <Input
                      id="establishedYear"
                      type="number"
                      min="1900"
                      max="2025"
                      value={formData.establishedYear}
                      onChange={(e) => handleInputChange('establishedYear', e.target.value)}
                      placeholder="2020"
                      data-testid="established-year-input"
                    />
                  </div>
                  <div>
                    <Label htmlFor="seatingCapacity">Seating Capacity</Label>
                    <Input
                      id="seatingCapacity"
                      type="number"
                      value={formData.seatingCapacity}
                      onChange={(e) => handleInputChange('seatingCapacity', e.target.value)}
                      placeholder="50"
                      data-testid="seating-capacity-input"
                    />
                  </div>
                </div>

                <div>
                  <Label>Restaurant Address *</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <Input
                      placeholder="Street Address"
                      value={formData.address.street}
                      onChange={(e) => handleInputChange('address.street', e.target.value)}
                      data-testid="address-street-input"
                    />
                    <Input
                      placeholder="City"
                      value={formData.address.city}
                      onChange={(e) => handleInputChange('address.city', e.target.value)}
                      data-testid="address-city-input"
                    />
                    <Input
                      placeholder="Parish/State"
                      value={formData.address.parish}
                      onChange={(e) => handleInputChange('address.parish', e.target.value)}
                      data-testid="address-parish-input"
                    />
                  </div>
                </div>

                <div>
                  <Label>Cuisine Types * (Select all that apply)</Label>
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-2 mt-3">
                    {cuisineOptions.map((cuisine) => (
                      <Button
                        key={cuisine}
                        type="button"
                        variant={formData.cuisineTypes.includes(cuisine) ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleCuisineType(cuisine)}
                        className="text-xs"
                        data-testid={`cuisine-${cuisine.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        {cuisine}
                      </Button>
                    ))}
                  </div>
                  {formData.cuisineTypes.length > 0 && (
                    <div className="mt-3">
                      <span className="text-sm text-muted-foreground">Selected: </span>
                      {formData.cuisineTypes.map((cuisine) => (
                        <Badge key={cuisine} variant="secondary" className="ml-1">
                          {cuisine}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="description">Restaurant Description *</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Describe your restaurant, specialties, and what makes you unique..."
                    rows={4}
                    data-testid="description-textarea"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Operating Hours */}
            {currentStep === 2 && (
              <div className="space-y-6" data-testid="operating-hours-step">
                <div className="text-center mb-6">
                  <Clock className="h-12 w-12 text-neon-cyan mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-foreground mb-2">Operating Hours</h3>
                  <p className="text-muted-foreground">Set your restaurant&apos;s operating hours</p>
                </div>

                <div className="space-y-4">
                  {days.map((day, index) => (
                    <Card key={day} className="border">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={`${day}-open`}
                                checked={formData.operatingHours[day].isOpen}
                                onChange={(e) => handleOperatingHoursChange(day, 'isOpen', e.target.checked)}
                                data-testid={`${day}-open-checkbox`}
                              />
                              <Label htmlFor={`${day}-open`} className="font-semibold">
                                {dayLabels[index]}
                              </Label>
                            </div>
                          </div>

                          {formData.operatingHours[day].isOpen && (
                            <div className="flex items-center space-x-2">
                              <Input
                                type="time"
                                value={formData.operatingHours[day].open}
                                onChange={(e) => handleOperatingHoursChange(day, 'open', e.target.value)}
                                className="w-24"
                                data-testid={`${day}-open-time`}
                              />
                              <span>to</span>
                              <Input
                                type="time"
                                value={formData.operatingHours[day].close}
                                onChange={(e) => handleOperatingHoursChange(day, 'close', e.target.value)}
                                className="w-24"
                                data-testid={`${day}-close-time`}
                              />
                            </div>
                          )}

                          {!formData.operatingHours[day].isOpen && (
                            <Badge variant="secondary">Closed</Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="mt-6 p-4 bg-neon-cyan/10 rounded-lg">
                  <h4 className="font-semibold text-neon-cyan mb-2">Operating Hours Tips</h4>
                  <ul className="text-sm text-neon-cyan space-y-1">
                    <li>• Set realistic hours that your kitchen can consistently handle</li>
                    <li>• Consider your peak ordering times (lunch and dinner rushes)</li>
                    <li>• You can update these hours later in your dashboard</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Step 3: Documents Upload */}
            {currentStep === 3 && (
              <div className="space-y-6" data-testid="documents-step">
                <div className="text-center mb-6">
                  <FileText className="h-12 w-12 text-green-600 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-foreground mb-2">Documents Upload</h3>
                  <p className="text-muted-foreground">Upload required documents and photos</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Required Documents */}
                  <div>
                    <Label>Business License *</Label>
                    <div className="mt-2 border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-turquoise-400 transition-colors">
                      <Upload className="h-8 w-8 text-muted-foreground/70 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground mb-2">
                        {formData.businessLicense ? formData.businessLicense.name : 'Upload Business License'}
                      </p>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="hidden"
                        id="businessLicenseUpload"
                        onChange={(e) => handleFileUpload('businessLicense', e)}
                        data-testid="business-license-upload"
                      />
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => document.getElementById('businessLicenseUpload').click()}
                      >
                        Choose File
                      </Button>
                      {formData.businessLicense && <Badge variant="secondary" className="mt-2 block">✓ Uploaded</Badge>}
                    </div>
                  </div>

                  <div>
                    <Label>Food Handler Certificate *</Label>
                    <div className="mt-2 border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-turquoise-400 transition-colors">
                      <Upload className="h-8 w-8 text-muted-foreground/70 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground mb-2">
                        {formData.foodHandlerCertificate ? formData.foodHandlerCertificate.name : 'Upload Food Handler Certificate'}
                      </p>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="hidden"
                        id="foodHandlerUpload"
                        onChange={(e) => handleFileUpload('foodHandlerCertificate', e)}
                        data-testid="food-handler-upload"
                      />
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => document.getElementById('foodHandlerUpload').click()}
                      >
                        Choose File
                      </Button>
                      {formData.foodHandlerCertificate && <Badge variant="secondary" className="mt-2 block">✓ Uploaded</Badge>}
                    </div>
                  </div>

                  <div>
                    <Label>Tax ID Document *</Label>
                    <div className="mt-2 border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-turquoise-400 transition-colors">
                      <Upload className="h-8 w-8 text-muted-foreground/70 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground mb-2">
                        {formData.taxId ? formData.taxId.name : 'Upload Tax ID/EIN'}
                      </p>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="hidden"
                        id="taxIdUpload"
                        onChange={(e) => handleFileUpload('taxId', e)}
                        data-testid="tax-id-upload"
                      />
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => document.getElementById('taxIdUpload').click()}
                      >
                        Choose File
                      </Button>
                      {formData.taxId && <Badge variant="secondary" className="mt-2 block">✓ Uploaded</Badge>}
                    </div>
                  </div>

                  <div>
                    <Label>Menu Photos</Label>
                    <div className="mt-2 border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-turquoise-400 transition-colors">
                      <Upload className="h-8 w-8 text-muted-foreground/70 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground mb-2">
                        {formData.menuPhotos.length > 0 ? `${formData.menuPhotos.length} files selected` : 'Upload Menu Photos'}
                      </p>
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png"
                        multiple
                        className="hidden"
                        id="menuPhotosUpload"
                        onChange={(e) => handleFileUpload('menuPhotos', e, true)}
                        data-testid="menu-photos-upload"
                      />
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => document.getElementById('menuPhotosUpload').click()}
                      >
                        Choose Files
                      </Button>
                      {formData.menuPhotos.length > 0 && <Badge variant="secondary" className="mt-2 block">✓ {formData.menuPhotos.length} Uploaded</Badge>}
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <Label>Restaurant Photos</Label>
                    <div className="mt-2 border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-turquoise-400 transition-colors">
                      <Upload className="h-8 w-8 text-muted-foreground/70 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground mb-2">
                        {formData.restaurantPhotos.length > 0 ? `${formData.restaurantPhotos.length} files selected` : 'Upload Restaurant Interior/Exterior Photos'}
                      </p>
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png"
                        multiple
                        className="hidden"
                        id="restaurantPhotosUpload"
                        onChange={(e) => handleFileUpload('restaurantPhotos', e, true)}
                        data-testid="restaurant-photos-upload"
                      />
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => document.getElementById('restaurantPhotosUpload').click()}
                      >
                        Choose Files
                      </Button>
                      {formData.restaurantPhotos.length > 0 && <Badge variant="secondary" className="mt-2 block">✓ {formData.restaurantPhotos.length} Uploaded</Badge>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Banking Information */}
            {currentStep === 4 && (
              <div className="space-y-6" data-testid="banking-step">
                <div className="text-center mb-6">
                  <CreditCard className="h-12 w-12 text-green-600 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-foreground mb-2">Banking Information</h3>
                  <p className="text-muted-foreground">Secure account details for receiving payments</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="accountHolderName">Account Holder Name *</Label>
                    <Input
                      id="accountHolderName"
                      value={formData.accountHolderName}
                      onChange={(e) => handleInputChange('accountHolderName', e.target.value)}
                      placeholder="Exact name on bank account"
                      data-testid="account-holder-input"
                    />
                  </div>
                  <div>
                    <Label htmlFor="bankName">Bank Name *</Label>
                    <Select value={formData.bankName} onValueChange={(value) => handleInputChange('bankName', value)}>
                      <SelectTrigger data-testid="bank-name-select">
                        <SelectValue placeholder="Select your bank" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ncb">NCB (National Commercial Bank)</SelectItem>
                        <SelectItem value="scotiabank">Scotiabank Jamaica</SelectItem>
                        <SelectItem value="jn_bank">JN Bank</SelectItem>
                        <SelectItem value="cibc">CIBC FirstCaribbean</SelectItem>
                        <SelectItem value="sagicor">Sagicor Bank</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="accountNumber">Account Number *</Label>
                    <Input
                      id="accountNumber"
                      value={formData.accountNumber}
                      onChange={(e) => handleInputChange('accountNumber', e.target.value)}
                      placeholder="Bank account number"
                      data-testid="account-number-input"
                    />
                  </div>
                  <div>
                    <Label htmlFor="routingNumber">Routing Number</Label>
                    <Input
                      id="routingNumber"
                      value={formData.routingNumber}
                      onChange={(e) => handleInputChange('routingNumber', e.target.value)}
                      placeholder="Bank routing number (if applicable)"
                      data-testid="routing-number-input"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="accountType">Account Type *</Label>
                    <Select value={formData.accountType} onValueChange={(value) => handleInputChange('accountType', value)}>
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

                <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-green-900 mb-1">Secure Weekly Payments</h4>
                      <p className="text-sm text-green-800">
                        Restaurant earnings are transferred weekly after deducting the 15% commission. 
                        Payments typically arrive within 1-2 business days.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Review & Submit */}
            {currentStep === 5 && (
              <div className="space-y-6" data-testid="review-step">
                <div className="text-center mb-6">
                  <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-foreground mb-2">Review Your Application</h3>
                  <p className="text-muted-foreground">Please review all information before submitting</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Utensils className="h-5 w-5 mr-2" />
                        Restaurant Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div><strong>Name:</strong> {formData.businessName}</div>
                      <div><strong>Owner:</strong> {formData.ownerName}</div>
                      <div><strong>Email:</strong> {formData.ownerEmail}</div>
                      <div><strong>Phone:</strong> {formData.ownerPhone}</div>
                      <div><strong>Address:</strong> {formData.address.street}, {formData.address.city}</div>
                      <div><strong>Cuisines:</strong> {formData.cuisineTypes.join(', ')}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Clock className="h-5 w-5 mr-2" />
                        Operating Hours
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1 text-sm">
                      {days.map((day, index) => (
                        <div key={day}>
                          <strong>{dayLabels[index]}:</strong> {
                            formData.operatingHours[day].isOpen 
                              ? `${formData.operatingHours[day].open} - ${formData.operatingHours[day].close}`
                              : 'Closed'
                          }
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <FileText className="h-5 w-5 mr-2" />
                        Documents
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div>Business License: {formData.businessLicense ? '✓ Uploaded' : '✗ Missing'}</div>
                      <div>Food Handler Certificate: {formData.foodHandlerCertificate ? '✓ Uploaded' : '✗ Missing'}</div>
                      <div>Tax ID: {formData.taxId ? '✓ Uploaded' : '✗ Missing'}</div>
                      <div>Menu Photos: {formData.menuPhotos.length > 0 ? `✓ ${formData.menuPhotos.length} uploaded` : '✗ None'}</div>
                      <div>Restaurant Photos: {formData.restaurantPhotos.length > 0 ? `✓ ${formData.restaurantPhotos.length} uploaded` : '✗ None'}</div>
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
              
              {currentStep < 5 ? (
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

export default RestaurantOnboarding;