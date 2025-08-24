
import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Wifi, 
  WifiOff, 
  Activity, 
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Zap
} from 'lucide-react';
import { useEnhancedInventory } from '@/contexts/EnhancedInventoryContext';
import { inventoryServiceWorker } from '@/lib/inventory-service-worker';

export default function InventoryNetworkMonitor() {
  const { getConnectionStatus, getDiagnostics } = useEnhancedInventory();
  const [showDetails, setShowDetails] = useState(false);
  const [cacheStatus, setCacheStatus] = useState<string>('unknown');

  const connectionStatus = getConnectionStatus();
  const diagnostics = getDiagnostics();

  useEffect(() => {
    // Listen for service worker messages
    const handleSWMessage = (event: any) => {
      if (event.data?.type === 'CACHE_BUMPED') {
        setCacheStatus('refreshed');
        setTimeout(() => setCacheStatus('ready'), 2000);
      } else if (event.data?.type === 'CACHE_CLEARED') {
        setCacheStatus('cleared');
        setTimeout(() => setCacheStatus('ready'), 2000);
      }
    };

    window.addEventListener('inventory-cache-bumped', handleSWMessage);
    window.addEventListener('inventory-cache-cleared', handleSWMessage);

    return () => {
      window.removeEventListener('inventory-cache-bumped', handleSWMessage);
      window.removeEventListener('inventory-cache-cleared', handleSWMessage);
    };
  }, []);

  const getConnectionIcon = () => {
    if (!connectionStatus.online) {
      return <WifiOff className="h-4 w-4 text-red-500" />;
    }
    
    switch (connectionStatus.quality) {
      case 'excellent':
        return <Wifi className="h-4 w-4 text-green-500" />;
      case 'good':
        return <Wifi className="h-4 w-4 text-blue-500" />;
      case 'fair':
        return <Wifi className="h-4 w-4 text-yellow-500" />;
      case 'poor':
        return <Wifi className="h-4 w-4 text-orange-500" />;
      default:
        return <WifiOff className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    if (!connectionStatus.online) return 'destructive';
    
    switch (connectionStatus.quality) {
      case 'excellent':
      case 'good':
        return 'default';
      case 'fair':
        return 'secondary';
      case 'poor':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const handleCacheBump = async () => {
    setCacheStatus('refreshing');
    try {
      await inventoryServiceWorker.bumpCache();
    } catch (error) {
      console.error('Failed to bump cache:', error);
      setCacheStatus('error');
      setTimeout(() => setCacheStatus('ready'), 2000);
    }
  };

  const handleClearCache = async () => {
    setCacheStatus('clearing');
    try {
      await inventoryServiceWorker.clearCache();
    } catch (error) {
      console.error('Failed to clear cache:', error);
      setCacheStatus('error');
      setTimeout(() => setCacheStatus('ready'), 2000);
    }
  };

  if (!showDetails) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowDetails(true)}
        className="flex items-center gap-2 px-2 h-8"
        title="Network Monitor"
      >
        {getConnectionIcon()}
        <Badge variant={getStatusColor() as any} className="text-xs">
          {connectionStatus.online ? connectionStatus.quality : 'Offline'}
        </Badge>
      </Button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Card className="w-80 shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              <span className="font-medium text-sm">Network Monitor</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails(false)}
              className="h-6 w-6 p-0"
            >
              ✕
            </Button>
          </div>

          <div className="space-y-3 text-sm">
            {/* Connection Status */}
            <div className="flex items-center justify-between">
              <span>Status:</span>
              <div className="flex items-center gap-2">
                {getConnectionIcon()}
                <Badge variant={getStatusColor() as any}>
                  {connectionStatus.online ? connectionStatus.quality : 'Offline'}
                </Badge>
              </div>
            </div>

            {/* Latency */}
            <div className="flex items-center justify-between">
              <span>Latency:</span>
              <span className="font-mono">
                {Math.round(connectionStatus.latency)}ms
              </span>
            </div>

            {/* Active Requests */}
            <div className="flex items-center justify-between">
              <span>Active Requests:</span>
              <Badge variant="outline">
                {diagnostics.activeRequests.length}
              </Badge>
            </div>

            {/* Error Rate */}
            <div className="flex items-center justify-between">
              <span>Error Rate:</span>
              <span className={
                diagnostics.failedRequests > 0 ? 'text-red-600' : 'text-green-600'
              }>
                {diagnostics.totalRequests > 0 
                  ? Math.round((diagnostics.failedRequests / diagnostics.totalRequests) * 100)
                  : 0
                }%
              </span>
            </div>

            {/* Cache Status */}
            <div className="flex items-center justify-between">
              <span>Cache:</span>
              <div className="flex items-center gap-2">
                {cacheStatus === 'refreshing' && <RefreshCw className="h-3 w-3 animate-spin" />}
                {cacheStatus === 'clearing' && <RefreshCw className="h-3 w-3 animate-spin" />}
                {cacheStatus === 'refreshed' && <CheckCircle className="h-3 w-3 text-green-500" />}
                {cacheStatus === 'cleared' && <CheckCircle className="h-3 w-3 text-blue-500" />}
                {cacheStatus === 'error' && <AlertTriangle className="h-3 w-3 text-red-500" />}
                <Badge variant="outline" className="text-xs">
                  {cacheStatus === 'refreshing' ? 'Refreshing' :
                   cacheStatus === 'clearing' ? 'Clearing' :
                   cacheStatus === 'refreshed' ? 'Refreshed' :
                   cacheStatus === 'cleared' ? 'Cleared' :
                   cacheStatus === 'error' ? 'Error' : 'Ready'}
                </Badge>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCacheBump}
                disabled={cacheStatus === 'refreshing' || cacheStatus === 'clearing'}
                className="flex-1"
              >
                <Zap className="h-3 w-3 mr-1" />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearCache}
                disabled={cacheStatus === 'refreshing' || cacheStatus === 'clearing'}
                className="flex-1"
              >
                Clear Cache
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
