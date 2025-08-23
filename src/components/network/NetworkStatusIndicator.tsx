
import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Wifi, WifiOff, Activity, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { useNetwork } from '@/contexts/NetworkContext';
import { formatDistanceToNow } from 'date-fns';
import { OfflineBanner } from './OfflineBanner';

export function NetworkStatusIndicator() {
  const { online, status, getDiagnostics } = useNetwork();
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnostics, setDiagnostics] = useState<any>(null);

  const loadDiagnostics = () => {
    setDiagnostics(getDiagnostics());
    setShowDiagnostics(true);
  };

  const getStatusColor = () => {
    if (online) {
      return status.consecutiveFailures === 0 ? 'success' : 'warning';
    }
    return 'destructive';
  };

  const getStatusIcon = () => {
    if (online) {
      return status.consecutiveFailures === 0 ? 
        <CheckCircle className="h-3 w-3" /> : 
        <AlertCircle className="h-3 w-3" />;
    }
    return <WifiOff className="h-3 w-3" />;
  };

  const getStatusText = () => {
    if (online) {
      if (status.consecutiveFailures === 0) {
        return 'Online';
      }
      return `Unstable (${status.consecutiveFailures} failures)`;
    }
    return 'Offline';
  };

  return (
    <>
      <Popover open={showDiagnostics} onOpenChange={setShowDiagnostics}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadDiagnostics}
            className="flex items-center gap-2 px-2 h-8"
            title="Network Status"
          >
            {getStatusIcon()}
            <Badge
              variant={getStatusColor() as any}
              className="text-xs px-2 py-0.5"
            >
              {getStatusText()}
            </Badge>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              <h4 className="font-medium">Network Diagnostics</h4>
            </div>
            
            {diagnostics && (
              <div className="space-y-3 text-sm">
                {/* Connection Status */}
                <div className="space-y-2">
                  <h5 className="font-medium text-xs text-muted-foreground uppercase tracking-wide">
                    Connection
                  </h5>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>Status: <Badge variant={online ? 'default' : 'destructive'} className="text-xs">
                      {online ? 'Online' : 'Offline'}
                    </Badge></div>
                    <div>Failures: {status.consecutiveFailures}</div>
                    <div className="col-span-2">
                      Last Check: {formatDistanceToNow(status.lastCheck, { addSuffix: true })}
                    </div>
                    {status.lastError && (
                      <div className="col-span-2 text-red-600">
                        Error: {status.lastError}
                      </div>
                    )}
                  </div>
                </div>

                {/* Connectivity Diagnostics */}
                {diagnostics.connectivity && (
                  <div className="space-y-2">
                    <h5 className="font-medium text-xs text-muted-foreground uppercase tracking-wide">
                      Heartbeat
                    </h5>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>Success Rate: {Math.round((diagnostics.connectivity.successfulAttempts / diagnostics.connectivity.totalAttempts) * 100) || 0}%</div>
                      <div>Avg Latency: {Math.round(diagnostics.connectivity.averageLatency) || 0}ms</div>
                      <div className="col-span-2">
                        Endpoint: <code className="text-xs bg-gray-100 px-1 rounded">
                          {diagnostics.connectivity.lastSuccessfulEndpoint || 'None'}
                        </code>
                      </div>
                    </div>
                  </div>
                )}

                {/* API Client Status */}
                {diagnostics.apiClient && (
                  <div className="space-y-2">
                    <h5 className="font-medium text-xs text-muted-foreground uppercase tracking-wide">
                      API Client
                    </h5>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>Queue Size: {diagnostics.apiClient.queueStatus.size}</div>
                      <div>Retry Paused: {diagnostics.apiClient.retrySchedulerPaused ? 'Yes' : 'No'}</div>
                    </div>
                  </div>
                )}

                {/* Failed Endpoints */}
                {diagnostics.connectivity?.failedEndpoints && diagnostics.connectivity.failedEndpoints.size > 0 && (
                  <div className="space-y-2">
                    <h5 className="font-medium text-xs text-muted-foreground uppercase tracking-wide">
                      Failed Endpoints
                    </h5>
                    <div className="space-y-1">
                      {Array.from(diagnostics.connectivity.failedEndpoints.entries()).map(([endpoint, count]) => (
                        <div key={endpoint} className="text-xs">
                          <code className="bg-gray-100 px-1 rounded text-xs">{new URL(endpoint).pathname}</code>
                          <span className="ml-2 text-red-600">({count} failures)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowDiagnostics(false)}
              className="w-full"
            >
              Close
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
