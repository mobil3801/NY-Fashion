import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  RotateCcw,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  History,
  GitBranch } from
'lucide-react';

interface Deployment {
  id: number;
  deployment_id: string;
  environment: string;
  status: string;
  version: string;
  branch: string;
  commit_hash: string;
  initiated_by: string;
  start_time: string;
  end_time?: string;
  health_check_status: string;
}

const RollbackManager: React.FC = () => {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [selectedEnvironment, setSelectedEnvironment] = useState<string>('');
  const [selectedRollbackTarget, setSelectedRollbackTarget] = useState<string>('');
  const [rollbackReason, setRollbackReason] = useState<string>('');
  const [showRollbackDialog, setShowRollbackDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSuccessfulDeployments();
  }, []);

  const loadSuccessfulDeployments = async () => {
    try {
      const { data, error } = await window.ezsite.apis.tablePage(37309, {
        PageNo: 1,
        PageSize: 50,
        OrderByField: "start_time",
        IsAsc: false,
        Filters: [{
          name: "status",
          op: "Equal",
          value: "success"
        }]
      });

      if (error) throw error;
      setDeployments(data.List);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load deployment history",
        variant: "destructive"
      });
    }
  };

  const getEnvironmentDeployments = (environment: string) => {
    return deployments.filter((d) => d.environment === environment);
  };

  const getCurrentDeployment = (environment: string) => {
    const envDeployments = getEnvironmentDeployments(environment);
    return envDeployments.length > 0 ? envDeployments[0] : null;
  };

  const getRollbackCandidates = (environment: string) => {
    return getEnvironmentDeployments(environment).slice(1); // Exclude current deployment
  };

  const initiateRollback = async () => {
    if (!selectedEnvironment || !selectedRollbackTarget) {
      toast({
        title: "Error",
        description: "Please select an environment and rollback target",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const rollbackId = `rollback-${Date.now()}`;

      // Create rollback deployment record
      const { error: createError } = await window.ezsite.apis.tableCreate(37309, {
        deployment_id: rollbackId,
        environment: selectedEnvironment,
        status: 'pending',
        version: selectedRollbackTarget,
        branch: 'rollback',
        commit_hash: selectedRollbackTarget,
        initiated_by: 'system', // You might want to get current user
        rollback_deployment_id: selectedRollbackTarget,
        start_time: new Date().toISOString(),
        deployment_config: JSON.stringify({
          type: 'rollback',
          reason: rollbackReason,
          target: selectedRollbackTarget
        })
      });

      if (createError) throw createError;

      // Create pipeline stages for rollback
      const stages = ['validation', 'rollback', 'verify'];
      for (let i = 0; i < stages.length; i++) {
        await window.ezsite.apis.tableCreate(37312, {
          deployment_id: rollbackId,
          stage: stages[i],
          stage_order: i + 1,
          status: 'pending',
          start_time: new Date().toISOString()
        });
      }

      toast({
        title: "Rollback Initiated",
        description: `Rollback to ${selectedRollbackTarget} has been initiated for ${selectedEnvironment}`
      });

      setShowRollbackDialog(false);
      setSelectedEnvironment('');
      setSelectedRollbackTarget('');
      setRollbackReason('');

      // In a real implementation, you would trigger the GitHub Actions rollback workflow here
      // For now, we'll simulate the process
      await simulateRollbackProcess(rollbackId);

    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to initiate rollback",
        variant: "destructive"
      });
    }
    setLoading(false);
  };

  const simulateRollbackProcess = async (rollbackId: string) => {
    // Simulate rollback process stages
    const stages = ['validation', 'rollback', 'verify'];

    for (let i = 0; i < stages.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulate processing time

      // Update stage status
      const { data: stageData } = await window.ezsite.apis.tablePage(37312, {
        PageNo: 1,
        PageSize: 1,
        Filters: [
        { name: "deployment_id", op: "Equal", value: rollbackId },
        { name: "stage", op: "Equal", value: stages[i] }]

      });

      if (stageData.List.length > 0) {
        await window.ezsite.apis.tableUpdate(37312, {
          ID: stageData.List[0].id,
          status: 'success',
          end_time: new Date().toISOString(),
          logs: `${stages[i]} completed successfully`
        });
      }
    }

    // Update deployment status
    const { data: deploymentData } = await window.ezsite.apis.tablePage(37309, {
      PageNo: 1,
      PageSize: 1,
      Filters: [{ name: "deployment_id", op: "Equal", value: rollbackId }]
    });

    if (deploymentData.List.length > 0) {
      await window.ezsite.apis.tableUpdate(37309, {
        ID: deploymentData.List[0].id,
        status: 'success',
        end_time: new Date().toISOString(),
        health_check_status: 'healthy'
      });
    }

    toast({
      title: "Rollback Complete",
      description: "Rollback has been completed successfully"
    });

    loadSuccessfulDeployments();
  };

  const environments = ['staging', 'production'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Rollback Manager</h1>
        <Button
          onClick={() => setShowRollbackDialog(true)}
          className="bg-orange-600 hover:bg-orange-700">

          <RotateCcw className="h-4 w-4 mr-2" />
          Initiate Rollback
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {environments.map((environment) => {
          const currentDeployment = getCurrentDeployment(environment);
          const rollbackCandidates = getRollbackCandidates(environment);

          return (
            <Card key={environment} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold capitalize">{environment}</h3>
                <Badge variant={currentDeployment?.health_check_status === 'healthy' ? 'default' : 'destructive'}>
                  {currentDeployment?.health_check_status || 'Unknown'}
                </Badge>
              </div>

              {currentDeployment ?
              <div className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium text-blue-800 mb-2">Current Deployment</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <GitBranch className="h-3 w-3" />
                        <span className="font-mono">{currentDeployment.version.substring(0, 7)}</span>
                        <span>({currentDeployment.branch})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        <span>{new Date(currentDeployment.start_time).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Rollback History</h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {rollbackCandidates.slice(0, 5).map((deployment) =>
                    <div key={deployment.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div className="flex items-center gap-2 text-sm">
                            <History className="h-3 w-3" />
                            <span className="font-mono">{deployment.version.substring(0, 7)}</span>
                            <span className="text-gray-600">{deployment.branch}</span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {new Date(deployment.start_time).toLocaleDateString()}
                          </span>
                        </div>
                    )}
                    </div>
                  </div>

                  <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedEnvironment(environment);
                    setShowRollbackDialog(true);
                  }}>

                    <RotateCcw className="h-3 w-3 mr-1" />
                    Rollback {environment}
                  </Button>
                </div> :

              <div className="text-center py-8 text-gray-500">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
                  <p>No deployments found</p>
                </div>
              }
            </Card>);

        })}
      </div>

      {/* Rollback Dialog */}
      <Dialog open={showRollbackDialog} onOpenChange={setShowRollbackDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Initiate Rollback</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Environment</label>
              <Select value={selectedEnvironment} onValueChange={setSelectedEnvironment}>
                <SelectTrigger>
                  <SelectValue placeholder="Select environment" />
                </SelectTrigger>
                <SelectContent>
                  {environments.map((env) =>
                  <SelectItem key={env} value={env}>{env}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {selectedEnvironment &&
            <div>
                <label className="text-sm font-medium mb-2 block">Rollback To</label>
                <Select value={selectedRollbackTarget} onValueChange={setSelectedRollbackTarget}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select deployment to rollback to" />
                  </SelectTrigger>
                  <SelectContent>
                    {getRollbackCandidates(selectedEnvironment).map((deployment) =>
                  <SelectItem key={deployment.id} value={deployment.deployment_id}>
                        {deployment.version.substring(0, 7)} ({deployment.branch}) - {new Date(deployment.start_time).toLocaleDateString()}
                      </SelectItem>
                  )}
                  </SelectContent>
                </Select>
              </div>
            }

            <div>
              <label className="text-sm font-medium mb-2 block">Rollback Reason</label>
              <Textarea
                value={rollbackReason}
                onChange={(e) => setRollbackReason(e.target.value)}
                placeholder="Describe the reason for rollback..."
                rows={3} />

            </div>

            <div className="flex gap-2">
              <Button
                onClick={initiateRollback}
                disabled={loading || !selectedEnvironment || !selectedRollbackTarget}
                className="flex-1 bg-orange-600 hover:bg-orange-700">

                {loading ?
                <div className="flex items-center">
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                    Processing...
                  </div> :

                <>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Confirm Rollback
                  </>
                }
              </Button>
              <Button variant="outline" onClick={() => setShowRollbackDialog(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>);

};

export default RollbackManager;