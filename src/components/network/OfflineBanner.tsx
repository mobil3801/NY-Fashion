
import React, { useState } from 'react';
import { AlertTriangle, Wifi, WifiOff, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNetwork } from '@/contexts/NetworkContext';

export function OfflineBanner() {
  const { online, status, retryNow } = useNetwork();
  const [isRetrying, setIsRetrying] = useState(false);

  // Don't show banner if online
  if (online) {
    return null;
  }

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await retryNow();
    } finally {
      setIsRetrying(false);
    }
  };

  const getStatusMessage = () => {
    if (status.consecutiveFailures > 0) {
      return `Connection lost (${status.consecutiveFailures} failed attempts)`;
    }
    return 'You\'re currently offline';
  };

  const getStatusIcon = () => {
    if (status.consecutiveFailures > 2) {
      return <AlertTriangle className="h-4 w-4" />;
    }
    return <WifiOff className="h-4 w-4" />;
  };

  return (
    <div
      className="sticky top-0 z-50 border-b border-amber-200 bg-amber-50 px-4 py-3"
      role="status"
      aria-live="polite"
      aria-label="Network status">

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="text-amber-600">
            {getStatusIcon()}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">
              {getStatusMessage()}
            </p>
            {status.lastError &&
            <p className="text-xs text-amber-600 mt-1">
                Changes will be saved locally and synced when connection is restored
              </p>
            }
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetry}
            disabled={isRetrying}
            className="border-amber-300 text-amber-700 hover:bg-amber-100 hover:border-amber-400"
            aria-label="Retry connection">

            {isRetrying ?
            <>
                <RotateCcw className="h-3 w-3 mr-1 animate-spin" />
                Checking...
              </> :

            <>
                <Wifi className="h-3 w-3 mr-1" />
                Retry
              </>
            }
          </Button>
        </div>
      </div>
    </div>);

}