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
  User, 
  Car, 
  FileText, 
  CreditCard, 
  CheckCircle,
  Upload,
  MapPin,
  Truck,
  Bike
} from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DriverOnboarding = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    // Personal Information
    fullName: '',
    email: '',
    phone: '',
    address: {
      street: '',
      city: '',
      parish: '',
      country: 'Jamaica'
    },
    caribbeanIsland: '',
    dateOfBirth: '',
    emergencyContact: {
      name: '',
      phone: '',
      relationship: ''
    },
    
    // Vehicle Information
    vehicleType: '',
    vehicleMake: '',
    vehicleModel: '',
    vehicleYear: '',
    licensePlate: '',
    vehicleColor: '',
    hasCommercialInsurance: false,
    
    // Documents
    driversLicense: null,
    vehicleRegistration: null,
    insurance: null,
    profilePhoto: null,
    certificateOfCharacter: null,
    
    // Banking Information
    accountHolderName: '',
    bankName: '',
    accountNumber: '',
    routingNumber: '',
    accountType: ''
  });

  const caribbeanIslands = [
    'Jamaica', 'Barbados', 'Trinidad and Tobago', 'Bahamas', 'Cuba', 'Dominican Republic',
    'Haiti', 'Puerto Rico', 'Saint Lucia', 'Grenada', 'Saint Vincent and the Grenadines',
    'Antigua and Barbuda', 'Dominica', 'Saint Kitts and Nevis'
  ];

  const vehicleTypes = [
    { value: 'motorcycle', label: 'Motorcycle', icon: Bike, description: 'Fast delivery for small items' },
    { value: 'bicycle', label: 'Bicycle', icon: Bike, description: 'Eco-friendly city deliveries' },
    { value: 'car', label: 'Car', icon: Car, description: 'Standard vehicle for most deliveries' },
    { value: 'van', label: 'Van/Truck', icon: Truck, description: 'Large items and bulk deliveries' }
  ];

  const stepTitles = [
    'Personal Information',
    'Vehicle Information', 
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

  const requiredDocuments = [
    { key: 'driversLicense', label: "Driver's License" },
    { key: 'vehicleRegistration', label: 'Vehicle Registration' },
    { key: 'insurance', label: 'Insurance Certificate' },
    { key: 'certificateOfCharacter', label: 'Certificate of Character' },
    { key: 'profilePhoto', label: 'Profile Photo' }
  ];

  const getMissingDocuments = () =>
    requiredDocuments.filter(doc => !formData[doc.key]).map(doc => doc.label);

  const validateStep = (step) => {
    if (step === 3) {
      const missing = getMissingDocuments();
      if (missing.length > 0) {
        return `Please upload the following required document(s): ${missing.join(', ')}.`;
      }
    }
    return null;
  };

  const nextStep = () => {
    const error = validateStep(currentStep);
    if (error) {
      toast({ title: 'Missing Required Documents', description: error, variant: 'destructive' });
      return;
    }
    setCurrentStep(prev => Math.min(prev + 1, 5));
  };
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  const handleSubmit = async () => {
    const missing = getMissingDocuments();
    if (missing.length > 0) {
      toast({
        title: 'Cannot Submit — Documents Missing',
        description: `The following required document(s) must be uploaded: ${missing.join(', ')}.`,
        variant: 'destructive',
      });
      setCurrentStep(3);
      return;
    }
    try {
      const driverData = {
        license_number: formData.driversLicense?.name || 'DL-' + Date.now(),
        vehicle_type: formData.vehicleType,
        vehicle_plate: formData.licensePlate,
        personal_info: {
          full_name: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          caribbean_island: formData.caribbeanIsland,
          date_of_birth: formData.dateOfBirth,
          emergency_contact: formData.emergencyContact
        },
        vehicle_info: {
          make: formData.vehicleMake,
          model: formData.vehicleModel,
          year: formData.vehicleYear,
          color: formData.vehicleColor,
          has_commercial_insurance: formData.hasCommercialInsurance
        },
        banking_info: {
          account_holder_name: formData.accountHolderName,
          bank_name: formData.bankName,
          account_number: formData.accountNumber,
          routing_number: formData.routingNumber,
          account_type: formData.accountType
        }
      };

      await axios.post(`${API}/drivers`, driverData, {
        withCredentials: true
      });

      toast({
        title: "Driver Application Submitted!",
        description: "We'll review your application and get back to you within 24-48 hours.",
      });

      navigate('/dashboard');
    } catch (error) {
      console.error('Error submitting driver application:', error);
      toast({
        title: "Error",
        description: "Failed to submit application. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = (fileType, event) => {
    const file = event.target.files[0];
    if (file) {
      setFormData(prev => ({
        ...prev,
        [fileType]: file
      }));
    }
  };

  return (
    <div className="min-h-screen bg-matte-900 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-4">Become a Driver</h1>
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
            {/* Step 1: Personal Information */}
            {currentStep === 1 && (
              <div className="space-y-6" data-testid="personal-info-step">
                <div className="text-center mb-6">
                  <User className="h-12 w-12 text-gold-500 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-foreground mb-2">Personal Information</h3>
                  <p className="text-muted-foreground">Tell us about yourself</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="fullName">Full Name *</Label>
                    <Input
                      id="fullName"
                      value={formData.fullName}
                      onChange={(e) => handleInputChange('fullName', e.target.value)}
                      placeholder="Enter your full name"
                      data-testid="full-name-input"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      placeholder="your.email@example.com"
                      data-testid="email-input"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      placeholder="+1 (xxx) xxx-xxxx"
                      data-testid="phone-input"
                    />
                  </div>
                  <div>
                    <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                    <Input
                      id="dateOfBirth"
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                      data-testid="dob-input"
                    />
                  </div>
                  <div>
                    <Label htmlFor="caribbeanIsland">Caribbean Island *</Label>
                    <Select value={formData.caribbeanIsland} onValueChange={(value) => handleInputChange('caribbeanIsland', value)}>
                      <SelectTrigger data-testid="island-select">
                        <SelectValue placeholder="Select your island" />
                      </SelectTrigger>
                      <SelectContent>
                        {caribbeanIslands.map((island) => (
                          <SelectItem key={island} value={island}>
                            {island}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Address *</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <Input
                      placeholder="Street Address"
                      value={formData.address.street}
                      onChange={(e) => handleInputChange('address.street', e.target.value)}
                      data-testid="street-input"
                    />
                    <Input
                      placeholder="City"
                      value={formData.address.city}
                      onChange={(e) => handleInputChange('address.city', e.target.value)}
                      data-testid="city-input"
                    />
                    <Input
                      placeholder="Parish/State"
                      value={formData.address.parish}
                      onChange={(e) => handleInputChange('address.parish', e.target.value)}
                      data-testid="parish-input"
                    />
                  </div>
                </div>

                <div>
                  <Label>Emergency Contact</Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                    <Input
                      placeholder="Contact Name"
                      value={formData.emergencyContact.name}
                      onChange={(e) => handleInputChange('emergencyContact.name', e.target.value)}
                      data-testid="emergency-name-input"
                    />
                    <Input
                      placeholder="Phone Number"
                      value={formData.emergencyContact.phone}
                      onChange={(e) => handleInputChange('emergencyContact.phone', e.target.value)}
                      data-testid="emergency-phone-input"
                    />
                    <Input
                      placeholder="Relationship"
                      value={formData.emergencyContact.relationship}
                      onChange={(e) => handleInputChange('emergencyContact.relationship', e.target.value)}
                      data-testid="emergency-relationship-input"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Vehicle Information */}
            {currentStep === 2 && (
              <div className="space-y-6" data-testid="vehicle-info-step">
                <div className="text-center mb-6">
                  <Car className="h-12 w-12 text-gold-500 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-foreground mb-2">Vehicle Information</h3>
                  <p className="text-muted-foreground">Tell us about your delivery vehicle</p>
                </div>

                <div>
                  <Label>Vehicle Type *</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    {vehicleTypes.map((type) => {
                      const IconComponent = type.icon;
                      return (
                        <Card 
                          key={type.value}
                          className={`cursor-pointer transition-all duration-200 ${
                            formData.vehicleType === type.value 
                              ? 'border-gold-500/30 bg-gold-500/15' 
                              : 'hover:border-border'
                          }`}
                          onClick={() => handleInputChange('vehicleType', type.value)}
                          data-testid={`vehicle-type-${type.value}`}
                        >
                          <CardContent className="p-4 text-center">
                            <IconComponent className="h-8 w-8 text-gold-500 mx-auto mb-2" />
                            <h4 className="font-bold">{type.label}</h4>
                            <p className="text-sm text-muted-foreground mt-1">{type.description}</p>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <Label htmlFor="vehicleMake">Make *</Label>
                    <Input
                      id="vehicleMake"
                      value={formData.vehicleMake}
                      onChange={(e) => handleInputChange('vehicleMake', e.target.value)}
                      placeholder="e.g., Toyota"
                      data-testid="vehicle-make-input"
                    />
                  </div>
                  <div>
                    <Label htmlFor="vehicleModel">Model *</Label>
                    <Input
                      id="vehicleModel"
                      value={formData.vehicleModel}
                      onChange={(e) => handleInputChange('vehicleModel', e.target.value)}
                      placeholder="e.g., Corolla"
                      data-testid="vehicle-model-input"
                    />
                  </div>
                  <div>
                    <Label htmlFor="vehicleYear">Year *</Label>
                    <Input
                      id="vehicleYear"
                      type="number"
                      min="2000"
                      max="2025"
                      value={formData.vehicleYear}
                      onChange={(e) => handleInputChange('vehicleYear', e.target.value)}
                      placeholder="2020"
                      data-testid="vehicle-year-input"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="licensePlate">License Plate *</Label>
                    <Input
                      id="licensePlate"
                      value={formData.licensePlate}
                      onChange={(e) => handleInputChange('licensePlate', e.target.value.toUpperCase())}
                      placeholder="ABC-1234"
                      data-testid="license-plate-input"
                    />
                  </div>
                  <div>
                    <Label htmlFor="vehicleColor">Color</Label>
                    <Input
                      id="vehicleColor"
                      value={formData.vehicleColor}
                      onChange={(e) => handleInputChange('vehicleColor', e.target.value)}
                      placeholder="e.g., White"
                      data-testid="vehicle-color-input"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="commercialInsurance"
                    checked={formData.hasCommercialInsurance}
                    onChange={(e) => handleInputChange('hasCommercialInsurance', e.target.checked)}
                    data-testid="commercial-insurance-checkbox"
                  />
                  <Label htmlFor="commercialInsurance" className="text-sm">
                    I have commercial vehicle insurance
                  </Label>
                </div>
              </div>
            )}

            {/* Step 3: Documents Upload */}
            {currentStep === 3 && (
              <div className="space-y-6" data-testid="documents-step">
                <div className="text-center mb-6">
                  <FileText className="h-12 w-12 text-neon-cyan mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-foreground mb-2">Documents Upload</h3>
                  <p className="text-muted-foreground">Upload required documents for verification</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[
                    { key: 'driversLicense', label: "Driver's License *", testId: 'drivers-license-upload' },
                    { key: 'vehicleRegistration', label: 'Vehicle Registration *', testId: 'vehicle-registration-upload' },
                    { key: 'insurance', label: 'Insurance Certificate *', testId: 'insurance-upload' },
                    { key: 'certificateOfCharacter', label: 'Certificate of Character *', testId: 'certificate-of-character-upload', hint: 'Official police Certificate of Character / Good Conduct — required for all Caribbean drivers' },
                    { key: 'profilePhoto', label: 'Profile Photo *', testId: 'profile-photo-upload' }
                  ].map((doc) => (
                    <div key={doc.key}>
                      <Label>{doc.label}</Label>
                      {doc.hint && (
                        <p className="text-xs text-muted-foreground/80 mt-1">{doc.hint}</p>
                      )}
                      <div className="mt-2 border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-turquoise-400 transition-colors">
                        <Upload className="h-8 w-8 text-muted-foreground/70 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground mb-2">
                          {formData[doc.key] ? formData[doc.key].name : `Upload ${doc.label.replace(' *', '')}`}
                        </p>
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          className="hidden"
                          id={`${doc.key}Upload`}
                          onChange={(e) => handleFileUpload(doc.key, e)}
                          data-testid={doc.testId}
                        />
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => document.getElementById(`${doc.key}Upload`).click()}
                        >
                          Choose File
                        </Button>
                        {formData[doc.key] && (
                          <Badge variant="secondary" className="mt-2 block">
                            ✓ Uploaded
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4: Banking Information */}
            {currentStep === 4 && (
              <div className="space-y-6" data-testid="banking-step">
                <div className="text-center mb-6">
                  <CreditCard className="h-12 w-12 text-green-600 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-foreground mb-2">Banking Information</h3>
                  <p className="text-muted-foreground">Secure account details for receiving your earnings</p>
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
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-green-900 mb-1">Secure & Weekly Payouts</h4>
                      <p className="text-sm text-green-800">
                        Your earnings are deposited weekly, every Friday. Payments typically arrive within 1-2 business days.
                        All banking information is encrypted and stored securely.
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
                        <User className="h-5 w-5 mr-2" />
                        Personal Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div><strong>Name:</strong> {formData.fullName}</div>
                      <div><strong>Email:</strong> {formData.email}</div>
                      <div><strong>Phone:</strong> {formData.phone}</div>
                      <div><strong>Island:</strong> {formData.caribbeanIsland}</div>
                      <div><strong>Address:</strong> {formData.address.street}, {formData.address.city}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Car className="h-5 w-5 mr-2" />
                        Vehicle Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div><strong>Type:</strong> {formData.vehicleType}</div>
                      <div><strong>Vehicle:</strong> {formData.vehicleYear} {formData.vehicleMake} {formData.vehicleModel}</div>
                      <div><strong>License Plate:</strong> {formData.licensePlate}</div>
                      <div><strong>Color:</strong> {formData.vehicleColor}</div>
                      <div><strong>Commercial Insurance:</strong> {formData.hasCommercialInsurance ? 'Yes' : 'No'}</div>
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
                      <div>Driver&apos;s License: {formData.driversLicense ? '✓ Uploaded' : '✗ Missing'}</div>
                      <div>Vehicle Registration: {formData.vehicleRegistration ? '✓ Uploaded' : '✗ Missing'}</div>
                      <div>Insurance: {formData.insurance ? '✓ Uploaded' : '✗ Missing'}</div>
                      <div>Certificate of Character: {formData.certificateOfCharacter ? '✓ Uploaded' : '✗ Missing'}</div>
                      <div>Profile Photo: {formData.profilePhoto ? '✓ Uploaded' : '✗ Missing'}</div>
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
                  disabled={getMissingDocuments().length > 0}
                  className="bg-gradient-to-r from-green-500 to-emerald-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
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

export default DriverOnboarding;