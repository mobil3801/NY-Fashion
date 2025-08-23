
import React, { useState } from 'react';
import { AlertTriangle, Wifi, WifiOff, RotateCcw, CheckCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNetwork } from '@/contexts/NetworkContext';

export function OfflineBanner() {
  const { online, status, retryNow, isConnecting, connectionQuality } = useNetwork();
  const [isRetrying, setIsRetrying] = useState(false);

  // Don't show banner if online and connection quality is good
  if (online && connectionQuality === 'good') {
    return null;
  }

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await retryNow();
    } finally {
      // Keep showing retrying state for a moment even after retry completes
      setTimeout(() => {
        setIsRetrying(false);
      }, 1500);
    }
  };

  const getStatusMessage = () => {
    if (isRetrying || isConnecting) {
      return 'Attempting to reconnect...';
    }
    
    if (!online) {
      if (status.consecutiveFailures > 3) {
        return `Connection lost (${status.consecutiveFailures} failed attempts)`;
      }
      return 'You\'re currently offline';
    }
    
    if (connectionQuality === 'poor') {
      return 'Connection is unstable';
    }
    
    return 'Connection issues detected';
  };

  const getStatusIcon = () => {
    if (isRetrying || isConnecting) {
      return <RotateCcw className="h-4 w-4 animate-spin" />;
    }
    
    if (!online) {
      if (status.consecutiveFailures > 2) {
        return <AlertTriangle className="h-4 w-4" />;
      }
      return <WifiOff className="h-4 w-4" />;
    }
    
    if (connectionQuality === 'poor') {
      return <Wifi className="h-4 w-4" />;
    }
    
    return <AlertTriangle className="h-4 w-4" />;
  };

  const getBannerStyle = () => {
    if (!online) {
      return {
        bg: 'bg-amber-50 border-amber-200',
        text: 'text-amber-800',
        icon: 'text-amber-600',
        button: 'border-amber-300 text-amber-700 hover:bg-amber-100 hover:border-amber-400'
      };
    }
    
    if (connectionQuality === 'poor') {
      return {
        bg: 'bg-orange-50 border-orange-200',
        text: 'text-orange-800',
        icon: 'text-orange-600',
        button: 'border-orange-300 text-orange-700 hover:bg-orange-100 hover:border-orange-400'
      };
    }
    
    return {
      bg: 'bg-red-50 border-red-200',
      text: 'text-red-800',
      icon: 'text-red-600',
      button: 'border-red-300 text-red-700 hover:bg-red-100 hover:border-red-400'
    };
  };

  const styles = getBannerStyle();
  const queueStatus = window.ezsite?.apiClient?.getQueueStatus?.() || { size: 0 };
  
  return (
    <div
      className={`sticky top-0 z-50 border-b px-4 py-3 ${styles.bg}`}
      role="status"
      aria-live="polite"
      aria-label="Network status">
      
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={styles.icon}>
            {getStatusIcon()}
          </div>
          <div className="flex-1">
            <p className={`text-sm font-medium ${styles.text}`}>
              {getStatusMessage()}
            </p>
            
            {/* Show additional context based on status */}
            {!online && queueStatus.size > 0 && (
              <p className="text-xs text-gray-600 mt-1">
                {queueStatus.size} change{queueStatus.size !== 1 ? 's' : ''} queued for sync
              </p>
            )}
            
            {connectionQuality === 'poor' && (
              <p className="text-xs text-gray-600 mt-1">
                Some features may be slower than usual
              </p>
            )}
            
            {status.lastError && !online && (
              <p className="text-xs text-gray-600 mt-1">
                Changes will be saved locally and synced when connection is restored
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Connection quality indicator */}
          {online && (
            <Badge 
              variant="secondary" 
              className={`text-xs ${connectionQuality === 'poor' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>
              {connectionQuality === 'poor' ? 'Poor' : 'Good'} Connection
            </Badge>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetry}
            disabled={isRetrying || isConnecting}
            className={`${styles.button}`}
            aria-label={isRetrying || isConnecting ? 'Reconnecting' : 'Retry connection'}>
            
            {isRetrying || isConnecting ? (
              <>
                <RotateCcw className="h-3 w-3 mr-1 animate-spin" />
                {isConnecting ? 'Connecting...' : 'Retrying...'}
              </>
            ) : (
              <>
                <Wifi className="h-3 w-3 mr-1" />
                Retry
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
