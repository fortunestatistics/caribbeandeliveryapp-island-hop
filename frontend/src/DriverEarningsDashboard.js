import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { Separator } from './components/ui/separator';
import { 
  DollarSign, 
  TrendingUp, 
  Clock, 
  CheckCircle,
  Download,
  ArrowUpRight,
  Wallet,
  CreditCard,
  Calendar,
  Info,
  AlertCircle,
  PieChart
} from 'lucide-react';

const DriverEarningsDashboard = () => {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState('week');

  // Demo data - replace with API call
  const earningsData = {
    currentBalance: 1245.50,
    pendingEarnings: 325.75,
    totalEarnings: 15678.90,
    weeklyEarnings: 892.30,
    monthlyEarnings: 3456.80,
    completedDeliveries: 156,
    averageEarningPerDelivery: 8.45,
    lastPayout: {
      amount: 1180.00,
      date: '2024-10-13',
      status: 'Completed'
    },
    nextPayoutDate: '2024-10-20',
    
    // Fee breakdown structure (3-tier)
    feeStructure: {
      standardDeliveryShare: 80, // Standard (Free): 20% platform cut
      proDeliveryShare: 90,      // Pro ($700 TT/mo): 10% platform cut
      premiumDeliveryShare: 100, // Premium ($1,400 TT/mo): 0% platform cut
      tipShare: 100, // all drivers keep 100% of tips
      description: 'Standard (Free) drivers keep 80% (20% platform cut). Pro ($700 TT/mo) drivers keep 90% (10% cut). Premium ($1,400 TT/mo) drivers keep 100% (0% cut). All tiers keep 100% of tips. The flat $3.00 service fee is paid by the customer and never deducted from you.'
    },
    
    // Recent transactions
    recentTransactions: [
      {
        id: 'TXN-001',
        date: '2024-10-15 14:30',
        type: 'Food Delivery',
        customer: 'John Doe',
        orderTotal: 68.00,
        deliveryFee: 12.00,
        tip: 5.00,
        yourEarnings: 17.00,
        status: 'Completed'
      },
      {
        id: 'TXN-002',
        date: '2024-10-15 12:15',
        type: 'Grocery Delivery',
        customer: 'Jane Smith',
        orderTotal: 125.00,
        deliveryFee: 15.00,
        tip: 8.00,
        yourEarnings: 23.00,
        status: 'Completed'
      },
      {
        id: 'TXN-003',
        date: '2024-10-15 10:00',
        type: 'Taxi Ride',
        customer: 'Mike Johnson',
        orderTotal: 45.00,
        fare: 45.00,
        tip: 7.00,
        yourEarnings: 52.00,
        status: 'Completed'
      },
      {
        id: 'TXN-004',
        date: '2024-10-15 08:30',
        type: 'Pharmacy Delivery',
        customer: 'Sarah Williams',
        orderTotal: 85.00,
        deliveryFee: 10.00,
        tip: 3.00,
        yourEarnings: 13.00,
        status: 'Completed'
      },
      {
        id: 'TXN-005',
        date: '2024-10-14 19:45',
        type: 'Food Delivery',
        customer: 'David Brown',
        orderTotal: 92.00,
        deliveryFee: 14.00,
        tip: 10.00,
        yourEarnings: 24.00,
        status: 'Pending',
        note: 'Payment processing - will be added to balance in 24h'
      }
    ]
  };

  return (
    <div className="min-h-screen bg-gradient-to-br bg-background py-8">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/dashboard')}
            className="mb-4"
          >
            ← Back to Dashboard
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Driver Earnings</h1>
              <p className="text-muted-foreground">Track your earnings, fees, and payouts</p>
            </div>
            <Button className="bg-gold-gradient text-white">
              <Download className="h-4 w-4 mr-2" />
              Export Statement
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Wallet className="h-6 w-6 text-green-600" />
                </div>
                <Badge className="bg-green-100 text-green-700">Available</Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-1">Current Balance</p>
              <h3 className="text-2xl font-bold text-foreground">${earningsData.currentBalance.toFixed(2)}</h3>
              <Button 
                size="sm" 
                className="w-full mt-4 bg-gradient-to-r from-green-500 to-green-600 text-white"
                onClick={() => alert('Withdrawal feature coming soon!')}
              >
                Withdraw Funds
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gold-500/15 rounded-lg flex items-center justify-center">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
                <Badge className="bg-gold-500/15 text-yellow-700">Processing</Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-1">Pending Earnings</p>
              <h3 className="text-2xl font-bold text-foreground">${earningsData.pendingEarnings.toFixed(2)}</h3>
              <p className="text-xs text-muted-foreground mt-2">Available after 24h processing</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gold-500/15 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-gold-500" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-1">This Week</p>
              <h3 className="text-2xl font-bold text-foreground">${earningsData.weeklyEarnings.toFixed(2)}</h3>
              <div className="flex items-center text-sm text-green-600 mt-2">
                <ArrowUpRight className="h-4 w-4 mr-1" />
                <span>+12% from last week</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gold-500/15 rounded-lg flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-gold-500" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-1">Completed Deliveries</p>
              <h3 className="text-2xl font-bold text-foreground">{earningsData.completedDeliveries}</h3>
              <p className="text-xs text-muted-foreground mt-2">Avg: ${earningsData.averageEarningPerDelivery.toFixed(2)}/delivery</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Transactions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Fee Structure Info */}
            <Card className="border-2 border-gold-500/30 bg-gold-500/15/50">
              <CardHeader>
                <CardTitle className="flex items-center text-turquoise-900">
                  <Info className="h-5 w-5 mr-2" />
                  How Your Earnings Work
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-card rounded-lg p-4">
                  <h4 className="font-semibold text-foreground mb-3">Three subscription tiers:</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                    <div className="rounded-lg border border-matte-700 p-3" data-testid="tier-standard">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-2.5 h-2.5 bg-gray-400 rounded-full"></span>
                        <span className="font-semibold text-foreground">Standard</span>
                      </div>
                      <p className="text-xs text-gold-600 font-semibold mb-1">Free</p>
                      <p className="text-2xl font-bold text-green-600">80%</p>
                      <p className="text-xs text-muted-foreground">of delivery fees (20% platform cut) + 100% of tips.</p>
                    </div>
                    <div className="rounded-lg border-2 border-gold-500/40 bg-gold-500/10 p-3" data-testid="tier-pro">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-2.5 h-2.5 bg-gold-500 rounded-full"></span>
                        <span className="font-semibold text-foreground">Pro</span>
                      </div>
                      <p className="text-xs text-gold-600 font-semibold mb-1">TT$700/mo</p>
                      <p className="text-2xl font-bold text-green-600">90%</p>
                      <p className="text-xs text-muted-foreground">of delivery fees (10% platform cut) + 100% of tips.</p>
                    </div>
                    <div className="rounded-lg border-2 border-yellow-500/40 bg-yellow-500/10 p-3" data-testid="tier-premium">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-2.5 h-2.5 bg-yellow-500 rounded-full"></span>
                        <span className="font-semibold text-foreground">Premium</span>
                      </div>
                      <p className="text-xs text-gold-600 font-semibold mb-1">TT$1,400/mo</p>
                      <p className="text-2xl font-bold text-green-600">100%</p>
                      <p className="text-xs text-muted-foreground">of delivery fees (0% platform cut) + 100% of tips.</p>
                    </div>
                  </div>
                  <Separator className="my-3" />
                  <p className="text-sm text-muted-foreground italic">
                    {earningsData.feeStructure.description}
                  </p>
                </div>

                {/* Example Calculation */}
                <div className="bg-gold-gradient rounded-lg p-4 text-white">
                  <h4 className="font-semibold mb-2">Example: $12.00 delivery fee + $5.00 tip</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div data-testid="example-standard">
                      <p className="font-semibold mb-1 opacity-90">Standard</p>
                      <div className="flex justify-between opacity-90"><span>Delivery (80%):</span><span>$9.60</span></div>
                      <div className="flex justify-between opacity-90"><span>Tip (100%):</span><span>$5.00</span></div>
                      <Separator className="my-1.5 opacity-40" />
                      <div className="flex justify-between font-bold text-base"><span>You earn:</span><span>$14.60</span></div>
                    </div>
                    <div data-testid="example-pro">
                      <p className="font-semibold mb-1 opacity-90">Pro</p>
                      <div className="flex justify-between opacity-90"><span>Delivery (90%):</span><span>$10.80</span></div>
                      <div className="flex justify-between opacity-90"><span>Tip (100%):</span><span>$5.00</span></div>
                      <Separator className="my-1.5 opacity-40" />
                      <div className="flex justify-between font-bold text-base"><span>You earn:</span><span>$15.80</span></div>
                    </div>
                    <div data-testid="example-premium">
                      <p className="font-semibold mb-1 opacity-90">Premium</p>
                      <div className="flex justify-between opacity-90"><span>Delivery (100%):</span><span>$12.00</span></div>
                      <div className="flex justify-between opacity-90"><span>Tip (100%):</span><span>$5.00</span></div>
                      <Separator className="my-1.5 opacity-40" />
                      <div className="flex justify-between font-bold text-base"><span>You earn:</span><span>$17.00</span></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Transactions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Recent Transactions</span>
                  <div className="flex space-x-2">
                    {['week', 'month', 'all'].map((range) => (
                      <Button
                        key={range}
                        size="sm"
                        variant={timeRange === range ? 'default' : 'outline'}
                        onClick={() => setTimeRange(range)}
                        className={timeRange === range ? 'bg-gold-gradient text-white' : ''}
                      >
                        {range === 'week' ? 'Week' : range === 'month' ? 'Month' : 'All'}
                      </Button>
                    ))}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {earningsData.recentTransactions.map((transaction) => {
                    return (
                      <div key={transaction.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="flex items-center space-x-2 mb-1">
                              <h4 className="font-semibold text-foreground">{transaction.type}</h4>
                              <Badge className={transaction.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-gold-500/15 text-yellow-700'}>
                                {transaction.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{transaction.customer}</p>
                            <p className="text-xs text-muted-foreground">{transaction.date}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-green-600">+${transaction.yourEarnings.toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">Your Earnings</p>
                          </div>
                        </div>

                        {/* Detailed Breakdown */}
                        <div className="bg-background rounded-lg p-3 space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Order Total:</span>
                            <span className="text-foreground">${transaction.orderTotal.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{transaction.type === 'Taxi Ride' ? 'Fare:' : 'Delivery Fee:'}</span>
                            <span className="text-foreground">${(transaction.deliveryFee || transaction.fare).toFixed(2)}</span>
                          </div>
                          {transaction.tip > 0 && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Tip:</span>
                              <span className="text-green-600">+${transaction.tip.toFixed(2)}</span>
                            </div>
                          )}
                          <Separator />
                          <div className="flex justify-between font-semibold">
                            <span className="text-foreground">Net Earnings:</span>
                            <span className="text-green-600">${transaction.yourEarnings.toFixed(2)}</span>
                          </div>
                        </div>

                        {transaction.note && (
                          <div className="mt-2 flex items-start space-x-2 text-xs text-yellow-700 bg-gold-500/10 p-2 rounded">
                            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                            <span>{transaction.note}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Payout Info */}
          <div className="space-y-6">
            {/* Next Payout */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calendar className="h-5 w-5 mr-2 text-gold-500" />
                  Next Payout
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center p-4 bg-gold-gradient rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">Scheduled for</p>
                  <p className="text-xl font-bold text-foreground">{earningsData.nextPayoutDate}</p>
                  <p className="text-sm text-muted-foreground mt-2">Weekly automatic payout</p>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payout Amount:</span>
                    <span className="font-semibold text-foreground">${earningsData.currentBalance.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payout Method:</span>
                    <span className="text-foreground">Bank Transfer</span>
                  </div>
                </div>
                <Button variant="outline" className="w-full">
                  Update Payout Settings
                </Button>
              </CardContent>
            </Card>

            {/* Last Payout */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
                  Last Payout
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="text-xl font-bold text-green-600">${earningsData.lastPayout.amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Date:</span>
                  <span className="text-sm text-foreground">{earningsData.lastPayout.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <Badge className="bg-green-100 text-green-700">{earningsData.lastPayout.status}</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Payment Methods */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CreditCard className="h-5 w-5 mr-2 text-gold-500" />
                  Payment Method
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border rounded-lg p-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gold-gradient rounded-lg flex items-center justify-center">
                      <CreditCard className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Caribbean National Bank</p>
                      <p className="text-sm text-muted-foreground">****  **** 4532</p>
                    </div>
                  </div>
                </div>
                <Button variant="outline" className="w-full">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Update Banking Info
                </Button>
              </CardContent>
            </Card>

            {/* Earnings Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <PieChart className="h-5 w-5 mr-2 text-gold-500" />
                  Earnings Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Earned (All Time):</span>
                    <span className="font-semibold text-foreground">${earningsData.totalEarnings.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">This Month:</span>
                    <span className="font-semibold text-foreground">${earningsData.monthlyEarnings.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">This Week:</span>
                    <span className="font-semibold text-foreground">${earningsData.weeklyEarnings.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriverEarningsDashboard;
