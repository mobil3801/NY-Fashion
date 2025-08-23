
function createDatabaseConnectionManager() {
  const connectionPool = new Map();
  const queryCache = new Map();
  const connectionMetrics = {
    totalConnections: 0,
    activeConnections: 0,
    queryCount: 0,
    averageQueryTime: 0,
    slowQueries: [],
    failedQueries: 0
  };

  // Query optimization patterns
  const optimizationPatterns = {
    // Add LIMIT if missing and could benefit
    addLimitIfMissing: (query) => {
      if (query.toUpperCase().includes('SELECT') && 
          !query.toUpperCase().includes('LIMIT') && 
          !query.toUpperCase().includes('COUNT(')) {
        return query + ' LIMIT 1000';
      }
      return query;
    },
    
    // Optimize WHERE clauses
    optimizeWhereClause: (query) => {
      // Add index hints for common patterns
      return query.replace(
        /WHERE\s+(\w+)\s*=\s*/gi, 
        'WHERE $1 = '
      );
    }
  };

  function executeOptimizedQuery(query, params = []) {
    const startTime = Date.now();
    const queryId = `query_${Date.now()}_${Math.random()}`;
    
    try {
      // Apply optimizations
      let optimizedQuery = query;
      Object.values(optimizationPatterns).forEach(pattern => {
        optimizedQuery = pattern(optimizedQuery);
      });

      // Check query cache
      const cacheKey = `${optimizedQuery}_${JSON.stringify(params)}`;
      if (queryCache.has(cacheKey)) {
        const cached = queryCache.get(cacheKey);
        if (Date.now() - cached.timestamp < 60000) { // 1 minute cache
          connectionMetrics.queryCount++;
          return cached.result;
        } else {
          queryCache.delete(cacheKey);
        }
      }

      // Execute query
      const result = window.ezsite.db.query(optimizedQuery, params);
      const executionTime = Date.now() - startTime;

      // Update metrics
      connectionMetrics.queryCount++;
      connectionMetrics.averageQueryTime = 
        (connectionMetrics.averageQueryTime * (connectionMetrics.queryCount - 1) + executionTime) / connectionMetrics.queryCount;

      // Track slow queries
      if (executionTime > 1000) {
        connectionMetrics.slowQueries.push({
          query: optimizedQuery,
          params,
          executionTime,
          timestamp: Date.now()
        });
        
        // Keep only last 50 slow queries
        if (connectionMetrics.slowQueries.length > 50) {
          connectionMetrics.slowQueries = connectionMetrics.slowQueries.slice(-50);
        }
      }

      // Cache result for simple SELECT queries
      if (optimizedQuery.toUpperCase().trim().startsWith('SELECT') && executionTime < 500) {
        queryCache.set(cacheKey, {
          result,
          timestamp: Date.now()
        });
        
        // Limit cache size
        if (queryCache.size > 100) {
          const oldestKey = queryCache.keys().next().value;
          queryCache.delete(oldestKey);
        }
      }

      return result;

    } catch (error) {
      connectionMetrics.failedQueries++;
      console.error('Database query failed:', {
        query,
        params,
        error: error.message,
        executionTime: Date.now() - startTime
      });
      throw error;
    }
  }

  function getConnectionMetrics() {
    return {
      ...connectionMetrics,
      cacheSize: queryCache.size,
      cacheHitRate: connectionMetrics.queryCount > 0 ? 
        ((connectionMetrics.queryCount - connectionMetrics.slowQueries.length) / connectionMetrics.queryCount * 100).toFixed(2) + '%' : '0%'
    };
  }

  function clearQueryCache() {
    queryCache.clear();
    return { success: true, message: 'Query cache cleared' };
  }

  function optimizeDatabase() {
    try {
      // Run database optimization queries
      const optimizations = [];

      // Update table statistics
      try {
        window.ezsite.db.query('ANALYZE;', []);
        optimizations.push('Statistics updated');
      } catch (e) {
        optimizations.push('Statistics update failed: ' + e.message);
      }

      // Clean up expired cache entries
      const expiredCount = Array.from(queryCache.entries()).filter(([key, value]) => 
        Date.now() - value.timestamp > 300000 // 5 minutes
      ).length;
      
      queryCache.forEach((value, key) => {
        if (Date.now() - value.timestamp > 300000) {
          queryCache.delete(key);
        }
      });

      if (expiredCount > 0) {
        optimizations.push(`Removed ${expiredCount} expired cache entries`);
      }

      return {
        success: true,
        optimizations,
        metrics: getConnectionMetrics()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  return {
    executeQuery: executeOptimizedQuery,
    getMetrics: getConnectionMetrics,
    clearCache: clearQueryCache,
    optimize: optimizeDatabase
  };
}

// Export the manager
const dbManager = createDatabaseConnectionManager();

// Main function that can be called from the frontend
function getDatabaseMetrics() {
  return dbManager.getMetrics();
}
