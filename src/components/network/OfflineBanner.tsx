
import React, { useState } from 'react';
import { WifiOff, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNetwork } from '@/contexts/NetworkContext';

export function OfflineBanner() {
  const { online, retryNow } = useNetwork();
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

  return (
    <div
      className="sticky top-0 z-50 border-b border-amber-200 bg-amber-50 px-4 py-3"
      role="status"
      aria-live="polite"
      aria-label="Network status">

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="text-amber-600">
            <WifiOff className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">
              You're offline. We'll retry when you're back online.
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetry}
            disabled={isRetrying}
            className="border-amber-300 text-amber-700 hover:bg-amber-100 hover:border-amber-400 disabled:opacity-50"
            aria-label={isRetrying ? "Retrying connection" : "Retry connection now"}>

            {isRetrying ?
            <>
                <RotateCcw className="h-3 w-3 mr-1 animate-spin" />
                Retrying...
              </> :

            <>
                <RotateCcw className="h-3 w-3 mr-1" />
                Retry now
              </>
            }
          </Button>
        </div>
      </div>
    </div>);

}