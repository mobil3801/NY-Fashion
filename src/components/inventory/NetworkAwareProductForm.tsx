
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import {
  Save,
  Wifi,
  WifiOff,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Upload,
  Loader2 } from
'lucide-react';
import { useInventory } from '@/contexts/InventoryContext';
import { useNetwork } from '@/contexts/NetworkContext';
import { useNetworkAwareInventory } from './NetworkAwareInventoryProvider';
import { toast } from '@/hooks/use-toast';
import ProductForm from './ProductForm';

interface NetworkAwareProductFormProps {
  product?: any;
  onClose: () => void;
  onSave?: () => void;
}

interface SaveState {
  status: 'idle' | 'saving' | 'saved_online' | 'saved_offline' | 'failed';
  timestamp?: Date;
  error?: string;
  retryCount: number;
}

export function NetworkAwareProductForm({ product, onClose, onSave }: NetworkAwareProductFormProps) {
  const { saveProduct } = useInventory();
  const { online, connectionState, retryNow } = useNetwork();
  const { isOnline, retryOperation } = useNetworkAwareInventory();

  const [saveState, setSaveState] = useState<SaveState>({
    status: 'idle',
    retryCount: 0
  });
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<any>(null);
  const [showNetworkWarning, setShowNetworkWarning] = useState(false);

  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();
  const formDataRef = useRef<any>(null);

  // Monitor network status changes
  useEffect(() => {
    if (!online && saveState.status === 'idle') {
      setShowNetworkWarning(true);
    } else if (online && showNetworkWarning) {
      setShowNetworkWarning(false);

      // If there are pending changes and we're back online, offer to save
      if (pendingChanges) {
        toast({
          title: "Connection Restored",
          description: "Would you like to save your pending changes?",
          action:
          <Button size="sm" onClick={() => handleSave(pendingChanges, true)}>
              Save Now
            </Button>

        });
      }
    }
  }, [online, saveState.status, showNetworkWarning, pendingChanges]);

  // Auto-save functionality
  const triggerAutoSave = useCallback((formData: any) => {
    if (!autoSaveEnabled || !online) return;

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      handleSave(formData, false, true);
    }, 3000); // Auto-save after 3 seconds of inactivity
  }, [autoSaveEnabled, online]);

  // Enhanced save handler with network awareness
  const handleSave = useCallback(async (formData: any, showToast = true, isAutoSave = false) => {
    formDataRef.current = formData;

    // Check if we're online
    if (!online && !isAutoSave) {
      setSaveState({
        status: 'saved_offline',
        timestamp: new Date(),
        retryCount: 0
      });
      setPendingChanges(formData);

      if (showToast) {
        toast({
          title: "Saved Offline",
          description: "Your changes are saved locally and will sync when connection is restored.",
          variant: "default"
        });
      }
      return;
    }

    // Prevent auto-save if already saving
    if (isAutoSave && saveState.status === 'saving') {
      return;
    }

    setSaveState((prev) => ({
      ...prev,
      status: 'saving',
      error: undefined
    }));

    try {
      await saveProduct(formData);

      setSaveState({
        status: 'saved_online',
        timestamp: new Date(),
        retryCount: 0
      });

      // Clear pending changes on successful save
      setPendingChanges(null);

      if (showToast && !isAutoSave) {
        toast({
          title: "Saved Successfully",
          description: product ? "Product updated successfully." : "Product created successfully.",
          variant: "default"
        });
      }

      // Call parent save handler
      if (onSave && !isAutoSave) {
        onSave();
      }

    } catch (error: any) {
      const isNetworkError = error.message.includes('network') ||
      error.message.includes('connection') ||
      !online;

      setSaveState((prev) => ({
        status: isNetworkError ? 'saved_offline' : 'failed',
        timestamp: new Date(),
        error: error.message,
        retryCount: prev.retryCount + 1
      }));

      if (isNetworkError) {
        setPendingChanges(formData);

        if (showToast) {
          toast({
            title: "Saved Offline",
            description: "Connection lost. Your changes are saved locally and will sync when reconnected.",
            variant: "default"
          });
        }
      } else {
        if (showToast) {
          toast({
            title: "Save Failed",
            description: error.message || "Failed to save product. Please try again.",
            variant: "destructive"
          });
        }
      }
    }
  }, [online, saveProduct, product, onSave, saveState.status]);

  // Retry save operation
  const handleRetry = useCallback(async () => {
    if (!formDataRef.current) return;

    // First try to restore connection
    if (!online) {
      try {
        await retryNow();
        // Wait for connection to stabilize
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        toast({
          title: "Connection Failed",
          description: "Unable to restore connection. Please check your network.",
          variant: "destructive"
        });
        return;
      }
    }

    // Then retry the save
    await handleSave(formDataRef.current, true);
  }, [online, retryNow, handleSave]);

  // Form change handler for auto-save
  const handleFormChange = useCallback((formData: any) => {
    formDataRef.current = formData;

    if (autoSaveEnabled && online) {
      triggerAutoSave(formData);
    }
  }, [autoSaveEnabled, online, triggerAutoSave]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  const getSaveStatusDisplay = () => {
    switch (saveState.status) {
      case 'saving':
        return {
          icon: Loader2,
          iconClass: 'animate-spin text-blue-600',
          text: 'Saving...',
          bgClass: 'bg-blue-50 border-blue-200'
        };

      case 'saved_online':
        return {
          icon: CheckCircle2,
          iconClass: 'text-green-600',
          text: `Saved ${saveState.timestamp?.toLocaleTimeString()}`,
          bgClass: 'bg-green-50 border-green-200'
        };

      case 'saved_offline':
        return {
          icon: WifiOff,
          iconClass: 'text-amber-600',
          text: 'Saved offline - will sync when online',
          bgClass: 'bg-amber-50 border-amber-200'
        };

      case 'failed':
        return {
          icon: AlertTriangle,
          iconClass: 'text-red-600',
          text: `Save failed${saveState.retryCount > 0 ? ` (${saveState.retryCount} attempts)` : ''}`,
          bgClass: 'bg-red-50 border-red-200'
        };

      default:
        return null;
    }
  };

  const statusDisplay = getSaveStatusDisplay();

  return (
    <div className="space-y-4">
      {/* Network Status Warning */}
      {showNetworkWarning &&
      <Alert className="border-amber-200 bg-amber-50">
          <WifiOff className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <div>
                <strong>You are offline</strong>
                <p className="mt-1 text-sm">
                  Changes will be saved locally and synced when your connection is restored.
                </p>
              </div>
              <Button
              size="sm"
              variant="outline"
              onClick={retryOperation}
              className="ml-4">

                <Wifi className="h-3 w-3 mr-1" />
                Reconnect
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      }

      {/* Save Status Display */}
      {statusDisplay &&
      <Card className={`${statusDisplay.bgClass} border`}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <statusDisplay.icon className={`h-4 w-4 ${statusDisplay.iconClass}`} />
                <span className="text-sm font-medium">{statusDisplay.text}</span>
                {saveState.error &&
              <Badge variant="destructive" className="text-xs">
                    {saveState.error}
                  </Badge>
              }
              </div>

              {/* Action buttons based on status */}
              <div className="flex items-center space-x-2">
                {saveState.status === 'saved_offline' && online &&
              <Button
                size="sm"
                variant="outline"
                onClick={handleRetry}>

                    <Upload className="h-3 w-3 mr-1" />
                    Sync Now
                  </Button>
              }

                {saveState.status === 'failed' &&
              <Button
                size="sm"
                variant="outline"
                onClick={handleRetry}>

                    <Loader2 className="h-3 w-3 mr-1" />
                    Retry
                  </Button>
              }

                {pendingChanges &&
              <Badge variant="secondary" className="flex items-center space-x-1">
                    <Clock className="h-3 w-3" />
                    <span>Pending</span>
                  </Badge>
              }
              </div>
            </div>
          </CardContent>
        </Card>
      }

      {/* Connection Quality Indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Badge
            variant={online ? 'default' : 'destructive'}
            className="flex items-center space-x-1">

            {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            <span>{online ? 'Online' : 'Offline'}</span>
          </Badge>

          {connectionState === 'poor_connection' &&
          <Badge variant="secondary" className="flex items-center space-x-1">
              <AlertTriangle className="h-3 w-3" />
              <span>Poor Connection</span>
            </Badge>
          }
        </div>

        {/* Auto-save toggle */}
        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-600">Auto-save:</label>
          <Button
            size="sm"
            variant={autoSaveEnabled ? 'default' : 'outline'}
            onClick={() => setAutoSaveEnabled(!autoSaveEnabled)}
            disabled={!online}>

            {autoSaveEnabled ? 'On' : 'Off'}
          </Button>
        </div>
      </div>

      {/* Enhanced Product Form */}
      <ProductForm
        product={product}
        onClose={onClose}
        onSave={(formData) => handleSave(formData, true)}
        onChange={handleFormChange} />

    </div>);

}