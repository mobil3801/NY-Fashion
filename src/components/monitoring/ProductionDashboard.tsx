
import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Database, 
  Globe, 
  MemoryStick, 
  Server, 
  TrendingUp,
  Zap,
  Eye,
  Download,
  RefreshCw
} from 'lucide-react';
import { usePerformanceMonitor } from '@/utils/enhanced-performance-monitor';
import { useAuditLogger } from '@/utils/audit-logger';
import { globalCache } from '@/utils/production-cache';
import { useToast } from '@/hooks/use-toast';

const ProductionDashboard: React.FC = () => {
  const { metrics, report, systemHealth, onAlert } = usePerformanceMonitor();
  const { getStatistics } = useAuditLogger();
  const { toast } = useToast();
  const [auditStats, setAuditStats] = React.useState<any>(null);
  const [cacheStats, setCacheStats] = React.useState<any>(null);
  const [systemStats, setSystemStats] = React.useState<any>(null);
  const [refreshing, setRefreshing] = React.useState(false);

  // Load system statistics
  React.useEffect(() => {
    const loadStats = async () => {
      try {
        setAuditStats(getStatistics(24));
        setCacheStats(globalCache.getStats());

        // Simulate system stats call
        const response = await window.ezsite.apis.run({
          path: 'systemHealthMonitor',
          param: []
        });

        if (response.error) {
          throw new Error(response.error);
        }

        setSystemStats(response.data);
      } catch (error) {
        console.error('Failed to load system statistics:', error);
        toast({
          title: 'Error Loading Statistics',
          description: 'Failed to load system statistics. Some data may be unavailable.',
          variant: 'destructive'
        });
      }
    };

    loadStats();
    const interval = setInterval(loadStats, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [getStatistics, toast]);

  // Handle performance alerts
  React.useEffect(() => {
    const unsubscribe = onAlert((metric) => {
      toast({
        title: 'Performance Alert',
        description: `${metric.name} is performing poorly (${metric.duration}ms)`,
        variant: 'destructive'
      });
    });

    return unsubscribe;
  }, [onAlert, toast]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Trigger manual refresh of all statistics
      setAuditStats(getStatistics(24));
      setCacheStats(globalCache.getStats());
      
      const response = await window.ezsite.apis.run({
        path: 'systemHealthMonitor',
        param: []
      });

      if (!response.error) {
        setSystemStats(response.data);
      }

      toast({
        title: 'Dashboard Refreshed',
        description: 'All statistics have been updated successfully.',
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: 'Refresh Failed',
        description: 'Failed to refresh dashboard statistics.',
        variant: 'destructive'
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleExportData = () => {
    try {
      const exportData = {
        timestamp: Date.now(),
        performanceMetrics: metrics.slice(0, 100),
        performanceReport: report,
        systemHealth: systemHealth,
        auditStatistics: auditStats,
        cacheStatistics: cacheStats,
        systemStatistics: systemStats
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `production-metrics-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Data Exported',
        description: 'Production metrics have been exported successfully.',
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'Failed to export production metrics.',
        variant: 'destructive'
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'healthy': return 'bg-green-500';
      case 'warning': return 'bg-yellow-500';
      case 'critical': return 'bg-red-500';
      case 'degraded': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'healthy': return <Badge className="bg-green-100 text-green-800">Healthy</Badge>;
      case 'warning': return <Badge className="bg-yellow-100 text-yellow-800">Warning</Badge>;
      case 'critical': return <Badge className="bg-red-100 text-red-800">Critical</Badge>;
      case 'degraded': return <Badge className="bg-orange-100 text-orange-800">Degraded</Badge>;
      default: return <Badge className="bg-gray-100 text-gray-800">Unknown</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Production Dashboard</h2>
          <p className="text-gray-600">Real-time system monitoring and performance metrics</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleExportData} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
        </div>
      </div>

      {/* System Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">System Status</p>
              <p className="text-2xl font-bold">
                {systemStats?.status ? getStatusBadge(systemStats.status) : 'Loading...'}
              </p>
            </div>
            <div className={`w-3 h-3 rounded-full ${getStatusColor(systemStats?.status || 'unknown')}`} />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Performance Score</p>
              <p className="text-2xl font-bold">{systemStats?.performanceScore || 0}/100</p>
            </div>
            <TrendingUp className="h-8 w-8 text-blue-600" />
          </div>
          {systemStats?.performanceScore && (
            <Progress value={systemStats.performanceScore} className="mt-2" />
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Alerts</p>
              <p className="text-2xl font-bold text-red-600">
                {systemStats?.alerts?.length || 0}
              </p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Uptime</p>
              <p className="text-2xl font-bold">
                {systemStats?.metrics?.uptime 
                  ? `${Math.floor(systemStats.metrics.uptime / 3600)}h`
                  : 'N/A'
                }
              </p>
            </div>
            <Clock className="h-8 w-8 text-green-600" />
          </div>
        </Card>
      </div>

      {/* Active Alerts */}
      {systemStats?.alerts && systemStats.alerts.length > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-semibold text-red-800">Active System Alerts:</p>
              {systemStats.alerts.slice(0, 3).map((alert: any, index: number) => (
                <div key={index} className="text-sm text-red-700">
                  <Badge variant="destructive" className="mr-2">{alert.level}</Badge>
                  {alert.message} ({alert.service})
                </div>
              ))}
              {systemStats.alerts.length > 3 && (
                <p className="text-sm text-red-600">
                  +{systemStats.alerts.length - 3} more alerts...
                </p>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Detailed Monitoring Tabs */}
      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="system">System Health</TabsTrigger>
          <TabsTrigger value="cache">Cache</TabsTrigger>
          <TabsTrigger value="audit">Audit Logs</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="h-5 w-5 text-yellow-600" />
                <h3 className="font-semibold">API Performance</h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Average Response Time</span>
                  <span>{report?.categories?.api?.averageDuration?.toFixed(0) || 0}ms</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>API Calls (1h)</span>
                  <span>{report?.categories?.api?.count || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Error Rate</span>
                  <span className="text-red-600">
                    {report?.categories?.api?.errorRate?.toFixed(1) || 0}%
                  </span>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Database className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold">Database Performance</h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Query Time</span>
                  <span>{report?.categories?.database?.averageDuration?.toFixed(0) || 0}ms</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Queries (1h)</span>
                  <span>{report?.categories?.database?.count || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Slow Queries</span>
                  <span className="text-orange-600">
                    {report?.categories?.database?.slowOperations || 0}
                  </span>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <MemoryStick className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold">Memory Usage</h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Current Usage</span>
                  <span>{systemHealth?.memory?.toFixed(1) || 0}%</span>
                </div>
                <Progress value={systemHealth?.memory || 0} className="h-2" />
                <div className="flex justify-between text-sm">
                  <span>Heap Used</span>
                  <span>{systemStats?.services?.memory?.heapUsed?.toFixed(0) || 0}MB</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Recent Metrics */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Performance Metrics
            </h3>
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {metrics.slice(0, 20).map((metric, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{metric.category}</Badge>
                      <span>{metric.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={metric.duration && metric.duration > 1000 ? 'text-red-600' : 'text-gray-600'}>
                        {metric.duration?.toFixed(0)}ms
                      </span>
                      {metric.success ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </Card>
        </TabsContent>

        {/* System Health Tab */}
        <TabsContent value="system" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {systemStats?.services && Object.entries(systemStats.services).map(([service, data]: [string, any]) => (
              <Card key={service} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold capitalize">{service}</h3>
                  {getStatusBadge(data.status)}
                </div>
                <div className="space-y-2 text-sm">
                  {data.responseTime && (
                    <div className="flex justify-between">
                      <span>Response Time</span>
                      <span>{data.responseTime.toFixed(0)}ms</span>
                    </div>
                  )}
                  {data.usage !== undefined && (
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span>Usage</span>
                        <span>{data.usage.toFixed(1)}%</span>
                      </div>
                      <Progress value={data.usage} className="h-2" />
                    </div>
                  )}
                  {data.errorRate !== undefined && (
                    <div className="flex justify-between">
                      <span>Error Rate</span>
                      <span className="text-red-600">{data.errorRate.toFixed(1)}%</span>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Cache Tab */}
        <TabsContent value="cache" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Cache Performance</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Hit Rate</span>
                  <span className="text-green-600">{(cacheStats?.hitRate * 100)?.toFixed(1) || 0}%</span>
                </div>
                <Progress value={(cacheStats?.hitRate * 100) || 0} className="h-2" />
                <div className="flex justify-between">
                  <span>Total Hits</span>
                  <span>{cacheStats?.hits || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Misses</span>
                  <span>{cacheStats?.misses || 0}</span>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-3">Cache Storage</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Items Cached</span>
                  <span>{cacheStats?.size || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Memory Usage</span>
                  <span>{((cacheStats?.memoryUsage || 0) / 1024 / 1024).toFixed(2)}MB</span>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-3">Recommendations</h3>
              <div className="space-y-1 text-sm">
                {(cacheStats?.hitRate || 1) < 0.7 && (
                  <div className="text-orange-600">• Consider increasing cache TTL</div>
                )}
                {(cacheStats?.size || 0) > 800 && (
                  <div className="text-yellow-600">• Cache size is growing large</div>
                )}
                {(cacheStats?.hitRate || 1) > 0.9 && (
                  <div className="text-green-600">• Cache performing excellently</div>
                )}
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Audit Tab */}
        <TabsContent value="audit" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Audit Statistics (24h)</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Total Events</span>
                  <span>{auditStats?.totalEvents || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Success Rate</span>
                  <span className="text-green-600">{auditStats?.successRate?.toFixed(1) || 0}%</span>
                </div>
                <Progress value={auditStats?.successRate || 100} className="h-2" />
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-3">Top Actions</h3>
              <ScrollArea className="h-32">
                <div className="space-y-1 text-sm">
                  {auditStats?.topActions?.slice(0, 5).map((action: any, index: number) => (
                    <div key={index} className="flex justify-between">
                      <span>{action.action}</span>
                      <span>{action.count}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-3">Security Events</h3>
              <div className="space-y-2 text-sm">
                {auditStats?.severityBreakdown && Object.entries(auditStats.severityBreakdown).map(([severity, count]: [string, any]) => (
                  <div key={severity} className="flex justify-between">
                    <Badge variant={severity === 'critical' ? 'destructive' : 'outline'}>
                      {severity}
                    </Badge>
                    <span>{count}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Database Tab */}
        <TabsContent value="database" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Database Health</h3>
              <div className="space-y-2 text-sm">
                {systemStats?.services?.database && (
                  <>
                    <div className="flex justify-between">
                      <span>Status</span>
                      {getStatusBadge(systemStats.services.database.status)}
                    </div>
                    <div className="flex justify-between">
                      <span>Response Time</span>
                      <span>{systemStats.services.database.responseTime?.toFixed(0)}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Active Connections</span>
                      <span>{systemStats.services.database.connectionPool?.active || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Idle Connections</span>
                      <span>{systemStats.services.database.connectionPool?.idle || 0}</span>
                    </div>
                  </>
                )}
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-3">Query Performance</h3>
              <div className="space-y-2 text-sm">
                {systemStats?.services?.database?.queryPerformance && (
                  <>
                    <div className="flex justify-between">
                      <span>Avg Query Time</span>
                      <span>{systemStats.services.database.queryPerformance.avgQueryTime?.toFixed(0)}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Slow Queries</span>
                      <span className="text-orange-600">
                        {systemStats.services.database.queryPerformance.slowQueries || 0}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Recommendations Tab */}
        <TabsContent value="recommendations" className="space-y-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Eye className="h-5 w-5" />
              System Recommendations
            </h3>
            <div className="space-y-3">
              {report?.recommendations?.map((rec: string, index: number) => (
                <div key={index} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800">{rec}</p>
                </div>
              ))}
              
              {systemStats?.recommendations?.map((rec: string, index: number) => (
                <div key={`sys-${index}`} className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm text-green-800">{rec}</p>
                </div>
              ))}
              
              {(!report?.recommendations?.length && !systemStats?.recommendations?.length) && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">No recommendations available. System is performing well!</p>
                </div>
              )}
            </div>
          </Card>

          {report?.criticalIssues && report.criticalIssues.length > 0 && (
            <Card className="p-4 border-red-200 bg-red-50">
              <h3 className="font-semibold mb-3 text-red-800 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Critical Issues Requiring Immediate Attention
              </h3>
              <div className="space-y-2">
                {report.criticalIssues.map((issue: string, index: number) => (
                  <div key={index} className="p-2 bg-red-100 rounded border border-red-300">
                    <p className="text-sm text-red-900">{issue}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProductionDashboard;
