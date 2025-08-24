
async function aggregateLogs(timeRange = '1h') {
  const endTime = new Date();
  const startTime = new Date();
  
  // Calculate start time based on range
  switch (timeRange) {
    case '1h':
      startTime.setHours(startTime.getHours() - 1);
      break;
    case '24h':
      startTime.setHours(startTime.getHours() - 24);
      break;
    case '7d':
      startTime.setDate(startTime.getDate() - 7);
      break;
    default:
      startTime.setHours(startTime.getHours() - 1);
  }

  try {
    // Aggregate error logs
    const errorLogs = await window.ezsite.apis.tablePage('error_logs', {
      PageNo: 1,
      PageSize: 1000,
      Filters: [
        { name: 'timestamp', op: 'GreaterThanOrEqual', value: startTime.toISOString() },
        { name: 'timestamp', op: 'LessThanOrEqual', value: endTime.toISOString() }
      ],
      OrderByField: 'timestamp',
      IsAsc: false
    });

    // Aggregate performance metrics
    const performanceMetrics = await window.ezsite.apis.tablePage('performance_metrics', {
      PageNo: 1,
      PageSize: 1000,
      Filters: [
        { name: 'timestamp', op: 'GreaterThanOrEqual', value: startTime.toISOString() },
        { name: 'timestamp', op: 'LessThanOrEqual', value: endTime.toISOString() }
      ],
      OrderByField: 'timestamp',
      IsAsc: false
    });

    // Process and analyze the data
    const analysis = {
      timeRange: {
        start: startTime.toISOString(),
        end: endTime.toISOString(),
        duration: timeRange
      },
      errors: {
        total: errorLogs.data?.VirtualCount || 0,
        byType: aggregateByField(errorLogs.data?.List || [], 'error_type'),
        bySeverity: aggregateByField(errorLogs.data?.List || [], 'severity'),
        trend: calculateTrend(errorLogs.data?.List || [], 'timestamp')
      },
      performance: {
        total: performanceMetrics.data?.VirtualCount || 0,
        byMetric: aggregateByField(performanceMetrics.data?.List || [], 'metric_name'),
        averages: calculateAverages(performanceMetrics.data?.List || []),
        trend: calculateTrend(performanceMetrics.data?.List || [], 'timestamp')
      },
      health: {
        overallStatus: calculateOverallHealth(errorLogs.data?.List || [], performanceMetrics.data?.List || []),
        criticalIssues: findCriticalIssues(errorLogs.data?.List || []),
        recommendations: generateRecommendations(errorLogs.data?.List || [], performanceMetrics.data?.List || [])
      },
      generatedAt: new Date().toISOString()
    };

    return analysis;
  } catch (error) {
    console.error('Failed to aggregate logs:', error);
    throw new Error('Log aggregation failed');
  }
}

function aggregateByField(data, field) {
  const aggregation = {};
  data.forEach(item => {
    const value = item[field] || 'unknown';
    aggregation[value] = (aggregation[value] || 0) + 1;
  });
  return aggregation;
}

function calculateTrend(data, timeField) {
  if (data.length === 0) return 'stable';
  
  // Simple trend calculation based on time distribution
  const sorted = data.sort((a, b) => new Date(a[timeField]) - new Date(b[timeField]));
  const half = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, half);
  const secondHalf = sorted.slice(half);
  
  if (secondHalf.length > firstHalf.length * 1.2) return 'increasing';
  if (secondHalf.length < firstHalf.length * 0.8) return 'decreasing';
  return 'stable';
}

function calculateAverages(metrics) {
  const averages = {};
  const counts = {};
  
  metrics.forEach(metric => {
    const name = metric.metric_name;
    const value = parseFloat(metric.metric_value);
    
    if (!isNaN(value)) {
      averages[name] = (averages[name] || 0) + value;
      counts[name] = (counts[name] || 0) + 1;
    }
  });
  
  Object.keys(averages).forEach(name => {
    averages[name] = averages[name] / counts[name];
  });
  
  return averages;
}

function calculateOverallHealth(errors, metrics) {
  const criticalErrors = errors.filter(e => e.severity === 'critical').length;
  const totalErrors = errors.length;
  
  if (criticalErrors > 0) return 'critical';
  if (totalErrors > 10) return 'warning';
  return 'healthy';
}

function findCriticalIssues(errors) {
  return errors
    .filter(error => error.severity === 'critical')
    .map(error => ({
      id: error.error_id,
      message: error.error_message,
      timestamp: error.timestamp,
      type: error.error_type
    }));
}

function generateRecommendations(errors, metrics) {
  const recommendations = [];
  
  // Check error patterns
  const errorTypes = aggregateByField(errors, 'error_type');
  Object.entries(errorTypes).forEach(([type, count]) => {
    if (count > 5) {
      recommendations.push(`High frequency of ${type} errors (${count}). Consider investigating the root cause.`);
    }
  });
  
  // Check performance metrics
  const avgResponseTime = calculateAverages(metrics.filter(m => m.metric_name === 'response_time'))['response_time'];
  if (avgResponseTime > 1000) {
    recommendations.push(`Average response time is high (${avgResponseTime.toFixed(0)}ms). Consider performance optimization.`);
  }
  
  if (recommendations.length === 0) {
    recommendations.push('System is performing well. Continue monitoring.');
  }
  
  return recommendations;
}
