
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Activity,
  Database,
  Zap,
  HardDrive,
  Network,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  RefreshCw,
  Settings,
  Eye } from
'lucide-react';
import { usePerformanceMonitor } from '@/utils/enhanced-performance-monitor';
import useCache from '@/utils/production-cache';
import { useMemoryManagement } from '@/utils/memory-manager';
import ProductionDashboard from './ProductionDashboard';
import { useToast } from '@/hooks/use-toast';

interface PerformanceMetrics {
  category: string;
  value: number;
  unit: string;
  status: 'good' | 'warning' | 'critical';
  trend?: 'up' | 'down' | 'stable';
}

const PerformanceDashboard: React.FC = () => {
  const { metrics, report, startTiming, endTiming } = usePerformanceMonitor();
  const { stats: cacheStats } = useCache();
  const { memoryInfo, forceCleanup } = useMemoryManagement('performance-dashboard');
  const { toast } = useToast();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [systemMetrics, setSystemMetrics] = useState<PerformanceMetrics[]>([]);

  useEffect(() => {
    loadHealthStatus();
    const interval = setInterval(loadHealthStatus, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (report) {
      updateSystemMetrics();
    }
  }, [report, memoryInfo, cacheStats]);

  const loadHealthStatus = async () => {
    try {
      const { data, error } = await window.ezsite.apis.run({
        path: 'productionHealthCheck',
        param: []
      });

      if (error) throw new Error(error);
      setHealthStatus(data);
    } catch (error) {
      console.error('Failed to load health status:', error);
      toast({
        title: "Health Check Failed",
        description: "Failed to load system health status",
        variant: "destructive"
      });
    }
  };

  const updateSystemMetrics = () => {
    const newMetrics: PerformanceMetrics[] = [];

    // Database performance
    if (report?.categories?.database) {
      newMetrics.push({
        category: 'Database',
        value: Math.round(report.categories.database.averageDuration || 0),
        unit: 'ms',
        status: report.categories.database.averageDuration > 1000 ? 'critical' :
        report.categories.database.averageDuration > 500 ? 'warning' : 'good'
      });
    }

    // API performance
    if (report?.categories?.api) {
      newMetrics.push({
        category: 'API',
        value: Math.round(report.categories.api.averageDuration || 0),
        unit: 'ms',
        status: report.categories.api.averageDuration > 2000 ? 'critical' :
        report.categories.api.averageDuration > 1000 ? 'warning' : 'good'
      });
    }

    // Memory usage
    if (memoryInfo) {
      newMetrics.push({
        category: 'Memory',
        value: Math.round(memoryInfo.percentage),
        unit: '%',
        status: memoryInfo.percentage > 80 ? 'critical' :
        memoryInfo.percentage > 60 ? 'warning' : 'good'
      });
    }

    // Cache utilization
    newMetrics.push({
      category: 'Cache',
      value: Math.round(cacheStats.utilization),
      unit: '%',
      status: cacheStats.utilization > 90 ? 'warning' : 'good'
    });

    setSystemMetrics(newMetrics);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadHealthStatus();
      toast({
        title: "Dashboard Refreshed",
        description: "Performance metrics updated successfully"
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh dashboard",
        variant: "destructive"
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleMemoryCleanup = () => {
    forceCleanup();
    toast({
      title: "Memory Cleanup",
      description: "Memory cleanup executed successfully"
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'HEALTHY':
      case 'good':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'WARNING':
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'CRITICAL':
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'HEALTHY':
      case 'good':
        return 'default';
      case 'WARNING':
      case 'warning':
        return 'secondary';
      case 'CRITICAL':
      case 'critical':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Performance Dashboard</h2>
          <p className="text-muted-foreground">
            Monitor system performance and health metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleMemoryCleanup}>

            <HardDrive className="h-4 w-4 mr-2" />
            Cleanup Memory
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}>

            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overall Health Status */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">System Health</CardTitle>
          {healthStatus && getStatusIcon(healthStatus.status)}
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Badge variant={getStatusColor(healthStatus?.status || 'unknown') as any}>
              {healthStatus?.status || 'Unknown'}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Last updated: {healthStatus?.timestamp ? new Date(healthStatus.timestamp).toLocaleTimeString() : 'Never'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {systemMetrics.map((metric) =>
        <Card key={metric.category}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{metric.category}</CardTitle>
              <div className="flex items-center gap-1">
                {getStatusIcon(metric.status)}
                {metric.trend &&
              <TrendingUp className={`h-3 w-3 ${
              metric.trend === 'up' ? 'text-red-500' :
              metric.trend === 'down' ? 'text-green-500' :
              'text-gray-500'}`
              } />
              }
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metric.value}{metric.unit}
              </div>
              <Progress
              value={metric.unit === '%' ? metric.value : Math.min(metric.value / 1000 * 100, 100)}
              className="mt-2" />

            </CardContent>
          </Card>
        )}
      </div>

      {/* Detailed Metrics Tabs */}
      <Tabs defaultValue="production" className="space-y-4">
        <TabsList>
          <TabsTrigger value="production">Production</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="health">Health Checks</TabsTrigger>
          <TabsTrigger value="cache">Cache</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>

        <TabsContent value="production" className="space-y-4">
          <ProductionDashboard />
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Recent Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Recent Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-80">
                  <div className="space-y-2">
                    {metrics.slice(0, 20).map((metric, index) =>
                    <div key={index} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center gap-2">
                          {metric.category === 'database' && <Database className="h-4 w-4" />}
                          {metric.category === 'api' && <Zap className="h-4 w-4" />}
                          {metric.category === 'render' && <Activity className="h-4 w-4" />}
                          {metric.category === 'network' && <Network className="h-4 w-4" />}
                          {metric.category === 'memory' && <HardDrive className="h-4 w-4" />}
                          <div>
                            <div className="text-sm font-medium">{metric.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(metric.startTime).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={metric.success ? 'default' : 'destructive'}>
                            {metric.duration ? `${Math.round(metric.duration)}ms` : 'N/A'}
                          </Badge>
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Performance Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Performance Summary</CardTitle>
              </CardHeader>
              <CardContent>
                {report &&
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-2xl font-bold">{report.summary.totalMetrics}</div>
                        <div className="text-xs text-muted-foreground">Total Metrics</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">
                          {Math.round(report.summary.successRate)}%
                        </div>
                        <div className="text-xs text-muted-foreground">Success Rate</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">
                          {Math.round(report.summary.averageDuration)}ms
                        </div>
                        <div className="text-xs text-muted-foreground">Avg Duration</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{report.slowOperations.length}</div>
                        <div className="text-xs text-muted-foreground">Slow Operations</div>
                      </div>
                    </div>
                  </div>
                }
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          {healthStatus &&
          <div className="grid gap-4">
              {Object.entries(healthStatus.checks || {}).map(([category, check]: [string, any]) =>
            <Card key={category}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium capitalize">{category}</CardTitle>
                    {getStatusIcon(check.status)}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {check.responseTime &&
                  <div className="text-sm">
                          Response Time: <Badge variant="outline">{check.responseTime}ms</Badge>
                        </div>
                  }
                      {check.issues && check.issues.length > 0 &&
                  <div className="text-sm">
                          <div className="font-medium">Issues:</div>
                          <ul className="list-disc list-inside text-muted-foreground">
                            {check.issues.map((issue: string, index: number) =>
                      <li key={index}>{issue}</li>
                      )}
                          </ul>
                        </div>
                  }
                      {check.metrics &&
                  <div className="text-sm">
                          <div className="font-medium">Metrics:</div>
                          <div className="grid grid-cols-2 gap-2 mt-1">
                            {Object.entries(check.metrics).map(([key, value]: [string, any]) =>
                      <div key={key} className="text-xs">
                                <span className="text-muted-foreground">{key}:</span> {value}
                              </div>
                      )}
                          </div>
                        </div>
                  }
                    </div>
                  </CardContent>
                </Card>
            )}
            </div>
          }
        </TabsContent>

        <TabsContent value="cache" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Cache Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-2xl font-bold">{cacheStats.totalEntries}</div>
                      <div className="text-xs text-muted-foreground">Total Entries</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{cacheStats.activeEntries}</div>
                      <div className="text-xs text-muted-foreground">Active Entries</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">
                        {Math.round(cacheStats.utilization)}%
                      </div>
                      <div className="text-xs text-muted-foreground">Utilization</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">
                        {Math.round(cacheStats.totalSizeBytes / 1024)}KB
                      </div>
                      <div className="text-xs text-muted-foreground">Total Size</div>
                    </div>
                  </div>
                  <Progress value={cacheStats.utilization} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Memory Usage</CardTitle>
              </CardHeader>
              <CardContent>
                {memoryInfo ?
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-2xl font-bold">
                          {Math.round(memoryInfo.usedJSHeapSize / 1024 / 1024)}MB
                        </div>
                        <div className="text-xs text-muted-foreground">Used Memory</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">
                          {Math.round(memoryInfo.jsHeapSizeLimit / 1024 / 1024)}MB
                        </div>
                        <div className="text-xs text-muted-foreground">Memory Limit</div>
                      </div>
                    </div>
                    <Progress value={memoryInfo.percentage} />
                    <div className="text-sm text-muted-foreground">
                      {Math.round(memoryInfo.percentage)}% of available memory used
                    </div>
                  </div> :

                <div className="text-sm text-muted-foreground">
                    Memory information not available
                  </div>
                }
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Performance Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {report?.recommendations?.map((recommendation: string, index: number) =>
                <div key={index} className="flex items-start gap-2 p-2 border rounded">
                    <Settings className="h-4 w-4 mt-0.5 text-blue-500" />
                    <div className="text-sm">{recommendation}</div>
                  </div>
                )}
                {healthStatus?.recommendations?.map((recommendation: string, index: number) =>
                <div key={`health-${index}`} className="flex items-start gap-2 p-2 border rounded">
                    <AlertTriangle className="h-4 w-4 mt-0.5 text-yellow-500" />
                    <div className="text-sm">{recommendation}</div>
                  </div>
                )}
                {!report?.recommendations?.length && !healthStatus?.recommendations?.length &&
                <div className="text-sm text-muted-foreground">
                    No performance recommendations at this time
                  </div>
                }
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>);

};

export default PerformanceDashboard;