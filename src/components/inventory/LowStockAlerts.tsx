
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AlertTriangle,
  Package,
  ShoppingCart,
  TrendingDown,
  Bell,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertCircle,
  Clock,
  CheckCircle } from
'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { useInventory } from '@/contexts/InventoryContext';
import { useNetwork } from '@/contexts/NetworkContext';
import { EnhancedNetworkErrorBoundary } from '@/components/network/EnhancedNetworkErrorBoundary';
import { toast } from '@/hooks/use-toast';

interface LowStockProduct {
  id?: number;
  name: string;
  sku: string;
  category_name?: string;
  total_stock?: number;
  min_stock_level: number;
  max_stock_level: number;
  unit: string;
  selling_price: number;
  cost_price?: number;
}

const LowStockAlerts = () => {
  const { getLowStockProducts, error, isRetrying, retry, clearError } = useInventory();
  const {
    online,
    connectionState,
    retryNow,
    errorDetails,
    recoveryInfo,
    status,
    isAutoRetrying
  } = useNetwork();

  // Local state with better error handling
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastSuccessfulFetch, setLastSuccessfulFetch] = useState<Date | null>(null);
  const [cachedData, setCachedData] = useState<LowStockProduct[]>([]);
  const [manualRetryCount, setManualRetryCount] = useState(0);
  const [isManualRetrying, setIsManualRetrying] = useState(false);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);

  // Dev-only logging
  const devLog = (message: string, data?: any) => {
    if (import.meta.env.DEV) {
      console.log(`[LowStockAlerts] ${message}`, data);
    }
  };

  // Connection quality indicator with improved logic
  const connectionQuality = useMemo(() => {
    if (!online) return 'offline';
    if (connectionState === 'poor_connection') return 'poor';
    if (status?.consecutiveFailures > 0) return 'unstable';
    return 'good';
  }, [online, connectionState, status]);

  // Enhanced data validation
  const validateProductData = useCallback((products: any[]): LowStockProduct[] => {
    if (!Array.isArray(products)) {
      devLog('Invalid product data: not an array', products);
      return [];
    }

    return products.filter((product) => {
      const isValid = product &&
      typeof product.name === 'string' &&
      typeof product.sku === 'string' &&
      typeof product.min_stock_level === 'number' &&
      typeof product.max_stock_level === 'number' &&
      typeof product.selling_price === 'number';

      if (!isValid) {
        devLog('Invalid product filtered out:', product);
      }

      return isValid;
    }).map((product) => ({
      ...product,
      total_stock: Math.max(0, product.total_stock || 0),
      min_stock_level: Math.max(1, product.min_stock_level),
      max_stock_level: Math.max(product.min_stock_level + 1, product.max_stock_level),
      unit: product.unit || 'pcs'
    }));
  }, []);

  // Fetch low stock products with enhanced error handling and validation
  const fetchLowStockProducts = useCallback(async (showToast = false) => {
    if (!online && !showToast && cachedData.length > 0) {
      setLowStockProducts(cachedData);
      devLog('Using cached data while offline', { count: cachedData.length });
      return;
    }

    try {
      setLoading(true);
      clearError?.();

      devLog('Fetching low stock products', { online, showToast });

      // Use the backend API directly with proper error handling
      const { data, error } = await window.ezsite.apis.run({
        path: "getLowStockProducts",
        param: [{
          limit: 100
        }]
      });

      if (error) {
        throw new Error(typeof error === 'string' ? error : 'Failed to fetch low stock products');
      }

      const rawProducts = Array.isArray(data) ? data : [];
      const validatedProducts = validateProductData(rawProducts);

      setLowStockProducts(validatedProducts);
      setCachedData(validatedProducts);
      setLastSuccessfulFetch(new Date());
      setManualRetryCount(0);
      setHasInitialLoad(true);

      devLog('Successfully fetched products', { count: validatedProducts.length });

      if (showToast) {
        toast({
          title: "Data Updated",
          description: `Found ${validatedProducts.length} products with low stock levels.`,
          variant: "default"
        });
      }

    } catch (fetchError: any) {
      devLog('Error fetching low stock products', fetchError);

      // Enhanced error handling
      if (cachedData.length > 0 && !online) {
        setLowStockProducts(cachedData);
        devLog('Using cached data after fetch error', { count: cachedData.length });

        if (showToast) {
          toast({
            title: "Offline Mode",
            description: "Showing previously cached data. Some information may be outdated.",
            variant: "default"
          });
        }
      } else {
        setLowStockProducts([]);

        if (showToast) {
          const errorMessage = errorDetails?.userMessage ||
          fetchError?.message ||
          "Unable to fetch low stock alerts. Please try again.";

          toast({
            title: "Failed to Load Data",
            description: errorMessage,
            variant: "destructive"
          });
        }
      }
    } finally {
      setLoading(false);
    }
  }, [online, cachedData, clearError, errorDetails, validateProductData]);

  // Enhanced manual retry with better UX
  const handleManualRetry = useCallback(async () => {
    if (manualRetryCount >= 3) {
      toast({
        title: "Retry Limit Reached",
        description: "Please wait a moment before trying again.",
        variant: "destructive"
      });
      return;
    }

    setIsManualRetrying(true);
    setManualRetryCount((prev) => prev + 1);
    devLog('Manual retry attempt', { count: manualRetryCount + 1 });

    try {
      // First try to restore network connection
      if (!online) {
        await retryNow?.();
        // Wait for connection to stabilize
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Then retry the data fetch
      if (error) {
        retry?.();
      } else {
        await fetchLowStockProducts(true);
      }

    } catch (retryError: any) {
      devLog('Manual retry failed', retryError);

      toast({
        title: "Retry Failed",
        description: "Unable to restore connection or fetch data. Please check your network.",
        variant: "destructive"
      });
    } finally {
      setIsManualRetrying(false);
    }
  }, [online, retryNow, error, retry, fetchLowStockProducts, manualRetryCount]);

  // Auto-refresh when connection is restored
  useEffect(() => {
    if (online && recoveryInfo?.wasOfflineFor && hasInitialLoad) {
      devLog('Connection restored, refreshing data');
      fetchLowStockProducts();
    }
  }, [online, recoveryInfo, fetchLowStockProducts, hasInitialLoad]);

  // Initial data load
  useEffect(() => {
    fetchLowStockProducts();
  }, [fetchLowStockProducts]);

  // Enhanced stock level calculation with proper validation
  const getStockLevel = useCallback((current: number, min: number, max: number) => {
    // Ensure valid inputs
    const safeCurrent = Math.max(0, current || 0);
    const safeMin = Math.max(1, min || 1);
    const safeMax = Math.max(safeMin + 1, max || safeMin + 10);

    if (safeCurrent === 0) {
      return {
        level: 'out',
        percentage: 0,
        color: 'bg-red-600',
        textColor: 'text-red-900',
        bgColor: 'bg-red-100'
      };
    }

    if (safeCurrent <= safeMin) {
      return {
        level: 'critical',
        percentage: Math.min(50, safeCurrent / safeMin * 50),
        color: 'bg-red-600',
        textColor: 'text-red-900',
        bgColor: 'bg-red-100'
      };
    }

    if (safeCurrent <= safeMin * 2) {
      return {
        level: 'low',
        percentage: 50 + (safeCurrent - safeMin) / safeMin * 30,
        color: 'bg-yellow-600',
        textColor: 'text-yellow-900',
        bgColor: 'bg-yellow-100'
      };
    }

    return {
      level: 'good',
      percentage: 80 + (safeCurrent - safeMin * 2) / (safeMax - safeMin * 2) * 20,
      color: 'bg-green-600',
      textColor: 'text-green-900',
      bgColor: 'bg-green-100'
    };
  }, []);

  // Accessible stock badge with WCAG compliant colors
  const getStockBadge = useCallback((level: string) => {
    const badgeProps = {
      className: "badge-aa text-xs font-semibold px-2.5 py-0.5 rounded-md focus-aa",
      role: "status",
      "aria-label": `Stock level: ${level}`
    };

    switch (level) {
      case 'out':
        return (
          <Badge
            {...badgeProps}
            className={`${badgeProps.className} status-critical-aa`}>

            Out of Stock
          </Badge>);

      case 'critical':
        return (
          <Badge
            {...badgeProps}
            className={`${badgeProps.className} status-critical-aa`}>

            Critical
          </Badge>);

      case 'low':
        return (
          <Badge
            {...badgeProps}
            className={`${badgeProps.className} status-warning-aa`}>

            Low Stock
          </Badge>);

      default:
        return (
          <Badge
            {...badgeProps}
            className={`${badgeProps.className} status-good-aa`}>

            Good
          </Badge>);

    }
  }, []);

  // Enhanced connection status indicator with accessibility
  const ConnectionIndicator = () => {
    const getIndicatorProps = () => {
      switch (connectionState) {
        case 'offline':
          return {
            icon: WifiOff,
            color: 'text-red-700',
            bgColor: 'connection-offline-aa',
            text: 'Offline',
            description: 'No internet connection',
            status: 'error'
          };
        case 'poor_connection':
          return {
            icon: Wifi,
            color: 'text-yellow-700',
            bgColor: 'connection-poor-aa',
            text: 'Poor Connection',
            description: 'Slow or unstable connection',
            status: 'warning'
          };
        case 'reconnecting':
          return {
            icon: RefreshCw,
            color: 'text-blue-700',
            bgColor: 'connection-poor-aa',
            text: 'Reconnecting...',
            description: 'Attempting to restore connection',
            status: 'info'
          };
        case 'recovering':
          return {
            icon: CheckCircle,
            color: 'text-green-700',
            bgColor: 'connection-online-aa',
            text: 'Connection Restored',
            description: 'Successfully reconnected',
            status: 'success'
          };
        default:
          return null;
      }
    };

    const indicatorProps = getIndicatorProps();
    if (!indicatorProps || connectionState === 'online') return null;

    const { icon: Icon, color, bgColor, text, description, status } = indicatorProps;

    return (
      <Card className={`mb-4 border-l-4 ${bgColor} border`} role="alert" aria-live="polite">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Icon
                className={`h-4 w-4 ${color} ${connectionState === 'reconnecting' ? 'animate-spin' : ''}`}
                aria-hidden="true" />

              <div>
                <p className={`font-medium text-sm text-default-aa`}>
                  {text}
                </p>
                <p className={`text-xs-aa`}>
                  {description}
                </p>
              </div>
            </div>
            {(connectionState === 'offline' || error) &&
            <Button
              size="sm"
              variant="outline"
              onClick={handleManualRetry}
              disabled={isManualRetrying || isAutoRetrying}
              className="btn-outline-aa focus-aa touch-target-aa"
              aria-label={`Retry connection. ${3 - manualRetryCount} attempts remaining`}>

                {isManualRetrying || isAutoRetrying ?
              <>
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" aria-hidden="true" />
                    Retrying...
                  </> :

              <>
                    <RefreshCw className="h-3 w-3 mr-1" aria-hidden="true" />
                    Retry ({3 - manualRetryCount} left)
                  </>
              }
              </Button>
            }
          </div>
        </CardContent>
      </Card>);

  };

  // Enhanced data freshness indicator
  const DataFreshnessIndicator = () => {
    if (!lastSuccessfulFetch) return null;

    const now = new Date();
    const timeDiff = now.getTime() - lastSuccessfulFetch.getTime();
    const minutesAgo = Math.floor(timeDiff / (1000 * 60));

    if (minutesAgo < 5) return null;

    const isStale = minutesAgo > 30;
    const timeText = minutesAgo < 60 ?
    `${minutesAgo} min` :
    `${Math.floor(minutesAgo / 60)} hr`;

    return (
      <div
        className={`flex items-center space-x-2 text-xs-aa ${isStale ? 'text-warning-aa' : ''}`}
        role="status"
        aria-label={`Data last updated ${timeText} ago${!online ? ' (offline)' : ''}`}>

        <Clock className="h-3 w-3" aria-hidden="true" />
        <span>
          Data last updated {timeText} ago
          {!online && ' (offline)'}
        </span>
      </div>);

  };

  // Enhanced purchase order generation with better UX
  const generatePurchaseOrder = useCallback((productId: number, productName: string) => {
    if (!online) {
      toast({
        title: "Offline Mode",
        description: "Purchase orders cannot be created while offline. Please reconnect and try again.",
        variant: "destructive"
      });
      return;
    }

    devLog('Generate PO for product', { productId, productName });

    toast({
      title: "Feature Coming Soon",
      description: `Purchase order generation for "${productName}" will be available soon.`,
      variant: "default"
    });
  }, [online]);

  // Enhanced data calculations with null safety
  const criticalProducts = useMemo(() =>
  lowStockProducts.filter((p) => (p.total_stock || 0) === 0),
  [lowStockProducts]
  );

  const lowProducts = useMemo(() =>
  lowStockProducts.filter((p) =>
  (p.total_stock || 0) > 0 && (p.total_stock || 0) <= p.min_stock_level
  ),
  [lowStockProducts]
  );

  const totalValue = useMemo(() =>
  lowStockProducts.reduce((sum, product) =>
  sum + product.selling_price * (product.total_stock || 0), 0
  ),
  [lowStockProducts]
  );

  return (
    <EnhancedNetworkErrorBoundary>
      <div className="space-y-6">
        {/* Header with enhanced accessibility */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-default-aa">
              Low Stock Alerts
            </h1>
            <div className="flex items-center space-x-4 mt-1">
              <p className="text-muted-aa">
                Monitor inventory levels and receive alerts for low stock items
              </p>
              <DataFreshnessIndicator />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {/* Connection quality badge with accessibility */}
            <Badge
              className={`badge-aa ${
              connectionQuality === 'good' ? 'badge-success-aa' :
              connectionQuality === 'poor' || connectionQuality === 'unstable' ? 'badge-warning-aa' :
              'badge-error-aa'}`
              }
              role="status"
              aria-label={`Connection status: ${connectionQuality}`}>

              <Wifi className="h-3 w-3 mr-1" aria-hidden="true" />
              {connectionQuality === 'good' ? 'Online' :
              connectionQuality === 'poor' ? 'Poor Connection' :
              connectionQuality === 'unstable' ? 'Unstable' : 'Offline'}
            </Badge>
            
            <Button
              onClick={() => fetchLowStockProducts(true)}
              disabled={loading || isRetrying || isManualRetrying}
              className="focus-aa touch-target-aa"
              aria-label="Refresh low stock alerts">

              {loading || isRetrying ?
              <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                  {isRetrying ? 'Retrying...' : 'Loading...'}
                </> :

              <>
                  <Bell className="h-4 w-4 mr-2" aria-hidden="true" />
                  Refresh Alerts
                </>
              }
            </Button>
          </div>
        </div>

        {/* Connection status indicator */}
        <ConnectionIndicator />

        {/* Alert Summary with enhanced accessibility */}
        <div className="grid gap-4 md:grid-cols-4" role="region" aria-label="Stock summary">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium table-header-aa">Out of Stock</CardTitle>
              <Package className="h-4 w-4 text-red-600" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-error-aa" role="status">
                {criticalProducts.length}
              </div>
              <p className="text-xs-aa">
                Immediate attention required
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium table-header-aa">Low Stock</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-600" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning-aa" role="status">
                {lowProducts.length}
              </div>
              <p className="text-xs-aa">
                Below minimum level
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium table-header-aa">Total Value at Risk</CardTitle>
              <TrendingDown className="h-4 w-4 text-gray-600" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-default-aa" role="status">
                ${totalValue.toLocaleString()}
              </div>
              <p className="text-xs-aa">
                Current inventory value
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium table-header-aa">Reorder Suggested</CardTitle>
              <ShoppingCart className="h-4 w-4 text-gray-600" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-default-aa" role="status">
                {lowStockProducts.length}
              </div>
              <p className="text-xs-aa">
                Products need reordering
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced error state */}
        {error && !loading &&
        <Card className="card-error-aa border" role="alert">
            <CardContent className="pt-6">
              <div className="flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 text-error-aa mt-0.5" aria-hidden="true" />
                <div className="flex-1 space-y-2">
                  <h3 className="font-medium text-error-aa">Failed to Load Data</h3>
                  <p className="text-small-aa">
                    {error.message || 'Unable to fetch low stock alerts. This could be due to a network issue.'}
                  </p>
                  {cachedData.length > 0 &&
                <p className="text-xs-aa">
                      Showing previously cached data below. Some information may be outdated.
                    </p>
                }
                  <div className="flex items-center space-x-2 pt-2">
                    <Button
                    size="sm"
                    variant="outline"
                    onClick={handleManualRetry}
                    disabled={isManualRetrying || isAutoRetrying}
                    className="btn-outline-aa focus-aa"
                    aria-label="Retry loading data">

                      {isManualRetrying || isAutoRetrying ?
                    <>
                          <RefreshCw className="h-3 w-3 mr-1 animate-spin" aria-hidden="true" />
                          Retrying...
                        </> :

                    <>
                          <RefreshCw className="h-3 w-3 mr-1" aria-hidden="true" />
                          Try Again
                        </>
                    }
                    </Button>
                    {manualRetryCount > 0 &&
                  <span className="text-xs-aa" role="status">
                        Retry attempts: {manualRetryCount}
                      </span>
                  }
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        }

        {/* Enhanced critical stock alert */}
        {criticalProducts.length > 0 &&
        <Card className="card-error-aa border" role="alert">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-error-aa" aria-hidden="true" />
                <CardTitle className="text-error-aa">Critical Stock Alert</CardTitle>
              </div>
              <CardDescription className="text-error-aa">
                {criticalProducts.length} products are completely out of stock and need immediate restocking.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {criticalProducts.slice(0, 6).map((product) =>
              <div
                key={product.id}
                className="flex items-center justify-between bg-white p-3 rounded-lg border">

                    <div>
                      <p className="font-medium text-small-aa">{product.name}</p>
                      <p className="text-xs-aa">{product.sku}</p>
                    </div>
                    <Button
                  size="sm"
                  variant="outline"
                  onClick={() => generatePurchaseOrder(product.id!, product.name)}
                  disabled={!online}
                  className="btn-outline-aa focus-aa touch-target-aa"
                  aria-label={`Reorder ${product.name}`}
                  title={!online ? "Requires internet connection" : `Generate purchase order for ${product.name}`}>

                      Reorder
                    </Button>
                  </div>
              )}
              </div>
              {criticalProducts.length > 6 &&
            <p className="text-small-aa text-error-aa mt-2">
                  And {criticalProducts.length - 6} more products...
                </p>
            }
            </CardContent>
          </Card>
        }

        {/* Enhanced products table */}
        <Card>
          <CardHeader>
            <CardTitle className="table-header-aa">Low Stock Products</CardTitle>
            <CardDescription className="text-muted-aa">
              Products below minimum stock level threshold
              {!online && cachedData.length > 0 &&
              <Badge className="badge-neutral-aa ml-2" role="status">
                  <WifiOff className="h-3 w-3 mr-1" aria-hidden="true" />
                  Cached Data
                </Badge>
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ?
            <div
              className="flex flex-col items-center justify-center py-8 space-y-4"
              role="status"
              aria-label="Loading low stock alerts">

                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary loading-spinner-aa"></div>
                <div className="text-small-aa">
                  {isRetrying ? 'Retrying connection...' : 'Loading low stock alerts...'}
                </div>
              </div> :
            lowStockProducts.length > 0 ?
            <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="table-header-aa">Product</TableHead>
                      <TableHead className="table-header-aa">Category</TableHead>
                      <TableHead className="table-header-aa">Current Stock</TableHead>
                      <TableHead className="table-header-aa">Min Level</TableHead>
                      <TableHead className="table-header-aa">Stock Status</TableHead>
                      <TableHead className="table-header-aa">Stock Level</TableHead>
                      <TableHead className="table-header-aa">Value</TableHead>
                      <TableHead className="table-header-aa">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lowStockProducts.map((product) => {
                    const stockInfo = getStockLevel(
                      product.total_stock || 0,
                      product.min_stock_level,
                      product.max_stock_level
                    );

                    return (
                      <TableRow key={product.id}>
                          <TableCell className="table-cell-aa">
                            <div>
                              <div className="font-medium">{product.name}</div>
                              <div className="text-xs-aa">{product.sku}</div>
                            </div>
                          </TableCell>
                          <TableCell className="table-cell-aa">
                            <Badge className="badge-neutral-aa">
                              {product.category_name}
                            </Badge>
                          </TableCell>
                          <TableCell className="table-cell-aa">
                            <span className="font-mono">
                              {product.total_stock || 0} {product.unit}
                            </span>
                          </TableCell>
                          <TableCell className="table-cell-aa">
                            <span className="font-mono">
                              {product.min_stock_level} {product.unit}
                            </span>
                          </TableCell>
                          <TableCell>
                            {getStockBadge(stockInfo.level)}
                          </TableCell>
                          <TableCell>
                            <div className="w-20">
                              <Progress
                              value={stockInfo.percentage}
                              className={`h-2 ${stockInfo.level === 'critical' || stockInfo.level === 'out' ? 'progress-critical-aa' :
                              stockInfo.level === 'low' ? 'progress-warning-aa' : 'progress-good-aa'}`}
                              aria-label={`Stock level ${stockInfo.percentage.toFixed(0)}%`} />

                              <span className="text-xs-aa">
                                {stockInfo.percentage.toFixed(0)}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="table-cell-aa">
                            ${((product.total_stock || 0) * product.selling_price).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Button
                            size="sm"
                            variant="outline"
                            onClick={() => generatePurchaseOrder(product.id!, product.name)}
                            disabled={!online}
                            className="btn-outline-aa focus-aa touch-target-aa"
                            title={!online ? "Requires internet connection" : "Generate purchase order"}
                            aria-label={`Generate purchase order for ${product.name}`}>

                              <ShoppingCart className="h-3 w-3 mr-1" aria-hidden="true" />
                              Reorder
                            </Button>
                          </TableCell>
                        </TableRow>);

                  })}
                  </TableBody>
                </Table>
              </div> :

            <div className="text-center py-8">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" aria-hidden="true" />
                <h3 className="text-lg font-semibold mb-2 text-default-aa">
                  {error ? 'Unable to Load Data' : 'All Stock Levels Good!'}
                </h3>
                <p className="text-muted-aa">
                  {error ?
                'There was a problem loading the stock alerts. Please check your connection and try again.' :
                'No products are below their minimum stock levels.'
                }
                </p>
                {error &&
              <Button
                className="mt-4 btn-outline-aa focus-aa"
                variant="outline"
                onClick={handleManualRetry}
                disabled={isManualRetrying || isAutoRetrying}
                aria-label="Retry loading data">

                    {isManualRetrying || isAutoRetrying ?
                <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                        Retrying...
                      </> :

                <>
                        <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
                        Try Again
                      </>
                }
                  </Button>
              }
              </div>
            }
          </CardContent>
        </Card>
      </div>
    </EnhancedNetworkErrorBoundary>);

};

export default LowStockAlerts;