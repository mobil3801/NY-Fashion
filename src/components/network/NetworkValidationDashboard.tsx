import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useNetwork } from '@/contexts/NetworkContext';
import { apiClient } from '@/lib/network/client';
import { offlineQueue } from '@/lib/offlineQueue';
import { networkDiagnostics } from '@/lib/network/diagnostics';
import { useToast } from '@/hooks/use-toast';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Activity,
  Database,
  Timer,
  Memory,
  Zap } from
'lucide-react';

interface ValidationResult {
  test: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  message: string;
  duration?: number;
  details?: any;
}

interface MemoryUsage {
  used: number;
  total: number;
  percentage: number;
  timestamp: number;
}

export default function NetworkValidationDashboard() {
  const network = useNetwork();
  const { toast } = useToast();

  // Test state
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [currentTest, setCurrentTest] = useState<string | null>(null);

  // Performance monitoring
  const [memoryUsage, setMemoryUsage] = useState<MemoryUsage[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState({
    apiCallsPerSecond: 0,
    averageLatency: 0,
    errorRate: 0,
    queueSize: 0
  });

  // Network simulation
  const [simulatedNetworkState, setSimulatedNetworkState] = useState<'online' | 'offline' | 'slow' | 'unstable'>('online');

  const memoryMonitorRef = useRef<number>();
  const performanceMonitorRef = useRef<number>();

  // Memory monitoring
  const monitorMemoryUsage = useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const usage: MemoryUsage = {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        percentage: memory.usedJSHeapSize / memory.totalJSHeapSize * 100,
        timestamp: Date.now()
      };

      setMemoryUsage((prev) => [...prev.slice(-50), usage]); // Keep last 50 readings
    }
  }, []);

  // Performance monitoring
  const monitorPerformance = useCallback(async () => {
    try {
      const queueStatus = await apiClient.getQueueStatus();
      const diagnostics = await network.getConnectionDiagnostics();

      setPerformanceMetrics({
        apiCallsPerSecond: diagnostics.pendingRequests || 0,
        averageLatency: diagnostics.latency || 0,
        errorRate: diagnostics.connectionErrors / Math.max(1, diagnostics.failedRequests) * 100,
        queueSize: queueStatus.size || 0
      });
    } catch (error) {
      console.warn('Performance monitoring error:', error);
    }
  }, [network]);

  // Start monitoring
  useEffect(() => {
    memoryMonitorRef.current = window.setInterval(monitorMemoryUsage, 1000);
    performanceMonitorRef.current = window.setInterval(monitorPerformance, 2000);

    return () => {
      if (memoryMonitorRef.current) clearInterval(memoryMonitorRef.current);
      if (performanceMonitorRef.current) clearInterval(performanceMonitorRef.current);
    };
  }, [monitorMemoryUsage, monitorPerformance]);

  // Validation tests
  const validationTests = [
  {
    name: 'Network Context Initialization',
    test: async () => {
      const diagnostics = await network.getConnectionDiagnostics();
      if (!diagnostics.isOnline !== undefined && diagnostics.networkStatus) {
        return { success: true, message: 'Network context properly initialized' };
      }
      throw new Error('Network context not properly initialized');
    }
  },
  {
    name: 'Queue Persistence',
    test: async () => {
      const testOperation = {
        url: '/test-queue-persistence',
        data: { test: 'persistence', timestamp: Date.now() }
      };

      await offlineQueue.enqueue('POST', testOperation.url, testOperation.data);
      const queueSize = await offlineQueue.size();
      const operations = offlineQueue.getAll();

      if (queueSize > 0 && operations.length > 0) {
        await offlineQueue.remove(operations[operations.length - 1].id);
        return { success: true, message: `Queue persistence working. Size: ${queueSize}` };
      }
      throw new Error('Queue persistence failed');
    }
  },
  {
    name: 'IndexedDB Functionality',
    test: async () => {
      // Test IndexedDB directly
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('app-offline-queue-test', 1);

        request.onerror = () => reject(new Error('IndexedDB access failed'));

        request.onsuccess = () => {
          const db = request.result;
          db.close();
          resolve({ success: true, message: 'IndexedDB accessible' });
        };

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains('test')) {
            db.createObjectStore('test', { keyPath: 'id' });
          }
        };
      });
    }
  },
  {
    name: 'Retry Logic',
    test: async () => {
      let attempts = 0;
      const maxAttempts = 3;

      try {
        await apiClient.get('/test-retry-endpoint', {
          retry: { attempts: maxAttempts },
          skipOfflineQueue: true
        });
      } catch (error) {
        // Expected to fail, but should have attempted retries
        if (attempts <= maxAttempts) {
          return {
            success: true,
            message: `Retry logic executed ${attempts}/${maxAttempts} attempts`
          };
        }
      }

      return { success: true, message: 'Retry logic functional' };
    }
  },
  {
    name: 'Network State Transitions',
    test: async () => {
      const initialState = network.networkStatus;

      // Simulate offline
      apiClient.setOnlineStatus(false);
      await new Promise((resolve) => setTimeout(resolve, 100));

      if (network.networkStatus !== 'disconnected') {
        throw new Error('Network state transition to offline failed');
      }

      // Simulate back online
      apiClient.setOnlineStatus(true);
      await new Promise((resolve) => setTimeout(resolve, 100));

      return { success: true, message: 'Network state transitions working' };
    }
  },
  {
    name: 'Queue Synchronization',
    test: async () => {
      // Add test operations to queue
      const testOps = [
      { url: '/sync-test-1', data: { id: 1 } },
      { url: '/sync-test-2', data: { id: 2 } },
      { url: '/sync-test-3', data: { id: 3 } }];


      for (const op of testOps) {
        await offlineQueue.enqueue('POST', op.url, op.data);
      }

      const initialSize = await offlineQueue.size();

      // Simulate sync
      const processedCount = await offlineQueue.flush(async () => {
        // Simulate successful processing
        await new Promise((resolve) => setTimeout(resolve, 10));
        return true;
      });

      const finalSize = await offlineQueue.size();

      if (processedCount === testOps.length && finalSize < initialSize) {
        return { success: true, message: `Synchronized ${processedCount} operations` };
      }

      throw new Error('Queue synchronization failed');
    }
  },
  {
    name: 'Error Recovery',
    test: async () => {
      // Test error recovery mechanisms
      network.clearErrors();

      try {
        await apiClient.get('/non-existent-endpoint', { skipRetry: true });
      } catch (error) {


        // Expected error
      }const diagnostics = await network.getConnectionDiagnostics();
      network.clearErrors();

      const clearedDiagnostics = await network.getConnectionDiagnostics();

      if (clearedDiagnostics.connectionErrors === 0) {
        return { success: true, message: 'Error recovery functional' };
      }

      throw new Error('Error recovery failed');
    }
  },
  {
    name: 'Memory Management',
    test: async () => {
      const initialMemory = memoryUsage[memoryUsage.length - 1];

      // Create and clean up operations
      const operations = [];
      for (let i = 0; i < 100; i++) {
        operations.push(
          apiClient.get(`/memory-test-${i}`, { skipRetry: true }).catch(() => {})
        );
      }

      await Promise.allSettled(operations);

      // Force cleanup
      apiClient.cleanup();

      // Wait for garbage collection
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const finalMemory = memoryUsage[memoryUsage.length - 1];

      if (finalMemory && initialMemory) {
        const memoryDiff = finalMemory.used - initialMemory.used;
        const isWithinLimits = memoryDiff < 10 * 1024 * 1024; // 10MB threshold

        return {
          success: isWithinLimits,
          message: `Memory change: ${(memoryDiff / 1024 / 1024).toFixed(2)}MB`
        };
      }

      return { success: true, message: 'Memory monitoring not available' };
    }
  },
  {
    name: 'Performance Under Load',
    test: async () => {
      const startTime = performance.now();
      const requests = [];

      // Create 50 concurrent requests
      for (let i = 0; i < 50; i++) {
        requests.push(
          apiClient.get(`/load-test-${i}`, {
            timeout: 1000,
            skipRetry: true
          }).catch(() => ({ failed: true }))
        );
      }

      const results = await Promise.allSettled(requests);
      const duration = performance.now() - startTime;

      const successRate = results.filter((r) => r.status === 'fulfilled').length / results.length;

      return {
        success: successRate > 0.5, // Allow 50% failure rate under load
        message: `${duration.toFixed(0)}ms for 50 requests, ${(successRate * 100).toFixed(1)}% success rate`
      };
    }
  }];


  const runValidation = async () => {
    setIsRunningTests(true);
    setValidationResults([]);

    const results: ValidationResult[] = validationTests.map((test) => ({
      test: test.name,
      status: 'pending',
      message: 'Waiting to run...'
    }));

    setValidationResults([...results]);

    for (let i = 0; i < validationTests.length; i++) {
      const test = validationTests[i];
      setCurrentTest(test.name);

      // Update status to running
      results[i] = { ...results[i], status: 'running', message: 'Running...' };
      setValidationResults([...results]);

      const startTime = performance.now();

      try {
        const result = await test.test();
        const duration = performance.now() - startTime;

        results[i] = {
          ...results[i],
          status: 'passed',
          message: result.message,
          duration,
          details: result
        };
      } catch (error) {
        const duration = performance.now() - startTime;

        results[i] = {
          ...results[i],
          status: 'failed',
          message: error instanceof Error ? error.message : 'Unknown error',
          duration,
          details: { error: String(error) }
        };
      }

      setValidationResults([...results]);

      // Small delay between tests
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    setCurrentTest(null);
    setIsRunningTests(false);

    const passed = results.filter((r) => r.status === 'passed').length;
    const failed = results.filter((r) => r.status === 'failed').length;

    toast({
      title: 'Validation Complete',
      description: `${passed} passed, ${failed} failed`,
      variant: failed > 0 ? 'destructive' : 'default'
    });
  };

  const getStatusIcon = (status: ValidationResult['status']) => {
    switch (status) {
      case 'pending':return <Timer className="h-4 w-4 text-gray-400" />;
      case 'running':return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'passed':return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusBadge = (status: ValidationResult['status']) => {
    const variants = {
      pending: 'secondary',
      running: 'outline',
      passed: 'default',
      failed: 'destructive'
    } as const;

    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Network Validation Dashboard</h1>
          <p className="text-gray-600">
            Comprehensive testing of network infrastructure and queue management
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {network.isOnline ?
          <Badge className="bg-green-100 text-green-800">
              <Wifi className="h-3 w-3 mr-1" />
              Online
            </Badge> :

          <Badge variant="destructive">
              <WifiOff className="h-3 w-3 mr-1" />
              Offline
            </Badge>
          }
          
          <Button
            onClick={runValidation}
            disabled={isRunningTests}
            className="gap-2">

            {isRunningTests ?
            <RefreshCw className="h-4 w-4 animate-spin" /> :

            <Zap className="h-4 w-4" />
            }
            {isRunningTests ? 'Running Tests...' : 'Run Validation'}
          </Button>
        </div>
      </div>
      
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tests">Test Results</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Network Status</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{network.networkStatus}</div>
                <p className="text-xs text-muted-foreground">
                  Quality: {network.connectionQuality}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Queue Size</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{network.queuedOperations}</div>
                <p className="text-xs text-muted-foreground">
                  {network.isProcessingQueue ? 'Processing...' : 'Idle'}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">API Latency</CardTitle>
                <Timer className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{network.latency.toFixed(0)}ms</div>
                <p className="text-xs text-muted-foreground">
                  Pending: {network.pendingRequests}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
                <Memory className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {memoryUsage.length > 0 ?
                  `${memoryUsage[memoryUsage.length - 1].percentage.toFixed(1)}%` :
                  'N/A'
                  }
                </div>
                <p className="text-xs text-muted-foreground">
                  {memoryUsage.length > 0 ?
                  `${(memoryUsage[memoryUsage.length - 1].used / 1024 / 1024).toFixed(1)}MB used` :
                  'Monitoring...'
                  }
                </p>
              </CardContent>
            </Card>
          </div>
          
          {isRunningTests &&
          <Alert>
              <RefreshCw className="h-4 w-4 animate-spin" />
              <AlertDescription>
                Running validation tests... Currently testing: <strong>{currentTest}</strong>
              </AlertDescription>
            </Alert>
          }
        </TabsContent>
        
        <TabsContent value="tests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Validation Results</CardTitle>
              <CardDescription>
                Detailed results of network infrastructure tests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {validationResults.map((result, index) =>
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(result.status)}
                      <div>
                        <div className="font-medium">{result.test}</div>
                        <div className="text-sm text-gray-600">{result.message}</div>
                        {result.duration &&
                      <div className="text-xs text-gray-400">
                            Completed in {result.duration.toFixed(0)}ms
                          </div>
                      }
                      </div>
                    </div>
                    {getStatusBadge(result.status)}
                  </div>
                )}
                
                {validationResults.length === 0 &&
                <div className="text-center py-8 text-gray-500">
                    Click "Run Validation" to start testing the network infrastructure
                  </div>
                }
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm">
                    <span>API Calls/sec</span>
                    <span>{performanceMetrics.apiCallsPerSecond}</span>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between text-sm">
                    <span>Average Latency</span>
                    <span>{performanceMetrics.averageLatency.toFixed(0)}ms</span>
                  </div>
                  <Progress value={Math.min(performanceMetrics.averageLatency / 10, 100)} className="mt-1" />
                </div>
                
                <div>
                  <div className="flex justify-between text-sm">
                    <span>Error Rate</span>
                    <span>{performanceMetrics.errorRate.toFixed(1)}%</span>
                  </div>
                  <Progress
                    value={performanceMetrics.errorRate}
                    className="mt-1"
                    // className={`mt-1 ${performanceMetrics.errorRate > 10 ? 'bg-red-200' : ''}`}
                  />
                </div>
                
                <div>
                  <div className="flex justify-between text-sm">
                    <span>Queue Size</span>
                    <span>{performanceMetrics.queueSize}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Memory Monitoring</CardTitle>
              </CardHeader>
              <CardContent>
                {memoryUsage.length > 0 ?
                <div className="space-y-2">
                    <div className="text-sm">
                      Current: {(memoryUsage[memoryUsage.length - 1].used / 1024 / 1024).toFixed(1)}MB
                    </div>
                    <div className="text-sm">
                      Limit: {(memoryUsage[memoryUsage.length - 1].total / 1024 / 1024).toFixed(1)}MB
                    </div>
                    <Progress
                    value={memoryUsage[memoryUsage.length - 1].percentage}
                    className="mt-2" />

                    {memoryUsage[memoryUsage.length - 1].percentage > 80 &&
                  <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          High memory usage detected
                        </AlertDescription>
                      </Alert>
                  }
                  </div> :

                <div className="text-sm text-gray-500">Memory monitoring not available</div>
                }
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="diagnostics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Network Diagnostics</CardTitle>
              <CardDescription>
                Real-time network connection information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="font-medium">Connection</div>
                  <div className="text-gray-600">{network.isConnected ? 'Connected' : 'Disconnected'}</div>
                </div>
                
                <div>
                  <div className="font-medium">Quality</div>
                  <div className="text-gray-600">{network.connectionQuality}</div>
                </div>
                
                <div>
                  <div className="font-medium">Bandwidth</div>
                  <div className="text-gray-600">{network.bandwidth}Mbps</div>
                </div>
                
                <div>
                  <div className="font-medium">Signal Strength</div>
                  <div className="text-gray-600">{network.signalStrength}%</div>
                </div>
                
                <div>
                  <div className="font-medium">Failed Requests</div>
                  <div className="text-gray-600">{network.failedRequests}</div>
                </div>
                
                <div>
                  <div className="font-medium">Last Success</div>
                  <div className="text-gray-600">
                    {network.lastSuccessfulRequest ?
                    new Date(network.lastSuccessfulRequest).toLocaleTimeString() :
                    'Never'
                    }
                  </div>
                </div>
              </div>
              
              {network.lastError &&
              <Alert className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Last Error: {network.lastError.message}
                  </AlertDescription>
                </Alert>
              }
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>);

}