
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { DayPicker, DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, AlertTriangle, CheckCircle, Clock, TrendingUp, TrendingDown, RefreshCw, Eye, AlertCircle } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Area, AreaChart } from 'recharts';
import { useToast } from '@/hooks/use-toast';
import { errorTrackingService, ErrorTracking, ErrorStatistics } from '@/services/enhanced-error-tracking';

interface ErrorDashboardProps {
  className?: string;
}

const COLORS = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
  info: '#3b82f6'
};

const getSeverityColor = (level: number): string => {
  switch (level) {
    case 1:return COLORS.critical;
    case 2:return COLORS.high;
    case 3:return COLORS.medium;
    case 4:return COLORS.low;
    case 5:return COLORS.info;
    default:return COLORS.medium;
  }
};

const getSeverityLabel = (level: number): string => {
  switch (level) {
    case 1:return 'Critical';
    case 2:return 'High';
    case 3:return 'Medium';
    case 4:return 'Low';
    case 5:return 'Info';
    default:return 'Medium';
  }
};

const ErrorMonitoringDashboard: React.FC<ErrorDashboardProps> = ({ className }) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [recentErrors, setRecentErrors] = useState<ErrorTracking[]>([]);
  const [statistics, setStatistics] = useState<ErrorStatistics[]>([]);
  const [selectedError, setSelectedError] = useState<ErrorTracking | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 7),
    to: new Date()
  });
  const [autoRefresh, setAutoRefresh] = useState(true);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);

      const [errors, stats] = await Promise.all([
      errorTrackingService.getRecentErrors(100),
      errorTrackingService.getErrorStatistics({
        from: dateRange?.from || subDays(new Date(), 7),
        to: dateRange?.to || new Date()
      })]
      );

      setRecentErrors(errors);
      setStatistics(stats);
    } catch (error) {
      toast({
        title: 'Error Loading Dashboard',
        description: 'Failed to load error monitoring data',
        variant: 'destructive'
      });
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [dateRange]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(loadDashboardData, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh, dateRange]);

  const handleMarkResolved = async (errorId: number) => {
    try {
      await errorTrackingService.markErrorResolved(errorId, resolutionNotes);
      await loadDashboardData();
      setSelectedError(null);
      setResolutionNotes('');
      toast({
        title: 'Error Resolved',
        description: 'Error has been marked as resolved successfully'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to mark error as resolved',
        variant: 'destructive'
      });
    }
  };

  // Calculate dashboard metrics
  const totalErrors = recentErrors.reduce((sum, error) => sum + error.occurrence_count, 0);
  const uniqueErrors = recentErrors.length;
  const criticalErrors = recentErrors.filter((e) => e.severity_level === 1).length;
  const resolvedErrors = recentErrors.filter((e) => e.is_resolved).length;
  const resolutionRate = uniqueErrors > 0 ? resolvedErrors / uniqueErrors * 100 : 0;

  // Prepare chart data
  const errorTrendData = statistics.
  reduce((acc, stat) => {
    const dateTime = `${stat.date_key} ${stat.hour_key}:00`;
    const existing = acc.find((item) => item.dateTime === dateTime);

    if (existing) {
      existing.count += stat.error_count;
    } else {
      acc.push({
        dateTime,
        date: stat.date_key,
        hour: stat.hour_key,
        count: stat.error_count
      });
    }

    return acc;
  }, [] as any[]).
  sort((a, b) => a.dateTime.localeCompare(b.dateTime));

  const errorTypeData = recentErrors.reduce((acc, error) => {
    const existing = acc.find((item) => item.type === error.error_type);
    if (existing) {
      existing.count += error.occurrence_count;
    } else {
      acc.push({
        type: error.error_type,
        count: error.occurrence_count
      });
    }
    return acc;
  }, [] as any[]);

  const severityDistribution = recentErrors.reduce((acc, error) => {
    const severity = getSeverityLabel(error.severity_level);
    const existing = acc.find((item) => item.severity === severity);
    if (existing) {
      existing.count += error.occurrence_count;
    } else {
      acc.push({
        severity,
        count: error.occurrence_count,
        color: getSeverityColor(error.severity_level)
      });
    }
    return acc;
  }, [] as any[]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>);

  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Error Monitoring Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time error tracking and analysis
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[280px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ?
                dateRange.to ?
                <>
                      {format(dateRange.from, 'LLL dd, y')} -{' '}
                      {format(dateRange.to, 'LLL dd, y')}
                    </> :

                format(dateRange.from, 'LLL dd, y') :


                <span>Pick a date range</span>
                }
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <DayPicker
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2} />

            </PopoverContent>
          </Popover>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              setAutoRefresh(!autoRefresh);
              if (!autoRefresh) loadDashboardData();
            }}>

            <RefreshCw className={`h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Critical Alerts */}
      {criticalErrors > 0 &&
      <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-800">Critical Errors Detected</AlertTitle>
          <AlertDescription className="text-red-700">
            {criticalErrors} critical error{criticalErrors !== 1 ? 's' : ''} require{criticalErrors === 1 ? 's' : ''} immediate attention.
          </AlertDescription>
        </Alert>
      }

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Errors</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalErrors.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {uniqueErrors} unique errors
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Errors</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{criticalErrors}</div>
            <p className="text-xs text-muted-foreground">
              Severity level 1
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolution Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{resolutionRate.toFixed(1)}%</div>
            <Progress value={resolutionRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Auto Refresh</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{autoRefresh ? 'ON' : 'OFF'}</div>
            <p className="text-xs text-muted-foreground">
              Every 30 seconds
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="errors">Recent Errors</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Error Trend Chart */}
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle>Error Trend Over Time</CardTitle>
                <CardDescription>
                  Hourly error count for the selected period
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={errorTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="dateTime"
                      tickFormatter={(value) => format(new Date(value), 'MM/dd HH:mm')} />

                    <YAxis />
                    <Tooltip
                      labelFormatter={(value) => format(new Date(value), 'PPP HH:mm')} />

                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#8884d8"
                      fill="#8884d8"
                      fillOpacity={0.6} />

                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Error Types */}
            <Card>
              <CardHeader>
                <CardTitle>Error Types</CardTitle>
                <CardDescription>
                  Distribution by error type
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={errorTypeData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="type" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Severity Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Severity Distribution</CardTitle>
                <CardDescription>
                  Errors by severity level
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      dataKey="count"
                      data={severityDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ severity, percent }) => `${severity} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8">

                      {severityDistribution.map((entry, index) =>
                      <Cell key={`cell-${index}`} fill={entry.color} />
                      )}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Errors</CardTitle>
              <CardDescription>
                Latest {recentErrors.length} unique errors
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-4">
                  {recentErrors.map((error) =>
                  <div
                    key={error.id}
                    className="flex items-center space-x-4 rounded-lg border p-4">

                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge
                          variant={error.is_resolved ? 'secondary' : 'destructive'}
                          style={{
                            backgroundColor: error.is_resolved ?
                            '#f1f5f9' :
                            getSeverityColor(error.severity_level)
                          }}>

                            {getSeverityLabel(error.severity_level)}
                          </Badge>
                          <Badge variant="outline">
                            {error.occurrence_count}x
                          </Badge>
                          {error.is_resolved &&
                        <Badge variant="secondary" className="text-green-700">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Resolved
                            </Badge>
                        }
                        </div>
                        <p className="text-sm font-medium leading-none">
                          {error.error_message}
                        </p>
                        <div className="flex items-center text-sm text-muted-foreground">
                          <span>{error.error_type}</span>
                          {error.component_name &&
                        <>
                              <Separator orientation="vertical" className="mx-2 h-4" />
                              <span>{error.component_name}</span>
                            </>
                        }
                          <Separator orientation="vertical" className="mx-2 h-4" />
                          <span>{format(new Date(error.last_seen), 'PPp')}</span>
                        </div>
                      </div>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedError(error)}>

                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Error Details</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label>Error Message</Label>
                              <p className="text-sm bg-muted p-3 rounded mt-1">
                                {error.error_message}
                              </p>
                            </div>
                            {error.error_stack &&
                          <div>
                                <Label>Stack Trace</Label>
                                <pre className="text-xs bg-muted p-3 rounded mt-1 overflow-x-auto">
                                  {error.error_stack}
                                </pre>
                              </div>
                          }
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label>Type</Label>
                                <p className="text-sm mt-1">{error.error_type}</p>
                              </div>
                              <div>
                                <Label>Component</Label>
                                <p className="text-sm mt-1">{error.component_name || 'N/A'}</p>
                              </div>
                              <div>
                                <Label>Occurrences</Label>
                                <p className="text-sm mt-1">{error.occurrence_count}</p>
                              </div>
                              <div>
                                <Label>Environment</Label>
                                <p className="text-sm mt-1">{error.environment}</p>
                              </div>
                            </div>
                            {!error.is_resolved &&
                          <div className="space-y-2">
                                <Label htmlFor="resolution">Resolution Notes</Label>
                                <Textarea
                              id="resolution"
                              placeholder="Describe how this error was resolved..."
                              value={resolutionNotes}
                              onChange={(e) => setResolutionNotes(e.target.value)} />

                                <Button
                              onClick={() => handleMarkResolved(error.id)}
                              disabled={!resolutionNotes.trim()}>

                                  Mark as Resolved
                                </Button>
                              </div>
                          }
                            {error.is_resolved && error.resolution_notes &&
                          <div>
                                <Label>Resolution Notes</Label>
                                <p className="text-sm bg-green-50 p-3 rounded mt-1">
                                  {error.resolution_notes}
                                </p>
                              </div>
                          }
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="text-center py-12">
            <h3 className="text-lg font-semibold">Advanced Analytics</h3>
            <p className="text-muted-foreground mt-2">
              Detailed error analytics and insights coming soon
            </p>
          </div>
        </TabsContent>

        <TabsContent value="alerts">
          <div className="text-center py-12">
            <h3 className="text-lg font-semibold">Alert Configuration</h3>
            <p className="text-muted-foreground mt-2">
              Configure error alert thresholds and notifications
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>);

};

export default ErrorMonitoringDashboard;