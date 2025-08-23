
function validateInventoryConsistency() {
  try {
    const results = {
      timestamp: new Date().toISOString(),
      checks: [],
      summary: {
        totalChecks: 0,
        passedChecks: 0,
        failedChecks: 0,
        warnings: []
      }
    };

    // Check 1: Verify all products have valid categories
    try {
      const productsWithoutValidCategory = window.ezsite.db.query(`
        SELECT p.id, p.name 
        FROM products p 
        LEFT JOIN categories c ON p.category_id = c.id 
        WHERE c.id IS NULL
      `);

      results.checks.push({
        name: 'Products with valid categories',
        status: productsWithoutValidCategory.length === 0 ? 'passed' : 'failed',
        description: 'All products should have valid category references',
        issues: productsWithoutValidCategory.length,
        details: productsWithoutValidCategory.slice(0, 5) // First 5 issues
      });

      if (productsWithoutValidCategory.length > 0) {
        results.summary.warnings.push(`${productsWithoutValidCategory.length} products have invalid category references`);
      }
    } catch (error) {
      results.checks.push({
        name: 'Products with valid categories',
        status: 'error',
        error: error.message
      });
    }

    // Check 2: Verify stock movement calculations
    try {
      const stockInconsistencies = window.ezsite.db.query(`
        SELECT 
          pv.id as variant_id,
          pv.product_id,
          COALESCE(il.qty_on_hand, 0) as current_stock,
          COALESCE(SUM(sm.delta), 0) as calculated_stock,
          (COALESCE(il.qty_on_hand, 0) - COALESCE(SUM(sm.delta), 0)) as difference
        FROM product_variants pv
        LEFT JOIN inventory_lots il ON pv.id = il.variant_id
        LEFT JOIN stock_movements sm ON pv.id = sm.variant_id
        GROUP BY pv.id, pv.product_id, il.qty_on_hand
        HAVING ABS(COALESCE(il.qty_on_hand, 0) - COALESCE(SUM(sm.delta), 0)) > 0
      `);

      results.checks.push({
        name: 'Stock movement consistency',
        status: stockInconsistencies.length === 0 ? 'passed' : 'failed',
        description: 'Inventory lots should match sum of stock movements',
        issues: stockInconsistencies.length,
        details: stockInconsistencies.slice(0, 5)
      });

      if (stockInconsistencies.length > 0) {
        results.summary.warnings.push(`${stockInconsistencies.length} variants have stock inconsistencies`);
      }
    } catch (error) {
      results.checks.push({
        name: 'Stock movement consistency',
        status: 'error',
        error: error.message
      });
    }

    // Check 3: Verify product variants have valid product references
    try {
      const variantsWithoutValidProduct = window.ezsite.db.query(`
        SELECT pv.id, pv.product_id
        FROM product_variants pv
        LEFT JOIN products p ON pv.product_id = p.id
        WHERE p.id IS NULL
      `);

      results.checks.push({
        name: 'Product variants with valid products',
        status: variantsWithoutValidProduct.length === 0 ? 'passed' : 'failed',
        description: 'All product variants should reference valid products',
        issues: variantsWithoutValidProduct.length,
        details: variantsWithoutValidProduct.slice(0, 5)
      });

      if (variantsWithoutValidProduct.length > 0) {
        results.summary.warnings.push(`${variantsWithoutValidProduct.length} variants have invalid product references`);
      }
    } catch (error) {
      results.checks.push({
        name: 'Product variants with valid products',
        status: 'error',
        error: error.message
      });
    }

    // Check 4: Verify stock movements have valid variant references
    try {
      const movementsWithoutValidVariant = window.ezsite.db.query(`
        SELECT sm.id, sm.variant_id
        FROM stock_movements sm
        LEFT JOIN product_variants pv ON sm.variant_id = pv.id
        WHERE pv.id IS NULL
        LIMIT 10
      `);

      results.checks.push({
        name: 'Stock movements with valid variants',
        status: movementsWithoutValidVariant.length === 0 ? 'passed' : 'failed',
        description: 'All stock movements should reference valid product variants',
        issues: movementsWithoutValidVariant.length,
        details: movementsWithoutValidVariant.slice(0, 5)
      });

      if (movementsWithoutValidVariant.length > 0) {
        results.summary.warnings.push(`${movementsWithoutValidVariant.length} stock movements have invalid variant references`);
      }
    } catch (error) {
      results.checks.push({
        name: 'Stock movements with valid variants',
        status: 'error',
        error: error.message
      });
    }

    // Check 5: Verify data types and constraints
    try {
      const invalidPrices = window.ezsite.db.query(`
        SELECT id, name, selling_price, cost_price
        FROM products 
        WHERE selling_price < 0 OR cost_price < 0 OR selling_price IS NULL OR cost_price IS NULL
        LIMIT 10
      `);

      results.checks.push({
        name: 'Valid product pricing',
        status: invalidPrices.length === 0 ? 'passed' : 'failed',
        description: 'Product prices should be non-negative numbers',
        issues: invalidPrices.length,
        details: invalidPrices
      });

      if (invalidPrices.length > 0) {
        results.summary.warnings.push(`${invalidPrices.length} products have invalid pricing`);
      }
    } catch (error) {
      results.checks.push({
        name: 'Valid product pricing',
        status: 'error',
        error: error.message
      });
    }

    // Calculate summary statistics
    results.summary.totalChecks = results.checks.length;
    results.summary.passedChecks = results.checks.filter(check => check.status === 'passed').length;
    results.summary.failedChecks = results.checks.filter(check => check.status === 'failed').length;
    results.summary.errorChecks = results.checks.filter(check => check.status === 'error').length;
    results.summary.passRate = results.summary.totalChecks > 0 ? 
      (results.summary.passedChecks / results.summary.totalChecks) * 100 : 0;

    return results;

  } catch (error) {
    console.error('Database consistency validation error:', error);
    throw new Error(`Failed to validate database consistency: ${error.message}`);
  }
}
