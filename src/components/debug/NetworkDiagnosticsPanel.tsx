
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Activity,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Database,
  Server,
  Zap } from
'lucide-react';
import { useNetwork } from '@/contexts/NetworkContext';
import { formatDistanceToNow } from 'date-fns';

export function NetworkDiagnosticsPanel() {
  const { online, status, retryNow, getDiagnostics } = useNetwork();
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [testResults, setTestResults] = useState<any[]>([]);

  const refreshDiagnostics = async () => {
    setIsRefreshing(true);
    try {
      await retryNow();
      setDiagnostics(getDiagnostics());
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // Auto-refresh diagnostics every 5 seconds
    const interval = setInterval(() => {
      setDiagnostics(getDiagnostics());
    }, 5000);

    // Initial load
    setDiagnostics(getDiagnostics());

    return () => clearInterval(interval);
  }, [getDiagnostics]);

  const runConnectivityTest = async () => {
    const testEndpoints = [
    { name: 'Database Health', url: '/api/database/health' },
    { name: 'API Health', url: '/api/health' },
    { name: 'Static Resource', url: '/favicon.ico' },
    { name: 'External Test', url: 'https://httpbin.org/status/200' }];


    const results = [];

    for (const endpoint of testEndpoints) {
      const startTime = performance.now();
      try {
        const response = await fetch(endpoint.url, {
          method: 'HEAD',
          mode: 'no-cors',
          cache: 'no-cache'
        });
        const latency = performance.now() - startTime;
        results.push({
          ...endpoint,
          success: true,
          latency: Math.round(latency),
          error: null
        });
      } catch (error) {
        const latency = performance.now() - startTime;
        results.push({
          ...endpoint,
          success: false,
          latency: Math.round(latency),
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    setTestResults(results);
  };

  const getHealthScore = () => {
    if (!diagnostics?.connectivity) return 0;
    const { totalAttempts, successfulAttempts } = diagnostics.connectivity;
    if (totalAttempts === 0) return 100;
    return Math.round(successfulAttempts / totalAttempts * 100);
  };

  const getLatencyColor = (latency: number) => {
    if (latency < 100) return 'text-green-600';
    if (latency < 500) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Connection Status</p>
                <div className="flex items-center gap-2 mt-1">
                  {online ? <Wifi className="h-4 w-4 text-green-500" /> : <WifiOff className="h-4 w-4 text-red-500" />}
                  <Badge variant={online ? 'default' : 'destructive'}>
                    {online ? 'Online' : 'Offline'}
                  </Badge>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={refreshDiagnostics}
                disabled={isRefreshing}>

                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Health Score</p>
                <div className="flex items-center gap-2 mt-1">
                  <Progress value={getHealthScore()} className="w-16" />
                  <span className="text-lg font-semibold">{getHealthScore()}%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div>
              <p className="text-sm text-muted-foreground">Last Check</p>
              <div className="flex items-center gap-2 mt-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {formatDistanceToNow(status.lastCheck, { addSuffix: true })}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="status" className="w-full">
        <TabsList>
          <TabsTrigger value="status">Status</TabsTrigger>
          <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
          <TabsTrigger value="testing">Testing</TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Current Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Network State:</span>
                  <div className="flex items-center gap-2 mt-1">
                    {online ?
                    <CheckCircle className="h-4 w-4 text-green-500" /> :

                    <AlertCircle className="h-4 w-4 text-red-500" />
                    }
                    <span>{online ? 'Connected' : 'Disconnected'}</span>
                  </div>
                </div>
                
                <div>
                  <span className="text-muted-foreground">Consecutive Failures:</span>
                  <div className="mt-1">
                    <Badge variant={status.consecutiveFailures === 0 ? 'default' : 'destructive'}>
                      {status.consecutiveFailures}
                    </Badge>
                  </div>
                </div>

                {status.lastError &&
                <div className="col-span-2">
                    <span className="text-muted-foreground">Last Error:</span>
                    <div className="mt-1 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
                      {status.lastError}
                    </div>
                  </div>
                }
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="diagnostics" className="space-y-4">
          {diagnostics &&
          <>
              {/* Connectivity Diagnostics */}
              {diagnostics.connectivity &&
            <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      Connectivity Monitor
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Total Attempts:</span>
                        <div className="font-semibold">{diagnostics.connectivity.totalAttempts}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Successful:</span>
                        <div className="font-semibold text-green-600">{diagnostics.connectivity.successfulAttempts}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Average Latency:</span>
                        <div className={`font-semibold ${getLatencyColor(diagnostics.connectivity.averageLatency)}`}>
                          {Math.round(diagnostics.connectivity.averageLatency) || 0}ms
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Success Rate:</span>
                        <div className="font-semibold">
                          {Math.round(diagnostics.connectivity.successfulAttempts / diagnostics.connectivity.totalAttempts * 100) || 0}%
                        </div>
                      </div>
                    </div>

                    {diagnostics.connectivity.lastSuccessfulEndpoint &&
                <div className="mt-4">
                        <span className="text-muted-foreground text-sm">Last Successful Endpoint:</span>
                        <div className="mt-1 p-2 bg-gray-50 border rounded">
                          <code className="text-xs">{diagnostics.connectivity.lastSuccessfulEndpoint}</code>
                        </div>
                      </div>
                }

                    {diagnostics.connectivity.failedEndpoints && diagnostics.connectivity.failedEndpoints.size > 0 &&
                <div className="mt-4">
                        <span className="text-muted-foreground text-sm">Failed Endpoints:</span>
                        <ScrollArea className="mt-2 max-h-32">
                          <div className="space-y-1">
                            {Array.from(diagnostics.connectivity.failedEndpoints.entries()).map(([endpoint, count]) =>
                      <div key={endpoint} className="flex justify-between items-center p-2 bg-red-50 border border-red-200 rounded">
                                <code className="text-xs">{new URL(endpoint).pathname}</code>
                                <Badge variant="destructive" className="text-xs">
                                  {count} failures
                                </Badge>
                              </div>
                      )}
                          </div>
                        </ScrollArea>
                      </div>
                }
                  </CardContent>
                </Card>
            }

              {/* API Client Diagnostics */}
              {diagnostics.apiClient &&
            <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Server className="h-5 w-5" />
                      API Client
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Online Status:</span>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={diagnostics.apiClient.isOnline ? 'default' : 'destructive'}>
                            {diagnostics.apiClient.isOnline ? 'Online' : 'Offline'}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Queue Size:</span>
                        <div className="font-semibold">{diagnostics.apiClient.queueStatus.size}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Retry Scheduler:</span>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={diagnostics.apiClient.retrySchedulerPaused ? 'secondary' : 'default'}>
                            {diagnostics.apiClient.retrySchedulerPaused ? 'Paused' : 'Active'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
            }
            </>
          }
        </TabsContent>

        <TabsContent value="testing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Connectivity Testing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={runConnectivityTest} className="w-full">
                Run Connectivity Test
              </Button>

              {testResults.length > 0 &&
              <div className="space-y-2">
                  <h4 className="font-medium text-sm">Test Results</h4>
                  <div className="space-y-2">
                    {testResults.map((result, index) =>
                  <div
                    key={index}
                    className={`p-3 border rounded ${
                    result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`
                    }>

                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            {result.success ?
                        <CheckCircle className="h-4 w-4 text-green-500" /> :

                        <AlertCircle className="h-4 w-4 text-red-500" />
                        }
                            <span className="font-medium text-sm">{result.name}</span>
                          </div>
                          <Badge variant={result.success ? 'default' : 'destructive'} className="text-xs">
                            {result.latency}ms
                          </Badge>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {result.url}
                        </div>
                        {result.error &&
                    <div className="mt-1 text-xs text-red-600">
                            Error: {result.error}
                          </div>
                    }
                      </div>
                  )}
                  </div>
                </div>
              }
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>);

}

export default NetworkDiagnosticsPanel;