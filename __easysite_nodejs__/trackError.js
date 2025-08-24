
async function trackError(errorData) {
  const timestamp = new Date().toISOString();

  const errorRecord = {
    error_id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    error_message: errorData.message || 'Unknown error',
    error_type: errorData.type || 'UnknownError',
    stack_trace: errorData.stack || null,
    user_id: errorData.userId || null,
    session_id: errorData.sessionId || null,
    url: errorData.url || null,
    user_agent: errorData.userAgent || null,
    timestamp: timestamp,
    severity: errorData.severity || 'medium',
    environment: process.env.NODE_ENV || 'development',
    component: errorData.component || 'unknown',
    additional_data: JSON.stringify(errorData.additionalData || {})
  };

  try {
    // Store in error_tracking table
    await window.ezsite.apis.tableCreate('error_tracking', errorRecord);

    // Update error statistics
    await updateErrorStatistics(errorRecord);

    // Check if alert should be triggered
    await checkErrorAlerts(errorRecord);

    return { success: true, errorId: errorRecord.error_id };
  } catch (error) {
    console.error('Failed to track error:', error);
    throw new Error('Error tracking failed');
  }
}

async function updateErrorStatistics(errorRecord) {
  const today = new Date().toISOString().split('T')[0];

  try {
    // Try to update existing stats for today
    const existingStats = await window.ezsite.apis.tablePage('error_statistics', {
      PageNo: 1,
      PageSize: 1,
      Filters: [
      { name: 'date', op: 'Equal', value: today },
      { name: 'error_type', op: 'Equal', value: errorRecord.error_type }]

    });

    if (existingStats.data && existingStats.data.List.length > 0) {
      const stats = existingStats.data.List[0];
      await window.ezsite.apis.tableUpdate('error_statistics', {
        ID: stats.ID,
        count: stats.count + 1,
        last_occurrence: errorRecord.timestamp
      });
    } else {
      // Create new stats record
      await window.ezsite.apis.tableCreate('error_statistics', {
        date: today,
        error_type: errorRecord.error_type,
        count: 1,
        severity: errorRecord.severity,
        first_occurrence: errorRecord.timestamp,
        last_occurrence: errorRecord.timestamp
      });
    }
  } catch (error) {
    console.error('Failed to update error statistics:', error);
  }
}

async function checkErrorAlerts(errorRecord) {
  try {
    // Check if this error type should trigger an alert
    const alertConfigs = await window.ezsite.apis.tablePage('error_alerts', {
      PageNo: 1,
      PageSize: 10,
      Filters: [
      { name: 'error_type', op: 'Equal', value: errorRecord.error_type },
      { name: 'is_active', op: 'Equal', value: true }]

    });

    if (alertConfigs.data && alertConfigs.data.List.length > 0) {
      for (const config of alertConfigs.data.List) {
        // Check threshold logic
        if (shouldTriggerAlert(config, errorRecord)) {
          await triggerAlert(config, errorRecord);
        }
      }
    }
  } catch (error) {
    console.error('Failed to check error alerts:', error);
  }
}

function shouldTriggerAlert(config, errorRecord) {
  // Simple threshold check - in real implementation, this would be more sophisticated
  return config.threshold <= 1 || Math.random() > 0.95; // Trigger 5% of the time for demo
}

async function triggerAlert(config, errorRecord) {
  // In real implementation, this would send emails, Slack notifications, etc.
  console.warn(`ALERT TRIGGERED: ${config.alert_name} - ${errorRecord.error_message}`);

  // Log the alert
  try {
    await window.ezsite.apis.tableCreate('error_alerts', {
      alert_name: `${config.alert_name} - Triggered`,
      alert_type: 'error_threshold',
      severity: errorRecord.severity,
      message: `Error threshold exceeded for ${errorRecord.error_type}`,
      triggered_at: new Date().toISOString(),
      error_id: errorRecord.error_id,
      is_active: true,
      acknowledged: false
    });
  } catch (error) {
    console.error('Failed to log alert:', error);
  }
}