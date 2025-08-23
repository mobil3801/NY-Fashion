
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Activity, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Cpu,
  HardDrive,
  Zap,
  Users,
  Database,
  Globe,
  BarChart3,
  LineChart,
  PieChart,
  RefreshCw
} from 'lucide-react';
import { useRealTimeMonitoring } from '@/hooks/use-real-time-monitoring';
import { useDeploymentControl } from '@/hooks/use-deployment-control';

interface MetricCard {
  title: string;
  value: string | number;
  change: number;
  icon: React.ReactNode;
  color: string;
  trend: 'up' | 'down' | 'neutral';
}

interface AlertItem {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  component: string;
  resolved: boolean;
}

const ComprehensiveMonitoringDashboard: React.FC = () => {
  const [timeRange, setTimeRange] = useState('1h');
  const [selectedComponent, setSelectedComponent] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { currentMetrics, systemHealth, processedAlerts } = useRealTimeMonitoring();
  const { deploymentMetrics, environments } = useDeploymentControl();

  // Transform alerts for display
  const alerts: AlertItem[] = processedAlerts.map(alert => ({
    id: alert.id.toString(),
    severity: alert.severity,
    title: `${alert.severity.toUpperCase()} Alert`,
    message: alert.message,
    timestamp: alert.timestamp,
    component: 'system',
    resolved: alert.resolved
  }));

  // Metric cards data
  const metricCards: MetricCard[] = [
    {
      title: 'Error Rate',
      value: `${currentMetrics.error_rate.toFixed(2)}%`,
      change: -0.3,
      icon: <AlertTriangle className="w-5 h-5" />,
      color: 'text-red-500',
      trend: currentMetrics.error_rate < 1 ? 'down' : 'up'
    },
    {
      title: 'Response Time',
      value: `${currentMetrics.response_time.toFixed(0)}ms`,
      change: 15,
      icon: <Zap className="w-5 h-5" />,
      color: 'text-yellow-500',
      trend: currentMetrics.response_time > 1000 ? 'up' : 'down'
    },
    {
      title: 'Throughput',
      value: `${currentMetrics.throughput.toFixed(0)} req/s`,
      change: 8.2,
      icon: <Activity className="w-5 h-5" />,
      color: 'text-blue-500',
      trend: 'up'
    },
    {
      title: 'CPU Usage',
      value: `${currentMetrics.cpu_usage.toFixed(1)}%`,
      change: -2.1,
      icon: <Cpu className="w-5 h-5" />,
      color: 'text-green-500',
      trend: currentMetrics.cpu_usage > 80 ? 'up' : 'down'
    },
    {
      title: 'Memory Usage',
      value: `${currentMetrics.memory_usage.toFixed(1)}%`,
      change: 1.5,
      icon: <HardDrive className="w-5 h-5" />,
      color: 'text-purple-500',
      trend: 'up'
    },
    {
      title: 'Active Connections',
      value: currentMetrics.active_connections,
      change: 12,
      icon: <Users className="w-5 h-5" />,
      color: 'text-indigo-500',
      trend: 'up'
    }
  ];

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-red-500" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-green-500" />;
      default:
        return <div className="w-4 h-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'border-red-500 bg-red-50';
      case 'warning':
        return 'border-yellow-500 bg-yellow-50';
      case 'info':
        return 'border-blue-500 bg-blue-50';
      default:
        return 'border-gray-500 bg-gray-50';
    }
  };

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-500';
      case 'degraded':
        return 'text-yellow-500';
      case 'critical':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">System Monitoring Dashboard</h2>
          <p className="text-gray-600">Real-time system health and performance metrics</p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5m">5m</SelectItem>
              <SelectItem value="1h">1h</SelectItem>
              <SelectItem value="6h">6h</SelectItem>
              <SelectItem value="24h">24h</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedComponent} onValueChange={setSelectedComponent}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Components</SelectItem>
              <SelectItem value="api">API</SelectItem>
              <SelectItem value="database">Database</SelectItem>
              <SelectItem value="frontend">Frontend</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto Refresh
          </Button>
        </div>
      </div>

      {/* System Health Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            System Health Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className={`text-4xl font-bold ${getHealthStatusColor(systemHealth.status)}`}>
                {systemHealth.status === 'healthy' ? '✓' : systemHealth.status === 'degraded' ? '⚠' : '✗'}
              </div>
              <div className="mt-2 font-medium capitalize">{systemHealth.status}</div>
              <div className="text-sm text-gray-600">Overall Status</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-500">{systemHealth.uptime}%</div>
              <div className="mt-2 font-medium">Uptime</div>
              <div className="text-sm text-gray-600">Last 30 days</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-green-500">
                {alerts.filter(a => !a.resolved).length}
              </div>
              <div className="mt-2 font-medium">Active Alerts</div>
              <div className="text-sm text-gray-600">Requiring attention</div>
            </div>
          </div>
          
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(systemHealth.components).map(([component, status]) => (
              <div key={component} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  <span className="capitalize font-medium">{component}</span>
                </div>
                <Badge className={status === 'healthy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                  {status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {metricCards.map((metric, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{metric.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-2xl font-bold">{metric.value}</span>
                    <div className="flex items-center gap-1 text-sm">
                      {getTrendIcon(metric.trend)}
                      <span className={metric.change > 0 ? 'text-red-500' : 'text-green-500'}>
                        {Math.abs(metric.change)}%
                      </span>
                    </div>
                  </div>
                </div>
                <div className={metric.color}>
                  {metric.icon}
                </div>
              </div>
              <Progress 
                value={typeof metric.value === 'string' ? parseFloat(metric.value) : metric.value} 
                className="mt-3 h-2" 
              />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Monitoring Tabs */}
      <Tabs defaultValue="performance" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="errors">Error Analysis</TabsTrigger>
          <TabsTrigger value="alerts">Active Alerts</TabsTrigger>
          <TabsTrigger value="deployments">Deployment History</TabsTrigger>
          <TabsTrigger value="infrastructure">Infrastructure</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChart className="w-5 h-5" />
                  Response Time Trends
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg">
                  <div className="text-center text-gray-500">
                    <BarChart3 className="w-8 h-8 mx-auto mb-2" />
                    <p>Response time chart would be rendered here</p>
                    <p className="text-sm">Current: {currentMetrics.response_time.toFixed(0)}ms</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="w-5 h-5" />
                  Resource Utilization
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span>CPU Usage</span>
                    <span className="font-medium">{currentMetrics.cpu_usage.toFixed(1)}%</span>
                  </div>
                  <Progress value={currentMetrics.cpu_usage} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span>Memory Usage</span>
                    <span className="font-medium">{currentMetrics.memory_usage.toFixed(1)}%</span>
                  </div>
                  <Progress value={currentMetrics.memory_usage} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span>Disk I/O</span>
                    <span className="font-medium">42%</span>
                  </div>
                  <Progress value={42} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span>Network I/O</span>
                    <span className="font-medium">28%</span>
                  </div>
                  <Progress value={28} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics Table</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Metric</th>
                      <th className="text-left py-3 px-4">Current</th>
                      <th className="text-left py-3 px-4">Average (1h)</th>
                      <th className="text-left py-3 px-4">Threshold</th>
                      <th className="text-left py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-3 px-4">Response Time</td>
                      <td className="py-3 px-4">{currentMetrics.response_time.toFixed(0)}ms</td>
                      <td className="py-3 px-4">850ms</td>
                      <td className="py-3 px-4">2000ms</td>
                      <td className="py-3 px-4">
                        <Badge variant="default">Healthy</Badge>
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4">Error Rate</td>
                      <td className="py-3 px-4">{currentMetrics.error_rate.toFixed(2)}%</td>
                      <td className="py-3 px-4">1.2%</td>
                      <td className="py-3 px-4">5%</td>
                      <td className="py-3 px-4">
                        <Badge variant="default">Healthy</Badge>
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4">Throughput</td>
                      <td className="py-3 px-4">{currentMetrics.throughput.toFixed(0)} req/s</td>
                      <td className="py-3 px-4">45 req/s</td>
                      <td className="py-3 px-4">10 req/s</td>
                      <td className="py-3 px-4">
                        <Badge variant="default">Healthy</Badge>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Error Rate Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg">
                  <div className="text-center text-gray-500">
                    <TrendingUp className="w-8 h-8 mx-auto mb-2" />
                    <p>Error rate trend chart</p>
                    <p className="text-sm">Current rate: {currentMetrics.error_rate.toFixed(2)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Error Categories</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span>Database Connection</span>
                  <Badge variant="destructive">15</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>API Timeout</span>
                  <Badge variant="destructive">8</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Validation Errors</span>
                  <Badge variant="outline">12</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Authentication</span>
                  <Badge variant="outline">5</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <div className="space-y-4">
            {alerts.slice(0, 10).map((alert) => (
              <Alert key={alert.id} className={getSeverityColor(alert.severity)}>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="font-medium">{alert.title}</div>
                      <div className="text-sm">{alert.message}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(alert.timestamp).toLocaleString()} • {alert.component}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={alert.severity === 'critical' ? 'destructive' : 'default'}>
                        {alert.severity}
                      </Badge>
                      {!alert.resolved && (
                        <Button size="sm" variant="outline">
                          Resolve
                        </Button>
                      )}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            ))}
            {alerts.length === 0 && (
              <div className="text-center py-12">
                <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-4" />
                <h3 className="text-lg font-medium">No Active Alerts</h3>
                <p className="text-gray-600">All systems are operating normally</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="deployments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Deployment Success Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-500">{deploymentMetrics.total_deployments}</div>
                  <div className="text-sm text-gray-600 mt-1">Total Deployments</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-500">{deploymentMetrics.success_rate.toFixed(1)}%</div>
                  <div className="text-sm text-gray-600 mt-1">Success Rate</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-500">{deploymentMetrics.failed_deployments}</div>
                  <div className="text-sm text-gray-600 mt-1">Failed Deployments</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-orange-500">{deploymentMetrics.rollback_count}</div>
                  <div className="text-sm text-gray-600 mt-1">Rollbacks</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="infrastructure" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Environment Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {environments.map((env: any) => (
                  <div key={env.id} className="p-4 border rounded-lg">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-medium capitalize">{env.environment_name}</h3>
                      <Badge className={env.status === 'healthy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                        {env.status}
                      </Badge>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Database:</span>
                        <span className={env.database_status === 'connected' ? 'text-green-600' : 'text-red-600'}>
                          {env.database_status}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Circuit Breaker:</span>
                        <span className={env.circuit_breaker_status === 'closed' ? 'text-green-600' : 'text-red-600'}>
                          {env.circuit_breaker_status}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                        Last check: {new Date(env.last_health_check || Date.now()).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ComprehensiveMonitoringDashboard;
