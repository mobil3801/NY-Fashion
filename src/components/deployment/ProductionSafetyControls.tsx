
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, 
  AlertTriangle, 
  Activity, 
  Database, 
  Zap,
  RotateCcw,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';
import { useRealTimeMonitoring } from '@/hooks/use-real-time-monitoring';
import { toast } from 'sonner';

interface CircuitBreakerConfig {
  name: string;
  enabled: boolean;
  errorThreshold: number;
  timeWindow: number;
  status: 'closed' | 'open' | 'half-open';
  errorCount: number;
  lastError: string;
}

interface HealthCheckConfig {
  endpoint: string;
  interval: number;
  timeout: number;
  enabled: boolean;
  status: 'healthy' | 'unhealthy';
  lastCheck: string;
  responseTime: number;
}

const ProductionSafetyControls: React.FC = () => {
  const { currentMetrics, systemHealth, updateCircuitBreaker } = useRealTimeMonitoring();
  
  const [circuitBreakers, setCircuitBreakers] = useState<CircuitBreakerConfig[]>([
    {
      name: 'Database',
      enabled: true,
      errorThreshold: 5,
      timeWindow: 60000,
      status: 'closed',
      errorCount: 0,
      lastError: ''
    },
    {
      name: 'API Gateway',
      enabled: true,
      errorThreshold: 10,
      timeWindow: 30000,
      status: 'closed',
      errorCount: 2,
      lastError: '2024-01-15 10:30:00'
    },
    {
      name: 'Payment Service',
      enabled: true,
      errorThreshold: 3,
      timeWindow: 120000,
      status: 'half-open',
      errorCount: 1,
      lastError: '2024-01-15 10:25:00'
    }
  ]);

  const [healthChecks, setHealthChecks] = useState<HealthCheckConfig[]>([
    {
      endpoint: '/api/health/database',
      interval: 30000,
      timeout: 5000,
      enabled: true,
      status: 'healthy',
      lastCheck: new Date().toISOString(),
      responseTime: 150
    },
    {
      endpoint: '/api/health/redis',
      interval: 60000,
      timeout: 3000,
      enabled: true,
      status: 'healthy',
      lastCheck: new Date().toISOString(),
      responseTime: 25
    },
    {
      endpoint: '/api/health/external-apis',
      interval: 120000,
      timeout: 10000,
      enabled: true,
      status: 'unhealthy',
      lastCheck: new Date().toISOString(),
      responseTime: 0
    }
  ]);

  const [autoRollbackEnabled, setAutoRollbackEnabled] = useState(true);
  const [rollbackThresholds, setRollbackThresholds] = useState({
    errorRate: 10, // 10% error rate
    responseTime: 5000, // 5 seconds
    timeWindow: 300000 // 5 minutes
  });

  // Monitor for auto-rollback triggers
  useEffect(() => {
    if (autoRollbackEnabled) {
      if (currentMetrics.error_rate > rollbackThresholds.errorRate) {
        toast.error(`Auto-rollback triggered: Error rate ${currentMetrics.error_rate.toFixed(2)}% exceeds threshold`);
        triggerAutoRollback('high_error_rate');
      }
      if (currentMetrics.response_time > rollbackThresholds.responseTime) {
        toast.error(`Auto-rollback triggered: Response time ${currentMetrics.response_time.toFixed(0)}ms exceeds threshold`);
        triggerAutoRollback('high_response_time');
      }
    }
  }, [currentMetrics, autoRollbackEnabled, rollbackThresholds]);

  const triggerAutoRollback = async (reason: string) => {
    try {
      // Log the rollback trigger
      await window.ezsite.apis.tableCreate('37297', {
        error_type: 'auto_rollback',
        error_message: `Auto-rollback triggered: ${reason}`,
        severity: 'critical',
        component: 'deployment_safety',
        created_at: new Date().toISOString()
      });
      
      toast.success('Auto-rollback initiated successfully');
    } catch (error) {
      toast.error('Failed to initiate auto-rollback');
    }
  };

  const toggleCircuitBreaker = (index: number) => {
    setCircuitBreakers(prev => prev.map((cb, i) => 
      i === index ? { ...cb, enabled: !cb.enabled } : cb
    ));
  };

  const resetCircuitBreaker = (index: number) => {
    setCircuitBreakers(prev => prev.map((cb, i) => 
      i === index ? { ...cb, status: 'closed', errorCount: 0 } : cb
    ));
    toast.success(`Circuit breaker reset for ${circuitBreakers[index].name}`);
  };

  const toggleHealthCheck = (index: number) => {
    setHealthChecks(prev => prev.map((hc, i) => 
      i === index ? { ...hc, enabled: !hc.enabled } : hc
    ));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'closed':
      case 'healthy':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'open':
      case 'unhealthy':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'half-open':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'closed':
      case 'healthy':
        return 'bg-green-100 text-green-800';
      case 'open':
      case 'unhealthy':
        return 'bg-red-100 text-red-800';
      case 'half-open':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Safety Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Circuit Breakers</p>
                <p className="text-2xl font-bold">
                  {circuitBreakers.filter(cb => cb.status === 'closed').length}/{circuitBreakers.length}
                </p>
              </div>
              <Shield className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Health Checks</p>
                <p className="text-2xl font-bold">
                  {healthChecks.filter(hc => hc.status === 'healthy').length}/{healthChecks.length}
                </p>
              </div>
              <Activity className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Auto-Rollback</p>
                <div className="flex items-center gap-2 mt-1">
                  {getStatusIcon(autoRollbackEnabled ? 'healthy' : 'unhealthy')}
                  <span className="font-semibold">{autoRollbackEnabled ? 'Enabled' : 'Disabled'}</span>
                </div>
              </div>
              <RotateCcw className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">System Status</p>
                <div className="flex items-center gap-2 mt-1">
                  {getStatusIcon(systemHealth.status)}
                  <span className="font-semibold capitalize">{systemHealth.status}</span>
                </div>
              </div>
              <Database className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Safety Controls Tabs */}
      <Tabs defaultValue="circuit-breakers" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="circuit-breakers">Circuit Breakers</TabsTrigger>
          <TabsTrigger value="health-checks">Health Checks</TabsTrigger>
          <TabsTrigger value="auto-rollback">Auto Rollback</TabsTrigger>
          <TabsTrigger value="safety-metrics">Safety Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="circuit-breakers">
          <Card>
            <CardHeader>
              <CardTitle>Circuit Breaker Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {circuitBreakers.map((breaker, index) => (
                  <div key={breaker.name} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      {getStatusIcon(breaker.status)}
                      <div>
                        <div className="font-medium">{breaker.name}</div>
                        <div className="text-sm text-gray-600">
                          Errors: {breaker.errorCount}/{breaker.errorThreshold} 
                          {breaker.lastError && ` • Last: ${breaker.lastError}`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(breaker.status)}>
                        {breaker.status}
                      </Badge>
                      <Switch
                        checked={breaker.enabled}
                        onCheckedChange={() => toggleCircuitBreaker(index)}
                      />
                      {breaker.status !== 'closed' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resetCircuitBreaker(index)}
                        >
                          Reset
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health-checks">
          <Card>
            <CardHeader>
              <CardTitle>Health Check Endpoints</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {healthChecks.map((check, index) => (
                  <div key={check.endpoint} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      {getStatusIcon(check.status)}
                      <div>
                        <div className="font-medium">{check.endpoint}</div>
                        <div className="text-sm text-gray-600">
                          Response: {check.responseTime}ms • 
                          Interval: {check.interval / 1000}s • 
                          Last: {new Date(check.lastCheck).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(check.status)}>
                        {check.status}
                      </Badge>
                      <Switch
                        checked={check.enabled}
                        onCheckedChange={() => toggleHealthCheck(index)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="auto-rollback">
          <Card>
            <CardHeader>
              <CardTitle>Auto-Rollback Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Enable Auto-Rollback</h3>
                  <p className="text-sm text-gray-600">Automatically rollback deployments when safety thresholds are exceeded</p>
                </div>
                <Switch
                  checked={autoRollbackEnabled}
                  onCheckedChange={setAutoRollbackEnabled}
                />
              </div>

              {autoRollbackEnabled && (
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium mb-2">Error Rate Threshold (%)</label>
                    <div className="flex items-center gap-2">
                      <Progress value={rollbackThresholds.errorRate} className="flex-1" />
                      <span className="text-sm font-mono">{rollbackThresholds.errorRate}%</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Response Time Threshold (ms)</label>
                    <div className="flex items-center gap-2">
                      <Progress value={rollbackThresholds.responseTime / 100} className="flex-1" />
                      <span className="text-sm font-mono">{rollbackThresholds.responseTime}ms</span>
                    </div>
                  </div>

                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Auto-rollback will trigger when error rate exceeds {rollbackThresholds.errorRate}% or 
                      response time exceeds {rollbackThresholds.responseTime}ms for more than {rollbackThresholds.timeWindow / 1000} seconds.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="safety-metrics">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Current Safety Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span>Error Rate</span>
                    <span className={currentMetrics.error_rate > 5 ? 'text-red-500 font-bold' : ''}>
                      {currentMetrics.error_rate.toFixed(2)}%
                    </span>
                  </div>
                  <Progress value={currentMetrics.error_rate} className="h-2" />
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span>Response Time</span>
                    <span className={currentMetrics.response_time > 2000 ? 'text-red-500 font-bold' : ''}>
                      {currentMetrics.response_time.toFixed(0)}ms
                    </span>
                  </div>
                  <Progress value={Math.min(currentMetrics.response_time / 50, 100)} className="h-2" />
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span>Throughput</span>
                    <span>{currentMetrics.throughput.toFixed(0)} req/s</span>
                  </div>
                  <Progress value={Math.min(currentMetrics.throughput / 10, 100)} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Safety Events (Last 24h)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span>Circuit Breaker Trips</span>
                    <Badge variant="outline">0</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Failed Health Checks</span>
                    <Badge variant="destructive">3</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Auto-Rollbacks</span>
                    <Badge variant="outline">0</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Manual Interventions</span>
                    <Badge variant="outline">1</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProductionSafetyControls;
