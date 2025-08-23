
import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Activity, Clock, Download, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useDebug } from '@/debug';

const NetworkStatusMonitor: React.FC = () => {
  const { networkStatus, checkNetworkStatus, runNetworkBenchmark } = useDebug();
  const [isRunningBenchmark, setIsRunningBenchmark] = useState(false);
  const [benchmarkResults, setBenchmarkResults] = useState<{latency: number;bandwidth: number;} | null>(null);

  const handleRunBenchmark = async () => {
    setIsRunningBenchmark(true);
    try {
      const results = await runNetworkBenchmark();
      setBenchmarkResults(results);
    } catch (error) {
      console.error('Benchmark failed:', error);
    } finally {
      setIsRunningBenchmark(false);
    }
  };

  const getConnectionQuality = (latency: number | null): {label: string;color: string;score: number;} => {
    if (!latency) return { label: 'Unknown', color: 'gray', score: 0 };

    if (latency < 100) return { label: 'Excellent', color: 'green', score: 100 };
    if (latency < 300) return { label: 'Good', color: 'yellow', score: 75 };
    if (latency < 600) return { label: 'Fair', color: 'orange', score: 50 };
    return { label: 'Poor', color: 'red', score: 25 };
  };

  const formatBandwidth = (bandwidth: number): string => {
    if (bandwidth > 1024 * 1024) {
      return `${(bandwidth / (1024 * 1024)).toFixed(1)} MB/s`;
    }
    if (bandwidth > 1024) {
      return `${(bandwidth / 1024).toFixed(1)} KB/s`;
    }
    return `${bandwidth.toFixed(0)} B/s`;
  };

  const quality = getConnectionQuality(networkStatus.latency);

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {networkStatus.isOnline ?
          <Wifi className="h-4 w-4 text-green-500" /> :

          <WifiOff className="h-4 w-4 text-red-500" />
          }
          Network Status
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={checkNetworkStatus}
          className="text-xs">

          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Connection:</span>
          <Badge variant={networkStatus.isOnline ? "default" : "destructive"}>
            {networkStatus.isOnline ? 'Online' : 'Offline'}
          </Badge>
        </div>

        {/* Latency */}
        {networkStatus.latency &&
        <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Latency:
              </span>
              <span className="text-sm font-mono">
                {networkStatus.latency.toFixed(0)}ms
              </span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Quality: {quality.label}</span>
                <span>{quality.score}%</span>
              </div>
              <Progress value={quality.score} className="h-2" />
            </div>
          </div>
        }

        {/* Connection Info */}
        {(networkStatus.connectionType || networkStatus.downlink) &&
        <div className="space-y-2">
            {networkStatus.connectionType &&
          <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Type:</span>
                <Badge variant="outline">{networkStatus.connectionType}</Badge>
              </div>
          }
            {networkStatus.downlink &&
          <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 flex items-center gap-1">
                  <Download className="h-3 w-3" />
                  Downlink:
                </span>
                <span className="text-sm font-mono">
                  {networkStatus.downlink.toFixed(1)} Mbps
                </span>
              </div>
          }
          </div>
        }

        {/* Last Check */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Last checked:</span>
          <span>{networkStatus.lastCheck.toLocaleTimeString()}</span>
        </div>

        {/* Benchmark Section */}
        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium flex items-center gap-1">
              <Activity className="h-3 w-3" />
              Benchmark
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRunBenchmark}
              disabled={isRunningBenchmark}
              className="text-xs">

              {isRunningBenchmark ?
              <>
                  <Zap className="h-3 w-3 mr-1 animate-spin" />
                  Testing...
                </> :

              'Run Test'
              }
            </Button>
          </div>

          {benchmarkResults &&
          <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Avg Latency:</span>
                <span className="font-mono">{benchmarkResults.latency.toFixed(0)}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Bandwidth:</span>
                <span className="font-mono">{formatBandwidth(benchmarkResults.bandwidth)}</span>
              </div>
            </div>
          }
        </div>
      </CardContent>
    </Card>);

};

export default NetworkStatusMonitor;