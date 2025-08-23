import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { offlineQueue, QueuedOperation } from '@/lib/offlineQueue';
import { useToast } from '@/hooks/use-toast';
import { 
  Database, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Trash2, 
  Plus,
  Activity,
  Clock,
  AlertTriangle
} from 'lucide-react';

interface ValidationTest {
  name: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  message: string;
  duration?: number;
}

export default function QueuePersistenceValidator() {
  const [queueOperations, setQueueOperations] = useState<QueuedOperation[]>([]);
  const [validationTests, setValidationTests] = useState<ValidationTest[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [queueStats, setQueueStats] = useState({
    size: 0,
    oldestOperation: null as Date | null,
    newestOperation: null as Date | null,
    totalOperations: 0
  });
  
  const { toast } = useToast();
  
  // Load queue operations
  const loadQueueOperations = async () => {
    try {
      await offlineQueue.init();
      const operations = offlineQueue.getAll();
      setQueueOperations(operations);
      
      const size = await offlineQueue.size();
      const stats = {
        size,
        oldestOperation: operations.length > 0 
          ? new Date(Math.min(...operations.map(op => op.createdAt)))
          : null,
        newestOperation: operations.length > 0 
          ? new Date(Math.max(...operations.map(op => op.createdAt)))
          : null,
        totalOperations: operations.length
      };
      
      setQueueStats(stats);
    } catch (error) {
      console.error('Failed to load queue operations:', error);
      toast({
        title: 'Queue Error',
        description: 'Failed to load queue operations',
        variant: 'destructive'
      });
    }
  };
  
  // Add test operations
  const addTestOperations = async () => {
    const testOps = [
      {
        url: '/api/test-persistence-1',
        type: 'POST' as const,
        data: { test: 'persistence', timestamp: Date.now(), id: 1 }
      },
      {
        url: '/api/test-persistence-2',
        type: 'PUT' as const,
        data: { test: 'persistence', timestamp: Date.now(), id: 2 }
      },
      {
        url: '/api/test-persistence-3',
        type: 'DELETE' as const,
        data: { test: 'persistence', timestamp: Date.now(), id: 3 }
      }
    ];
    
    try {
      for (const op of testOps) {
        await offlineQueue.enqueue(op.type, op.url, op.data);
      }
      
      await loadQueueOperations();
      
      toast({
        title: 'Test Operations Added',
        description: `Added ${testOps.length} test operations to queue`,
        variant: 'default'
      });
    } catch (error) {
      console.error('Failed to add test operations:', error);
      toast({
        title: 'Queue Error',
        description: 'Failed to add test operations',
        variant: 'destructive'
      });
    }
  };
  
  // Clear queue
  const clearQueue = async () => {
    try {
      await offlineQueue.clear();
      await loadQueueOperations();
      
      toast({
        title: 'Queue Cleared',
        description: 'All queue operations have been removed',
        variant: 'default'
      });
    } catch (error) {
      console.error('Failed to clear queue:', error);
      toast({
        title: 'Queue Error',
        description: 'Failed to clear queue',
        variant: 'destructive'
      });
    }
  };
  
  // Run validation tests
  const runValidationTests = async () => {
    setIsRunningTests(true);
    
    const tests: ValidationTest[] = [
      { name: 'IndexedDB Access', status: 'pending', message: 'Testing IndexedDB availability...' },
      { name: 'Queue Initialization', status: 'pending', message: 'Testing queue initialization...' },
      { name: 'Operation Persistence', status: 'pending', message: 'Testing operation persistence...' },
      { name: 'FIFO Order', status: 'pending', message: 'Testing FIFO order preservation...' },
      { name: 'Data Integrity', status: 'pending', message: 'Testing data integrity...' },
      { name: 'Error Handling', status: 'pending', message: 'Testing error handling...' },
      { name: 'Memory Consistency', status: 'pending', message: 'Testing memory/storage consistency...' },
      { name: 'Large Queue Handling', status: 'pending', message: 'Testing large queue handling...' }
    ];
    
    setValidationTests(tests);
    
    // Test 1: IndexedDB Access
    tests[0].status = 'running';
    setValidationTests([...tests]);
    
    try {
      const startTime = performance.now();
      
      const dbTest = new Promise((resolve, reject) => {
        const request = indexedDB.open('queue-validation-test', 1);
        request.onerror = () => reject(new Error('IndexedDB not accessible'));
        request.onsuccess = () => {
          request.result.close();
          resolve(true);
        };
      });
      
      await dbTest;
      tests[0].status = 'passed';
      tests[0].message = 'IndexedDB is accessible';
      tests[0].duration = performance.now() - startTime;
    } catch (error) {
      tests[0].status = 'failed';
      tests[0].message = `IndexedDB access failed: ${error}`;
    }
    
    setValidationTests([...tests]);
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Test 2: Queue Initialization
    tests[1].status = 'running';
    setValidationTests([...tests]);
    
    try {
      const startTime = performance.now();
      await offlineQueue.init();
      
      tests[1].status = 'passed';
      tests[1].message = 'Queue initialized successfully';
      tests[1].duration = performance.now() - startTime;
    } catch (error) {
      tests[1].status = 'failed';
      tests[1].message = `Queue initialization failed: ${error}`;
    }
    
    setValidationTests([...tests]);
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Test 3: Operation Persistence
    tests[2].status = 'running';
    setValidationTests([...tests]);
    
    try {
      const startTime = performance.now();
      
      const testOp = {
        url: '/persistence-test',
        data: { timestamp: Date.now(), test: 'persistence' }
      };
      
      await offlineQueue.enqueue('POST', testOp.url, testOp.data);
      const operations = offlineQueue.getAll();
      const found = operations.find(op => op.url === testOp.url);
      
      if (found && JSON.stringify(found.data) === JSON.stringify(testOp.data)) {
        tests[2].status = 'passed';
        tests[2].message = 'Operation persistence working';
      } else {
        tests[2].status = 'failed';
        tests[2].message = 'Operation not found or data corrupted';
      }
      
      tests[2].duration = performance.now() - startTime;
    } catch (error) {
      tests[2].status = 'failed';
      tests[2].message = `Persistence test failed: ${error}`;
    }
    
    setValidationTests([...tests]);
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Test 4: FIFO Order
    tests[3].status = 'running';
    setValidationTests([...tests]);
    
    try {
      const startTime = performance.now();
      
      // Clear queue first
      await offlineQueue.clear();
      
      // Add operations with timestamps
      const timestamps = [Date.now(), Date.now() + 100, Date.now() + 200];
      for (let i = 0; i < timestamps.length; i++) {
        await offlineQueue.enqueue('POST', `/fifo-test-${i}`, { order: i, timestamp: timestamps[i] });
      }
      
      const operations = offlineQueue.getAll();
      let isCorrectOrder = true;
      
      for (let i = 1; i < operations.length; i++) {
        if (operations[i].createdAt < operations[i-1].createdAt) {
          isCorrectOrder = false;
          break;
        }
      }
      
      if (isCorrectOrder) {
        tests[3].status = 'passed';
        tests[3].message = 'FIFO order preserved';
      } else {
        tests[3].status = 'failed';
        tests[3].message = 'FIFO order not preserved';
      }
      
      tests[3].duration = performance.now() - startTime;
    } catch (error) {
      tests[3].status = 'failed';
      tests[3].message = `FIFO test failed: ${error}`;
    }
    
    setValidationTests([...tests]);
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Test 5: Data Integrity
    tests[4].status = 'running';
    setValidationTests([...tests]);
    
    try {
      const startTime = performance.now();
      
      const complexData = {
        nested: {
          array: [1, 2, 3, { deep: 'value' }],
          nullValue: null,
          boolean: true,
          number: 42.5,
          string: 'test string with special chars: äöü!@#$%^&*()',
          date: new Date().toISOString()
        }
      };
      
      await offlineQueue.enqueue('POST', '/integrity-test', complexData);
      const operations = offlineQueue.getAll();
      const found = operations.find(op => op.url === '/integrity-test');
      
      if (found && JSON.stringify(found.data) === JSON.stringify(complexData)) {
        tests[4].status = 'passed';
        tests[4].message = 'Data integrity preserved';
      } else {
        tests[4].status = 'failed';
        tests[4].message = 'Data corruption detected';
      }
      
      tests[4].duration = performance.now() - startTime;
    } catch (error) {
      tests[4].status = 'failed';
      tests[4].message = `Data integrity test failed: ${error}`;
    }
    
    setValidationTests([...tests]);
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Test 6: Error Handling
    tests[5].status = 'running';
    setValidationTests([...tests]);
    
    try {
      const startTime = performance.now();
      
      // Test duplicate idempotency keys
      const idempotencyKey = 'test-duplicate-key';
      
      await offlineQueue.enqueue('POST', '/error-test-1', { test: 1 }, { 'Idempotency-Key': idempotencyKey });
      
      let duplicateError = false;
      try {
        await offlineQueue.enqueue('POST', '/error-test-2', { test: 2 }, { 'Idempotency-Key': idempotencyKey });
      } catch (error) {
        if (error instanceof Error && error.message.includes('already queued')) {
          duplicateError = true;
        }
      }
      
      if (duplicateError) {
        tests[5].status = 'passed';
        tests[5].message = 'Error handling working correctly';
      } else {
        tests[5].status = 'failed';
        tests[5].message = 'Duplicate detection not working';
      }
      
      tests[5].duration = performance.now() - startTime;
    } catch (error) {
      tests[5].status = 'failed';
      tests[5].message = `Error handling test failed: ${error}`;
    }
    
    setValidationTests([...tests]);
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Test 7: Memory Consistency
    tests[6].status = 'running';
    setValidationTests([...tests]);
    
    try {
      const startTime = performance.now();
      
      // Add operation and check both memory and storage
      const testData = { consistency: 'test', timestamp: Date.now() };
      await offlineQueue.enqueue('POST', '/consistency-test', testData);
      
      const memorySize = offlineQueue.sizeSync();
      const storageSize = await offlineQueue.size();
      
      if (memorySize === storageSize) {
        tests[6].status = 'passed';
        tests[6].message = `Memory and storage consistent (${memorySize} operations)`;
      } else {
        tests[6].status = 'failed';
        tests[6].message = `Inconsistency: memory ${memorySize}, storage ${storageSize}`;
      }
      
      tests[6].duration = performance.now() - startTime;
    } catch (error) {
      tests[6].status = 'failed';
      tests[6].message = `Memory consistency test failed: ${error}`;
    }
    
    setValidationTests([...tests]);
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Test 8: Large Queue Handling
    tests[7].status = 'running';
    setValidationTests([...tests]);
    
    try {
      const startTime = performance.now();
      
      // Clear queue first
      await offlineQueue.clear();
      
      // Add many operations
      const largeQueueSize = 100;
      const operations = [];
      
      for (let i = 0; i < largeQueueSize; i++) {
        operations.push(offlineQueue.enqueue('POST', `/large-test-${i}`, { index: i }));
      }
      
      await Promise.all(operations);
      
      const finalSize = await offlineQueue.size();
      
      if (finalSize === largeQueueSize) {
        tests[7].status = 'passed';
        tests[7].message = `Successfully handled ${finalSize} operations`;
      } else {
        tests[7].status = 'failed';
        tests[7].message = `Expected ${largeQueueSize}, got ${finalSize}`;
      }
      
      tests[7].duration = performance.now() - startTime;
    } catch (error) {
      tests[7].status = 'failed';
      tests[7].message = `Large queue test failed: ${error}`;
    }
    
    setValidationTests([...tests]);
    setIsRunningTests(false);
    
    // Reload operations after tests
    await loadQueueOperations();
    
    const passed = tests.filter(t => t.status === 'passed').length;
    const failed = tests.filter(t => t.status === 'failed').length;
    
    toast({
      title: 'Validation Complete',
      description: `${passed} passed, ${failed} failed`,
      variant: failed > 0 ? 'destructive' : 'default'
    });
  };
  
  // Load initial data
  useEffect(() => {
    loadQueueOperations();
  }, []);
  
  const getStatusIcon = (status: ValidationTest['status']) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4 text-gray-400" />;
      case 'running': return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'passed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Queue Persistence Validator</h2>
          <p className="text-gray-600">
            Validate offline queue functionality and IndexedDB persistence
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={addTestOperations}>
            <Plus className="h-4 w-4 mr-2" />
            Add Test Ops
          </Button>
          <Button variant="outline" onClick={clearQueue}>
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Queue
          </Button>
          <Button onClick={runValidationTests} disabled={isRunningTests}>
            {isRunningTests ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Activity className="h-4 w-4 mr-2" />
            )}
            {isRunningTests ? 'Running...' : 'Validate'}
          </Button>
        </div>
      </div>
      
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
          <TabsTrigger value="validation">Validation</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Queue Size</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{queueStats.size}</div>
                <p className="text-xs text-muted-foreground">
                  {queueStats.size === 0 ? 'Empty queue' : 'Operations queued'}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Oldest Operation</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold">
                  {queueStats.oldestOperation 
                    ? new Date(queueStats.oldestOperation).toLocaleTimeString()
                    : 'N/A'
                  }
                </div>
                <p className="text-xs text-muted-foreground">
                  {queueStats.oldestOperation 
                    ? `${Math.round((Date.now() - queueStats.oldestOperation.getTime()) / 1000)}s ago`
                    : 'No operations'
                  }
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Newest Operation</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold">
                  {queueStats.newestOperation 
                    ? new Date(queueStats.newestOperation).toLocaleTimeString()
                    : 'N/A'
                  }
                </div>
                <p className="text-xs text-muted-foreground">
                  {queueStats.newestOperation 
                    ? `${Math.round((Date.now() - queueStats.newestOperation.getTime()) / 1000)}s ago`
                    : 'No operations'
                  }
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Queue Health</CardTitle>
                {queueStats.size === 0 ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                )}
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold">
                  {queueStats.size === 0 ? 'Healthy' : 'Has Pending'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {queueStats.size === 0 ? 'No pending operations' : `${queueStats.size} pending`}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="operations" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Queued Operations</CardTitle>
              <Button variant="outline" size="sm" onClick={loadQueueOperations}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {queueOperations.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No operations in queue. Add test operations to see them here.
                </div>
              ) : (
                <div className="space-y-3">
                  {queueOperations.map((operation, index) => (
                    <div key={operation.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{operation.type}</Badge>
                        <div>
                          <div className="font-medium">{operation.url}</div>
                          <div className="text-sm text-gray-600">
                            Created: {new Date(operation.createdAt).toLocaleString()}
                          </div>
                          <div className="text-xs text-gray-400">
                            ID: {operation.id}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right text-sm">
                        {operation.data && (
                          <div className="text-gray-600">
                            {JSON.stringify(operation.data).slice(0, 50)}
                            {JSON.stringify(operation.data).length > 50 ? '...' : ''}
                          </div>
                        )}
                        <div className="text-xs text-gray-400 mt-1">
                          Key: {operation.idempotencyKey.slice(0, 8)}...
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="validation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Validation Tests</CardTitle>
              <p className="text-sm text-gray-600">
                Comprehensive testing of queue persistence functionality
              </p>
            </CardHeader>
            <CardContent>
              {validationTests.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Click "Validate" to run comprehensive queue persistence tests
                </div>
              ) : (
                <div className="space-y-3">
                  {validationTests.map((test, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(test.status)}
                        <div>
                          <div className="font-medium">{test.name}</div>
                          <div className="text-sm text-gray-600">{test.message}</div>
                          {test.duration && (
                            <div className="text-xs text-gray-400">
                              Duration: {test.duration.toFixed(0)}ms
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <Badge 
                        variant={test.status === 'passed' ? 'default' : 
                                test.status === 'failed' ? 'destructive' : 'secondary'}
                      >
                        {test.status}
                      </Badge>
                    </div>
                  ))}
                  
                  {!isRunningTests && validationTests.length > 0 && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <div className="text-sm">
                        <strong>Summary:</strong>{' '}
                        {validationTests.filter(t => t.status === 'passed').length} passed,{' '}
                        {validationTests.filter(t => t.status === 'failed').length} failed
                      </div>
                      <Progress 
                        value={(validationTests.filter(t => t.status === 'passed').length / validationTests.length) * 100}
                        className="mt-2"
                      />
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}