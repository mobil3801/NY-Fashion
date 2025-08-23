
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import {
  TrendingUp, TrendingDown, ShoppingBag, Package, Users, AlertTriangle,
  DollarSign, BarChart3, PieChart, Calendar as CalendarIcon, RefreshCw,
  ArrowUpIcon, ArrowDownIcon } from
'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart as RechartsPieChart, Cell, BarChart, Bar, DonutChart } from
'recharts';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16', '#f97316'];

interface AnalyticsData {
  kpis: {
    todaySales: {
      total_revenue: number;
      transaction_count: number;
      avg_basket_value: number;
    };
    grossMargin: {
      revenue: number;
      cost: number;
      margin: number;
    };
    topProducts: Array<{
      name: string;
      id: number;
      total_qty: number;
      total_revenue: number;
    }>;
    topCategories: Array<{
      name: string;
      id: number;
      total_qty: number;
      total_revenue: number;
    }>;
    returns: Array<{
      return_count: number;
      total_sales: number;
      reason: string;
      reason_count: number;
    }>;
    employeeLeaderboard: Array<{
      employee_name: string;
      employee_id: number;
      transaction_count: number;
      total_sales: number;
      avg_sale_value: number;
    }>;
    lowStockAlerts: Array<{
      product_name: string;
      product_id: number;
      size: string;
      color: string;
      qty_on_hand: number;
      min_stock_level: number;
    }>;
  };
  charts: {
    paymentMethods: Array<{
      payment_method: string;
      transaction_count: number;
      total_amount: number;
    }>;
    salesTrend: Array<{
      sale_date: string;
      transaction_count: number;
      daily_revenue: number;
      avg_basket: number;
    }>;
    categoryBreakdown: Array<{
      category_name: string;
      category_revenue: number;
      transaction_count: number;
    }>;
    inventoryLevels: Array<{
      category_name: string;
      total_stock: number;
      product_count: number;
    }>;
  };
  comparison?: {
    previousSales: {
      total_revenue: number;
      transaction_count: number;
      avg_basket_value: number;
    };
  };
}

const DashboardPage: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('today');
  const [customDateRange, setCustomDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: undefined
  });
  const [autoRefresh, setAutoRefresh] = useState(true);

  const getDateRangeParams = () => {
    const now = new Date();

    switch (dateRange) {
      case 'today':
        return {
          startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
        };
      case 'thisWeek':
        return {
          startDate: startOfWeek(now),
          endDate: endOfWeek(now)
        };
      case 'thisMonth':
        return {
          startDate: startOfMonth(now),
          endDate: endOfMonth(now)
        };
      case 'custom':
        return {
          startDate: customDateRange.from || startOfMonth(now),
          endDate: customDateRange.to || endOfMonth(now)
        };
      default:
        return {
          startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
        };
    }
  };

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const dateParams = getDateRangeParams();

      const { data, error } = await window.ezsite.apis.run({
        path: 'getDashboardAnalytics',
        param: [dateParams, true] // Include previous period for comparison
      });

      if (error) {
        throw new Error(error);
      }

      setAnalyticsData(data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard analytics",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange, customDateRange]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchAnalytics();
      }, 30000); // Refresh every 30 seconds

      return () => clearInterval(interval);
    }
  }, [autoRefresh, dateRange, customDateRange]);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(cents / 100);
  };

  const calculatePercentageChange = (current: number, previous: number) => {
    if (previous === 0) return 0;
    return (current - previous) / previous * 100;
  };

  const renderKPICard = (title: string, value: string, change?: number, icon: React.ElementType, color: string) => {
    const IconComponent = icon;
    const isPositive = change && change >= 0;

    return (
      <Card className="rounded-3xl border-0 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">
            {title}
          </CardTitle>
          <div className={`p-2 rounded-2xl ${color.replace('text-', 'bg-').replace('-600', '-100')}`}>
            <IconComponent className={`w-4 h-4 ${color}`} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-900 mb-1">{value}</div>
          {change !== undefined &&
          <div className="flex items-center text-sm">
              {isPositive ?
            <ArrowUpIcon className="w-4 h-4 text-emerald-500 mr-1" /> :

            <ArrowDownIcon className="w-4 h-4 text-red-500 mr-1" />
            }
              <span className={isPositive ? 'text-emerald-600' : 'text-red-600'}>
                {Math.abs(change).toFixed(1)}%
              </span>
              <span className="text-gray-500 ml-1">vs previous period</span>
            </div>
          }
        </CardContent>
      </Card>);

  };

  if (loading && !analyticsData) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) =>
          <Card key={i} className="rounded-3xl border-0 shadow-sm animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>);

  }

  const salesChangePercent = analyticsData?.comparison?.previousSales ?
  calculatePercentageChange(
    analyticsData.kpis.todaySales.total_revenue,
    analyticsData.comparison.previousSales.total_revenue
  ) :
  undefined;

  const transactionChangePercent = analyticsData?.comparison?.previousSales ?
  calculatePercentageChange(
    analyticsData.kpis.todaySales.transaction_count,
    analyticsData.comparison.previousSales.transaction_count
  ) :
  undefined;

  const basketChangePercent = analyticsData?.comparison?.previousSales ?
  calculatePercentageChange(
    analyticsData.kpis.todaySales.avg_basket_value,
    analyticsData.comparison.previousSales.avg_basket_value
  ) :
  undefined;

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Welcome back, {user?.name}! Here's your business overview.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="thisWeek">This Week</SelectItem>
              <SelectItem value="thisMonth">This Month</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>

          {dateRange === 'custom' &&
          <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {customDateRange.from && customDateRange.to ?
                `${format(customDateRange.from, 'MMM dd')} - ${format(customDateRange.to, 'MMM dd')}` :
                'Select dates'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                mode="range"
                selected={{
                  from: customDateRange.from,
                  to: customDateRange.to
                }}
                onSelect={(range) => {
                  setCustomDateRange({
                    from: range?.from,
                    to: range?.to
                  });
                }}
                numberOfMonths={2} />

              </PopoverContent>
            </Popover>
          }

          <Button
            onClick={fetchAnalytics}
            variant="outline"
            size="sm"
            disabled={loading}
            className="flex items-center gap-2">

            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {renderKPICard(
          'Total Revenue',
          formatCurrency(analyticsData?.kpis.todaySales.total_revenue || 0),
          salesChangePercent,
          DollarSign,
          'text-emerald-600'
        )}
        {renderKPICard(
          'Transactions',
          (analyticsData?.kpis.todaySales.transaction_count || 0).toString(),
          transactionChangePercent,
          ShoppingBag,
          'text-blue-600'
        )}
        {renderKPICard(
          'Avg Basket Value',
          formatCurrency(analyticsData?.kpis.todaySales.avg_basket_value || 0),
          basketChangePercent,
          BarChart3,
          'text-purple-600'
        )}
        {renderKPICard(
          'Gross Margin',
          `${(analyticsData?.kpis.grossMargin.margin || 0).toFixed(1)}%`,
          undefined,
          TrendingUp,
          'text-orange-600'
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Trend Chart */}
        <Card className="rounded-3xl border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Sales Trend</CardTitle>
            <CardDescription>Daily revenue and transaction count</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analyticsData?.charts.salesTrend || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="sale_date"
                  tickFormatter={(date) => format(new Date(date), 'MMM dd')} />

                <YAxis yAxisId="revenue" orientation="left" tickFormatter={(value) => `$${(value / 100).toFixed(0)}`} />
                <YAxis yAxisId="count" orientation="right" />
                <Tooltip
                  formatter={(value, name) => {
                    if (name === 'daily_revenue') return [formatCurrency(value as number), 'Revenue'];
                    if (name === 'avg_basket') return [formatCurrency(value as number), 'Avg Basket'];
                    return [value, name];
                  }}
                  labelFormatter={(date) => format(new Date(date), 'MMM dd, yyyy')} />

                <Legend />
                <Line
                  yAxisId="revenue"
                  type="monotone"
                  dataKey="daily_revenue"
                  stroke="#10b981"
                  strokeWidth={3}
                  name="Revenue" />

                <Line
                  yAxisId="count"
                  type="monotone"
                  dataKey="transaction_count"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name="Transactions" />

              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category Revenue Breakdown */}
        <Card className="rounded-3xl border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Revenue by Category</CardTitle>
            <CardDescription>Sales distribution across product categories</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RechartsPieChart>
                <Pie
                  data={analyticsData?.charts.categoryBreakdown || []}
                  dataKey="category_revenue"
                  nameKey="category_name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ category_name, percent }) => `${category_name} ${(percent * 100).toFixed(0)}%`}>

                  {(analyticsData?.charts.categoryBreakdown || []).map((entry, index) =>
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  )}
                </Pie>
                <Tooltip formatter={(value) => [formatCurrency(value as number), 'Revenue']} />
              </RechartsPieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Employee Performance and Payment Methods */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Employee Leaderboard */}
        <Card className="rounded-3xl border-0 shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle>Employee Performance</CardTitle>
            <CardDescription>Top performing team members</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analyticsData?.kpis.employeeLeaderboard.slice(0, 8) || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="employee_name"
                  angle={-45}
                  textAnchor="end"
                  height={80} />

                <YAxis tickFormatter={(value) => formatCurrency(value)} />
                <Tooltip formatter={(value) => [formatCurrency(value as number), 'Total Sales']} />
                <Bar dataKey="total_sales" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Payment Methods Distribution */}
        <Card className="rounded-3xl border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Payment Methods</CardTitle>
            <CardDescription>Transaction distribution</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {analyticsData?.charts.paymentMethods.map((method, index) => {
              const total = analyticsData.charts.paymentMethods.reduce((sum, m) => sum + m.transaction_count, 0);
              const percentage = total > 0 ? method.transaction_count / total * 100 : 0;

              return (
                <div key={method.payment_method} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium capitalize">{method.payment_method}</span>
                    <div className="text-sm text-gray-600">
                      {method.transaction_count} ({percentage.toFixed(1)}%)
                    </div>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>);

            })}
          </CardContent>
        </Card>
      </div>

      {/* Additional Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Alerts */}
        <Card className="rounded-3xl border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Low Stock Alerts
            </CardTitle>
            <CardDescription>Products requiring attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {analyticsData?.kpis.lowStockAlerts.length ?
              analyticsData.kpis.lowStockAlerts.map((item, index) =>
              <div key={index} className="flex items-center justify-between p-3 bg-amber-50 rounded-2xl">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.product_name}</p>
                      {(item.size || item.color) &&
                  <p className="text-xs text-gray-600">
                          {[item.size, item.color].filter(Boolean).join(' - ')}
                        </p>
                  }
                    </div>
                    <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                      {item.qty_on_hand} left
                    </Badge>
                  </div>
              ) :

              <p className="text-gray-500 text-center py-8">No low stock alerts</p>
              }
            </div>
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card className="rounded-3xl border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Top Products</CardTitle>
            <CardDescription>Best selling items in selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {analyticsData?.kpis.topProducts.map((product, index) =>
              <div key={product.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{product.name}</p>
                      <p className="text-xs text-gray-600">{product.total_qty} units sold</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-sm">{formatCurrency(product.total_revenue)}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>);

};

export default DashboardPage;