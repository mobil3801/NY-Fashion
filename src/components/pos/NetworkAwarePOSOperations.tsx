
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { WifiOff, Wifi, Clock, AlertTriangle } from 'lucide-react';
import { useNetwork } from '@/contexts/NetworkContext';
import { networkAPI } from '@/lib/network/api-wrapper';
import { toast } from '@/hooks/use-toast';

interface NetworkAwarePOSOperationsProps {
  onCreateSale: (saleData: any) => Promise<any>;
  onProcessReturn: (returnData: any) => Promise<any>;
  onSyncOfflineData: () => Promise<void>;
  className?: string;
}

export function NetworkAwarePOSOperations({
  onCreateSale,
  onProcessReturn,
  onSyncOfflineData,
  className = ''
}: NetworkAwarePOSOperationsProps) {
  const { online, status, retryNow } = useNetwork();
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingOperations, setPendingOperations] = useState<any[]>([]);

  const handleCreateSale = async (saleData: any) => {
    try {
      await networkAPI.createWithOfflineSupport(
        () => onCreateSale(saleData),
        'Sale'
      );
    } catch (error) {
      // Error handling is managed by networkAPI
      console.error('Sale creation error:', error);
    }
  };

  const handleProcessReturn = async (returnData: any) => {
    try {
      await networkAPI.updateWithOfflineSupport(
        () => onProcessReturn(returnData),
        'Return'
      );
    } catch (error) {
      console.error('Return processing error:', error);
    }
  };

  const handleSyncOfflineData = async () => {
    setIsSyncing(true);
    try {
      await retryNow(); // Trigger network check first
      await networkAPI.execute(
        () => onSyncOfflineData(),
        {
          showSuccessToast: true,
          successMessage: 'All data synchronized successfully',
          requireOnline: true
        }
      );
    } catch (error) {
      toast({
        title: "Sync Failed",
        description: "Could not sync offline data. Will retry automatically when online.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const getNetworkStatusBadge = () => {
    if (online) {
      if (status.consecutiveFailures === 0) {
        return (
          <Badge variant="default" className="gap-1">
            <Wifi className="h-3 w-3" />
            Online
          </Badge>
        );
      } else {
        return (
          <Badge variant="secondary" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            Unstable
          </Badge>
        );
      }
    } else {
      return (
        <Badge variant="destructive" className="gap-1">
          <WifiOff className="h-3 w-3" />
          Offline
        </Badge>
      );
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Network Status Bar */}
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Network Status:</span>
          {getNetworkStatusBadge()}
        </div>
        
        {!online && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleSyncOfflineData}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <>
                  <Clock className="h-3 w-3 animate-spin mr-1" />
                  Syncing...
                </>
              ) : (
                <>
                  <Wifi className="h-3 w-3 mr-1" />
                  Retry Sync
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Offline Alert */}
      {!online && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            You're currently offline. Sales and returns will be saved locally and automatically 
            synced when your connection returns.
          </AlertDescription>
        </Alert>
      )}

      {/* Connection Issues Alert */}
      {online && status.consecutiveFailures > 0 && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            Connection is unstable ({status.consecutiveFailures} recent failures). 
            Operations may take longer than usual.
          </AlertDescription>
        </Alert>
      )}

      {/* POS Operation Buttons */}
      <div className="grid grid-cols-2 gap-4">
        <Button
          onClick={() => handleCreateSale({})}
          disabled={false} // Always allow - will queue offline
          className="h-12"
        >
          <div className="text-center">
            <div className="font-medium">Process Sale</div>
            <div className="text-xs opacity-75">
              {online ? 'Immediate' : 'Will sync later'}
            </div>
          </div>
        </Button>

        <Button
          onClick={() => handleProcessReturn({})}
          disabled={false} // Always allow - will queue offline
          variant="outline"
          className="h-12"
        >
          <div className="text-center">
            <div className="font-medium">Process Return</div>
            <div className="text-xs opacity-75">
              {online ? 'Immediate' : 'Will sync later'}
            </div>
          </div>
        </Button>
      </div>

      {/* Pending Operations Display */}
      {pendingOperations.length > 0 && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">
              Pending Sync: {pendingOperations.length} operations
            </span>
          </div>
          <div className="text-xs text-blue-700">
            These will be automatically processed when connection is restored.
          </div>
        </div>
      )}
    </div>
  );
}

export default NetworkAwarePOSOperations;
