
async function manageAlerts(action, alertData) {
  const timestamp = new Date().toISOString();
  
  switch (action) {
    case 'create':
      return await createAlert(alertData);
    case 'acknowledge':
      return await acknowledgeAlert(alertData.alertId, alertData.userId);
    case 'resolve':
      return await resolveAlert(alertData.alertId, alertData.userId);
    case 'list':
      return await listAlerts(alertData.filters);
    default:
      throw new Error('Invalid alert action');
  }
}

async function createAlert(alertData) {
  const alertRecord = {
    alert_name: alertData.name,
    alert_type: alertData.type || 'manual',
    severity: alertData.severity || 'medium',
    message: alertData.message,
    triggered_at: new Date().toISOString(),
    source: alertData.source || 'system',
    is_active: true,
    acknowledged: false,
    resolved: false,
    metadata: JSON.stringify(alertData.metadata || {})
  };

  try {
    await window.ezsite.apis.tableCreate('error_alerts', alertRecord);
    return { success: true, message: 'Alert created successfully' };
  } catch (error) {
    throw new Error(`Failed to create alert: ${error.message}`);
  }
}

async function acknowledgeAlert(alertId, userId) {
  try {
    const alerts = await window.ezsite.apis.tablePage('error_alerts', {
      PageNo: 1,
      PageSize: 1,
      Filters: [{ name: 'ID', op: 'Equal', value: alertId }]
    });

    if (!alerts.data || alerts.data.List.length === 0) {
      throw new Error('Alert not found');
    }

    await window.ezsite.apis.tableUpdate('error_alerts', {
      ID: alertId,
      acknowledged: true,
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: userId
    });

    return { success: true, message: 'Alert acknowledged successfully' };
  } catch (error) {
    throw new Error(`Failed to acknowledge alert: ${error.message}`);
  }
}

async function resolveAlert(alertId, userId) {
  try {
    const alerts = await window.ezsite.apis.tablePage('error_alerts', {
      PageNo: 1,
      PageSize: 1,
      Filters: [{ name: 'ID', op: 'Equal', value: alertId }]
    });

    if (!alerts.data || alerts.data.List.length === 0) {
      throw new Error('Alert not found');
    }

    await window.ezsite.apis.tableUpdate('error_alerts', {
      ID: alertId,
      resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by: userId,
      is_active: false
    });

    return { success: true, message: 'Alert resolved successfully' };
  } catch (error) {
    throw new Error(`Failed to resolve alert: ${error.message}`);
  }
}

async function listAlerts(filters = {}) {
  try {
    const queryFilters = [];
    
    if (filters.severity) {
      queryFilters.push({ name: 'severity', op: 'Equal', value: filters.severity });
    }
    
    if (filters.isActive !== undefined) {
      queryFilters.push({ name: 'is_active', op: 'Equal', value: filters.isActive });
    }
    
    if (filters.acknowledged !== undefined) {
      queryFilters.push({ name: 'acknowledged', op: 'Equal', value: filters.acknowledged });
    }

    const alerts = await window.ezsite.apis.tablePage('error_alerts', {
      PageNo: filters.pageNo || 1,
      PageSize: filters.pageSize || 50,
      OrderByField: 'triggered_at',
      IsAsc: false,
      Filters: queryFilters
    });

    return {
      alerts: alerts.data?.List || [],
      total: alerts.data?.VirtualCount || 0
    };
  } catch (error) {
    throw new Error(`Failed to list alerts: ${error.message}`);
  }
}
