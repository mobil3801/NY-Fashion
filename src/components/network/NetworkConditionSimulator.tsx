import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { apiClient } from '@/lib/network/client';
import { useToast } from '@/hooks/use-toast';
import {
  Wifi,
  WifiOff,
  Signal,
  SignalLow,
  SignalMedium,
  SignalHigh,
  Timer,
  Zap,
  AlertTriangle } from
'lucide-react';

interface NetworkCondition {
  name: string;
  description: string;
  online: boolean;
  latency: number;
  packetLoss: number;
  bandwidth: number;
  icon: React.ReactNode;
}

const NETWORK_CONDITIONS: NetworkCondition[] = [
{
  name: 'Online - Fast',
  description: 'High-speed broadband connection',
  online: true,
  latency: 10,
  packetLoss: 0,
  bandwidth: 100,
  icon: <SignalHigh className="h-4 w-4" />
},
{
  name: 'Online - Good',
  description: 'Standard broadband connection',
  online: true,
  latency: 50,
  packetLoss: 1,
  bandwidth: 25,
  icon: <SignalMedium className="h-4 w-4" />
},
{
  name: 'Online - Slow',
  description: 'Slow mobile or poor WiFi',
  online: true,
  latency: 200,
  packetLoss: 5,
  bandwidth: 5,
  icon: <SignalLow className="h-4 w-4" />
},
{
  name: 'Online - Unstable',
  description: 'Intermittent connectivity issues',
  online: true,
  latency: 500,
  packetLoss: 15,
  bandwidth: 2,
  icon: <Signal className="h-4 w-4" />
},
{
  name: 'Offline',
  description: 'No network connectivity',
  online: false,
  latency: 0,
  packetLoss: 100,
  bandwidth: 0,
  icon: <WifiOff className="h-4 w-4" />
}];


export default function NetworkConditionSimulator() {
  const [currentCondition, setCurrentCondition] = useState<NetworkCondition>(NETWORK_CONDITIONS[0]);
  const [customSettings, setCustomSettings] = useState({
    latency: 50,
    packetLoss: 0,
    bandwidth: 25,
    online: true
  });
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResults, setSimulationResults] = useState<any[]>([]);

  const { toast } = useToast();

  // Apply network condition
  const applyCondition = (condition: NetworkCondition) => {
    setCurrentCondition(condition);
    apiClient.setOnlineStatus(condition.online);

    // Simulate network characteristics by adding delays and failures
    const originalFetch = window.fetch;

    if (!condition.online) {
      // Simulate complete offline state
      window.fetch = async () => {
        throw new Error('Network Error: Simulated offline state');
      };
    } else {
      // Simulate network latency and packet loss
      window.fetch = async (input, init) => {
        // Add artificial delay based on latency
        await new Promise((resolve) => setTimeout(resolve, condition.latency));

        // Simulate packet loss
        if (Math.random() * 100 < condition.packetLoss) {
          throw new Error(`Network Error: Simulated packet loss (${condition.packetLoss}%)`);
        }

        // Call original fetch
        return originalFetch(input, init);
      };
    }

    toast({
      title: 'Network Condition Applied',
      description: `Simulating: ${condition.name}`,
      variant: condition.online ? 'default' : 'destructive'
    });
  };

  // Apply custom settings
  const applyCustomSettings = () => {
    const customCondition: NetworkCondition = {
      name: 'Custom',
      description: `Custom: ${customSettings.latency}ms latency, ${customSettings.packetLoss}% loss`,
      online: customSettings.online,
      latency: customSettings.latency,
      packetLoss: customSettings.packetLoss,
      bandwidth: customSettings.bandwidth,
      icon: customSettings.online ? <Zap className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />
    };

    applyCondition(customCondition);
    setCurrentCondition(customCondition);
  };

  // Run network simulation test
  const runSimulationTest = async () => {
    setIsSimulating(true);
    setSimulationResults([]);

    const results = [];

    for (const condition of NETWORK_CONDITIONS) {
      const testResult = {
        condition: condition.name,
        startTime: Date.now(),
        requests: [],
        averageLatency: 0,
        successRate: 0,
        errors: []
      };

      // Apply condition
      applyCondition(condition);
      await new Promise((resolve) => setTimeout(resolve, 500)); // Wait for condition to apply

      // Run test requests
      const testRequests = [];
      for (let i = 0; i < 10; i++) {
        const requestStart = performance.now();

        testRequests.push(
          fetch(`/api/test-endpoint?test=${i}`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000)
          }).
          then(() => {
            const duration = performance.now() - requestStart;
            testResult.requests.push({ success: true, duration });
            return { success: true, duration };
          }).
          catch((error) => {
            const duration = performance.now() - requestStart;
            testResult.requests.push({ success: false, duration, error: error.message });
            testResult.errors.push(error.message);
            return { success: false, duration, error: error.message };
          })
        );
      }

      const requestResults = await Promise.allSettled(testRequests);

      // Calculate metrics
      const successful = testResult.requests.filter((r) => r.success);
      testResult.successRate = successful.length / testResult.requests.length * 100;
      testResult.averageLatency = successful.length > 0 ?
      successful.reduce((sum, r) => sum + r.duration, 0) / successful.length :
      0;

      results.push(testResult);
      setSimulationResults([...results]);
    }

    // Reset to default condition
    applyCondition(NETWORK_CONDITIONS[0]);
    setIsSimulating(false);

    toast({
      title: 'Simulation Complete',
      description: `Tested ${NETWORK_CONDITIONS.length} network conditions`,
      variant: 'default'
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            Network Condition Simulator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Status */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              {currentCondition.icon}
              <div>
                <div className="font-medium">{currentCondition.name}</div>
                <div className="text-sm text-gray-600">{currentCondition.description}</div>
              </div>
            </div>
            <Badge variant={currentCondition.online ? 'default' : 'destructive'}>
              {currentCondition.online ? 'Online' : 'Offline'}
            </Badge>
          </div>
          
          {/* Preset Conditions */}
          <div>
            <Label className="text-base font-medium">Preset Conditions</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
              {NETWORK_CONDITIONS.map((condition, index) =>
              <Button
                key={index}
                variant={currentCondition.name === condition.name ? 'default' : 'outline'}
                className="h-auto p-3 justify-start"
                onClick={() => applyCondition(condition)}>

                  <div className="flex items-center gap-2 w-full">
                    {condition.icon}
                    <div className="text-left">
                      <div className="font-medium text-sm">{condition.name}</div>
                      <div className="text-xs opacity-70">
                        {condition.online ?
                      `${condition.latency}ms, ${condition.packetLoss}% loss` :
                      'No connectivity'
                      }
                      </div>
                    </div>
                  </div>
                </Button>
              )}
            </div>
          </div>
          
          {/* Custom Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Custom Settings</Label>
              <Switch
                checked={isCustomMode}
                onCheckedChange={setIsCustomMode} />

            </div>
            
            {isCustomMode &&
            <div className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <Label>Online Status</Label>
                  <Switch
                  checked={customSettings.online}
                  onCheckedChange={(online) =>
                  setCustomSettings((prev) => ({ ...prev, online }))
                  } />

                </div>
                
                {customSettings.online &&
              <>
                    <div>
                      <Label>Latency: {customSettings.latency}ms</Label>
                      <Slider
                    value={[customSettings.latency]}
                    onValueChange={([latency]) =>
                    setCustomSettings((prev) => ({ ...prev, latency }))
                    }
                    max={1000}
                    min={0}
                    step={10}
                    className="mt-2" />

                    </div>
                    
                    <div>
                      <Label>Packet Loss: {customSettings.packetLoss}%</Label>
                      <Slider
                    value={[customSettings.packetLoss]}
                    onValueChange={([packetLoss]) =>
                    setCustomSettings((prev) => ({ ...prev, packetLoss }))
                    }
                    max={50}
                    min={0}
                    step={1}
                    className="mt-2" />

                    </div>
                    
                    <div>
                      <Label>Bandwidth: {customSettings.bandwidth}Mbps</Label>
                      <Slider
                    value={[customSettings.bandwidth]}
                    onValueChange={([bandwidth]) =>
                    setCustomSettings((prev) => ({ ...prev, bandwidth }))
                    }
                    max={100}
                    min={1}
                    step={1}
                    className="mt-2" />

                    </div>
                  </>
              }
                
                <Button onClick={applyCustomSettings} className="w-full">
                  Apply Custom Settings
                </Button>
              </div>
            }
          </div>
          
          {/* Simulation Test */}
          <div className="space-y-4">
            <Button
              onClick={runSimulationTest}
              disabled={isSimulating}
              className="w-full"
              size="lg">

              {isSimulating ?
              <Timer className="h-4 w-4 mr-2 animate-pulse" /> :

              <Zap className="h-4 w-4 mr-2" />
              }
              {isSimulating ? 'Running Simulation...' : 'Run Full Network Simulation'}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Simulation Results */}
      {simulationResults.length > 0 &&
      <Card>
          <CardHeader>
            <CardTitle>Simulation Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {simulationResults.map((result, index) =>
            <div key={index} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium">{result.condition}</div>
                    <Badge variant={result.successRate > 50 ? 'default' : 'destructive'}>
                      {result.successRate.toFixed(1)}% Success
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-gray-600">Requests</div>
                      <div>{result.requests.length}</div>
                    </div>
                    <div>
                      <div className="text-gray-600">Avg Latency</div>
                      <div>{result.averageLatency.toFixed(0)}ms</div>
                    </div>
                    <div>
                      <div className="text-gray-600">Errors</div>
                      <div>{result.errors.length}</div>
                    </div>
                  </div>
                  
                  {result.errors.length > 0 &&
              <Alert className="mt-2">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        Common errors: {result.errors.slice(0, 2).join(', ')}
                      </AlertDescription>
                    </Alert>
              }
                </div>
            )}
            </div>
          </CardContent>
        </Card>
      }
    </div>);

}