
import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Signal, SignalLow, SignalMedium, SignalHigh, AlertTriangle, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useNetwork } from '@/contexts/NetworkContext';
import { networkDiagnostics } from '@/lib/network/diagnostics';

export function ConnectionQualityIndicator() {
  const {
    online,
    connectionState,
    getDiagnostics,
    getConnectionQuality,
    retryNow,
    isAutoRetrying
  } = useNetwork();

  const [isOpen, setIsOpen] = useState(false);
  const [diagnostics, setDiagnostics] = useState(getDiagnostics());

  const quality = getConnectionQuality();

  useEffect(() => {
    if (isOpen) {
      const interval = setInterval(() => {
        setDiagnostics(getDiagnostics());
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isOpen, getDiagnostics]);

  const getQualityIcon = () => {
    if (!online || connectionState === 'offline') {
      return <WifiOff className="w-4 h-4" />;
    }

    if (connectionState === 'reconnecting') {
      return <Signal className="w-4 h-4 animate-pulse" />;
    }

    switch (quality) {
      case 'excellent':
        return <SignalHigh className="w-4 h-4" />;
      case 'good':
        return <SignalHigh className="w-4 h-4" />;
      case 'fair':
        return <SignalMedium className="w-4 h-4" />;
      case 'poor':
        return <SignalLow className="w-4 h-4" />;
      default:
        return <WifiOff className="w-4 h-4" />;
    }
  };

  const getQualityColor = () => {
    if (!online) return 'destructive';

    switch (quality) {
      case 'excellent':return 'default';
      case 'good':return 'default';
      case 'fair':return 'secondary';
      case 'poor':return 'destructive';
      default:return 'destructive';
    }
  };

  const getQualityText = () => {
    if (!online) return 'Offline';
    if (connectionState === 'reconnecting') return 'Reconnecting...';
    if (connectionState === 'recovering') return 'Recovering...';

    switch (quality) {
      case 'excellent':return 'Excellent';
      case 'good':return 'Good';
      case 'fair':return 'Fair';
      case 'poor':return 'Poor';
      default:return 'Unknown';
    }
  };

  const formatLatency = (ms: number) => {
    if (ms === 0) return 'N/A';
    if (ms < 100) return `${Math.round(ms)}ms (Fast)`;
    if (ms < 300) return `${Math.round(ms)}ms (Good)`;
    if (ms < 1000) return `${Math.round(ms)}ms (Slow)`;
    return `${Math.round(ms)}ms (Very Slow)`;
  };

  const formatDuration = (ms: number) => {
    if (ms === 0) return 'N/A';
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    return `${Math.round(ms / 60000)}m`;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 gap-2">

          {getQualityIcon()}
          <Badge variant={getQualityColor()} className="text-xs">
            {getQualityText()}
          </Badge>
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              Network Status
              {online ?
              <CheckCircle className="w-4 h-4 text-green-500" /> :

              <AlertTriangle className="w-4 h-4 text-red-500" />
              }
            </h4>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Status:</span>
                <div className="font-medium">{connectionState}</div>
              </div>
              
              <div>
                <span className="text-muted-foreground">Quality:</span>
                <div className="font-medium">{getQualityText()}</div>
              </div>
              
              <div>
                <span className="text-muted-foreground">Latency:</span>
                <div className="font-medium">{formatLatency(diagnostics.averageLatency)}</div>
              </div>
              
              <div>
                <span className="text-muted-foreground">Queued:</span>
                <div className="font-medium">
                  {diagnostics.queuedOperations} operation{diagnostics.queuedOperations !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h5 className="font-medium text-sm">Connection Statistics</h5>
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Success Rate:</span>
                <span>
                  {diagnostics.totalAttempts > 0 ?
                  `${Math.round(diagnostics.successfulAttempts / diagnostics.totalAttempts * 100)}%` :
                  'N/A'
                  }
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current Outage:</span>
                <span>{formatDuration(diagnostics.currentOutageMs)}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-muted-foreground">Longest Outage:</span>
                <span>{formatDuration(diagnostics.longestOutageMs)}</span>
              </div>
              
              {diagnostics.lastConnectedAt &&
              <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Connected:</span>
                  <span>
                    {diagnostics.lastConnectedAt.toLocaleTimeString()}
                  </span>
                </div>
              }
            </div>
          </div>

          {!online &&
          <div className="pt-2 border-t">
              <Button
              onClick={() => {
                retryNow();
                setIsOpen(false);
              }}
              disabled={isAutoRetrying}
              className="w-full"
              size="sm">

                {isAutoRetrying ?
              <>
                    <Signal className="w-4 h-4 mr-2 animate-pulse" />
                    Reconnecting...
                  </> :

              <>
                    <Wifi className="w-4 h-4 mr-2" />
                    Retry Connection
                  </>
              }
              </Button>
            </div>
          }
        </div>
      </PopoverContent>
    </Popover>);

}