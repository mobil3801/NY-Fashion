
import React from 'react';
import MainLayout from '@/components/layout/MainLayout';
import HealthMonitorDashboard from '@/components/monitoring/HealthMonitorDashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Database, 
  Globe, 
  Server, 
  Shield,
  Zap,
  RefreshCw,
  Download,
  Trash2,
  Monitor,
  BarChart3,
  Bug
} from 'lucide-react';
import { useErrorTracking } from '@/components/monitoring/ErrorTrackingService';
import { logger } from '@/utils/production-logger';
import { auditLogger } from '@/utils/audit-logger';

const TestingPage: React.FC = () => {
  const { metrics, trackError, trackCriticalError, trackUserError } = useErrorTracking();

  const handleTestError = () => {
    const testError = new Error('This is a test error for monitoring');
    trackError(testError, { source: 'manual_test', page: '/performance' });
    logger.logWarn('Test error generated', { type: 'user_initiated' });
  };

  const handleTestCriticalError = () => {
    const criticalError = new Error('This is a test critical error');
    trackCriticalError(criticalError, { source: 'manual_test', severity: 'critical' });
    logger.logError('Test critical error generated', criticalError);
  };

  const handleTestNetworkError = () => {
    fetch('/api/non-existent-endpoint')
      .catch(error => {
        trackError(error, { source: 'network_test', endpoint: '/api/non-existent-endpoint' });
      });
  };

  const handleClearStorage = () => {
    localStorage.removeItem('production_errors');
    localStorage.removeItem('error_tracking_metrics');
    localStorage.removeItem('error_tracking_buffer');
    localStorage.removeItem('auditLogs');
    logger.logInfo('Storage cleared by user');
    window.location.reload();
  };

  const handleExportLogs = () => {
    const logs = logger.exportLogs();
    const blob = new Blob([logs], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `production-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    auditLogger.logUserAction('export', 'production_logs', {
      timestamp: new Date().toISOString()
    });
  };

  const handleTestPerformance = () => {
    // Simulate heavy computation
    const start = performance.now();
    let result = 0;
    for (let i = 0; i < 1000000; i++) {
      result += Math.random();
    }
    const end = performance.now();
    
    logger.logPerformance('test', 'heavy_computation', end - start, true, {
      iterations: 1000000,
      result: result
    });
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Performance & Monitoring</h1>
            <p className="text-gray-600 mt-1">
              Monitor application health, performance metrics, and error tracking
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportLogs}>
              <Download className="w-4 h-4 mr-2" />
              Export Logs
            </Button>
            <Button variant="outline" size="sm" onClick={handleClearStorage}>
              <Trash2 className="w-4 h-4 mr-2" />
              Clear Storage
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Errors</CardTitle>
              <AlertTriangle className="w-4 h-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalErrors}</div>
              <p className="text-xs text-gray-600">
                {metrics.criticalErrors} critical
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
              <BarChart3 className="w-4 h-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics.totalErrors > 0 ? (metrics.criticalErrors / metrics.totalErrors * 100).toFixed(1) : 0}%
              </div>
              <p className="text-xs text-gray-600">
                Critical error rate
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Status</CardTitle>
              <CheckCircle className="w-4 h-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Healthy</div>
              <p className="text-xs text-gray-600">
                All systems operational
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Uptime</CardTitle>
              <Activity className="w-4 h-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(performance.now() / 1000)}s</div>
              <p className="text-xs text-gray-600">
                Session uptime
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="health" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="health" className="flex items-center gap-2">
              <Monitor className="w-4 h-4" />
              Health Monitor
            </TabsTrigger>
            <TabsTrigger value="testing" className="flex items-center gap-2">
              <Bug className="w-4 h-4" />
              Error Testing
            </TabsTrigger>
            <TabsTrigger value="performance" className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Performance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="health" className="space-y-4">
            <HealthMonitorDashboard />
          </TabsContent>

          <TabsContent value="testing" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bug className="w-5 h-5" />
                    Error Testing
                  </CardTitle>
                  <p className="text-sm text-gray-600">
                    Test error tracking and monitoring systems
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button 
                    onClick={handleTestError}
                    variant="outline"
                    className="w-full"
                  >
                    Generate Test Error
                  </Button>
                  <Button 
                    onClick={handleTestCriticalError}
                    variant="destructive"
                    className="w-full"
                  >
                    Generate Critical Error
                  </Button>
                  <Button 
                    onClick={handleTestNetworkError}
                    variant="outline"
                    className="w-full"
                  >
                    Test Network Error
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Error Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {metrics.lastError ? (
                    <Alert>
                      <AlertTriangle className="w-4 h-4" />
                      <AlertDescription>
                        <div className="font-medium">Last Error:</div>
                        <div className="text-sm mt-1">{metrics.lastError.message}</div>
                        <div className="text-xs text-gray-600 mt-1">
                          {metrics.lastError.page} • {new Date(metrics.lastError.timestamp).toLocaleString()}
                        </div>
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <p className="text-sm text-gray-600">No errors recorded</p>
                  )}

                  {Object.entries(metrics.errorsByType).length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Error Types:</h4>
                      <div className="space-y-2">
                        {Object.entries(metrics.errorsByType)
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 5)
                          .map(([type, count]) => (
                            <div key={type} className="flex justify-between items-center">
                              <span className="text-sm">{type}</span>
                              <Badge variant="secondary">{count}</Badge>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5" />
                    Performance Testing
                  </CardTitle>
                  <p className="text-sm text-gray-600">
                    Test performance monitoring and metrics collection
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button 
                    onClick={handleTestPerformance}
                    variant="outline"
                    className="w-full"
                  >
                    Run Performance Test
                  </Button>
                  
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="text-center">
                      <div className="text-lg font-semibold">{Math.round(performance.now())}ms</div>
                      <div className="text-xs text-gray-600">Session Time</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold">
                        {(performance as any).memory ? 
                          Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024) : 
                          'N/A'
                        }MB
                      </div>
                      <div className="text-xs text-gray-600">Memory Used</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>System Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Browser:</span>
                    <span className="text-sm">{navigator.userAgent.split(' ')[0]}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Platform:</span>
                    <span className="text-sm">{navigator.platform}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Online:</span>
                    <Badge variant={navigator.onLine ? "default" : "destructive"}>
                      {navigator.onLine ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Language:</span>
                    <span className="text-sm">{navigator.language}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Cookies:</span>
                    <Badge variant={navigator.cookieEnabled ? "default" : "destructive"}>
                      {navigator.cookieEnabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default TestingPage;
