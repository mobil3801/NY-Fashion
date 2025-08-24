
function healthCheckInventory() {
  try {
    const timestamp = new Date().toISOString();
    const checks = [];
    let overallStatus = 'healthy';

    // 1. Database connectivity check
    try {
      const connectivityQuery = 'SELECT 1 as test';
      const connectResult = window.ezsite.db.query(connectivityQuery);
      checks.push({
        name: 'Database Connectivity',
        status: 'pass',
        message: 'Database connection successful',
        timestamp: timestamp
      });
    } catch (dbError) {
      checks.push({
        name: 'Database Connectivity',
        status: 'fail',
        message: 'Database connection failed',
        timestamp: timestamp
      });
      overallStatus = 'unhealthy';
    }

    // 2. Products table health check
    try {
      const productsQuery = `
        SELECT 
          COUNT(*) as total_products,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_products,
          COUNT(CASE WHEN is_trackable = true THEN 1 END) as trackable_products,
          COUNT(CASE WHEN current_stock IS NULL OR current_stock = 0 THEN 1 END) as out_of_stock,
          COUNT(CASE WHEN current_stock <= min_stock_level THEN 1 END) as low_stock
        FROM products
      `;

      const productStats = window.ezsite.db.query(productsQuery);
      const stats = productStats[0] || {};

      checks.push({
        name: 'Products Table Health',
        status: 'pass',
        message: `${stats.total_products || 0} total products, ${stats.active_products || 0} active`,
        data: {
          total_products: parseInt(stats.total_products) || 0,
          active_products: parseInt(stats.active_products) || 0,
          trackable_products: parseInt(stats.trackable_products) || 0,
          out_of_stock_count: parseInt(stats.out_of_stock) || 0,
          low_stock_count: parseInt(stats.low_stock) || 0
        },
        timestamp: timestamp
      });
    } catch (productsError) {
      checks.push({
        name: 'Products Table Health',
        status: 'fail',
        message: 'Failed to query products table',
        timestamp: timestamp
      });
      overallStatus = 'degraded';
    }

    // 3. Categories table health check
    try {
      const categoriesQuery = 'SELECT COUNT(*) as total_categories FROM categories';
      const categoryStats = window.ezsite.db.query(categoriesQuery);
      const categoryCount = parseInt(categoryStats[0]?.total_categories) || 0;

      checks.push({
        name: 'Categories Table Health',
        status: 'pass',
        message: `${categoryCount} categories available`,
        data: { total_categories: categoryCount },
        timestamp: timestamp
      });
    } catch (categoriesError) {
      checks.push({
        name: 'Categories Table Health',
        status: 'fail',
        message: 'Failed to query categories table',
        timestamp: timestamp
      });
      overallStatus = 'degraded';
    }

    // 4. Stock movements table health check
    try {
      const movementsQuery = `
        SELECT 
          COUNT(*) as total_movements,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as recent_movements
        FROM stock_movements
      `;

      const movementStats = window.ezsite.db.query(movementsQuery);
      const movements = movementStats[0] || {};

      checks.push({
        name: 'Stock Movements Health',
        status: 'pass',
        message: `${movements.total_movements || 0} total movements, ${movements.recent_movements || 0} in last 24h`,
        data: {
          total_movements: parseInt(movements.total_movements) || 0,
          recent_movements: parseInt(movements.recent_movements) || 0
        },
        timestamp: timestamp
      });
    } catch (movementsError) {
      checks.push({
        name: 'Stock Movements Health',
        status: 'warn',
        message: 'Stock movements table check failed - may not exist',
        timestamp: timestamp
      });
    }

    // 5. Product images table health check
    try {
      const imagesQuery = `
        SELECT 
          COUNT(*) as total_images,
          COUNT(DISTINCT product_id) as products_with_images
        FROM product_images
      `;

      const imageStats = window.ezsite.db.query(imagesQuery);
      const images = imageStats[0] || {};

      checks.push({
        name: 'Product Images Health',
        status: 'pass',
        message: `${images.total_images || 0} images for ${images.products_with_images || 0} products`,
        data: {
          total_images: parseInt(images.total_images) || 0,
          products_with_images: parseInt(images.products_with_images) || 0
        },
        timestamp: timestamp
      });
    } catch (imagesError) {
      checks.push({
        name: 'Product Images Health',
        status: 'warn',
        message: 'Product images table check failed - may not exist',
        timestamp: timestamp
      });
    }

    // 6. Data consistency checks
    try {
      // Check for products without categories
      const orphanProductsQuery = `
        SELECT COUNT(*) as orphan_count
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.category_id IS NOT NULL AND c.id IS NULL
      `;

      const orphanResult = window.ezsite.db.query(orphanProductsQuery);
      const orphanCount = parseInt(orphanResult[0]?.orphan_count) || 0;

      if (orphanCount > 0) {
        checks.push({
          name: 'Data Consistency',
          status: 'warn',
          message: `${orphanCount} products have invalid category references`,
          data: { orphan_products: orphanCount },
          timestamp: timestamp
        });
        if (overallStatus === 'healthy') overallStatus = 'degraded';
      } else {
        checks.push({
          name: 'Data Consistency',
          status: 'pass',
          message: 'No data consistency issues found',
          timestamp: timestamp
        });
      }
    } catch (consistencyError) {
      checks.push({
        name: 'Data Consistency',
        status: 'warn',
        message: 'Could not perform data consistency checks',
        timestamp: timestamp
      });
    }

    // 7. Critical stock alerts
    try {
      const criticalStockQuery = `
        SELECT COUNT(*) as critical_count
        FROM products
        WHERE is_active = true 
          AND is_trackable = true 
          AND (current_stock IS NULL OR current_stock = 0)
      `;

      const criticalResult = window.ezsite.db.query(criticalStockQuery);
      const criticalCount = parseInt(criticalResult[0]?.critical_count) || 0;

      if (criticalCount > 0) {
        checks.push({
          name: 'Stock Alerts',
          status: 'warn',
          message: `${criticalCount} products are out of stock`,
          data: { out_of_stock_products: criticalCount },
          timestamp: timestamp
        });
      } else {
        checks.push({
          name: 'Stock Alerts',
          status: 'pass',
          message: 'No critical stock issues',
          timestamp: timestamp
        });
      }
    } catch (stockError) {
      checks.push({
        name: 'Stock Alerts',
        status: 'warn',
        message: 'Could not check stock levels',
        timestamp: timestamp
      });
    }

    // Calculate summary statistics
    const passCount = checks.filter((c) => c.status === 'pass').length;
    const warnCount = checks.filter((c) => c.status === 'warn').length;
    const failCount = checks.filter((c) => c.status === 'fail').length;

    // Determine final status
    if (failCount > 0) {
      overallStatus = 'unhealthy';
    } else if (warnCount > 0) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: timestamp,
      summary: {
        total_checks: checks.length,
        passed: passCount,
        warnings: warnCount,
        failed: failCount
      },
      checks: checks,
      system_info: {
        component: 'inventory-system',
        version: '1.0.0',
        environment: 'production'
      }
    };

  } catch (error) {
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      summary: {
        total_checks: 0,
        passed: 0,
        warnings: 0,
        failed: 1
      },
      checks: [{
        name: 'Health Check System',
        status: 'fail',
        message: 'Health check system failure',
        timestamp: new Date().toISOString()
      }],
      system_info: {
        component: 'inventory-system',
        version: '1.0.0',
        environment: 'production'
      },
      error: 'Health check system encountered an error'
    };
  }
}