
function productionHealthCheck() {
  const startTime = Date.now();
  const healthReport = {
    timestamp: new Date().toISOString(),
    status: 'HEALTHY',
    version: '1.0.0',
    uptime: process.uptime ? process.uptime() : 0,
    checks: {},
    performance: {},
    recommendations: [],
    alerts: []
  };

  try {
    // 1. Database Health Check
    healthReport.checks.database = checkDatabaseHealth();

    // 2. API Endpoints Health Check
    healthReport.checks.api = checkAPIHealth();

    // 3. Memory and Performance Check
    healthReport.checks.performance = checkPerformanceHealth();

    // 4. System Resources Check
    healthReport.checks.system = checkSystemHealth();

    // 5. Data Integrity Check
    healthReport.checks.dataIntegrity = checkDataIntegrity();

    // Calculate overall status
    const failedChecks = Object.values(healthReport.checks).filter((check) =>
    check.status === 'CRITICAL' || check.status === 'ERROR'
    ).length;

    const warningChecks = Object.values(healthReport.checks).filter((check) =>
    check.status === 'WARNING'
    ).length;

    if (failedChecks > 0) {
      healthReport.status = 'CRITICAL';
    } else if (warningChecks > 0) {
      healthReport.status = 'WARNING';
    } else {
      healthReport.status = 'HEALTHY';
    }

    // Performance metrics
    healthReport.performance = {
      healthCheckDuration: Date.now() - startTime,
      timestamp: Date.now()
    };

    // Generate recommendations
    generateHealthRecommendations(healthReport);

    return healthReport;

  } catch (error) {
    return {
      timestamp: new Date().toISOString(),
      status: 'CRITICAL',
      error: error.message,
      checks: {},
      performance: {
        healthCheckDuration: Date.now() - startTime
      }
    };
  }
}

function checkDatabaseHealth() {
  const check = {
    status: 'HEALTHY',
    metrics: {},
    issues: [],
    responseTime: 0
  };

  try {
    const dbStart = Date.now();

    // Test basic connectivity
    const connectivityTest = window.ezsite.db.query('SELECT 1 as test', []);
    if (!connectivityTest || connectivityTest.length === 0) {
      throw new Error('Database connectivity test failed');
    }

    check.responseTime = Date.now() - dbStart;

    // Check critical tables
    const criticalTables = ['products', 'customers', 'sales', 'employees'];
    for (const table of criticalTables) {
      try {
        const count = window.ezsite.db.query(`SELECT COUNT(*) as count FROM ${table}`, []);
        check.metrics[`${table}_count`] = count[0]?.count || 0;
      } catch (error) {
        check.issues.push(`Table ${table} check failed: ${error.message}`);
        check.status = 'WARNING';
      }
    }

    // Performance checks
    if (check.responseTime > 1000) {
      check.issues.push('Database response time is slow');
      check.status = check.status === 'HEALTHY' ? 'WARNING' : check.status;
    }

    // Check for common issues
    try {
      const deadlocks = window.ezsite.db.query(`
        SELECT COUNT(*) as count 
        FROM information_schema.processlist 
        WHERE state LIKE '%lock%'
      `, []);

      if (deadlocks[0]?.count > 0) {
        check.issues.push(`${deadlocks[0].count} potential deadlocks detected`);
        check.status = 'WARNING';
      }
    } catch (error) {


      // This query might not work on all database systems, ignore silently
    }} catch (error) {
    check.status = 'CRITICAL';
    check.issues.push(`Database health check failed: ${error.message}`);
  }

  return check;
}

function checkAPIHealth() {
  const check = {
    status: 'HEALTHY',
    endpoints: {},
    issues: [],
    averageResponseTime: 0
  };

  const criticalEndpoints = [
  { name: 'getProducts', path: 'getProducts', params: [{ limit: 1 }] },
  { name: 'getCustomers', path: 'getCustomers', params: [{ limit: 1 }] },
  { name: 'getDashboardAnalytics', path: 'getDashboardAnalytics', params: [{}] }];


  let totalResponseTime = 0;
  let successfulTests = 0;

  for (const endpoint of criticalEndpoints) {
    try {
      const startTime = Date.now();
      const result = window.ezsite.apis.run({
        path: endpoint.path,
        param: endpoint.params
      });
      const responseTime = Date.now() - startTime;

      check.endpoints[endpoint.name] = {
        status: 'OK',
        responseTime,
        hasData: result && (Array.isArray(result) ? result.length > 0 : Object.keys(result).length > 0)
      };

      totalResponseTime += responseTime;
      successfulTests++;

      if (responseTime > 2000) {
        check.issues.push(`${endpoint.name} is responding slowly (${responseTime}ms)`);
        check.status = check.status === 'HEALTHY' ? 'WARNING' : check.status;
      }

    } catch (error) {
      check.endpoints[endpoint.name] = {
        status: 'ERROR',
        error: error.message
      };
      check.issues.push(`${endpoint.name} failed: ${error.message}`);
      check.status = 'CRITICAL';
    }
  }

  check.averageResponseTime = successfulTests > 0 ? totalResponseTime / successfulTests : 0;

  return check;
}

function checkPerformanceHealth() {
  const check = {
    status: 'HEALTHY',
    metrics: {},
    issues: []
  };

  try {
    // Memory usage (if available)
    if (typeof performance !== 'undefined' && performance.memory) {
      const memory = performance.memory;
      check.metrics.memoryUsage = {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
        percentage: Math.round(memory.usedJSHeapSize / memory.jsHeapSizeLimit * 100)
      };

      if (check.metrics.memoryUsage.percentage > 80) {
        check.issues.push('High memory usage detected');
        check.status = 'WARNING';
      }
    }

    // Check for long-running operations
    const longTaskThreshold = 50; // ms
    if (typeof PerformanceObserver !== 'undefined') {
      // This would be tracked in the frontend performance monitor
      check.metrics.performanceMonitoring = 'Available';
    } else {
      check.metrics.performanceMonitoring = 'Not Available';
    }

  } catch (error) {
    check.issues.push(`Performance check failed: ${error.message}`);
    check.status = 'WARNING';
  }

  return check;
}

function checkSystemHealth() {
  const check = {
    status: 'HEALTHY',
    metrics: {},
    issues: []
  };

  try {
    // Check current time and timezone
    check.metrics.currentTime = new Date().toISOString();
    check.metrics.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Check for browser compatibility features
    const features = {
      localStorage: typeof localStorage !== 'undefined',
      sessionStorage: typeof sessionStorage !== 'undefined',
      indexedDB: typeof indexedDB !== 'undefined',
      webWorkers: typeof Worker !== 'undefined',
      performanceAPI: typeof performance !== 'undefined'
    };

    check.metrics.browserFeatures = features;

    // Check for any missing critical features
    const missingFeatures = Object.entries(features).
    filter(([key, available]) => !available).
    map(([key]) => key);

    if (missingFeatures.length > 0) {
      check.issues.push(`Missing browser features: ${missingFeatures.join(', ')}`);
      check.status = 'WARNING';
    }

  } catch (error) {
    check.issues.push(`System check failed: ${error.message}`);
    check.status = 'WARNING';
  }

  return check;
}

function checkDataIntegrity() {
  const check = {
    status: 'HEALTHY',
    metrics: {},
    issues: []
  };

  try {
    // Check for orphaned records
    const integrityChecks = [
    {
      name: 'Orphaned product variants',
      query: `
          SELECT COUNT(*) as count 
          FROM product_variants pv 
          LEFT JOIN products p ON pv.product_id = p.id 
          WHERE p.id IS NULL
        `
    },
    {
      name: 'Stock movements without variants',
      query: `
          SELECT COUNT(*) as count 
          FROM stock_movements sm 
          LEFT JOIN product_variants pv ON sm.variant_id = pv.id 
          WHERE pv.id IS NULL
        `
    },
    {
      name: 'Sales without customers',
      query: `
          SELECT COUNT(*) as count 
          FROM sales s 
          LEFT JOIN customers c ON s.customer_id = c.id 
          WHERE s.customer_id IS NOT NULL AND c.id IS NULL
        `
    }];


    for (const integrityCheck of integrityChecks) {
      try {
        const result = window.ezsite.db.query(integrityCheck.query, []);
        const count = result[0]?.count || 0;

        check.metrics[integrityCheck.name] = count;

        if (count > 0) {
          check.issues.push(`${integrityCheck.name}: ${count} records found`);
          check.status = check.status === 'HEALTHY' ? 'WARNING' : check.status;
        }
      } catch (error) {
        check.issues.push(`${integrityCheck.name} check failed: ${error.message}`);
      }
    }

    // Check for negative stock levels
    try {
      const negativeStock = window.ezsite.db.query(`
        SELECT COUNT(*) as count 
        FROM products 
        WHERE current_stock < 0 AND is_trackable = true
      `, []);

      const count = negativeStock[0]?.count || 0;
      check.metrics['Negative stock products'] = count;

      if (count > 0) {
        check.issues.push(`${count} products have negative stock levels`);
        check.status = check.status === 'HEALTHY' ? 'WARNING' : check.status;
      }
    } catch (error) {
      check.issues.push(`Negative stock check failed: ${error.message}`);
    }

  } catch (error) {
    check.status = 'CRITICAL';
    check.issues.push(`Data integrity check failed: ${error.message}`);
  }

  return check;
}

function generateHealthRecommendations(healthReport) {
  const recommendations = [];
  const alerts = [];

  // Database recommendations
  if (healthReport.checks.database?.responseTime > 1000) {
    recommendations.push('Consider optimizing database queries or adding indexes');
  }

  if (healthReport.checks.database?.issues?.length > 0) {
    alerts.push('Database issues detected - immediate attention required');
  }

  // API recommendations
  if (healthReport.checks.api?.averageResponseTime > 2000) {
    recommendations.push('API response times are slow - consider optimization');
  }

  // Performance recommendations
  const memoryUsage = healthReport.checks.performance?.metrics?.memoryUsage?.percentage;
  if (memoryUsage && memoryUsage > 70) {
    recommendations.push('Memory usage is high - consider implementing cleanup strategies');
  }

  // Data integrity recommendations
  if (healthReport.checks.dataIntegrity?.issues?.length > 0) {
    recommendations.push('Data integrity issues found - schedule maintenance');
    if (healthReport.checks.dataIntegrity.status === 'CRITICAL') {
      alerts.push('Critical data integrity issues - immediate action required');
    }
  }

  healthReport.recommendations = recommendations;
  healthReport.alerts = alerts;
}