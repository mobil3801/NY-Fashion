
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertTriangle, 
  Activity, 
  Network, 
  Zap, 
  RefreshCw, 
  Filter,
  Download,
  CheckCircle,
  Clock,
  AlertCircle,
  TrendingUp
} from 'lucide-react';
import { centralizedErrorService } from '@/services/centralized-error-service';
import { logger } from '@/utils/production-logger';

interface ErrorLogData {
  id: number;
  error_id: string;
  error_category: string;
  severity_level: string;
  error_type: string;
  error_message: string;
  page_url: string;
  user_id?: string;
  timestamp: string;
  resolved: boolean;
  context_data?: string;
}

interface PerformanceIssueData {
  id: number;
  issue_id: string;
  issue_type: string;
  metric_name: string;
  metric_value: number;
  threshold_value: number;
  page_url: string;
  timestamp: string;
  resolved: boolean;
}

interface NetworkErrorData {
  id: number;
  error_id: string;
  request_url: string;
  request_method: string;
  status_code: number;
  error_type: string;
  error_message: string;
  retry_count: number;
  timestamp: string;
  resolved: boolean;
}

interface ErrorStats {
  totalErrors: number;
  criticalErrors: number;
  resolvedErrors: number;
  errorRate: number;
  topErrorTypes: { type: string; count: number }[];
  errorsByHour: { hour: string; count: number }[];
}

const ErrorMonitoringDashboard: React.FC = () => {
  const [errorLogs, setErrorLogs] = useState<ErrorLogData[]>([]);
  const [performanceIssues, setPerformanceIssues] = useState<PerformanceIssueData[]>([]);
  const [networkErrors, setNetworkErrors] = useState<NetworkErrorData[]>([]);
  const [stats, setStats] = useState<ErrorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState('overview');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadErrorLogs(),
        loadPerformanceIssues(),
        loadNetworkErrors(),
        loadStatistics()
      ]);
    } catch (error) {
      logger.logError('Failed to load dashboard data', error);
      centralizedErrorService.reportApplicationError(
        error as Error,
        'medium',
        { componentName: 'ErrorMonitoringDashboard' }
      );
    } finally {
      setLoading(false);
    }
  };

  const loadErrorLogs = async () => {
    try {
      const { data, error } = await window.ezsite.apis.tablePage(37297, {
        PageNo: 1,
        PageSize: 50,
        OrderByField: 'timestamp',
        IsAsc: false,
        Filters: []
      });

      if (error) throw new Error(error);
      setErrorLogs(data?.List || []);
    } catch (error) {
      logger.logError('Failed to load error logs', error);
    }
  };

  const loadPerformanceIssues = async () => {
    try {
      const { data, error } = await window.ezsite.apis.tablePage(37298, {
        PageNo: 1,
        PageSize: 50,
        OrderByField: 'timestamp',
        IsAsc: false,
        Filters: []
      });

      if (error) throw new Error(error);
      setPerformanceIssues(data?.List || []);
    } catch (error) {
      logger.logError('Failed to load performance issues', error);
    }
  };

  const loadNetworkErrors = async () => {
    try {
      const { data, error } = await window.ezsite.apis.tablePage(37299, {
        PageNo: 1,
        PageSize: 50,
        OrderByField: 'timestamp',
        IsAsc: false,
        Filters: []
      });

      if (error) throw new Error(error);
      setNetworkErrors(data?.List || []);
    } catch (error) {
      logger.logError('Failed to load network errors', error);
    }
  };

  const loadStatistics = async () => {
    try {
      // Calculate statistics from loaded data
      const allErrors = errorLogs.length + performanceIssues.length + networkErrors.length;
      const criticalErrors = errorLogs.filter(e => e.severity_level === 'critical').length;
      const resolvedErrors = errorLogs.filter(e => e.resolved).length + 
                           performanceIssues.filter(e => e.resolved).length + 
                           networkErrors.filter(e => e.resolved).length;

      setStats({
        totalErrors: allErrors,
        criticalErrors,
        resolvedErrors,
        errorRate: allErrors > 0 ? (criticalErrors / allErrors) * 100 : 0,
        topErrorTypes: [],
        errorsByHour: []
      });
    } catch (error) {
      logger.logError('Failed to calculate statistics', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
    logger.logInfo('Error dashboard refreshed');
  };

  const handleResolveError = async (errorId: string, tableId: number) => {
    try {
      const { error } = await window.ezsite.apis.tableUpdate(tableId, {
        id: parseInt(errorId),
        resolved: true,
        resolution_notes: `Resolved on ${new Date().toISOString()}`
      });

      if (error) throw new Error(error);
      
      // Refresh data
      await loadDashboardData();
      logger.logInfo('Error marked as resolved', { errorId });
    } catch (error) {
      logger.logError('Failed to resolve error', error);
    }
  };

  const getSeverityBadge = (severity: string) => {
    const colors = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800'
    };

    return (
      <Badge className={colors[severity as keyof typeof colors] || colors.medium}>
        {severity}
      </Badge>
    );
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading error monitoring dashboard...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Error Monitoring Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Comprehensive error tracking and performance monitoring
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Errors</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalErrors || 0}</div>
            <p className="text-xs text-muted-foreground">
              Last 24 hours
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Errors</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats?.criticalErrors || 0}</div>
            <p className="text-xs text-muted-foreground">
              Immediate attention required
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.resolvedErrors || 0}</div>
            <p className="text-xs text-muted-foreground">
              Successfully resolved
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.errorRate?.toFixed(1) || 0}%</div>
            <p className="text-xs text-muted-foreground">
              Critical error rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different error types */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="application">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Application ({errorLogs.length})
          </TabsTrigger>
          <TabsTrigger value="performance">
            <Zap className="h-4 w-4 mr-2" />
            Performance ({performanceIssues.length})
          </TabsTrigger>
          <TabsTrigger value="network">
            <Network className="h-4 w-4 mr-2" />
            Network ({networkErrors.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Error Overview</CardTitle>
              <CardDescription>
                Summary of all error types and their current status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats && stats.totalErrors === 0 ? (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      No errors detected in the last 24 hours. System is running smoothly!
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="text-sm text-gray-600">
                    Monitor all types of errors from a centralized dashboard. 
                    Use the tabs above to view specific error categories.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="application" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Application Errors</CardTitle>
              <CardDescription>
                JavaScript errors, React component errors, and application-level issues
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {errorLogs.map((error) => (
                  <div
                    key={error.id}
                    className="border rounded-lg p-4 space-y-2"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {getSeverityBadge(error.severity_level)}
                          <Badge variant="outline">{error.error_category}</Badge>
                          <span className="text-sm text-gray-500">
                            {formatTimestamp(error.timestamp)}
                          </span>
                        </div>
                        <h4 className="font-semibold">{error.error_type}</h4>
                        <p className="text-sm text-gray-600 mt-1">
                          {error.error_message}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Page: {error.page_url}
                        </p>
                        <p className="text-xs text-gray-400">
                          ID: {error.error_id}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {!error.resolved && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResolveError(error.id.toString(), 37297)}
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Resolve
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {errorLogs.length === 0 && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      No application errors found. Great job!
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Issues</CardTitle>
              <CardDescription>
                Slow operations, memory leaks, and performance bottlenecks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {performanceIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className="border rounded-lg p-4 space-y-2"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">{issue.issue_type}</Badge>
                          <span className="text-sm text-gray-500">
                            {formatTimestamp(issue.timestamp)}
                          </span>
                        </div>
                        <h4 className="font-semibold">{issue.metric_name}</h4>
                        <p className="text-sm text-gray-600 mt-1">
                          Value: {issue.metric_value.toFixed(2)}ms 
                          (Threshold: {issue.threshold_value}ms)
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Page: {issue.page_url}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {!issue.resolved && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResolveError(issue.id.toString(), 37298)}
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Resolve
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {performanceIssues.length === 0 && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      No performance issues detected. System is performing well!
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="network" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Network Errors</CardTitle>
              <CardDescription>
                HTTP errors, timeouts, and network connectivity issues
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {networkErrors.map((error) => (
                  <div
                    key={error.id}
                    className="border rounded-lg p-4 space-y-2"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">{error.error_type}</Badge>
                          <Badge variant="secondary">{error.request_method}</Badge>
                          <Badge variant="destructive">{error.status_code}</Badge>
                          <span className="text-sm text-gray-500">
                            {formatTimestamp(error.timestamp)}
                          </span>
                        </div>
                        <h4 className="font-semibold">{error.error_message}</h4>
                        <p className="text-sm text-gray-600 mt-1">
                          URL: {error.request_url}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Retries: {error.retry_count}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {!error.resolved && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResolveError(error.id.toString(), 37299)}
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Resolve
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {networkErrors.length === 0 && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      No network errors detected. All API calls are successful!
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ErrorMonitoringDashboard;
