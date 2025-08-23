
import React, { useState, useEffect } from 'react';
import { WifiOff, RefreshCw, X, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNetwork } from '@/contexts/NetworkContext';
import { NetworkErrorClassifier } from '@/lib/network/error-classifier';

interface OfflineBannerProps {
  className?: string;
}

export function OfflineBanner({ className = '' }: OfflineBannerProps) {
  const {
    online,
    connectionState,
    errorDetails,
    recoveryInfo,
    retryNow,
    isAutoRetrying,
    getDiagnostics,
    status
  } = useNetwork();

  const [isDismissed, setIsDismissed] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const diagnostics = getDiagnostics();

  // Auto-dismiss when back online
  useEffect(() => {
    if (online && connectionState === 'online') {
      const timer = setTimeout(() => {
        setIsDismissed(true);
      }, 3000); // Show "back online" message for 3 seconds

      return () => clearTimeout(timer);
    } else {
      setIsDismissed(false);
    }
  }, [online, connectionState]);

  // Countdown for next auto-retry
  useEffect(() => {
    if (status.nextRetryAt && !isAutoRetrying) {
      const updateCountdown = () => {
        const now = Date.now();
        const nextRetry = status.nextRetryAt!.getTime();
        const diff = Math.max(0, Math.ceil((nextRetry - now) / 1000));
        setCountdown(diff);

        if (diff <= 0) {
          setCountdown(null);
        }
      };

      updateCountdown();
      const interval = setInterval(updateCountdown, 1000);

      return () => clearInterval(interval);
    } else {
      setCountdown(null);
    }
  }, [status.nextRetryAt, isAutoRetrying]);

  // Don't show banner if dismissed or if we should hide it
  const shouldShowBanner = () => {
    if (isDismissed) return false;
    if (online && connectionState === 'online') return false;

    // Show for all offline states
    if (!online) return true;

    // Show during recovery
    if (connectionState === 'recovering') return true;

    // Show if we have error details that warrant a banner
    if (errorDetails && NetworkErrorClassifier.shouldShowBanner(
      errorDetails.type,
      status.consecutiveFailures || 0
    )) {
      return true;
    }

    return false;
  };

  if (!shouldShowBanner()) {
    return null;
  }

  const getBannerVariant = () => {
    if (connectionState === 'recovering') return 'success';
    if (connectionState === 'reconnecting') return 'warning';
    if (connectionState === 'poor_connection') return 'warning';
    return 'destructive';
  };

  const getBannerMessage = () => {
    if (connectionState === 'recovering') {
      return {
        title: 'Connection Restored',
        description: recoveryInfo ?
        `Back online after ${Math.round(recoveryInfo.wasOfflineFor / 1000)}s. Syncing changes...` :
        'Connection restored. Syncing changes...'
      };
    }

    if (connectionState === 'reconnecting') {
      return {
        title: 'Reconnecting...',
        description: countdown ?
        `Retrying in ${countdown}s` :
        'Attempting to restore connection'
      };
    }

    if (connectionState === 'poor_connection') {
      return {
        title: 'Poor Connection',
        description: 'Your connection is unstable. Some features may be limited.'
      };
    }

    if (errorDetails) {
      return {
        title: 'Connection Lost',
        description: errorDetails.userMessage
      };
    }

    return {
      title: 'You\'re Offline',
      description: 'Check your internet connection. Changes will sync when you\'re back online.'
    };
  };

  const getIcon = () => {
    if (connectionState === 'recovering') return <CheckCircle className="w-5 h-5" />;
    if (connectionState === 'reconnecting') return <RefreshCw className="w-5 h-5 animate-spin" />;
    if (connectionState === 'poor_connection') return <AlertTriangle className="w-5 h-5" />;
    return <WifiOff className="w-5 h-5" />;
  };

  const message = getBannerMessage();
  const variant = getBannerVariant();

  const bannerClasses = {
    destructive: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-200',
    success: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200'
  };

  return (
    <div className={`border-b ${bannerClasses[variant]} ${className}`}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            {getIcon()}
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{message.title}</span>
                {diagnostics.queuedOperations > 0 &&
                <Badge variant="outline" className="text-xs">
                    {diagnostics.queuedOperations} queued
                  </Badge>
                }
              </div>
              
              <div className="text-sm opacity-90">
                {message.description}
                {showDetails && errorDetails?.suggestedAction &&
                <div className="mt-1 text-xs">
                    💡 {errorDetails.suggestedAction}
                  </div>
                }
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!online &&
            <>
                <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs">

                  {showDetails ? 'Less' : 'Details'}
                </Button>
                
                <Button
                variant="outline"
                size="sm"
                onClick={retryNow}
                disabled={isAutoRetrying}
                className="text-xs">

                  {isAutoRetrying ?
                <>
                      <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                      Retrying...
                    </> :
                countdown ?
                <>
                      <Clock className="w-3 h-3 mr-1" />
                      Retry ({countdown}s)
                    </> :

                <>
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Retry
                    </>
                }
                </Button>
              </>
            }
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsDismissed(true)}
              className="p-1 h-auto">

              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {showDetails &&
        <div className="pb-3 pt-1 border-t border-current/20">
            <div className="text-xs space-y-1 opacity-75">
              <div>Status: {connectionState}</div>
              <div>Failures: {status.consecutiveFailures}</div>
              <div>Last Check: {status.lastCheck.toLocaleTimeString()}</div>
              {diagnostics.currentOutageMs > 0 &&
            <div>Offline for: {Math.round(diagnostics.currentOutageMs / 1000)}s</div>
            }
              {errorDetails &&
            <div>Error Type: {errorDetails.type}</div>
            }
            </div>
          </div>
        }
      </div>
    </div>);

}