
function getSystemStatus() {
  const startTime = Date.now();

  try {
    const status = {
      timestamp: new Date().toISOString(),
      uptime: Date.now(), // Simplified uptime
      services: {},
      performance: {},
      alerts: [],
      version: '1.0.0'
    };

    // Check Database Service
    status.services.database = checkDatabaseService();

    // Check API Services
    status.services.api = checkAPIServices();

    // Check File System
    status.services.filesystem = checkFileSystem();

    // Performance Metrics
    status.performance = getPerformanceMetrics();

    // Generate Alerts
    status.alerts = generateSystemAlerts(status);

    // Overall System Health
    status.overallHealth = calculateOverallHealth(status);

    // Response Time
    status.responseTime = Date.now() - startTime;

    return status;

  } catch (error) {
    return {
      timestamp: new Date().toISOString(),
      overallHealth: 'CRITICAL',
      error: error.message,
      responseTime: Date.now() - startTime,
      services: {},
      performance: {},
      alerts: [{
        type: 'SYSTEM_ERROR',
        severity: 'CRITICAL',
        message: 'System status check failed: ' + error.message
      }]
    };
  }
}

function checkDatabaseService() {
  const startTime = Date.now();

  try {
    // Test basic connectivity
    const testResult = window.ezsite.db.query('SELECT 1 as test', []);
    const responseTime = Date.now() - startTime;

    if (!testResult || testResult.length === 0) {
      return {
        status: 'DOWN',
        responseTime,
        error: 'Database connectivity test failed'
      };
    }

    // Test table accessibility
    const tableTests = [];
    const criticalTables = ['products', 'customers', 'sales', 'employees'];

    for (const table of criticalTables) {
      try {
        const count = window.ezsite.db.query(`SELECT COUNT(*) as count FROM ${table} LIMIT 1`, []);
        tableTests.push({
          table,
          accessible: true,
          recordCount: count[0]?.count || 0
        });
      } catch (error) {
        tableTests.push({
          table,
          accessible: false,
          error: error.message
        });
      }
    }

    const failedTables = tableTests.filter((test) => !test.accessible);

    return {
      status: failedTables.length > 0 ? 'DEGRADED' : 'UP',
      responseTime,
      tableTests,
      failedTables: failedTables.length,
      details: {
        totalTables: tableTests.length,
        accessibleTables: tableTests.length - failedTables.length
      }
    };

  } catch (error) {
    return {
      status: 'DOWN',
      responseTime: Date.now() - startTime,
      error: error.message
    };
  }
}

function checkAPIServices() {
  const startTime = Date.now();
  const apiTests = [];

  // Test critical API endpoints
  const criticalAPIs = [
  { name: 'getDashboardAnalytics', path: 'getDashboardAnalytics', params: [{}] },
  { name: 'getProducts', path: 'getProducts', params: [{ limit: 1 }] },
  { name: 'getCustomers', path: 'getCustomers', params: [{ limit: 1 }] }];


  let successfulAPIs = 0;

  for (const api of criticalAPIs) {
    const apiStartTime = Date.now();
    try {
      const result = window.ezsite.apis.run({
        path: api.path,
        param: api.params
      });

      const apiResponseTime = Date.now() - apiStartTime;

      apiTests.push({
        name: api.name,
        status: 'UP',
        responseTime: apiResponseTime,
        hasData: result && (Array.isArray(result) ? result.length > 0 : Object.keys(result).length > 0)
      });

      successfulAPIs++;

    } catch (error) {
      apiTests.push({
        name: api.name,
        status: 'DOWN',
        responseTime: Date.now() - apiStartTime,
        error: error.message
      });
    }
  }

  const overallResponseTime = Date.now() - startTime;
  const successRate = successfulAPIs / criticalAPIs.length * 100;

  return {
    status: successfulAPIs === criticalAPIs.length ? 'UP' :
    successfulAPIs > 0 ? 'DEGRADED' : 'DOWN',
    responseTime: overallResponseTime,
    successRate: Math.round(successRate),
    apiTests,
    details: {
      totalAPIs: criticalAPIs.length,
      successfulAPIs,
      failedAPIs: criticalAPIs.length - successfulAPIs
    }
  };
}

function checkFileSystem() {
  const startTime = Date.now();

  try {
    // Test file upload capability
    const testData = { test: 'data', timestamp: Date.now() };

    // Since we can't actually test file system in browser environment,
    // we'll do a basic capability check
    const capabilities = {
      localStorage: typeof localStorage !== 'undefined',
      sessionStorage: typeof sessionStorage !== 'undefined',
      indexedDB: typeof indexedDB !== 'undefined',
      fileAPI: typeof File !== 'undefined' && typeof FileReader !== 'undefined'
    };

    const workingCapabilities = Object.values(capabilities).filter(Boolean).length;
    const totalCapabilities = Object.keys(capabilities).length;

    return {
      status: workingCapabilities === totalCapabilities ? 'UP' : 'DEGRADED',
      responseTime: Date.now() - startTime,
      capabilities,
      details: {
        workingCapabilities,
        totalCapabilities,
        storageQuota: getStorageQuota()
      }
    };

  } catch (error) {
    return {
      status: 'DOWN',
      responseTime: Date.now() - startTime,
      error: error.message
    };
  }
}

function getStorageQuota() {
  try {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      // This would be async in real implementation
      return 'Available (estimate not implemented in sync context)';
    }
    return 'Unknown';
  } catch (error) {
    return 'Error: ' + error.message;
  }
}

function getPerformanceMetrics() {
  try {
    const metrics = {
      timestamp: Date.now(),
      memory: null,
      timing: null
    };

    // Memory metrics (if available)
    if (typeof performance !== 'undefined' && performance.memory) {
      const memory = performance.memory;
      metrics.memory = {
        used: Math.round(memory.usedJSHeapSize / 1024 / 1024), // MB
        total: Math.round(memory.totalJSHeapSize / 1024 / 1024), // MB
        limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024), // MB
        percentage: Math.round(memory.usedJSHeapSize / memory.jsHeapSizeLimit * 100)
      };
    }

    // Timing metrics
    if (typeof performance !== 'undefined' && performance.timing) {
      const timing = performance.timing;
      metrics.timing = {
        domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
        fullyLoaded: timing.loadEventEnd - timing.navigationStart,
        serverResponse: timing.responseEnd - timing.requestStart
      };
    }

    return metrics;

  } catch (error) {
    return {
      error: error.message,
      timestamp: Date.now()
    };
  }
}

function generateSystemAlerts(status) {
  const alerts = [];

  // Database alerts
  if (status.services.database?.status === 'DOWN') {
    alerts.push({
      type: 'DATABASE_DOWN',
      severity: 'CRITICAL',
      message: 'Database service is not responding',
      service: 'database'
    });
  } else if (status.services.database?.status === 'DEGRADED') {
    alerts.push({
      type: 'DATABASE_DEGRADED',
      severity: 'HIGH',
      message: `Database service degraded: ${status.services.database.failedTables} tables inaccessible`,
      service: 'database'
    });
  }

  // API alerts
  if (status.services.api?.status === 'DOWN') {
    alerts.push({
      type: 'API_DOWN',
      severity: 'CRITICAL',
      message: 'All API services are down',
      service: 'api'
    });
  } else if (status.services.api?.status === 'DEGRADED') {
    alerts.push({
      type: 'API_DEGRADED',
      severity: 'HIGH',
      message: `API services degraded: ${status.services.api.details.failedAPIs}/${status.services.api.details.totalAPIs} APIs failing`,
      service: 'api'
    });
  }

  // Performance alerts
  if (status.performance.memory?.percentage > 80) {
    alerts.push({
      type: 'HIGH_MEMORY_USAGE',
      severity: 'MEDIUM',
      message: `Memory usage is ${status.performance.memory.percentage}% of limit`,
      service: 'performance'
    });
  }

  // Response time alerts
  if (status.services.database?.responseTime > 2000) {
    alerts.push({
      type: 'SLOW_DATABASE',
      severity: 'MEDIUM',
      message: `Database response time is ${status.services.database.responseTime}ms`,
      service: 'database'
    });
  }

  if (status.services.api?.responseTime > 5000) {
    alerts.push({
      type: 'SLOW_API',
      severity: 'MEDIUM',
      message: `API response time is ${status.services.api.responseTime}ms`,
      service: 'api'
    });
  }

  return alerts;
}

function calculateOverallHealth(status) {
  const services = Object.values(status.services);

  // Check for any critical failures
  if (services.some((service) => service.status === 'DOWN')) {
    return 'CRITICAL';
  }

  // Check for degraded services
  if (services.some((service) => service.status === 'DEGRADED')) {
    return 'DEGRADED';
  }

  // Check alerts
  const highSeverityAlerts = status.alerts.filter((alert) =>
  alert.severity === 'CRITICAL' || alert.severity === 'HIGH'
  );

  if (highSeverityAlerts.length > 0) {
    return 'WARNING';
  }

  return 'HEALTHY';
}

// Additional utility functions
function getSystemInfo() {
  return {
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Server',
    platform: typeof navigator !== 'undefined' ? navigator.platform : 'Server',
    language: typeof navigator !== 'undefined' ? navigator.language : 'en-US',
    cookiesEnabled: typeof navigator !== 'undefined' ? navigator.cookieEnabled : true,
    onlineStatus: typeof navigator !== 'undefined' ? navigator.onLine : true
  };
}

function performQuickHealthCheck() {
  const startTime = Date.now();

  try {
    // Quick database test
    const dbTest = window.ezsite.db.query('SELECT 1', []);
    const dbOk = dbTest && dbTest.length > 0;

    return {
      timestamp: new Date().toISOString(),
      status: dbOk ? 'HEALTHY' : 'UNHEALTHY',
      responseTime: Date.now() - startTime,
      services: {
        database: dbOk ? 'UP' : 'DOWN'
      }
    };

  } catch (error) {
    return {
      timestamp: new Date().toISOString(),
      status: 'UNHEALTHY',
      responseTime: Date.now() - startTime,
      error: error.message
    };
  }
}