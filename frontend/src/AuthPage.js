import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Separator } from './components/ui/separator';
import { 
  User, 
  Mail, 
  Lock, 
  Phone, 
  MapPin,
  Eye,
  EyeOff,
  Chrome,
  Apple
} from 'lucide-react';

const AuthPage = ({ mode = 'login' }) => {
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState(mode); // 'login' or 'signup'
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    address: ''
  });

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (authMode === 'signup') {
      if (formData.password !== formData.confirmPassword) {
        alert('Passwords do not match!');
        return;
      }
    }

    // API call would go here
    console.log('Form submitted:', formData);
    
    // For demo, just navigate to dashboard
    alert(authMode === 'login' ? 'Login successful!' : 'Account created successfully!');
    navigate('/dashboard');
  };

  const handleSocialLogin = (provider) => {
    alert(`${provider} login coming soon!`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-turquoise-50 via-white to-orange-50 py-8">
      <div className="container mx-auto px-4 max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-turquoise-600 to-orange-600">
              IslandHop
            </span>
          </h1>
          <p className="text-gray-600">Caribbean Delivery</p>
        </div>

        {/* Auth Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-2xl">
              {authMode === 'login' ? 'Welcome Back!' : 'Create Account'}
            </CardTitle>
            <p className="text-center text-gray-600 text-sm">
              {authMode === 'login' 
                ? 'Sign in to continue to IslandHop' 
                : 'Join IslandHop for fast Caribbean delivery'}
            </p>
          </CardHeader>
          <CardContent>
            {/* Social Login Buttons */}
            <div className="space-y-3 mb-6">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => handleSocialLogin('Google')}
              >
                <Chrome className="h-5 w-5 mr-2" />
                Continue with Google
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => handleSocialLogin('Apple')}
              >
                <Apple className="h-5 w-5 mr-2" />
                Continue with Apple
              </Button>
            </div>

            <div className="relative mb-6">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2 text-sm text-gray-500">
                or
              </span>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {authMode === 'signup' && (
                <div>
                  <Label htmlFor="name">Full Name</Label>
                  <div className="relative mt-1">
                    <User className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      placeholder="John Doe"
                      className="pl-10"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="email">Email Address</Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="john@example.com"
                    className="pl-10"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              {authMode === 'signup' && (
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="relative mt-1">
                    <Phone className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      placeholder="+1 (876) 555-1234"
                      className="pl-10"
                      value={formData.phone}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>
              )}

              {authMode === 'signup' && (
                <div>
                  <Label htmlFor="address">Delivery Address</Label>
                  <div className="relative mt-1">
                    <MapPin className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <Input
                      id="address"
                      name="address"
                      type="text"
                      placeholder="123 Main Street, Kingston"
                      className="pl-10"
                      value={formData.address}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="pl-10 pr-10"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {authMode === 'signup' && (
                <div>
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="pl-10"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>
              )}

              {authMode === 'login' && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => navigate('/forgot-password')}
                    className="text-sm text-turquoise-600 hover:text-turquoise-700"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-turquoise-500 to-orange-500 text-white"
              >
                {authMode === 'login' ? 'Sign In' : 'Create Account'}
              </Button>
            </form>

            {/* Toggle Auth Mode */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                {authMode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                <button
                  onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                  className="text-turquoise-600 hover:text-turquoise-700 font-semibold"
                >
                  {authMode === 'login' ? 'Sign Up' : 'Sign In'}
                </button>
              </p>
            </div>

            {authMode === 'signup' && (
              <p className="mt-4 text-xs text-center text-gray-500">
                By creating an account, you agree to our{' '}
                <a href="/terms" className="text-turquoise-600 hover:underline">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="/privacy" className="text-turquoise-600 hover:underline">
                  Privacy Policy
                </a>
              </p>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="text-gray-600"
          >
            ← Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
