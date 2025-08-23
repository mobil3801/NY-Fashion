import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { RetryBanner } from '@/components/ui/retry-banner';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { useApiRetry, type RetryContext } from '@/hooks/use-api-retry';
import { normalizeError, getUserFriendlyMessage, logApiEvent, type ApiError } from '@/lib/errors';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  TrendingUp, TrendingDown, ShoppingBag, Package, Users, AlertTriangle,
  DollarSign, BarChart3, PieChart, Calendar as CalendarIcon, RefreshCw,
  ArrowUpIcon, ArrowDownIcon, Menu, X
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart as RechartsPieChart, Pie, Cell, BarChart, Bar
} from 'recharts';
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
  const isMobile = useIsMobile();

  // State management
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [currentAttempt, setCurrentAttempt] = useState(1);

  // Mobile state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Filter state
  const [dateRange, setDateRange] = useState('today');
  const [customDateRange, setCustomDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: undefined
  });
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Request management
  const currentRequestIdRef = useRef(0);
  const isMountedRef = useRef(true);
  const autoRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // API retry hook
  const { executeWithRetry, abortAll } = useApiRetry();

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      abortAll();
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current);
      }
    };
  }, [abortAll]);

  // Helper to generate and track request IDs
  const getNextRequestId = useCallback(() => {
    return ++currentRequestIdRef.current;
  }, []);

  // Helper to check if response is still valid
  const isValidResponse = useCallback((requestId: number) => {
    return isMountedRef.current && requestId === currentRequestIdRef.current;
  }, []);

  // Get date range parameters
  const getDateRangeParams = useCallback(() => {
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
  }, [dateRange, customDateRange]);

  // Fetch analytics with improved error handling
  const fetchAnalytics = useCallback(async (isManualRefresh = false) => {
    if (!isMountedRef.current) return;

    const requestId = getNextRequestId();
    setLoading(true);
    setCurrentAttempt(1);

    // Clear error on manual refresh
    if (isManualRefresh) {
      setError(null);
      setIsRetrying(false);
    }

    try {
      const result = await executeWithRetry(
        async (ctx: RetryContext) => {
          // Check if request is still valid before proceeding
          if (!isValidResponse(requestId)) {
            throw new Error('Request cancelled - component unmounted or new request started');
          }

          const dateParams = getDateRangeParams();

          const { data, error: apiError } = await window.ezsite.apis.run({
            path: 'getDashboardAnalytics',
            param: [dateParams, true] // Include previous period for comparison
          });

          if (apiError) {
            throw new Error(typeof apiError === 'string' ? apiError : 'Failed to fetch analytics data');
          }

          return data;
        },
        {
          attempts: 3,
          baseDelayMs: 500,
          maxDelayMs: 8000,
          onAttempt: ({ attempt, error }) => {
            if (!isMountedRef.current) return;

            setCurrentAttempt(attempt);
            setIsRetrying(attempt > 1);

            if (error) {
              logApiEvent({
                operation: 'fetchDashboardAnalytics',
                attempt,
                retryable: attempt < 3,
                message: error.message,
                error
              });
            }
          },
          onGiveUp: (error) => {
            if (!isMountedRef.current) return;

            const normalizedError = normalizeError(error, 'fetchDashboardAnalytics');
            setError(normalizedError);
            setIsRetrying(false);

            // Only show toast for critical errors, not business logic errors
            if (normalizedError.code !== 'VALIDATION_ERROR' && normalizedError.retryable) {
              toast({
                title: 'Analytics Unavailable',
                description: getUserFriendlyMessage(error),
                variant: 'destructive'
              });
            }
          }
        }
      );

      // Process successful response
      if (isValidResponse(requestId)) {
        setError(null);
        setIsRetrying(false);
        setCurrentAttempt(1);

        // Validate and set analytics data
        if (result && typeof result === 'object' && result.kpis && result.charts) {
          setAnalyticsData(result);
        } else {
          console.warn('Invalid analytics data structure received');
          // Set empty data structure instead of showing error
          setAnalyticsData({
            kpis: {
              todaySales: { total_revenue: 0, transaction_count: 0, avg_basket_value: 0 },
              grossMargin: { revenue: 0, cost: 0, margin: 0 },
              topProducts: [],
              topCategories: [],
              returns: [],
              employeeLeaderboard: [],
              lowStockAlerts: []
            },
            charts: {
              paymentMethods: [],
              salesTrend: [],
              categoryBreakdown: [],
              inventoryLevels: []
            }
          });
        }
      }

    } catch (error) {
      if (!isValidResponse(requestId)) {
        // Request was cancelled or component unmounted
        return;
      }

      const normalizedError = normalizeError(error, 'fetchDashboardAnalytics');
      setError(normalizedError);
      setIsRetrying(false);

      // Set empty analytics data to prevent UI issues
      setAnalyticsData({
        kpis: {
          todaySales: { total_revenue: 0, transaction_count: 0, avg_basket_value: 0 },
          grossMargin: { revenue: 0, cost: 0, margin: 0 },
          topProducts: [],
          topCategories: [],
          returns: [],
          employeeLeaderboard: [],
          lowStockAlerts: []
        },
        charts: {
          paymentMethods: [],
          salesTrend: [],
          categoryBreakdown: [],
          inventoryLevels: []
        }
      });
    } finally {
      if (isValidResponse(requestId)) {
        setLoading(false);
      }
    }
  }, [executeWithRetry, getNextRequestId, isValidResponse, getDateRangeParams]);

  // Manual retry function
  const handleRetry = useCallback(() => {
    setError(null);
    setIsRetrying(false);
    fetchAnalytics(true);
  }, [fetchAnalytics]);

  // Clear error function
  const handleClearError = useCallback(() => {
    setError(null);
    setIsRetrying(false);
  }, []);

  // Set client-side rendering flag
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Fetch analytics when component mounts or filters change
  useEffect(() => {
    if (isClient) {
      fetchAnalytics(true); // Force refresh on filter change
    }
  }, [isClient, dateRange, customDateRange, fetchAnalytics]);

  // Helper functions
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
      <Card className="rounded-lg border-0 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700">
            {title}
          </CardTitle>
          <div className={`p-2 rounded-lg ${color.replace('text-', 'bg-').replace('-600', '-100')}`}>
            <IconComponent className={`w-4 h-4 ${color}`} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">{value}</div>
          {change !== undefined && (
            <div className="flex items-center text-sm">
              {isPositive ? (
                <ArrowUpIcon className="w-4 h-4 text-emerald-500 mr-1" />
              ) : (
                <ArrowDownIcon className="w-4 h-4 text-red-500 mr-1" />
              )}
              <span className={isPositive ? 'text-emerald-600' : 'text-red-600'}>
                {Math.abs(change).toFixed(1)}%
              </span>
              <span className="text-gray-600 ml-1">vs previous</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Show loading state while client-side hydration is happening or data is loading
  if (!isClient || (loading && !analyticsData)) {
    return (
      <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
        </div>
        <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'}`}>
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="rounded-lg border-0 shadow-sm animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-300 rounded w-1/2 mb-4"></div>
                <div className="h-8 bg-gray-300 rounded w-3/4"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Calculate percentage changes for KPIs
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
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      {/* Error Banner - Only show for significant errors */}
      {error && error.code !== 'VALIDATION_ERROR' && (
        <RetryBanner
          error={error}
          isRetrying={isRetrying}
          onRetry={handleRetry}
          onDismiss={handleClearError}
          attempt={currentAttempt}
          maxAttempts={3}
        />
      )}

      {/* Header with Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-700 mt-2 font-medium text-sm sm:text-base">
            Welcome back, {user?.name}! Here's your business overview.
          </p>
        </div>
        
        <div className="flex flex-col gap-3 sm:flex-row">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="thisWeek">This Week</SelectItem>
              <SelectItem value="thisMonth">This Month</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>

          {dateRange === 'custom' && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start text-left font-normal w-full sm:w-auto">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {customDateRange.from && customDateRange.to ?
                    `${format(customDateRange.from, 'MMM dd')} - ${format(customDateRange.to, 'MMM dd')}` :
                    'Select dates'
                  }
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
                  numberOfMonths={isMobile ? 1 : 2}
                />
              </PopoverContent>
            </Popover>
          )}

          <Button
            onClick={() => fetchAnalytics(true)}
            variant="outline"
            size="sm"
            disabled={loading || isRetrying}
            className="flex items-center gap-2 w-full sm:w-auto"
          >
            <RefreshCw className={`h-4 w-4 ${loading || isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Retrying...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'}`}>
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

      {/* Charts Row - Responsive layout */}
      <div className={`grid gap-6 ${isMobile ? 'grid-cols-1' : 'lg:grid-cols-2'}`}>
        {/* Sales Trend Chart */}
        <Card className="rounded-lg border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Sales Trend</CardTitle>
            <CardDescription>Daily revenue and transaction count</CardDescription>
          </CardHeader>
          <CardContent>
            {isClient && analyticsData?.charts?.salesTrend?.length > 0 ? (
              <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
                <LineChart data={analyticsData.charts.salesTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="sale_date"
                    tick={{ fill: '#374151', fontSize: 12 }}
                    tickFormatter={(date) => format(new Date(date), 'MMM dd')}
                  />
                  <YAxis 
                    yAxisId="revenue" 
                    orientation="left" 
                    tick={{ fill: '#374151', fontSize: 12 }} 
                    tickFormatter={(value) => `$${(value / 100).toFixed(0)}`} 
                  />
                  <YAxis yAxisId="count" orientation="right" tick={{ fill: '#374151', fontSize: 12 }} />
                  <Tooltip
                    formatter={(value, name) => {
                      if (name === 'daily_revenue') return [formatCurrency(value as number), 'Revenue'];
                      if (name === 'avg_basket') return [formatCurrency(value as number), 'Avg Basket'];
                      return [value, name];
                    }}
                    labelFormatter={(date) => format(new Date(date), 'MMM dd, yyyy')}
                  />
                  <Legend />
                  <Line
                    yAxisId="revenue"
                    type="monotone"
                    dataKey="daily_revenue"
                    stroke="#10b981"
                    strokeWidth={3}
                    name="Revenue"
                  />
                  <Line
                    yAxisId="count"
                    type="monotone"
                    dataKey="transaction_count"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="Transactions"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className={`${isMobile ? 'h-40' : 'h-64'} flex items-center justify-center text-gray-600`}>
                <div className="text-center">
                  {loading || isRetrying ? (
                    <div className="animate-pulse space-y-3">
                      <div className="h-4 bg-gray-300 rounded w-32 mx-auto"></div>
                      <div className="h-4 bg-gray-300 rounded w-24 mx-auto"></div>
                    </div>
                  ) : (
                    <p className="font-medium">No sales data available for selected period</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Category Revenue Breakdown */}
        <Card className="rounded-lg border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Revenue by Category</CardTitle>
            <CardDescription>Sales distribution across product categories</CardDescription>
          </CardHeader>
          <CardContent>
            {isClient && analyticsData?.charts?.categoryBreakdown?.length > 0 ? (
              <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
                <RechartsPieChart>
                  <Pie
                    data={analyticsData.charts.categoryBreakdown}
                    dataKey="category_revenue"
                    nameKey="category_name"
                    cx="50%"
                    cy="50%"
                    outerRadius={isMobile ? 80 : 100}
                    label={({ category_name, percent }) => `${category_name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {analyticsData.charts.categoryBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [formatCurrency(value as number), 'Revenue']} />
                </RechartsPieChart>
              </ResponsiveContainer>
            ) : (
              <div className={`${isMobile ? 'h-40' : 'h-64'} flex items-center justify-center text-gray-500`}>
                <div className="text-center">
                  {loading || isRetrying ? (
                    <div className="animate-pulse space-y-3">
                      <div className="h-4 bg-gray-200 rounded w-32 mx-auto"></div>
                      <div className="h-4 bg-gray-200 rounded w-24 mx-auto"></div>
                    </div>
                  ) : (
                    <p>No category data available</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Additional Insights - Mobile friendly layout */}
      <div className={`grid gap-6 ${isMobile ? 'grid-cols-1' : 'lg:grid-cols-2'}`}>
        {/* Low Stock Alerts */}
        <Card className="rounded-lg border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Low Stock Alerts
            </CardTitle>
            <CardDescription>Products requiring attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {analyticsData?.kpis.lowStockAlerts.length ? (
                analyticsData.kpis.lowStockAlerts.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.product_name}</p>
                      {(item.size || item.color) && (
                        <p className="text-xs text-gray-700 font-medium truncate">
                          {[item.size, item.color].filter(Boolean).join(' - ')}
                        </p>
                      )}
                    </div>
                    <Badge variant="secondary" className="bg-amber-100 text-amber-800 ml-2">
                      {item.qty_on_hand} left
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-gray-600 text-center py-8 font-medium">No low stock alerts</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card className="rounded-lg border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Top Products</CardTitle>
            <CardDescription>Best selling items in selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {analyticsData?.kpis.topProducts.map((product, index) => (
                <div key={product.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{product.name}</p>
                      <p className="text-xs text-gray-700 font-medium">{product.total_qty} units sold</p>
                    </div>
                  </div>
                  <div className="text-right ml-2">
                    <p className="font-medium text-sm">{formatCurrency(product.total_revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;