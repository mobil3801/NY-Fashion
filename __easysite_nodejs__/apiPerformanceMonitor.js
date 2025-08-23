
function createAPIPerformanceMonitor() {
  const metrics = {
    requests: [],
    slowQueries: [],
    errors: [],
    healthChecks: [],
    alertThresholds: {
      responseTime: 2000, // 2 seconds
      errorRate: 0.05, // 5%
      memoryUsage: 0.8, // 80%
      cpuUsage: 0.7 // 70%
    }
  };

  function recordAPICall(endpoint, method, startTime, endTime, success, error = null, metadata = {}) {
    const duration = endTime - startTime;
    const callData = {
      id: `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      endpoint,
      method: method || 'GET',
      duration,
      success,
      error,
      timestamp: startTime,
      metadata: {
        ...metadata,
        userAgent: metadata.userAgent || 'Unknown',
        ip: metadata.ip || 'Unknown'
      }
    };

    // Store the call
    metrics.requests.push(callData);

    // Track slow queries
    if (duration > metrics.alertThresholds.responseTime) {
      metrics.slowQueries.push(callData);
      
      // Keep only last 100 slow queries
      if (metrics.slowQueries.length > 100) {
        metrics.slowQueries = metrics.slowQueries.slice(-100);
      }
    }

    // Track errors
    if (!success && error) {
      metrics.errors.push(callData);
      
      // Keep only last 100 errors
      if (metrics.errors.length > 100) {
        metrics.errors = metrics.errors.slice(-100);
      }
    }

    // Limit total requests stored (keep last 1000)
    if (metrics.requests.length > 1000) {
      metrics.requests = metrics.requests.slice(-1000);
    }

    return callData;
  }

  function getPerformanceMetrics(timeWindow = 3600000) { // 1 hour default
    const now = Date.now();
    const cutoff = now - timeWindow;
    
    const recentRequests = metrics.requests.filter(req => req.timestamp >= cutoff);
    const recentErrors = metrics.errors.filter(err => err.timestamp >= cutoff);
    const recentSlowQueries = metrics.slowQueries.filter(sq => sq.timestamp >= cutoff);

    // Calculate metrics
    const totalRequests = recentRequests.length;
    const totalErrors = recentErrors.length;
    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) : 0;
    
    const successfulRequests = recentRequests.filter(req => req.success);
    const averageResponseTime = successfulRequests.length > 0 
      ? successfulRequests.reduce((sum, req) => sum + req.duration, 0) / successfulRequests.length
      : 0;

    const p95ResponseTime = calculatePercentile(successfulRequests.map(req => req.duration), 95);
    const p99ResponseTime = calculatePercentile(successfulRequests.map(req => req.duration), 99);

    // Group by endpoint
    const endpointMetrics = groupRequestsByEndpoint(recentRequests);
    
    // Top slow endpoints
    const slowEndpoints = Object.entries(endpointMetrics)
      .map(([endpoint, data]) => ({
        endpoint,
        averageTime: data.averageTime,
        requestCount: data.requestCount,
        errorRate: data.errorRate
      }))
      .sort((a, b) => b.averageTime - a.averageTime)
      .slice(0, 10);

    // Recent health status
    const healthStatus = getSystemHealth();

    return {
      timeWindow: timeWindow,
      totalRequests,
      totalErrors,
      errorRate: Math.round(errorRate * 10000) / 100, // Percentage with 2 decimals
      averageResponseTime: Math.round(averageResponseTime),
      p95ResponseTime: Math.round(p95ResponseTime),
      p99ResponseTime: Math.round(p99ResponseTime),
      slowQueriesCount: recentSlowQueries.length,
      endpointMetrics,
      slowEndpoints,
      healthStatus,
      alerts: generateAlerts(errorRate, averageResponseTime, recentSlowQueries.length),
      timestamp: now
    };
  }

  function calculatePercentile(values, percentile) {
    if (values.length === 0) return 0;
    
    const sorted = values.sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }

  function groupRequestsByEndpoint(requests) {
    const grouped = {};
    
    requests.forEach(req => {
      if (!grouped[req.endpoint]) {
        grouped[req.endpoint] = {
          requestCount: 0,
          totalTime: 0,
          errors: 0,
          methods: new Set()
        };
      }
      
      const group = grouped[req.endpoint];
      group.requestCount++;
      group.totalTime += req.duration;
      group.methods.add(req.method);
      
      if (!req.success) {
        group.errors++;
      }
    });

    // Calculate derived metrics
    Object.keys(grouped).forEach(endpoint => {
      const group = grouped[endpoint];
      group.averageTime = Math.round(group.totalTime / group.requestCount);
      group.errorRate = Math.round((group.errors / group.requestCount) * 10000) / 100;
      group.methods = Array.from(group.methods);
    });

    return grouped;
  }

  function getSystemHealth() {
    try {
      // Basic system health indicators
      const memoryUsage = typeof process !== 'undefined' && process.memoryUsage ? 
        process.memoryUsage() : null;
      
      const uptime = typeof process !== 'undefined' && process.uptime ? 
        process.uptime() : null;

      return {
        status: 'healthy',
        memory: memoryUsage ? {
          rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB',
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB'
        } : null,
        uptime: uptime ? Math.round(uptime) + 's' : null,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        status: 'unknown',
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  function generateAlerts(errorRate, averageResponseTime, slowQueryCount) {
    const alerts = [];

    if (errorRate > metrics.alertThresholds.errorRate) {
      alerts.push({
        type: 'ERROR_RATE',
        severity: 'HIGH',
        message: `Error rate ${(errorRate * 100).toFixed(2)}% exceeds threshold ${(metrics.alertThresholds.errorRate * 100).toFixed(2)}%`,
        value: errorRate,
        threshold: metrics.alertThresholds.errorRate
      });
    }

    if (averageResponseTime > metrics.alertThresholds.responseTime) {
      alerts.push({
        type: 'RESPONSE_TIME',
        severity: 'MEDIUM',
        message: `Average response time ${averageResponseTime}ms exceeds threshold ${metrics.alertThresholds.responseTime}ms`,
        value: averageResponseTime,
        threshold: metrics.alertThresholds.responseTime
      });
    }

    if (slowQueryCount > 10) {
      alerts.push({
        type: 'SLOW_QUERIES',
        severity: 'MEDIUM',
        message: `${slowQueryCount} slow queries detected in the last hour`,
        value: slowQueryCount,
        threshold: 10
      });
    }

    return alerts;
  }

  function recordHealthCheck(checkName, success, duration, details = {}) {
    const healthCheck = {
      id: `health_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      checkName,
      success,
      duration,
      details,
      timestamp: Date.now()
    };

    metrics.healthChecks.push(healthCheck);

    // Keep only last 100 health checks
    if (metrics.healthChecks.length > 100) {
      metrics.healthChecks = metrics.healthChecks.slice(-100);
    }

    return healthCheck;
  }

  function getDetailedReport(timeWindow = 3600000) {
    const performanceMetrics = getPerformanceMetrics(timeWindow);
    const now = Date.now();
    const cutoff = now - timeWindow;

    const recentHealthChecks = metrics.healthChecks.filter(hc => hc.timestamp >= cutoff);
    
    return {
      ...performanceMetrics,
      healthChecks: {
        total: recentHealthChecks.length,
        successful: recentHealthChecks.filter(hc => hc.success).length,
        failed: recentHealthChecks.filter(hc => !hc.success).length,
        checks: recentHealthChecks.slice(-20) // Last 20 checks
      },
      recentErrors: metrics.errors.slice(-10).map(error => ({
        endpoint: error.endpoint,
        method: error.method,
        error: error.error,
        timestamp: error.timestamp,
        duration: error.duration
      })),
      recentSlowQueries: metrics.slowQueries.slice(-10).map(query => ({
        endpoint: query.endpoint,
        method: query.method,
        duration: query.duration,
        timestamp: query.timestamp
      }))
    };
  }

  function clearMetrics() {
    metrics.requests = [];
    metrics.slowQueries = [];
    metrics.errors = [];
    metrics.healthChecks = [];
    
    return { success: true, message: 'All metrics cleared' };
  }

  function updateThresholds(newThresholds) {
    metrics.alertThresholds = { ...metrics.alertThresholds, ...newThresholds };
    return { success: true, thresholds: metrics.alertThresholds };
  }

  // Return the API monitoring interface
  return {
    recordAPICall,
    recordHealthCheck,
    getPerformanceMetrics,
    getDetailedReport,
    clearMetrics,
    updateThresholds,
    getSystemHealth
  };
}

// Create global monitor instance
const apiMonitor = createAPIPerformanceMonitor();

// Main function for getting API performance metrics
function getAPIPerformanceMetrics(timeWindow = 3600000) {
  return apiMonitor.getPerformanceMetrics(timeWindow);
}

// Function for getting detailed performance report
function getDetailedPerformanceReport(timeWindow = 3600000) {
  return apiMonitor.getDetailedReport(timeWindow);
}

// Function for recording API calls (to be used by other API functions)
function recordAPICall(endpoint, method, startTime, endTime, success, error = null, metadata = {}) {
  return apiMonitor.recordAPICall(endpoint, method, startTime, endTime, success, error, metadata);
}

// Function for recording health checks
function recordHealthCheck(checkName, success, duration, details = {}) {
  return apiMonitor.recordHealthCheck(checkName, success, duration, details);
}

// Function for clearing all metrics
function clearAPIMetrics() {
  return apiMonitor.clearMetrics();
}

// Function for updating alert thresholds
function updateAPIThresholds(newThresholds) {
  return apiMonitor.updateThresholds(newThresholds);
}
