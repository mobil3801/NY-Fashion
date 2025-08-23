
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  WifiOff,
  Database,
  Upload,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Trash2,
  RefreshCw,
  Loader2 } from
'lucide-react';
import { useNetwork } from '@/contexts/NetworkContext';
import { useInventory } from '@/contexts/InventoryContext';
import { toast } from '@/hooks/use-toast';

interface OfflineOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'product' | 'category' | 'stock_movement';
  data: any;
  timestamp: Date;
  retryCount: number;
  lastError?: string;
}

interface OfflineData {
  products: any[];
  categories: any[];
  lastUpdate: Date;
  version: number;
}

const OFFLINE_STORAGE_KEY = 'inventory_offline_data';
const OFFLINE_OPERATIONS_KEY = 'inventory_offline_operations';
const MAX_OFFLINE_AGE = 24 * 60 * 60 * 1000; // 24 hours

export function OfflineInventoryManager() {
  const { online, connectionState, retryNow } = useNetwork();
  const {
    products,
    categories,
    loading,
    fetchProducts,
    fetchCategories,
    saveProduct
  } = useInventory();

  const [offlineOperations, setOfflineOperations] = useState<OfflineOperation[]>([]);
  const [offlineData, setOfflineData] = useState<OfflineData | null>(null);
  const [syncProgress, setSyncProgress] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [storageUsage, setStorageUsage] = useState<{used: number;quota: number;} | null>(null);

  // Load offline data and operations from localStorage
  useEffect(() => {
    try {
      const savedOperations = localStorage.getItem(OFFLINE_OPERATIONS_KEY);
      if (savedOperations) {
        const operations = JSON.parse(savedOperations).map((op: any) => ({
          ...op,
          timestamp: new Date(op.timestamp)
        }));
        setOfflineOperations(operations);
      }

      const savedData = localStorage.getItem(OFFLINE_STORAGE_KEY);
      if (savedData) {
        const data = JSON.parse(savedData);
        data.lastUpdate = new Date(data.lastUpdate);
        setOfflineData(data);
      }
    } catch (error) {
      console.error('Error loading offline data:', error);
    }
  }, []);

  // Save offline operations to localStorage
  const saveOfflineOperations = useCallback((operations: OfflineOperation[]) => {
    try {
      localStorage.setItem(OFFLINE_OPERATIONS_KEY, JSON.stringify(operations));
    } catch (error) {
      console.error('Error saving offline operations:', error);
      toast({
        title: "Storage Error",
        description: "Unable to save offline changes. Storage may be full.",
        variant: "destructive"
      });
    }
  }, []);

  // Save offline data
  const saveOfflineData = useCallback(() => {
    if (products.length === 0 && categories.length === 0) return;

    const data: OfflineData = {
      products,
      categories,
      lastUpdate: new Date(),
      version: Date.now()
    };

    try {
      localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(data));
      setOfflineData(data);
    } catch (error) {
      console.error('Error saving offline data:', error);
    }
  }, [products, categories]);

  // Auto-save data when online and data changes
  useEffect(() => {
    if (online && (products.length > 0 || categories.length > 0)) {
      saveOfflineData();
    }
  }, [online, products, categories, saveOfflineData]);

  // Add offline operation
  const addOfflineOperation = useCallback((operation: Omit<OfflineOperation, 'id' | 'timestamp' | 'retryCount'>) => {
    const newOperation: OfflineOperation = {
      ...operation,
      id: `${operation.type}_${operation.entity}_${Date.now()}_${Math.random()}`,
      timestamp: new Date(),
      retryCount: 0
    };

    const updatedOperations = [...offlineOperations, newOperation];
    setOfflineOperations(updatedOperations);
    saveOfflineOperations(updatedOperations);

    return newOperation.id;
  }, [offlineOperations, saveOfflineOperations]);

  // Remove offline operation
  const removeOfflineOperation = useCallback((operationId: string) => {
    const updatedOperations = offlineOperations.filter((op) => op.id !== operationId);
    setOfflineOperations(updatedOperations);
    saveOfflineOperations(updatedOperations);
  }, [offlineOperations, saveOfflineOperations]);

  // Process offline operations
  const processOfflineOperations = useCallback(async () => {
    if (!online || offlineOperations.length === 0) return;

    setIsSyncing(true);
    setSyncProgress(0);

    let processedCount = 0;
    const totalOperations = offlineOperations.length;

    for (const operation of offlineOperations) {
      try {
        setSyncProgress(processedCount / totalOperations * 100);

        // Process different types of operations
        switch (operation.type) {
          case 'create':
          case 'update':
            if (operation.entity === 'product') {
              await saveProduct(operation.data);
            }
            // Add other entity types as needed
            break;

          case 'delete':
            // Handle delete operations
            break;
        }

        // Remove successful operation
        removeOfflineOperation(operation.id);
        processedCount++;

      } catch (error: any) {
        console.error('Error processing offline operation:', error);

        // Update retry count
        const updatedOperation = {
          ...operation,
          retryCount: operation.retryCount + 1,
          lastError: error.message
        };

        if (operation.retryCount >= 3) {
          // Max retries reached, remove operation
          removeOfflineOperation(operation.id);
        } else {
          // Update operation with error info
          const updatedOperations = offlineOperations.map((op) =>
          op.id === operation.id ? updatedOperation : op
          );
          setOfflineOperations(updatedOperations);
          saveOfflineOperations(updatedOperations);
        }

        processedCount++;
      }
    }

    setSyncProgress(100);
    setIsSyncing(false);

    if (processedCount > 0) {
      // Refresh data after sync
      await Promise.all([fetchProducts(), fetchCategories()]);

      toast({
        title: "Sync Complete",
        description: `Successfully synced ${processedCount} offline changes.`,
        variant: "default"
      });
    }

    setTimeout(() => setSyncProgress(0), 1000);
  }, [online, offlineOperations, saveProduct, removeOfflineOperation, fetchProducts, fetchCategories]);

  // Auto-sync when coming online
  useEffect(() => {
    if (online && connectionState === 'online' && offlineOperations.length > 0) {
      // Small delay to ensure connection is stable
      setTimeout(processOfflineOperations, 1000);
    }
  }, [online, connectionState, offlineOperations.length, processOfflineOperations]);

  // Check storage usage
  useEffect(() => {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      navigator.storage.estimate().then((estimate) => {
        if (estimate.usage && estimate.quota) {
          setStorageUsage({
            used: estimate.usage,
            quota: estimate.quota
          });
        }
      });
    }
  }, [offlineOperations, offlineData]);

  // Clear old offline data
  const clearOldOfflineData = useCallback(() => {
    if (offlineData && Date.now() - offlineData.lastUpdate.getTime() > MAX_OFFLINE_AGE) {
      localStorage.removeItem(OFFLINE_STORAGE_KEY);
      setOfflineData(null);

      toast({
        title: "Offline Data Cleared",
        description: "Old offline data has been cleared to free up space.",
        variant: "default"
      });
    }
  }, [offlineData]);

  // Manual sync trigger
  const handleManualSync = useCallback(async () => {
    if (!online) {
      try {
        await retryNow();
      } catch (error) {
        toast({
          title: "Connection Failed",
          description: "Unable to establish connection. Please check your network.",
          variant: "destructive"
        });
        return;
      }
    }

    await processOfflineOperations();
  }, [online, retryNow, processOfflineOperations]);

  // Calculate storage usage percentage
  const storagePercentage = storageUsage ?
  Math.round(storageUsage.used / storageUsage.quota * 100) : 0;

  const isOfflineDataStale = offlineData &&
  Date.now() - offlineData.lastUpdate.getTime() > MAX_OFFLINE_AGE;

  // Don't show if online and no offline operations
  if (online && offlineOperations.length === 0 && !offlineData) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Offline Status Card */}
      <Card className={`${!online ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2">
            {!online ?
            <WifiOff className="h-5 w-5 text-amber-600" /> :

            <CheckCircle2 className="h-5 w-5 text-green-600" />
            }
            <span>Offline Mode</span>
            {offlineOperations.length > 0 &&
            <Badge variant="secondary">
                {offlineOperations.length} pending
              </Badge>
            }
          </CardTitle>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            {!online ?
            <Alert>
                <Database className="h-4 w-4" />
                <AlertDescription>
                  You are currently offline. All changes are being saved locally and will 
                  sync automatically when your connection is restored.
                </AlertDescription>
              </Alert> :

            offlineOperations.length > 0 &&
            <Alert>
                  <Upload className="h-4 w-4" />
                  <AlertDescription>
                    You have {offlineOperations.length} offline changes ready to sync.
                  </AlertDescription>
                </Alert>

            }

            {/* Offline Data Info */}
            {offlineData &&
            <div className="bg-white p-3 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-sm">Cached Data</h4>
                  {isOfflineDataStale &&
                <Badge variant="destructive">Stale</Badge>
                }
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Products:</span>
                    <span className="ml-1 font-medium">{offlineData.products.length}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Categories:</span>
                    <span className="ml-1 font-medium">{offlineData.categories.length}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-600">Last Updated:</span>
                    <span className="ml-1 font-medium">
                      {offlineData.lastUpdate.toLocaleDateString()} {offlineData.lastUpdate.toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>
            }

            {/* Storage Usage */}
            {storageUsage &&
            <div className="bg-white p-3 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-sm">Storage Usage</h4>
                  <span className="text-sm text-gray-600">
                    {storagePercentage}% used
                  </span>
                </div>
                <Progress value={storagePercentage} className="h-2" />
                <p className="text-xs text-gray-600 mt-1">
                  {Math.round(storageUsage.used / 1024 / 1024)} MB of {Math.round(storageUsage.quota / 1024 / 1024)} MB
                </p>
              </div>
            }

            {/* Sync Progress */}
            {isSyncing &&
            <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Syncing changes...</span>
                  <span className="text-sm text-gray-600">{Math.round(syncProgress)}%</span>
                </div>
                <Progress value={syncProgress} className="h-2" />
              </div>
            }

            {/* Actions */}
            <div className="flex items-center justify-between">
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleManualSync}
                  disabled={!online || isSyncing || offlineOperations.length === 0}>

                  {isSyncing ?
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" /> :

                  <Upload className="h-4 w-4 mr-1" />
                  }
                  Sync Now
                </Button>
                
                {offlineData &&
                <Button
                  size="sm"
                  variant="outline"
                  onClick={clearOldOfflineData}
                  disabled={!isOfflineDataStale}>

                    <Trash2 className="h-4 w-4 mr-1" />
                    Clear Cache
                  </Button>
                }
              </div>

              {offlineOperations.length > 0 &&
              <Badge variant="secondary" className="flex items-center space-x-1">
                  <Clock className="h-3 w-3" />
                  <span>{offlineOperations.length} pending</span>
                </Badge>
              }
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pending Operations List */}
      {offlineOperations.length > 0 &&
      <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pending Changes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {offlineOperations.slice(0, 5).map((operation) =>
            <div
              key={operation.id}
              className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">

                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-1">
                      {operation.type === 'create' && <Database className="h-4 w-4 text-blue-600" />}
                      {operation.type === 'update' && <RefreshCw className="h-4 w-4 text-yellow-600" />}
                      {operation.type === 'delete' && <Trash2 className="h-4 w-4 text-red-600" />}
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium">
                        {operation.type.charAt(0).toUpperCase() + operation.type.slice(1)} {operation.entity}
                      </p>
                      <p className="text-xs text-gray-600">
                        {operation.timestamp.toLocaleTimeString()}
                      </p>
                      {operation.lastError &&
                  <p className="text-xs text-red-600">
                          Error: {operation.lastError}
                        </p>
                  }
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {operation.retryCount > 0 &&
                <Badge variant="secondary" className="text-xs">
                        Retry {operation.retryCount}
                      </Badge>
                }
                    
                    <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeOfflineOperation(operation.id)}
                  className="h-6 w-6 p-0">

                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
            )}
              
              {offlineOperations.length > 5 &&
            <p className="text-sm text-gray-600 text-center">
                  And {offlineOperations.length - 5} more...
                </p>
            }
            </div>
          </CardContent>
        </Card>
      }
    </div>);

}