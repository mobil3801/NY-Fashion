
import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import { useNetwork } from '@/contexts/NetworkContext';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Wifi,
  WifiOff,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Clock,
  Loader2 } from
'lucide-react';

interface NetworkAwareInventoryContextType {
  // Network-aware operations
  isOnline: boolean;
  connectionState: string;
  isRetrying: boolean;

  // Enhanced error handling
  hasNetworkError: boolean;
  canRetry: boolean;
  retryOperation: () => Promise<void>;

  // Data freshness
  lastSync: Date | null;
  isDataStale: boolean;

  // Queue status
  pendingOperations: number;
  hasPendingChanges: boolean;
}

const NetworkAwareInventoryContext = createContext<NetworkAwareInventoryContextType | undefined>(undefined);

interface NetworkAwareInventoryProviderProps {
  children: React.ReactNode;
}

export function NetworkAwareInventoryProvider({ children }: NetworkAwareInventoryProviderProps) {
  const {
    products,
    loading,
    error,
    isRetrying: inventoryRetrying,
    retry: inventoryRetry,
    clearError,
    fetchProducts,
    fetchCategories
  } = useInventory();

  const {
    online,
    connectionState,
    errorDetails,
    recoveryInfo,
    retryNow: networkRetryNow,
    isAutoRetrying
  } = useNetwork();

  const lastSyncRef = useRef<Date | null>(null);
  const pendingOperationsRef = useRef<number>(0);
  const [hasPendingChanges, setHasPendingChanges] = React.useState(false);

  // Track last successful sync
  useEffect(() => {
    if (!loading && !error && products.length > 0) {
      lastSyncRef.current = new Date();
    }
  }, [loading, error, products.length]);

  // Auto-refresh data when connection is restored
  useEffect(() => {
    if (online && recoveryInfo?.wasOfflineFor && recoveryInfo.wasOfflineFor > 5000) {
      // Connection was offline for more than 5 seconds, refresh data
      const refreshData = async () => {
        try {
          await Promise.all([
          fetchProducts(),
          fetchCategories()]
          );

          toast({
            title: "Data Refreshed",
            description: "Inventory data has been synchronized.",
            variant: "default"
          });
        } catch (err) {
          console.error('Auto-refresh failed:', err);
        }
      };

      // Small delay to allow network to stabilize
      setTimeout(refreshData, 1000);
    }
  }, [online, recoveryInfo, fetchProducts, fetchCategories]);

  // Enhanced retry operation
  const retryOperation = useCallback(async () => {
    try {
      // First restore network if needed
      if (!online) {
        await networkRetryNow();
        // Wait for network to stabilize
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Then retry inventory operations
      if (error) {
        await inventoryRetry();
      } else {
        // Refresh data
        await Promise.all([
        fetchProducts(),
        fetchCategories()]
        );
      }

    } catch (retryError) {
      console.error('Retry operation failed:', retryError);
      toast({
        title: "Retry Failed",
        description: "Unable to restore connection. Please check your network and try again.",
        variant: "destructive"
      });
    }
  }, [online, networkRetryNow, error, inventoryRetry, fetchProducts, fetchCategories]);

  // Calculate data staleness
  const isDataStale = (() => {
    if (!lastSyncRef.current) return true;
    const now = new Date();
    const timeDiff = now.getTime() - lastSyncRef.current.getTime();
    return timeDiff > 300000; // 5 minutes
  })();

  // Determine if there's a network-related error
  const hasNetworkError = !!(error && (
  !online ||
  connectionState === 'offline' ||
  connectionState === 'poor_connection' ||
  errorDetails?.type === 'network_unavailable' ||
  errorDetails?.type === 'timeout'));


  const canRetry = hasNetworkError || !online && error;
  const isRetrying = inventoryRetrying || isAutoRetrying;

  const contextValue: NetworkAwareInventoryContextType = {
    isOnline: online,
    connectionState,
    isRetrying,
    hasNetworkError,
    canRetry,
    retryOperation,
    lastSync: lastSyncRef.current,
    isDataStale,
    pendingOperations: pendingOperationsRef.current,
    hasPendingChanges
  };

  return (
    <NetworkAwareInventoryContext.Provider value={contextValue}>
      {children}
    </NetworkAwareInventoryContext.Provider>);

}

export function useNetworkAwareInventory() {
  const context = useContext(NetworkAwareInventoryContext);
  if (context === undefined) {
    throw new Error('useNetworkAwareInventory must be used within a NetworkAwareInventoryProvider');
  }
  return context;
}

// Network Status Bar Component
export function InventoryNetworkStatusBar() {
  const {
    isOnline,
    connectionState,
    isRetrying,
    hasNetworkError,
    canRetry,
    retryOperation,
    lastSync,
    isDataStale
  } = useNetworkAwareInventory();

  if (isOnline && connectionState === 'online' && !isDataStale) {
    return null;
  }

  const getStatusInfo = () => {
    if (connectionState === 'recovering') {
      return {
        icon: CheckCircle2,
        color: 'text-green-700',
        bgColor: 'bg-green-50 border-green-200',
        message: 'Connection restored. Syncing data...',
        canDismiss: true
      };
    }

    if (connectionState === 'reconnecting' || isRetrying) {
      return {
        icon: Loader2,
        color: 'text-blue-700',
        bgColor: 'bg-blue-50 border-blue-200',
        message: 'Reconnecting to server...',
        canDismiss: false,
        spinning: true
      };
    }

    if (!isOnline || connectionState === 'offline') {
      return {
        icon: WifiOff,
        color: 'text-red-700',
        bgColor: 'bg-red-50 border-red-200',
        message: 'You are offline. Changes will be saved locally.',
        canDismiss: false
      };
    }

    if (connectionState === 'poor_connection') {
      return {
        icon: Wifi,
        color: 'text-yellow-700',
        bgColor: 'bg-yellow-50 border-yellow-200',
        message: 'Poor connection detected. Some features may be limited.',
        canDismiss: false
      };
    }

    if (isDataStale) {
      return {
        icon: Clock,
        color: 'text-orange-700',
        bgColor: 'bg-orange-50 border-orange-200',
        message: 'Data may be outdated. Consider refreshing.',
        canDismiss: false
      };
    }

    return null;
  };

  const statusInfo = getStatusInfo();
  if (!statusInfo) return null;

  const { icon: Icon, color, bgColor, message, canDismiss, spinning = false } = statusInfo;

  return (
    <Card className={`${bgColor} border mb-4`} role="status" aria-live="polite">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Icon
              className={`h-4 w-4 ${color} ${spinning ? 'animate-spin' : ''}`}
              aria-hidden="true" />

            <div>
              <p className={`text-sm font-medium ${color}`}>
                {message}
              </p>
              {lastSync &&
              <p className="text-xs text-gray-600 mt-1">
                  Last synced: {lastSync.toLocaleTimeString()}
                </p>
              }
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {isOnline &&
            <Badge
              className="text-xs"
              variant={connectionState === 'online' ? 'default' : 'secondary'}>

                <Wifi className="h-3 w-3 mr-1" />
                Online
              </Badge>
            }
            
            {canRetry &&
            <Button
              size="sm"
              variant="outline"
              onClick={retryOperation}
              disabled={isRetrying}
              className={`border-current ${color} hover:bg-current/10`}
              aria-label="Retry connection">

                {isRetrying ?
              <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Retrying...
                  </> :

              <>
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Retry
                  </>
              }
              </Button>
            }
          </div>
        </div>
      </CardContent>
    </Card>);

}

// Connection Quality Indicator
export function InventoryConnectionIndicator() {
  const { isOnline, connectionState } = useNetworkAwareInventory();

  const getIndicatorProps = () => {
    if (!isOnline || connectionState === 'offline') {
      return {
        icon: WifiOff,
        color: 'text-red-600',
        label: 'Offline',
        variant: 'destructive' as const
      };
    }

    if (connectionState === 'poor_connection') {
      return {
        icon: AlertTriangle,
        color: 'text-yellow-600',
        label: 'Poor Connection',
        variant: 'secondary' as const
      };
    }

    if (connectionState === 'reconnecting') {
      return {
        icon: RefreshCw,
        color: 'text-blue-600',
        label: 'Reconnecting',
        variant: 'secondary' as const,
        spinning: true
      };
    }

    return {
      icon: Wifi,
      color: 'text-green-600',
      label: 'Online',
      variant: 'default' as const
    };
  };

  const { icon: Icon, color, label, variant, spinning = false } = getIndicatorProps();

  return (
    <Badge
      variant={variant}
      className="flex items-center space-x-1"
      role="status"
      aria-label={`Connection status: ${label}`}>

      <Icon className={`h-3 w-3 ${color} ${spinning ? 'animate-spin' : ''}`} />
      <span>{label}</span>
    </Badge>);

}