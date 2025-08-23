
import React, { useState } from 'react';
import { RotateCcw, Trash2, RefreshCw, Wifi, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useDebug } from '@/debug';
import { useToast } from '@/hooks/use-toast';

const ConnectionRecovery: React.FC = () => {
  const {
    apiCalls,
    networkStatus,
    retryFailedCall,
    clearCache,
    checkNetworkStatus,
    clearApiCalls
  } = useDebug();
  const { toast } = useToast();

  const [isClearing, setIsClearing] = useState(false);
  const [retryingCalls, setRetryingCalls] = useState<Set<string>>(new Set());

  const failedCalls = apiCalls.filter((call) => call.status === 'error');
  const recentFailures = failedCalls.slice(0, 5);

  const handleRetryAll = async () => {
    if (failedCalls.length === 0) return;

    const callIds = failedCalls.map((call) => call.id);
    setRetryingCalls(new Set(callIds));

    let successCount = 0;
    let errorCount = 0;

    try {
      await Promise.allSettled(
        callIds.map(async (callId) => {
          try {
            await retryFailedCall(callId);
            successCount++;
          } catch (error) {
            errorCount++;
          }
        })
      );

      toast({
        title: "Retry Complete",
        description: `${successCount} calls succeeded, ${errorCount} failed`,
        variant: successCount > errorCount ? "default" : "destructive"
      });
    } finally {
      setRetryingCalls(new Set());
    }
  };

  const handleRetryCall = async (callId: string) => {
    setRetryingCalls((prev) => new Set([...prev, callId]));

    try {
      await retryFailedCall(callId);
      toast({
        title: "Success",
        description: "API call retried successfully"
      });
    } catch (error) {
      toast({
        title: "Retry Failed",
        description: "The API call could not be completed",
        variant: "destructive"
      });
    } finally {
      setRetryingCalls((prev) => {
        const next = new Set(prev);
        next.delete(callId);
        return next;
      });
    }
  };

  const handleClearCache = async () => {
    setIsClearing(true);

    try {
      await clearCache();
      toast({
        title: "Cache Cleared",
        description: "All cached data has been cleared"
      });
    } catch (error) {
      toast({
        title: "Clear Failed",
        description: "Could not clear cache completely",
        variant: "destructive"
      });
    } finally {
      setIsClearing(false);
    }
  };

  const handleFullReset = async () => {
    setIsClearing(true);

    try {
      await clearCache();
      clearApiCalls();
      await checkNetworkStatus();

      toast({
        title: "Reset Complete",
        description: "Connection state has been reset"
      });
    } catch (error) {
      toast({
        title: "Reset Failed",
        description: "Could not complete full reset",
        variant: "destructive"
      });
    } finally {
      setIsClearing(false);
    }
  };

  const getConnectionHealthStatus = () => {
    if (!networkStatus.isOnline) {
      return { status: 'critical', message: 'No internet connection', color: 'red' };
    }

    if (networkStatus.latency === null) {
      return { status: 'unknown', message: 'Connection status unknown', color: 'gray' };
    }

    if (networkStatus.latency > 1000) {
      return { status: 'poor', message: 'Very slow connection', color: 'red' };
    }

    if (networkStatus.latency > 500) {
      return { status: 'fair', message: 'Slow connection', color: 'yellow' };
    }

    return { status: 'good', message: 'Connection healthy', color: 'green' };
  };

  const healthStatus = getConnectionHealthStatus();

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <RotateCcw className="h-4 w-4" />
          Connection Recovery
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Health Status */}
        <Alert>
          <div className="flex items-center gap-2">
            {healthStatus.status === 'good' && <CheckCircle className="h-4 w-4 text-green-500" />}
            {healthStatus.status === 'fair' && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
            {(healthStatus.status === 'poor' || healthStatus.status === 'critical') && <AlertTriangle className="h-4 w-4 text-red-500" />}
            {healthStatus.status === 'unknown' && <Wifi className="h-4 w-4 text-gray-500" />}
          </div>
          <AlertDescription className="ml-6">
            {healthStatus.message}
            {networkStatus.latency &&
            <span className="ml-2 text-xs">
                (Latency: {networkStatus.latency.toFixed(0)}ms)
              </span>
            }
          </AlertDescription>
        </Alert>

        {/* Recovery Actions */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Quick Actions</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={checkNetworkStatus}
                className="text-xs">

                <RefreshCw className="h-3 w-3 mr-1" />
                Test Connection
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearCache}
              disabled={isClearing}
              className="text-xs">

              <Trash2 className="h-3 w-3 mr-1" />
              {isClearing ? 'Clearing...' : 'Clear Cache'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleFullReset}
              disabled={isClearing}
              className="text-xs">

              <RotateCcw className="h-3 w-3 mr-1" />
              {isClearing ? 'Resetting...' : 'Full Reset'}
            </Button>
          </div>
        </div>

        <Separator />

        {/* Failed Calls Recovery */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Failed API Calls</span>
              <Badge variant="destructive" className="text-xs">
                {failedCalls.length}
              </Badge>
            </div>
            {failedCalls.length > 0 &&
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetryAll}
              disabled={retryingCalls.size > 0}
              className="text-xs">

                <RotateCcw className={`h-3 w-3 mr-1 ${retryingCalls.size > 0 ? 'animate-spin' : ''}`} />
                Retry All
              </Button>
            }
          </div>

          {recentFailures.length === 0 ?
          <div className="text-center py-4 text-gray-500 text-sm">
              No recent failures
            </div> :

          <div className="space-y-2">
              {recentFailures.map((call) =>
            <div key={call.id} className="flex items-center justify-between p-2 bg-red-50 rounded border border-red-200">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {call.operation}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {call.url}
                    </div>
                    {call.error &&
                <div className="text-xs text-red-600 truncate">
                        {call.error.message}
                      </div>
                }
                  </div>
                  <Button
                variant="outline"
                size="sm"
                onClick={() => handleRetryCall(call.id)}
                disabled={retryingCalls.has(call.id)}
                className="ml-2 text-xs">

                    <RotateCcw className={`h-3 w-3 ${retryingCalls.has(call.id) ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
            )}
              {failedCalls.length > 5 &&
            <div className="text-center text-xs text-gray-500">
                  ... and {failedCalls.length - 5} more
                </div>
            }
            </div>
          }
        </div>

        {/* Tips */}
        <div className="text-xs text-gray-500 space-y-1">
          <div className="font-medium">Recovery Tips:</div>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>Try "Test Connection" first to check network status</li>
            <li>Use "Clear Cache" if seeing stale data</li>
            <li>Use "Full Reset" for persistent connection issues</li>
            <li>Individual retries work best for specific failures</li>
          </ul>
        </div>
      </CardContent>
    </Card>);

};

export default ConnectionRecovery;