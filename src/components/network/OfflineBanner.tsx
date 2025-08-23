
import React, { useState, useEffect } from 'react';
import { WifiOff, RotateCcw, AlertCircle, Server, Clock, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNetwork } from '@/contexts/NetworkContext';
import { NetworkErrorClassifier } from '@/lib/network/error-classifier';

export function OfflineBanner() {
  const {
    online,
    connectionState,
    errorDetails,
    recoveryInfo,
    retryNow,
    abortRetry,
    isAutoRetrying,
    retryCount
  } = useNetwork();

  const [isManualRetrying, setIsManualRetrying] = useState(false);
  const [nextAutoRetryIn, setNextAutoRetryIn] = useState<number>(0);
  const [isDismissed, setIsDismissed] = useState(false);

  // Reset dismissal when connection state changes
  React.useEffect(() => {
    if (connectionState === 'recovering' || connectionState === 'reconnecting') {
      setIsDismissed(false);
    }
  }, [connectionState]);

  // Don't show banner if online (unless recovering) or if dismissed
  if (online && connectionState !== 'recovering' || isDismissed) {
    return null;
  }

  // Auto-retry countdown timer
  useEffect(() => {
    if (isAutoRetrying && errorDetails) {
      const delay = NetworkErrorClassifier.getRetryDelay(errorDetails.type, retryCount + 1);
      setNextAutoRetryIn(Math.ceil(delay / 1000));

      const interval = setInterval(() => {
        setNextAutoRetryIn((prev) => Math.max(0, prev - 1));
      }, 1000);

      return () => clearInterval(interval);
    }
    setNextAutoRetryIn(0);
  }, [isAutoRetrying, errorDetails, retryCount]);

  const handleRetry = async () => {
    setIsManualRetrying(true);
    try {
      await retryNow();
    } finally {
      setIsManualRetrying(false);
    }
  };

  const handleAbort = () => {
    abortRetry();
    setIsManualRetrying(false);
  };

  const getStatusIcon = () => {
    if (connectionState === 'recovering') {
      return <Wifi className="h-4 w-4 text-green-600" />;
    }

    if (!errorDetails) {
      return <WifiOff className="h-4 w-4" />;
    }

    switch (errorDetails.type) {
      case 'server_error':
        return <Server className="h-4 w-4" />;
      case 'timeout':
        return <Clock className="h-4 w-4" />;
      case 'network_unavailable':
        return <WifiOff className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getBannerStyles = () => {
    if (connectionState === 'recovering') {
      return 'border-green-200 bg-green-50';
    }

    if (connectionState === 'reconnecting') {
      return 'border-blue-200 bg-blue-50';
    }

    if (errorDetails?.type === 'server_error') {
      return 'border-red-200 bg-red-50';
    }

    if (errorDetails?.type === 'timeout') {
      return 'border-orange-200 bg-orange-50';
    }

    return 'border-amber-200 bg-amber-50';
  };

  const getTextColor = () => {
    if (connectionState === 'recovering') return 'text-green-800';
    if (connectionState === 'reconnecting') return 'text-blue-800';
    if (errorDetails?.type === 'server_error') return 'text-red-800';
    if (errorDetails?.type === 'timeout') return 'text-orange-800';
    return 'text-amber-800';
  };

  const getIconColor = () => {
    if (connectionState === 'recovering') return 'text-green-600';
    if (connectionState === 'reconnecting') return 'text-blue-600';
    if (errorDetails?.type === 'server_error') return 'text-red-600';
    if (errorDetails?.type === 'timeout') return 'text-orange-600';
    return 'text-amber-600';
  };

  const getMessage = () => {
    if (connectionState === 'recovering') {
      const duration = recoveryInfo?.wasOfflineFor ?
      recoveryInfo.wasOfflineFor > 60000 ?
      `${Math.round(recoveryInfo.wasOfflineFor / 60000)} minute${Math.round(recoveryInfo.wasOfflineFor / 60000) > 1 ? 's' : ''}` :
      `${Math.round(recoveryInfo.wasOfflineFor / 1000)} seconds` :
      'briefly';

      return `✓ Connection restored after ${duration}. Syncing data...`;
    }

    if (connectionState === 'reconnecting') {
      if (isAutoRetrying && nextAutoRetryIn > 0) {
        return `Reconnecting... Next attempt in ${nextAutoRetryIn}s`;
      }
      return 'Attempting to reconnect...';
    }

    if (errorDetails) {
      return errorDetails.userMessage;
    }

    return "Connection lost. Your changes are saved locally and will sync when reconnected.";
  };

  const getActionButton = () => {
    if (connectionState === 'recovering') {
      return (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsDismissed(true)}
          className="border-current text-current hover:bg-current/10 hover:border-current/40"
          aria-label="Dismiss connection restored message">

          Dismiss
        </Button>);

    }

    const isRetrying = isManualRetrying || isAutoRetrying;

    if (isRetrying) {
      return (
        <div className="flex items-center gap-2">
          {retryCount > 0 &&
          <Badge variant="secondary" className="text-xs">
              Attempt {retryCount + 1}
            </Badge>
          }
          <Button
            variant="outline"
            size="sm"
            onClick={handleAbort}
            className="border-current text-current hover:bg-current/10 hover:border-current/40">
            Cancel
          </Button>
        </div>);

    }

    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRetry}
          className="border-current text-current hover:bg-current/10 hover:border-current/40"
          aria-label="Retry connection now">

          <RotateCcw className="h-3 w-3 mr-1" />
          Try again
        </Button>
        
        {!isRetrying &&
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsDismissed(true)}
          className="border-current text-current hover:bg-current/10 hover:border-current/40 px-2"
          aria-label="Dismiss offline message">

            ✕
          </Button>
        }
      </div>);

  };

  return (
    <div
      className={`sticky top-0 z-50 border-b px-4 py-3 transition-colors ${getBannerStyles()}`}
      role="status"
      aria-live="polite"
      aria-label={`Network status: ${connectionState}`}>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={getIconColor()}>
            {getStatusIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${getTextColor()}`}>
              {getMessage()}
            </p>
            {errorDetails?.suggestedAction && connectionState !== 'recovering' &&
            <p className={`text-xs mt-1 opacity-75 ${getTextColor()}`}>
                {errorDetails.suggestedAction}
              </p>
            }
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0">
          {getActionButton()}
        </div>
      </div>
    </div>);


}