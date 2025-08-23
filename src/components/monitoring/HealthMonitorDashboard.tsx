
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
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
  Trash2 } from
'lucide-react';
import { productionHealthMonitor, HealthMetrics } from '@/utils/production-health-monitor';
import { useErrorTracking } from '@/components/monitoring/ErrorTrackingService';
import { logger } from '@/utils/production-logger';
import { auditLogger } from '@/utils/audit-logger';

const HealthMonitorDashboard: React.FC = () => {
  const [healthMetrics, setHealthMetrics] = useState<HealthMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [alerts, setAlerts] = useState<any[]>([]);

  const { metrics: errorMetrics, getErrorReport, clearMetrics } = useErrorTracking();

  useEffect(() => {
    // Initialize health monitoring
    productionHealthMonitor.startMonitoring();

    // Set up alert listener
    const unsubscribe = productionHealthMonitor.onAlert((alert) => {
      setAlerts((prev) => [alert, ...prev].slice(0, 10)); // Keep last 10 alerts
    });

    // Load initial data
    loadHealthData();

    // Set up periodic refresh
    const interval = setInterval(loadHealthData, 30000); // Refresh every 30 seconds

    return () => {
      clearInterval(interval);
      unsubscribe();
      productionHealthMonitor.stopMonitoring();
    };
  }, []);

  const loadHealthData = async () => {
    try {
      setIsLoading(true);
      const metrics = productionHealthMonitor.getLatestMetrics();
      if (metrics) {
        setHealthMetrics(metrics);
        setLastUpdated(new Date());
      }
    } catch (error) {
      logger.logError('Failed to load health metrics', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: 'healthy' | 'warning' | 'critical') => {
    switch (status) {
      case 'healthy':return 'text-green-600';
      case 'warning':return 'text-yellow-600';
      case 'critical':return 'text-red-600';
      default:return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: 'healthy' | 'warning' | 'critical') => {
    switch (status) {
      case 'healthy':return <CheckCircle className="w-4 h-4" />;
      case 'warning':return <AlertTriangle className="w-4 h-4" />;
      case 'critical':return <AlertTriangle className="w-4 h-4" />;
      default:return <Activity className="w-4 h-4" />;
    }
  };

  const handleRefresh = () => {
    loadHealthData();
  };

  const handleDownloadReport = async () => {
    try {
      const healthReport = await productionHealthMonitor.generateHealthReport();
      const errorReport = await getErrorReport();

      const fullReport = `${healthReport}\n\n${errorReport}`;

      const blob = new Blob([fullReport], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `health-report-${new Date().toISOString().split('T')[0]}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      logger.logUserAction('download_health_report');
      auditLogger.logUserAction('download', 'health_report', {
        timestamp: new Date().toISOString(),
        reportType: 'combined'
      });
    } catch (error) {
      logger.logError('Failed to generate health report', error);
    }
  };

  const handleClearAlerts = () => {
    setAlerts([]);
    logger.logUserAction('clear_alerts');
  };

  const handleClearErrorMetrics = () => {
    clearMetrics();
    logger.logUserAction('clear_error_metrics');
  };

  if (isLoading && !healthMetrics) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Health Monitor</h2>
          <div className="animate-spin">
            <RefreshCw className="w-5 h-5" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) =>
          <Card key={i}>
              <CardHeader className="pb-2">
                <div className="w-6 h-6 bg-gray-200 rounded animate-pulse" />
                <div className="w-20 h-4 bg-gray-200 rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="w-16 h-8 bg-gray-200 rounded animate-pulse" />
              </CardContent>
            </Card>
          )}
        </div>
      </div>);

  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Health Monitor</h2>
          {lastUpdated &&
          <p className="text-sm text-gray-600 mt-1">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          }
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadReport}>
            <Download className="w-4 h-4 mr-2" />
            Download Report
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 &&
      <Alert className="border-yellow-200 bg-yellow-50">
          <AlertTriangle className="w-4 h-4 text-yellow-600" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              {alerts.length} active alert{alerts.length > 1 ? 's' : ''}
            </span>
            <Button variant="ghost" size="sm" onClick={handleClearAlerts}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </AlertDescription>
        </Alert>
      }

      {/* System Overview Cards */}
      {healthMetrics &&
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System</CardTitle>
              <Server className={getStatusColor(healthMetrics.system.status)} />
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                {getStatusIcon(healthMetrics.system.status)}
                <Badge variant={healthMetrics.system.status === 'healthy' ? 'default' : 'destructive'}>
                  {healthMetrics.system.status}
                </Badge>
              </div>
              <div className="mt-2 space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Memory</span>
                  <span>{healthMetrics.system.memory.percentage}%</span>
                </div>
                <Progress value={healthMetrics.system.memory.percentage} className="h-1" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Database</CardTitle>
              <Database className={getStatusColor(healthMetrics.database.status)} />
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                {getStatusIcon(healthMetrics.database.status)}
                <Badge variant={healthMetrics.database.status === 'healthy' ? 'default' : 'destructive'}>
                  {healthMetrics.database.status}
                </Badge>
              </div>
              <div className="mt-2 text-xs text-gray-600">
                Response: {Math.round(healthMetrics.database.responseTime)}ms
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Network</CardTitle>
              <Globe className={getStatusColor(healthMetrics.network.status)} />
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                {getStatusIcon(healthMetrics.network.status)}
                <Badge variant={healthMetrics.network.status === 'healthy' ? 'default' : 'destructive'}>
                  {healthMetrics.network.connectivity}
                </Badge>
              </div>
              <div className="mt-2 text-xs text-gray-600">
                Quality: {healthMetrics.network.connectionQuality}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Security</CardTitle>
              <Shield className={getStatusColor(healthMetrics.security.status)} />
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                {getStatusIcon(healthMetrics.security.status)}
                <Badge variant={healthMetrics.security.status === 'healthy' ? 'default' : 'destructive'}>
                  {healthMetrics.security.status}
                </Badge>
              </div>
              <div className="mt-2 text-xs text-gray-600">
                HTTPS: {healthMetrics.security.httpsEnforcement ? '✅' : '❌'}
              </div>
            </CardContent>
          </Card>
        </div>
      }

      {/* Detailed Tabs */}
      <Tabs defaultValue="metrics" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="errors">Errors</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="space-y-4">
          {healthMetrics &&
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="w-5 h-5" />
                    System Resources
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Memory Usage</span>
                      <span>{healthMetrics.system.memory.used}MB / {healthMetrics.system.memory.total}MB</span>
                    </div>
                    <Progress value={healthMetrics.system.memory.percentage} />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>CPU Usage</span>
                      <span>{healthMetrics.system.cpu.usage.toFixed(1)}%</span>
                    </div>
                    <Progress value={healthMetrics.system.cpu.usage} />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Storage</span>
                      <span>{healthMetrics.system.storage.used}MB / {healthMetrics.system.storage.total}MB</span>
                    </div>
                    <Progress value={healthMetrics.system.storage.percentage} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="w-5 h-5" />
                    Database Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Response Time</span>
                    <Badge variant="outline">{Math.round(healthMetrics.database.responseTime)}ms</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Active Connections</span>
                    <Badge variant="outline">{healthMetrics.database.activeConnections}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Pool Utilization</span>
                    <Badge variant="outline">{healthMetrics.database.poolUtilization.toFixed(1)}%</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Error Rate</span>
                    <Badge variant={healthMetrics.database.errorRate > 0 ? "destructive" : "default"}>
                      {healthMetrics.database.errorRate.toFixed(1)}%
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          }
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Error Summary
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={handleClearErrorMetrics}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Total Errors</span>
                  <Badge variant="outline">{errorMetrics.totalErrors}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Critical Errors</span>
                  <Badge variant={errorMetrics.criticalErrors > 0 ? "destructive" : "default"}>
                    {errorMetrics.criticalErrors}
                  </Badge>
                </div>
                {errorMetrics.lastError &&
                <div>
                    <span className="text-sm font-medium">Last Error</span>
                    <div className="mt-1 p-2 bg-red-50 rounded text-xs">
                      <div className="font-medium text-red-800">{errorMetrics.lastError.message}</div>
                      <div className="text-red-600 mt-1">
                        {errorMetrics.lastError.page} • {new Date(errorMetrics.lastError.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                }
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Error Distribution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(errorMetrics.errorsByType).length > 0 ?
                Object.entries(errorMetrics.errorsByType).
                sort((a, b) => b[1] - a[1]).
                slice(0, 5).
                map(([type, count]) =>
                <div key={type} className="flex justify-between items-center">
                        <span className="text-sm font-medium">{type}</span>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                ) :

                <p className="text-sm text-gray-600">No errors recorded</p>
                }
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          {healthMetrics &&
          <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Performance Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{Math.round(healthMetrics.performance.pageLoadTime)}ms</div>
                    <div className="text-sm text-gray-600">Page Load Time</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{Math.round(healthMetrics.performance.renderTime)}ms</div>
                    <div className="text-sm text-gray-600">First Paint</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{healthMetrics.performance.longTasks}</div>
                    <div className="text-sm text-gray-600">Long Tasks</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          }
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Recent Alerts
              </CardTitle>
              {alerts.length > 0 &&
              <Button variant="ghost" size="sm" onClick={handleClearAlerts}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear All
                </Button>
              }
            </CardHeader>
            <CardContent>
              {alerts.length > 0 ?
              <div className="space-y-3">
                  {alerts.map((alert, index) =>
                <div key={index} className="flex items-start space-x-3 p-3 bg-yellow-50 rounded-lg">
                      <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={alert.severity === 'critical' ? 'destructive' : 'default'}>
                            {alert.severity}
                          </Badge>
                          <span className="text-sm font-medium">{alert.type}</span>
                        </div>
                        <div className="text-sm mt-1">{alert.message}</div>
                        <div className="text-xs text-gray-600 mt-1">
                          {new Date(alert.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                )}
                </div> :

              <p className="text-sm text-gray-600">No alerts</p>
              }
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>);

};

export default HealthMonitorDashboard;