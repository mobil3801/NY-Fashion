
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  Wifi, 
  WifiOff, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Download,
  RefreshCw,
  Trash2,
  Network,
  Server,
  Globe,
  Zap
} from 'lucide-react';
import { useEnhancedInventory } from '@/contexts/EnhancedInventoryContext';
import { formatDistanceToNow } from 'date-fns';

interface ConnectionTest {
  name: string;
  status: 'pending' | 'success' | 'failed';
  latency?: number;
  error?: string;
}

export default function EnhancedInventoryDiagnostics() {
  const {
    getDiagnostics,
    exportDiagnostics,
    clearDiagnostics,
    getConnectionStatus,
    retryFailedOperations,
    isRetrying
  } = useEnhancedInventory();

  const [diagnostics, setDiagnostics] = useState(getDiagnostics());
  const [connectionTests, setConnectionTests] = useState<ConnectionTest[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const connectionStatus = getConnectionStatus();

  // Auto-refresh diagnostics
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      setDiagnostics(getDiagnostics());
    }, 2000);

    return () => clearInterval(interval);
  }, [autoRefresh, getDiagnostics]);

  const runConnectivityTests = async () => {
    setIsRunningTests(true);
    const tests: ConnectionTest[] = [
      { name: 'Local Server', status: 'pending' },
      { name: 'Static Assets', status: 'pending' },
      { name: 'External API', status: 'pending' },
      { name: 'DNS Resolution', status: 'pending' }
    ];

    setConnectionTests(tests);

    const testEndpoints = [
      { name: 'Local Server', url: `${window.location.origin}/` },
      { name: 'Static Assets', url: `${window.location.origin}/favicon.ico` },
      { name: 'External API', url: 'https://httpbin.org/status/200' },
      { name: 'DNS Resolution', url: 'https://www.google.com/favicon.ico' }
    ];

    for (let i = 0; i < testEndpoints.length; i++) {
      try {
        const startTime = performance.now();
        const response = await fetch(testEndpoints[i].url, {
          method: 'HEAD',
          mode: 'no-cors',
          cache: 'no-cache',
          signal: AbortSignal.timeout(5000)
        });

        const latency = performance.now() - startTime;
        tests[i] = {
          ...tests[i],
          status: 'success',
          latency: Math.round(latency)
        };
      } catch (error) {
        tests[i] = {
          ...tests[i],
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }

      setConnectionTests([...tests]);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setIsRunningTests(false);
  };

  const handleExportDiagnostics = () => {
    const diagnosticsData = exportDiagnostics();
    const blob = new Blob([diagnosticsData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-diagnostics-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getConnectionQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'text-green-600 bg-green-100';
      case 'good': return 'text-blue-600 bg-blue-100';
      case 'fair': return 'text-yellow-600 bg-yellow-100';
      case 'poor': return 'text-orange-600 bg-orange-100';
      case 'offline': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getSuccessRate = () => {
    const total = diagnostics.totalRequests;
    const failed = diagnostics.failedRequests;
    return total > 0 ? Math.round(((total - failed) / total) * 100) : 100;
  };

  return (
    <div className="space-y-6">
      {/* Connection Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Connection</p>
                <div className="flex items-center gap-2 mt-1">
                  {connectionStatus.online ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-red-600" />
                  )}
                  <Badge 
                    className={getConnectionQualityColor(connectionStatus.quality)}
                    variant="secondary"
                  >
                    {connectionStatus.quality}
                  </Badge>
                </div>
              </div>
              <Network className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Latency</p>
                <p className="text-2xl font-bold">
                  {Math.round(connectionStatus.latency)}ms
                </p>
              </div>
              <Zap className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-2xl font-bold">{getSuccessRate()}%</p>
                  <Progress value={getSuccessRate()} className="w-16 h-2" />
                </div>
              </div>
              <Activity className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Diagnostics */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="errors">Errors</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="flex flex-wrap gap-2 justify-between items-center">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={runConnectivityTests}
                disabled={isRunningTests}
              >
                <Network className="h-4 w-4 mr-2" />
                {isRunningTests ? 'Testing...' : 'Test Connection'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={retryFailedOperations}
                disabled={isRetrying}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRetrying ? 'animate-spin' : ''}`} />
                Retry Failed
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                <Activity className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-pulse' : ''}`} />
                Auto-refresh: {autoRefresh ? 'On' : 'Off'}
              </Button>
            </div>
          </div>

          {/* Connection Tests */}
          {connectionTests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Connectivity Tests
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {connectionTests.map((test, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {test.status === 'pending' && <Clock className="h-4 w-4 animate-spin text-blue-500" />}
                        {test.status === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
                        {test.status === 'failed' && <AlertTriangle className="h-4 w-4 text-red-500" />}
                        <span className="font-medium">{test.name}</span>
                      </div>
                      <div className="text-right">
                        {test.latency && <span className="text-sm text-muted-foreground">{test.latency}ms</span>}
                        {test.error && <span className="text-sm text-red-600">{test.error}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* System Info */}
          <Card>
            <CardHeader>
              <CardTitle>System Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p><strong>Last Sync:</strong> {diagnostics.lastHealthCheck ? formatDistanceToNow(diagnostics.lastHealthCheck, { addSuffix: true }) : 'Never'}</p>
                  <p><strong>Active Requests:</strong> {diagnostics.activeRequests.length}</p>
                  <p><strong>Total Requests:</strong> {diagnostics.totalRequests}</p>
                </div>
                <div>
                  <p><strong>Failed Requests:</strong> {diagnostics.failedRequests}</p>
                  <p><strong>Average Response:</strong> {Math.round(diagnostics.averageResponseTime)}ms</p>
                  <p><strong>Connection Type:</strong> {(navigator as any).connection?.effectiveType || 'Unknown'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Requests</CardTitle>
              <CardDescription>Currently pending inventory operations</CardDescription>
            </CardHeader>
            <CardContent>
              {diagnostics.activeRequests.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No active requests</p>
              ) : (
                <div className="space-y-2">
                  {diagnostics.activeRequests.map((request, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{request.operation}</p>
                        <p className="text-sm text-muted-foreground">
                          Attempt {request.attempts} • {formatDistanceToNow(request.timestamp, { addSuffix: true })}
                        </p>
                      </div>
                      <Badge variant={
                        request.status === 'success' ? 'default' :
                        request.status === 'failed' ? 'destructive' :
                        request.status === 'retrying' ? 'secondary' : 'outline'
                      }>
                        {request.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Errors</CardTitle>
              <CardDescription>Error history and diagnostics</CardDescription>
            </CardHeader>
            <CardContent>
              {diagnostics.errorHistory.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No recent errors</p>
              ) : (
                <div className="space-y-3">
                  {diagnostics.errorHistory.slice(0, 10).map((error, index) => (
                    <div key={index} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-red-600">{error.operation}</span>
                        <span className="text-sm text-muted-foreground">
                          {formatDistanceToNow(error.timestamp, { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm mb-2">{error.error.message}</p>
                      {error.error.code && (
                        <Badge variant="outline" className="text-xs">
                          {error.error.code}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
              <CardDescription>Request timing and performance data</CardDescription>
            </CardHeader>
            <CardContent>
              {diagnostics.performanceMetrics.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No performance data available</p>
              ) : (
                <div className="space-y-3">
                  {diagnostics.performanceMetrics.slice(0, 10).map((metric, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{new URL(metric.request.url).pathname}</p>
                        <p className="text-sm text-muted-foreground">{metric.request.method}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{Math.round(metric.time)}ms</p>
                        <p className="text-sm text-muted-foreground">
                          {Math.round(metric.response.bodySize / 1024)}KB
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 justify-between">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportDiagnostics}
          >
            <Download className="h-4 w-4 mr-2" />
            Export Diagnostics
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={clearDiagnostics}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Clear Data
        </Button>
      </div>
    </div>
  );
}
