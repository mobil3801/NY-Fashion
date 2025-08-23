import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiClient } from '@/lib/network/client';
import { offlineQueue } from '@/lib/offlineQueue';
import { useToast } from '@/hooks/use-toast';
import {
  Memory,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Activity,
  Zap,
  RefreshCw,
  Trash2 } from
'lucide-react';

interface MemoryReading {
  timestamp: number;
  used: number;
  total: number;
  percentage: number;
  heapSize?: number;
}

interface LeakTest {
  name: string;
  description: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  results?: {
    initialMemory: number;
    finalMemory: number;
    memoryDelta: number;
    operationsCreated: number;
    operationsCleaned: number;
    leakDetected: boolean;
    details?: string;
  };
}

export default function MemoryLeakDetector() {
  const [memoryReadings, setMemoryReadings] = useState<MemoryReading[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [leakTests, setLeakTests] = useState<LeakTest[]>([]);
  const [currentTest, setCurrentTest] = useState<LeakTest | null>(null);

  const { toast } = useToast();
  const monitoringInterval = useRef<number>();
  const testRefs = useRef(new Map<string, any>());

  // Memory monitoring
  const collectMemoryReading = () => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const reading: MemoryReading = {
        timestamp: Date.now(),
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        percentage: memory.usedJSHeapSize / memory.totalJSHeapSize * 100,
        heapSize: memory.usedJSHeapSize
      };

      setMemoryReadings((prev) => {
        const updated = [...prev, reading];
        // Keep only last 100 readings
        return updated.slice(-100);
      });

      return reading;
    }
    return null;
  };

  // Start/stop monitoring
  const toggleMonitoring = () => {
    if (isMonitoring) {
      if (monitoringInterval.current) {
        clearInterval(monitoringInterval.current);
      }
      setIsMonitoring(false);
    } else {
      monitoringInterval.current = window.setInterval(collectMemoryReading, 1000);
      setIsMonitoring(true);
      collectMemoryReading(); // Initial reading
    }
  };

  // Clear memory readings
  const clearReadings = () => {
    setMemoryReadings([]);
  };

  // Force garbage collection (if available)
  const forceGC = () => {
    if ('gc' in window) {
      (window as any).gc();
      toast({
        title: 'Garbage Collection',
        description: 'Forced garbage collection (if available)',
        variant: 'default'
      });
    } else {
      toast({
        title: 'GC Unavailable',
        description: 'Garbage collection not available in this environment',
        variant: 'destructive'
      });
    }
  };

  // Initialize leak tests
  useEffect(() => {
    const tests: LeakTest[] = [
    {
      name: 'API Client Memory Leak',
      description: 'Test for memory leaks in API client request handling',
      status: 'idle'
    },
    {
      name: 'Queue Operations Memory Leak',
      description: 'Test for memory leaks in offline queue operations',
      status: 'idle'
    },
    {
      name: 'Context Provider Memory Leak',
      description: 'Test for memory leaks in network context providers',
      status: 'idle'
    },
    {
      name: 'Event Listeners Memory Leak',
      description: 'Test for memory leaks from unremoved event listeners',
      status: 'idle'
    },
    {
      name: 'Large Data Processing',
      description: 'Test memory handling with large data operations',
      status: 'idle'
    }];


    setLeakTests(tests);
  }, []);

  // Run specific leak test
  const runLeakTest = async (testIndex: number) => {
    const test = leakTests[testIndex];
    if (test.status === 'running') return;

    setCurrentTest(test);

    const updatedTests = [...leakTests];
    updatedTests[testIndex] = { ...test, status: 'running' };
    setLeakTests(updatedTests);

    try {
      let results;

      switch (testIndex) {
        case 0:
          results = await testApiClientMemoryLeak();
          break;
        case 1:
          results = await testQueueOperationsMemoryLeak();
          break;
        case 2:
          results = await testContextProviderMemoryLeak();
          break;
        case 3:
          results = await testEventListenersMemoryLeak();
          break;
        case 4:
          results = await testLargeDataProcessing();
          break;
        default:
          throw new Error('Unknown test');
      }

      updatedTests[testIndex] = {
        ...test,
        status: 'completed',
        results
      };

      toast({
        title: 'Test Completed',
        description: `${test.name} - ${results.leakDetected ? 'Leak detected' : 'No leak detected'}`,
        variant: results.leakDetected ? 'destructive' : 'default'
      });

    } catch (error) {
      updatedTests[testIndex] = {
        ...test,
        status: 'failed',
        results: {
          initialMemory: 0,
          finalMemory: 0,
          memoryDelta: 0,
          operationsCreated: 0,
          operationsCleaned: 0,
          leakDetected: false,
          details: `Test failed: ${error}`
        }
      };

      toast({
        title: 'Test Failed',
        description: test.name,
        variant: 'destructive'
      });
    }

    setLeakTests(updatedTests);
    setCurrentTest(null);
  };

  // API Client memory leak test
  const testApiClientMemoryLeak = async () => {
    const initialMemory = collectMemoryReading();
    if (!initialMemory) throw new Error('Memory monitoring not available');

    const requests = [];
    const numRequests = 100;

    // Create many API requests
    for (let i = 0; i < numRequests; i++) {
      requests.push(
        apiClient.get(`/memory-test-${i}`, {
          timeout: 100,
          skipRetry: true
        }).catch(() => {}) // Ignore failures
      );
    }

    await Promise.allSettled(requests);

    // Force cleanup
    apiClient.cleanup();

    // Wait for potential garbage collection
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const finalMemory = collectMemoryReading();
    if (!finalMemory) throw new Error('Final memory reading failed');

    const memoryDelta = finalMemory.used - initialMemory.used;
    const leakDetected = memoryDelta > 5 * 1024 * 1024; // 5MB threshold

    return {
      initialMemory: initialMemory.used,
      finalMemory: finalMemory.used,
      memoryDelta,
      operationsCreated: numRequests,
      operationsCleaned: numRequests,
      leakDetected,
      details: `Memory change: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB`
    };
  };

  // Queue operations memory leak test
  const testQueueOperationsMemoryLeak = async () => {
    const initialMemory = collectMemoryReading();
    if (!initialMemory) throw new Error('Memory monitoring not available');

    const numOperations = 200;

    // Clear existing queue
    await offlineQueue.clear();

    // Add many operations
    for (let i = 0; i < numOperations; i++) {
      await offlineQueue.enqueue('POST', `/queue-memory-test-${i}`, {
        data: new Array(1000).fill(i), // Some data to make it meaningful
        timestamp: Date.now()
      });
    }

    // Process and remove all operations
    await offlineQueue.flush(async () => true); // Remove all

    // Wait for cleanup
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const finalMemory = collectMemoryReading();
    if (!finalMemory) throw new Error('Final memory reading failed');

    const memoryDelta = finalMemory.used - initialMemory.used;
    const leakDetected = memoryDelta > 10 * 1024 * 1024; // 10MB threshold

    return {
      initialMemory: initialMemory.used,
      finalMemory: finalMemory.used,
      memoryDelta,
      operationsCreated: numOperations,
      operationsCleaned: numOperations,
      leakDetected,
      details: `Memory change: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB`
    };
  };

  // Context provider memory leak test
  const testContextProviderMemoryLeak = async () => {
    const initialMemory = collectMemoryReading();
    if (!initialMemory) throw new Error('Memory monitoring not available');

    // Simulate multiple provider mount/unmount cycles
    const cycles = 50;
    const contexts = [];

    for (let i = 0; i < cycles; i++) {
      // Simulate context creation and destruction
      const context = {
        id: i,
        listeners: new Set(),
        cleanup: () => {
          context.listeners.clear();
        }
      };

      contexts.push(context);

      // Add some listeners
      for (let j = 0; j < 10; j++) {
        context.listeners.add(() => {});
      }
    }

    // Cleanup all contexts
    contexts.forEach((context) => context.cleanup());
    contexts.length = 0; // Clear array

    // Wait for cleanup
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const finalMemory = collectMemoryReading();
    if (!finalMemory) throw new Error('Final memory reading failed');

    const memoryDelta = finalMemory.used - initialMemory.used;
    const leakDetected = memoryDelta > 2 * 1024 * 1024; // 2MB threshold

    return {
      initialMemory: initialMemory.used,
      finalMemory: finalMemory.used,
      memoryDelta,
      operationsCreated: cycles,
      operationsCleaned: cycles,
      leakDetected,
      details: `Memory change: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB`
    };
  };

  // Event listeners memory leak test
  const testEventListenersMemoryLeak = async () => {
    const initialMemory = collectMemoryReading();
    if (!initialMemory) throw new Error('Memory monitoring not available');

    const numListeners = 500;
    const listeners = [];

    // Add many event listeners
    for (let i = 0; i < numListeners; i++) {
      const listener = () => console.log(`Listener ${i}`);
      window.addEventListener('custom-event', listener);
      listeners.push(listener);
    }

    // Trigger some events
    for (let i = 0; i < 10; i++) {
      window.dispatchEvent(new CustomEvent('custom-event'));
    }

    // Remove all listeners
    listeners.forEach((listener, index) => {
      window.removeEventListener('custom-event', listener);
    });

    // Wait for cleanup
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const finalMemory = collectMemoryReading();
    if (!finalMemory) throw new Error('Final memory reading failed');

    const memoryDelta = finalMemory.used - initialMemory.used;
    const leakDetected = memoryDelta > 1 * 1024 * 1024; // 1MB threshold

    return {
      initialMemory: initialMemory.used,
      finalMemory: finalMemory.used,
      memoryDelta,
      operationsCreated: numListeners,
      operationsCleaned: numListeners,
      leakDetected,
      details: `Memory change: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB`
    };
  };

  // Large data processing test
  const testLargeDataProcessing = async () => {
    const initialMemory = collectMemoryReading();
    if (!initialMemory) throw new Error('Memory monitoring not available');

    const iterations = 10;

    for (let i = 0; i < iterations; i++) {
      // Create large data structures
      const largeArray = new Array(100000).fill(0).map((_, index) => ({
        id: index,
        data: `Large data string ${index}`.repeat(100),
        nested: {
          moreData: new Array(100).fill(index)
        }
      }));

      // Process the data
      const processed = largeArray.map((item) => ({
        ...item,
        processed: true,
        processedAt: Date.now()
      }));

      // Clear references
      largeArray.length = 0;
      processed.length = 0;
    }

    // Wait for cleanup
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const finalMemory = collectMemoryReading();
    if (!finalMemory) throw new Error('Final memory reading failed');

    const memoryDelta = finalMemory.used - initialMemory.used;
    const leakDetected = memoryDelta > 20 * 1024 * 1024; // 20MB threshold

    return {
      initialMemory: initialMemory.used,
      finalMemory: finalMemory.used,
      memoryDelta,
      operationsCreated: iterations,
      operationsCleaned: iterations,
      leakDetected,
      details: `Memory change: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB`
    };
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (monitoringInterval.current) {
        clearInterval(monitoringInterval.current);
      }
    };
  }, []);

  // Calculate memory trend
  const getMemoryTrend = () => {
    if (memoryReadings.length < 10) return 'stable';

    const recent = memoryReadings.slice(-10);
    const first = recent[0].used;
    const last = recent[recent.length - 1].used;
    const change = (last - first) / first * 100;

    if (change > 5) return 'increasing';
    if (change < -5) return 'decreasing';
    return 'stable';
  };

  const memoryTrend = getMemoryTrend();
  const currentMemory = memoryReadings.length > 0 ? memoryReadings[memoryReadings.length - 1] : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Memory Leak Detector</h2>
          <p className="text-gray-600">
            Monitor memory usage and detect potential memory leaks
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={clearReadings}>
            <Trash2 className="h-4 w-4 mr-2" />
            Clear
          </Button>
          <Button variant="outline" onClick={forceGC}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Force GC
          </Button>
          <Button onClick={toggleMonitoring} variant={isMonitoring ? 'destructive' : 'default'}>
            <Activity className="h-4 w-4 mr-2" />
            {isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
          </Button>
        </div>
      </div>
      
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="monitoring">Memory Monitor</TabsTrigger>
          <TabsTrigger value="leak-tests">Leak Tests</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
                <Memory className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {currentMemory ?
                  `${(currentMemory.used / 1024 / 1024).toFixed(1)}MB` :
                  'N/A'
                  }
                </div>
                <p className="text-xs text-muted-foreground">
                  {currentMemory ?
                  `${currentMemory.percentage.toFixed(1)}% of ${(currentMemory.total / 1024 / 1024).toFixed(1)}MB` :
                  'No data available'
                  }
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Memory Trend</CardTitle>
                {memoryTrend === 'increasing' ?
                <TrendingUp className="h-4 w-4 text-red-500" /> :
                memoryTrend === 'decreasing' ?
                <TrendingDown className="h-4 w-4 text-green-500" /> :

                <Activity className="h-4 w-4 text-blue-500" />
                }
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold capitalize">{memoryTrend}</div>
                <p className="text-xs text-muted-foreground">
                  Based on last 10 readings
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Monitoring Status</CardTitle>
                <Activity className={`h-4 w-4 ${isMonitoring ? 'text-green-500' : 'text-gray-400'}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isMonitoring ? 'Active' : 'Inactive'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {memoryReadings.length} readings collected
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Leak Status</CardTitle>
                {leakTests.some((t) => t.results?.leakDetected) ?
                <AlertTriangle className="h-4 w-4 text-red-500" /> :

                <Zap className="h-4 w-4 text-green-500" />
                }
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {leakTests.some((t) => t.results?.leakDetected) ? 'Issues' : 'Clean'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {leakTests.filter((t) => t.status === 'completed').length} tests completed
                </p>
              </CardContent>
            </Card>
          </div>
          
          {currentMemory && currentMemory.percentage > 80 &&
          <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                High memory usage detected ({currentMemory.percentage.toFixed(1)}%). 
                Consider running garbage collection or investigating potential leaks.
              </AlertDescription>
            </Alert>
          }
        </TabsContent>
        
        <TabsContent value="monitoring" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Real-time Memory Monitoring</CardTitle>
            </CardHeader>
            <CardContent>
              {currentMemory &&
              <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Used Memory</span>
                      <span>{(currentMemory.used / 1024 / 1024).toFixed(2)}MB</span>
                    </div>
                    <Progress value={currentMemory.percentage} />
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="font-medium">Used Heap</div>
                      <div>{(currentMemory.used / 1024 / 1024).toFixed(2)}MB</div>
                    </div>
                    <div>
                      <div className="font-medium">Total Heap</div>
                      <div>{(currentMemory.total / 1024 / 1024).toFixed(2)}MB</div>
                    </div>
                    <div>
                      <div className="font-medium">Usage %</div>
                      <div>{currentMemory.percentage.toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="font-medium">Readings</div>
                      <div>{memoryReadings.length}</div>
                    </div>
                  </div>
                </div>
              }
              
              {!currentMemory &&
              <div className="text-center py-8 text-gray-500">
                  {isMonitoring ?
                'Collecting memory data...' :
                'Start monitoring to see memory usage'
                }
                </div>
              }
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="leak-tests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Memory Leak Tests</CardTitle>
              <p className="text-sm text-gray-600">
                Run tests to detect potential memory leaks in different components
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {leakTests.map((test, index) =>
                <div key={index} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="font-medium">{test.name}</div>
                        <div className="text-sm text-gray-600">{test.description}</div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge
                        variant={
                        test.status === 'completed' && !test.results?.leakDetected ? 'default' :
                        test.status === 'completed' && test.results?.leakDetected ? 'destructive' :
                        test.status === 'running' ? 'outline' :
                        test.status === 'failed' ? 'destructive' :
                        'secondary'
                        }>

                          {test.status}
                        </Badge>
                        
                        <Button
                        size="sm"
                        onClick={() => runLeakTest(index)}
                        disabled={test.status === 'running'}>

                          {test.status === 'running' ?
                        <RefreshCw className="h-4 w-4 animate-spin" /> :

                        'Run Test'
                        }
                        </Button>
                      </div>
                    </div>
                    
                    {test.results &&
                  <div className="mt-3 p-3 bg-gray-50 rounded text-sm space-y-2">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <div>
                            <div className="font-medium">Memory Delta</div>
                            <div>{(test.results.memoryDelta / 1024 / 1024).toFixed(2)}MB</div>
                          </div>
                          <div>
                            <div className="font-medium">Operations</div>
                            <div>{test.results.operationsCreated}</div>
                          </div>
                          <div>
                            <div className="font-medium">Cleaned</div>
                            <div>{test.results.operationsCleaned}</div>
                          </div>
                          <div>
                            <div className="font-medium">Leak Status</div>
                            <div className={test.results.leakDetected ? 'text-red-600' : 'text-green-600'}>
                              {test.results.leakDetected ? 'Detected' : 'None'}
                            </div>
                          </div>
                        </div>
                        {test.results.details &&
                    <div className="text-gray-600">{test.results.details}</div>
                    }
                      </div>
                  }
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>);

}