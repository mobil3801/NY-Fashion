
import React from 'react';
import { Settings, Zap, Clock, Globe, Bug } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useDebug } from '@/debug';
import { useToast } from '@/hooks/use-toast';

const DebugSettingsPanel: React.FC = () => {
  const { debugSettings, updateDebugSettings, simulateNetworkFailure } = useDebug();
  const { toast } = useToast();

  const handleSimulateNetworkFailure = (duration: number) => {
    simulateNetworkFailure(duration);
    toast({
      title: "Network Simulation Started",
      description: `Simulating network failure for ${duration / 1000} seconds`,
      variant: "default"
    });
  };

  const resetToDefaults = () => {
    updateDebugSettings({
      enabled: true,
      logLevel: 'info',
      maxApiCalls: 100,
      simulateNetworkConditions: 'none',
      retryOverrides: {}
    });

    toast({
      title: "Settings Reset",
      description: "Debug settings have been reset to defaults"
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Debug Settings
          {debugSettings.enabled &&
          <Badge variant="default" className="text-xs">
              Active
            </Badge>
          }
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Core Settings */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Enable Debug Mode</Label>
              <div className="text-xs text-gray-500">
                Show debug information and tools
              </div>
            </div>
            <Switch
              checked={debugSettings.enabled}
              onCheckedChange={(enabled) => updateDebugSettings({ enabled })} />

          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Log Level</Label>
            <Select
              value={debugSettings.logLevel}
              onValueChange={(logLevel: any) => updateDebugSettings({ logLevel })}>

              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="debug">
                  <div className="flex items-center gap-2">
                    <Bug className="h-3 w-3" />
                    Debug - Show everything
                  </div>
                </SelectItem>
                <SelectItem value="info">
                  <div className="flex items-center gap-2">
                    <Globe className="h-3 w-3" />
                    Info - Normal operations
                  </div>
                </SelectItem>
                <SelectItem value="warn">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    Warn - Problems only
                  </div>
                </SelectItem>
                <SelectItem value="error">
                  <div className="flex items-center gap-2">
                    <Zap className="h-3 w-3" />
                    Error - Critical issues only
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Max API Calls History</Label>
            <Input
              type="number"
              value={debugSettings.maxApiCalls}
              onChange={(e) => updateDebugSettings({
                maxApiCalls: parseInt(e.target.value) || 100
              })}
              min="10"
              max="1000"
              className="w-24" />

            <div className="text-xs text-gray-500">
              Number of API calls to keep in history (10-1000)
            </div>
          </div>
        </div>

        <Separator />

        {/* Network Simulation */}
        <div className="space-y-4">
          <Label className="text-sm font-medium">Network Simulation</Label>
          
          <div className="space-y-2">
            <Select
              value={debugSettings.simulateNetworkConditions}
              onValueChange={(simulateNetworkConditions: any) =>
              updateDebugSettings({ simulateNetworkConditions })
              }>

              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Normal - No simulation</SelectItem>
                <SelectItem value="slow">Slow - Simulated slow connection</SelectItem>
                <SelectItem value="offline">Offline - Block all requests</SelectItem>
                <SelectItem value="intermittent">Intermittent - Random failures</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSimulateNetworkFailure(5000)}
              className="text-xs">

              5s Failure
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSimulateNetworkFailure(15000)}
              className="text-xs">

              15s Failure
            </Button>
          </div>
        </div>

        <Separator />

        {/* Retry Override Settings */}
        <div className="space-y-4">
          <Label className="text-sm font-medium">Retry Configuration Override</Label>
          
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Max Attempts</Label>
              <Input
                type="number"
                placeholder="Default: 3"
                value={debugSettings.retryOverrides.attempts || ''}
                onChange={(e) => updateDebugSettings({
                  retryOverrides: {
                    ...debugSettings.retryOverrides,
                    attempts: e.target.value ? parseInt(e.target.value) : undefined
                  }
                })}
                min="1"
                max="10"
                className="w-24" />

            </div>
            
            <div className="space-y-2">
              <Label className="text-xs">Base Delay (ms)</Label>
              <Input
                type="number"
                placeholder="Default: 300"
                value={debugSettings.retryOverrides.baseDelayMs || ''}
                onChange={(e) => updateDebugSettings({
                  retryOverrides: {
                    ...debugSettings.retryOverrides,
                    baseDelayMs: e.target.value ? parseInt(e.target.value) : undefined
                  }
                })}
                min="100"
                max="5000"
                className="w-24" />

            </div>
            
            <div className="space-y-2">
              <Label className="text-xs">Max Delay (ms)</Label>
              <Input
                type="number"
                placeholder="Default: 10000"
                value={debugSettings.retryOverrides.maxDelayMs || ''}
                onChange={(e) => updateDebugSettings({
                  retryOverrides: {
                    ...debugSettings.retryOverrides,
                    maxDelayMs: e.target.value ? parseInt(e.target.value) : undefined
                  }
                })}
                min="1000"
                max="60000"
                className="w-24" />

            </div>
          </div>
          
          <div className="text-xs text-gray-500">
            Leave empty to use default values. Changes apply to new API calls.
          </div>
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={resetToDefaults}
            className="text-xs">

            Reset to Defaults
          </Button>
          <div className="text-xs text-gray-500">
            Debug mode only works in development
          </div>
        </div>

        {/* Environment Info */}
        <div className="text-xs text-gray-400 space-y-1">
          <div>Environment: {process.env.NODE_ENV}</div>
          <div>Debug Enabled: {debugSettings.enabled ? 'Yes' : 'No'}</div>
          <div>User Agent: {navigator.userAgent.slice(0, 50)}...</div>
        </div>
      </CardContent>
    </Card>);

};

export default DebugSettingsPanel;