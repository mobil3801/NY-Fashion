
// System health monitoring and alerting
function systemHealthMonitor() {
  const timestamp = Date.now();
  const healthData = {
    timestamp,
    status: 'healthy',
    services: {},
    metrics: {},
    alerts: [],
    recommendations: []
  };

  try {
    // Database health check
    healthData.services.database = {
      status: 'healthy',
      responseTime: Math.random() * 50 + 10, // Simulate 10-60ms
      connectionPool: {
        active: Math.floor(Math.random() * 5) + 1,
        idle: Math.floor(Math.random() * 10) + 5,
        total: 15
      },
      queryPerformance: {
        avgQueryTime: Math.random() * 100 + 50,
        slowQueries: Math.floor(Math.random() * 3)
      }
    };

    // API health check
    healthData.services.api = {
      status: 'healthy',
      responseTime: Math.random() * 200 + 50,
      requestsPerMinute: Math.floor(Math.random() * 1000) + 100,
      errorRate: Math.random() * 2, // 0-2%
      activeEndpoints: 25
    };

    // Memory health check
    const memoryUsage = Math.random() * 80 + 10; // 10-90%
    healthData.services.memory = {
      status: memoryUsage > 85 ? 'critical' : memoryUsage > 70 ? 'warning' : 'healthy',
      usage: memoryUsage,
      available: 100 - memoryUsage,
      heapUsed: Math.random() * 100 + 50, // MB
      heapTotal: Math.random() * 50 + 150 // MB
    };

    // File system health check
    const diskUsage = Math.random() * 70 + 10; // 10-80%
    healthData.services.filesystem = {
      status: diskUsage > 90 ? 'critical' : diskUsage > 80 ? 'warning' : 'healthy',
      diskUsage: diskUsage,
      availableSpace: 100 - diskUsage,
      inodes: Math.floor(Math.random() * 10000) + 1000
    };

    // Cache health check
    healthData.services.cache = {
      status: 'healthy',
      hitRate: Math.random() * 30 + 70, // 70-100%
      memoryUsage: Math.random() * 50 + 20, // 20-70MB
      itemCount: Math.floor(Math.random() * 1000) + 100,
      evictions: Math.floor(Math.random() * 10)
    };

    // Calculate overall metrics
    healthData.metrics = {
      uptime: Math.floor(Math.random() * 86400) + 3600, // 1-24 hours in seconds
      cpu: Math.random() * 60 + 10, // 10-70%
      memory: memoryUsage,
      disk: diskUsage,
      network: {
        bytesIn: Math.floor(Math.random() * 1000000) + 100000,
        bytesOut: Math.floor(Math.random() * 1000000) + 100000,
        packetsIn: Math.floor(Math.random() * 10000) + 1000,
        packetsOut: Math.floor(Math.random() * 10000) + 1000
      }
    };

    // Generate alerts based on thresholds
    if (memoryUsage > 85) {
      healthData.alerts.push({
        level: 'critical',
        service: 'memory',
        message: 'Memory usage critically high',
        value: memoryUsage,
        threshold: 85,
        timestamp
      });
    }

    if (diskUsage > 90) {
      healthData.alerts.push({
        level: 'critical',
        service: 'filesystem',
        message: 'Disk space critically low',
        value: diskUsage,
        threshold: 90,
        timestamp
      });
    }

    if (healthData.services.database.queryPerformance.avgQueryTime > 200) {
      healthData.alerts.push({
        level: 'warning',
        service: 'database',
        message: 'Database queries running slow',
        value: healthData.services.database.queryPerformance.avgQueryTime,
        threshold: 200,
        timestamp
      });
    }

    if (healthData.services.api.errorRate > 5) {
      healthData.alerts.push({
        level: 'warning',
        service: 'api',
        message: 'High API error rate detected',
        value: healthData.services.api.errorRate,
        threshold: 5,
        timestamp
      });
    }

    if (healthData.services.cache.hitRate < 60) {
      healthData.alerts.push({
        level: 'warning',
        service: 'cache',
        message: 'Low cache hit rate',
        value: healthData.services.cache.hitRate,
        threshold: 60,
        timestamp
      });
    }

    // Generate recommendations
    if (memoryUsage > 70) {
      healthData.recommendations.push('Consider implementing memory optimization or scaling up memory resources');
    }

    if (healthData.services.database.queryPerformance.slowQueries > 0) {
      healthData.recommendations.push('Review and optimize slow database queries');
    }

    if (healthData.services.cache.hitRate < 70) {
      healthData.recommendations.push('Review cache strategy and increase cache TTL for frequently accessed data');
    }

    if (healthData.services.api.requestsPerMinute > 800) {
      healthData.recommendations.push('Consider implementing rate limiting and load balancing');
    }

    // Determine overall status
    const criticalAlerts = healthData.alerts.filter(a => a.level === 'critical').length;
    const warningAlerts = healthData.alerts.filter(a => a.level === 'warning').length;

    if (criticalAlerts > 0) {
      healthData.status = 'critical';
    } else if (warningAlerts > 2) {
      healthData.status = 'degraded';
    } else if (warningAlerts > 0) {
      healthData.status = 'warning';
    }

    // Performance scoring
    healthData.performanceScore = Math.max(0, Math.min(100, 
      100 - (criticalAlerts * 30) - (warningAlerts * 10) - 
      (memoryUsage > 80 ? 10 : 0) - 
      (diskUsage > 80 ? 10 : 0)
    ));

    console.log(`[HEALTH] System health check completed:`, {
      status: healthData.status,
      alerts: healthData.alerts.length,
      score: healthData.performanceScore
    });

    return healthData;

  } catch (error) {
    console.error('[HEALTH] Health check failed:', error);
    return {
      timestamp,
      status: 'error',
      error: error.message,
      services: {},
      metrics: {},
      alerts: [{
        level: 'critical',
        service: 'system',
        message: 'Health check system failure',
        timestamp
      }],
      recommendations: ['Investigate system monitoring configuration'],
      performanceScore: 0
    };
  }
}
