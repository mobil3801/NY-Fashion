
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Activity,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  TrendingUp,
  Settings,
  Download,
  Upload } from
'lucide-react';
import { useNetwork } from '@/contexts/NetworkContext';
import { format } from 'date-fns';

interface DiagnosticTest {
  name: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  duration?: number;
  error?: string;
  details?: any;
}

export function NetworkDiagnosticsPanel() {
  const {
    online,
    status,
    connectionState,
    getDiagnostics,
    retryNow,
    isAutoRetrying,
    forceOffline,
    forceOnline
  } = useNetwork();

  const [diagnostics, setDiagnostics] = useState(getDiagnostics());
  const [tests, setTests] = useState<DiagnosticTest[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setDiagnostics(getDiagnostics());
    }, 1000);

    return () => clearInterval(interval);
  }, [getDiagnostics]);

  const runDiagnosticTests = async () => {
    setIsRunningTests(true);
    const testSuite: DiagnosticTest[] = [
    { name: 'DNS Resolution', status: 'pending' },
    { name: 'HTTP Connectivity', status: 'pending' },
    { name: 'HTTPS Connectivity', status: 'pending' },
    { name: 'API Endpoint', status: 'pending' },
    { name: 'WebSocket Support', status: 'pending' },
    { name: 'Local Storage', status: 'pending' },
    { name: 'IndexedDB', status: 'pending' }];


    setTests([...testSuite]);

    // Run tests sequentially
    for (let i = 0; i < testSuite.length; i++) {
      const test = testSuite[i];
      test.status = 'running';
      setTests([...testSuite]);

      const startTime = performance.now();

      try {
        await runSingleTest(test.name);
        test.status = 'passed';
        test.duration = performance.now() - startTime;
      } catch (error) {
        test.status = 'failed';
        test.error = error instanceof Error ? error.message : 'Unknown error';
        test.duration = performance.now() - startTime;
      }

      setTests([...testSuite]);

      // Small delay between tests
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    setIsRunningTests(false);
  };

  const runSingleTest = async (testName: string): Promise<void> => {
    switch (testName) {
      case 'DNS Resolution':
        await fetch('https://dns.google', { method: 'HEAD', mode: 'no-cors' });
        break;

      case 'HTTP Connectivity':
        await fetch(`${window.location.protocol}//${window.location.host}/favicon.ico`, {
          method: 'HEAD',
          cache: 'no-cache'
        });
        break;

      case 'HTTPS Connectivity':
        if (window.location.protocol === 'https:') {
          await fetch(`${window.location.origin}/favicon.ico`, {
            method: 'HEAD',
            cache: 'no-cache'
          });
        } else {
          throw new Error('Not using HTTPS');
        }
        break;

      case 'API Endpoint':
        try {
          await window.ezsite?.apis?.getUserInfo?.();
        } catch (error) {












          // EasySite API might not be available or user not logged in
          // This is not necessarily a connection error
        }break;case 'WebSocket Support':if (!('WebSocket' in window)) {throw new Error('WebSocket not supported');}break;case 'Local Storage':localStorage.setItem('diagnostics_test', 'test');const value = localStorage.getItem('diagnostics_test');localStorage.removeItem('diagnostics_test');
        if (value !== 'test') {
          throw new Error('Local storage not working');
        }
        break;

      case 'IndexedDB':
        if (!('indexedDB' in window)) {
          throw new Error('IndexedDB not supported');
        }
        // Test basic IndexedDB functionality
        const dbRequest = indexedDB.open('diagnostics_test', 1);
        await new Promise((resolve, reject) => {
          dbRequest.onsuccess = () => {
            dbRequest.result.close();
            indexedDB.deleteDatabase('diagnostics_test');
            resolve(void 0);
          };
          dbRequest.onerror = () => reject(dbRequest.error);
          dbRequest.onupgradeneeded = () => {
            const db = dbRequest.result;
            db.createObjectStore('test');
          };
        });
        break;

      default:
        throw new Error('Unknown test');
    }
  };

  const getStatusColor = (status: DiagnosticTest['status']) => {
    switch (status) {
      case 'passed':return 'text-green-500';
      case 'failed':return 'text-red-500';
      case 'running':return 'text-blue-500';
      default:return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: DiagnosticTest['status']) => {
    switch (status) {
      case 'passed':return <CheckCircle className="w-4 h-4" />;
      case 'failed':return <AlertTriangle className="w-4 h-4" />;
      case 'running':return <RefreshCw className="w-4 h-4 animate-spin" />;
      default:return <Clock className="w-4 h-4" />;
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {online ?
          <Wifi className="w-5 h-5 text-green-500" /> :

          <WifiOff className="w-5 h-5 text-red-500" />
          }
          <h2 className="text-lg font-semibold">Network Diagnostics</h2>
          <Badge variant={online ? 'default' : 'destructive'}>
            {connectionState}
          </Badge>
        </div>
        
        <div className="flex gap-2">
          <Button
            onClick={runDiagnosticTests}
            disabled={isRunningTests}
            variant="outline"
            size="sm">

            {isRunningTests ?
            <RefreshCw className="w-4 h-4 animate-spin mr-2" /> :

            <Activity className="w-4 h-4 mr-2" />
            }
            Run Tests
          </Button>
          
          <Button
            onClick={online ? () => forceOffline('Diagnostic test') : forceOnline}
            variant="outline"
            size="sm">

            {online ? 'Force Offline' : 'Force Online'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="statistics">Statistics</TabsTrigger>
          <TabsTrigger value="tests">Diagnostic Tests</TabsTrigger>
          <TabsTrigger value="queue">Offline Queue</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                <span className="text-sm font-medium">Connection Quality</span>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold">
                  {online ? 'Good' : 'Offline'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {diagnostics.averageLatency > 0 ?
                  `${Math.round(diagnostics.averageLatency)}ms avg latency` :
                  'No latency data'
                  }
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm font-medium">Success Rate</span>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold">
                  {diagnostics.totalAttempts > 0 ?
                  `${Math.round(diagnostics.successfulAttempts / diagnostics.totalAttempts * 100)}%` :
                  'N/A'
                  }
                </div>
                <div className="text-xs text-muted-foreground">
                  {diagnostics.successfulAttempts} / {diagnostics.totalAttempts} requests
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4" />
                <span className="text-sm font-medium">Queued Operations</span>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold">
                  {diagnostics.queuedOperations}
                </div>
                <div className="text-xs text-muted-foreground">
                  Pending sync
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">Current Outage</span>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold">
                  {diagnostics.currentOutageMs > 0 ?
                  `${Math.round(diagnostics.currentOutageMs / 1000)}s` :
                  'N/A'
                  }
                </div>
                <div className="text-xs text-muted-foreground">
                  Longest: {Math.round(diagnostics.longestOutageMs / 1000)}s
                </div>
              </div>
            </Card>
          </div>

          <Card className="p-4">
            <h3 className="font-medium mb-3">Connection Timeline</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Last Status Change:</span>
                <span>{format(new Date(status.lastCheck), 'HH:mm:ss')}</span>
              </div>
              
              {diagnostics.lastConnectedAt &&
              <div className="flex justify-between">
                  <span>Last Connected:</span>
                  <span>{format(diagnostics.lastConnectedAt, 'HH:mm:ss')}</span>
                </div>
              }
              
              <div className="flex justify-between">
                <span>Consecutive Failures:</span>
                <span>{status.consecutiveFailures}</span>
              </div>
              
              {status.nextRetryAt &&
              <div className="flex justify-between">
                  <span>Next Retry:</span>
                  <span>{format(status.nextRetryAt, 'HH:mm:ss')}</span>
                </div>
              }
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="statistics" className="space-y-4">
          <Card className="p-4">
            <h3 className="font-medium mb-3">Performance Metrics</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Average Latency</span>
                  <span>{Math.round(diagnostics.averageLatency)}ms</span>
                </div>
                <Progress
                  value={Math.min(diagnostics.averageLatency / 1000 * 100, 100)}
                  className="h-2" />

              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Success Rate</span>
                  <span>
                    {diagnostics.totalAttempts > 0 ?
                    `${Math.round(diagnostics.successfulAttempts / diagnostics.totalAttempts * 100)}%` :
                    'N/A'
                    }
                  </span>
                </div>
                <Progress
                  value={diagnostics.totalAttempts > 0 ?
                  diagnostics.successfulAttempts / diagnostics.totalAttempts * 100 :
                  0
                  }
                  className="h-2" />

              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <h3 className="font-medium mb-3">Connection History</h3>
            <div className="text-sm space-y-2">
              <div className="flex justify-between">
                <span>Total Attempts:</span>
                <span>{diagnostics.totalAttempts}</span>
              </div>
              <div className="flex justify-between">
                <span>Successful Attempts:</span>
                <span>{diagnostics.successfulAttempts}</span>
              </div>
              <div className="flex justify-between">
                <span>Failed Attempts:</span>
                <span>{diagnostics.totalAttempts - diagnostics.successfulAttempts}</span>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="tests">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">Connectivity Tests</h3>
              <Button
                onClick={runDiagnosticTests}
                disabled={isRunningTests}
                size="sm">

                {isRunningTests ? 'Running...' : 'Run All Tests'}
              </Button>
            </div>
            
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {tests.map((test, index) =>
                <div
                  key={index}
                  className="flex items-center justify-between p-2 rounded border">

                    <div className="flex items-center gap-2">
                      <span className={getStatusColor(test.status)}>
                        {getStatusIcon(test.status)}
                      </span>
                      <span className="text-sm font-medium">{test.name}</span>
                    </div>
                    
                    <div className="text-right text-xs text-muted-foreground">
                      {test.duration &&
                    <div>{Math.round(test.duration)}ms</div>
                    }
                      {test.error &&
                    <div className="text-red-500 max-w-32 truncate">
                          {test.error}
                        </div>
                    }
                    </div>
                  </div>
                )}
                
                {tests.length === 0 &&
                <div className="text-center py-8 text-muted-foreground">
                    Click "Run All Tests" to start diagnostics
                  </div>
                }
              </div>
            </ScrollArea>
          </Card>
        </TabsContent>

        <TabsContent value="queue">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">Offline Queue Status</h3>
              <Badge variant="outline">
                {diagnostics.queuedOperations} operations
              </Badge>
            </div>
            
            <div className="space-y-4">
              <div className="text-sm">
                <p className="text-muted-foreground">
                  Operations are automatically queued when offline and synced when connectivity is restored.
                </p>
              </div>
              
              {diagnostics.queuedOperations > 0 &&
              <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Upload className="w-4 h-4" />
                    <span>{diagnostics.queuedOperations} operations pending sync</span>
                  </div>
                  
                  {online &&
                <Button
                  onClick={retryNow}
                  disabled={isAutoRetrying}
                  size="sm"
                  className="w-full">

                      {isAutoRetrying ? 'Syncing...' : 'Sync Now'}
                    </Button>
                }
                </div>
              }
              
              {diagnostics.queuedOperations === 0 &&
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>All operations are up to date</span>
                </div>
              }
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>);

}