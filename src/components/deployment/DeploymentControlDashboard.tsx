
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  GitBranch, 
  Play, 
  RotateCcw, 
  Shield,
  TrendingUp,
  Users,
  Database,
  Server,
  Zap
} from 'lucide-react';
import { useDeploymentControl } from '@/hooks/use-deployment-control';
import { useRealTimeMonitoring } from '@/hooks/use-real-time-monitoring';

const DeploymentControlDashboard: React.FC = () => {
  const [showCreateDeployment, setShowCreateDeployment] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [selectedDeployment, setSelectedDeployment] = useState<any>(null);
  const [newDeployment, setNewDeployment] = useState({
    environment: 'staging',
    version: '',
    branch: 'main',
    commit_hash: '',
    initiated_by: 'current_user'
  });

  const {
    deployments,
    environments,
    pipelineStages,
    deploymentMetrics,
    selectedEnvironment,
    setSelectedEnvironment,
    isLoading,
    createDeployment,
    approveDeployment,
    rollbackDeployment,
    isCreatingDeployment,
    isApprovingDeployment,
    isRollingBack
  } = useDeploymentControl();

  const {
    currentMetrics,
    systemHealth,
    processedAlerts,
    circuitBreakerStates
  } = useRealTimeMonitoring();

  const handleCreateDeployment = () => {
    createDeployment(newDeployment);
    setShowCreateDeployment(false);
    setNewDeployment({
      environment: 'staging',
      version: '',
      branch: 'main',
      commit_hash: '',
      initiated_by: 'current_user'
    });
  };

  const handleApproveDeployment = (comments: string) => {
    if (selectedDeployment) {
      approveDeployment({
        deploymentId: selectedDeployment.deployment_id,
        approverId: 1, // Current user ID
        comments
      });
      setShowApprovalDialog(false);
      setSelectedDeployment(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      case 'pending': return 'bg-yellow-500';
      case 'deploying': return 'bg-blue-500';
      case 'rollback': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  const getHealthStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'degraded': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'critical': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header with Key Metrics */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Production Deployment Control</h1>
          <p className="text-gray-600 mt-2">Manage deployments with real-time monitoring and safety controls</p>
        </div>
        <div className="flex gap-4">
          <Button onClick={() => setShowCreateDeployment(true)} className="bg-blue-600 hover:bg-blue-700">
            <Play className="w-4 h-4 mr-2" />
            New Deployment
          </Button>
          <Select value={selectedEnvironment} onValueChange={setSelectedEnvironment}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="production">Production</SelectItem>
              <SelectItem value="staging">Staging</SelectItem>
              <SelectItem value="development">Development</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* System Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">System Health</p>
                <div className="flex items-center gap-2 mt-1">
                  {getHealthStatusIcon(systemHealth.status)}
                  <span className="font-semibold capitalize">{systemHealth.status}</span>
                </div>
              </div>
              <Activity className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Error Rate</p>
                <div className="mt-1">
                  <span className="text-2xl font-bold">{currentMetrics.error_rate.toFixed(2)}%</span>
                </div>
              </div>
              <TrendingUp className="w-8 h-8 text-red-500" />
            </div>
            <Progress value={currentMetrics.error_rate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Response Time</p>
                <div className="mt-1">
                  <span className="text-2xl font-bold">{currentMetrics.response_time.toFixed(0)}ms</span>
                </div>
              </div>
              <Zap className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Success Rate</p>
                <div className="mt-1">
                  <span className="text-2xl font-bold">{deploymentMetrics.success_rate.toFixed(1)}%</span>
                </div>
              </div>
              <Shield className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Environment Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            Environment Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {environments.map((env: any) => (
              <div key={env.id} className="p-4 border rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold capitalize">{env.environment_name}</h3>
                  {getHealthStatusIcon(env.status)}
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Database:</span>
                    <Badge variant={env.database_status === 'connected' ? 'default' : 'destructive'}>
                      {env.database_status}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Circuit Breaker:</span>
                    <Badge variant={env.circuit_breaker_status === 'closed' ? 'default' : 'destructive'}>
                      {env.circuit_breaker_status}
                    </Badge>
                  </div>
                  <div className="text-xs text-gray-500">
                    Last check: {new Date(env.last_health_check || Date.now()).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main Dashboard Tabs */}
      <Tabs defaultValue="deployments" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="deployments">Active Deployments</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline Status</TabsTrigger>
          <TabsTrigger value="monitoring">Real-time Monitoring</TabsTrigger>
          <TabsTrigger value="alerts">Alerts & Issues</TabsTrigger>
        </TabsList>

        <TabsContent value="deployments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Deployments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {deployments.slice(0, 10).map((deployment: any) => (
                  <div key={deployment.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(deployment.status)}`}></div>
                      <div>
                        <div className="font-medium">{deployment.deployment_id}</div>
                        <div className="text-sm text-gray-600">
                          {deployment.environment} • {deployment.version} • {deployment.branch}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(deployment.start_time || Date.now()).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{deployment.status}</Badge>
                      {deployment.status === 'pending' && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedDeployment(deployment);
                            setShowApprovalDialog(true);
                          }}
                        >
                          <Users className="w-4 h-4 mr-1" />
                          Approve
                        </Button>
                      )}
                      {deployment.status === 'success' && deployment.environment === 'production' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => rollbackDeployment(deployment.deployment_id)}
                          disabled={isRollingBack}
                        >
                          <RotateCcw className="w-4 h-4 mr-1" />
                          Rollback
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pipeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Deployment Pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {['validation', 'build', 'test', 'deploy', 'verify'].map((stage, index) => {
                  const stageData = pipelineStages.find((s: any) => s.stage === stage);
                  const status = stageData?.status || 'pending';
                  
                  return (
                    <div key={stage} className="flex items-center gap-4 p-4 border rounded-lg">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getStatusColor(status)} text-white font-bold`}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium capitalize">{stage}</div>
                        <div className="text-sm text-gray-600">
                          {stageData ? `Duration: ${stageData.duration || 'N/A'}` : 'Waiting...'}
                        </div>
                      </div>
                      <Badge variant="outline" className={getStatusColor(status)}>
                        {status}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span>CPU Usage</span>
                    <span>{currentMetrics.cpu_usage.toFixed(1)}%</span>
                  </div>
                  <Progress value={currentMetrics.cpu_usage} />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span>Memory Usage</span>
                    <span>{currentMetrics.memory_usage.toFixed(1)}%</span>
                  </div>
                  <Progress value={currentMetrics.memory_usage} />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span>Throughput</span>
                    <span>{currentMetrics.throughput.toFixed(0)} req/s</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Circuit Breakers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(circuitBreakerStates).map(([component, state]) => (
                    <div key={component} className="flex justify-between items-center">
                      <span className="capitalize">{component}</span>
                      <Badge variant={state === 'closed' ? 'default' : 'destructive'}>
                        {state}
                      </Badge>
                    </div>
                  ))}
                  {Object.keys(circuitBreakerStates).length === 0 && (
                    <p className="text-gray-500 text-center py-4">All circuits healthy</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {processedAlerts.slice(0, 10).map((alert) => (
                  <Alert key={alert.id} className={alert.severity === 'critical' ? 'border-red-500' : ''}>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">{alert.message}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {new Date(alert.timestamp).toLocaleString()}
                          </div>
                        </div>
                        <Badge variant={alert.severity === 'critical' ? 'destructive' : 'default'}>
                          {alert.severity}
                        </Badge>
                      </div>
                    </AlertDescription>
                  </Alert>
                ))}
                {processedAlerts.length === 0 && (
                  <p className="text-gray-500 text-center py-8">No active alerts</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Deployment Dialog */}
      <Dialog open={showCreateDeployment} onOpenChange={setShowCreateDeployment}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Deployment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="environment">Environment</Label>
              <Select value={newDeployment.environment} onValueChange={(value) => 
                setNewDeployment(prev => ({ ...prev, environment: value }))
              }>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staging">Staging</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="version">Version</Label>
              <Input
                id="version"
                value={newDeployment.version}
                onChange={(e) => setNewDeployment(prev => ({ ...prev, version: e.target.value }))}
                placeholder="v1.2.3"
              />
            </div>
            <div>
              <Label htmlFor="branch">Branch</Label>
              <Input
                id="branch"
                value={newDeployment.branch}
                onChange={(e) => setNewDeployment(prev => ({ ...prev, branch: e.target.value }))}
                placeholder="main"
              />
            </div>
            <div>
              <Label htmlFor="commit">Commit Hash</Label>
              <Input
                id="commit"
                value={newDeployment.commit_hash}
                onChange={(e) => setNewDeployment(prev => ({ ...prev, commit_hash: e.target.value }))}
                placeholder="abc123def456..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateDeployment(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateDeployment} disabled={isCreatingDeployment}>
                {isCreatingDeployment ? 'Creating...' : 'Create Deployment'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Approval Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Deployment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedDeployment && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="font-medium">{selectedDeployment.deployment_id}</div>
                <div className="text-sm text-gray-600">
                  {selectedDeployment.environment} • {selectedDeployment.version}
                </div>
              </div>
            )}
            <div>
              <Label htmlFor="comments">Approval Comments</Label>
              <Textarea id="comments" placeholder="Add any comments about this approval..." />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowApprovalDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => handleApproveDeployment((document.getElementById('comments') as HTMLTextAreaElement)?.value || '')}
                disabled={isApprovingDeployment}
              >
                {isApprovingDeployment ? 'Approving...' : 'Approve Deployment'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DeploymentControlDashboard;
