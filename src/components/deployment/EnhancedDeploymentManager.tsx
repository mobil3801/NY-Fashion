
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Rocket,
  GitBranch,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Server,
  Database,
  Shield,
  Activity } from
'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Deployment {
  deployment_id: string;
  environment: string;
  status: string;
  version: string;
  branch: string;
  commit_hash: string;
  initiated_by: string;
  start_time: string;
  end_time?: string;
}

interface PipelineStage {
  stage: string;
  status: string;
  start_time?: string;
  end_time?: string;
  logs?: string;
}

const EnhancedDeploymentManager: React.FC = () => {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);
  const [deploymentDialog, setDeploymentDialog] = useState(false);
  const [rollbackDialog, setRollbackDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newDeployment, setNewDeployment] = useState({
    environment: 'staging',
    version: '',
    branch: 'main',
    skipTests: false
  });
  const { toast } = useToast();

  useEffect(() => {
    loadDeployments();
  }, []);

  const loadDeployments = async () => {
    try {
      setLoading(true);
      const { data, error } = await window.ezsite.apis.run({
        path: 'deploymentManager',
        param: ['list', { environment: 'all', limit: 50 }]
      });

      if (error) throw new Error(error);

      // In a real implementation, this would load from the database
      // For now, we'll create some mock data
      const mockDeployments: Deployment[] = [
      {
        deployment_id: '20241201_140530_admin',
        environment: 'production',
        status: 'success',
        version: 'v1.2.3',
        branch: 'main',
        commit_hash: 'abc123def',
        initiated_by: 'admin',
        start_time: new Date(Date.now() - 3600000).toISOString(),
        end_time: new Date(Date.now() - 3000000).toISOString()
      },
      {
        deployment_id: '20241201_120000_developer',
        environment: 'staging',
        status: 'success',
        version: 'v1.2.4-beta',
        branch: 'develop',
        commit_hash: 'def456ghi',
        initiated_by: 'developer',
        start_time: new Date(Date.now() - 7200000).toISOString(),
        end_time: new Date(Date.now() - 6600000).toISOString()
      }];


      setDeployments(mockDeployments);
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to load deployments: ${error}`,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const initiateDeployment = async () => {
    try {
      setLoading(true);

      const { data, error } = await window.ezsite.apis.run({
        path: 'deploymentManager',
        param: ['initiate', {
          environment: newDeployment.environment,
          version: newDeployment.version,
          branch: newDeployment.branch,
          userId: 1, // Get from auth context
          skipTests: newDeployment.skipTests
        }]
      });

      if (error) throw new Error(error);

      toast({
        title: 'Success',
        description: `Deployment initiated: ${data.deploymentId}`,
        variant: 'default'
      });

      setDeploymentDialog(false);
      loadDeployments();
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to initiate deployment: ${error}`,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const approveDeployment = async (deploymentId: string) => {
    try {
      setLoading(true);

      const { data, error } = await window.ezsite.apis.run({
        path: 'deploymentManager',
        param: ['approve', deploymentId, 1, 'Approved for deployment'] // userId from auth
      });

      if (error) throw new Error(error);

      toast({
        title: 'Success',
        description: 'Deployment approved and initiated',
        variant: 'default'
      });

      loadDeployments();
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to approve deployment: ${error}`,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const initiateRollback = async (deploymentId: string) => {
    try {
      setLoading(true);

      const { data, error } = await window.ezsite.apis.run({
        path: 'deploymentManager',
        param: ['rollback', deploymentId, 1, null] // userId from auth
      });

      if (error) throw new Error(error);

      toast({
        title: 'Success',
        description: `Rollback initiated: ${data.rollbackId}`,
        variant: 'default'
      });

      setRollbackDialog(false);
      loadDeployments();
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to initiate rollback: ${error}`,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const performHealthCheck = async (environment: string) => {
    try {
      const { data, error } = await window.ezsite.apis.run({
        path: 'deploymentManager',
        param: ['health-check', { environment }]
      });

      if (error) throw new Error(error);

      toast({
        title: 'Health Check',
        description: `${environment}: ${data.status}`,
        variant: data.status === 'healthy' ? 'default' : 'destructive'
      });
    } catch (error) {
      toast({
        title: 'Health Check Failed',
        description: `${environment}: ${error}`,
        variant: 'destructive'
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      case 'deploying':
        return 'bg-blue-500';
      case 'pending':
        return 'bg-yellow-500';
      case 'rolled_back':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'deploying':
        return <Activity className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'rolled_back':
        return <RotateCcw className="h-4 w-4 text-purple-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Deployment Management</h2>
          <p className="text-gray-600">Manage application deployments and rollbacks</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => performHealthCheck('staging')}
            variant="outline"
            size="sm">

            <Activity className="h-4 w-4 mr-2" />
            Health Check (Staging)
          </Button>
          <Button
            onClick={() => performHealthCheck('production')}
            variant="outline"
            size="sm">

            <Activity className="h-4 w-4 mr-2" />
            Health Check (Production)
          </Button>
          <Button onClick={() => setDeploymentDialog(true)}>
            <Rocket className="h-4 w-4 mr-2" />
            New Deployment
          </Button>
        </div>
      </div>

      {/* Deployment Tabs */}
      <Tabs defaultValue="deployments" className="w-full">
        <TabsList>
          <TabsTrigger value="deployments">Deployments</TabsTrigger>
          <TabsTrigger value="infrastructure">Infrastructure</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
          <TabsTrigger value="disaster-recovery">Disaster Recovery</TabsTrigger>
        </TabsList>

        <TabsContent value="deployments" className="space-y-4">
          {/* Deployments List */}
          <Card className="p-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Recent Deployments</h3>
              
              {loading ?
              <div className="flex items-center justify-center p-8">
                  <Activity className="h-6 w-6 animate-spin" />
                </div> :

              <div className="space-y-3">
                  {deployments.map((deployment) =>
                <div
                  key={deployment.deployment_id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">

                      <div className="flex items-center space-x-4">
                        <div className="flex flex-col">
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(deployment.status)}
                            <span className="font-medium">{deployment.deployment_id}</span>
                            <Badge variant={deployment.environment === 'production' ? 'destructive' : 'secondary'}>
                              {deployment.environment}
                            </Badge>
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                            <span className="flex items-center">
                              <GitBranch className="h-3 w-3 mr-1" />
                              {deployment.branch}
                            </span>
                            <span>{deployment.version}</span>
                            <span>{deployment.commit_hash.substring(0, 8)}</span>
                            <span>by {deployment.initiated_by}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-500">
                          {new Date(deployment.start_time).toLocaleString()}
                        </span>
                        {deployment.status === 'success' && deployment.environment === 'production' &&
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedDeployment(deployment);
                        setRollbackDialog(true);
                      }}>

                            <RotateCcw className="h-4 w-4 mr-1" />
                            Rollback
                          </Button>
                    }
                        {deployment.status === 'pending' &&
                    <Button
                      size="sm"
                      onClick={() => approveDeployment(deployment.deployment_id)}>

                            Approve
                          </Button>
                    }
                      </div>
                    </div>
                )}
                </div>
              }
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="infrastructure" className="space-y-4">
          <InfrastructureTab />
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          <MonitoringTab />
        </TabsContent>

        <TabsContent value="disaster-recovery" className="space-y-4">
          <DisasterRecoveryTab />
        </TabsContent>
      </Tabs>

      {/* New Deployment Dialog */}
      <Dialog open={deploymentDialog} onOpenChange={setDeploymentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Deployment</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Environment</label>
              <Select
                value={newDeployment.environment}
                onValueChange={(value) => setNewDeployment({ ...newDeployment, environment: value })}>

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
              <label className="text-sm font-medium">Branch</label>
              <Input
                value={newDeployment.branch}
                onChange={(e) => setNewDeployment({ ...newDeployment, branch: e.target.value })}
                placeholder="main" />

            </div>

            <div>
              <label className="text-sm font-medium">Version (optional)</label>
              <Input
                value={newDeployment.version}
                onChange={(e) => setNewDeployment({ ...newDeployment, version: e.target.value })}
                placeholder="Leave empty for latest" />

            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="skipTests"
                checked={newDeployment.skipTests}
                onChange={(e) => setNewDeployment({ ...newDeployment, skipTests: e.target.checked })} />

              <label htmlFor="skipTests" className="text-sm">Skip tests</label>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setDeploymentDialog(false)}>
                Cancel
              </Button>
              <Button onClick={initiateDeployment} disabled={loading}>
                {loading ? <Activity className="h-4 w-4 animate-spin mr-2" /> : <Rocket className="h-4 w-4 mr-2" />}
                Deploy
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rollback Dialog */}
      <Dialog open={rollbackDialog} onOpenChange={setRollbackDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Rollback</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This will rollback the deployment and may cause downtime. Are you sure you want to continue?
              </AlertDescription>
            </Alert>

            {selectedDeployment &&
            <div className="text-sm">
                <p><strong>Deployment:</strong> {selectedDeployment.deployment_id}</p>
                <p><strong>Environment:</strong> {selectedDeployment.environment}</p>
                <p><strong>Version:</strong> {selectedDeployment.version}</p>
              </div>
            }

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setRollbackDialog(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => selectedDeployment && initiateRollback(selectedDeployment.deployment_id)}
                disabled={loading}>

                {loading ? <Activity className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                Rollback
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>);

};

// Infrastructure Management Tab Component
const InfrastructureTab: React.FC = () => {
  const [infrastructureStatus, setInfrastructureStatus] = useState({
    containers: { running: 2, total: 3 },
    services: { healthy: 4, total: 5 },
    resources: { cpu: 65, memory: 72, disk: 45 }
  });
  const { toast } = useToast();

  const provisionInfrastructure = async () => {
    try {
      const { data, error } = await window.ezsite.apis.run({
        path: 'infrastructureManager',
        param: ['provision', {
          environment: 'production',
          autoScaling: true,
          database: true,
          cdn: true
        }]
      });

      if (error) throw new Error(error);

      toast({
        title: 'Success',
        description: 'Infrastructure provisioning initiated',
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: `Infrastructure provisioning failed: ${error}`,
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Containers</p>
              <p className="text-2xl font-bold">{infrastructureStatus.containers.running}/{infrastructureStatus.containers.total}</p>
            </div>
            <Server className="h-8 w-8 text-blue-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Services</p>
              <p className="text-2xl font-bold">{infrastructureStatus.services.healthy}/{infrastructureStatus.services.total}</p>
            </div>
            <Database className="h-8 w-8 text-green-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Security</p>
              <p className="text-2xl font-bold">Active</p>
            </div>
            <Shield className="h-8 w-8 text-yellow-500" />
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Resource Usage</h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">CPU Usage</span>
              <span className="text-sm">{infrastructureStatus.resources.cpu}%</span>
            </div>
            <Progress value={infrastructureStatus.resources.cpu} className="h-2" />
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">Memory Usage</span>
              <span className="text-sm">{infrastructureStatus.resources.memory}%</span>
            </div>
            <Progress value={infrastructureStatus.resources.memory} className="h-2" />
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">Disk Usage</span>
              <span className="text-sm">{infrastructureStatus.resources.disk}%</span>
            </div>
            <Progress value={infrastructureStatus.resources.disk} className="h-2" />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Infrastructure Actions</h3>
        </div>
        <div className="flex gap-2">
          <Button onClick={provisionInfrastructure}>
            <Server className="h-4 w-4 mr-2" />
            Provision Infrastructure
          </Button>
          <Button variant="outline">
            <Activity className="h-4 w-4 mr-2" />
            Scale Resources
          </Button>
          <Button variant="outline">
            <Shield className="h-4 w-4 mr-2" />
            Security Scan
          </Button>
        </div>
      </Card>
    </div>);

};

// Monitoring Tab Component
const MonitoringTab: React.FC = () => {
  const { toast } = useToast();

  const setupMonitoring = async () => {
    try {
      const { data, error } = await window.ezsite.apis.run({
        path: 'monitoringAutomation',
        param: ['setup-monitoring', {
          environment: 'production',
          components: ['app', 'database', 'redis', 'nginx'],
          retention: '30d'
        }]
      });

      if (error) throw new Error(error);

      toast({
        title: 'Success',
        description: 'Monitoring setup completed',
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: `Monitoring setup failed: ${error}`,
        variant: 'destructive'
      });
    }
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Monitoring Setup</h3>
      <div className="space-y-4">
        <p className="text-gray-600">
          Configure comprehensive monitoring for your application infrastructure.
        </p>
        <div className="flex gap-2">
          <Button onClick={setupMonitoring}>
            <Activity className="h-4 w-4 mr-2" />
            Setup Monitoring
          </Button>
          <Button variant="outline">
            Configure Alerts
          </Button>
          <Button variant="outline">
            View Dashboards
          </Button>
        </div>
      </div>
    </Card>);

};

// Disaster Recovery Tab Component
const DisasterRecoveryTab: React.FC = () => {
  const { toast } = useToast();

  const createBackup = async () => {
    try {
      const { data, error } = await window.ezsite.apis.run({
        path: 'disasterRecoveryManager',
        param: ['create-backup', {
          environment: 'production',
          backupType: 'full',
          components: ['database', 'files', 'configuration']
        }]
      });

      if (error) throw new Error(error);

      toast({
        title: 'Success',
        description: `Backup created: ${data.backup.backupId}`,
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: `Backup creation failed: ${error}`,
        variant: 'destructive'
      });
    }
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Disaster Recovery</h3>
      <div className="space-y-4">
        <p className="text-gray-600">
          Manage system backups and disaster recovery procedures.
        </p>
        <div className="flex gap-2">
          <Button onClick={createBackup}>
            Create Backup
          </Button>
          <Button variant="outline">
            View Backups
          </Button>
          <Button variant="outline">
            Emergency Procedures
          </Button>
        </div>
      </div>
    </Card>);

};

export default EnhancedDeploymentManager;