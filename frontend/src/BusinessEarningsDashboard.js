import React, { useState } from 'react';
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
  ShoppingBag,
  PieChart,
  AlertCircle
} from 'lucide-react';

const BusinessEarningsDashboard = () => {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState('week');

  // Demo data - replace with API call
  const earningsData = {
    businessName: 'Island Spice Kitchen',
    businessType: 'Restaurant',
    currentBalance: 3456.80,
    pendingEarnings: 892.50,
    totalEarnings: 45890.25,
    weeklyRevenue: 4532.00,
    monthlyRevenue: 18456.80,
    totalOrders: 342,
    averageOrderValue: 68.50,
    
    // Commission structure
    commissionStructure: {
      platformCommission: 15, // percentage
      businessEarnings: 85, // percentage
      paymentProcessingFee: 2.9, // percentage + fixed
      paymentProcessingFixed: 0.30, // fixed per transaction
      description: 'You keep 85% of order value. IslandHop charges 15% commission + 2.9% + $0.30 payment processing fee'
    },
    
    lastPayout: {
      amount: 3200.00,
      date: '2024-10-13',
      status: 'Completed'
    },
    nextPayoutDate: '2024-10-20',
    
    // Recent orders
    recentOrders: [
      {
        id: 'ORD-1523',
        date: '2024-10-15 14:30',
        customer: 'John Doe',
        items: ['2x Jerk Chicken Plate', '2x Rice & Peas', '1x Fried Plantains'],
        orderSubtotal: 68.00,
        deliveryFee: 12.00,
        orderTotal: 80.00,
        platformCommission: -10.20,
        paymentProcessing: -2.29,
        yourEarnings: 57.51,
        status: 'Delivered'
      },
      {
        id: 'ORD-1522',
        date: '2024-10-15 12:15',
        customer: 'Jane Smith',
        items: ['1x Curry Goat', '1x Festival', '2x Ginger Beer'],
        orderSubtotal: 52.00,
        deliveryFee: 10.00,
        orderTotal: 62.00,
        platformCommission: -7.80,
        paymentProcessing: -1.81,
        yourEarnings: 44.19,
        status: 'Delivered'
      },
      {
        id: 'ORD-1521',
        date: '2024-10-15 11:00',
        customer: 'Mike Johnson',
        items: ['3x Beef Patty', '1x Coco Bread', '1x Sorrel Drink'],
        orderSubtotal: 28.00,
        deliveryFee: 8.00,
        orderTotal: 36.00,
        platformCommission: -4.20,
        paymentProcessing: -1.15,
        yourEarnings: 23.80,
        status: 'Delivered'
      },
      {
        id: 'ORD-1520',
        date: '2024-10-15 09:30',
        customer: 'Sarah Williams',
        items: ['2x Ackee & Saltfish', '2x Johnny Cakes', '1x Coffee'],
        orderSubtotal: 45.00,
        deliveryFee: 10.00,
        orderTotal: 55.00,
        platformCommission: -6.75,
        paymentProcessing: -1.69,
        yourEarnings: 38.25,
        status: 'Delivered'
      },
      {
        id: 'ORD-1519',
        date: '2024-10-14 19:45',
        customer: 'David Brown',
        items: ['1x Oxtail Dinner', '1x Callaloo', '2x Festival'],
        orderSubtotal: 85.00,
        deliveryFee: 12.00,
        orderTotal: 97.00,
        platformCommission: -12.75,
        paymentProcessing: -2.84,
        yourEarnings: 72.25,
        status: 'Processing',
        note: 'Payment processing - will be added to balance in 24-48h'
      }
    ]
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-turquoise-50 via-white to-orange-50 py-8">
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
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{earningsData.businessName}</h1>
              <p className="text-gray-600">Earnings & Payment Overview - {earningsData.businessType}</p>
            </div>
            <Button className="bg-gradient-to-r from-turquoise-500 to-orange-500 text-white">
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
              <p className="text-sm text-gray-600 mb-1">Current Balance</p>
              <h3 className="text-2xl font-bold text-gray-900">${earningsData.currentBalance.toFixed(2)}</h3>
              <Button 
                size="sm" 
                className="w-full mt-4 bg-gradient-to-r from-green-500 to-green-600 text-white"
                onClick={() => alert('Withdrawal feature coming soon!')}
              >
                Request Payout
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
                <Badge className="bg-yellow-100 text-yellow-700">Processing</Badge>
              </div>
              <p className="text-sm text-gray-600 mb-1">Pending Earnings</p>
              <h3 className="text-2xl font-bold text-gray-900">${earningsData.pendingEarnings.toFixed(2)}</h3>
              <p className="text-xs text-gray-500 mt-2">Available in 24-48 hours</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-turquoise-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-turquoise-600" />
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-1">Weekly Revenue</p>
              <h3 className="text-2xl font-bold text-gray-900">${earningsData.weeklyRevenue.toFixed(2)}</h3>
              <div className="flex items-center text-sm text-green-600 mt-2">
                <ArrowUpRight className="h-4 w-4 mr-1" />
                <span>+18% from last week</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <ShoppingBag className="h-6 w-6 text-orange-600" />
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-1">Total Orders</p>
              <h3 className="text-2xl font-bold text-gray-900">{earningsData.totalOrders}</h3>
              <p className="text-xs text-gray-500 mt-2">Avg: ${earningsData.averageOrderValue.toFixed(2)}/order</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Orders & Transactions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Commission Structure Info */}
            <Card className="border-2 border-turquoise-200 bg-turquoise-50/50">
              <CardHeader>
                <CardTitle className="flex items-center text-turquoise-900">
                  <Info className="h-5 w-5 mr-2" />
                  Revenue & Fee Structure
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-white rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">How Payments Are Split:</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                        <span className="text-gray-700">Your Revenue (from order subtotal)</span>
                      </div>
                      <span className="font-semibold text-green-600">{earningsData.commissionStructure.businessEarnings}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-orange-500 rounded-full mr-3"></div>
                        <span className="text-gray-700">Platform Commission</span>
                      </div>
                      <span className="font-semibold text-orange-600">{earningsData.commissionStructure.platformCommission}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-gray-500 rounded-full mr-3"></div>
                        <span className="text-gray-700">Payment Processing</span>
                      </div>
                      <span className="font-semibold text-gray-600">{earningsData.commissionStructure.paymentProcessingFee}% + ${earningsData.commissionStructure.paymentProcessingFixed}</span>
                    </div>
                  </div>
                  <Separator className="my-3" />
                  <div className="bg-blue-50 rounded p-3 space-y-1 text-sm">
                    <p className="font-semibold text-blue-900">Important Notes:</p>
                    <ul className="list-disc list-inside text-blue-800 space-y-1">
                      <li>Commission calculated on order subtotal only</li>
                      <li>Delivery fees go 100% to drivers</li>
                      <li>Customer tips go 100% to drivers</li>
                      <li>Payment processing covers card fees & security</li>
                    </ul>
                  </div>
                </div>

                {/* Example Calculation */}
                <div className="bg-gradient-to-r from-turquoise-500 to-orange-500 rounded-lg p-4 text-white">
                  <h4 className="font-semibold mb-2">Example Calculation:</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Order Subtotal:</span>
                      <span className="font-semibold">$68.00</span>
                    </div>
                    <div className="flex justify-between opacity-80">
                      <span>Delivery Fee (to driver):</span>
                      <span>$12.00</span>
                    </div>
                    <div className="flex justify-between opacity-80">
                      <span>Customer Tip (to driver):</span>
                      <span>$5.00</span>
                    </div>
                    <Separator className="my-2 opacity-50" />
                    <div className="flex justify-between">
                      <span>Your Share (85%):</span>
                      <span className="font-semibold">$57.80</span>
                    </div>
                    <div className="flex justify-between opacity-80">
                      <span>- Platform Commission (15%):</span>
                      <span>-$10.20</span>
                    </div>
                    <div className="flex justify-between opacity-80">
                      <span>- Payment Processing (2.9% + $0.30):</span>
                      <span>-$2.29</span>
                    </div>
                    <Separator className="my-2 opacity-50" />
                    <div className="flex justify-between text-base font-bold">
                      <span>You Receive:</span>
                      <span>$57.51</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Orders */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Recent Orders</span>
                  <div className="flex space-x-2">
                    {['week', 'month', 'all'].map((range) => (
                      <Button
                        key={range}
                        size="sm"
                        variant={timeRange === range ? 'default' : 'outline'}
                        onClick={() => setTimeRange(range)}
                        className={timeRange === range ? 'bg-gradient-to-r from-turquoise-500 to-orange-500 text-white' : ''}
                      >
                        {range === 'week' ? 'Week' : range === 'month' ? 'Month' : 'All'}
                      </Button>
                    ))}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {earningsData.recentOrders.map((order) => (
                    <div key={order.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="flex items-center space-x-2 mb-1">
                            <h4 className="font-semibold text-gray-900">{order.id}</h4>
                            <Badge className={order.status === 'Delivered' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                              {order.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600">{order.customer}</p>
                          <p className="text-xs text-gray-500">{order.date}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-green-600">+${order.yourEarnings.toFixed(2)}</p>
                          <p className="text-xs text-gray-500">Your Revenue</p>
                        </div>
                      </div>

                      {/* Order Items */}
                      <div className="mb-3">
                        <p className="text-sm font-semibold text-gray-700 mb-1">Items:</p>
                        <div className="flex flex-wrap gap-1">
                          {order.items.map((item, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {item}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Payment Breakdown */}
                      <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Order Subtotal:</span>
                          <span className="text-gray-900 font-semibold">${order.orderSubtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Delivery Fee (driver):</span>
                          <span className="text-gray-600">${order.deliveryFee.toFixed(2)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Platform Commission (15%):</span>
                          <span className="text-red-600">{order.platformCommission.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Payment Processing:</span>
                          <span className="text-red-600">{order.paymentProcessing.toFixed(2)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-semibold">
                          <span className="text-gray-900">Your Net Revenue:</span>
                          <span className="text-green-600">${order.yourEarnings.toFixed(2)}</span>
                        </div>
                      </div>

                      {order.note && (
                        <div className="mt-2 flex items-start space-x-2 text-xs text-yellow-700 bg-yellow-50 p-2 rounded">
                          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                          <span>{order.note}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Payout & Stats */}
          <div className="space-y-6">
            {/* Next Payout */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calendar className="h-5 w-5 mr-2 text-turquoise-600" />
                  Next Payout
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center p-4 bg-gradient-to-r from-turquoise-50 to-orange-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">Scheduled for</p>
                  <p className="text-xl font-bold text-gray-900">{earningsData.nextPayoutDate}</p>
                  <p className="text-sm text-gray-500 mt-2">Weekly automatic payout</p>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Payout Amount:</span>
                    <span className="font-semibold text-gray-900">${earningsData.currentBalance.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Payout Method:</span>
                    <span className="text-gray-900">Bank Transfer</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Processing Time:</span>
                    <span className="text-gray-900">2-3 business days</span>
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
                  <span className="text-gray-600">Amount:</span>
                  <span className="text-xl font-bold text-green-600">${earningsData.lastPayout.amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Date:</span>
                  <span className="text-sm text-gray-900">{earningsData.lastPayout.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Status:</span>
                  <Badge className="bg-green-100 text-green-700">{earningsData.lastPayout.status}</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Bank Account */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CreditCard className="h-5 w-5 mr-2 text-turquoise-600" />
                  Bank Account
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border rounded-lg p-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-r from-turquoise-500 to-orange-500 rounded-lg flex items-center justify-center">
                      <CreditCard className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Caribbean National Bank</p>
                      <p className="text-sm text-gray-600">****  **** 7891</p>
                    </div>
                  </div>
                </div>
                <Button variant="outline" className="w-full">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Update Banking Info
                </Button>
              </CardContent>
            </Card>

            {/* Revenue Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <PieChart className="h-5 w-5 mr-2 text-turquoise-600" />
                  Revenue Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total Revenue (All Time):</span>
                    <span className="font-semibold text-gray-900">${earningsData.totalEarnings.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">This Month:</span>
                    <span className="font-semibold text-gray-900">${earningsData.monthlyRevenue.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">This Week:</span>
                    <span className="font-semibold text-gray-900">${earningsData.weeklyRevenue.toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Average Order Value:</span>
                    <span className="font-semibold text-gray-900">${earningsData.averageOrderValue.toFixed(2)}</span>
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

export default BusinessEarningsDashboard;
