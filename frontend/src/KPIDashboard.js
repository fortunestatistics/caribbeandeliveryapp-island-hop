/* eslint-disable react-hooks/set-state-in-effect, react-hooks/immutability */
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { useToast } from './hooks/use-toast';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Users, 
  DollarSign, 
  Star, 
  Truck, 
  Package,
  Target,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  PieChart,
  Calendar,
  Download,
  RefreshCw
} from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const KPIDashboard = () => {
  const [kpiData, setKpiData] = useState(null);
  const [dailyOps, setDailyOps] = useState(null);
  const [financialData, setFinancialData] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const { toast } = useToast();

  useEffect(() => {
    fetchKPIData();
    fetchDailyOperations();
    fetchFinancialSummary();
  }, [selectedDate]);

  const fetchKPIData = async () => {
    try {
      const response = await axios.get(`${API}/analytics/kpi-dashboard?date=${selectedDate}`);
      setKpiData(response.data);
    } catch (error) {
      console.error('Error fetching KPI data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch KPI data",
        variant: "destructive",
      });
    }
  };

  const fetchDailyOperations = async () => {
    try {
      const response = await axios.get(`${API}/analytics/daily-operations/${selectedDate}`);
      setDailyOps(response.data);
    } catch (error) {
      console.error('Error fetching daily operations:', error);
    }
  };

  const fetchFinancialSummary = async () => {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30); // Last 30 days
      
      const response = await axios.get(`${API}/analytics/financial-summary`, {
        params: {
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString()
        }
      });
      setFinancialData(response.data);
    } catch (error) {
      console.error('Error fetching financial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = () => {
    setLoading(true);
    fetchKPIData();
    fetchDailyOperations();
    fetchFinancialSummary();
  };

  const _tier = (value, goodAtOrAbove, warnAtOrAbove, descending = false) => {
    // For metrics where higher is better (default): >= good is green; >= warn is yellow; else red
    // For metrics where lower is better (descending=true): <= good is green; <= warn is yellow; else red
    const isGood = descending ? value <= goodAtOrAbove : value >= goodAtOrAbove;
    const isWarn = descending ? value <= warnAtOrAbove : value >= warnAtOrAbove;
    if (isGood) return 'text-green-600';
    if (isWarn) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getPerformanceColor = (value, type) => {
    switch (type) {
      case 'delivery_time':  // minutes — lower is better
        return _tier(value, 25, 35, true);
      case 'on_time_rate':   // % — higher is better
        return _tier(value, 95, 85);
      case 'satisfaction':   // 1-5 stars — higher is better
        return _tier(value, 4.5, 3.5);
      case 'profit_margin':  // % — higher is better
        return _tier(value, 25, 15);
      default:
        return 'text-muted-foreground';
    }
  };

  // Bg dot color for status indicators (green/gold/red)
  const _dotColor = (value, goodAtOrAbove, warnAtOrAbove) => {
    if (value >= goodAtOrAbove) return 'bg-green-500';
    if (value >= warnAtOrAbove) return 'bg-gold-500';
    return 'bg-red-500';
  };

  // Peak-hour rank colour (0 = highest peak, then descending)
  const _peakRankColor = (rank) => {
    if (rank === 0) return 'bg-red-500';
    if (rank === 1) return 'bg-gold-gradient';
    return 'bg-gold-500';
  };

  const getPerformanceIcon = (value, type) => {
    const isGood = getPerformanceColor(value, type).includes('green');
    return isGood ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-matte-900 py-12">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <RefreshCw className="h-12 w-12 animate-spin mx-auto mb-4 text-gold-500" />
            <h1 className="text-3xl font-bold text-foreground mb-4">Loading KPI Dashboard...</h1>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-matte-900 py-12">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">IslandHop Analytics</h1>
            <p className="text-muted-foreground">Comprehensive performance metrics and insights</p>
          </div>
          <div className="flex items-center space-x-4">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border rounded-lg"
              data-testid="date-selector"
            />
            <Button onClick={refreshData} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button className="bg-gold-gradient text-white">
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="operations">Daily Operations</TabsTrigger>
            <TabsTrigger value="drivers">Driver Performance</TabsTrigger>
            <TabsTrigger value="financial">Financial</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Key Performance Indicators */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Delivery Performance */}
              <Card className="bg-matte-800 border border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Avg Delivery Time</CardTitle>
                    <Clock className="h-4 w-4 text-gold-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className={`text-2xl font-bold ${getPerformanceColor(kpiData?.delivery_performance?.avg_delivery_time, 'delivery_time')}`}>
                      {kpiData?.delivery_performance?.avg_delivery_time || 0} min
                    </div>
                    <div className={getPerformanceColor(kpiData?.delivery_performance?.avg_delivery_time, 'delivery_time')}>
                      {getPerformanceIcon(kpiData?.delivery_performance?.avg_delivery_time, 'delivery_time')}
                    </div>
                  </div>
                  <Badge variant="secondary" className="mt-2">
                    Target: ≤25 min
                  </Badge>
                </CardContent>
              </Card>

              {/* On-Time Delivery Rate */}
              <Card className="bg-matte-800 border border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">On-Time Rate</CardTitle>
                    <Target className="h-4 w-4 text-gold-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className={`text-2xl font-bold ${getPerformanceColor(kpiData?.delivery_performance?.on_time_delivery_rate, 'on_time_rate')}`}>
                      {kpiData?.delivery_performance?.on_time_delivery_rate || 0}%
                    </div>
                    <div className={getPerformanceColor(kpiData?.delivery_performance?.on_time_delivery_rate, 'on_time_rate')}>
                      {getPerformanceIcon(kpiData?.delivery_performance?.on_time_delivery_rate, 'on_time_rate')}
                    </div>
                  </div>
                  <Badge variant="secondary" className="mt-2">
                    Target: ≥95%
                  </Badge>
                </CardContent>
              </Card>

              {/* Customer Satisfaction */}
              <Card className="bg-matte-800 border border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Customer Satisfaction</CardTitle>
                    <Star className="h-4 w-4 text-yellow-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className={`text-2xl font-bold ${getPerformanceColor(kpiData?.customer_satisfaction?.avg_rating, 'satisfaction')}`}>
                      {kpiData?.customer_satisfaction?.avg_rating || 0}/5
                    </div>
                    <div className={getPerformanceColor(kpiData?.customer_satisfaction?.avg_rating, 'satisfaction')}>
                      {getPerformanceIcon(kpiData?.customer_satisfaction?.avg_rating, 'satisfaction')}
                    </div>
                  </div>
                  <Badge variant="secondary" className="mt-2">
                    Target: ≥4.5
                  </Badge>
                </CardContent>
              </Card>

              {/* Order Completion Cost */}
              <Card className="bg-matte-800 border border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Cost Per Order</CardTitle>
                    <DollarSign className="h-4 w-4 text-green-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold text-foreground">
                      ${kpiData?.financial_metrics?.order_completion_cost || 0}
                    </div>
                    <div className="text-green-600">
                      <CheckCircle className="h-4 w-4" />
                    </div>
                  </div>
                  <Badge variant="secondary" className="mt-2">
                    Operational Cost
                  </Badge>
                </CardContent>
              </Card>
            </div>

            {/* Performance Summary Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Driver Performance Summary */}
              <Card className="bg-matte-800 border border-border">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Truck className="h-5 w-5 mr-2 text-gold-500" />
                    Driver Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Active Drivers</span>
                    <span className="font-semibold">{kpiData?.driver_performance?.active_drivers || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Average Rating</span>
                    <span className="font-semibold">{kpiData?.driver_performance?.avg_driver_rating || 0}/5</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Utilization Rate</span>
                    <span className="font-semibold">{kpiData?.driver_performance?.driver_utilization_rate || 0}%</span>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="flex items-center text-sm">
                      <div className={`w-2 h-2 rounded-full mr-2 ${_dotColor(kpiData?.driver_performance?.driver_utilization_rate || 0, 70, 50)}`}></div>
                      Driver Performance Status
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Order Summary */}
              <Card className="bg-matte-800 border border-border">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Package className="h-5 w-5 mr-2 text-gold-500" />
                    Order Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Orders</span>
                    <span className="font-semibold">{kpiData?.delivery_performance?.total_orders || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Completed</span>
                    <span className="font-semibold">{kpiData?.delivery_performance?.completed_orders || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Completion Rate</span>
                    <span className="font-semibold">{kpiData?.delivery_performance?.order_completion_rate || 0}%</span>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="flex items-center text-sm">
                      <div className={`w-2 h-2 rounded-full mr-2 ${_dotColor(kpiData?.delivery_performance?.order_completion_rate || 0, 95, 85)}`}></div>
                      Order Performance Status
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Financial Summary */}
              <Card className="bg-matte-800 border border-border">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <DollarSign className="h-5 w-5 mr-2 text-green-600" />
                    Financial Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Revenue Today</span>
                    <span className="font-semibold">${kpiData?.financial_metrics?.total_revenue || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Avg Order Value</span>
                    <span className="font-semibold">${kpiData?.financial_metrics?.avg_order_value || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Profit Margin</span>
                    <span className={`font-semibold ${getPerformanceColor(kpiData?.financial_metrics?.profit_margin, 'profit_margin')}`}>
                      {kpiData?.financial_metrics?.profit_margin || 0}%
                    </span>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="flex items-center text-sm">
                      <div className={`w-2 h-2 rounded-full mr-2 ${_dotColor(kpiData?.financial_metrics?.profit_margin || 0, 25, 15)}`}></div>
                      Financial Performance Status
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Daily Operations Tab */}
          <TabsContent value="operations" className="space-y-6">
            <Card className="bg-matte-800 border border-border">
              <CardHeader>
                <CardTitle>Daily Operations Log - {selectedDate}</CardTitle>
              </CardHeader>
              <CardContent>
                {dailyOps ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="text-center p-4 bg-gold-500/15 rounded-lg">
                        <div className="text-2xl font-bold text-gold-500">{dailyOps.summary.total_orders}</div>
                        <div className="text-sm text-muted-foreground">Total Orders</div>
                      </div>
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{dailyOps.summary.completed_orders}</div>
                        <div className="text-sm text-muted-foreground">Completed</div>
                      </div>
                      <div className="text-center p-4 bg-red-50 rounded-lg">
                        <div className="text-2xl font-bold text-red-600">{dailyOps.summary.cancelled_orders}</div>
                        <div className="text-sm text-muted-foreground">Cancelled</div>
                      </div>
                      <div className="text-center p-4 bg-matte-800/40 rounded-lg">
                        <div className="text-2xl font-bold text-gold-500">${dailyOps.summary.total_revenue}</div>
                        <div className="text-sm text-muted-foreground">Revenue</div>
                      </div>
                      <div className="text-center p-4 bg-purple-50 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">{dailyOps.summary.unique_customers}</div>
                        <div className="text-sm text-muted-foreground">Customers</div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold mb-4">Peak Hours</h3>
                      <div className="space-y-2">
                        {dailyOps.peak_hours.map((hour, index) => (
                          <div key={hour.hour} className="flex items-center justify-between p-3 bg-matte-700 rounded-lg">
                            <span className="font-medium">{hour.hour}:00 - {hour.hour + 1}:00</span>
                            <div className="flex items-center">
                              <span className="mr-2">{hour.orders} orders</span>
                              <div className={`w-2 h-2 rounded-full ${index === 0 ? 'bg-red-500' : index === 1 ? 'bg-gold-gradient' : 'bg-gold-500'}`}></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <BarChart3 className="h-16 w-16 text-muted-foreground/70 mx-auto mb-4" />
                    <p className="text-muted-foreground">No operations data available for {selectedDate}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Drivers Tab */}
          <TabsContent value="drivers" className="space-y-6">
            <Card className="bg-matte-800 border border-border">
              <CardHeader>
                <CardTitle>Driver Performance & Retention Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center p-6 bg-gradient-to-br from-matte-800 to-turquoise-100 rounded-xl">
                    <Truck className="h-12 w-12 text-gold-500 mx-auto mb-4" />
                    <div className="text-3xl font-bold text-gold-500 mb-2">
                      {kpiData?.driver_performance?.active_drivers || 0}
                    </div>
                    <div className="text-sm text-muted-foreground mb-2">Active Drivers Today</div>
                    <Badge variant="secondary">
                      {kpiData?.driver_performance?.driver_utilization_rate || 0}% Utilization
                    </Badge>
                  </div>

                  <div className="text-center p-6 bg-matte-800 rounded-xl">
                    <Star className="h-12 w-12 text-gold-500 mx-auto mb-4" />
                    <div className="text-3xl font-bold text-gold-500 mb-2">
                      {kpiData?.driver_performance?.avg_driver_rating || 0}/5
                    </div>
                    <div className="text-sm text-muted-foreground mb-2">Average Driver Rating</div>
                    <Badge variant="secondary">Customer Feedback</Badge>
                  </div>

                  <div className="text-center p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-xl">
                    <Users className="h-12 w-12 text-green-600 mx-auto mb-4" />
                    <div className="text-3xl font-bold text-green-600 mb-2">
                      {Math.round((kpiData?.driver_performance?.active_drivers / kpiData?.driver_performance?.total_drivers * 100) || 0)}%
                    </div>
                    <div className="text-sm text-muted-foreground mb-2">Driver Retention Rate</div>
                    <Badge variant="secondary">Monthly Average</Badge>
                  </div>
                </div>

                <div className="mt-8">
                  <h3 className="text-lg font-semibold mb-4">Driver KPIs</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <span className="font-medium">Average Earnings per Hour</span>
                      <span className="text-green-600 font-bold">$18.50</span>
                    </div>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <span className="font-medium">Driver Satisfaction Score</span>
                      <span className="text-gold-500 font-bold">4.2/5</span>
                    </div>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <span className="font-medium">Monthly Retention Rate</span>
                      <span className="text-gold-500 font-bold">89%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Financial Tab */}
          <TabsContent value="financial" className="space-y-6">
            <Card className="bg-matte-800 border border-border">
              <CardHeader>
                <CardTitle>Financial Performance (Last 30 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                {financialData ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="text-center p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-xl">
                        <DollarSign className="h-12 w-12 text-green-600 mx-auto mb-4" />
                        <div className="text-3xl font-bold text-green-600 mb-2">
                          ${financialData.revenue_breakdown.total_revenue}
                        </div>
                        <div className="text-sm text-muted-foreground">Total Revenue</div>
                      </div>

                      <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl">
                        <PieChart className="h-12 w-12 text-neon-cyan mx-auto mb-4" />
                        <div className="text-3xl font-bold text-neon-cyan mb-2">
                          ${financialData.profitability.net_profit}
                        </div>
                        <div className="text-sm text-muted-foreground">Net Profit</div>
                      </div>

                      <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl">
                        <Target className="h-12 w-12 text-purple-600 mx-auto mb-4" />
                        <div className={`text-3xl font-bold mb-2 ${getPerformanceColor(financialData.profitability.profit_margin, 'profit_margin')}`}>
                          {financialData.profitability.profit_margin}%
                        </div>
                        <div className="text-sm text-muted-foreground">Profit Margin</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-4">Revenue Breakdown</h3>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center p-3 bg-matte-700 rounded-lg">
                            <span>Food Sales</span>
                            <span className="font-semibold">${financialData.revenue_breakdown.subtotal_revenue}</span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-matte-700 rounded-lg">
                            <span>Delivery Fees</span>
                            <span className="font-semibold">${financialData.revenue_breakdown.delivery_fees}</span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-matte-700 rounded-lg">
                            <span>Tax Collected</span>
                            <span className="font-semibold">${financialData.revenue_breakdown.tax_collected}</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold mb-4">Cost Breakdown</h3>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                            <span>Driver Payouts</span>
                            <span className="font-semibold text-red-600">${financialData.cost_breakdown.driver_payouts}</span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                            <span>Payment Processing</span>
                            <span className="font-semibold text-red-600">${financialData.cost_breakdown.payment_processing}</span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                            <span>Operational Costs</span>
                            <span className="font-semibold text-red-600">${financialData.cost_breakdown.operational_costs}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-6">
                      <h3 className="text-lg font-semibold mb-4">Key Financial KPIs</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-4 bg-gold-500/15 rounded-lg">
                          <div className="text-xl font-bold text-gold-500">
                            ${financialData.profitability.avg_order_value}
                          </div>
                          <div className="text-sm text-muted-foreground">Avg Order Value</div>
                        </div>
                        <div className="text-center p-4 bg-matte-800/40 rounded-lg">
                          <div className="text-xl font-bold text-gold-500">
                            ${financialData.kpis.avg_order_completion_cost}
                          </div>
                          <div className="text-sm text-muted-foreground">Cost per Order</div>
                        </div>
                        <div className="text-center p-4 bg-green-50 rounded-lg">
                          <div className="text-xl font-bold text-green-600">
                            ${financialData.kpis.revenue_per_order}
                          </div>
                          <div className="text-sm text-muted-foreground">Revenue per Order</div>
                        </div>
                        <div className="text-center p-4 bg-purple-50 rounded-lg">
                          <div className="text-xl font-bold text-purple-600">
                            {financialData.kpis.total_orders}
                          </div>
                          <div className="text-sm text-muted-foreground">Total Orders</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <DollarSign className="h-16 w-16 text-muted-foreground/70 mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading financial data...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default KPIDashboard;
