
import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, CheckCircle, Clock, Filter, X, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDebug } from '@/debug';
import { formatDistanceToNow } from 'date-fns';

interface ApiCallFilters {
  status: string;
  operation: string;
  method: string;
}

const ApiDebugDashboard: React.FC = () => {
  const { apiCalls, clearApiCalls, retryFailedCall } = useDebug();
  const [filters, setFilters] = useState<ApiCallFilters>({
    status: 'all',
    operation: '',
    method: 'all'
  });
  const [selectedCall, setSelectedCall] = useState<string | null>(null);
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);

  const filteredCalls = apiCalls.filter((call) => {
    if (filters.status !== 'all' && call.status !== filters.status) return false;
    if (filters.operation && !call.operation.toLowerCase().includes(filters.operation.toLowerCase())) return false;
    if (filters.method !== 'all' && call.method !== filters.method) return false;
    return true;
  });

  const selectedCallData = selectedCall ? apiCalls.find((call) => call.id === selectedCall) : null;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'retrying':
        return <RefreshCw className="h-4 w-4 text-yellow-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':return 'default';
      case 'error':return 'destructive';
      case 'retrying':return 'secondary';
      default:return 'outline';
    }
  };

  const handleRetryCall = async (callId: string) => {
    try {
      await retryFailedCall(callId);
    } catch (error) {
      console.error('Failed to retry call:', error);
    }
  };

  const clearFilters = () => {
    setFilters({ status: 'all', operation: '', method: 'all' });
  };

  // Auto-refresh every 5 seconds when enabled
  useEffect(() => {
    if (!isAutoRefresh) return;

    const interval = setInterval(() => {









































      // Force re-render to show updated timestamps
    }, 5000);return () => clearInterval(interval);}, [isAutoRefresh]);const callStats = { total: apiCalls.length, success: apiCalls.filter((c) => c.status === 'success').length, error: apiCalls.filter((c) => c.status === 'error').length, pending: apiCalls.filter((c) => c.status === 'pending' || c.status === 'retrying').length };return <div className="space-y-4">
      {/* Header with stats */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">API Dashboard</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsAutoRefresh(!isAutoRefresh)} className={isAutoRefresh ? 'bg-green-50 border-green-200' : ''}>

              <RefreshCw className={`h-3 w-3 mr-1 ${isAutoRefresh ? 'animate-spin' : ''}`} />
              Auto
            </Button>
            <Button variant="outline" size="sm" onClick={clearApiCalls}>
              Clear All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span>Total: {callStats.total}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Success: {callStats.success}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span>Error: {callStats.error}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              <span>Pending: {callStats.pending}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={filters.status} onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}>

              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="retrying">Retrying</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.method} onValueChange={(value) => setFilters((prev) => ({ ...prev, method: value }))}>

              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
                <SelectItem value="DELETE">DELETE</SelectItem>
              </SelectContent>
            </Select>

            <Input placeholder="Filter by operation..." value={filters.operation} onChange={(e) => setFilters((prev) => ({ ...prev, operation: e.target.value }))} className="w-48" />


            <Button variant="outline" size="sm" onClick={clearFilters}>
              <Filter className="h-3 w-3 mr-1" />
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* API Calls List */}
      <Card className="flex-1">
        <CardHeader>
          <CardTitle className="text-sm">
            Recent API Calls ({filteredCalls.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-96">
            <div className="space-y-2 p-4">
              {filteredCalls.map((call) => <div key={call.id} className="border rounded-lg p-3 hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => setSelectedCall(call.id)}>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(call.status)}
                      <Badge variant="outline" className="text-xs">
                        {call.method}
                      </Badge>
                      <span className="font-medium text-sm">{call.operation}</span>
                      {call.attempt > 1 && <Badge variant="secondary" className="text-xs">
                          Attempt {call.attempt}
                        </Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                      {call.status === 'error' && <Button variant="outline" size="sm" onClick={(e) => {e.stopPropagation();handleRetryCall(call.id);}}>

                          <RotateCcw className="h-3 w-3" />
                        </Button>}
                      <Badge variant={getStatusColor(call.status) as any} className="text-xs">
                        {call.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-500 flex justify-between">
                    <span className="truncate max-w-xs">{call.url}</span>
                    <span>{formatDistanceToNow(call.timestamp, { addSuffix: true })}</span>
                  </div>
                  {call.duration && <div className="text-xs text-gray-500 mt-1">
                      Duration: {call.duration.toFixed(0)}ms
                    </div>}
                </div>
            )}
              {filteredCalls.length === 0 &&
            <div className="text-center py-8 text-gray-500">
                  No API calls match your filters
                </div>
            }
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Call Detail Dialog */}
      <Dialog open={!!selectedCall} onOpenChange={() => setSelectedCall(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedCallData && getStatusIcon(selectedCallData.status)}
              API Call Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedCallData &&
        <Tabs defaultValue="overview" className="w-full">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="request">Request</TabsTrigger>
                <TabsTrigger value="response">Response</TabsTrigger>
                <TabsTrigger value="error">Error</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <label className="font-medium text-gray-600">Operation:</label>
                    <p>{selectedCallData.operation}</p>
                  </div>
                  <div>
                    <label className="font-medium text-gray-600">Method:</label>
                    <p>{selectedCallData.method}</p>
                  </div>
                  <div>
                    <label className="font-medium text-gray-600">Status:</label>
                    <Badge variant={getStatusColor(selectedCallData.status) as any}>
                      {selectedCallData.status}
                    </Badge>
                  </div>
                  <div>
                    <label className="font-medium text-gray-600">Attempt:</label>
                    <p>{selectedCallData.attempt}</p>
                  </div>
                  <div>
                    <label className="font-medium text-gray-600">Duration:</label>
                    <p>{selectedCallData.duration?.toFixed(0) || 'N/A'}ms</p>
                  </div>
                  <div>
                    <label className="font-medium text-gray-600">Timestamp:</label>
                    <p>{selectedCallData.timestamp.toLocaleString()}</p>
                  </div>
                </div>
                <div>
                  <label className="font-medium text-gray-600">URL:</label>
                  <p className="font-mono text-sm break-all bg-gray-50 p-2 rounded">
                    {selectedCallData.url}
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="request">
                <ScrollArea className="h-64">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Headers:</h4>
                      <pre className="bg-gray-50 p-2 rounded text-xs overflow-x-auto">
                        {JSON.stringify(selectedCallData.requestHeaders || {}, null, 2)}
                      </pre>
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="response">
                <ScrollArea className="h-64">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Headers:</h4>
                      <pre className="bg-gray-50 p-2 rounded text-xs overflow-x-auto">
                        {JSON.stringify(selectedCallData.responseHeaders || {}, null, 2)}
                      </pre>
                    </div>
                    {selectedCallData.response &&
                <div>
                        <h4 className="font-medium mb-2">Body:</h4>
                        <pre className="bg-gray-50 p-2 rounded text-xs overflow-x-auto">
                          {JSON.stringify(selectedCallData.response, null, 2)}
                        </pre>
                      </div>
                }
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="error">
                {selectedCallData.error ?
            <ScrollArea className="h-64">
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium mb-2">Error Details:</h4>
                        <pre className="bg-red-50 p-2 rounded text-xs overflow-x-auto">
                          {JSON.stringify(selectedCallData.error, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </ScrollArea> :

            <div className="text-center py-8 text-gray-500">
                    No error information available
                  </div>
            }
              </TabsContent>
            </Tabs>
        }
        </DialogContent>
      </Dialog>
    </div>;

};

export default ApiDebugDashboard;