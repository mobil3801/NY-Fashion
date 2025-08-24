
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Activity, 
  AlertCircle, 
  CheckCircle, 
  TrendingUp, 
  TrendingDown, 
  RefreshCw,
  Server,
  Database,
  Zap,
  Clock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SystemHealth {
  status: string;
  timestamp: string;
  uptime: number;
  memory: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
  };
  database: {
    connected: boolean;
    responseTime: number;
  };
  performance: {
    responseTime: number;
    avgResponseTime: number;
    requestsPerSecond: number;
    errorRate: number;
  };
  systemLoad: {
    cpu: number;
    memory: number;
    disk: number;
  };
  components: {
    [key: string]: string;
  };
}

const MonitoringDashboard: React.FC = () => {
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { toast } = useToast();

  const fetchSystemHealth = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await window.ezsite.apis.run({
        path: "enhancedHealthCheck",
        param: []
      });

      if (error) throw new Error(error);
      
      setSystemHealth(data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to fetch system health:', error);
      toast({
        variant: "destructive",
        title: "Health Check Failed",
        description: "Unable to fetch system health data"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSystemHealth();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchSystemHealth, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy': return 'default';
      case 'degraded': return 'secondary';
      case 'unhealthy': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'degraded': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'unhealthy': return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / (24 * 3600));
    const hours = Math.floor((seconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (!systemHealth) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p>Loading system health...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Monitoring</h1>
          <p className="text-muted-foreground">
            Real-time system health and performance monitoring
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? 'bg-green-50 border-green-200' : ''}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSystemHealth}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overall Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              {getStatusIcon(systemHealth.status)}
              <div>
                <p className="text-sm font-medium">Overall Status</p>
                <Badge variant={getStatusColor(systemHealth.status) as any}>
                  {systemHealth.status.toUpperCase()}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Uptime</p>
                <p className="text-lg font-semibold">{formatUptime(systemHealth.uptime)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-sm font-medium">Avg Response</p>
                <p className="text-lg font-semibold">{systemHealth.performance.avgResponseTime.toFixed(0)}ms</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-sm font-medium">Requests/sec</p>
                <p className="text-lg font-semibold">{systemHealth.performance.requestsPerSecond.toFixed(1)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="components">Components</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Database Health
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Status</span>
                    <Badge variant={systemHealth.database.connected ? 'default' : 'destructive'}>
                      {systemHealth.database.connected ? 'Connected' : 'Disconnected'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Response Time</span>
                    <span>{systemHealth.database.responseTime.toFixed(0)}ms</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Performance Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Current Response</span>
                    <span>{systemHealth.performance.responseTime}ms</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Error Rate</span>
                    <span>{(systemHealth.performance.errorRate * 100).toFixed(2)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {systemHealth.performance.errorRate > 0.1 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                High error rate detected ({(systemHealth.performance.errorRate * 100).toFixed(2)}%). 
                Consider investigating recent changes or system issues.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>System Load</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>CPU Usage</span>
                    <span>{systemHealth.systemLoad.cpu.toFixed(1)}%</span>
                  </div>
                  <Progress value={systemHealth.systemLoad.cpu} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Memory Usage</span>
                    <span>{systemHealth.systemLoad.memory.toFixed(1)}%</span>
                  </div>
                  <Progress value={systemHealth.systemLoad.memory} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Disk Usage</span>
                    <span>{systemHealth.systemLoad.disk.toFixed(1)}%</span>
                  </div>
                  <Progress value={systemHealth.systemLoad.disk} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Memory Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Heap Used</span>
                    <span>{systemHealth.memory.heapUsed}MB</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Heap Total</span>
                    <span>{systemHealth.memory.heapTotal}MB</span>
                  </div>
                  <div className="flex justify-between">
                    <span>RSS</span>
                    <span>{systemHealth.memory.rss}MB</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="components" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(systemHealth.components).map(([component, status]) => (
              <Card key={component}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4" />
                      <span className="font-medium capitalize">{component}</span>
                    </div>
                    <Badge variant={getStatusColor(status) as any}>
                      {status.toUpperCase()}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-medium mb-2">Application</h4>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Service</span>
                      <span>NY FASHION POS</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Environment</span>
                      <span>{systemHealth.environment}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Last Update</span>
                      <span>{lastUpdate?.toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Health Checks</h4>
                  <div className="space-y-1">
                    {Object.entries(systemHealth.checks || {}).map(([check, passed]) => (
                      <div key={check} className="flex justify-between">
                        <span className="capitalize">{check.replace('_', ' ')}</span>
                        <span className={passed ? 'text-green-600' : 'text-red-600'}>
                          {passed ? '✓' : '✗'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MonitoringDashboard;
