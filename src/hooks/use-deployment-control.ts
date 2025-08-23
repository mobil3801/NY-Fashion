
import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface DeploymentStatus {
  deployment_id: string;
  environment: string;
  status: string;
  version: string;
  initiated_by: string;
  start_time: string;
  health_check_status: string;
}

interface EnvironmentHealth {
  environment_name: string;
  status: string;
  last_health_check: string;
  circuit_breaker_status: string;
  database_status: string;
}

interface DeploymentMetrics {
  total_deployments: number;
  success_rate: number;
  average_duration: number;
  failed_deployments: number;
  rollback_count: number;
}

export const useDeploymentControl = () => {
  const queryClient = useQueryClient();
  const [selectedEnvironment, setSelectedEnvironment] = useState<string>('production');

  // Fetch deployments
  const { data: deployments = [], isLoading: deploymentsLoading } = useQuery({
    queryKey: ['deployments'],
    queryFn: async () => {
      const { data, error } = await window.ezsite.apis.tablePage('37309', {
        PageNo: 1,
        PageSize: 50,
        OrderByField: 'start_time',
        IsAsc: false,
        Filters: []
      });
      if (error) throw new Error(error);
      return data?.List || [];
    },
    refetchInterval: 5000 // Refresh every 5 seconds for real-time updates
  });

  // Fetch environment health
  const { data: environments = [], isLoading: environmentsLoading } = useQuery({
    queryKey: ['deployment-environments'],
    queryFn: async () => {
      const { data, error } = await window.ezsite.apis.tablePage('37311', {
        PageNo: 1,
        PageSize: 10,
        OrderByField: 'environment_name',
        IsAsc: true,
        Filters: []
      });
      if (error) throw new Error(error);
      return data?.List || [];
    },
    refetchInterval: 3000
  });

  // Fetch deployment pipeline status
  const { data: pipelineStages = [] } = useQuery({
    queryKey: ['deployment-pipeline', selectedEnvironment],
    queryFn: async () => {
      const { data, error } = await window.ezsite.apis.tablePage('37312', {
        PageNo: 1,
        PageSize: 100,
        OrderByField: 'stage_order',
        IsAsc: true,
        Filters: []
      });
      if (error) throw new Error(error);
      return data?.List || [];
    },
    refetchInterval: 2000
  });

  // Create deployment mutation
  const createDeploymentMutation = useMutation({
    mutationFn: async (deploymentData: any) => {
      const { error } = await window.ezsite.apis.tableCreate('37309', {
        deployment_id: `deploy_${Date.now()}`,
        environment: deploymentData.environment,
        status: 'pending',
        version: deploymentData.version,
        branch: deploymentData.branch,
        commit_hash: deploymentData.commit_hash,
        initiated_by: deploymentData.initiated_by,
        start_time: new Date().toISOString(),
        deployment_config: JSON.stringify(deploymentData.config || {})
      });
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployments'] });
      toast.success('Deployment initiated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to create deployment: ${error.message}`);
    }
  });

  // Approve deployment mutation
  const approveDeploymentMutation = useMutation({
    mutationFn: async ({ deploymentId, approverId, comments }: any) => {
      const { error } = await window.ezsite.apis.tableCreate('37310', {
        deployment_id: deploymentId,
        approver_role: 'Administrator',
        approver_user_id: approverId,
        approval_status: 'approved',
        approval_time: new Date().toISOString(),
        approval_comments: comments || ''
      });
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployments'] });
      toast.success('Deployment approved');
    },
    onError: (error) => {
      toast.error(`Failed to approve deployment: ${error.message}`);
    }
  });

  // Rollback deployment mutation
  const rollbackDeploymentMutation = useMutation({
    mutationFn: async (deploymentId: string) => {
      const rollbackId = `rollback_${Date.now()}`;
      const { error } = await window.ezsite.apis.tableCreate('37309', {
        deployment_id: rollbackId,
        environment: selectedEnvironment,
        status: 'rollback',
        version: 'rollback',
        initiated_by: 'system',
        rollback_deployment_id: deploymentId,
        start_time: new Date().toISOString(),
        deployment_config: '{"type": "rollback"}'
      });
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployments'] });
      toast.success('Rollback initiated');
    },
    onError: (error) => {
      toast.error(`Failed to initiate rollback: ${error.message}`);
    }
  });

  // Update environment health
  const updateEnvironmentHealth = useCallback(async (environmentName: string, healthData: any) => {
    try {
      const { error } = await window.ezsite.apis.tableUpdate('37311', {
        ID: healthData.id,
        environment_name: environmentName,
        status: healthData.status,
        last_health_check: new Date().toISOString(),
        database_status: healthData.database_status,
        circuit_breaker_status: healthData.circuit_breaker_status
      });
      if (error) throw new Error(error);
      queryClient.invalidateQueries({ queryKey: ['deployment-environments'] });
    } catch (error) {
      console.error('Failed to update environment health:', error);
    }
  }, [queryClient]);

  // Calculate deployment metrics
  const deploymentMetrics: DeploymentMetrics = {
    total_deployments: deployments.length,
    success_rate: deployments.length > 0 ? 
      (deployments.filter((d: any) => d.status === 'success').length / deployments.length) * 100 : 0,
    average_duration: 0, // Calculate from deployment data
    failed_deployments: deployments.filter((d: any) => d.status === 'failed').length,
    rollback_count: deployments.filter((d: any) => d.status === 'rollback').length
  };

  return {
    deployments,
    environments,
    pipelineStages,
    deploymentMetrics,
    selectedEnvironment,
    setSelectedEnvironment,
    isLoading: deploymentsLoading || environmentsLoading,
    createDeployment: createDeploymentMutation.mutate,
    approveDeployment: approveDeploymentMutation.mutate,
    rollbackDeployment: rollbackDeploymentMutation.mutate,
    updateEnvironmentHealth,
    isCreatingDeployment: createDeploymentMutation.isPending,
    isApprovingDeployment: approveDeploymentMutation.isPending,
    isRollingBack: rollbackDeploymentMutation.isPending
  };
};
