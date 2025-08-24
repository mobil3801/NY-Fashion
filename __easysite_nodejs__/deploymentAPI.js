// Deployment API functions for CI/CD integration

async function startDeployment({
  deployment_id,
  environment,
  version,
  branch,
  commit_hash,
  initiated_by
}) {
  try {
    // Create deployment record
    const deployment = await window.ezsite.apis.tableCreate(37309, {
      deployment_id,
      environment,
      status: 'pending',
      version,
      branch,
      commit_hash,
      initiated_by,
      start_time: new Date().toISOString(),
      health_check_status: 'unknown',
      deployment_config: JSON.stringify({
        environment,
        version,
        branch,
        commit_hash,
        initiated_by
      })
    });

    // Create initial pipeline stages
    const stages = ['validation', 'build', 'test', 'deploy', 'verify'];
    for (let i = 0; i < stages.length; i++) {
      await window.ezsite.apis.tableCreate(37312, {
        deployment_id,
        stage: stages[i],
        stage_order: i + 1,
        status: 'pending',
        start_time: new Date().toISOString()
      });
    }

    return {
      success: true,
      deployment_id,
      message: 'Deployment initiated successfully'
    };

  } catch (error) {
    throw new Error(`Failed to start deployment: ${error.message}`);
  }
}

async function requestDeploymentApproval({
  deployment_id,
  environment,
  version,
  branch,
  commit_hash,
  initiated_by
}) {
  try {
    // Create deployment record with pending status
    await window.ezsite.apis.tableCreate(37309, {
      deployment_id,
      environment,
      status: 'pending',
      version,
      branch,
      commit_hash,
      initiated_by,
      start_time: new Date().toISOString(),
      health_check_status: 'unknown',
      deployment_config: JSON.stringify({
        type: 'production_deployment',
        requires_approval: true
      })
    });

    // Create approval request
    await window.ezsite.apis.tableCreate(37310, {
      deployment_id,
      approver_role: environment === 'production' ? 'Administrator' : 'r-pdMoy3',
      approval_status: 'pending'
    });

    return {
      success: true,
      deployment_id,
      message: 'Approval requested successfully'
    };

  } catch (error) {
    throw new Error(`Failed to request approval: ${error.message}`);
  }
}

async function getApprovalStatus(deployment_id) {
  try {
    const { data, error } = await window.ezsite.apis.tablePage(37310, {
      PageNo: 1,
      PageSize: 1,
      Filters: [{ name: "deployment_id", op: "Equal", value: deployment_id }]
    });

    if (error) throw new Error(error);

    if (data.List.length === 0) {
      return { status: 'no_approval_required' };
    }

    const approval = data.List[0];
    return {
      status: approval.approval_status,
      approver_role: approval.approver_role,
      approval_time: approval.approval_time,
      comments: approval.approval_comments
    };

  } catch (error) {
    throw new Error(`Failed to get approval status: ${error.message}`);
  }
}

async function completeDeployment({
  deployment_id,
  status,
  health_check_status,
  error_message
}) {
  try {
    // Update deployment record
    const { data: deploymentData } = await window.ezsite.apis.tablePage(37309, {
      PageNo: 1,
      PageSize: 1,
      Filters: [{ name: "deployment_id", op: "Equal", value: deployment_id }]
    });

    if (deploymentData.List.length > 0) {
      await window.ezsite.apis.tableUpdate(37309, {
        ID: deploymentData.List[0].id,
        status,
        end_time: new Date().toISOString(),
        health_check_status: health_check_status || 'unknown',
        error_message: error_message || ''
      });
    }

    // Update environment status if deployment was successful
    if (status === 'success') {
      const environment = deploymentData.List[0].environment;
      const { data: envData } = await window.ezsite.apis.tablePage(37311, {
        PageNo: 1,
        PageSize: 1,
        Filters: [{ name: "environment_name", op: "Equal", value: environment }]
      });

      if (envData.List.length > 0) {
        await window.ezsite.apis.tableUpdate(37311, {
          ID: envData.List[0].id,
          status: health_check_status === 'healthy' ? 'healthy' : 'degraded',
          last_deployment_id: deployment_id,
          last_health_check: new Date().toISOString()
        });
      } else {
        // Create environment record if it doesn't exist
        await window.ezsite.apis.tableCreate(37311, {
          environment_name: environment,
          status: health_check_status === 'healthy' ? 'healthy' : 'degraded',
          last_deployment_id: deployment_id,
          last_health_check: new Date().toISOString(),
          configuration: JSON.stringify({ auto_created: true })
        });
      }
    }

    return {
      success: true,
      deployment_id,
      message: 'Deployment completed successfully'
    };

  } catch (error) {
    throw new Error(`Failed to complete deployment: ${error.message}`);
  }
}

async function startRollback({
  deployment_id,
  environment,
  rollback_deployment_id,
  initiated_by
}) {
  try {
    // Get target deployment details
    const { data: targetData } = await window.ezsite.apis.tablePage(37309, {
      PageNo: 1,
      PageSize: 1,
      Filters: [{ name: "deployment_id", op: "Equal", value: rollback_deployment_id }]
    });

    if (targetData.List.length === 0) {
      throw new Error('Target deployment not found');
    }

    const targetDeployment = targetData.List[0];

    // Create rollback deployment record
    await window.ezsite.apis.tableCreate(37309, {
      deployment_id,
      environment,
      status: 'pending',
      version: targetDeployment.version,
      branch: 'rollback',
      commit_hash: targetDeployment.commit_hash,
      initiated_by,
      rollback_deployment_id,
      start_time: new Date().toISOString(),
      health_check_status: 'unknown',
      deployment_config: JSON.stringify({
        type: 'rollback',
        target_deployment: rollback_deployment_id,
        target_version: targetDeployment.version
      })
    });

    // Create rollback pipeline stages
    const stages = ['validation', 'rollback', 'verify'];
    for (let i = 0; i < stages.length; i++) {
      await window.ezsite.apis.tableCreate(37312, {
        deployment_id,
        stage: stages[i],
        stage_order: i + 1,
        status: 'pending',
        start_time: new Date().toISOString()
      });
    }

    return {
      success: true,
      deployment_id,
      message: 'Rollback initiated successfully'
    };

  } catch (error) {
    throw new Error(`Failed to start rollback: ${error.message}`);
  }
}

async function getLastSuccessfulDeployment(environment) {
  try {
    const { data, error } = await window.ezsite.apis.tablePage(37309, {
      PageNo: 1,
      PageSize: 1,
      OrderByField: "start_time",
      IsAsc: false,
      Filters: [
      { name: "environment", op: "Equal", value: environment },
      { name: "status", op: "Equal", value: "success" }]

    });

    if (error) throw new Error(error);

    if (data.List.length === 0) {
      throw new Error('No successful deployments found');
    }

    return {
      deployment_id: data.List[0].deployment_id,
      version: data.List[0].version,
      start_time: data.List[0].start_time
    };

  } catch (error) {
    throw new Error(`Failed to get last successful deployment: ${error.message}`);
  }
}

// Export the main function that routes to appropriate handlers
function handleDeploymentAPI({ action, ...params }) {
  switch (action) {
    case 'start':
      return startDeployment(params);
    case 'request-approval':
      return requestDeploymentApproval(params);
    case 'approval-status':
      return getApprovalStatus(params.deployment_id);
    case 'complete':
      return completeDeployment(params);
    case 'start-rollback':
      return startRollback(params);
    case 'last-successful':
      return getLastSuccessfulDeployment(params.environment);
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

// This is the main exported function
function processDeploymentAPI(action, params) {
  return handleDeploymentAPI({ action, ...params });
}