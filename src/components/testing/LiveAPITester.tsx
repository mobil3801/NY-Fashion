
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Play,
  CheckCircle,
  XCircle,
  Clock,
  Database,
  Zap,
  Activity,
  AlertCircle } from
'lucide-react';
import { toast } from '@/hooks/use-toast';

interface APITest {
  id: string;
  name: string;
  method: string;
  endpoint: string;
  params: any[];
  expectedResult?: string;
  status: 'idle' | 'running' | 'success' | 'error';
  result?: any;
  error?: string;
  duration?: number;
}

export default function LiveAPITester() {
  const [tests, setTests] = useState<APITest[]>([
  {
    id: 'get-products-basic',
    name: 'Get Products - Basic',
    method: 'GET',
    endpoint: 'getProducts',
    params: [{}],
    expectedResult: 'Array of products',
    status: 'idle'
  },
  {
    id: 'get-products-search',
    name: 'Get Products - Search Filter',
    method: 'GET',
    endpoint: 'getProducts',
    params: [{ search: 'test', limit: 10 }],
    expectedResult: 'Filtered product array',
    status: 'idle'
  },
  {
    id: 'save-product-create',
    name: 'Save Product - Create New',
    method: 'POST',
    endpoint: 'saveProduct',
    params: [{
      name: 'Test Product ' + Date.now(),
      description: 'API Test Product',
      category_id: 1,
      cost_cents: 5000,
      price_cents: 10000,
      brand: 'API Test Brand',
      sku: 'TEST' + Date.now()
    }],
    expectedResult: 'Success with new product ID',
    status: 'idle'
  },
  {
    id: 'get-stock-movements',
    name: 'Get Stock Movements',
    method: 'GET',
    endpoint: 'getStockMovements',
    params: [1, null, 10], // productId, variantId, limit
    expectedResult: 'Array of stock movements',
    status: 'idle'
  },
  {
    id: 'add-stock-movement',
    name: 'Add Stock Movement',
    method: 'POST',
    endpoint: 'addStockMovement',
    params: [{
      variant_id: 1,
      delta: 25,
      type: 'adjustment',
      reason: 'API Test Movement - ' + Date.now(),
      created_by: 1
    }],
    expectedResult: 'Success with movement ID',
    status: 'idle'
  },
  {
    id: 'validate-consistency',
    name: 'Database Consistency Check',
    method: 'GET',
    endpoint: 'validateInventoryConsistency',
    params: [],
    expectedResult: 'Consistency validation report',
    status: 'idle'
  },
  {
    id: 'monitor-performance',
    name: 'Performance Monitoring',
    method: 'GET',
    endpoint: 'monitorInventoryPerformance',
    params: [],
    expectedResult: 'Performance metrics report',
    status: 'idle'
  }]
  );

  const [customTest, setCustomTest] = useState({
    endpoint: '',
    params: '[]'
  });

  const runTest = async (testId: string) => {
    setTests((prev) => prev.map((test) =>
    test.id === testId ? { ...test, status: 'running', result: null, error: null } : test
    ));

    const test = tests.find((t) => t.id === testId);
    if (!test) return;

    const startTime = performance.now();

    try {
      // Run the actual API call
      const { data, error } = await window.ezsite.apis.run({
        path: test.endpoint,
        param: test.params
      });

      const duration = performance.now() - startTime;

      if (error) {
        setTests((prev) => prev.map((t) =>
        t.id === testId ? {
          ...t,
          status: 'error',
          error,
          duration
        } : t
        ));

        toast({
          title: `API Test Failed: ${test.name}`,
          description: error,
          variant: 'destructive'
        });
      } else {
        setTests((prev) => prev.map((t) =>
        t.id === testId ? {
          ...t,
          status: 'success',
          result: data,
          duration
        } : t
        ));

        toast({
          title: `API Test Passed: ${test.name}`,
          description: `Completed in ${duration.toFixed(0)}ms`,
          variant: 'default'
        });
      }
    } catch (err) {
      const duration = performance.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';

      setTests((prev) => prev.map((t) =>
      t.id === testId ? {
        ...t,
        status: 'error',
        error: errorMessage,
        duration
      } : t
      ));

      toast({
        title: `API Test Error: ${test.name}`,
        description: errorMessage,
        variant: 'destructive'
      });
    }
  };

  const runAllTests = async () => {
    for (const test of tests) {
      await runTest(test.id);
      // Brief pause between tests
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    const passedTests = tests.filter((t) => t.status === 'success').length;
    toast({
      title: 'All API Tests Complete',
      description: `${passedTests}/${tests.length} tests passed`,
      variant: passedTests === tests.length ? 'default' : 'destructive'
    });
  };

  const runCustomTest = async () => {
    if (!customTest.endpoint) {
      toast({
        title: 'Invalid Test',
        description: 'Please provide an endpoint',
        variant: 'destructive'
      });
      return;
    }

    try {
      const params = JSON.parse(customTest.params);
      const startTime = performance.now();

      const { data, error } = await window.ezsite.apis.run({
        path: customTest.endpoint,
        param: params
      });

      const duration = performance.now() - startTime;

      if (error) {
        toast({
          title: 'Custom Test Failed',
          description: error,
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Custom Test Passed',
          description: `Completed in ${duration.toFixed(0)}ms`,
          variant: 'default'
        });
      }

      console.log('Custom API Test Result:', { data, error, duration });
    } catch (err) {
      toast({
        title: 'Custom Test Error',
        description: err instanceof Error ? err.message : 'Invalid parameters',
        variant: 'destructive'
      });
    }
  };

  const getStatusIcon = (status: APITest['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'running':
        return <Activity className="h-5 w-5 text-blue-500 animate-pulse" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: APITest['status']) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-800">Success</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'running':
        return <Badge variant="secondary">Running</Badge>;
      default:
        return <Badge variant="outline">Idle</Badge>;
    }
  };

  const stats = {
    total: tests.length,
    passed: tests.filter((t) => t.status === 'success').length,
    failed: tests.filter((t) => t.status === 'error').length,
    running: tests.filter((t) => t.status === 'running').length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Live API Testing</h2>
          <p className="text-gray-600 mt-1">
            Execute real API calls against inventory endpoints
          </p>
        </div>
        <Button onClick={runAllTests} disabled={stats.running > 0}>
          <Zap className="h-4 w-4 mr-2" />
          Run All Tests
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-lg font-bold">{stats.total}</p>
              <p className="text-sm text-gray-600">Total Tests</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-lg font-bold">{stats.passed}</p>
              <p className="text-sm text-gray-600">Passed</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-500" />
            <div>
              <p className="text-lg font-bold">{stats.failed}</p>
              <p className="text-sm text-gray-600">Failed</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-purple-500" />
            <div>
              <p className="text-lg font-bold">
                {stats.total > 0 ? Math.round(stats.passed / stats.total * 100) : 0}%
              </p>
              <p className="text-sm text-gray-600">Pass Rate</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Test Tabs */}
      <Tabs defaultValue="predefined" className="w-full">
        <TabsList>
          <TabsTrigger value="predefined">Predefined Tests</TabsTrigger>
          <TabsTrigger value="custom">Custom Test</TabsTrigger>
        </TabsList>

        <TabsContent value="predefined" className="space-y-4">
          <ScrollArea className="h-96">
            <div className="space-y-3">
              {tests.map((test) =>
              <Card key={test.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(test.status)}
                      <div>
                        <h4 className="font-medium">{test.name}</h4>
                        <p className="text-sm text-gray-600">
                          {test.method} {test.endpoint}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Expected: {test.expectedResult}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(test.status)}
                      {test.duration &&
                    <span className="text-xs text-gray-500">
                          {test.duration.toFixed(0)}ms
                        </span>
                    }
                      <Button
                      size="sm"
                      onClick={() => runTest(test.id)}
                      disabled={test.status === 'running'}>

                        {test.status === 'running' ?
                      <Activity className="h-4 w-4 animate-pulse" /> :

                      <Play className="h-4 w-4" />
                      }
                      </Button>
                    </div>
                  </div>
                  
                  {/* Results */}
                  {test.result &&
                <div className="mt-3 p-2 bg-green-50 rounded border">
                      <p className="text-xs font-medium text-green-800 mb-1">Result:</p>
                      <pre className="text-xs text-green-700 whitespace-pre-wrap">
                        {JSON.stringify(test.result, null, 2)}
                      </pre>
                    </div>
                }
                  
                  {test.error &&
                <div className="mt-3 p-2 bg-red-50 rounded border">
                      <div className="flex items-center gap-1 mb-1">
                        <AlertCircle className="h-3 w-3 text-red-600" />
                        <p className="text-xs font-medium text-red-800">Error:</p>
                      </div>
                      <p className="text-xs text-red-700">{test.error}</p>
                    </div>
                }
                </Card>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="custom" className="space-y-4">
          <Card className="p-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="endpoint">Endpoint</Label>
                <Input
                  id="endpoint"
                  value={customTest.endpoint}
                  onChange={(e) => setCustomTest((prev) => ({ ...prev, endpoint: e.target.value }))}
                  placeholder="e.g., getProducts, saveProduct" />

              </div>
              
              <div>
                <Label htmlFor="params">Parameters (JSON Array)</Label>
                <Textarea
                  id="params"
                  value={customTest.params}
                  onChange={(e) => setCustomTest((prev) => ({ ...prev, params: e.target.value }))}
                  placeholder='[{"search": "test", "limit": 10}]'
                  rows={4} />

              </div>
              
              <Button onClick={runCustomTest} className="w-full">
                <Play className="h-4 w-4 mr-2" />
                Run Custom Test
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>);

}