
function healthCheckInventory() {
  try {
    console.log('Starting inventory system health check...');

    const results = {
      timestamp: new Date().toISOString(),
      database_connection: false,
      tables_exist: {
        products: false,
        categories: false
      },
      sample_data: {
        total_products: 0,
        total_categories: 0,
        low_stock_products: 0,
        out_of_stock_products: 0
      },
      api_functions: {
        getProducts: false,
        getLowStockProducts: false
      },
      issues: [],
      recommendations: []
    };

    // Test database connection
    try {
      const dbTest = window.ezsite.db.query('SELECT 1 as test', []);
      results.database_connection = dbTest && dbTest.length > 0;
      console.log('Database connection: OK');
    } catch (dbError) {
      results.issues.push('Database connection failed: ' + dbError.message);
      console.error('Database connection error:', dbError);
    }

    if (results.database_connection) {
      // Test products table
      try {
        const productCount = window.ezsite.db.query('SELECT COUNT(*) as count FROM products', []);
        results.tables_exist.products = true;
        results.sample_data.total_products = productCount[0]?.count || 0;
        console.log(`Products table exists with ${results.sample_data.total_products} records`);
      } catch (productError) {
        results.issues.push('Products table issue: ' + productError.message);
        console.error('Products table error:', productError);
      }

      // Test categories table
      try {
        const categoryCount = window.ezsite.db.query('SELECT COUNT(*) as count FROM categories', []);
        results.tables_exist.categories = true;
        results.sample_data.total_categories = categoryCount[0]?.count || 0;
        console.log(`Categories table exists with ${results.sample_data.total_categories} records`);
      } catch (categoryError) {
        results.issues.push('Categories table issue: ' + categoryError.message);
        console.error('Categories table error:', categoryError);
      }

      // Test low stock and out of stock counts
      if (results.tables_exist.products) {
        try {
          const lowStockCount = window.ezsite.db.query(`
            SELECT COUNT(*) as count 
            FROM products 
            WHERE is_active = true 
              AND is_trackable = true 
              AND (current_stock IS NULL OR current_stock <= COALESCE(min_stock_level, 5))
          `, []);
          results.sample_data.low_stock_products = lowStockCount[0]?.count || 0;

          const outOfStockCount = window.ezsite.db.query(`
            SELECT COUNT(*) as count 
            FROM products 
            WHERE is_active = true 
              AND is_trackable = true 
              AND (current_stock IS NULL OR current_stock = 0)
          `, []);
          results.sample_data.out_of_stock_products = outOfStockCount[0]?.count || 0;

          console.log(`Stock analysis: ${results.sample_data.low_stock_products} low stock, ${results.sample_data.out_of_stock_products} out of stock`);
        } catch (stockError) {
          results.issues.push('Stock analysis error: ' + stockError.message);
          console.error('Stock analysis error:', stockError);
        }
      }
    }

    // Test API functions
    try {
      // Test getProducts function
      const testProducts = window.ezsite.apis.run({
        path: 'getProducts',
        param: [{ limit: 1 }]
      });
      results.api_functions.getProducts = true;
      console.log('getProducts API: OK');
    } catch (getProductsError) {
      results.issues.push('getProducts API error: ' + getProductsError.message);
      results.api_functions.getProducts = false;
      console.error('getProducts API error:', getProductsError);
    }

    try {
      // Test getLowStockProducts function
      const testLowStock = window.ezsite.apis.run({
        path: 'getLowStockProducts',
        param: [{ limit: 1 }]
      });
      results.api_functions.getLowStockProducts = true;
      console.log('getLowStockProducts API: OK');
    } catch (getLowStockError) {
      results.issues.push('getLowStockProducts API error: ' + getLowStockError.message);
      results.api_functions.getLowStockProducts = false;
      console.error('getLowStockProducts API error:', getLowStockError);
    }

    // Generate recommendations
    if (!results.database_connection) {
      results.recommendations.push('Check database connection and configuration');
    }

    if (!results.tables_exist.products || !results.tables_exist.categories) {
      results.recommendations.push('Ensure database tables are properly created');
    }

    if (results.sample_data.total_products === 0) {
      results.recommendations.push('Seed inventory data to test the system with sample products');
    }

    if (results.sample_data.low_stock_products > 0) {
      results.recommendations.push(`${results.sample_data.low_stock_products} products need restocking`);
    }

    if (!results.api_functions.getProducts || !results.api_functions.getLowStockProducts) {
      results.recommendations.push('Fix API function errors for proper frontend integration');
    }

    // Overall health status
    const isHealthy = results.database_connection &&
    results.tables_exist.products &&
    results.tables_exist.categories &&
    results.api_functions.getProducts &&
    results.api_functions.getLowStockProducts;

    results.overall_health = isHealthy ? 'HEALTHY' : 'NEEDS_ATTENTION';

    console.log('Health check completed:', results.overall_health);
    return results;

  } catch (error) {
    console.error('Health check error:', error);
    return {
      timestamp: new Date().toISOString(),
      overall_health: 'ERROR',
      error: error.message,
      issues: ['Health check system error: ' + error.message],
      recommendations: ['Check system logs and contact technical support']
    };
  }
}