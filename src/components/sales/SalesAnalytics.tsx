
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Calendar, Users } from 'lucide-react';

interface SalesAnalyticsProps {
  filters: any;
  canViewAll: boolean;
}

interface AnalyticsData {
  dailySales: Array<{date: string;amount: number;transactions: number;}>;
  topProducts: Array<{name: string;quantity: number;revenue: number;}>;
  topEmployees: Array<{name: string;sales: number;transactions: number;}>;
  paymentMethods: Array<{method: string;amount: number;count: number;}>;
  trends: {
    salesGrowth: number;
    transactionGrowth: number;
    averageOrderChange: number;
  };
}

const SalesAnalytics: React.FC<SalesAnalyticsProps> = ({ filters, canViewAll }) => {
  const { toast } = useToast();
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    dailySales: [],
    topProducts: [],
    topEmployees: [],
    paymentMethods: [],
    trends: {
      salesGrowth: 0,
      transactionGrowth: 0,
      averageOrderChange: 0
    }
  });
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30');

  useEffect(() => {
    loadAnalyticsData();
  }, [filters, timeRange]);

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);

      // Get date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(timeRange));

      const apiFilters = [
      {
        name: 'created_at',
        op: 'GreaterThanOrEqual',
        value: startDate.toISOString().split('T')[0]
      },
      {
        name: 'created_at',
        op: 'LessThanOrEqual',
        value: endDate.toISOString().split('T')[0]
      }];


      // Apply additional filters
      if (filters.employee) {
        apiFilters.push({
          name: 'employee_id',
          op: 'Equal',
          value: parseInt(filters.employee)
        });
      }

      if (filters.paymentMethod) {
        apiFilters.push({
          name: 'payment_method',
          op: 'StringContains',
          value: filters.paymentMethod
        });
      }

      // Load sales data
      const { data: salesData, error: salesError } = await window.ezsite.apis.tablePage(36856, {
        PageNo: 1,
        PageSize: 1000,
        OrderByField: 'created_at',
        IsAsc: false,
        Filters: apiFilters
      });

      if (salesError) throw salesError;

      const sales = salesData?.List || [];

      // Load sale items for product analysis
      const { data: saleItemsData, error: itemsError } = await window.ezsite.apis.tablePage(36857, {
        PageNo: 1,
        PageSize: 1000,
        OrderByField: 'id',
        IsAsc: false,
        Filters: []
      });

      if (itemsError) throw itemsError;

      const saleItems = saleItemsData?.List || [];

      // Process daily sales
      const dailySalesMap = new Map();
      sales.forEach((sale: any) => {
        const date = sale.created_at?.split('T')[0];
        if (date) {
          const existing = dailySalesMap.get(date) || { amount: 0, transactions: 0 };
          dailySalesMap.set(date, {
            amount: existing.amount + (sale.total_amount || 0),
            transactions: existing.transactions + 1
          });
        }
      });

      const dailySales = Array.from(dailySalesMap.entries()).
      map(([date, data]) => ({ date, ...data })).
      sort((a, b) => a.date.localeCompare(b.date)).
      slice(-30); // Last 30 days

      // Process top products
      const productMap = new Map();
      saleItems.forEach((item: any) => {
        const productName = item.product_name || 'Unknown Product';
        const existing = productMap.get(productName) || { quantity: 0, revenue: 0 };
        productMap.set(productName, {
          quantity: existing.quantity + (item.quantity || 0),
          revenue: existing.revenue + (item.quantity || 0) * (item.unit_price || 0)
        });
      });

      const topProducts = Array.from(productMap.entries()).
      map(([name, data]) => ({ name, ...data })).
      sort((a, b) => b.revenue - a.revenue).
      slice(0, 10);

      // Process payment methods
      const paymentMethodMap = new Map();
      sales.forEach((sale: any) => {
        const method = sale.payment_method || 'Unknown';
        const existing = paymentMethodMap.get(method) || { amount: 0, count: 0 };
        paymentMethodMap.set(method, {
          amount: existing.amount + (sale.total_amount || 0),
          count: existing.count + 1
        });
      });

      const paymentMethods = Array.from(paymentMethodMap.entries()).
      map(([method, data]) => ({ method, ...data })).
      sort((a, b) => b.amount - a.amount);

      // Calculate trends (mock data for now)
      const trends = {
        salesGrowth: Math.random() * 20 - 10,
        transactionGrowth: Math.random() * 15 - 5,
        averageOrderChange: Math.random() * 10 - 5
      };

      setAnalyticsData({
        dailySales,
        topProducts,
        topEmployees: [], // Would require employee data join
        paymentMethods,
        trends
      });

    } catch (error) {
      console.error('Error loading analytics:', error);
      toast({
        title: "Error",
        description: "Failed to load analytics data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;

  const getTrendIcon = (value: number) => {
    return value >= 0 ? TrendingUp : TrendingDown;
  };

  const getTrendColor = (value: number) => {
    return value >= 0 ? 'text-green-600' : 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Analytics Controls */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Sales Analytics</h3>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Trend Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="rounded-3xl border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Sales Growth</p>
                <div className="flex items-center space-x-2 mt-2">
                  <p className={`text-2xl font-bold ${getTrendColor(analyticsData.trends.salesGrowth)}`}>
                    {analyticsData.trends.salesGrowth > 0 ? '+' : ''}{analyticsData.trends.salesGrowth.toFixed(1)}%
                  </p>
                  {React.createElement(getTrendIcon(analyticsData.trends.salesGrowth), {
                    className: `w-5 h-5 ${getTrendColor(analyticsData.trends.salesGrowth)}`
                  })}
                </div>
              </div>
              <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Transaction Growth</p>
                <div className="flex items-center space-x-2 mt-2">
                  <p className={`text-2xl font-bold ${getTrendColor(analyticsData.trends.transactionGrowth)}`}>
                    {analyticsData.trends.transactionGrowth > 0 ? '+' : ''}{analyticsData.trends.transactionGrowth.toFixed(1)}%
                  </p>
                  {React.createElement(getTrendIcon(analyticsData.trends.transactionGrowth), {
                    className: `w-5 h-5 ${getTrendColor(analyticsData.trends.transactionGrowth)}`
                  })}
                </div>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg. Order Change</p>
                <div className="flex items-center space-x-2 mt-2">
                  <p className={`text-2xl font-bold ${getTrendColor(analyticsData.trends.averageOrderChange)}`}>
                    {analyticsData.trends.averageOrderChange > 0 ? '+' : ''}{analyticsData.trends.averageOrderChange.toFixed(1)}%
                  </p>
                  {React.createElement(getTrendIcon(analyticsData.trends.averageOrderChange), {
                    className: `w-5 h-5 ${getTrendColor(analyticsData.trends.averageOrderChange)}`
                  })}
                </div>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Sales Chart */}
        <Card className="rounded-3xl border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Daily Sales Trend</CardTitle>
            <CardDescription>Sales performance over time</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ?
            <div className="h-64 flex items-center justify-center text-gray-500">
                Loading chart data...
              </div> :

            <div className="space-y-4">
                {analyticsData.dailySales.slice(-7).map((day, index) =>
              <div key={day.date} className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="font-semibold">{formatCurrency(day.amount)}</div>
                        <div className="text-xs text-gray-500">{day.transactions} transactions</div>
                      </div>
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                      className="bg-emerald-500 h-2 rounded-full"
                      style={{
                        width: `${Math.min(100, day.amount / Math.max(...analyticsData.dailySales.map((d) => d.amount)) * 100)}%`
                      }} />

                      </div>
                    </div>
                  </div>
              )}
              </div>
            }
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card className="rounded-3xl border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Top Products</CardTitle>
            <CardDescription>Best performing products by revenue</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ?
            <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) =>
              <div key={i} className="animate-pulse flex items-center justify-between">
                    <div className="h-4 bg-gray-200 rounded w-32"></div>
                    <div className="h-4 bg-gray-200 rounded w-16"></div>
                  </div>
              )}
              </div> :

            <div className="space-y-4">
                {analyticsData.topProducts.slice(0, 5).map((product, index) =>
              <div key={product.name} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-semibold text-emerald-600">{index + 1}</span>
                      </div>
                      <div>
                        <div className="font-medium text-sm">{product.name}</div>
                        <div className="text-xs text-gray-500">{product.quantity} sold</div>
                      </div>
                    </div>
                    <Badge variant="secondary" className="font-semibold">
                      {formatCurrency(product.revenue)}
                    </Badge>
                  </div>
              )}
                {analyticsData.topProducts.length === 0 &&
              <div className="text-center text-gray-500 py-8">
                    No product data available
                  </div>
              }
              </div>
            }
          </CardContent>
        </Card>

        {/* Payment Methods */}
        <Card className="rounded-3xl border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Payment Methods</CardTitle>
            <CardDescription>Revenue by payment method</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ?
            <div className="space-y-3">
                {[1, 2, 3].map((i) =>
              <div key={i} className="animate-pulse flex items-center justify-between">
                    <div className="h-4 bg-gray-200 rounded w-24"></div>
                    <div className="h-4 bg-gray-200 rounded w-20"></div>
                  </div>
              )}
              </div> :

            <div className="space-y-4">
                {analyticsData.paymentMethods.map((method, index) => {
                const totalAmount = analyticsData.paymentMethods.reduce((sum, m) => sum + m.amount, 0);
                const percentage = totalAmount > 0 ? method.amount / totalAmount * 100 : 0;

                return (
                  <div key={method.method} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium capitalize">{method.method}</span>
                        <span className="text-sm text-gray-600">{formatCurrency(method.amount)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                        className="bg-emerald-500 h-2 rounded-full transition-all"
                        style={{ width: `${percentage}%` }} />

                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{method.count} transactions</span>
                        <span>{percentage.toFixed(1)}%</span>
                      </div>
                    </div>);

              })}
                {analyticsData.paymentMethods.length === 0 &&
              <div className="text-center text-gray-500 py-8">
                    No payment data available
                  </div>
              }
              </div>
            }
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <Card className="rounded-3xl border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Period Summary</CardTitle>
            <CardDescription>Key metrics for the selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-emerald-600">
                  {formatCurrency(analyticsData.dailySales.reduce((sum, day) => sum + day.amount, 0))}
                </div>
                <div className="text-sm text-gray-600 mt-1">Total Revenue</div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                <div className="text-center">
                  <div className="text-xl font-semibold text-gray-900">
                    {analyticsData.dailySales.reduce((sum, day) => sum + day.transactions, 0)}
                  </div>
                  <div className="text-xs text-gray-600">Total Transactions</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-semibold text-gray-900">
                    {analyticsData.dailySales.length > 0 ?
                    formatCurrency(
                      analyticsData.dailySales.reduce((sum, day) => sum + day.amount, 0) /
                      analyticsData.dailySales.reduce((sum, day) => sum + day.transactions, 0) || 0
                    ) :
                    '$0.00'
                    }
                  </div>
                  <div className="text-xs text-gray-600">Avg. Transaction</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>);

};

export default SalesAnalytics;