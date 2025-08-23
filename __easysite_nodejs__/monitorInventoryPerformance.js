
function monitorInventoryPerformance() {
  try {
    const startTime = Date.now();
    const results = {
      timestamp: new Date().toISOString(),
      metrics: [],
      summary: {
        averageResponseTime: 0,
        slowQueries: 0,
        totalQueries: 0,
        recommendations: []
      }
    };

    // Test 1: Basic product query performance
    try {
      const queryStart = Date.now();
      const products = window.ezsite.db.query(`
        SELECT id, name, selling_price, current_stock 
        FROM products 
        WHERE is_active = true 
        ORDER BY name 
        LIMIT 100
      `);
      const queryTime = Date.now() - queryStart;

      results.metrics.push({
        query: 'Basic product listing',
        executionTime: queryTime,
        recordCount: products.length,
        status: queryTime < 1000 ? 'good' : queryTime < 3000 ? 'acceptable' : 'slow'
      });

      if (queryTime > 1000) {
        results.summary.recommendations.push('Consider indexing products table on is_active and name columns');
      }
    } catch (error) {
      results.metrics.push({
        query: 'Basic product listing',
        status: 'error',
        error: error.message
      });
    }

    // Test 2: Complex join query performance
    try {
      const queryStart = Date.now();
      const productsWithCategories = window.ezsite.db.query(`
        SELECT 
          p.id, p.name, p.selling_price, p.current_stock,
          c.name as category_name,
          COUNT(sm.id) as movement_count
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN product_variants pv ON p.id = pv.product_id
        LEFT JOIN stock_movements sm ON pv.id = sm.variant_id
        WHERE p.is_active = true
        GROUP BY p.id, p.name, p.selling_price, p.current_stock, c.name
        ORDER BY p.name
        LIMIT 50
      `);
      const queryTime = Date.now() - queryStart;

      results.metrics.push({
        query: 'Complex join query (products + categories + stock movements)',
        executionTime: queryTime,
        recordCount: productsWithCategories.length,
        status: queryTime < 2000 ? 'good' : queryTime < 5000 ? 'acceptable' : 'slow'
      });

      if (queryTime > 2000) {
        results.summary.recommendations.push('Consider optimizing joins between products, categories, and stock movements');
      }
    } catch (error) {
      results.metrics.push({
        query: 'Complex join query',
        status: 'error',
        error: error.message
      });
    }

    // Test 3: Stock movement aggregation performance
    try {
      const queryStart = Date.now();
      const stockSummary = window.ezsite.db.query(`
        SELECT 
          pv.id as variant_id,
          SUM(CASE WHEN sm.delta > 0 THEN sm.delta ELSE 0 END) as total_inbound,
          SUM(CASE WHEN sm.delta < 0 THEN ABS(sm.delta) ELSE 0 END) as total_outbound,
          COUNT(sm.id) as movement_count
        FROM product_variants pv
        LEFT JOIN stock_movements sm ON pv.id = sm.variant_id
        GROUP BY pv.id
        HAVING COUNT(sm.id) > 0
        LIMIT 100
      `);
      const queryTime = Date.now() - queryStart;

      results.metrics.push({
        query: 'Stock movement aggregation',
        executionTime: queryTime,
        recordCount: stockSummary.length,
        status: queryTime < 1500 ? 'good' : queryTime < 4000 ? 'acceptable' : 'slow'
      });

      if (queryTime > 1500) {
        results.summary.recommendations.push('Consider indexing stock_movements table on variant_id and delta columns');
      }
    } catch (error) {
      results.metrics.push({
        query: 'Stock movement aggregation',
        status: 'error',
        error: error.message
      });
    }

    // Test 4: Search query performance
    try {
      const queryStart = Date.now();
      const searchResults = window.ezsite.db.query(`
        SELECT id, name, selling_price, brand, sku
        FROM products
        WHERE (
          LOWER(name) LIKE LOWER($1) OR
          LOWER(brand) LIKE LOWER($1) OR
          LOWER(sku) LIKE LOWER($1) OR
          LOWER(barcode) LIKE LOWER($1)
        ) AND is_active = true
        ORDER BY name
        LIMIT 20
      `, ['%test%']);
      const queryTime = Date.now() - queryStart;

      results.metrics.push({
        query: 'Product search',
        executionTime: queryTime,
        recordCount: searchResults.length,
        status: queryTime < 800 ? 'good' : queryTime < 2000 ? 'acceptable' : 'slow'
      });

      if (queryTime > 800) {
        results.summary.recommendations.push('Consider adding full-text search indexes or search-specific columns');
      }
    } catch (error) {
      results.metrics.push({
        query: 'Product search',
        status: 'error',
        error: error.message
      });
    }

    // Test 5: Low stock query performance
    try {
      const queryStart = Date.now();
      const lowStockProducts = window.ezsite.db.query(`
        SELECT 
          p.id, p.name, p.current_stock, p.min_stock_level,
          c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.is_active = true 
          AND p.is_trackable = true
          AND (p.current_stock IS NULL OR p.current_stock <= COALESCE(p.min_stock_level, 5))
        ORDER BY p.current_stock ASC
        LIMIT 50
      `);
      const queryTime = Date.now() - queryStart;

      results.metrics.push({
        query: 'Low stock products',
        executionTime: queryTime,
        recordCount: lowStockProducts.length,
        status: queryTime < 500 ? 'good' : queryTime < 1500 ? 'acceptable' : 'slow'
      });

      if (queryTime > 500) {
        results.summary.recommendations.push('Consider indexing products table on current_stock and min_stock_level columns');
      }
    } catch (error) {
      results.metrics.push({
        query: 'Low stock products',
        status: 'error',
        error: error.message
      });
    }

    // Calculate summary statistics
    const successfulQueries = results.metrics.filter(m => m.status !== 'error');
    const totalExecutionTime = successfulQueries.reduce((sum, m) => sum + (m.executionTime || 0), 0);
    
    results.summary.totalQueries = results.metrics.length;
    results.summary.successfulQueries = successfulQueries.length;
    results.summary.averageResponseTime = successfulQueries.length > 0 ? 
      totalExecutionTime / successfulQueries.length : 0;
    results.summary.slowQueries = successfulQueries.filter(m => m.status === 'slow').length;
    results.summary.totalExecutionTime = Date.now() - startTime;

    // Add general recommendations based on metrics
    if (results.summary.slowQueries > 2) {
      results.summary.recommendations.push('Multiple slow queries detected - consider database optimization');
    }

    if (results.summary.averageResponseTime > 1500) {
      results.summary.recommendations.push('Average query time is high - consider reviewing database schema and indexes');
    }

    return results;

  } catch (error) {
    console.error('Performance monitoring error:', error);
    throw new Error(`Failed to monitor inventory performance: ${error.message}`);
  }
}
