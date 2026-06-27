import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { useCurrency, Price } from './CurrencyContext';
import { 
  Check, 
  X, 
  Zap,
  Crown,
  Shield,
  TrendingUp,
  Users,
  Star
} from 'lucide-react';

const SubscriptionPlans = () => {
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' or 'yearly'
  const [userType, setUserType] = useState('business'); // 'business' or 'driver'
  const { format } = useCurrency();

  const businessPlans = [
    {
      id: 'starter',
      name: 'Starter',
      icon: Zap,
      price: billingCycle === 'monthly' ? 29 : 290,
      description: 'Perfect for small businesses starting out',
      color: 'from-neon-cyan to-gold-500',
      features: [
        { name: 'Up to 50 orders/month', included: true },
        { name: '15% platform commission', included: true },
        { name: 'Basic analytics', included: true },
        { name: 'Email support', included: true },
        { name: 'Standard payout (weekly)', included: true },
        { name: 'Priority listing', included: false },
        { name: 'Advanced analytics', included: false },
        { name: 'Dedicated account manager', included: false }
      ],
      recommended: false
    },
    {
      id: 'professional',
      name: 'Professional',
      icon: Crown,
      price: billingCycle === 'monthly' ? 79 : 790,
      description: 'For growing businesses with higher volume',
      color: 'from-gold-300 to-orange-500',
      features: [
        { name: 'Up to 200 orders/month', included: true },
        { name: '12% platform commission', included: true },
        { name: 'Advanced analytics & reports', included: true },
        { name: 'Priority support (phone & email)', included: true },
        { name: 'Fast payout (2-3 days)', included: true },
        { name: 'Priority listing in search', included: true },
        { name: 'Marketing campaign support', included: true },
        { name: 'Dedicated account manager', included: false }
      ],
      recommended: true
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      icon: Shield,
      price: billingCycle === 'monthly' ? 199 : 1990,
      description: 'For established businesses at scale',
      color: 'from-purple-500 to-pink-500',
      features: [
        { name: 'Unlimited orders', included: true },
        { name: '10% platform commission', included: true },
        { name: 'Custom analytics dashboard', included: true },
        { name: '24/7 priority support', included: true },
        { name: 'Daily payout options', included: true },
        { name: 'Featured listing & promoted', included: true },
        { name: 'Full marketing suite access', included: true },
        { name: 'Dedicated account manager', included: true }
      ],
      recommended: false
    }
  ];

  const driverPlans = [
    {
      id: 'standard',
      name: 'Standard',
      icon: Users,
      price: 0,
      ttd: true,
      description: 'Free — start earning today',
      color: 'from-gray-500 to-gray-600',
      features: [
        { name: 'Keep 80% of every delivery fee', included: true },
        { name: '100% of tips', included: true },
        { name: 'Access to all delivery & taxi jobs', included: true },
        { name: 'Weekly automatic payouts', included: true },
        { name: 'Priority job matching', included: false },
        { name: 'Premium support', included: false }
      ],
      recommended: false
    },
    {
      id: 'pro',
      name: 'Pro',
      icon: Star,
      price: 700,
      ttd: true,
      description: 'Keep more of what you earn',
      color: 'from-gold-300 to-orange-500',
      features: [
        { name: 'Keep 90% of every delivery fee', included: true },
        { name: 'Only 10% platform cut on delivery fees', included: true },
        { name: '100% of tips', included: true },
        { name: 'Priority job matching', included: true },
        { name: 'Weekly automatic payouts', included: true },
        { name: 'Premium support', included: false }
      ],
      recommended: true
    },
    {
      id: 'premium',
      name: 'Premium',
      icon: Crown,
      price: 1400,
      ttd: true,
      description: 'Zero platform cut. Maximum earnings.',
      color: 'from-yellow-500 to-orange-500',
      features: [
        { name: 'Keep 100% of every delivery fee', included: true },
        { name: '0% platform cut on delivery fees', included: true },
        { name: '100% of tips', included: true },
        { name: 'Top priority job matching', included: true },
        { name: 'Premium support', included: true }
      ],
      recommended: false
    }
  ];

  const plans = userType === 'business' ? businessPlans : driverPlans;

  return (
    <div className="min-h-screen bg-gradient-to-br bg-background py-8">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Select the perfect plan to grow your business on IslandHop
          </p>

          {/* User Type Toggle */}
          <div className="inline-flex bg-card rounded-lg p-1 shadow-md mb-6">
            <button
              onClick={() => setUserType('business')}
              className={`px-6 py-2 rounded-md font-semibold transition-all ${
                userType === 'business'
                  ? 'bg-gold-gradient text-white'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Business Plans
            </button>
            <button
              onClick={() => setUserType('driver')}
              className={`px-6 py-2 rounded-md font-semibold transition-all ${
                userType === 'driver'
                  ? 'bg-gold-gradient text-white'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Driver Plans
            </button>
          </div>

          {/* Billing Cycle Toggle */}
          <div className="inline-flex bg-card rounded-lg p-1 shadow-md">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-6 py-2 rounded-md font-semibold transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-gray-900 text-white'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-6 py-2 rounded-md font-semibold transition-all ${
                billingCycle === 'yearly'
                  ? 'bg-gray-900 text-white'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Yearly
              <Badge className="ml-2 bg-green-500 text-white">Save 17%</Badge>
            </button>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`relative ${
                plan.recommended
                  ? 'border-4 border-gold-500/30 shadow-2xl transform scale-105'
                  : 'border border-border'
              }`}
            >
              {plan.recommended && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-gold-gradient text-white px-4 py-1 text-sm">
                    Most Popular
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center pb-8">
                <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-r ${plan.color} flex items-center justify-center`}>
                  <plan.icon className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-2xl mb-2">{plan.name}</CardTitle>
                <p className="text-muted-foreground text-sm mb-4">{plan.description}</p>
                <div className="mb-2">
                  <span className="text-5xl font-bold text-foreground">
                    {plan.price > 0
                      ? (plan.ttd ? <>TT${plan.price.toLocaleString()}</> : <Price usd={plan.price} decimals={0} />)
                      : (plan.ttd ? 'Free' : format(0, { decimals: 0 }))}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-muted-foreground">
                      /{billingCycle === 'monthly' || plan.ttd ? 'mo' : 'yr'}
                    </span>
                  )}
                </div>
                {billingCycle === 'yearly' && plan.price > 0 && !plan.ttd && (
                  <p className="text-sm text-green-600">
                    Save {format(plan.price / 10, { decimals: 0 })} per month
                  </p>
                )}
              </CardHeader>

              <CardContent>
                <Button
                  className={`w-full mb-6 ${
                    plan.recommended
                      ? 'bg-gold-gradient text-white'
                      : 'bg-gray-900 text-white'
                  }`}
                  onClick={() => {
                    if (userType === 'driver') {
                      navigate(plan.price === 0 ? '/driver-onboarding' : '/driver/subscription');
                    } else if (plan.price === 0) {
                      navigate('/restaurant-onboarding');
                    } else {
                      alert('Subscription checkout coming soon!');
                    }
                  }}
                >
                  {userType === 'driver'
                    ? (plan.price === 0 ? 'Get Started Free' : `Upgrade to ${plan.name}`)
                    : (plan.price === 0 ? 'Get Started Free' : 'Start Free Trial')}
                </Button>

                <div className="space-y-3">
                  {plan.features.map((feature) => (
                    <div key={feature.name || feature.title || feature.description} className="flex items-start">
                      <div className={`flex-shrink-0 mt-0.5 ${
                        feature.included ? 'text-green-600' : 'text-gray-300'
                      }`}>
                        {feature.included ? (
                          <Check className="h-5 w-5" />
                        ) : (
                          <X className="h-5 w-5" />
                        )}
                      </div>
                      <span className={`ml-3 text-sm ${
                        feature.included ? 'text-foreground' : 'text-muted-foreground/70'
                      }`}>
                        {feature.name}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* FAQ/Additional Info */}
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-center">What&apos;s Included in All Plans?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 bg-gold-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Check className="h-5 w-5 text-gold-500" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-1">Secure Payments</h4>
                  <p className="text-sm text-muted-foreground">All transactions secured with industry-standard encryption</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 bg-gold-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Check className="h-5 w-5 text-gold-500" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-1">Real-time Tracking</h4>
                  <p className="text-sm text-muted-foreground">Live order tracking and customer communication</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 bg-gold-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Check className="h-5 w-5 text-gold-500" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-1">No Setup Fees</h4>
                  <p className="text-sm text-muted-foreground">Start earning immediately with no hidden costs</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 bg-gold-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Check className="h-5 w-5 text-gold-500" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-1">Cancel Anytime</h4>
                  <p className="text-sm text-muted-foreground">No long-term contracts or cancellation fees</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-12 text-center">
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

export default SubscriptionPlans;
