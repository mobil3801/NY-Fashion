
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertCircle,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Search,
  Filter,
  Eye,
  CheckCircle } from
'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface ErrorRecord {
  ID: number;
  error_id: string;
  error_message: string;
  error_type: string;
  severity: string;
  timestamp: string;
  component: string;
  stack_trace?: string;
  url?: string;
  user_agent?: string;
}

interface ErrorStatistics {
  ID: number;
  date: string;
  error_type: string;
  count: number;
  severity: string;
  first_occurrence: string;
  last_occurrence: string;
}

const ErrorTrackingDashboard: React.FC = () => {
  const [errors, setErrors] = useState<ErrorRecord[]>([]);
  const [statistics, setStatistics] = useState<ErrorStatistics[]>([]);
  const [selectedError, setSelectedError] = useState<ErrorRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const { toast } = useToast();

  const fetchErrors = async () => {
    try {
      setIsLoading(true);

      const filters = [];
      if (severityFilter !== 'all') {
        filters.push({ name: 'severity', op: 'Equal', value: severityFilter });
      }
      if (typeFilter !== 'all') {
        filters.push({ name: 'error_type', op: 'Equal', value: typeFilter });
      }
      if (searchTerm) {
        filters.push({ name: 'error_message', op: 'StringContains', value: searchTerm });
      }

      const { data, error } = await window.ezsite.apis.tablePage('error_tracking', {
        PageNo: 1,
        PageSize: 50,
        OrderByField: 'timestamp',
        IsAsc: false,
        Filters: filters
      });

      if (error) throw new Error(error);

      setErrors(data?.List || []);
    } catch (error) {
      console.error('Failed to fetch errors:', error);
      toast({
        variant: "destructive",
        title: "Error Loading Failed",
        description: "Unable to fetch error data"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      const { data, error } = await window.ezsite.apis.tablePage('error_statistics', {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'last_occurrence',
        IsAsc: false,
        Filters: []
      });

      if (error) throw new Error(error);

      setStatistics(data?.List || []);
    } catch (error) {
      console.error('Failed to fetch error statistics:', error);
    }
  };

  useEffect(() => {
    fetchErrors();
    fetchStatistics();
  }, [severityFilter, typeFilter, searchTerm]);

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical':return 'destructive';
      case 'high':return 'destructive';
      case 'medium':return 'secondary';
      case 'low':return 'outline';
      default:return 'outline';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical':
      case 'high':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'medium':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  // Get unique error types for filter
  const errorTypes = Array.from(new Set(errors.map((e) => e.error_type))).filter(Boolean);

  // Calculate summary statistics
  const totalErrors = errors.length;
  const criticalErrors = errors.filter((e) => e.severity === 'critical').length;
  const recentErrors = errors.filter((e) => {
    const errorDate = new Date(e.timestamp);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return errorDate > oneHourAgo;
  }).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Error Tracking</h1>
          <p className="text-muted-foreground">
            Monitor and analyze application errors in real-time
          </p>
        </div>
        <Button variant="outline" onClick={fetchErrors} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Total Errors</p>
                <p className="text-2xl font-bold">{totalErrors}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-sm font-medium">Critical</p>
                <p className="text-2xl font-bold text-red-600">{criticalErrors}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-sm font-medium">Last Hour</p>
                <p className="text-2xl font-bold">{recentErrors}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-sm font-medium">Error Rate</p>
                <p className="text-2xl font-bold">
                  {totalErrors > 0 ? (criticalErrors / totalErrors * 100).toFixed(1) + '%' : '0%'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search errors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1" />

            </div>
            
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Error Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {errorTypes.map((type) =>
                <SelectItem key={type} value={type}>{type}</SelectItem>
                )}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setSeverityFilter('all');
                setTypeFilter('all');
              }}>

              <Filter className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="errors" className="space-y-4">
        <TabsList>
          <TabsTrigger value="errors">Recent Errors</TabsTrigger>
          <TabsTrigger value="statistics">Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="errors" className="space-y-4">
          {criticalErrors > 0 &&
          <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {criticalErrors} critical error{criticalErrors > 1 ? 's' : ''} detected. 
                Immediate attention required.
              </AlertDescription>
            </Alert>
          }

          <Card>
            <CardContent className="p-0">
              <div className="space-y-2">
                {errors.length === 0 ?
                <div className="text-center py-8 text-gray-500">
                    {isLoading ? 'Loading errors...' : 'No errors found'}
                  </div> :

                errors.map((error) =>
                <div
                  key={error.ID}
                  className="border-b last:border-b-0 p-4 hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedError(error)}>

                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {getSeverityIcon(error.severity)}
                            <Badge variant={getSeverityColor(error.severity) as any}>
                              {error.severity.toUpperCase()}
                            </Badge>
                            <Badge variant="outline">{error.error_type}</Badge>
                            {error.component &&
                        <Badge variant="secondary">{error.component}</Badge>
                        }
                          </div>
                          <p className="font-medium text-sm mb-1">{error.error_message}</p>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>ID: {error.error_id}</span>
                            <span>{formatDistanceToNow(new Date(error.timestamp), { addSuffix: true })}</span>
                            {error.url && <span>{new URL(error.url).pathname}</span>}
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                )
                }
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="statistics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Error Types Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {statistics.slice(0, 10).map((stat) =>
                  <div key={stat.ID} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{stat.error_type}</Badge>
                      </div>
                      <div className="text-right">
                        <span className="font-medium">{stat.count}</span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {statistics.
                  sort((a, b) => new Date(b.last_occurrence).getTime() - new Date(a.last_occurrence).getTime()).
                  slice(0, 10).
                  map((stat) =>
                  <div key={stat.ID} className="flex items-center justify-between text-sm">
                        <div>
                          <Badge variant="outline" className="text-xs">{stat.error_type}</Badge>
                        </div>
                        <div className="text-right text-xs text-gray-500">
                          {formatDistanceToNow(new Date(stat.last_occurrence), { addSuffix: true })}
                        </div>
                      </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Error Detail Dialog */}
      <Dialog open={!!selectedError} onOpenChange={() => setSelectedError(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedError && getSeverityIcon(selectedError.severity)}
              Error Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedError &&
          <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="font-medium">Error ID:</label>
                  <p className="font-mono">{selectedError.error_id}</p>
                </div>
                <div>
                  <label className="font-medium">Type:</label>
                  <p>{selectedError.error_type}</p>
                </div>
                <div>
                  <label className="font-medium">Severity:</label>
                  <Badge variant={getSeverityColor(selectedError.severity) as any}>
                    {selectedError.severity}
                  </Badge>
                </div>
                <div>
                  <label className="font-medium">Timestamp:</label>
                  <p>{new Date(selectedError.timestamp).toLocaleString()}</p>
                </div>
              </div>

              <div>
                <label className="font-medium">Message:</label>
                <p className="bg-gray-50 p-2 rounded mt-1">{selectedError.error_message}</p>
              </div>

              {selectedError.url &&
            <div>
                  <label className="font-medium">URL:</label>
                  <p className="font-mono text-sm break-all bg-gray-50 p-2 rounded mt-1">
                    {selectedError.url}
                  </p>
                </div>
            }

              {selectedError.stack_trace &&
            <div>
                  <label className="font-medium">Stack Trace:</label>
                  <pre className="bg-gray-900 text-green-400 p-3 rounded text-xs overflow-x-auto mt-1">
                    {selectedError.stack_trace}
                  </pre>
                </div>
            }
            </div>
          }
        </DialogContent>
      </Dialog>
    </div>);

};

export default ErrorTrackingDashboard;