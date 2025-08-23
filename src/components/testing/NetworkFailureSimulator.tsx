import React, { useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Wifi,
  WifiOff,
  AlertTriangle,
  Clock,
  Zap,
  Network,
  Play,
  Square } from
'lucide-react';
import { toast } from 'sonner';

interface NetworkCondition {
  id: string;
  name: string;
  description: string;
  latency: number; // ms
  bandwidth: number; // kbps
  packetLoss: number; // percentage
  jitter: number; // ms
  active: boolean;
}

interface SimulationResult {
  id: string;
  condition: string;
  operation: string;
  status: 'success' | 'failure' | 'timeout' | 'degraded';
  duration: number;
  error?: string;
  timestamp: string;
}

const NetworkFailureSimulator: React.FC = () => {
  const [isSimulating, setIsSimulating] = useState(false);
  const [currentCondition, setCurrentCondition] = useState<NetworkCondition | null>(null);
  const [results, setResults] = useState<SimulationResult[]>([]);
  const [customCondition, setCustomCondition] = useState<NetworkCondition>({
    id: 'custom',
    name: 'Custom',
    description: 'Custom network condition',
    latency: 100,
    bandwidth: 1000,
    packetLoss: 0,
    jitter: 10,
    active: false
  });

  const originalFetch = useRef<typeof window.fetch>();
  const simulationId = useRef<string>();

  const predefinedConditions: NetworkCondition[] = [
  {
    id: 'good-3g',
    name: 'Good 3G',
    description: 'Good 3G connection (1.6Mbps, 300ms latency)',
    latency: 300,
    bandwidth: 1600,
    packetLoss: 0,
    jitter: 50,
    active: false
  },
  {
    id: 'slow-3g',
    name: 'Slow 3G',
    description: 'Slow 3G connection (400kbps, 400ms latency)',
    latency: 400,
    bandwidth: 400,
    packetLoss: 1,
    jitter: 100,
    active: false
  },
  {
    id: 'offline',
    name: 'Offline',
    description: 'Complete network failure',
    latency: 0,
    bandwidth: 0,
    packetLoss: 100,
    jitter: 0,
    active: false
  },
  {
    id: 'unstable',
    name: 'Unstable Connection',
    description: 'High packet loss and variable latency',
    latency: 200,
    bandwidth: 1000,
    packetLoss: 10,
    jitter: 200,
    active: false
  },
  {
    id: 'high-latency',
    name: 'High Latency',
    description: 'Satellite-like connection with high latency',
    latency: 800,
    bandwidth: 2000,
    packetLoss: 0,
    jitter: 100,
    active: false
  }];


  const testOperations = [
  {
    name: 'Database Query',
    executor: () => window.ezsite.apis.tablePage(36848, { PageNo: 1, PageSize: 10 })
  },
  {
    name: 'User Authentication',
    executor: () => window.ezsite.apis.getUserInfo()
  },
  {
    name: 'File Upload',
    executor: async () => {
      const testFile = new File(['test'], 'test.txt', { type: 'text/plain' });
      return window.ezsite.apis.upload({ filename: 'network-test.txt', file: testFile });
    }
  },
  {
    name: 'Large Dataset',
    executor: () => window.ezsite.apis.tablePage(36848, { PageNo: 1, PageSize: 100 })
  },
  {
    name: 'API Health Check',
    executor: () => window.ezsite.apis.run({ path: 'healthCheck.js', param: [] })
  }];


  const simulateNetworkCondition = useCallback((condition: NetworkCondition) => {
    if (!originalFetch.current) {
      originalFetch.current = window.fetch;
    }

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      if (!condition.active) {
        return originalFetch.current!(input, init);
      }

      // Simulate offline condition
      if (condition.packetLoss >= 100) {
        throw new Error('Network request failed - offline');
      }

      // Simulate packet loss
      if (Math.random() * 100 < condition.packetLoss) {
        throw new Error('Network request failed - packet loss');
      }

      // Add latency simulation
      const actualLatency = condition.latency + Math.random() * condition.jitter;
      await new Promise((resolve) => setTimeout(resolve, actualLatency));

      try {
        const response = await originalFetch.current!(input, init);

        // Simulate bandwidth limitations for response reading
        if (condition.bandwidth > 0 && response.body) {
          const originalJson = response.json.bind(response);
          response.json = async () => {
            // Simulate slower data transfer
            const delay = Math.max(0, 1000 / (condition.bandwidth / 8)); // bytes per ms
            await new Promise((resolve) => setTimeout(resolve, delay));
            return originalJson();
          };
        }

        return response;
      } catch (error) {
        // Add some randomness to timeouts based on network condition
        if (condition.latency > 500 && Math.random() > 0.8) {
          throw new Error('Request timeout');
        }
        throw error;
      }
    };
  }, []);

  const restoreNetworkCondition = useCallback(() => {
    if (originalFetch.current) {
      window.fetch = originalFetch.current;
    }
    setCurrentCondition(null);
  }, []);

  const startSimulation = useCallback(async (condition: NetworkCondition) => {
    setIsSimulating(true);
    setCurrentCondition(condition);
    simulationId.current = `sim-${Date.now()}`;

    // Apply network condition
    const activeCondition = { ...condition, active: true };
    simulateNetworkCondition(activeCondition);

    toast.info(`Started network simulation: ${condition.name}`);

    // Run test operations
    const testResults: SimulationResult[] = [];

    for (const operation of testOperations) {
      const startTime = performance.now();

      try {
        await operation.executor();
        const duration = performance.now() - startTime;

        const status = duration > 5000 ? 'degraded' : 'success';

        testResults.push({
          id: `${simulationId.current}-${operation.name}`,
          condition: condition.name,
          operation: operation.name,
          status,
          duration,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        const duration = performance.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);

        let status: SimulationResult['status'] = 'failure';
        if (errorMessage.includes('timeout')) status = 'timeout';

        testResults.push({
          id: `${simulationId.current}-${operation.name}`,
          condition: condition.name,
          operation: operation.name,
          status,
          duration,
          error: errorMessage,
          timestamp: new Date().toISOString()
        });
      }

      // Small delay between operations
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    setResults((prev) => [...prev, ...testResults]);

    const successful = testResults.filter((r) => r.status === 'success').length;
    const failed = testResults.filter((r) => r.status === 'failure').length;
    const degraded = testResults.filter((r) => r.status === 'degraded').length;

    toast.success(
      `Simulation completed: ${successful} successful, ${degraded} degraded, ${failed} failed`
    );
  }, [simulateNetworkCondition]);

  const stopSimulation = useCallback(() => {
    setIsSimulating(false);
    restoreNetworkCondition();
    toast.info('Network simulation stopped');
  }, [restoreNetworkCondition]);

  const getStatusIcon = (status: SimulationResult['status']) => {
    switch (status) {
      case 'success':
        return <Zap className="h-4 w-4 text-green-500" />;
      case 'degraded':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'timeout':
        return <Clock className="h-4 w-4 text-orange-500" />;
      case 'failure':
        return <WifiOff className="h-4 w-4 text-red-500" />;
      default:
        return <Network className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: SimulationResult['status']) => {
    switch (status) {
      case 'success':return 'text-green-600 bg-green-50';
      case 'degraded':return 'text-yellow-600 bg-yellow-50';
      case 'timeout':return 'text-orange-600 bg-orange-50';
      case 'failure':return 'text-red-600 bg-red-50';
      default:return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Network Failure Simulator</h2>
          <p className="text-muted-foreground">
            Test application behavior under various network conditions
          </p>
        </div>
        
        {currentCondition &&
        <div className="flex items-center gap-2">
            <Badge className="gap-1">
              <Network className="h-3 w-3" />
              {currentCondition.name} Active
            </Badge>
            <Button
            variant="destructive"
            onClick={stopSimulation}
            className="gap-2">

              <Square className="h-4 w-4" />
              Stop Simulation
            </Button>
          </div>
        }
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Network Conditions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {predefinedConditions.map((condition) =>
              <Card key={condition.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{condition.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {condition.description}
                      </p>
                      <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
                        <span>Latency: {condition.latency}ms</span>
                        <span>Bandwidth: {condition.bandwidth}kbps</span>
                        <span>Loss: {condition.packetLoss}%</span>
                      </div>
                    </div>
                    <Button
                    onClick={() => startSimulation(condition)}
                    disabled={isSimulating}
                    size="sm"
                    className="gap-2">

                      <Play className="h-3 w-3" />
                      Test
                    </Button>
                  </div>
                </Card>
              )}
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Custom Condition</h4>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm">Latency: {customCondition.latency}ms</Label>
                  <Slider
                    value={[customCondition.latency]}
                    onValueChange={([value]) =>
                    setCustomCondition((prev) => ({ ...prev, latency: value }))
                    }
                    max={2000}
                    step={10}
                    className="mt-2" />

                </div>
                
                <div>
                  <Label className="text-sm">Bandwidth: {customCondition.bandwidth}kbps</Label>
                  <Slider
                    value={[customCondition.bandwidth]}
                    onValueChange={([value]) =>
                    setCustomCondition((prev) => ({ ...prev, bandwidth: value }))
                    }
                    max={10000}
                    step={100}
                    className="mt-2" />

                </div>
                
                <div>
                  <Label className="text-sm">Packet Loss: {customCondition.packetLoss}%</Label>
                  <Slider
                    value={[customCondition.packetLoss]}
                    onValueChange={([value]) =>
                    setCustomCondition((prev) => ({ ...prev, packetLoss: value }))
                    }
                    max={100}
                    step={1}
                    className="mt-2" />

                </div>

                <Button
                  onClick={() => startSimulation(customCondition)}
                  disabled={isSimulating}
                  className="w-full gap-2">

                  <Play className="h-4 w-4" />
                  Test Custom Condition
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            {results.length === 0 ?
            <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  No test results available. Run a network simulation to see results.
                </AlertDescription>
              </Alert> :

            <div className="space-y-3 max-h-96 overflow-y-auto">
                {results.slice(-20).reverse().map((result) =>
              <Card key={result.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(result.status)}
                        <div>
                          <p className="font-medium text-sm">{result.operation}</p>
                          <p className="text-xs text-muted-foreground">
                            {result.condition} • {Math.round(result.duration)}ms
                          </p>
                        </div>
                      </div>
                      <Badge className={`text-xs ${getStatusColor(result.status)}`}>
                        {result.status}
                      </Badge>
                    </div>
                    {result.error &&
                <Alert className="mt-2" variant="destructive">
                        <AlertDescription className="text-xs">
                          {result.error}
                        </AlertDescription>
                      </Alert>
                }
                  </Card>
              )}
              </div>
            }
          </CardContent>
        </Card>
      </div>

      {isSimulating &&
      <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="animate-pulse">
                <Network className="h-5 w-5 text-blue-500" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Network simulation in progress...</p>
                <p className="text-sm text-muted-foreground">
                  Testing application behavior under {currentCondition?.name} conditions
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      }
    </div>);

};

export default NetworkFailureSimulator;