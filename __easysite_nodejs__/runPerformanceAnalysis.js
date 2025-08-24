
async function runPerformanceAnalysis(timeWindow = '1h') {
  const endTime = new Date();
  const startTime = new Date();

  // Set time window
  switch (timeWindow) {
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
    // Fetch performance metrics from the time window
    const metrics = await window.ezsite.apis.tablePage('performance_metrics', {
      PageNo: 1,
      PageSize: 1000,
      Filters: [
      { name: 'timestamp', op: 'GreaterThanOrEqual', value: startTime.toISOString() },
      { name: 'timestamp', op: 'LessThanOrEqual', value: endTime.toISOString() }],

      OrderByField: 'timestamp',
      IsAsc: false
    });

    const performanceData = metrics.data?.List || [];

    // Analyze the data
    const analysis = {
      timeWindow,
      period: {
        start: startTime.toISOString(),
        end: endTime.toISOString()
      },
      summary: calculatePerformanceSummary(performanceData),
      trends: calculatePerformanceTrends(performanceData),
      anomalies: detectPerformanceAnomalies(performanceData),
      recommendations: generatePerformanceRecommendations(performanceData),
      health_score: calculateHealthScore(performanceData),
      generated_at: new Date().toISOString()
    };

    // Store analysis results
    await storeAnalysisResults(analysis);

    // Check for alerts
    await checkPerformanceAlerts(analysis);

    return analysis;
  } catch (error) {
    console.error('Performance analysis failed:', error);
    throw new Error(`Performance analysis failed: ${error.message}`);
  }
}

function calculatePerformanceSummary(data) {
  const summary = {
    total_metrics: data.length,
    metric_types: {},
    avg_values: {},
    max_values: {},
    min_values: {}
  };

  // Group by metric name
  const groupedMetrics = {};
  data.forEach((metric) => {
    const name = metric.metric_name;
    if (!groupedMetrics[name]) {
      groupedMetrics[name] = [];
    }
    groupedMetrics[name].push(parseFloat(metric.metric_value) || 0);
  });

  // Calculate statistics for each metric
  Object.entries(groupedMetrics).forEach(([name, values]) => {
    summary.metric_types[name] = values.length;
    summary.avg_values[name] = values.reduce((a, b) => a + b, 0) / values.length;
    summary.max_values[name] = Math.max(...values);
    summary.min_values[name] = Math.min(...values);
  });

  return summary;
}

function calculatePerformanceTrends(data) {
  // Simple trend analysis - compare first and second half of data
  if (data.length < 4) return { overall: 'stable' };

  const sorted = data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const midpoint = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, midpoint);
  const secondHalf = sorted.slice(midpoint);

  const trends = {};

  // Group by metric name for trend analysis
  const firstHalfMetrics = groupByMetric(firstHalf);
  const secondHalfMetrics = groupByMetric(secondHalf);

  Object.keys(firstHalfMetrics).forEach((metricName) => {
    const firstAvg = average(firstHalfMetrics[metricName]);
    const secondAvg = average(secondHalfMetrics[metricName] || []);

    if (secondAvg > firstAvg * 1.1) {
      trends[metricName] = 'increasing';
    } else if (secondAvg < firstAvg * 0.9) {
      trends[metricName] = 'decreasing';
    } else {
      trends[metricName] = 'stable';
    }
  });

  return trends;
}

function detectPerformanceAnomalies(data) {
  const anomalies = [];
  const groupedMetrics = groupByMetric(data);

  Object.entries(groupedMetrics).forEach(([metricName, values]) => {
    const avg = average(values);
    const stdDev = standardDeviation(values);
    const threshold = avg + 2 * stdDev; // 2 sigma rule

    values.forEach((value, index) => {
      if (value > threshold) {
        anomalies.push({
          metric_name: metricName,
          value: value,
          expected_range: [avg - stdDev, avg + stdDev],
          severity: value > avg + 3 * stdDev ? 'high' : 'medium',
          detected_at: new Date().toISOString()
        });
      }
    });
  });

  return anomalies;
}

function generatePerformanceRecommendations(data) {
  const recommendations = [];
  const groupedMetrics = groupByMetric(data);

  // Check response times
  if (groupedMetrics.response_time) {
    const avgResponseTime = average(groupedMetrics.response_time);
    if (avgResponseTime > 1000) {
      recommendations.push({
        category: 'performance',
        priority: 'high',
        message: `Average response time is ${avgResponseTime.toFixed(0)}ms. Consider optimizing database queries and caching strategies.`
      });
    }
  }

  // Check memory usage
  if (groupedMetrics.memory_usage) {
    const avgMemoryUsage = average(groupedMetrics.memory_usage);
    if (avgMemoryUsage > 80) {
      recommendations.push({
        category: 'resources',
        priority: 'medium',
        message: `Memory usage is averaging ${avgMemoryUsage.toFixed(1)}%. Consider increasing memory allocation or optimizing memory usage.`
      });
    }
  }

  // Check error rates
  if (groupedMetrics.error_rate) {
    const avgErrorRate = average(groupedMetrics.error_rate);
    if (avgErrorRate > 5) {
      recommendations.push({
        category: 'reliability',
        priority: 'high',
        message: `Error rate is ${avgErrorRate.toFixed(2)}%. Investigate recent deployments and monitor error logs.`
      });
    }
  }

  if (recommendations.length === 0) {
    recommendations.push({
      category: 'general',
      priority: 'info',
      message: 'System performance is within normal parameters. Continue monitoring.'
    });
  }

  return recommendations;
}

function calculateHealthScore(data) {
  let score = 100;
  const groupedMetrics = groupByMetric(data);

  // Penalize high response times
  if (groupedMetrics.response_time) {
    const avgResponseTime = average(groupedMetrics.response_time);
    if (avgResponseTime > 2000) score -= 30;else
    if (avgResponseTime > 1000) score -= 15;else
    if (avgResponseTime > 500) score -= 5;
  }

  // Penalize high error rates
  if (groupedMetrics.error_rate) {
    const avgErrorRate = average(groupedMetrics.error_rate);
    if (avgErrorRate > 10) score -= 40;else
    if (avgErrorRate > 5) score -= 20;else
    if (avgErrorRate > 1) score -= 10;
  }

  // Penalize high resource usage
  if (groupedMetrics.cpu_usage) {
    const avgCpuUsage = average(groupedMetrics.cpu_usage);
    if (avgCpuUsage > 90) score -= 25;else
    if (avgCpuUsage > 70) score -= 10;
  }

  return Math.max(0, Math.min(100, score));
}

async function storeAnalysisResults(analysis) {
  try {
    await window.ezsite.apis.tableCreate('performance_metrics', {
      metric_name: 'performance_analysis',
      metric_value: analysis.health_score.toString(),
      metric_type: 'analysis',
      timestamp: analysis.generated_at,
      source: 'performance_analyzer',
      additional_data: JSON.stringify(analysis)
    });
  } catch (error) {
    console.error('Failed to store analysis results:', error);
  }
}

async function checkPerformanceAlerts(analysis) {
  if (analysis.health_score < 70) {
    try {
      await window.ezsite.apis.run({
        path: "manageAlerts",
        param: ["create", {
          name: "Performance Degradation Alert",
          type: "performance",
          severity: analysis.health_score < 50 ? "critical" : "high",
          message: `System health score dropped to ${analysis.health_score}. ${analysis.recommendations[0]?.message || 'Investigation required.'}`,
          source: "performance_analyzer",
          metadata: {
            health_score: analysis.health_score,
            anomalies_count: analysis.anomalies.length
          }
        }]
      });
    } catch (error) {
      console.error('Failed to create performance alert:', error);
    }
  }
}

// Helper functions
function groupByMetric(data) {
  const grouped = {};
  data.forEach((item) => {
    const name = item.metric_name;
    if (!grouped[name]) grouped[name] = [];
    grouped[name].push(parseFloat(item.metric_value) || 0);
  });
  return grouped;
}

function average(values) {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function standardDeviation(values) {
  const avg = average(values);
  const squaredDiffs = values.map((value) => Math.pow(value - avg, 2));
  return Math.sqrt(average(squaredDiffs));
}