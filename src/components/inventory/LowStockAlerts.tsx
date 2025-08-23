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

  // Local state
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastSuccessfulFetch, setLastSuccessfulFetch] = useState<Date | null>(null);
  const [cachedData, setCachedData] = useState<LowStockProduct[]>([]);
  const [manualRetryCount, setManualRetryCount] = useState(0);
  const [isManualRetrying, setIsManualRetrying] = useState(false);

  // Connection quality indicator
  const connectionQuality = useMemo(() => {
    if (!online) return 'offline';
    if (connectionState === 'poor_connection') return 'poor';
    if (status.consecutiveFailures > 0) return 'unstable';
    return 'good';
  }, [online, connectionState, status.consecutiveFailures]);

  // Fetch low stock products with enhanced error handling
  const fetchLowStockProducts = useCallback(async (showToast = false) => {
    if (!online && !showToast) {
      // Use cached data when offline
      if (cachedData.length > 0) {
        setLowStockProducts(cachedData);
        return;
      }
    }

    try {
      setLoading(true);
      clearError();

      const products = await getLowStockProducts();
      const safeProducts = Array.isArray(products) ? products : [];

      setLowStockProducts(safeProducts);
      setCachedData(safeProducts); // Cache successful results
      setLastSuccessfulFetch(new Date());
      setManualRetryCount(0);

      if (showToast) {
        toast({
          title: "Data Updated",
          description: `Found ${safeProducts.length} products with low stock levels.`,
          variant: "default"
        });
      }

    } catch (fetchError) {
      console.error('Error fetching low stock products:', fetchError);

      // Use cached data if available when fetch fails
      if (cachedData.length > 0 && !online) {
        setLowStockProducts(cachedData);
        toast({
          title: "Offline Mode",
          description: "Showing previously cached data. Some information may be outdated.",
          variant: "default"
        });
      } else {
        // Show error state only if we have no cached data
        setLowStockProducts([]);
        if (showToast) {
          toast({
            title: "Failed to Load Data",
            description: errorDetails?.userMessage || "Unable to fetch low stock alerts. Please try again.",
            variant: "destructive"
          });
        }
      }
    } finally {
      setLoading(false);
    }
  }, [getLowStockProducts, online, cachedData, clearError, errorDetails]);

  // Manual retry with connection check
  const handleManualRetry = useCallback(async () => {
    setIsManualRetrying(true);
    setManualRetryCount((prev) => prev + 1);

    try {
      // First try to restore network connection
      if (!online) {
        await retryNow();
        // Wait a moment for connection to stabilize
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Then retry the data fetch
      if (error) {
        retry(); // Use inventory context retry
      } else {
        await fetchLowStockProducts(true);
      }

    } catch (retryError) {
      console.error('Manual retry failed:', retryError);
      toast({
        title: "Retry Failed",
        description: "Unable to restore connection or fetch data. Please check your network.",
        variant: "destructive"
      });
    } finally {
      setIsManualRetrying(false);
    }
  }, [online, retryNow, error, retry, fetchLowStockProducts]);

  // Auto-refresh when connection is restored
  useEffect(() => {
    if (online && recoveryInfo?.wasOfflineFor) {
      // Refresh data when connection is restored
      fetchLowStockProducts();
    }
  }, [online, recoveryInfo, fetchLowStockProducts]);

  // Initial data load
  useEffect(() => {
    fetchLowStockProducts();
  }, [fetchLowStockProducts]);

  // Stock level calculation
  const getStockLevel = useCallback((current: number, min: number, max: number) => {
    if (current === 0) return { level: 'out', percentage: 0, color: 'bg-red-500' };
    if (current <= min) return { level: 'critical', percentage: current / min * 50, color: 'bg-red-500' };
    if (current <= min * 2) return { level: 'low', percentage: 50 + (current - min) / min * 30, color: 'bg-yellow-500' };
    return { level: 'good', percentage: 80 + (current - min * 2) / (max - min * 2) * 20, color: 'bg-green-500' };
  }, []);

  // Stock badge with accessibility
  const getStockBadge = useCallback((level: string) => {
    switch (level) {
      case 'out':
        return <Badge variant="destructive">Out of Stock</Badge>;
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>;
      case 'low':
        return <Badge variant="secondary">Low Stock</Badge>;
      default:
        return <Badge variant="default">Good</Badge>;
    }
  }, []);

  // Connection status indicator
  const ConnectionIndicator = () => {
    const getIndicatorProps = () => {
      switch (connectionState) {
        case 'offline':
          return {
            icon: WifiOff,
            color: 'text-red-500',
            bgColor: 'bg-red-50',
            text: 'Offline',
            description: 'No internet connection'
          };
        case 'poor_connection':
          return {
            icon: Wifi,
            color: 'text-yellow-500',
            bgColor: 'bg-yellow-50',
            text: 'Poor Connection',
            description: 'Slow or unstable connection'
          };
        case 'reconnecting':
          return {
            icon: RefreshCw,
            color: 'text-blue-500',
            bgColor: 'bg-blue-50',
            text: 'Reconnecting...',
            description: 'Attempting to restore connection'
          };
        case 'recovering':
          return {
            icon: CheckCircle,
            color: 'text-green-500',
            bgColor: 'bg-green-50',
            text: 'Connection Restored',
            description: 'Successfully reconnected'
          };
        default:
          return {
            icon: Wifi,
            color: 'text-green-500',
            bgColor: 'bg-green-50',
            text: 'Online',
            description: 'Connected'
          };
      }
    };

    const { icon: Icon, color, bgColor, text, description } = getIndicatorProps();

    if (connectionState === 'online') return null; // Don't show when everything is good

    return (
      <Card className={`mb-4 border-l-4 ${bgColor}`}>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Icon className={`h-4 w-4 ${color} ${connectionState === 'reconnecting' ? 'animate-spin' : ''}`} />
              <div>
                <p className="font-medium text-sm">{text}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
            </div>
            {(connectionState === 'offline' || error) &&
            <Button
              size="sm"
              variant="outline"
              onClick={handleManualRetry}
              disabled={isManualRetrying || isAutoRetrying}>

                {isManualRetrying || isAutoRetrying ?
              <>
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                    Retrying...
                  </> :

              <>
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Retry ({3 - manualRetryCount} left)
                  </>
              }
              </Button>
            }
          </div>
        </CardContent>
      </Card>);

  };

  // Data freshness indicator
  const DataFreshnessIndicator = () => {
    if (!lastSuccessfulFetch) return null;

    const now = new Date();
    const timeDiff = now.getTime() - lastSuccessfulFetch.getTime();
    const minutesAgo = Math.floor(timeDiff / (1000 * 60));

    if (minutesAgo < 5) return null; // Don't show for recent data

    const isStale = minutesAgo > 30;

    return (
      <div className={`flex items-center space-x-2 text-xs ${isStale ? 'text-yellow-600' : 'text-muted-foreground'}`}>
        <Clock className="h-3 w-3" />
        <span>
          Data last updated {minutesAgo < 60 ? `${minutesAgo} min` : `${Math.floor(minutesAgo / 60)} hr`} ago
          {!online && ' (offline)'}
        </span>
      </div>);

  };

  // Purchase order generation (placeholder)
  const generatePurchaseOrder = useCallback((productId: number) => {
    if (!online) {
      toast({
        title: "Offline Mode",
        description: "Purchase orders cannot be created while offline. Please reconnect and try again.",
        variant: "destructive"
      });
      return;
    }

    // TODO: Implement purchase order generation
    console.log('Generate PO for product:', productId);
    toast({
      title: "Feature Coming Soon",
      description: "Purchase order generation will be available soon.",
      variant: "default"
    });
  }, [online]);

  // Calculate display data
  const criticalProducts = useMemo(() =>
  lowStockProducts.filter((p) => (p.total_stock || 0) === 0),
  [lowStockProducts]
  );

  const lowProducts = useMemo(() =>
  lowStockProducts.filter((p) => (p.total_stock || 0) > 0 && (p.total_stock || 0) <= p.min_stock_level),
  [lowStockProducts]
  );

  return (
    <EnhancedNetworkErrorBoundary>
      <div className="space-y-6">
        {/* Header with connection status */}
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Low Stock Alerts</h2>
            <div className="flex items-center space-x-4 mt-1">
              <p className="text-muted-foreground">
                Monitor inventory levels and receive alerts for low stock items
              </p>
              <DataFreshnessIndicator />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {/* Connection quality badge */}
            <Badge variant={connectionQuality === 'good' ? 'default' :
            connectionQuality === 'poor' || connectionQuality === 'unstable' ? 'secondary' :
            'destructive'}>
              <Wifi className="h-3 w-3 mr-1" />
              {connectionQuality === 'good' ? 'Online' :
              connectionQuality === 'poor' ? 'Poor Connection' :
              connectionQuality === 'unstable' ? 'Unstable' : 'Offline'}
            </Badge>
            
            <Button
              onClick={() => fetchLowStockProducts(true)}
              disabled={loading || isRetrying || isManualRetrying}>

              {loading || isRetrying ?
              <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  {isRetrying ? 'Retrying...' : 'Loading...'}
                </> :

              <>
                  <Bell className="h-4 w-4 mr-2" />
                  Refresh Alerts
                </>
              }
            </Button>
          </div>
        </div>

        {/* Connection status indicator */}
        <ConnectionIndicator />

        {/* Alert Summary */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
              <Package className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">{criticalProducts.length}</div>
              <p className="text-xs text-muted-foreground">
                Immediate attention required
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{lowProducts.length}</div>
              <p className="text-xs text-muted-foreground">
                Below minimum level
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value at Risk</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ৳{lowStockProducts.reduce((sum, product) =>
                sum + product.selling_price * (product.total_stock || 0), 0
                ).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Current inventory value
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Reorder Suggested</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{lowStockProducts.length}</div>
              <p className="text-xs text-muted-foreground">
                Products need reordering
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Error State */}
        {error && !loading &&
        <Card className="border-destructive bg-destructive/5">
            <CardContent className="pt-6">
              <div className="flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                <div className="flex-1 space-y-2">
                  <h3 className="font-medium text-destructive">Failed to Load Data</h3>
                  <p className="text-sm text-muted-foreground">
                    {error.message || 'Unable to fetch low stock alerts. This could be due to a network issue.'}
                  </p>
                  {cachedData.length > 0 &&
                <p className="text-xs text-muted-foreground">
                      Showing previously cached data below. Some information may be outdated.
                    </p>
                }
                  <div className="flex items-center space-x-2 pt-2">
                    <Button
                    size="sm"
                    variant="outline"
                    onClick={handleManualRetry}
                    disabled={isManualRetrying || isAutoRetrying}>

                      {isManualRetrying || isAutoRetrying ?
                    <>
                          <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                          Retrying...
                        </> :

                    <>
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Try Again
                        </>
                    }
                    </Button>
                    {manualRetryCount > 0 &&
                  <span className="text-xs text-muted-foreground">
                        Retry attempts: {manualRetryCount}
                      </span>
                  }
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        }

        {/* Critical Stock Alert */}
        {criticalProducts.length > 0 &&
        <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <CardTitle className="text-red-700">Critical Stock Alert</CardTitle>
              </div>
              <CardDescription className="text-red-600">
                {criticalProducts.length} products are completely out of stock and need immediate restocking.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {criticalProducts.slice(0, 6).map((product) =>
              <div key={product.id} className="flex items-center justify-between bg-white p-3 rounded-lg border">
                    <div>
                      <p className="font-medium text-sm">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.sku}</p>
                    </div>
                    <Button
                  size="sm"
                  variant="outline"
                  onClick={() => generatePurchaseOrder(product.id!)}
                  disabled={!online}>

                      Reorder
                    </Button>
                  </div>
              )}
              </div>
              {criticalProducts.length > 6 &&
            <p className="text-sm text-red-600 mt-2">
                  And {criticalProducts.length - 6} more products...
                </p>
            }
            </CardContent>
          </Card>
        }

        {/* Low Stock Products Table */}
        <Card>
          <CardHeader>
            <CardTitle>Low Stock Products</CardTitle>
            <CardDescription>
              Products below minimum stock level threshold
              {!online && cachedData.length > 0 &&
              <Badge variant="secondary" className="ml-2">
                  <WifiOff className="h-3 w-3 mr-1" />
                  Cached Data
                </Badge>
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ?
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <div className="text-sm text-muted-foreground">
                  {isRetrying ? 'Retrying connection...' : 'Loading low stock alerts...'}
                </div>
              </div> :
            lowStockProducts.length > 0 ?
            <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Current Stock</TableHead>
                    <TableHead>Min Level</TableHead>
                    <TableHead>Stock Status</TableHead>
                    <TableHead>Stock Level</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Actions</TableHead>
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
                        <TableCell>
                          <div>
                            <div className="font-medium">{product.name}</div>
                            <div className="text-sm text-muted-foreground">{product.sku}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{product.category_name}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono">
                            {product.total_stock || 0} {product.unit}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono">
                            {product.min_stock_level} {product.unit}
                          </span>
                        </TableCell>
                        <TableCell>
                          {getStockBadge(stockInfo.level)}
                        </TableCell>
                        <TableCell>
                          <div className="w-20">
                            <Progress value={stockInfo.percentage} className="h-2" />
                            <span className="text-xs text-muted-foreground">
                              {stockInfo.percentage.toFixed(0)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          ৳{((product.total_stock || 0) * product.selling_price).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                            size="sm"
                            variant="outline"
                            onClick={() => generatePurchaseOrder(product.id!)}
                            disabled={!online}
                            title={!online ? "Requires internet connection" : "Generate purchase order"}>

                              <ShoppingCart className="h-3 w-3 mr-1" />
                              Reorder
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>);

                })}
                </TableBody>
              </Table> :

            <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">
                  {error ? 'Unable to Load Data' : 'All Stock Levels Good!'}
                </h3>
                <p>
                  {error ?
                'There was a problem loading the stock alerts. Please check your connection and try again.' :
                'No products are below their minimum stock levels.'
                }
                </p>
                {error &&
              <Button
                className="mt-4"
                variant="outline"
                onClick={handleManualRetry}
                disabled={isManualRetrying || isAutoRetrying}>

                    {isManualRetrying || isAutoRetrying ?
                <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Retrying...
                      </> :

                <>
                        <RefreshCw className="h-4 w-4 mr-2" />
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