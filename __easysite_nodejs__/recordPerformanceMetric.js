
async function recordPerformanceMetric(metricData) {
  const timestamp = new Date().toISOString();

  const performanceRecord = {
    metric_id: `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    metric_name: metricData.name,
    metric_value: metricData.value,
    metric_type: metricData.type || 'gauge', // gauge, counter, histogram
    tags: JSON.stringify(metricData.tags || {}),
    timestamp: timestamp,
    source: metricData.source || 'application',
    environment: process.env.NODE_ENV || 'development',
    additional_data: JSON.stringify(metricData.additionalData || {})
  };

  try {
    // Store in performance_metrics table
    await window.ezsite.apis.tableCreate('performance_metrics', performanceRecord);

    // Check performance thresholds
    await checkPerformanceThresholds(performanceRecord);

    return { success: true, metricId: performanceRecord.metric_id };
  } catch (error) {
    console.error('Failed to record performance metric:', error);
    throw new Error('Performance metric recording failed');
  }
}

async function checkPerformanceThresholds(metricRecord) {
  try {
    // Get thresholds for this metric
    const thresholds = await window.ezsite.apis.tablePage('performance_thresholds', {
      PageNo: 1,
      PageSize: 10,
      Filters: [
      { name: 'metric_name', op: 'Equal', value: metricRecord.metric_name },
      { name: 'is_active', op: 'Equal', value: true }]

    });

    if (thresholds.data && thresholds.data.List.length > 0) {
      for (const threshold of thresholds.data.List) {
        if (isThresholdExceeded(threshold, metricRecord)) {
          await triggerPerformanceAlert(threshold, metricRecord);
        }
      }
    }
  } catch (error) {
    console.error('Failed to check performance thresholds:', error);
  }
}

function isThresholdExceeded(threshold, metricRecord) {
  const value = parseFloat(metricRecord.metric_value);
  const thresholdValue = parseFloat(threshold.threshold_value);

  switch (threshold.comparison_operator) {
    case 'gt':return value > thresholdValue;
    case 'gte':return value >= thresholdValue;
    case 'lt':return value < thresholdValue;
    case 'lte':return value <= thresholdValue;
    case 'eq':return value === thresholdValue;
    default:return false;
  }
}

async function triggerPerformanceAlert(threshold, metricRecord) {
  try {
    await window.ezsite.apis.tableCreate('performance_alerts', {
      alert_name: `Performance Alert: ${threshold.metric_name}`,
      alert_type: 'performance_threshold',
      severity: threshold.severity || 'medium',
      message: `${threshold.metric_name} exceeded threshold: ${metricRecord.metric_value} ${threshold.comparison_operator} ${threshold.threshold_value}`,
      triggered_at: new Date().toISOString(),
      metric_id: metricRecord.metric_id,
      threshold_id: threshold.ID,
      is_active: true,
      acknowledged: false
    });
  } catch (error) {
    console.error('Failed to trigger performance alert:', error);
  }
}