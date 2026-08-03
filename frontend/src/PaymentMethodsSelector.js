import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Badge } from './components/ui/badge';
import { 
  CreditCard, 
  Smartphone, 
  DollarSign,
  Check,
  AlertCircle
} from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
<<<<<<< HEAD
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
// Fetch the mode-aware publishable key from the backend at runtime (falls back to the
// build-time env var) so live mode works without a frontend rebuild.
const fallbackKey = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;
let _stripePromise = null;
const getStripe = async () => {
  if (_stripePromise) return _stripePromise;
  let key = fallbackKey;
  try {
    const r = await axios.get(`${API}/stripe/config`);
    if (r.data && r.data.publishable_key) key = r.data.publishable_key;
  } catch (e) { /* use fallback */ }
  _stripePromise = key ? loadStripe(key) : Promise.resolve(null);
  return _stripePromise;
};
=======

const STRIPE_API_KEY = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;
const stripePromise = STRIPE_API_KEY ? loadStripe(STRIPE_API_KEY) : Promise.resolve(null);
>>>>>>> cb805eb

const PaymentMethodsSelector = ({ onPaymentMethodSelected, amount }) => {
  const [selectedMethod, setSelectedMethod] = useState('card');
  const [showStripeForm, setShowStripeForm] = useState(false);
<<<<<<< HEAD
  const [stripePromise, setStripePromise] = useState(null);

  useEffect(() => {
    let mounted = true;
    getStripe().then((p) => { if (mounted) setStripePromise(p); });
    return () => { mounted = false; };
  }, []);
=======
>>>>>>> cb805eb
  
  const paymentMethods = [
    {
      id: 'card',
      name: 'Credit/Debit Card',
      icon: CreditCard,
      description: 'Visa, Mastercard, Amex',
      enabled: true
    },
    {
      id: 'apple_pay',
      name: 'Apple Pay',
      icon: Smartphone,
      description: 'Fast & secure',
      enabled: true
    },
    {
      id: 'google_pay',
      name: 'Google Pay',
      icon: Smartphone,
      description: 'One-tap payment',
      enabled: true
    },
    {
      id: 'paypal',
      name: 'PayPal',
      icon: DollarSign,
      description: 'Pay with PayPal balance',
      enabled: true
    },
    {
      id: 'cash',
      name: 'Cash on Delivery',
      icon: DollarSign,
      description: 'Pay when you receive',
      enabled: true
    }
  ];

  const handleMethodSelect = (method) => {
    setSelectedMethod(method.id);
    
    if (method.id === 'card' || method.id === 'apple_pay' || method.id === 'google_pay') {
      setShowStripeForm(true);
    } else {
      setShowStripeForm(false);
      onPaymentMethodSelected({ method: method.id });
    }
  };

  return (
    <div className="space-y-6">
      {/* Payment Method Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {paymentMethods.map((method) => {
          const Icon = method.icon;
          return (
            <button
              key={method.id}
              onClick={() => method.enabled && handleMethodSelect(method)}
              disabled={!method.enabled}
              className={`
                relative p-4 rounded-lg border-2 text-left transition-all
                ${selectedMethod === method.id 
                  ? 'border-gold-500/30 bg-gold-500/15' 
                  : 'border-border hover:border-border'
                }
                ${!method.enabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {selectedMethod === method.id && (
                <div className="absolute top-2 right-2">
                  <div className="bg-gold-500/15 rounded-full p-1">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                </div>
              )}
              
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  <Icon className="h-6 w-6 text-foreground/90" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-foreground flex items-center gap-2">
                    {method.name}
                    {method.comingSoon && (
                      <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{method.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Stripe Payment Form */}
      {showStripeForm && (
        <Card>
          <CardHeader>
            <CardTitle>Payment Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Elements stripe={stripePromise}>
              <StripePaymentForm 
                amount={amount}
                selectedMethod={selectedMethod}
                onSuccess={(paymentDetails) => {
                  onPaymentMethodSelected({
                    method: selectedMethod,
                    ...paymentDetails
                  });
                }}
              />
            </Elements>
          </CardContent>
        </Card>
      )}

      {/* Security Notice */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-neon-cyan/10 p-3 rounded-lg">
        <AlertCircle className="h-5 w-5 text-teal-700" />
        <p>
          Your payment information is encrypted and secure. We never store your card details.
        </p>
      </div>
    </div>
  );
};

// Stripe Payment Form Component
const StripePaymentForm = ({ amount, selectedMethod, onSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // In a real app, you would:
      // 1. Create payment intent on backend
      // 2. Confirm payment with Stripe
      // 3. Handle success/failure

      // For now, simulate success
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setSucceeded(true);
      onSuccess({
        payment_method: selectedMethod,
        payment_status: 'paid'
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  if (succeeded) {
    return (
      <div className="text-center py-8">
        <div className="mb-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <Check className="h-8 w-8 text-green-600" />
          </div>
        </div>
        <h3 className="text-xl font-bold text-foreground mb-2">Payment Successful!</h3>
        <p className="text-muted-foreground">Your order has been placed.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Amount Display */}
      <div className="bg-background p-4 rounded-lg mb-4">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Total Amount</span>
          <span className="text-2xl font-bold text-foreground">${amount?.toFixed(2)}</span>
        </div>
      </div>

      {/* Payment Method Specific Info */}
      {selectedMethod === 'apple_pay' && (
        <div className="bg-gray-900 text-white p-4 rounded-lg flex items-center justify-center gap-3">
          <Smartphone className="h-5 w-5" />
          <span className="font-medium">Pay with Apple Pay</span>
        </div>
      )}

      {selectedMethod === 'google_pay' && (
        <div className="bg-card border-2 border-border p-4 rounded-lg flex items-center justify-center gap-3">
          <Smartphone className="h-5 w-5" />
          <span className="font-medium">Pay with Google Pay</span>
        </div>
      )}

      {selectedMethod === 'card' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Card Number</label>
            <Input placeholder="1234 5678 9012 3456" />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Expiry Date</label>
              <Input placeholder="MM/YY" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">CVC</label>
              <Input placeholder="123" type="password" maxLength={4} />
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      <Button 
        type="submit" 
        className="w-full"
        disabled={!stripe || processing}
      >
        {processing ? (
          <span className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            Processing...
          </span>
        ) : (
          `Pay $${amount?.toFixed(2)}`
        )}
      </Button>
    </form>
  );
};

export default PaymentMethodsSelector;
