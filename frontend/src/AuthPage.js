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
  Apple,
  Gift
} from 'lucide-react';
import { authAPI } from './services/api';
import OTPVerification from './OTPVerification';
import { Checkbox } from './components/ui/checkbox';
import { storeSession } from './authToken';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const MicrosoftIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 23 23" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="1" y="1" width="10" height="10" fill="#f25022" />
    <rect x="12" y="1" width="10" height="10" fill="#7fba00" />
    <rect x="1" y="12" width="10" height="10" fill="#00a4ef" />
    <rect x="12" y="12" width="10" height="10" fill="#ffb900" />
  </svg>
);

const AuthPage = ({ mode = 'login' }) => {
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState(mode); // 'login' or 'signup'
  const [showPassword, setShowPassword] = useState(false);
  const [otpStep, setOtpStep] = useState(false);
  const [verifiedOtp, setVerifiedOtp] = useState('');
  // Pre-fill referral code from `?ref=CODE` URL param
  const initialRef = (() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return (params.get('ref') || '').trim().toUpperCase();
    } catch (_e) { return ''; }
  })();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    address: '',
    referralCode: initialRef
  });
  const [authError, setAuthError] = useState('');
  const [smsConsent, setSmsConsent] = useState(false);

  const handleInputChange = (e) => {
    setAuthError('');
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
      // Phone verification first
      if (formData.phone && !verifiedOtp) {
        setOtpStep(true);
        return;
      }
    }

    try {
      if (authMode === 'login') {
        const response = await authAPI.login({
          email: formData.email,
          password: formData.password
        });
        
        // Save token and user
        localStorage.setItem('user', JSON.stringify(response.data.user));
        storeSession(response.data.access_token, response.data.user);
        
        // Full reload so AuthContext re-initializes from the new token
        // (SPA navigate() leaves stale auth state and bounces back to /login).
        window.location.href = '/dashboard';
      } else {
        const response = await authAPI.register({
          email: formData.email,
          password: formData.password,
          name: formData.name,
          phone: formData.phone,
          address: formData.address,
          user_type: 'customer',
          referral_code: formData.referralCode || undefined,
          otp_code: verifiedOtp || undefined,
          sms_consent: smsConsent
        });
        
        // Save token and user
        localStorage.setItem('user', JSON.stringify(response.data.user));
        storeSession(response.data.access_token, response.data.user);
        
        // Full reload so AuthContext re-initializes from the new token.
        window.location.href = '/dashboard';
      }
    } catch (error) {
      const detail = error.response?.data?.detail;
      const msg = typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((d) => (d && typeof d.msg === 'string' ? d.msg : '')).filter(Boolean).join(' ')
          : 'Authentication failed. Please try again.';
      setAuthError(msg);
      console.error('Auth error:', error);
    }
  };

  const handleOtpVerified = (code) => {
    setVerifiedOtp(code);
    setOtpStep(false);
    // Trigger the actual registration now that phone is verified
    setTimeout(() => {
      document.getElementById('auth-form-submit-btn')?.click();
    }, 50);
  };

  const handleSocialLogin = async (provider) => {
    if (provider === 'Google') {
      // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
      const redirectUrl = window.location.origin + '/auth/callback';
      window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
      return;
    }
    if (provider === 'Microsoft') {
      try {
        const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
        sessionStorage.setItem('ms_oauth_state', state);
        const redirectUri = window.location.origin + '/auth/microsoft/callback';
        const res = await axios.get(`${API}/auth/social/microsoft/login-url`, {
          params: { redirect_uri: redirectUri, state },
        });
        window.location.href = res.data.url;
      } catch (err) {
        const msg = err.response?.status === 503
          ? 'Microsoft sign-in is not available in this environment yet.'
          : 'Could not start Microsoft sign-in. Please try again.';
        alert(msg);
      }
      return;
    }
    alert(`${provider} login coming soon!`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br bg-background py-8">
      <div className="container mx-auto px-4 max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">
            <span className="text-transparent bg-clip-text bg-gold-gradient">
              IslandHop
            </span>
          </h1>
          <p className="text-muted-foreground">Caribbean Delivery</p>
        </div>

        {/* Auth Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-2xl">
              {authMode === 'login' ? 'Welcome Back!' : 'Create Account'}
            </CardTitle>
            <p className="text-center text-muted-foreground text-sm">
              {authMode === 'login' 
                ? 'Sign in to continue to IslandHop' 
                : 'Join IslandHop for fast Caribbean delivery'}
            </p>
          </CardHeader>
          <CardContent>
            {/* OTP Step */}
            {authMode === 'signup' && otpStep ? (
              <OTPVerification
                phone={formData.phone}
                purpose="signup"
                onVerified={handleOtpVerified}
                onCancel={() => setOtpStep(false)}
              />
            ) : (
            <>
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
                onClick={() => handleSocialLogin('Microsoft')}
                data-testid="microsoft-login-btn"
              >
                <MicrosoftIcon className="h-5 w-5 mr-2" />
                Continue with Microsoft
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
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-sm text-muted-foreground">
                or
              </span>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {authMode === 'signup' && (
                <div>
                  <Label htmlFor="name">Full Name</Label>
                  <div className="relative mt-1">
                    <User className="absolute left-3 top-3 h-5 w-5 text-muted-foreground/70" />
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
                  <Mail className="absolute left-3 top-3 h-5 w-5 text-muted-foreground/70" />
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
                    <Phone className="absolute left-3 top-3 h-5 w-5 text-muted-foreground/70" />
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
                  <p className="text-xs text-muted-foreground mt-1.5">
                    We use your number to send order &amp; account updates.
                  </p>
                </div>
              )}

              {authMode === 'signup' && (
                <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/30 p-3" data-testid="sms-consent-block">
                  <Checkbox
                    id="smsConsent"
                    checked={smsConsent}
                    onCheckedChange={(v) => setSmsConsent(v === true)}
                    className="mt-0.5"
                    data-testid="sms-consent-checkbox"
                  />
                  <Label htmlFor="smsConsent" className="text-xs font-normal leading-relaxed text-muted-foreground cursor-pointer" data-testid="sms-consent-text">
                    By checking this box, I agree to receive automated transactional SMS notifications from IslandHop Technologies LLC at the number provided. Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe, HELP for help. View our{' '}
                    <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-gold-500 hover:underline">Privacy Policy (https://islandhopapp.com/privacy-policy)</a>{' '}
                    and{' '}
                    <a href="/terms-and-conditions" target="_blank" rel="noopener noreferrer" className="text-gold-500 hover:underline">Terms (https://islandhopapp.com/terms-and-conditions)</a>.
                  </Label>
                </div>
              )}

              {authMode === 'signup' && (
                <div>
                  <Label htmlFor="address">Delivery Address</Label>
                  <div className="relative mt-1">
                    <MapPin className="absolute left-3 top-3 h-5 w-5 text-muted-foreground/70" />
                    <Input
                      id="address"
                      name="address"
                      type="text"
                      placeholder="123 Main Street, Kingston"
                      className="pl-10"
                      value={formData.address}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground/70" />
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
                    className="absolute right-3 top-3 text-muted-foreground/70 hover:text-muted-foreground"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {authMode === 'signup' && (
                <div>
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground/70" />
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

              {authMode === 'signup' && (
                <div>
                  <Label htmlFor="referralCode">Referral Code (optional)</Label>
                  <div className="relative mt-1">
                    <Gift className="absolute left-3 top-3 h-5 w-5 text-muted-foreground/70" />
                    <Input
                      id="referralCode"
                      name="referralCode"
                      type="text"
                      placeholder="ABCD1234"
                      className="pl-10 uppercase tracking-wider font-mono"
                      value={formData.referralCode}
                      onChange={handleInputChange}
                      data-testid="signup-referral-code-input"
                    />
                  </div>
                </div>
              )}

              {authMode === 'login' && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => navigate('/forgot-password')}
                    className="text-sm text-gold-500 hover:text-gold-300"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {authError && (
                <div
                  className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-sm text-red-300"
                  data-testid="auth-error-message"
                  role="alert"
                >
                  {authError}
                </div>
              )}


              <Button
                id="auth-form-submit-btn"
                data-testid="auth-form-submit-btn"
                type="submit"
                className="w-full bg-gold-gradient text-white"
              >
                {authMode === 'login' ? 'Sign In' : (verifiedOtp ? 'Create Account' : 'Continue')}
              </Button>
            </form>

            {/* Toggle Auth Mode */}
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                {authMode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                <button
                  onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                  className="text-gold-500 hover:text-gold-300 font-semibold"
                >
                  {authMode === 'login' ? 'Sign Up' : 'Sign In'}
                </button>
              </p>
            </div>

            {authMode === 'signup' && (
              <p className="mt-4 text-xs text-center text-muted-foreground">
                By creating an account, you agree to our{' '}
                <a href="/terms-and-conditions" className="text-gold-500 hover:underline">
                  Terms &amp; Conditions
                </a>{' '}
                and{' '}
                <a href="/privacy-policy" className="text-gold-500 hover:underline">
                  Privacy Policy
                </a>
              </p>
            )}
            </>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="text-muted-foreground"
          >
            ← Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
