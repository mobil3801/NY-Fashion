
import React, { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2,
  Clock,
  Upload,
  Download,
  Loader2,
  Save
} from 'lucide-react';
import { useInventory } from '@/contexts/InventoryContext';
import { useNetwork } from '@/contexts/NetworkContext';
import { useNetworkAwareInventory } from './NetworkAwareInventoryProvider';
import { toast } from '@/hooks/use-toast';

interface OperationStatus {
  id: string;
  type: 'create' | 'update' | 'delete' | 'fetch';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'queued';
  entityName: string;
  timestamp: Date;
  error?: string;
  retryCount?: number;
}

export function EnhancedNetworkInventoryOperations() {
  const { 
    products, 
    loading, 
    error, 
    saveProduct, 
    fetchProducts, 
    fetchCategories,
    retry: inventoryRetry,
    clearError
  } = useInventory();

  const {
    online,
    connectionState,
    retryNow,
    isAutoRetrying
  } = useNetwork();

  const {
    hasNetworkError,
    canRetry,
    retryOperation,
    isDataStale,
    lastSync
  } = useNetworkAwareInventory();

  const [operations, setOperations] = useState<OperationStatus[]>([]);
  const [syncProgress, setSyncProgress] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Add operation to track
  const addOperation = useCallback((operation: Omit<OperationStatus, 'id' | 'timestamp'>) => {
    const newOp: OperationStatus = {
      ...operation,
      id: `${operation.type}_${Date.now()}_${Math.random()}`,
      timestamp: new Date()
    };
    
    setOperations(prev => [newOp, ...prev.slice(0, 9)]);
    return newOp.id;
  }, []);

  // Update operation status
  const updateOperation = useCallback((id: string, updates: Partial<OperationStatus>) => {
    setOperations(prev => 
      prev.map(op => op.id === id ? { ...op, ...updates } : op)
    );
  }, []);

  // Enhanced save operation with network awareness
  const saveWithNetworkHandling = useCallback(async (product: any, operationName: string = 'product') => {
    const opId = addOperation({
      type: 'create',
      status: online ? 'processing' : 'queued',
      entityName: operationName
    });

    try {
      if (!online) {
        // Queue for later
        updateOperation(opId, { 
          status: 'queued',
          error: 'Queued for sync when online'
        });
        
        toast({
          title: "Saved Offline",
          description: `${operationName} will be synced when connection is restored.`,
          variant: "default"
        });
        return;
      }

      await saveProduct(product);
      updateOperation(opId, { status: 'completed' });
      
    } catch (error: any) {
      const retryCount = (operations.find(op => op.id === opId)?.retryCount || 0) + 1;
      
      updateOperation(opId, { 
        status: 'failed',
        error: error.message,
        retryCount
      });

      // Auto-retry for network errors
      if (retryCount < 3 && error.message.includes('network')) {
        setTimeout(async () => {
          try {
            await saveProduct(product);
            updateOperation(opId, { status: 'completed' });
          } catch (retryError: any) {
            updateOperation(opId, { 
              status: 'failed',
              error: retryError.message,
              retryCount: retryCount + 1
            });
          }
        }, 1000 * retryCount); // Exponential backoff
      }
    }
  }, [online, saveProduct, addOperation, updateOperation, operations]);

  // Enhanced sync operation
  const performSync = useCallback(async () => {
    if (!online) {
      toast({
        title: "Cannot Sync",
        description: "Please check your internet connection and try again.",
        variant: "destructive"
      });
      return;
    }

    setIsSyncing(true);
    setSyncProgress(0);

    const syncSteps = [
      { name: 'Fetching products', action: () => fetchProducts() },
      { name: 'Fetching categories', action: () => fetchCategories() },
      { name: 'Processing queued operations', action: () => processQueuedOperations() }
    ];

    try {
      for (let i = 0; i < syncSteps.length; i++) {
        const step = syncSteps[i];
        setSyncProgress((i / syncSteps.length) * 100);
        
        await step.action();
        
        // Small delay to show progress
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      setSyncProgress(100);
      clearError();
      
      toast({
        title: "Sync Complete",
        description: "All inventory data has been synchronized successfully.",
        variant: "default"
      });

    } catch (error: any) {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to synchronize data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncProgress(0), 1000);
    }
  }, [online, fetchProducts, fetchCategories, clearError]);

  // Process queued operations when back online
  const processQueuedOperations = useCallback(async () => {
    const queuedOps = operations.filter(op => op.status === 'queued');
    
    for (const op of queuedOps) {
      updateOperation(op.id, { status: 'processing' });
      
      try {
        // Here you would process the actual queued operation
        // For now, just mark as completed
        updateOperation(op.id, { status: 'completed' });
      } catch (error: any) {
        updateOperation(op.id, { 
          status: 'failed', 
          error: error.message 
        });
      }
    }
  }, [operations, updateOperation]);

  // Auto-process queued operations when coming online
  React.useEffect(() => {
    if (online && connectionState === 'online') {
      const queuedOps = operations.filter(op => op.status === 'queued');
      if (queuedOps.length > 0) {
        processQueuedOperations();
      }
    }
  }, [online, connectionState, operations, processQueuedOperations]);

  const getConnectionStatusColor = () => {
    if (!online) return 'text-red-600';
    if (connectionState === 'poor_connection') return 'text-yellow-600';
    if (connectionState === 'reconnecting') return 'text-blue-600';
    return 'text-green-600';
  };

  const getConnectionStatusIcon = () => {
    if (!online) return WifiOff;
    if (connectionState === 'poor_connection') return AlertTriangle;
    if (connectionState === 'reconnecting') return RefreshCw;
    return Wifi;
  };

  const StatusIcon = getConnectionStatusIcon();

  return (
    <div className="space-y-4">
      {/* Connection Status Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <StatusIcon 
                className={`h-5 w-5 ${getConnectionStatusColor()} ${
                  connectionState === 'reconnecting' ? 'animate-spin' : ''
                }`} 
              />
              <span>Network Status</span>
            </CardTitle>
            
            <div className="flex items-center space-x-2">
              <Badge variant={online ? 'default' : 'destructive'}>
                {online ? 'Online' : 'Offline'}
              </Badge>
              
              {isDataStale && (
                <Badge variant="secondary" className="flex items-center space-x-1">
                  <Clock className="h-3 w-3" />
                  <span>Stale Data</span>
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className={`text-sm font-medium ${getConnectionStatusColor()}`}>
                {online ? 
                  connectionState === 'poor_connection' ? 'Poor connection detected' :
                  connectionState === 'reconnecting' ? 'Reconnecting...' :
                  'Connected and synchronized' :
                  'Working offline'
                }
              </p>
              
              {lastSync && (
                <p className="text-xs text-gray-600">
                  Last synced: {lastSync.toLocaleTimeString()}
                </p>
              )}
              
              {!online && (
                <p className="text-xs text-gray-600">
                  Changes will be saved locally and synced when reconnected
                </p>
              )}
            </div>

            <div className="flex space-x-2">
              {canRetry && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={retryOperation}
                  disabled={isAutoRetrying}
                >
                  {isAutoRetrying ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-1" />
                  )}
                  Retry
                </Button>
              )}
              
              <Button
                size="sm"
                variant="default"
                onClick={performSync}
                disabled={!online || isSyncing}
              >
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-1" />
                )}
                Sync
              </Button>
            </div>
          </div>

          {/* Sync Progress */}
          {isSyncing && syncProgress > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span>Synchronizing...</span>
                <span>{Math.round(syncProgress)}%</span>
              </div>
              <Progress value={syncProgress} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Network Error Alert */}
      {hasNetworkError && error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <div>
              <strong>Connection Error</strong>
              <p className="mt-1 text-sm">
                {error.message || 'Unable to connect to server. Please check your internet connection.'}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={retryOperation}
              disabled={isAutoRetrying}
              className="ml-4"
            >
              {isAutoRetrying ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1" />
              )}
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Operations Status */}
      {operations.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center space-x-2">
              <Save className="h-4 w-4" />
              <span>Recent Operations</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {operations.slice(0, 5).map((op) => (
                <div 
                  key={op.id}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-1">
                      {op.status === 'completed' && (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      )}
                      {op.status === 'processing' && (
                        <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                      )}
                      {op.status === 'failed' && (
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                      )}
                      {op.status === 'queued' && (
                        <Clock className="h-4 w-4 text-yellow-600" />
                      )}
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium">
                        {op.type.charAt(0).toUpperCase() + op.type.slice(1)} {op.entityName}
                      </p>
                      <p className="text-xs text-gray-600">
                        {op.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>

                  <Badge 
                    variant={
                      op.status === 'completed' ? 'default' :
                      op.status === 'failed' ? 'destructive' :
                      op.status === 'queued' ? 'secondary' : 'default'
                    }
                  >
                    {op.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
