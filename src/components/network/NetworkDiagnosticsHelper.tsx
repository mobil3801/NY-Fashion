import React, { useState, useEffect, useCallback, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  Globe,
  Server,
  Database } from
'lucide-react';
import { useNetwork } from '@/contexts/NetworkContext';
import { toast } from '@/hooks/use-toast';

interface NetworkDiagnosticsProps {
  networkId?: string;
  diagnosticMode?: 'active' | 'passive';
}

interface DiagnosticResult {
  test: string;
  status: 'pending' | 'success' | 'warning' | 'error';
  message: string;
  latency?: number;
  details?: any;
}

interface DiagnosticSummary {
  total: number;
  passed: number;
  failed: number;
  warnings: number;
}

const NetworkDiagnosticsHelper: React.FC<NetworkDiagnosticsProps> = memo(({
  networkId,
  diagnosticMode = 'passive'
}: NetworkDiagnosticsProps) => {
  const {
    online,
    connectionState,
    retryNow,
    getDiagnostics,
    status,
    errorDetails
  } = useNetwork();

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [summary, setSummary] = useState<DiagnosticSummary>({
    total: 0,
    passed: 0,
    failed: 0,
    warnings: 0
  });

  // Create abort controller for requests with enhanced error handling
  const createAbortController = useCallback((timeoutMs: number): {controller: AbortController;timeoutId: NodeJS.Timeout;} => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        try {
          controller.abort();
        } catch (error) {
          console.error('Error aborting request:', error);
        }
      }, timeoutMs);
      return { controller, timeoutId };
    } catch (error) {
      console.error('Error creating abort controller:', error);
      // Fallback controller
      return {
        controller: new AbortController(),
        timeoutId: setTimeout(() => {}, 0)
      };
    }
  }, []);

  // Test basic connectivity with enhanced error handling
  const testBasicConnectivity = useCallback(async (): Promise<DiagnosticResult> => {
    const startTime = performance.now();
    let controller: AbortController;
    let timeoutId: NodeJS.Timeout;

    try {
      const { controller: abortController, timeoutId: abortTimeoutId } = createAbortController(5000);
      controller = abortController;
      timeoutId = abortTimeoutId;

      const response = await fetch(window.location.origin, {
        method: 'HEAD',
        cache: 'no-cache',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const latency = Math.round(performance.now() - startTime);

      if (response.ok) {
        return {
          test: 'Basic Connectivity',
          status: 'success',
          message: 'Successfully connected to the application server',
          latency
        };
      } else {
        return {
          test: 'Basic Connectivity',
          status: 'warning',
          message: `Server responded with status ${response.status}`,
          latency
        };
      }
    } catch (error: any) {
      try {
        if (timeoutId!) clearTimeout(timeoutId!);
      } catch (clearError) {
        console.error('Error clearing timeout:', clearError);
      }

      const latency = Math.round(performance.now() - startTime);
      console.error('Basic connectivity test failed:', error);

      return {
        test: 'Basic Connectivity',
        status: 'error',
        message: error.message || 'Failed to connect to server',
        latency,
        details: error
      };
    }
  }, [createAbortController]);

  // Test API endpoint with enhanced error handling
  const testApiEndpoint = useCallback(async (): Promise<DiagnosticResult> => {
    const startTime = performance.now();

    try {
      // Test a simple API endpoint
      const { data, error } = await window.ezsite.apis.run({
        path: "getCategories",
        param: [{ limit: 1 }]
      });

      const latency = Math.round(performance.now() - startTime);

      if (error) {
        console.error('API endpoint test error:', error);
        return {
          test: 'API Endpoint',
          status: 'error',
          message: `API error: ${error}`,
          latency,
          details: { error }
        };
      }

      return {
        test: 'API Endpoint',
        status: 'success',
        message: 'API endpoints are responding correctly',
        latency,
        details: { responseLength: Array.isArray(data) ? data.length : 'unknown' }
      };
    } catch (error: any) {
      const latency = Math.round(performance.now() - startTime);
      console.error('API endpoint test failed:', error);

      return {
        test: 'API Endpoint',
        status: 'error',
        message: error.message || 'API request failed',
        latency,
        details: error
      };
    }
  }, []);

  // Test DNS resolution with enhanced error handling
  const testDNSResolution = useCallback(async (): Promise<DiagnosticResult> => {
    const startTime = performance.now();
    let controller: AbortController;
    let timeoutId: NodeJS.Timeout;

    try {
      const { controller: abortController, timeoutId: abortTimeoutId } = createAbortController(3000);
      controller = abortController;
      timeoutId = abortTimeoutId;

      // Test DNS resolution by fetching a known external resource
      const response = await fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const latency = Math.round(performance.now() - startTime);

      return {
        test: 'DNS Resolution',
        status: 'success',
        message: 'DNS resolution is working correctly',
        latency
      };
    } catch (error: any) {
      try {
        if (timeoutId!) clearTimeout(timeoutId!);
      } catch (clearError) {
        console.error('Error clearing timeout:', clearError);
      }

      const latency = Math.round(performance.now() - startTime);
      console.error('DNS resolution test failed:', error);

      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        return {
          test: 'DNS Resolution',
          status: 'warning',
          message: 'DNS resolution is slow but working',
          latency
        };
      }

      return {
        test: 'DNS Resolution',
        status: 'error',
        message: 'DNS resolution failed - check internet connection',
        latency,
        details: error
      };
    }
  }, [createAbortController]);

  // Test inventory API with enhanced error handling
  const testInventoryAPI = useCallback(async (): Promise<DiagnosticResult> => {
    const startTime = performance.now();

    try {
      // Test the specific inventory API
      const { data, error } = await window.ezsite.apis.run({
        path: "getProducts",
        param: [{ limit: 5 }]
      });

      const latency = Math.round(performance.now() - startTime);

      if (error) {
        console.error('Inventory API test error:', error);
        return {
          test: 'Inventory API',
          status: 'error',
          message: `Inventory API error: ${error}`,
          latency,
          details: { error }
        };
      }

      const products = Array.isArray(data) ? data : [];
      return {
        test: 'Inventory API',
        status: 'success',
        message: `Successfully fetched ${products.length} products`,
        latency,
        details: { productCount: products.length }
      };
    } catch (error: any) {
      const latency = Math.round(performance.now() - startTime);
      console.error('Inventory API test failed:', error);

      return {
        test: 'Inventory API',
        status: 'error',
        message: error.message || 'Inventory API request failed',
        latency,
        details: error
      };
    }
  }, []);

  // Test low stock API with enhanced error handling
  const testLowStockAPI = useCallback(async (): Promise<DiagnosticResult> => {
    const startTime = performance.now();

    try {
      const { data, error } = await window.ezsite.apis.run({
        path: "getLowStockProducts",
        param: [{ limit: 10 }]
      });

      const latency = Math.round(performance.now() - startTime);

      if (error) {
        console.error('Low stock API test error:', error);
        return {
          test: 'Low Stock API',
          status: 'error',
          message: `Low Stock API error: ${error}`,
          latency,
          details: { error }
        };
      }

      const products = Array.isArray(data) ? data : [];
      return {
        test: 'Low Stock API',
        status: 'success',
        message: `Successfully fetched ${products.length} low stock alerts`,
        latency,
        details: { lowStockCount: products.length }
      };
    } catch (error: any) {
      const latency = Math.round(performance.now() - startTime);
      console.error('Low stock API test failed:', error);

      return {
        test: 'Low Stock API',
        status: 'error',
        message: error.message || 'Low Stock API request failed',
        latency,
        details: error
      };
    }
  }, []);

  // Run all diagnostic tests with enhanced error handling
  const runDiagnostics = useCallback(async (): Promise<void> => {
    try {
      setIsRunning(true);
      setResults([]);

      const tests: (() => Promise<DiagnosticResult>)[] = [
      testBasicConnectivity,
      testDNSResolution,
      testApiEndpoint,
      testInventoryAPI,
      testLowStockAPI];


      const testResults: DiagnosticResult[] = [];

      for (const test of tests) {
        try {
          const result = await test();
          testResults.push(result);
          setResults([...testResults]); // Update UI after each test
        } catch (error: any) {
          console.error(`Test ${test.name || 'Unknown Test'} failed:`, error);
          testResults.push({
            test: test.name || 'Unknown Test',
            status: 'error',
            message: error.message || 'Test failed unexpectedly',
            details: error
          });
          setResults([...testResults]);
        }
      }

      // Calculate summary
      const total = testResults.length;
      const passed = testResults.filter((r) => r.status === 'success').length;
      const warnings = testResults.filter((r) => r.status === 'warning').length;
      const failed = testResults.filter((r) => r.status === 'error').length;

      setSummary({ total, passed, warnings, failed });

      // Show summary toast
      try {
        if (failed === 0 && warnings === 0) {
          toast({
            title: "All Tests Passed",
            description: "Network connectivity is working properly",
            variant: "default"
          });
        } else if (failed > 0) {
          toast({
            title: "Connection Issues Detected",
            description: `${failed} tests failed, ${warnings} warnings`,
            variant: "destructive"
          });
        } else {
          toast({
            title: "Minor Issues Detected",
            description: `${warnings} warnings found`,
            variant: "default"
          });
        }
      } catch (toastError) {
        console.error('Error showing toast notification:', toastError);
      }
    } catch (error) {
      console.error('Error running diagnostics:', error);
    } finally {
      setIsRunning(false);
    }
  }, [testBasicConnectivity, testDNSResolution, testApiEndpoint, testInventoryAPI, testLowStockAPI]);

  // Auto-run diagnostics on first load if there are connection issues
  useEffect(() => {
    try {
      if (diagnosticMode === 'active' || !online || connectionState === 'offline' || errorDetails) {
        // Wait a bit before running to allow component to settle
        const timer = setTimeout(() => {
          runDiagnostics().catch((error) => {
            console.error('Error auto-running diagnostics:', error);
          });
        }, 1000);
        return () => clearTimeout(timer);
      }
    } catch (error) {
      console.error('Error setting up auto-diagnostics:', error);
    }
  }, [online, connectionState, errorDetails, runDiagnostics, diagnosticMode]);

  // Status icon helper with error handling
  const getStatusIcon = useCallback((status: DiagnosticResult['status']): JSX.Element => {
    try {
      switch (status) {
        case 'success':
          return <CheckCircle className="h-4 w-4 text-green-600" />;
        case 'warning':
          return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
        case 'error':
          return <XCircle className="h-4 w-4 text-red-600" />;
        default:
          return <Clock className="h-4 w-4 text-gray-400" />;
      }
    } catch (error) {
      console.error('Error getting status icon:', error);
      return <Clock className="h-4 w-4 text-gray-400" />;
    }
  }, []);

  // Status badge helper with error handling
  const getStatusBadge = useCallback((status: DiagnosticResult['status']): JSX.Element => {
    try {
      const badgeProps = {
        className: "text-xs"
      };

      switch (status) {
        case 'success':
          return <Badge {...badgeProps} className="badge-success-aa">Passed</Badge>;
        case 'warning':
          return <Badge {...badgeProps} className="badge-warning-aa">Warning</Badge>;
        case 'error':
          return <Badge {...badgeProps} className="badge-error-aa">Failed</Badge>;
        default:
          return <Badge {...badgeProps} className="badge-neutral-aa">Pending</Badge>;
      }
    } catch (error) {
      console.error('Error getting status badge:', error);
      return <Badge className="text-xs badge-neutral-aa">Unknown</Badge>;
    }
  }, []);

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Network Diagnostics
          {networkId &&
          <Badge variant="outline" className="text-xs">
              ID: {networkId}
            </Badge>
          }
          <Badge variant="outline" className="text-xs">
            Mode: {diagnosticMode}
          </Badge>
        </CardTitle>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Badge className={`${online ? 'badge-success-aa' : 'badge-error-aa'}`}>
              {online ? <Wifi className="h-3 w-3 mr-1" /> : <WifiOff className="h-3 w-3 mr-1" />}
              {online ? 'Online' : 'Offline'}
            </Badge>
            <Badge className="badge-neutral-aa">
              Connection: {connectionState}
            </Badge>
          </div>
          <Button
            onClick={runDiagnostics}
            disabled={isRunning}
            size="sm">

            {isRunning ?
            <React.Fragment>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Running...
              </React.Fragment> :

            <React.Fragment>
                <RefreshCw className="h-4 w-4 mr-2" />
                Run Diagnostics
              </React.Fragment>
            }
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="results" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="results">Test Results</TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="details">Network Details</TabsTrigger>
          </TabsList>

          <TabsContent value="results" className="space-y-4">
            {results.length === 0 && !isRunning &&
            <div className="text-center py-8">
                <Globe className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium mb-2">Ready to Test</h3>
                <p className="text-gray-600 mb-4">
                  Click "Run Diagnostics" to test your network connectivity
                </p>
                <Button onClick={runDiagnostics}>
                  <Activity className="h-4 w-4 mr-2" />
                  Start Diagnostics
                </Button>
              </div>
            }

            {(results.length > 0 || isRunning) &&
            <div className="space-y-3">
                {results.map((result, index) =>
              <Card key={index} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(result.status)}
                        <div>
                          <h4 className="font-medium">{result.test}</h4>
                          <p className="text-sm text-gray-600">{result.message}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {result.latency &&
                    <Badge variant="outline" className="text-xs">
                            {result.latency}ms
                          </Badge>
                    }
                        {getStatusBadge(result.status)}
                      </div>
                    </div>
                  </Card>
              )}
              </div>
            }
          </TabsContent>

          <TabsContent value="summary" className="space-y-4">
            {summary.total > 0 &&
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">{summary.total}</div>
                  <div className="text-sm text-gray-600">Total Tests</div>
                </Card>
                <Card className="p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">{summary.passed}</div>
                  <div className="text-sm text-gray-600">Passed</div>
                </Card>
                <Card className="p-4 text-center">
                  <div className="text-2xl font-bold text-yellow-600">{summary.warnings}</div>
                  <div className="text-sm text-gray-600">Warnings</div>
                </Card>
                <Card className="p-4 text-center">
                  <div className="text-2xl font-bold text-red-600">{summary.failed}</div>
                  <div className="text-sm text-gray-600">Failed</div>
                </Card>
              </div>
            }

            {summary.total > 0 &&
            <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Overall Health</span>
                  <span>{Math.round(summary.passed / summary.total * 100)}%</span>
                </div>
                <Progress
                value={summary.passed / summary.total * 100}
                className="h-2" />

              </div>
            }
          </TabsContent>

          <TabsContent value="details" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-4">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Server className="h-4 w-4" />
                  Connection Status
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Online Status:</span>
                    <span className={online ? 'text-green-600' : 'text-red-600'}>
                      {online ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Connection State:</span>
                    <span>{connectionState}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Consecutive Failures:</span>
                    <span>{status?.consecutiveFailures || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Last Check:</span>
                    <span>{status?.lastCheck ? new Date(status.lastCheck).toLocaleTimeString() : 'Never'}</span>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Error Information
                </h4>
                <div className="space-y-2 text-sm">
                  {errorDetails ?
                  <React.Fragment>
                      <div className="flex justify-between">
                        <span>Error Type:</span>
                        <span className="text-red-600">{errorDetails.type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Retryable:</span>
                        <span>{errorDetails.isRetryable ? 'Yes' : 'No'}</span>
                      </div>
                      <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                        {errorDetails.userMessage}
                      </div>
                    </React.Fragment> :

                  <div className="text-gray-600">No current errors</div>
                  }
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>);

});

NetworkDiagnosticsHelper.displayName = 'NetworkDiagnosticsHelper';

export default NetworkDiagnosticsHelper;