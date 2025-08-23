
import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Signal, SignalHigh, SignalLow, SignalMedium } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useNetwork } from '@/contexts/NetworkContext';
import { networkDiagnostics, NetworkDiagnostics } from '@/lib/network/diagnostics';

interface ConnectionQualityIndicatorProps {
  variant?: 'full' | 'minimal';
  showDetails?: boolean;
}

export function ConnectionQualityIndicator({
  variant = 'full',
  showDetails = true
}: ConnectionQualityIndicatorProps) {
  const {
    online,
    status,
    connectionState,
    errorDetails,
    recoveryInfo,
    retryNow,
    isAutoRetrying,
    retryCount
  } = useNetwork();
  const [quality, setQuality] = useState<'excellent' | 'good' | 'fair' | 'poor' | 'offline'>('offline');
  const [diagnostics, setDiagnostics] = useState<NetworkDiagnostics | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkQuality = async () => {
      if (!online) {
        setQuality('offline');
        return;
      }

      try {
        const [qualityResult, diagnosticsResult] = await Promise.all([
        networkDiagnostics.getConnectionQuality(),
        networkDiagnostics.runDiagnostics()]
        );

        if (mounted) {
          setQuality(qualityResult);
          setDiagnostics(diagnosticsResult);
        }
      } catch (error) {
        if (mounted) {
          setQuality('offline');
        }
      }
    };

    // Check quality on mount and when online status changes
    checkQuality();

    // Set up periodic checks when online
    let interval: NodeJS.Timeout | undefined;
    if (online) {
      interval = setInterval(checkQuality, 30000); // Check every 30 seconds
    }

    return () => {
      mounted = false;
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [online]);

  const handleRefresh = async () => {
    setIsChecking(true);
    try {
      await retryNow();
      const [qualityResult, diagnosticsResult] = await Promise.all([
      networkDiagnostics.getConnectionQuality(),
      networkDiagnostics.runDiagnostics()]
      );
      setQuality(qualityResult);
      setDiagnostics(diagnosticsResult);
    } finally {
      setIsChecking(false);
    }
  };

  const getQualityIcon = () => {
    switch (quality) {
      case 'excellent':
        return <Signal className="h-4 w-4" />;
      case 'good':
        return <SignalHigh className="h-4 w-4" />;
      case 'fair':
        return <SignalMedium className="h-4 w-4" />;
      case 'poor':
        return <SignalLow className="h-4 w-4" />;
      default:
        return <WifiOff className="h-4 w-4" />;
    }
  };

  const getQualityColor = () => {
    // Override colors based on connection state
    if (connectionState === 'recovering') {
      return 'bg-green-100 text-green-800 border-green-200';
    }
    if (connectionState === 'reconnecting') {
      return 'bg-blue-100 text-blue-800 border-blue-200';
    }
    if (connectionState === 'poor_connection') {
      return 'bg-orange-100 text-orange-800 border-orange-200';
    }

    switch (quality) {
      case 'excellent':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'good':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'fair':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'poor':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-red-100 text-red-800 border-red-200';
    }
  };

  const getQualityText = () => {
    switch (connectionState) {
      case 'recovering':
        return 'Recovering';
      case 'reconnecting':
        return 'Reconnecting';
      case 'poor_connection':
        return 'Poor Connection';
      case 'offline':
        return 'Offline';
      case 'online':
        if (!online) return 'Offline';
        return quality.charAt(0).toUpperCase() + quality.slice(1);
      default:
        return 'Unknown';
    }
  };

  if (variant === 'minimal') {
    return (
      <Badge
        variant="outline"
        className={`${getQualityColor()} text-xs`}>

        <div className="flex items-center gap-1">
          {getQualityIcon()}
          {online ? 'Online' : 'Offline'}
        </div>
      </Badge>);

  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`h-8 px-2 ${getQualityColor()}`}>

          <div className="flex items-center gap-2">
            {getQualityIcon()}
            <span className="text-xs font-medium">
              {getQualityText()}
            </span>
          </div>
        </Button>
      </PopoverTrigger>
      
      {showDetails &&
      <PopoverContent className="w-80" align="end">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Connection Status</h4>
              <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isChecking || isAutoRetrying}
              className="h-6 px-2"
              aria-label="Refresh connection status">

                <Wifi className={`h-3 w-3 ${isChecking || isAutoRetrying ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            <div className="space-y-3">
              {/* Connection State */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Status:</span>
                <Badge className={getQualityColor()}>
                  {getQualityText()}
                </Badge>
              </div>

              {/* Error Details */}
              {errorDetails &&
            <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Error Type:</span>
                    <span className="text-sm font-medium capitalize">
                      {errorDetails.type.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                    {errorDetails.userMessage}
                  </div>
                </div>
            }

              {/* Recovery Info */}
              {recoveryInfo &&
            <div className="space-y-2 bg-green-50 p-2 rounded">
                  <div className="text-xs text-green-700 font-medium">
                    Connection Recovered
                  </div>
                  <div className="text-xs text-green-600">
                    Offline for: {recoveryInfo.wasOfflineFor > 60000 ?
                `${Math.round(recoveryInfo.wasOfflineFor / 60000)} min` :
                `${Math.round(recoveryInfo.wasOfflineFor / 1000)} sec`}
                  </div>
                </div>
            }

              {/* Retry Information */}
              {retryCount > 0 &&
            <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Retry Attempts:</span>
                  <span className="text-sm font-medium">{retryCount}</span>
                </div>
            }

              {/* Connection Quality Metrics */}
              {diagnostics && online &&
            <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Quality:</span>
                    <Badge variant={quality === 'excellent' ? 'default' : 'secondary'}>
                      {quality.charAt(0).toUpperCase() + quality.slice(1)}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Latency:</span>
                    <span className="text-sm font-medium">
                      {Math.round(diagnostics.apiTest.latency)}ms
                    </span>
                  </div>

                  {diagnostics.effectiveType &&
              <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Connection:</span>
                      <span className="text-sm font-medium">
                        {diagnostics.effectiveType.toUpperCase()}
                      </span>
                    </div>
              }

                  <div className="pt-2 border-t">
                    <p className="text-xs text-gray-500">
                      {networkDiagnostics.getConnectionAdvice(diagnostics)}
                    </p>
                  </div>
                </>
            }

              {/* Failure Information */}
              {status.consecutiveFailures > 0 &&
            <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Consecutive Failures:</span>
                  <span className="text-sm font-medium text-red-600">
                    {status.consecutiveFailures}
                  </span>
                </div>
            }

              {/* Last Check Time */}
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Last checked:</span>
                <span>{new Date(status.lastCheck).toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        </PopoverContent>
      }
    </Popover>);

}

export default ConnectionQualityIndicator;