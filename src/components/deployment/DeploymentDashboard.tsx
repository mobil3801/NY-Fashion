import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Rocket, 
  Clock, 
  CheckCircle, 
  XCircle, 
  RotateCcw, 
  Activity,
  GitBranch,
  User,
  Calendar,
  AlertTriangle
} from 'lucide-react';

import RollbackManager from '@/components/deployment/RollbackManager';
import SecurityScanResults from '@/components/deployment/SecurityScanResults';
import QualityGates from '@/components/deployment/QualityGates';
import PipelineVisualization from '@/components/deployment/PipelineVisualization';

interface Deployment {
  id: number;
  deployment_id: string;
  environment: string;
  status: string;
  version: string;
  branch: string;
  commit_hash: string;
  initiated_by: string;
  approved_by?: string;
  start_time: string;
  end_time?: string;
  health_check_status: string;
  error_message?: string;
}

interface DeploymentApproval {
  id: number;
  deployment_id: string;
  approver_role: string;
  approval_status: string;
  approver_user_id?: number;
  approval_time?: string;
  approval_comments?: string;
}

const DeploymentDashboard: React.FC = () => {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [approvals, setApprovals] = useState<DeploymentApproval[]>([]);
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadDeployments();
    loadPendingApprovals();
  }, []);

  const loadDeployments = async () => {
    try {
      const { data, error } = await window.ezsite.apis.tablePage(37309, {
        PageNo: 1,
        PageSize: 50,
        OrderByField: "start_time",
        IsAsc: false
      });

      if (error) throw error;
      setDeployments(data.List);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load deployments",
        variant: "destructive"
      });
    }
  };

  const loadPendingApprovals = async () => {
    try {
      const { data, error } = await window.ezsite.apis.tablePage(37310, {
        PageNo: 1,
        PageSize: 20,
        OrderByField: "id",
        IsAsc: false,
        Filters: [{
          name: "approval_status",
          op: "Equal",
          value: "pending"
        }]
      });

      if (error) throw error;
      setApprovals(data.List);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load pending approvals",
        variant: "destructive"
      });
    }
    setLoading(false);
  };

  const approveDeployment = async (approvalId: number, deploymentId: string) => {
    try {
      const { error } = await window.ezsite.apis.tableUpdate(37310, {
        ID: approvalId,
        approval_status: "approved",
        approval_time: new Date().toISOString(),
        approval_comments: "Approved via dashboard"
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Deployment approved successfully"
      });

      loadPendingApprovals();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to approve deployment",
        variant: "destructive"
      });
    }
  };

  const rejectDeployment = async (approvalId: number) => {
    try {
      const { error } = await window.ezsite.apis.tableUpdate(37310, {
        ID: approvalId,
        approval_status: "rejected",
        approval_time: new Date().toISOString(),
        approval_comments: "Rejected via dashboard"
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Deployment rejected"
      });

      loadPendingApprovals();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reject deployment",
        variant: "destructive"
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'deploying':
        return <Rocket className="h-4 w-4 text-blue-500" />;
      case 'rollback':
        return <RotateCcw className="h-4 w-4 text-orange-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      success: 'default',
      failed: 'destructive',
      pending: 'secondary',
      deploying: 'default',
      rollback: 'outline'
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'outline'}>
        {getStatusIcon(status)}
        <span className="ml-1 capitalize">{status}</span>
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Deployment Dashboard</h1>
        <Button onClick={loadDeployments} variant="outline">
          <Activity className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Pending Approvals Alert */}
      {approvals.length > 0 && (
        <Card className="p-4 border-yellow-200 bg-yellow-50">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <h3 className="font-semibold text-yellow-800">
              {approvals.length} Deployment{approvals.length > 1 ? 's' : ''} Awaiting Approval
            </h3>
          </div>
          <div className="space-y-2">
            {approvals.map((approval) => {
              const deployment = deployments.find(d => d.deployment_id === approval.deployment_id);
              return (
                <div key={approval.id} className="flex items-center justify-between bg-white p-3 rounded border">
                  <div className="flex items-center gap-4">
                    <Badge variant="outline">{deployment?.environment}</Badge>
                    <span className="font-medium">{deployment?.version}</span>
                    <span className="text-sm text-gray-600">by {deployment?.initiated_by}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => approveDeployment(approval.id, approval.deployment_id)}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => rejectDeployment(approval.id)}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Tabs defaultValue="deployments" className="space-y-6">
        <TabsList>
          <TabsTrigger value="deployments">Deployments</TabsTrigger>
          <TabsTrigger value="environments">Environments</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
        </TabsList>

        <TabsContent value="deployments">
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Recent Deployments</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Status</th>
                      <th className="text-left p-2">Environment</th>
                      <th className="text-left p-2">Version</th>
                      <th className="text-left p-2">Branch</th>
                      <th className="text-left p-2">Initiated By</th>
                      <th className="text-left p-2">Start Time</th>
                      <th className="text-left p-2">Duration</th>
                      <th className="text-left p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deployments.map((deployment) => (
                      <tr key={deployment.id} className="border-b hover:bg-gray-50">
                        <td className="p-2">{getStatusBadge(deployment.status)}</td>
                        <td className="p-2">
                          <Badge variant="outline">{deployment.environment}</Badge>
                        </td>
                        <td className="p-2 font-mono text-sm">
                          {deployment.version.substring(0, 7)}
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-1">
                            <GitBranch className="h-3 w-3" />
                            {deployment.branch}
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {deployment.initiated_by}
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-3 w-3" />
                            {new Date(deployment.start_time).toLocaleString()}
                          </div>
                        </td>
                        <td className="p-2 text-sm">
                          {deployment.end_time && 
                            `${Math.round((new Date(deployment.end_time).getTime() - new Date(deployment.start_time).getTime()) / 1000)}s`
                          }
                        </td>
                        <td className="p-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedDeployment(deployment)}
                          >
                            View Details
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="environments">
          <EnvironmentStatus />
        </TabsContent>

        <TabsContent value="pipeline">
          <div className="space-y-6">
            <PipelineVisualization />
            <QualityGates />
          </div>
        </TabsContent>
      </Tabs>

      {/* Deployment Details Modal */}
      <Dialog open={!!selectedDeployment} onOpenChange={() => setSelectedDeployment(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Deployment Details</DialogTitle>
          </DialogHeader>
          {selectedDeployment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-medium">Environment</label>
                  <p>{selectedDeployment.environment}</p>
                </div>
                <div>
                  <label className="font-medium">Status</label>
                  <p>{getStatusBadge(selectedDeployment.status)}</p>
                </div>
                <div>
                  <label className="font-medium">Version</label>
                  <p className="font-mono">{selectedDeployment.version}</p>
                </div>
                <div>
                  <label className="font-medium">Branch</label>
                  <p>{selectedDeployment.branch}</p>
                </div>
                <div>
                  <label className="font-medium">Initiated By</label>
                  <p>{selectedDeployment.initiated_by}</p>
                </div>
                <div>
                  <label className="font-medium">Health Check</label>
                  <p>{selectedDeployment.health_check_status}</p>
                </div>
              </div>
              {selectedDeployment.error_message && (
                <div>
                  <label className="font-medium">Error Message</label>
                  <p className="text-red-600 bg-red-50 p-2 rounded">
                    {selectedDeployment.error_message}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Environment Status Component
const EnvironmentStatus: React.FC = () => {
  const [environments, setEnvironments] = useState([]);

  useEffect(() => {
    loadEnvironments();
  }, []);

  const loadEnvironments = async () => {
    try {
      const { data, error } = await window.ezsite.apis.tablePage(37311, {
        PageNo: 1,
        PageSize: 10,
        OrderByField: "id",
        IsAsc: true
      });

      if (error) throw error;
      setEnvironments(data.List);
    } catch (error) {
      console.error('Failed to load environments:', error);
    }
  };

  return (
    <div className="grid gap-4">
      {environments.map((env: any) => (
        <Card key={env.id} className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold capitalize">{env.environment_name}</h3>
              <p className="text-sm text-gray-600">
                Last deployment: {env.last_deployment_id || 'None'}
              </p>
            </div>
            <Badge variant={env.status === 'healthy' ? 'default' : 'destructive'}>
              {env.status}
            </Badge>
          </div>
        </Card>
      ))}
    </div>
  );
};

// Pipeline View Component
const PipelineView: React.FC = () => {
  const [pipelineStages, setPipelineStages] = useState([]);

  useEffect(() => {
    loadPipelineStages();
  }, []);

  const loadPipelineStages = async () => {
    try {
      const { data, error } = await window.ezsite.apis.tablePage(37312, {
        PageNo: 1,
        PageSize: 50,
        OrderByField: "stage_order",
        IsAsc: true
      });

      if (error) throw error;
      setPipelineStages(data.List);
    } catch (error) {
      console.error('Failed to load pipeline stages:', error);
    }
  };

  return (
    <Card>
      <div className="p-6">
        <h3 className="text-lg font-semibold mb-4">Pipeline Stages</h3>
        <div className="space-y-2">
          {pipelineStages.map((stage: any) => (
            <div key={stage.id} className="flex items-center justify-between p-3 border rounded">
              <div className="flex items-center gap-4">
                <Badge variant="outline">{stage.stage}</Badge>
                <span>{stage.deployment_id}</span>
              </div>
              {getStatusBadge(stage.status)}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};

export default DeploymentDashboard;
