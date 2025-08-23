
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Area, AreaChart } from 'recharts';
import { Activity, AlertTriangle, TrendingUp, TrendingDown, Minus, Clock, Server, HardDrive, Zap } from 'lucide-react';
import { toast } from 'sonner';
import ComprehensivePerformanceMonitor from '@/utils/comprehensive-performance-monitor';
import PerformanceAnalyticsEngine from '@/utils/performance-analytics-engine';

interface MetricData {
  timestamp: number;
  value: number;
  name: string;
  type: string;
}

interface AlertData {
  id: number;
  severity: string;
  message: string;
  metricType: string;
  currentValue: number;
  thresholdValue: number;
  recommendations: string;
  createdAt: string;
  status: string;
}

const ComprehensivePerformanceDashboard: React.FC = () => {
  const [performanceMonitor] = useState(() => new ComprehensivePerformanceMonitor());
  const [analyticsEngine] = useState(() => new PerformanceAnalyticsEngine());
  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [performanceScore, setPerformanceScore] = useState(100);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState('1h');
  const [analytics, setAnalytics] = useState<any>(null);
  const [realTimeMetrics, setRealTimeMetrics] = useState<Record<string, any>>({});

  useEffect(() => {
    loadPerformanceData();
    const interval = setInterval(() => {
      updateRealTimeMetrics();
    }, 5000); // Update every 5 seconds

    return () => {
      clearInterval(interval);
      performanceMonitor.destroy();
    };
  }, [selectedTimeRange]);

  const loadPerformanceData = async () => {
    setIsLoading(true);
    try {
      const timeRange = getTimeRange(selectedTimeRange);
      const [metricsData, alertsData, analyticsData] = await Promise.all([
        fetchMetrics(timeRange),
        fetchAlerts(timeRange),
        analyticsEngine.generateAnalytics(timeRange)
      ]);

      setMetrics(metricsData);
      setAlerts(alertsData);
      setAnalytics(analyticsData);
      setPerformanceScore(analyticsData.performanceScore);
    } catch (error) {
      console.error('Failed to load performance data:', error);
      toast.error('Failed to load performance data');
    } finally {
      setIsLoading(false);
    }
  };

  const updateRealTimeMetrics = () => {
    const summary = performanceMonitor.getMetricsSummary();
    const apiSummary = performanceMonitor.getAPIMetricsSummary();
    setRealTimeMetrics({ ...summary, ...apiSummary });
  };

  const getTimeRange = (range: string) => {
    const end = new Date();
    const start = new Date();
    
    switch (range) {
      case '1h':
        start.setHours(start.getHours() - 1);
        break;
      case '24h':
        start.setHours(start.getHours() - 24);
        break;
      case '7d':
        start.setDate(start.getDate() - 7);
        break;
      case '30d':
        start.setDate(start.getDate() - 30);
        break;
      default:
        start.setHours(start.getHours() - 1);
    }
    
    return { start, end };
  };

  const fetchMetrics = async (timeRange: { start: Date; end: Date }) => {
    try {
      const { data, error } = await window.ezsite.apis.tablePage(37305, {
        PageNo: 1,
        PageSize: 1000,
        Filters: [
          {
            name: 'created_at',
            op: 'GreaterThanOrEqual',
            value: timeRange.start.toISOString()
          },
          {
            name: 'created_at',
            op: 'LessThanOrEqual',
            value: timeRange.end.toISOString()
          }
        ],
        OrderByField: 'created_at',
        IsAsc: true
      });

      if (error) throw new Error(error);
      
      return (data?.List || []).map((item: any) => ({
        timestamp: new Date(item.created_at).getTime(),
        value: item.value,
        name: item.metric_name,
        type: item.metric_type
      }));
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
      return [];
    }
  };

  const fetchAlerts = async (timeRange: { start: Date; end: Date }) => {
    try {
      const { data, error } = await window.ezsite.apis.tablePage(37306, {
        PageNo: 1,
        PageSize: 100,
        Filters: [
          {
            name: 'created_at',
            op: 'GreaterThanOrEqual',
            value: timeRange.start.toISOString()
          },
          {
            name: 'created_at',
            op: 'LessThanOrEqual',
            value: timeRange.end.toISOString()
          }
        ],
        OrderByField: 'created_at',
        IsAsc: false
      });

      if (error) throw new Error(error);
      return data?.List || [];
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
      return [];
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      default: return 'secondary';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'high': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'medium': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default: return <AlertTriangle className="h-4 w-4 text-blue-500" />;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'degrading': return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatMetricValue = (value: number, unit: string) => {
    if (unit === 'ms') {
      return value > 1000 ? `${(value / 1000).toFixed(2)}s` : `${value.toFixed(0)}ms`;
    }
    if (unit === 'MB') {
      return `${value.toFixed(1)}MB`;
    }
    return `${value.toFixed(2)} ${unit}`;
  };

  const getPerformanceScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    if (score >= 50) return 'text-orange-600';
    return 'text-red-600';
  };

  const processChartData = (metrics: MetricData[], type: string) => {
    return metrics
      .filter(m => m.type === type)
      .reduce((acc, metric) => {
        const timestamp = new Date(metric.timestamp).toISOString().substring(0, 16);
        const existing = acc.find(item => item.timestamp === timestamp);
        
        if (existing) {
          existing[metric.name] = metric.value;
        } else {
          acc.push({
            timestamp,
            [metric.name]: metric.value
          });
        }
        
        return acc;
      }, [] as any[])
      .slice(-50); // Last 50 data points
  };

  const activeAlerts = alerts.filter(a => a.status === 'active');
  const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical');

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Performance Monitoring</h1>
          <p className="text-muted-foreground">Real-time application performance insights and analytics</p>
        </div>
        
        <div className="flex items-center gap-2">
          {['1h', '24h', '7d', '30d'].map(range => (
            <Button
              key={range}
              variant={selectedTimeRange === range ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedTimeRange(range)}
            >
              {range}
            </Button>
          ))}
          <Button onClick={loadPerformanceData} size="sm" variant="secondary">
            Refresh
          </Button>
        </div>
      </div>

      {/* Critical Alerts Banner */}
      {criticalAlerts.length > 0 && (
        <Alert className="border-red-500 bg-red-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-red-700">Critical Performance Issues Detected</AlertTitle>
          <AlertDescription className="text-red-600">
            {criticalAlerts.length} critical performance {criticalAlerts.length === 1 ? 'issue' : 'issues'} requiring immediate attention.
          </AlertDescription>
        </Alert>
      )}

      {/* Performance Score & Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Performance Score</p>
                <p className={`text-3xl font-bold ${getPerformanceScoreColor(performanceScore)}`}>
                  {performanceScore}
                </p>
              </div>
              <div className="p-2 bg-blue-100 rounded-full">
                <Activity className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <Progress value={performanceScore} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Alerts</p>
                <p className="text-3xl font-bold">{activeAlerts.length}</p>
              </div>
              <div className="p-2 bg-red-100 rounded-full">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Load Time</p>
                <p className="text-3xl font-bold">
                  {realTimeMetrics.load_time_page_load?.average 
                    ? formatMetricValue(realTimeMetrics.load_time_page_load.average, 'ms')
                    : 'N/A'}
                </p>
              </div>
              <div className="p-2 bg-green-100 rounded-full">
                <Clock className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Memory Usage</p>
                <p className="text-3xl font-bold">
                  {realTimeMetrics.memory_heap_used?.average 
                    ? formatMetricValue(realTimeMetrics.memory_heap_used.average, 'MB')
                    : 'N/A'}
                </p>
              </div>
              <div className="p-2 bg-purple-100 rounded-full">
                <HardDrive className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="load-times">Load Times</TabsTrigger>
          <TabsTrigger value="api-performance">API Performance</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Load Time Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Load Time Trends</CardTitle>
                <CardDescription>Page load performance over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={processChartData(metrics, 'load_time')}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" tickFormatter={(value) => new Date(value).toLocaleTimeString()} />
                    <YAxis />
                    <Tooltip labelFormatter={(value) => new Date(value).toLocaleString()} />
                    <Area type="monotone" dataKey="page_load" stackId="1" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} />
                    <Area type="monotone" dataKey="first_contentful_paint" stackId="2" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Memory Usage */}
            <Card>
              <CardHeader>
                <CardTitle>Memory Usage</CardTitle>
                <CardDescription>JavaScript heap memory consumption</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={processChartData(metrics, 'memory')}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" tickFormatter={(value) => new Date(value).toLocaleTimeString()} />
                    <YAxis />
                    <Tooltip labelFormatter={(value) => new Date(value).toLocaleString()} />
                    <Line type="monotone" dataKey="heap_used" stroke="#8884d8" strokeWidth={2} />
                    <Line type="monotone" dataKey="heap_total" stroke="#82ca9d" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Performance Trends */}
          {analytics && (
            <Card>
              <CardHeader>
                <CardTitle>Performance Trends</CardTitle>
                <CardDescription>Metric trends and changes over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(analytics.trends).map(([metric, trend]: [string, any]) => (
                    <div key={metric} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium text-sm">{metric.replace('_', ' ')}</p>
                        {getTrendIcon(trend.trend)}
                      </div>
                      <p className="text-2xl font-bold">{formatMetricValue(trend.current, 'ms')}</p>
                      <p className={`text-sm ${trend.change > 0 ? 'text-red-600' : trend.change < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                        {trend.change > 0 ? '+' : ''}{trend.change.toFixed(1)}% from previous period
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="load-times" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Load Time Metrics</CardTitle>
              <CardDescription>Detailed page load performance breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={processChartData(metrics, 'load_time')}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" tickFormatter={(value) => new Date(value).toLocaleTimeString()} />
                  <YAxis />
                  <Tooltip labelFormatter={(value) => new Date(value).toLocaleString()} />
                  <Bar dataKey="page_load" fill="#8884d8" />
                  <Bar dataKey="first_contentful_paint" fill="#82ca9d" />
                  <Bar dataKey="largest_contentful_paint" fill="#ffc658" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api-performance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>API Response Times</CardTitle>
              <CardDescription>API endpoint performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={processChartData(metrics, 'api_response')}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" tickFormatter={(value) => new Date(value).toLocaleTimeString()} />
                  <YAxis />
                  <Tooltip labelFormatter={(value) => new Date(value).toLocaleString()} />
                  <Line type="monotone" dataKey="api_call" stroke="#8884d8" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* API Summary */}
          <Card>
            <CardHeader>
              <CardTitle>API Endpoint Summary</CardTitle>
              <CardDescription>Performance statistics by endpoint</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(realTimeMetrics).filter(([key]) => !key.includes('_')).map(([endpoint, stats]: [string, any]) => (
                  <div key={endpoint} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{endpoint}</p>
                      <p className="text-sm text-muted-foreground">
                        {stats.count} calls • Avg: {formatMetricValue(stats.average, 'ms')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm">Min: {formatMetricValue(stats.min, 'ms')}</p>
                      <p className="text-sm">Max: {formatMetricValue(stats.max, 'ms')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Performance Alerts</CardTitle>
              <CardDescription>Threshold violations and recommendations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {alerts.map((alert) => (
                  <div key={alert.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getSeverityIcon(alert.severity)}
                        <Badge variant={getSeverityColor(alert.severity) as any}>
                          {alert.severity}
                        </Badge>
                        <span className="font-medium">{alert.message}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {new Date(alert.createdAt).toLocaleString()}
                      </span>
                    </div>
                    
                    <div className="text-sm text-muted-foreground mb-2">
                      Current: {formatMetricValue(alert.currentValue, 'ms')} • 
                      Threshold: {formatMetricValue(alert.thresholdValue, 'ms')}
                    </div>
                    
                    {alert.recommendations && (
                      <div className="mt-3 p-3 bg-blue-50 rounded">
                        <p className="font-medium text-sm text-blue-800 mb-1">Recommendations:</p>
                        <p className="text-sm text-blue-700">{alert.recommendations}</p>
                      </div>
                    )}
                  </div>
                ))}
                
                {alerts.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No performance alerts in the selected time range
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          {analytics && (
            <>
              {/* Performance Bottlenecks */}
              <Card>
                <CardHeader>
                  <CardTitle>Performance Bottlenecks</CardTitle>
                  <CardDescription>Identified performance issues and optimization opportunities</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analytics.bottlenecks.map((bottleneck: any, index: number) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={getSeverityColor(bottleneck.severity) as any}>
                              {bottleneck.severity}
                            </Badge>
                            <span className="font-medium">{bottleneck.metric.replace('_', ' ')}</span>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            Impact: {bottleneck.impact}/10
                          </span>
                        </div>
                        
                        <div className="mt-3">
                          <p className="font-medium text-sm mb-2">Recommendations:</p>
                          <ul className="text-sm space-y-1">
                            {bottleneck.recommendations.map((rec: string, i: number) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-blue-500">•</span>
                                <span>{rec}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Insights */}
              <Card>
                <CardHeader>
                  <CardTitle>Performance Insights</CardTitle>
                  <CardDescription>AI-generated performance analysis and recommendations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analytics.insights.map((insight: string, index: number) => (
                      <div key={index} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                        <Zap className="h-5 w-5 text-blue-600 mt-0.5" />
                        <p className="text-sm text-blue-800">{insight}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ComprehensivePerformanceDashboard;
