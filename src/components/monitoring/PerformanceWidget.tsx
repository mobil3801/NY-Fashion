
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Activity, AlertTriangle, TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PerformanceWidgetProps {
  showDetailedView?: boolean;
  refreshInterval?: number;
}

const PerformanceWidget: React.FC<PerformanceWidgetProps> = ({ 
  showDetailedView = false, 
  refreshInterval = 10000 
}) => {
  const [performanceScore, setPerformanceScore] = useState(100);
  const [activeAlerts, setActiveAlerts] = useState(0);
  const [avgLoadTime, setAvgLoadTime] = useState(0);
  const [memoryUsage, setMemoryUsage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadQuickStats();
    const interval = setInterval(loadQuickStats, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  const loadQuickStats = async () => {
    try {
      const [alertsResponse, metricsResponse] = await Promise.all([
        fetchActiveAlerts(),
        fetchRecentMetrics()
      ]);

      setActiveAlerts(alertsResponse.count);
      setAvgLoadTime(metricsResponse.avgLoadTime);
      setMemoryUsage(metricsResponse.memoryUsage);
      setPerformanceScore(calculatePerformanceScore(metricsResponse, alertsResponse.count));
    } catch (error) {
      console.error('Failed to load performance stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchActiveAlerts = async () => {
    try {
      const { data, error } = await window.ezsite.apis.tablePage(37306, {
        PageNo: 1,
        PageSize: 1,
        Filters: [
          {
            name: 'status',
            op: 'Equal',
            value: 'active'
          }
        ]
      });

      if (error) throw new Error(error);
      return { count: data?.VirtualCount || 0 };
    } catch (error) {
      return { count: 0 };
    }
  };

  const fetchRecentMetrics = async () => {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const { data, error } = await window.ezsite.apis.tablePage(37305, {
        PageNo: 1,
        PageSize: 100,
        Filters: [
          {
            name: 'created_at',
            op: 'GreaterThanOrEqual',
            value: oneDayAgo.toISOString()
          }
        ]
      });

      if (error) throw new Error(error);
      
      const metrics = data?.List || [];
      const loadTimeMetrics = metrics.filter((m: any) => m.metric_type === 'load_time' && m.metric_name === 'page_load');
      const memoryMetrics = metrics.filter((m: any) => m.metric_type === 'memory' && m.metric_name === 'heap_used');

      const avgLoadTime = loadTimeMetrics.length > 0 
        ? loadTimeMetrics.reduce((sum: number, m: any) => sum + m.value, 0) / loadTimeMetrics.length
        : 0;

      const avgMemory = memoryMetrics.length > 0
        ? memoryMetrics.reduce((sum: number, m: any) => sum + m.value, 0) / memoryMetrics.length
        : 0;

      return {
        avgLoadTime,
        memoryUsage: avgMemory
      };
    } catch (error) {
      return { avgLoadTime: 0, memoryUsage: 0 };
    }
  };

  const calculatePerformanceScore = (metrics: any, alertCount: number) => {
    let score = 100;
    
    // Deduct points for slow load times
    if (metrics.avgLoadTime > 5000) score -= 30;
    else if (metrics.avgLoadTime > 3000) score -= 20;
    else if (metrics.avgLoadTime > 1000) score -= 10;

    // Deduct points for high memory usage
    if (metrics.memoryUsage > 200) score -= 20;
    else if (metrics.memoryUsage > 100) score -= 10;

    // Deduct points for active alerts
    score -= alertCount * 5;

    return Math.max(0, Math.min(100, score));
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    if (score >= 50) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreBadgeVariant = (score: number): "default" | "destructive" | "secondary" | "outline" => {
    if (score >= 90) return 'default';
    if (score >= 70) return 'secondary';
    if (score >= 50) return 'outline';
    return 'destructive';
  };

  const formatLoadTime = (ms: number) => {
    if (ms > 1000) return `${(ms / 1000).toFixed(2)}s`;
    return `${ms.toFixed(0)}ms`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!showDetailedView) {
    return (
      <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/performance-monitoring')}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Performance Score</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold flex items-center gap-2">
            <span className={getScoreColor(performanceScore)}>{performanceScore}</span>
            {activeAlerts > 0 && (
              <Badge variant="destructive" className="text-xs">
                {activeAlerts} alerts
              </Badge>
            )}
          </div>
          <Progress value={performanceScore} className="mt-2" />
          <p className="text-xs text-muted-foreground mt-2">
            Avg Load: {formatLoadTime(avgLoadTime)} • Memory: {memoryUsage.toFixed(1)}MB
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Performance Overview
        </CardTitle>
        <Button variant="outline" size="sm" onClick={() => navigate('/performance-monitoring')}>
          <ExternalLink className="h-4 w-4 mr-2" />
          View Details
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Performance Score */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Overall Performance</p>
            <p className={`text-3xl font-bold ${getScoreColor(performanceScore)}`}>
              {performanceScore}
            </p>
          </div>
          <Badge variant={getScoreBadgeVariant(performanceScore)} className="text-lg px-3 py-1">
            {performanceScore >= 90 ? 'Excellent' : 
             performanceScore >= 70 ? 'Good' : 
             performanceScore >= 50 ? 'Fair' : 'Poor'}
          </Badge>
        </div>

        <Progress value={performanceScore} className="w-full" />

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Avg Load Time</span>
            </div>
            <p className="text-xl font-semibold">
              {formatLoadTime(avgLoadTime)}
            </p>
            {avgLoadTime > 3000 && (
              <Badge variant="destructive" className="text-xs">Slow</Badge>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium">Memory Usage</span>
            </div>
            <p className="text-xl font-semibold">
              {memoryUsage.toFixed(1)}MB
            </p>
            {memoryUsage > 150 && (
              <Badge variant="destructive" className="text-xs">High</Badge>
            )}
          </div>
        </div>

        {/* Active Alerts */}
        {activeAlerts > 0 && (
          <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium text-red-800">
                {activeAlerts} Active Performance {activeAlerts === 1 ? 'Alert' : 'Alerts'}
              </span>
            </div>
            <Badge variant="destructive">
              Action Required
            </Badge>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate('/performance-monitoring')}>
            View Dashboard
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            Refresh
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PerformanceWidget;
